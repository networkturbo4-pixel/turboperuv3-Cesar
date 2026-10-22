import fs from "fs";
import path from "path";
import zlib from "zlib";
import { getTenantFilePath } from "../tenants/tenants.service";
import { MapTenantData, MapNode, MapLine, MapArea, MapStats, MapProject, MapProjectStats, NodeType, LineType } from "./maps.types";

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

function createDefaultTenantData(
  tenantId: string,
  projectId: string,
  projectName: string,
  district: string,
  color: string,
  center: [number, number],
  zoom: number,
  style: string,
  nodes: MapNode[],
  lines: MapLine[],
  areas: MapArea[],
  extraProjects: MapProject[] = []
): MapTenantData {
  const now = new Date().toISOString();
  const primaryProject: MapProject = {
    id: projectId,
    name: projectName,
    district,
    description: "Infraestructura troncal y distribución FTTH activa",
    color,
    center,
    zoom,
    style,
    nodes,
    lines,
    areas,
    createdAt: now,
    updatedAt: now,
  };

  const maps = [primaryProject, ...extraProjects];

  return {
    tenantId,
    activeMapId: primaryProject.id,
    maps,
    center: primaryProject.center,
    zoom: primaryProject.zoom,
    style: primaryProject.style,
    nodes: primaryProject.nodes,
    lines: primaryProject.lines,
    areas: primaryProject.areas,
    updatedAt: now,
  };
}

