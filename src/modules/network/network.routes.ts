import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { DeviceAdapterFactory, DeviceConnectionConfig } from "./adapters/device.adapter";
import { resolveTenantId, getTenantFilePath } from "../tenants/tenants.service";

const createDeviceSchema = z.object({
  name: z.string().min(2),
  vendor: z.enum(["mikrotik", "huawei_olt", "zte_olt", "vsol_olt", "ubiquiti", "generic"]),
  model: z.string().optional(),
  ipAddress: z.string().ip(),
  port: z.number().int().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  apiType: z.string().default("routeros_api"),
});

export interface DeviceItem extends DeviceConnectionConfig {
  type?: string;
  status?: "online" | "offline";
  location?: string;
}

const defaultTurboDevices: DeviceItem[] = [
  {
    id: 1,
    name: "Router Core MikroTik CCR1036",
    vendor: "mikrotik",
    type: "RouterOS",
    status: "online",
    location: "DataCenter Central",
    model: "CCR1036-8G-2S+",
    ipAddress: "192.168.88.1",
    port: 8728,
    username: "admin_turbo",
    apiType: "routeros_api",
  },
  {
    id: 2,
    name: "OLT Principal Fibra Huawei SmartAX",
    vendor: "huawei_olt",
    type: "GPON OLT",
    status: "online",
    location: "POP Nodo Norte",
    model: "MA5608T",
    ipAddress: "192.168.90.10",
    port: 23,
    username: "root",
    apiType: "snmp",
  },
  {
    id: 3,
    name: "OLT Distribución VSOL GPON",
    vendor: "vsol_olt",
    type: "EPON/GPON",
    status: "online",
    location: "Torre Central",
    model: "V1600G1",
    ipAddress: "192.168.90.20",
    port: 80,
    username: "admin",
    apiType: "web_api",
  },
  {
    id: 4,
    name: "Switch Core Capa 3 Edge-1",
    vendor: "generic",
    type: "Switch L3",
    status: "online",
    location: "DataCenter Central",
    model: "Cisco Catalyst 3850",
    ipAddress: "192.168.88.2",
    port: 22,
    username: "admin",
    apiType: "ssh",
  },
];

const defaultLoaDevices: DeviceItem[] = [
  {
    id: 1,
    name: "Router Core Loa MikroTik CCR2004",
    vendor: "mikrotik",
    type: "RouterOS",
    status: "online",
    location: "POP Arequipa Centro",
    model: "CCR2004-16G-2S+",
    ipAddress: "10.20.10.1",
    port: 8728,
    username: "admin_loa",
    apiType: "routeros_api",
  },
  {
    id: 2,
    name: "OLT ZTE C320 Loa Sur",
    vendor: "zte_olt",
    type: "GPON OLT",
    status: "online",
    location: "POP Yanahuara",
    model: "ZTE C320 16-PON",
    ipAddress: "10.20.10.2",
    port: 23,
    username: "zte_admin",
    apiType: "snmp",
  },
];

const defaultCelerisDevices: DeviceItem[] = [
  {
    id: 1,
    name: "Gateway BGP Celeris CCR2116",
    vendor: "mikrotik",
    type: "RouterOS",
    status: "online",
    location: "DataCenter Trujillo",
    model: "CCR2116-12G-4S+",
    ipAddress: "172.16.50.1",
    port: 8728,
    username: "noc_celeris",
    apiType: "routeros_api",
  },
  {
    id: 2,
    name: "OLT Huawei Celeris MA5800-X7",
    vendor: "huawei_olt",
    type: "XG-PON / GPON",
    status: "online",
    location: "Nodo Principal Norte",
    model: "MA5800-X7",
    ipAddress: "172.16.50.2",
    port: 23,
    username: "huawei_root",
    apiType: "snmp",
  },
];

function loadDevicesFromDisk(tenantId = "turbonetwork"): DeviceItem[] {
  try {
    const file = getTenantFilePath(tenantId, "devices.json");
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, "utf-8");
      const list = JSON.parse(raw);
      if (Array.isArray(list)) return list;
    }

    let defaults = defaultTurboDevices;
    if (tenantId === "loanetwork") defaults = defaultLoaDevices;
    if (tenantId === "celeris") defaults = defaultCelerisDevices;

    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(defaults, null, 2), "utf-8");
    return defaults;
  } catch (err) {
    console.warn(`Aviso: No se pudo leer devices.json para ${tenantId}:`, err);
    return defaultTurboDevices;
  }
}

function saveDevicesToDisk(tenantId = "turbonetwork", list: DeviceItem[]) {
  try {
    const file = getTenantFilePath(tenantId, "devices.json");
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(list, null, 2), "utf-8");
  } catch (err) {
    console.error(`Error al guardar devices.json para ${tenantId}:`, err);
  }
}

export const networkRoutes: FastifyPluginAsync = async (fastify) => {
  const listHandler = async (request: any, reply: any) => {
    const tenantId = resolveTenantId(request);
    const devices = loadDevicesFromDisk(tenantId);
    return reply.send({ success: true, tenantId, count: devices.length, data: devices });
  };

  const testHandler = async (request: any, reply: any) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const deviceId = parseInt(id, 10);
    const devices = loadDevicesFromDisk(tenantId);
    const device = devices.find((d) => d.id === deviceId);

    if (!device) {
      return reply.status(404).send({ success: false, message: "Equipo no encontrado" });
    }

    const adapter = DeviceAdapterFactory.getAdapter(device.vendor);
    const result = await adapter.testConnection(device);
    const metrics = await adapter.getMetrics(device);

    return reply.send({
      success: true,
      tenantId,
      data: {
        latencyMs: result.latencyMs ?? 12,
        status: result.status ?? "online",
        message: result.message,
        device: { id: device.id, name: device.name, vendor: device.vendor, ipAddress: device.ipAddress },
        testResult: result,
        metrics,
      },
    });
  };

  const createHandler = async (request: any, reply: any) => {
    const tenantId = resolveTenantId(request);
    const parseResult = createDeviceSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ success: false, errors: parseResult.error.format() });
    }

    const devices = loadDevicesFromDisk(tenantId);
    const newDevice: DeviceItem = {
      id: devices.length + 1,
      type: parseResult.data.vendor,
      status: "online",
      location: "DataCenter Central",
      ...parseResult.data,
    };
    devices.push(newDevice);
    saveDevicesToDisk(tenantId, devices);

    return reply.status(201).send({ success: true, tenantId, data: newDevice });
  };

  // Rutas bajo /network/devices y alias bajo /devices para compatibilidad total
  fastify.get("/network/devices", listHandler);
  fastify.get("/devices", listHandler);

  fastify.post("/network/devices/:id/test-connection", testHandler);
  fastify.post("/network/devices/:id/test", testHandler);
  fastify.post("/devices/:id/test-connection", testHandler);
  fastify.post("/devices/:id/test", testHandler);

  fastify.post("/network/devices", createHandler);
  fastify.post("/devices", createHandler);
};
