import { FastifyPluginAsync } from "fastify";
import { resolveTenantId } from "../tenants/tenants.service";
import {
  loadMapData,
  saveMapData,
  calculateMapStats,
  calculateHaversineDistance,
  calculatePolygonAreaKm2,
  getTenantCustomersWithCoordinates,
} from "./maps.service";
import { MapNode, MapLine, MapArea } from "./maps.types";

export const mapsRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. Obtener datos completos del mapa para el tenant activo
  fastify.get("/maps/data", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const data = loadMapData(tenantId);
    const stats = calculateMapStats(data);
    const customers = getTenantCustomersWithCoordinates(tenantId);

    return reply.send({
      success: true,
      tenantId,
      data,
      stats,
      customers,
    });
  });

  // 2. Guardar estado completo del mapa (sincronización total)
  fastify.post("/maps/data", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const body = request.body as any;

    const saved = saveMapData(body, tenantId);
    const stats = calculateMapStats(saved);

    return reply.send({
      success: true,
      message: "Mapa y trazados guardados exitosamente.",
      tenantId,
      data: saved,
      stats,
    });
  });

  // 3. Crear / Añadir un nuevo nodo o punto
  fastify.post("/maps/nodes", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const body = request.body as any;

    if (!body.name || typeof body.lat !== "number" || typeof body.lng !== "number") {
      return reply.status(400).send({
        success: false,
        message: "El nombre y las coordenadas (lat, lng) son requeridos para el nodo.",
      });
    }

    const current = loadMapData(tenantId);
    const now = new Date().toISOString();
    const newNode: MapNode = {
      id: body.id || `node_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: body.name.trim(),
      type: body.type || "nap",
      icon: body.icon || "box",
      color: body.color || "#2563eb",
      lat: body.lat,
      lng: body.lng,
      address: body.address || "",
      capacity: body.capacity || "",
      status: body.status || "active",
      notes: body.notes || "",
      createdAt: now,
      updatedAt: now,
    };

    current.nodes.push(newNode);
    saveMapData(current, tenantId);

    return reply.send({
      success: true,
      message: `Punto "${newNode.name}" creado exitosamente.`,
      node: newNode,
      stats: calculateMapStats(current),
    });
  });

  // 4. Actualizar un nodo existente
  fastify.put("/maps/nodes/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const body = request.body as any;

    const current = loadMapData(tenantId);
    const idx = current.nodes.findIndex((n) => n.id === id);

    if (idx === -1) {
      return reply.status(404).send({
        success: false,
        message: `Nodo con ID "${id}" no encontrado.`,
      });
    }

    const existing = current.nodes[idx];
    current.nodes[idx] = {
      ...existing,
      ...body,
      id: existing.id, // Inmutable
      updatedAt: new Date().toISOString(),
    };

    saveMapData(current, tenantId);

    return reply.send({
      success: true,
      message: `Nodo "${current.nodes[idx].name}" actualizado.`,
      node: current.nodes[idx],
      stats: calculateMapStats(current),
    });
  });

  // 5. Eliminar un nodo
  fastify.delete("/maps/nodes/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };

    const current = loadMapData(tenantId);
    const initialLen = current.nodes.length;
    current.nodes = current.nodes.filter((n) => n.id !== id);

    if (current.nodes.length === initialLen) {
      return reply.status(404).send({
        success: false,
        message: `Nodo con ID "${id}" no encontrado.`,
      });
    }

    // Limpiar enlaces que dependían de este nodo si es necesario
    for (const line of current.lines) {
      if (line.fromNodeId === id) line.fromNodeId = undefined;
      if (line.toNodeId === id) line.toNodeId = undefined;
    }

    saveMapData(current, tenantId);

    return reply.send({
      success: true,
      message: "Nodo eliminado correctamente.",
      stats: calculateMapStats(current),
    });
  });

  // 6. Crear un nuevo conector o línea de fibra / wireless
  fastify.post("/maps/lines", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const body = request.body as any;

    if (!body.name || !Array.isArray(body.coordinates) || body.coordinates.length < 2) {
      return reply.status(400).send({
        success: false,
        message: "Se requiere un nombre y al menos 2 puntos de coordenadas para trazar una línea.",
      });
    }

    // Calcular distancia total en metros
    let totalDist = 0;
    for (let i = 0; i < body.coordinates.length - 1; i++) {
      totalDist += calculateHaversineDistance(body.coordinates[i], body.coordinates[i + 1]);
    }

    const current = loadMapData(tenantId);
    const now = new Date().toISOString();
    const newLine: MapLine = {
      id: body.id || `line_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: body.name.trim(),
      type: body.type || "distribution",
      fromNodeId: body.fromNodeId,
      toNodeId: body.toNodeId,
      coordinates: body.coordinates,
      color: body.color || "#059669",
      width: body.width || 3,
      style: body.style || "solid",
      distanceMeters: Math.round(totalDist),
      cores: body.cores,
      status: body.status || "active",
      notes: body.notes || "",
      createdAt: now,
      updatedAt: now,
    };

    current.lines.push(newLine);
    saveMapData(current, tenantId);

    return reply.send({
      success: true,
      message: `Trazado "${newLine.name}" guardado (${(newLine.distanceMeters / 1000).toFixed(2)} km).`,
      line: newLine,
      stats: calculateMapStats(current),
    });
  });

  // 7. Actualizar una línea existente
  fastify.put("/maps/lines/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const body = request.body as any;

    const current = loadMapData(tenantId);
    const idx = current.lines.findIndex((l) => l.id === id);

    if (idx === -1) {
      return reply.status(404).send({
        success: false,
        message: `Línea con ID "${id}" no encontrada.`,
      });
    }

    const existing = current.lines[idx];
    const coords = Array.isArray(body.coordinates) ? body.coordinates : existing.coordinates;

    let totalDist = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      totalDist += calculateHaversineDistance(coords[i], coords[i + 1]);
    }

    current.lines[idx] = {
      ...existing,
      ...body,
      coordinates: coords,
      distanceMeters: Math.round(totalDist),
      id: existing.id,
      updatedAt: new Date().toISOString(),
    };

    saveMapData(current, tenantId);

    return reply.send({
      success: true,
      message: `Trazado "${current.lines[idx].name}" actualizado.`,
      line: current.lines[idx],
      stats: calculateMapStats(current),
    });
  });

  // 8. Eliminar una línea
  fastify.delete("/maps/lines/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };

    const current = loadMapData(tenantId);
    const initialLen = current.lines.length;
    current.lines = current.lines.filter((l) => l.id !== id);

    if (current.lines.length === initialLen) {
      return reply.status(404).send({
        success: false,
        message: `Línea con ID "${id}" no encontrada.`,
      });
    }

    saveMapData(current, tenantId);

    return reply.send({
      success: true,
      message: "Trazado eliminado correctamente.",
      stats: calculateMapStats(current),
    });
  });

  // 9. Crear una nueva área o polígono de cobertura
  fastify.post("/maps/areas", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const body = request.body as any;

    if (!body.name || !Array.isArray(body.coordinates) || body.coordinates.length < 3) {
      return reply.status(400).send({
        success: false,
        message: "Se requiere un nombre y al menos 3 vértices para formar un polígono de área.",
      });
    }

    const surface = calculatePolygonAreaKm2(body.coordinates);
    const current = loadMapData(tenantId);
    const now = new Date().toISOString();

    const newArea: MapArea = {
      id: body.id || `area_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: body.name.trim(),
      coordinates: body.coordinates,
      fillColor: body.fillColor || "#3b82f6",
      strokeColor: body.strokeColor || "#1d4ed8",
      fillOpacity: typeof body.fillOpacity === "number" ? body.fillOpacity : 0.2,
      surfaceAreaKm2: surface,
      status: body.status || "active",
      targetCustomers: body.targetCustomers,
      notes: body.notes || "",
      createdAt: now,
      updatedAt: now,
    };

    current.areas.push(newArea);
    saveMapData(current, tenantId);

    return reply.send({
      success: true,
      message: `Zona "${newArea.name}" guardada (${newArea.surfaceAreaKm2} km²).`,
      area: newArea,
      stats: calculateMapStats(current),
    });
  });

  // 10. Actualizar un área
  fastify.put("/maps/areas/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const body = request.body as any;

    const current = loadMapData(tenantId);
    const idx = current.areas.findIndex((a) => a.id === id);

    if (idx === -1) {
      return reply.status(404).send({
        success: false,
        message: `Área con ID "${id}" no encontrada.`,
      });
    }

    const existing = current.areas[idx];
    const coords = Array.isArray(body.coordinates) ? body.coordinates : existing.coordinates;
    const surface = calculatePolygonAreaKm2(coords);

    current.areas[idx] = {
      ...existing,
      ...body,
      coordinates: coords,
      surfaceAreaKm2: surface,
      id: existing.id,
      updatedAt: new Date().toISOString(),
    };

    saveMapData(current, tenantId);

    return reply.send({
      success: true,
      message: `Zona "${current.areas[idx].name}" actualizada.`,
      area: current.areas[idx],
      stats: calculateMapStats(current),
    });
  });

  // 11. Eliminar un área
  fastify.delete("/maps/areas/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };

    const current = loadMapData(tenantId);
    const initialLen = current.areas.length;
    current.areas = current.areas.filter((a) => a.id !== id);

    if (current.areas.length === initialLen) {
      return reply.status(404).send({
        success: false,
        message: `Área con ID "${id}" no encontrada.`,
      });
    }

    saveMapData(current, tenantId);

    return reply.send({
      success: true,
      message: "Área de cobertura eliminada correctamente.",
      stats: calculateMapStats(current),
    });
  });

  // 12. Estadísticas resumidas del mapa
  fastify.get("/maps/stats", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const data = loadMapData(tenantId);
    const stats = calculateMapStats(data);
    return reply.send({ success: true, tenantId, stats });
  });

  // 13. Validar token de Mapbox en vivo
  fastify.post("/maps/test-token", async (request, reply) => {
    const body = (request.body as any) || {};
    const token = (body.token || "").trim();

    if (!token) {
      return reply.status(400).send({
        success: false,
        message: "Debe ingresar un Access Token de Mapbox (comienza típicamente con 'pk.').",
      });
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      // Consulta de geocoding simple en Mapbox
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/Peru.json?access_token=${encodeURIComponent(token)}&limit=1`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);

      const json = await res.json().catch(() => ({}));

      if (res.ok) {
        return reply.send({
          success: true,
          message: "¡Token de Mapbox verificado y operativo! Conectividad con la API confirmada.",
          details: {
            featuresFound: Array.isArray(json.features) ? json.features.length : 0,
            status: res.status,
          },
        });
      } else {
        return reply.status(res.status || 400).send({
          success: false,
          message: json.message || `Mapbox devolvió error HTTP ${res.status}. Verifique que el token esté activo.`,
          status: res.status,
        });
      }
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        message: `Error al conectar con los servidores de Mapbox: ${err.message}`,
      });
    }
  });
};