// Datos semilla por defecto por sede / tenant
function getDefaultMapData(tenantId: string): MapTenantData {
  const now = new Date().toISOString();
  const safeTenant = (tenantId || "turbonetwork").toLowerCase();

  if (safeTenant === "loanetwork") {
    // Arequipa
    return createDefaultTenantData(
      "loanetwork",
      "map_arequipa_centro",
      "Mapa Sede Arequipa Centro",
      "Arequipa Centro & Cayma",
      "#7c3aed",
      [-71.5375, -16.409],
      14,
      "mapbox://styles/mapbox/satellite-streets-v12",
      [
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
      [
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
      [
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
      ]
    );
  }

  if (safeTenant === "celeris") {
    // Trujillo
    return createDefaultTenantData(
      "celeris",
      "map_trujillo_centro",
      "Mapa Sede Trujillo Norte",
      "Trujillo, La Libertad",
      "#ea580c",
      [-79.03, -8.1118],
      14,
      "mapbox://styles/mapbox/satellite-streets-v12",
      [
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
      [
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
      [
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
      ]
    );
  }

    // TurboNetwork (Lima Norte / Carabayllo - Predeterminado)
  const carabProject = getCarabaylloSeedProject(now);
  return {
    tenantId: "turbonetwork",
    activeMapId: carabProject.id,
    maps: [carabProject],
    center: carabProject.center,
    zoom: carabProject.zoom,
    style: carabProject.style,
    nodes: carabProject.nodes,
    lines: carabProject.lines,
    areas: carabProject.areas,
    updatedAt: now,
  };
}

// Datos semilla para Carabayllo (Lima Norte)
export function getCarabaylloSeedProject(now: string = new Date().toISOString()): MapProject {
  return {
    id: "map_carabayllo",
    name: "Mapa Zona Carabayllo",
    district: "Carabayllo, Lima Norte",
    description: "Zona de cobertura norte, troncal Túpac Amaru y NAPs de expansión",
    color: "#059669",
    center: [-77.0345, -11.8755],
    zoom: 14.5,
    style: "mapbox://styles/mapbox/satellite-streets-v12",
    nodes: [
      {
        id: "node_carab_01",
        name: "Torre Principal Carabayllo San Pedro",
        type: "tower",
        icon: "tower",
        color: "#059669",
        lat: -11.8755,
        lng: -77.0345,
        address: "Av. Túpac Amaru Km 22, Carabayllo",
        capacity: "Torre Ventada 36m • OLT Huawei 8 Puertos",
        status: "active",
        notes: "Estación de cabecera para Lima Norte",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "node_carab_02",
        name: "Caja NAP-01 Carabayllo Centro (1:16)",
        type: "nap",
        icon: "box",
        color: "#2563eb",
        lat: -11.8780,
        lng: -77.0320,
        address: "Jr. Puno 140, Carabayllo",
        capacity: "16 Puertos GPON (11 activos)",
        status: "active",
        notes: "Poste de concreto con cruceta de protección",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "node_carab_03",
        name: "Caja NAP-02 Progreso (1:16)",
        type: "nap",
        icon: "box",
        color: "#ea580c",
        lat: -11.8730,
        lng: -77.0360,
        address: "Av. San Martín 320, El Progreso",
        capacity: "16 Puertos GPON (8 activos)",
        status: "active",
        notes: "Mufa aérea FTTx",
        createdAt: now,
        updatedAt: now,
      },
    ],
    lines: [
      {
        id: "line_carab_01",
        name: "Troncal ADSS Túpac Amaru 24FO",
        type: "trunk",
        fromNodeId: "node_carab_01",
        toNodeId: "node_carab_02",
        coordinates: [
          [-77.0345, -11.8755],
          [-77.0335, -11.8765],
          [-77.0320, -11.8780],
        ],
        color: "#059669",
        width: 4,
        style: "solid",
        distanceMeters: 410,
        cores: 24,
        status: "active",
        notes: "Cable de fibra óptica autosoportado ADSS G.652D",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "line_carab_02",
        name: "Distribución Secundaria El Progreso",
        type: "distribution",
        fromNodeId: "node_carab_01",
        toNodeId: "node_carab_03",
        coordinates: [
          [-77.0345, -11.8755],
          [-77.0352, -11.8742],
          [-77.0360, -11.8730],
        ],
        color: "#ea580c",
        width: 3,
        style: "solid",
        distanceMeters: 360,
        cores: 12,
        status: "active",
        notes: "Tendido secundario hacia El Progreso",
        createdAt: now,
        updatedAt: now,
      },
    ],
    areas: [
      {
        id: "area_carab_01",
        name: "Sector Cobertura Carabayllo Centro & Progreso",
        coordinates: [
          [-77.040, -11.870],
          [-77.028, -11.870],
          [-77.028, -11.882],
          [-77.040, -11.882],
        ],
        fillColor: "#059669",
        strokeColor: "#047857",
        fillOpacity: 0.2,
        surfaceAreaKm2: 1.74,
        status: "active",
        targetCustomers: 850,
        notes: "Zona residencial con alta demanda de fibra óptica",
        createdAt: now,
        updatedAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

// Sincronizar campos principales de compatibilidad con el mapa activo
export function syncActiveMapFields(data: MapTenantData): void {
  if (!Array.isArray(data.maps) || data.maps.length === 0) return;
  const active = data.maps.find((m) => m.id === data.activeMapId) || data.maps[0];
  data.activeMapId = active.id;
  data.center = active.center;
  data.zoom = active.zoom;
  data.style = active.style || data.style || "mapbox://styles/mapbox/satellite-streets-v12";
  data.nodes = active.nodes;
  data.lines = active.lines;
  data.areas = active.areas;
}

// Cargar mapa del tenant con soporte multi-mapa y migración automática
export function loadMapData(tenantId: string): MapTenantData {
  const safeTenant = (tenantId || "turbonetwork").toLowerCase();
  const filePath = getTenantFilePath(safeTenant, "maps.json");

  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed) {
        // Formato moderno con múltiples mapas independientes
        if (Array.isArray(parsed.maps) && parsed.maps.length > 0) {
          // Si es turbonetwork y por alguna razón aún tiene map_san_isidro, filtrarlo
          if (safeTenant === "turbonetwork") {
            const initialLen = parsed.maps.length;
            parsed.maps = parsed.maps.filter((m: any) => m.id !== "map_san_isidro");
            if (parsed.maps.length === 0) {
              parsed.maps.push(getCarabaylloSeedProject());
            }
            if (parsed.maps.length !== initialLen || parsed.activeMapId === "map_san_isidro") {
              parsed.activeMapId = parsed.maps[0].id;
              try {
                fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2), "utf-8");
              } catch (e) {}
            }
          }

          if (!parsed.activeMapId || !parsed.maps.some((m: any) => m.id === parsed.activeMapId)) {
            parsed.activeMapId = parsed.maps[0].id;
          }
          // Si es turbonetwork y aún no tiene el mapa de Carabayllo, agregarlo automáticamente
          if (
            safeTenant === "turbonetwork" &&
            !parsed.maps.some(
              (m: any) => m.id === "map_carabayllo" || (m.name && m.name.toLowerCase().includes("carabayllo"))
            )
          ) {
            parsed.maps.push(getCarabaylloSeedProject());
            try {
              fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2), "utf-8");
            } catch (e) {}
          }
          syncActiveMapFields(parsed);
          return parsed;
        }

        // Migración transparente si viene de formato heredado (con nodes a nivel raíz)
        if (Array.isArray(parsed.nodes)) {
          const now = new Date().toISOString();
          let maps: MapProject[] = [];
          let activeId = "map_carabayllo";

          if (safeTenant === "turbonetwork") {
            maps = [getCarabaylloSeedProject(now)];
            activeId = maps[0].id;
          } else {
            const migratedProject: MapProject = {
              id: safeTenant === "loanetwork" ? "map_arequipa_centro" : "map_principal",
              name:
                safeTenant === "loanetwork"
                  ? "Mapa Sede Arequipa Centro"
                  : safeTenant === "celeris"
                  ? "Mapa Sede Trujillo Norte"
                  : "Mapa Sede Principal",
              district:
                safeTenant === "loanetwork"
                  ? "Arequipa Centro"
                  : safeTenant === "celeris"
                  ? "Trujillo, La Libertad"
                  : "Sede Central",
              description: "Red principal y distribución FTTH activa",
              color: "#2563eb",
              center: parsed.center || [-77.0345, -11.8755],
              zoom: parsed.zoom || 14.5,
              style: parsed.style || "mapbox://styles/mapbox/satellite-streets-v12",
              nodes: parsed.nodes || [],
              lines: parsed.lines || [],
              areas: parsed.areas || [],
              createdAt: parsed.updatedAt || now,
              updatedAt: parsed.updatedAt || now,
            };
            maps = [migratedProject];
            activeId = migratedProject.id;
          }

          const primary = maps[0];
          const migrated: MapTenantData = {
            tenantId: safeTenant,
            activeMapId: activeId,
            maps,
            center: primary.center,
            zoom: primary.zoom,
            style: primary.style,
            nodes: primary.nodes,
            lines: primary.lines,
            areas: primary.areas,
            updatedAt: now,
          };

          try {
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(filePath, JSON.stringify(migrated, null, 2), "utf-8");
          } catch (e) {
            console.error(`[MAPS] Error al guardar migración multi-mapa:`, e);
          }
          return migrated;
        }
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
  let current = loadMapData(safeTenant);

  if (Array.isArray(data.maps)) {
    current.maps = data.maps;
  }
  if (data.activeMapId) {
    current.activeMapId = data.activeMapId;
  }

  const activeMap = current.maps.find((m) => m.id === current.activeMapId) || current.maps[0];

  if (activeMap) {
    if (Array.isArray(data.nodes)) activeMap.nodes = data.nodes;
    if (Array.isArray(data.lines)) activeMap.lines = data.lines;
    if (Array.isArray(data.areas)) activeMap.areas = data.areas;
    if (data.center) activeMap.center = data.center;
    if (typeof data.zoom === "number") activeMap.zoom = data.zoom;
    if (data.style) activeMap.style = data.style;
    activeMap.updatedAt = new Date().toISOString();
  }

  current.updatedAt = new Date().toISOString();
  syncActiveMapFields(current);

  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(current, null, 2), "utf-8");
  } catch (err) {
    console.error(`[MAPS] Error al persistir maps.json para tenant ${safeTenant}:`, err);
    throw err;
  }

  return current;
}

// Helper: Crear nuevo proyecto de mapa
export function createMapProject(
  tenantId: string,
  projectData: Partial<MapProject>
): { data: MapTenantData; newProject: MapProject } {
  const current = loadMapData(tenantId);
  const now = new Date().toISOString();
  const id = projectData.id || `map_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

  const newProject: MapProject = {
    id,
    name: (projectData.name || "Nuevo Mapa de Cobertura").trim(),
    district: (projectData.district || "").trim(),
    description: (projectData.description || "").trim(),
    color: projectData.color || "#2563eb",
    center:
      projectData.center && Array.isArray(projectData.center) && projectData.center.length === 2
        ? projectData.center
        : [-77.0368, -12.097],
    zoom: typeof projectData.zoom === "number" ? projectData.zoom : 14.5,
    style: projectData.style || "mapbox://styles/mapbox/satellite-streets-v12",
    nodes: Array.isArray(projectData.nodes) ? projectData.nodes : [],
    lines: Array.isArray(projectData.lines) ? projectData.lines : [],
    areas: Array.isArray(projectData.areas) ? projectData.areas : [],
    createdAt: now,
    updatedAt: now,
  };

  current.maps.push(newProject);
  current.activeMapId = newProject.id;
  syncActiveMapFields(current);
  saveMapData(current, tenantId);

  return { data: current, newProject };
}

// Helper: Actualizar un proyecto de mapa
export function updateMapProject(
  tenantId: string,
  mapId: string,
  updates: Partial<MapProject>
): { data: MapTenantData; updatedProject: MapProject } {
  const current = loadMapData(tenantId);
  const idx = current.maps.findIndex((m) => m.id === mapId);
  if (idx === -1) {
    throw new Error(`Mapa con ID "${mapId}" no encontrado.`);
  }

  const existing = current.maps[idx];
  current.maps[idx] = {
    ...existing,
    ...updates,
    id: existing.id,
    updatedAt: new Date().toISOString(),
  };

  syncActiveMapFields(current);
  saveMapData(current, tenantId);

  return { data: current, updatedProject: current.maps[idx] };
}

// Helper: Eliminar un proyecto de mapa
export function deleteMapProject(
  tenantId: string,
  mapId: string
): { data: MapTenantData; success: boolean; message: string } {
  const current = loadMapData(tenantId);
  if (current.maps.length <= 1) {
    throw new Error("No se puede eliminar el único mapa existente. Debe haber al menos un mapa activo en el sistema.");
  }

  const initialLen = current.maps.length;
  current.maps = current.maps.filter((m) => m.id !== mapId);

  if (current.maps.length === initialLen) {
    throw new Error(`Mapa con ID "${mapId}" no encontrado.`);
  }

  if (current.activeMapId === mapId) {
    current.activeMapId = current.maps[0].id;
  }

  syncActiveMapFields(current);
  saveMapData(current, tenantId);

  return { data: current, success: true, message: "Mapa eliminado exitosamente." };
}

// Helper: Activar un mapa específico
export function setActiveMapProject(tenantId: string, mapId: string): MapTenantData {
  const current = loadMapData(tenantId);
  const found = current.maps.find((m) => m.id === mapId);
  if (!found) {
    throw new Error(`Mapa con ID "${mapId}" no encontrado.`);
  }
  current.activeMapId = mapId;
  syncActiveMapFields(current);
  saveMapData(current, tenantId);
  return current;
}

// Métricas y estadísticas completas (generales y por mapa/proyecto)
export function calculateMapStats(data: MapTenantData): MapStats {
  const projectsStats: MapProjectStats[] = (data.maps || []).map((p) => {
    let distKm = 0;
    let surfKm2 = 0;
    const nTypes: Record<string, number> = {};
    const lTypes: Record<string, number> = {};
    for (const n of p.nodes || []) {
      nTypes[n.type] = (nTypes[n.type] || 0) + 1;
    }
    for (const l of p.lines || []) {
      lTypes[l.type] = (lTypes[l.type] || 0) + 1;
      distKm += (l.distanceMeters || 0) / 1000;
    }
    for (const a of p.areas || []) {
      surfKm2 += a.surfaceAreaKm2 || calculatePolygonAreaKm2(a.coordinates || []);
    }
    return {
      id: p.id,
      name: p.name,
      district: p.district || "",
      color: p.color || "#2563eb",
      totalNodes: (p.nodes || []).length,
      totalLines: (p.lines || []).length,
      totalAreas: (p.areas || []).length,
      totalDistanceKm: Number(distKm.toFixed(2)),
      totalSurfaceKm2: Number(surfKm2.toFixed(2)),
      nodesByType: nTypes,
      linesByType: lTypes,
    };
  });

  const activeMap = data.maps?.find((m) => m.id === data.activeMapId) || data.maps?.[0];
  const targetNodes = activeMap ? activeMap.nodes : data.nodes || [];
  const targetLines = activeMap ? activeMap.lines : data.lines || [];
  const targetAreas = activeMap ? activeMap.areas : data.areas || [];

  let totalDistanceKm = 0;
  let totalSurfaceKm2 = 0;
  const nodesByType: Record<string, number> = {};
  const linesByType: Record<string, number> = {};

  for (const node of targetNodes || []) {
    nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
  }

  for (const line of targetLines || []) {
    linesByType[line.type] = (linesByType[line.type] || 0) + 1;
    totalDistanceKm += (line.distanceMeters || 0) / 1000;
  }

  for (const area of targetAreas || []) {
    totalSurfaceKm2 += area.surfaceAreaKm2 || calculatePolygonAreaKm2(area.coordinates || []);
  }

  return {
    totalNodes: (targetNodes || []).length,
    totalLines: (targetLines || []).length,
    totalAreas: (targetAreas || []).length,
    totalDistanceKm: Number(totalDistanceKm.toFixed(2)),
    totalSurfaceKm2: Number(totalSurfaceKm2.toFixed(2)),
    nodesByType,
    linesByType,
    projects: projectsStats,
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


// =========================================================================
// MÓDULO DE IMPORTACIÓN Y PARSEO DE ARCHIVOS KML (Google Earth & QGIS)
// =========================================================================

export interface KmlStyleInfo {
  lineColor?: string;
  lineWidth?: number;
  polyColor?: string;
  polyOpacity?: number;
  iconColor?: string;
}

export interface KmlParseResult {
  docName: string;
  nodes: MapNode[];
  lines: MapLine[];
  areas: MapArea[];
  center: [number, number];
  zoom: number;
  bounds?: [[number, number], [number, number]];
  counts: {
    nodes: number;
    lines: number;
    areas: number;
    total: number;
  };
}

export interface KmlImportOptions {
  kmlContent: string;
  targetMapId?: string;
  createNewMap?: boolean;
  newMapName?: string;
  mode?: "append" | "replace";
  district?: string;
  color?: string;
}

function cleanKmlText(text?: string): string {
  if (!text) return "";
  return text
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function parseKmlColor(colorStr?: string): { hex: string; opacity?: number } {
  if (!colorStr) return { hex: "#2563eb", opacity: 0.8 };
  const clean = colorStr.trim().replace(/^#/, "");
  if (clean.length === 8) {
    const a = parseInt(clean.substring(0, 2), 16) / 255;
    const b = clean.substring(2, 4);
    const g = clean.substring(4, 6);
    const r = clean.substring(6, 8);
    return {
      hex: `#${r}${g}${b}`.toLowerCase(),
      opacity: Number(Math.max(0.05, Math.min(1, a)).toFixed(2)),
    };
  } else if (clean.length === 6) {
    return { hex: `#${clean}`.toLowerCase(), opacity: 1 };
  }
  return { hex: "#2563eb", opacity: 0.8 };
}

