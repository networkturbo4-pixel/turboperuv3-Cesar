import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { DeviceAdapterFactory, DeviceConnectionConfig } from "./adapters/device.adapter";

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

const sampleDevices: DeviceConnectionConfig[] = [
  {
    id: 1,
    name: "Router Core MikroTik CCR1036",
    vendor: "mikrotik",
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
    model: "Cisco Catalyst 3850",
    ipAddress: "192.168.88.2",
    port: 22,
    username: "admin",
    apiType: "ssh",
  },
];

export const networkRoutes: FastifyPluginAsync = async (fastify) => {
  // Listar equipos de red
  fastify.get("/network/devices", async (_request, reply) => {
    return reply.send({ success: true, count: sampleDevices.length, data: sampleDevices });
  });

  // Probar conectividad con un equipo usando el adaptador específico
  fastify.post("/network/devices/:id/test-connection", async (request, reply) => {
    const { id } = request.params as { id: string };
    const deviceId = parseInt(id, 10);
    const device = sampleDevices.find((d) => d.id === deviceId);

    if (!device) {
      return reply.status(404).send({ success: false, message: "Equipo no encontrado" });
    }

    const adapter = DeviceAdapterFactory.getAdapter(device.vendor);
    const result = await adapter.testConnection(device);
    const metrics = await adapter.getMetrics(device);

    return reply.send({
      success: true,
      data: {
        device: { id: device.id, name: device.name, vendor: device.vendor, ipAddress: device.ipAddress },
        testResult: result,
        metrics,
      },
    });
  });

  // Agregar nuevo equipo de red
  fastify.post("/network/devices", async (request, reply) => {
    const parseResult = createDeviceSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ success: false, errors: parseResult.error.format() });
    }

    const newDevice: DeviceConnectionConfig = {
      id: sampleDevices.length + 1,
      ...parseResult.data,
    };
    sampleDevices.push(newDevice);

    return reply.status(201).send({ success: true, data: newDevice });
  });
};
