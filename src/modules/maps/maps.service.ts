import fs from "fs";
import path from "path";
import { getTenantFilePath } from "../tenants/tenants.service";
import { MapTenantData, MapNode, MapLine, MapArea, MapStats } from "./maps.types";

const DATA_DIR = path.resolve(process.cwd(), "data");

// Cálculo de distancia geodésica (Haversine) en metros entre dos puntos [lng, lat]
export function calculateHaversineDistance(coord1: [number, number], coord2: [number, number]): number {
  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;
  const R = 6371e3; // Radio de la Tierra en metros
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

// Cálculo aproximado del área de un polígono en km²
export function calculatePolygonAreaKm2(coordinates: [number, number][]): number {
  if (coordinates.length < 3) return 0;
  let area = 0;
  const len = coordinates.length;
  for (let i = 0; i < len; i++) {
    const j = (i + 1) % len;
    // Aproximación esférica simplificada
    const xi = (coordinates[i][0] * Math.PI) / 180;
    const yi = (coordinates[i][1] * Math.PI) / 180;
    const xj = (coordinates[j][0] * Math.PI) / 180;
    const yj = (coordinates[j][1] * Math.PI) / 180;
    area += (xj - xi) * (2 + Math.sin(yi) + Math.sin(yj));
  }
  area = Math.abs((area * 6378137 * 6378137) / 4); // en m²
  return Number((area / 1e6).toFixed(3)); // en km²
}

// Datos semilla por defecto por sede / tenant
function getDefaultMapData(tenantId: string): MapTenantData {
  const now = new Date().toISOString();
  const safeTenant = (tenantId || "turbonetwork").toLowerCase();

  if (safeTenant === "loanetwork") {
    // Arequipa
    return {
      tenantId: "loanetwork",
      center: [-71.5375, -16.409],
      zoom: 14,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      nodes: [
        {
          id: "node_loa_01",
          name: "Torre Central Misti",
          type: "tower",
          icon: "tower",
          color: "#7c3aed",
          lat: -16.409,
          lng: -71.5375,
          address: "Calle Mercaderes 210, Arequipa",
          capacity: "4 Radios PTP + Switch 10G",
          status: "active",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "node_loa_02",
          name: "Caja NAP Loa 01",
          type: "nap",
          icon: "box",
          color: "#06b6d4",
          lat: -16.4112,
          lng: -71.535,
          address: "Av. Cayma 550, Arequipa",
          capacity: "16 puertos (10 clientes)",
          status: "active",
          createdAt: now,
          updatedAt: now,
        },
      ],
      lines: [
        {
          id: "line_loa_01",
          name: "Troncal Fibra Misti-Cayma 24FO",
          type: "trunk",
          fromNodeId: "node_loa_01",
          toNodeId: "node_loa_02",
          coordinates: [
            [-71.5375, -16.409],
            [-71.5362, -16.4101],
            [-71.535, -16.4112],
          ],
          color: "#7c3aed",
          width: 3,
          style: "solid",
          distanceMeters: 380,
          cores: 24,
          status: "active",
          createdAt: now,
          updatedAt: now,
        },
      ],
      areas: [
        {
          id: "area_loa_01",
          name: "Cobertura Fibra Cayma & Centro",
          coordinates: [
            [-71.541, -16.406],
            [-71.533, -16.406],
            [-71.532, -16.414],
            [-71.54, -16.414],
          ],
          fillColor: "#7c3aed",
          strokeColor: "#06b6d4",
          fillOpacity: 0.2,
          surfaceAreaKm2: 0.72,
          status: "active",
          targetCustomers: 450,
          createdAt: now,
          updatedAt: now,
        },
      ],
      updatedAt: now,
    };
  }

  if (safeTenant === "celeris") {
    // Trujillo
    return {
      tenantId: "celeris",
      center: [-79.03, -8.1118],
      zoom: 14,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      nodes: [
        {
          id: "node_cel_01",
          name: "NOC Industrial Celeris",
          type: "server",
          icon: "server",
          color: "#ea580c",
          lat: -8.1118,
          lng: -79.03,
          address: "Parque Industrial Mz B Lt 4, Trujillo",
          capacity: "Core MikroTik CCR2004",
          status: "active",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "node_cel_02",
          name: "Torre Enlace Huanchaco",
          type: "antenna",
          icon: "antenna",
          color: "#10b981",
          lat: -8.1085,
          lng: -79.026,
          address: "Sector Carretera Km 4.5",
          capacity: "Enlace Mimosa 1.5 Gbps",
          status: "active",
          createdAt: now,
          updatedAt: now,
        },
      ],
      lines: [
        {
          id: "line_cel_01",
          name: "Radioenlace PTP Gigared Celeris",
          type: "wireless_ptp",
          fromNodeId: "node_cel_01",
          toNodeId: "node_cel_02",
          coordinates: [
            [-79.03, -8.1118],
            [-79.026, -8.1085],
          ],
          color: "#ea580c",
          width: 3,
          style: "dashed",
          distanceMeters: 580,
          status: "active",
          createdAt: now,
          updatedAt: now,
        },
      ],
      areas: [
        {
          id: "area_cel_01",
          name: "Zona Parque Industrial Trujillo",
          coordinates: [
            [-79.035, -8.107],
            [-79.023, -8.107],
            [-79.023, -8.116],
            [-79.035, -8.116],
          ],
          fillColor: "#ea580c",
          strokeColor: "#f97316",
          fillOpacity: 0.22,
          surfaceAreaKm2: 1.15,
          status: "active",
          targetCustomers: 120,
          createdAt: now,
          updatedAt: now,
        },
      ],
      updatedAt: now,
    };
  }

  // TurboNetwork (Lima - Predeterminado)
  return {
    tenantId: "turbonetwork",
    center: [-77.0368, -12.097],
    zoom: 14.5,
    style: "mapbox://styles/mapbox/satellite-streets-v12",
    nodes: [
      {
        id: "node_turbo_01",
        name: "Torre Matriz San Isidro",
        type: "tower",
        icon: "tower",
        color: "#2563eb",
        lat: -12.097,
        lng: -77.0368,
        address: "Av. Rivera Navarrete 450, San Isidro",
        capacity: "Master Hub • 4 OLT Huawei MA5608T",
        status: "active",
        notes: "Nodo principal de distribución de fibra óptica troncal",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "node_turbo_02",
        name: "OLT Core 01 (GPON/XGS-PON)",
        type: "olt",
        icon: "router",
        color: "#7c3aed",
        lat: -12.0985,
        lng: -77.0348,
        address: "Calle Begonias 120",
        capacity: "16 Puertos GPON • 1024 ONUs máx",
        status: "active",
        notes: "Alimentado por UPS redundante 3kVA",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "node_turbo_03",
        name: "Manga de Empalme Troncal F-01",
        type: "switch",
        icon: "box",
        color: "#059669",
        lat: -12.1008,
        lng: -77.0332,
        address: "Cruce Av. Canaval y Moreyra",
        capacity: "48 Fibras fusionadas",
        status: "active",
        notes: "Manga subterránea en cámara de registro",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "node_turbo_04",
        name: "Caja NAP-01 Residencial (1:16)",
        type: "nap",
        icon: "box",
        color: "#ea580c",
        lat: -12.1032,
        lng: -77.0315,
        address: "Calle Los Ruiseñores 320",
        capacity: "16 puertos (11 abonados activos)",
        status: "active",
        notes: "Acometidas drop listas",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "node_turbo_05",
        name: "Caja NAP-02 Financiero (1:8)",
        type: "nap",
        icon: "box",
        color: "#06b6d4",
        lat: -12.0948,
        lng: -77.0388,
        address: "Calle Las Camelias 210",
        capacity: "8 puertos dedicados (6 en uso)",
        status: "active",
        notes: "Clientes corporativos con SLA 99.9%",
        createdAt: now,
        updatedAt: now,
      },
    ],
    lines: [
      {
        id: "line_turbo_01",
        name: "Troncal Óptica 48 FO - Torre Matriz a OLT Core",
        type: "trunk",
        fromNodeId: "node_turbo_01",
        toNodeId: "node_turbo_02",
        coordinates: [
          [-77.0368, -12.097],
          [-77.0358, -12.0977],
          [-77.0348, -12.0985],
        ],
        color: "#2563eb",
        width: 4,
        style: "solid",
        distanceMeters: 290,
        cores: 48,
        status: "active",
        notes: "Cable ADSS aéreo sobre postes con ferretería dieléctrica",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "line_turbo_02",
        name: "Distribución 24 FO - OLT Core a Manga Troncal",
        type: "distribution",
        fromNodeId: "node_turbo_02",
        toNodeId: "node_turbo_03",
        coordinates: [
          [-77.0348, -12.0985],
          [-77.034, -12.0995],
          [-77.0332, -12.1008],
        ],
        color: "#059669",
        width: 3.5,
        style: "solid",
        distanceMeters: 330,
        cores: 24,
        status: "active",
        notes: "Subterráneo ducto PVC 2 pulgadas",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "line_turbo_03",
        name: "Ramal FTTH - Manga a Caja NAP-01",
        type: "drop",
        fromNodeId: "node_turbo_03",
        toNodeId: "node_turbo_04",
        coordinates: [
          [-77.0332, -12.1008],
          [-77.0323, -12.102],
          [-77.0315, -12.1032],
        ],
        color: "#ea580c",
        width: 2.5,
        style: "solid",
        distanceMeters: 340,
        cores: 8,
        status: "active",
        notes: "Distribución secundaria hacia viviendas",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "line_turbo_04",
        name: "Distribución Corporativa - Torre Matriz a NAP-02",
        type: "distribution",
        fromNodeId: "node_turbo_01",
        toNodeId: "node_turbo_05",
        coordinates: [
          [-77.0368, -12.097],
          [-77.0378, -12.096],
          [-77.0388, -12.0948],
        ],
        color: "#06b6d4",
        width: 3,
        style: "solid",
        distanceMeters: 310,
        cores: 12,
        status: "active",
        notes: "Enlace exclusivo edificios corporativos",
        createdAt: now,
        updatedAt: now,
      },
    ],
    areas: [
      {
        id: "area_turbo_01",
        name: "Zona Cobertura FTTH San Isidro Centro",
        coordinates: [
          [-77.042, -12.092],
          [-77.031, -12.092],
          [-77.029, -12.105],
          [-77.04, -12.105],
        ],
        fillColor: "#2563eb",
        strokeColor: "#1d4ed8",
        fillOpacity: 0.2,
        surfaceAreaKm2: 1.58,
        status: "active",
        targetCustomers: 1200,
        notes: "Área activa de comercialización con 8 NAPs proyectadas",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "area_turbo_02",
        name: "Sector Expansión Sur - Limatambo",
        coordinates: [
          [-77.038, -12.104],
          [-77.028, -12.104],
          [-77.028, -12.112],
          [-77.038, -12.112],
        ],
        fillColor: "#059669",
        strokeColor: "#047857",
        fillOpacity: 0.15,
        surfaceAreaKm2: 0.95,
        status: "expansion",
        targetCustomers: 600,
        notes: "Fase de postación y cableado en progreso",
        createdAt: now,
        updatedAt: now,
      },
    ],
    updatedAt: now,
  };
}

// Cargar mapa del tenant
export function loadMapData(tenantId: string): MapTenantData {
  const safeTenant = (tenantId || "turbonetwork").toLowerCase();
  const filePath = getTenantFilePath(safeTenant, "maps.json");

  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.nodes)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn(`[MAPS] Error al leer maps.json para tenant ${safeTenant}:`, err);
  }

  // Si no existe, crear con semilla inicial y persistir directamente
  const defaultData = getDefaultMapData(safeTenant);
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), "utf-8");
  } catch (e) {
    console.error(`[MAPS] Error al sembrar maps.json:`, e);
  }
  return defaultData;
}