function inferNodeType(name: string, description: string): { type: NodeType; icon: string; defaultColor: string } {
  const text = `${name} ${description}`.toLowerCase();
  if (/mufa|nap|caja|splitter|cto|fdb|fat|empalme|roseta/.test(text)) {
    return { type: "nap", icon: "box", defaultColor: "#2563eb" };
  }
  if (/torre|tower|mastil|torreta|sitio/.test(text)) {
    return { type: "tower", icon: "tower", defaultColor: "#059669" };
  }
  if (/olt|gpon|epon|dslam|central/.test(text)) {
    return { type: "olt", icon: "server", defaultColor: "#7c3aed" };
  }
  if (/switch|sw|distribucion|hub/.test(text)) {
    return { type: "switch", icon: "server", defaultColor: "#0891b2" };
  }
  if (/antena|antenna|ap|sector|cpe|radio|wireless|enlace|dish|litebeam|powerbeam|mimosa/.test(text)) {
    return { type: "antenna", icon: "antenna", defaultColor: "#ea580c" };
  }
  if (/cliente|abonado|subscriber|user|casa|abonad|ont|onu/.test(text)) {
    return { type: "customer", icon: "customer", defaultColor: "#10b981" };
  }
  if (/poste|post|pole|cruceta|camara/.test(text)) {
    return { type: "pole", icon: "pole", defaultColor: "#eab308" };
  }
  if (/servidor|server|datacenter|rack|core|noc/.test(text)) {
    return { type: "server", icon: "server", defaultColor: "#dc2626" };
  }
  return { type: "custom", icon: "custom", defaultColor: "#3b82f6" };
}

