import fs from "fs";
import path from "path";
import { getTenantFilePath } from "../tenants/tenants.service";
import { MapTenantData, MapNode, MapLine, MapArea, MapStats, MapProject, MapProjectStats } from "./maps.types";

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

  // TurboNetwork (Lima - Predeterminado)
  return createDefaultTenantData(
    "turbonetwork",
    "map_san_isidro",
    "Mapa San Isidro (Troncal & NAPs)",
    "San Isidro, Lima",
    "#2563eb",
    [-77.0368, -12.097],
    14.5,
    "mapbox://styles/mapbox/satellite-streets-v12",
    [
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
    [
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
    [
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
    [getCarabaylloSeedProject(now)]
  );
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
          const migratedProject: MapProject = {
            id: "map_san_isidro",
            name:
              safeTenant === "loanetwork"
                ? "Mapa Sede Arequipa Centro"
                : safeTenant === "celeris"
                ? "Mapa Sede Trujillo Norte"
                : "Mapa San Isidro (Troncal & NAPs)",
            district:
              safeTenant === "loanetwork"
                ? "Arequipa Centro"
                : safeTenant === "celeris"
                ? "Trujillo, La Libertad"
                : "San Isidro, Lima",
            description: "Red principal y distribución FTTH activa",
            color: "#2563eb",
            center: parsed.center || [-77.0368, -12.097],
            zoom: parsed.zoom || 14.5,
            style: parsed.style || "mapbox://styles/mapbox/satellite-streets-v12",
            nodes: parsed.nodes || [],
            lines: parsed.lines || [],
            areas: parsed.areas || [],
            createdAt: parsed.updatedAt || now,
            updatedAt: parsed.updatedAt || now,
          };

          const maps: MapProject[] = [migratedProject];
          if (safeTenant === "turbonetwork") {
            maps.push(getCarabaylloSeedProject(now));
          }

          const migrated: MapTenantData = {
            tenantId: safeTenant,
            activeMapId: migratedProject.id,
            maps,
            center: migratedProject.center,
            zoom: migratedProject.zoom,
            style: migratedProject.style,
            nodes: migratedProject.nodes,
            lines: migratedProject.lines,
            areas: migratedProject.areas,
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