// Guardar mapa del tenant
export function saveMapData(data: Partial<MapTenantData>, tenantId: string): MapTenantData {
  const safeTenant = (tenantId || "turbonetwork").toLowerCase();
  const filePath = getTenantFilePath(safeTenant, "maps.json");
  let current: MapTenantData;

  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      current = JSON.parse(raw);
    } else {
      current = getDefaultMapData(safeTenant);
    }
  } catch (e) {
    current = getDefaultMapData(safeTenant);
  }

  const updated: MapTenantData = {
    tenantId: safeTenant,
    center: data.center || current.center || [-77.0368, -12.097],
    zoom: data.zoom || current.zoom || 14,
    style: data.style || current.style || "mapbox://styles/mapbox/satellite-streets-v12",
    nodes: Array.isArray(data.nodes) ? data.nodes : current.nodes,
    lines: Array.isArray(data.lines) ? data.lines : current.lines,
    areas: Array.isArray(data.areas) ? data.areas : current.areas,
    updatedAt: new Date().toISOString(),
  };

  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), "utf-8");
  } catch (err) {
    console.error(`[MAPS] Error al persistir maps.json para tenant ${safeTenant}:`, err);
    throw err;
  }

  return updated;
}

// Métricas y estadísticas del mapa
export function calculateMapStats(data: MapTenantData): MapStats {
  let totalDistanceKm = 0;
  let totalSurfaceKm2 = 0;
  const nodesByType: Record<string, number> = {};
  const linesByType: Record<string, number> = {};

  for (const node of data.nodes || []) {
    nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
  }

  for (const line of data.lines || []) {
    linesByType[line.type] = (linesByType[line.type] || 0) + 1;
    totalDistanceKm += (line.distanceMeters || 0) / 1000;
  }

  for (const area of data.areas || []) {
    totalSurfaceKm2 += area.surfaceAreaKm2 || calculatePolygonAreaKm2(area.coordinates || []);
  }

  return {
    totalNodes: (data.nodes || []).length,
    totalLines: (data.lines || []).length,
    totalAreas: (data.areas || []).length,
    totalDistanceKm: Number(totalDistanceKm.toFixed(2)),
    totalSurfaceKm2: Number(totalSurfaceKm2.toFixed(2)),
    nodesByType,
    linesByType,
  };
}