function inferLineType(name: string, description: string): { type: LineType; defaultColor: string; defaultWidth: number } {
  const text = `${name} ${description}`.toLowerCase();
  if (/troncal|feeder|backbone|core|principal|24fo|48fo|96fo|144fo/.test(text)) {
    return { type: "trunk", defaultColor: "#059669", defaultWidth: 4 };
  }
  if (/drop|bajada|acometida|1fo|2fo|cliente/.test(text)) {
    return { type: "drop", defaultColor: "#3b82f6", defaultWidth: 2 };
  }
  if (/ptp|radio|wireless|enlace|microondas|airmax/.test(text)) {
    return { type: "wireless_ptp", defaultColor: "#ea580c", defaultWidth: 3 };
  }
  if (/cobre|utp|copper|coaxial/.test(text)) {
    return { type: "copper", defaultColor: "#eab308", defaultWidth: 2 };
  }
  return { type: "distribution", defaultColor: "#10b981", defaultWidth: 3 };
}


// Extraer KML desde un búfer ZIP (formato KMZ estándar)
export function extractKmlFromZipBuffer(buf: Buffer): string | null {
  try {
    let offset = 0;
    while (offset + 30 < buf.length) {
      // Firma de cabecera local de archivo ZIP: 0x04034b50 ('PK\x03\x04')
      if (buf[offset] !== 0x50 || buf[offset + 1] !== 0x4b || buf[offset + 2] !== 0x03 || buf[offset + 3] !== 0x04) {
        break;
      }
      const compMethod = buf.readUInt16LE(offset + 8);
      const compSize = buf.readUInt32LE(offset + 18);
      const nameLen = buf.readUInt16LE(offset + 26);
      const extraLen = buf.readUInt16LE(offset + 28);
      const fileName = buf.toString("utf8", offset + 30, offset + 30 + nameLen);
      const dataStart = offset + 30 + nameLen + extraLen;
      const dataEnd = dataStart + compSize;
      const compressedData = buf.subarray(dataStart, dataEnd);

      if (fileName.toLowerCase().endsWith(".kml")) {
        if (compMethod === 0) {
          return compressedData.toString("utf8");
        } else if (compMethod === 8) {
          return zlib.inflateRawSync(compressedData).toString("utf8");
        }
      }
      offset = dataEnd;
    }
  } catch (err) {
    console.warn("[MAPS] Error al descomprimir archivo KMZ:", err);
  }
  return null;
}

function parseCoordinatesString(coordString: string): [number, number][] {
  if (!coordString || typeof coordString !== "string") return [];

  // 1. Quitar envolturas CDATA y caracteres de salto
  let cleaned = coordString.replace(/<!\[CDATA\[/gi, "").replace(/\]\]>/gi, "");
  cleaned = cleaned.replace(/\r\n|\r|\n|\t/g, " ").trim();

  // 2. Normalizar comas: eliminar espacios en blanco antes y después de cada coma
  cleaned = cleaned.replace(/\s*,\s*/g, ",");

  const result: [number, number][] = [];
  const tokens = cleaned.split(/\s+/).filter(Boolean);

  for (const token of tokens) {
    const parts = token.split(",").filter((p) => p.trim().length > 0);
    if (parts.length >= 2) {
      if (parts.length > 3) {
        // En caso de secuencias de coordenadas continuas sin espacios intermedios
        const step = parts.length % 3 === 0 ? 3 : 2;
        for (let i = 0; i + 1 < parts.length; i += step) {
          const lng = parseFloat(parts[i]);
          const lat = parseFloat(parts[i + 1]);
          if (!isNaN(lng) && !isNaN(lat) && isFinite(lng) && isFinite(lat)) {
            if (lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90) {
              result.push([Number(lng.toFixed(6)), Number(lat.toFixed(6))]);
            }
          }
        }
      } else {
        const lng = parseFloat(parts[0]);
        const lat = parseFloat(parts[1]);
        if (!isNaN(lng) && !isNaN(lat) && isFinite(lng) && isFinite(lat)) {
          if (lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90) {
            result.push([Number(lng.toFixed(6)), Number(lat.toFixed(6))]);
          }
        }
      }
    }
  }

  return result;
}