// Obtener clientes del tenant que tienen coordenadas GPS para superponer en el mapa
export function getTenantCustomersWithCoordinates(tenantId: string): any[] {
  const safeTenant = (tenantId || "turbonetwork").toLowerCase();
  const filePath = getTenantFilePath(safeTenant, "customers.json");
  const fallbackPath = path.join(DATA_DIR, "customers.json");

  try {
    let raw = "";
    if (fs.existsSync(filePath)) {
      raw = fs.readFileSync(filePath, "utf-8");
    } else if (fs.existsSync(fallbackPath)) {
      raw = fs.readFileSync(fallbackPath, "utf-8");
    }

    if (raw) {
      const customers = JSON.parse(raw);
      if (Array.isArray(customers)) {
        return customers
          .filter((c: any) => c.latitude && c.longitude)
          .map((c: any) => ({
            id: c.id,
            name: c.fullName || c.name,
            code: c.customerCode || c.code,
            address: c.address,
            phone: c.phone,
            lat: parseFloat(c.latitude),
            lng: parseFloat(c.longitude),
            status: c.serviceStatus || c.status || "active",
            plan: c.serviceSpeed || c.planName || "Fibra Óptica",
          }))
          .filter((c: any) => !isNaN(c.lat) && !isNaN(c.lng));
      }
    }
  } catch (err) {
    console.warn(`[MAPS] Error al leer clientes para tenant ${safeTenant}:`, err);
  }

  return [];
}