export function parseKmlContent(kmlContent: string): KmlParseResult {
  if (!kmlContent || typeof kmlContent !== "string") {
    throw new Error("El contenido del archivo KML está vacío o no es válido.");
  }

  // Quitar prefijos de namespace XML (ej: <kml:Placemark> -> <Placemark>)
  const cleanXml = kmlContent.replace(/<(\/)?([a-zA-Z0-9_-]+:)/g, "<$1");

  // 1. Extraer nombre general del Documento o Proyecto
  let docName = "Mapa Importado KML";
  const docNameMatch = cleanXml.match(/<Document[\s\S]*?<name>([\s\S]*?)<\/name>/i) || cleanXml.match(/<name>([\s\S]*?)<\/name>/i);
  if (docNameMatch && docNameMatch[1]) {
    const extracted = cleanKmlText(docNameMatch[1]);
    if (extracted && extracted.length > 1) docName = extracted;
  }

  // 2. Extraer mapa de Estilos (<Style id="...">)
  const stylesMap = new Map<string, KmlStyleInfo>();
  const styleBlocks = cleanXml.match(/<Style\s+id="([^"]+)"[\s\S]*?<\/Style>/gi) || [];
  for (const block of styleBlocks) {
    const idMatch = block.match(/<Style\s+id="([^"]+)"/i);
    if (!idMatch) continue;
    const styleId = idMatch[1];
    const info: KmlStyleInfo = {};

    const lineColMatch = block.match(/<LineStyle[\s\S]*?<color>([a-fA-F0-9]+)<\/color>/i);
    const lineWidMatch = block.match(/<LineStyle[\s\S]*?<width>([0-9.]+)<\/width>/i);
    if (lineColMatch) {
      const c = parseKmlColor(lineColMatch[1]);
      info.lineColor = c.hex;
    }
    if (lineWidMatch) {
      const w = parseFloat(lineWidMatch[1]);
      if (!isNaN(w) && w > 0) info.lineWidth = Math.min(8, Math.max(1, Math.round(w)));
    }

    const polyColMatch = block.match(/<PolyStyle[\s\S]*?<color>([a-fA-F0-9]+)<\/color>/i);
    if (polyColMatch) {
      const c = parseKmlColor(polyColMatch[1]);
      info.polyColor = c.hex;
      info.polyOpacity = c.opacity;
    }

    const iconColMatch = block.match(/<IconStyle[\s\S]*?<color>([a-fA-F0-9]+)<\/color>/i);
    if (iconColMatch) {
      const c = parseKmlColor(iconColMatch[1]);
      info.iconColor = c.hex;
    }

    stylesMap.set(styleId, info);
  }

  // También mapear <StyleMap> a su estilo normal si existe
  const styleMaps = cleanXml.match(/<StyleMap\s+id="([^"]+)"[\s\S]*?<\/StyleMap>/gi) || [];
  for (const sm of styleMaps) {
    const idMatch = sm.match(/<StyleMap\s+id="([^"]+)"/i);
    const targetMatch = sm.match(/<Pair>[\s\S]*?<key>normal<\/key>[\s\S]*?<styleUrl>#?([^<]+)<\/styleUrl>[\s\S]*?<\/Pair>/i) ||
      sm.match(/<styleUrl>#?([^<]+)<\/styleUrl>/i);
    if (idMatch && targetMatch) {
      const targetStyle = stylesMap.get(targetMatch[1].trim());
      if (targetStyle) {
        stylesMap.set(idMatch[1], targetStyle);
      }
    }
  }

  const nodes: MapNode[] = [];
  const lines: MapLine[] = [];
  const areas: MapArea[] = [];

  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  function updateBounds(coords: [number, number][]) {
    for (const [lng, lat] of coords) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }

  // 3. Extraer todos los Placemarks
  const placemarks = cleanXml.match(/<Placemark\b[\s\S]*?<\/Placemark>/gi) || [];
  const now = new Date().toISOString();
  let counter = 1;

  for (const pm of placemarks) {
    // Nombre
    const nMatch = pm.match(/<name>([\s\S]*?)<\/name>/i);
    const name = nMatch ? cleanKmlText(nMatch[1]) : `Elemento KML ${counter}`;

    // Descripción
    const dMatch = pm.match(/<description>([\s\S]*?)<\/description>/i);
    let description = dMatch ? cleanKmlText(dMatch[1]) : "";

    // ExtendedData
    const extDataMatches = pm.matchAll(/<(?:Data|SimpleData)\s+name="([^"]+)">[\s\S]*?(?:<value>)?([\s\S]*?)(?:<\/value>)?<\/(?:Data|SimpleData)>/gi);
    const extPairs: string[] = [];
    for (const m of extDataMatches) {
      const key = cleanKmlText(m[1]);
      const val = cleanKmlText(m[2]);
      if (key && val) extPairs.push(`${key}: ${val}`);
    }
    if (extPairs.length > 0) {
      description = description ? `${description} | ${extPairs.join(" • ")}` : extPairs.join(" • ");
    }

    // Estilo referenciado
    const sMatch = pm.match(/<styleUrl>#?([^<]+)<\/styleUrl>/i);
    const styleId = sMatch ? sMatch[1].trim() : "";
    const styleInfo = stylesMap.get(styleId) || {};

    // A. Detectar Puntos (<Point>)
    const pointMatches = pm.match(/<Point\b[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>[\s\S]*?<\/Point>/gi) || [];
    for (const pBlock of pointMatches) {
      const coordMatch = pBlock.match(/<coordinates>([\s\S]*?)<\/coordinates>/i);
      if (coordMatch) {
        const coords = parseCoordinatesString(coordMatch[1]);
        if (coords.length > 0) {
          const [lng, lat] = coords[0];
          updateBounds([[lng, lat]]);
          const inferred = inferNodeType(name, description);
          const color = styleInfo.iconColor || inferred.defaultColor;

          nodes.push({
            id: `kml_node_${Date.now()}_${counter++}_${Math.random().toString(36).substr(2, 4)}`,
            name,
            type: inferred.type,
            icon: inferred.icon,
            color,
            lat,
            lng,
            notes: description,
            address: "",
            capacity: "",
            status: "active",
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    }

    // B. Detectar Líneas (<LineString>)
    const lineMatches = pm.match(/<LineString\b[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>[\s\S]*?<\/LineString>/gi) || [];
    for (const lBlock of lineMatches) {
      const coordMatch = lBlock.match(/<coordinates>([\s\S]*?)<\/coordinates>/i);
      if (coordMatch) {
        const coords = parseCoordinatesString(coordMatch[1]);
        if (coords.length >= 2) {
          updateBounds(coords);
          const inferred = inferLineType(name, description);
          let totalDist = 0;
          for (let i = 0; i < coords.length - 1; i++) {
            totalDist += calculateHaversineDistance(coords[i], coords[i + 1]);
          }

          lines.push({
            id: `kml_line_${Date.now()}_${counter++}_${Math.random().toString(36).substr(2, 4)}`,
            name,
            type: inferred.type,
            coordinates: coords,
            color: styleInfo.lineColor || inferred.defaultColor,
            width: styleInfo.lineWidth || inferred.defaultWidth,
            style: "solid",
            distanceMeters: Math.round(totalDist),
            status: "active",
            notes: description,
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    }

    // C. Detectar Polígonos (<Polygon>)
    const polyMatches = pm.match(/<Polygon\b[\s\S]*?<\/Polygon>/gi) || [];
    for (const pyBlock of polyMatches) {
      const coordMatch = pyBlock.match(/<coordinates>([\s\S]*?)<\/coordinates>/i);
      if (coordMatch) {
        const coords = parseCoordinatesString(coordMatch[1]);
        if (coords.length >= 3) {
          updateBounds(coords);
          const surface = calculatePolygonAreaKm2(coords);
          const fillColor = styleInfo.polyColor || "#3b82f6";
          const strokeColor = styleInfo.lineColor || "#1d4ed8";
          const fillOpacity = typeof styleInfo.polyOpacity === "number" ? styleInfo.polyOpacity : 0.22;

          areas.push({
            id: `kml_area_${Date.now()}_${counter++}_${Math.random().toString(36).substr(2, 4)}`,
            name,
            coordinates: coords,
            fillColor,
            strokeColor,
            fillOpacity,
            surfaceAreaKm2: surface,
            status: "active",
            notes: description,
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    }
  }

  // Calcular centro y zoom
  let center: [number, number] = [-77.0345, -11.8755];
  let zoom = 14.5;
  let bounds: [[number, number], [number, number]] | undefined;

  if (minLng !== Infinity && maxLng !== -Infinity && minLat !== Infinity && maxLat !== -Infinity) {
    center = [
      Number(((minLng + maxLng) / 2).toFixed(6)),
      Number(((minLat + maxLat) / 2).toFixed(6)),
    ];
    bounds = [
      [minLng, minLat],
      [maxLng, maxLat],
    ];

    const maxSpan = Math.max(maxLng - minLng, maxLat - minLat);
    if (maxSpan > 2.0) zoom = 9;
    else if (maxSpan > 0.8) zoom = 11;
    else if (maxSpan > 0.3) zoom = 12;
    else if (maxSpan > 0.08) zoom = 13.5;
    else if (maxSpan > 0.02) zoom = 15;
    else zoom = 16.5;
  }

  return {
    docName,
    nodes,
    lines,
    areas,
    center,
    zoom,
    bounds,
    counts: {
      nodes: nodes.length,
      lines: lines.length,
      areas: areas.length,
      total: nodes.length + lines.length + areas.length,
    },
  };
}

// Resolver contenido de KML, soportando KMZ comprimido y vínculos NetworkLink de Google My Maps
export async function resolveKmlContent(rawInput: string): Promise<{
  content: string;
  source: "direct" | "networklink" | "kmz";
  networkLinkDetected?: boolean;
  networkLinkUrl?: string;
  networkLinkError?: string;
}> {
  if (!rawInput || typeof rawInput !== "string") {
    throw new Error("El contenido del archivo KML está vacío o no es válido.");
  }

  let text = rawInput.trim();

  // 1. Manejar KMZ / ZIP (sea DataURL base64 o buffer binario codificado)
  if (text.startsWith("data:") || text.startsWith("UEsDB") || text.startsWith("PK")) {
    try {
      let buf: Buffer;
      if (text.startsWith("data:")) {
        const base64Part = text.split(",")[1] || "";
        buf = Buffer.from(base64Part, "base64");
      } else if (text.startsWith("UEsDB")) {
        buf = Buffer.from(text, "base64");
      } else {
        buf = Buffer.from(text, "binary");
      }

      if (buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b) {
        const extracted = extractKmlFromZipBuffer(buf);
        if (extracted) {
          return { content: extracted, source: "kmz" };
        }
      }
    } catch (e) {
      console.warn("[MAPS] Intento de descompresión KMZ falló:", e);
    }
  }

  // 2. Comprobar si el archivo es un NetworkLink de Google Earth / Google My Maps
  const netLinkMatch = text.match(/<NetworkLink\b[\s\S]*?<\/NetworkLink>/i);
  if (netLinkMatch) {
    const hrefMatch = netLinkMatch[0].match(/<href>([\s\S]*?)<\/href>/i) || text.match(/<href>([\s\S]*?)<\/href>/i);
    if (hrefMatch && hrefMatch[1]) {
      const rawUrl = hrefMatch[1].replace(/<!\[CDATA\[/gi, "").replace(/\]\]>/gi, "").trim();
      if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
        let fetchUrl = rawUrl;
        if (fetchUrl.includes("google.com/maps/d/") && !fetchUrl.includes("forcekml=1")) {
          fetchUrl += (fetchUrl.includes("?") ? "&" : "?") + "forcekml=1";
        }

        try {
          const resp = await fetch(fetchUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Accept": "application/vnd.google-earth.kml+xml, application/vnd.google-earth.kmz, text/xml, */*"
            }
          });

          if (resp.ok) {
            const arr = await resp.arrayBuffer();
            const buf = Buffer.from(arr);
            if (buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b) {
              const unzipped = extractKmlFromZipBuffer(buf);
              if (unzipped) {
                return { content: unzipped, source: "networklink", networkLinkDetected: true, networkLinkUrl: rawUrl };
              }
            }
            const fetchedText = buf.toString("utf8");
            if (fetchedText.includes("<kml") || fetchedText.includes("<Document") || fetchedText.includes("<Placemark")) {
              return { content: fetchedText, source: "networklink", networkLinkDetected: true, networkLinkUrl: rawUrl };
            }
          } else {
            return {
              content: text,
              source: "direct",
              networkLinkDetected: true,
              networkLinkUrl: rawUrl,
              networkLinkError: `El servidor remoto respondió con código HTTP ${resp.status}. Es posible que el mapa sea privado o requiera inicio de sesión.`
            };
          }
        } catch (fetchErr: any) {
          return {
            content: text,
            source: "direct",
            networkLinkDetected: true,
            networkLinkUrl: rawUrl,
            networkLinkError: fetchErr?.message || "No se pudo conectar con el servidor remoto."
          };
        }
      }
    }
  }

  return { content: text, source: "direct" };
}

// Previsualizar datos de un archivo KML sin guardar
export async function previewKmlData(kmlContent: string): Promise<{
  success: boolean;
  docName: string;
  counts: { nodes: number; lines: number; areas: number; total: number };
  center: [number, number];
  zoom: number;
  bounds?: [[number, number], [number, number]];
  sampleNodes: Array<{ name: string; type: string; color: string; lat: number; lng: number }>;
  sampleLines: Array<{ name: string; type: string; color: string; distanceMeters: number }>;
  sampleAreas: Array<{ name: string; surfaceAreaKm2?: number; fillColor: string }>;
  networkLinkDetected?: boolean;
  networkLinkUrl?: string;
  networkLinkError?: string;
  networkLinkAdvice?: string;
  resolvedFromNetworkLink?: boolean;
}> {
  const resolved = await resolveKmlContent(kmlContent);
  const parsed = parseKmlContent(resolved.content);

  let networkLinkAdvice: string | undefined;
  if (resolved.networkLinkDetected && parsed.counts.total === 0) {
    networkLinkAdvice = "El archivo exportado es un 'Vínculo de Red' (NetworkLink). Para exportar los datos reales: En Google My Maps, ve al menú ⋮ > 'Exportar a KML/KMZ' y DESMARCA la casilla 'Mantener los datos actualizados mediante un vínculo de red'.";
  }

  return {
    success: true,
    docName: parsed.docName,
    counts: parsed.counts,
    center: parsed.center,
    zoom: parsed.zoom,
    bounds: parsed.bounds,
    sampleNodes: parsed.nodes.slice(0, 5).map((n) => ({ name: n.name, type: n.type, color: n.color, lat: n.lat, lng: n.lng })),
    sampleLines: parsed.lines.slice(0, 5).map((l) => ({ name: l.name, type: l.type, color: l.color, distanceMeters: l.distanceMeters })),
    sampleAreas: parsed.areas.slice(0, 5).map((a) => ({ name: a.name, surfaceAreaKm2: a.surfaceAreaKm2, fillColor: a.fillColor })),
    networkLinkDetected: resolved.networkLinkDetected,
    networkLinkUrl: resolved.networkLinkUrl,
    networkLinkError: resolved.networkLinkError,
    networkLinkAdvice,
    resolvedFromNetworkLink: resolved.source === "networklink" && parsed.counts.total > 0,
  };
}

// Importar datos de un archivo KML hacia el mapa del tenant
export async function importKmlData(
  tenantId: string,
  options: KmlImportOptions
): Promise<{
  success: boolean;
  message: string;
  project: MapProject;
  activeMapId: string;
  importedCounts: { nodes: number; lines: number; areas: number; total: number };
  bounds?: [[number, number], [number, number]];
  data: MapTenantData;
  stats: MapStats;
}> {
  const current = loadMapData(tenantId);
  const resolved = await resolveKmlContent(options.kmlContent);
  const parsed = parseKmlContent(resolved.content);

  if (parsed.counts.total === 0) {
    if (resolved.networkLinkDetected) {
      throw new Error(
        `El archivo KML es un acceso directo / vínculo de red (NetworkLink) de Google My Maps hacia "${resolved.networkLinkUrl || ''}". No se pudo acceder a los datos porque el mapa es privado o requiere autenticación. Solución: En Google My Maps (ordenador), haz clic en el menú ⋮ junto al nombre del mapa > 'Exportar a KML/KMZ' y asegúrate de DESMARCAR la casilla 'Mantener los datos actualizados mediante un vínculo de red KML'. Luego vuelve a subir el archivo descargado.`
      );
    }
    throw new Error("No se encontraron puntos, líneas ni polígonos válidos en el archivo KML. Verifica que el archivo no esté vacío ni protegido.");
  }

  const now = new Date().toISOString();
  let targetProject: MapProject;

  if (options.createNewMap || current.maps.length === 0) {
    const id = `map_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    targetProject = {
      id,
      name: (options.newMapName || parsed.docName || "Mapa Importado KML").trim(),
      district: (options.district || "").trim(),
      description: `Importado desde archivo KML (${parsed.counts.nodes} nodos, ${parsed.counts.lines} líneas, ${parsed.counts.areas} áreas).`,
      color: options.color || "#059669",
      center: parsed.center,
      zoom: parsed.zoom,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      nodes: parsed.nodes,
      lines: parsed.lines,
      areas: parsed.areas,
      createdAt: now,
      updatedAt: now,
    };
    current.maps.push(targetProject);
    current.activeMapId = targetProject.id;
  } else {
    const findId = options.targetMapId || current.activeMapId;
    targetProject = current.maps.find((m) => m.id === findId) || current.maps[0];
    current.activeMapId = targetProject.id;

    if (options.mode === "replace") {
      targetProject.nodes = parsed.nodes;
      targetProject.lines = parsed.lines;
      targetProject.areas = parsed.areas;
      targetProject.center = parsed.center;
      targetProject.zoom = parsed.zoom;
    } else {
      // mode === 'append' (predeterminado)
      targetProject.nodes.push(...parsed.nodes);
      targetProject.lines.push(...parsed.lines);
      targetProject.areas.push(...parsed.areas);
      // Si el mapa estaba vacío de coordenadas, re-centrar
      if (targetProject.nodes.length === parsed.nodes.length && targetProject.lines.length === parsed.lines.length) {
        targetProject.center = parsed.center;
        targetProject.zoom = parsed.zoom;
      }
    }
  }

  targetProject.updatedAt = now;
  syncActiveMapFields(current);
  saveMapData(current, tenantId);

  const stats = calculateMapStats(current);
  return {
    success: true,
    message: `KML importado con éxito: ${parsed.counts.nodes} puntos, ${parsed.counts.lines} líneas y ${parsed.counts.areas} áreas agregadas a "${targetProject.name}".`,
    project: targetProject,
    activeMapId: current.activeMapId,
    importedCounts: parsed.counts,
    bounds: parsed.bounds,
    data: current,
    stats,
  };
}
