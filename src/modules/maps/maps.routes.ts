import { FastifyPluginAsync } from "fastify";
import { resolveTenantId } from "../tenants/tenants.service";
import {
  loadMapData,
  saveMapData,
  calculateMapStats,
  calculateHaversineDistance,
  calculatePolygonAreaKm2,
  getTenantCustomersWithCoordinates,
  createMapProject,
  updateMapProject,
  deleteMapProject,
  setActiveMapProject,
  syncActiveMapFields,
} from "./maps.service";
import { MapNode, MapLine, MapArea } from "./maps.types";

export const mapsRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. Obtener datos completos del mapa para el tenant activo
  fastify.get("/maps/data", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { mapId } = (request.query as { mapId?: string }) || {};
    const data = loadMapData(tenantId);

    if (mapId && Array.isArray(data.maps) && data.maps.some((m) => m.id === mapId)) {
      data.activeMapId = mapId;
      syncActiveMapFields(data);
      saveMapData(data, tenantId);
    }

    const stats = calculateMapStats(data);
    const customers = getTenantCustomersWithCoordinates(tenantId);

    return reply.send({
      success: true,
      tenantId,
      activeMapId: data.activeMapId,
      maps: data.maps,
      data,
      stats,
      customers,
    });
  });

  // 1b. Obtener listado de proyectos/mapas del tenant
  fastify.get("/maps/projects", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const data = loadMapData(tenantId);
    const stats = calculateMapStats(data);

    return reply.send({
      success: true,
      tenantId,
      activeMapId: data.activeMapId,
      maps: data.maps,
      stats,
    });
  });

  // 1c. Crear nuevo proyecto de mapa (ej: "Mapa Zona Carabayllo")
  fastify.post("/maps/projects", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const body = (request.body as any) || {};

    if (!body.name || !body.name.trim()) {
      return reply.status(400).send({
        success: false,
        message: "El nombre del mapa es requerido (ej: Mapa Zona Carabayllo).",
      });
    }

    try {
      const { data, newProject } = createMapProject(tenantId, body);
      const stats = calculateMapStats(data);
      return reply.send({
        success: true,
        message: `Mapa "${newProject.name}" creado exitosamente.`,
        project: newProject,
        activeMapId: data.activeMapId,
        maps: data.maps,
        data,
        stats,
      });
    } catch (err: any) {
      return reply.status(400).send({ success: false, message: err.message });
    }
  });

  // 1d. Actualizar un proyecto de mapa
  fastify.put("/maps/projects/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const body = (request.body as any) || {};

    try {
      const { data, updatedProject } = updateMapProject(tenantId, id, body);
      const stats = calculateMapStats(data);
      return reply.send({
        success: true,
        message: `Mapa "${updatedProject.name}" actualizado.`,
        project: updatedProject,
        activeMapId: data.activeMapId,
        maps: data.maps,
        data,
        stats,
      });
    } catch (err: any) {
      return reply.status(400).send({ success: false, message: err.message });
    }
  });

  // 1e. Eliminar un proyecto de mapa
  fastify.delete("/maps/projects/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };

    try {
      const result = deleteMapProject(tenantId, id);
      const stats = calculateMapStats(result.data);
      return reply.send({
        success: true,
        message: result.message,
        activeMapId: result.data.activeMapId,
        maps: result.data.maps,
        data: result.data,
        stats,
      });
    } catch (err: any) {
      return reply.status(400).send({ success: false, message: err.message });
    }
  });

  // 1f. Activar un proyecto de mapa específico
  fastify.post("/maps/projects/:id/activate", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };

    try {
      const updated = setActiveMapProject(tenantId, id);
      const stats = calculateMapStats(updated);
      const activeMap = updated.maps.find((m) => m.id === id);
      return reply.send({
        success: true,
        message: `Mapa "${activeMap?.name || id}" activado.`,
        activeMapId: updated.activeMapId,
        activeMap,
        data: updated,
        stats,
      });
    } catch (err: any) {
      return reply.status(400).send({ success: false, message: err.message });
    }
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
      activeMapId: saved.activeMapId,
      maps: saved.maps,
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
    const targetMapId = body.mapId || (request.query as any)?.mapId || current.activeMapId;
    const targetMap = current.maps.find((m) => m.id === targetMapId) || current.maps[0];

    const now = new Date().toISOString();
    const newNode: MapNode = {
      id: body.id || `node_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: body.name.trim(),
      type: body.type || "nap",
      icon: body.icon || "box",
      customImage: body.customImage || (body.icon && body.icon.startsWith("data:image") ? body.icon : undefined),
      photos: Array.isArray(body.photos) ? body.photos : [],
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

    targetMap.nodes.push(newNode);
    targetMap.updatedAt = now;
    syncActiveMapFields(current);
    saveMapData(current, tenantId);

    return reply.send({
      success: true,
      message: `Punto "${newNode.name}" creado en "${targetMap.name}".`,
      node: newNode,
      mapId: targetMap.id,
      stats: calculateMapStats(current),
    });
  });

  // 4. Actualizar un nodo existente
  fastify.put("/maps/nodes/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const body = request.body as any;

    const current = loadMapData(tenantId);
    let targetMap = current.maps.find((m) => m.nodes.some((n) => n.id === id));
    if (!targetMap) targetMap = current.maps.find((m) => m.id === current.activeMapId) || current.maps[0];

    const idx = targetMap.nodes.findIndex((n) => n.id === id);
    if (idx === -1) {
      return reply.status(404).send({
        success: false,
        message: `Nodo con ID "${id}" no encontrado.`,
      });
    }

    const existing = targetMap.nodes[idx];
    targetMap.nodes[idx] = {
      ...existing,
      ...body,
      id: existing.id, // Inmutable
      updatedAt: new Date().toISOString(),
    };
    targetMap.updatedAt = new Date().toISOString();

    syncActiveMapFields(current);
    saveMapData(current, tenantId);

    return reply.send({
      success: true,
      message: `Nodo "${targetMap.nodes[idx].name}" actualizado.`,
      node: targetMap.nodes[idx],
      mapId: targetMap.id,
      stats: calculateMapStats(current),
    });
  });

  // 4b. Agregar foto a la línea de tiempo del nodo con marca de agua
  fastify.post("/maps/nodes/:id/photos", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const body = request.body as any;

    if (!body.url) {
      return reply.status(400).send({ success: false, message: "La imagen de la foto es requerida." });
    }

    const current = loadMapData(tenantId);
    let targetNode: MapNode | undefined;
    for (const map of current.maps) {
      const n = map.nodes.find((x) => x.id === id);
      if (n) {
        targetNode = n;
        break;
      }
    }

    if (!targetNode) {
      return reply.status(404).send({ success: false, message: "Nodo no encontrado." });
    }

    if (!Array.isArray(targetNode.photos)) {
      targetNode.photos = [];
    }

    const now = new Date();
    const newPhoto = {
      id: body.id || `photo_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      url: body.url,
      thumbnail: body.thumbnail || body.url,
      timestamp: now.toISOString(),
      dateFormatted: body.dateFormatted || now.toLocaleString("es-PE"),
      user: body.user || "Operador",
      tenantName: body.tenantName || tenantId,
      lat: typeof body.lat === "number" ? body.lat : targetNode.lat,
      lng: typeof body.lng === "number" ? body.lng : targetNode.lng,
      notes: body.notes || "",
    };

    targetNode.photos.unshift(newPhoto);
    targetNode.updatedAt = now.toISOString();

    syncActiveMapFields(current);
    saveMapData(current, tenantId);

    return reply.send({
      success: true,
      message: "Foto de estado agregada exitosamente.",
      photo: newPhoto,
      photosCount: targetNode.photos.length,
    });
  });

  // 4c. Eliminar una foto específica del historial del nodo
  fastify.delete("/maps/nodes/:id/photos/:photoId", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id, photoId } = request.params as { id: string; photoId: string };

    const current = loadMapData(tenantId);
    let targetNode: MapNode | undefined;
    for (const map of current.maps) {
      const n = map.nodes.find((x) => x.id === id);
      if (n) {
        targetNode = n;
        break;
      }
    }

    if (!targetNode) {
      return reply.status(404).send({ success: false, message: "Nodo no encontrado." });
    }

    if (Array.isArray(targetNode.photos)) {
      targetNode.photos = targetNode.photos.filter((p) => p.id !== photoId);
    }
    targetNode.updatedAt = new Date().toISOString();

    syncActiveMapFields(current);
    saveMapData(current, tenantId);

    return reply.send({
      success: true,
      message: "Foto eliminada del historial.",
      photosCount: targetNode.photos ? targetNode.photos.length : 0,
    });
  });

  // 5. Eliminar un nodo
  fastify.delete("/maps/nodes/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };

    const current = loadMapData(tenantId);
    let found = false;

    for (const map of current.maps) {
      const initialLen = map.nodes.length;
      map.nodes = map.nodes.filter((n) => n.id !== id);
      if (map.nodes.length !== initialLen) {
        found = true;
        map.updatedAt = new Date().toISOString();
        // Limpiar enlaces dependientes en este mapa
        for (const line of map.lines) {
          if (line.fromNodeId === id) line.fromNodeId = undefined;
          if (line.toNodeId === id) line.toNodeId = undefined;
        }
      }
    }

    if (!found) {
      return reply.status(404).send({
        success: false,
        message: `Nodo con ID "${id}" no encontrado.`,
      });
    }

    syncActiveMapFields(current);
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
    const targetMapId = body.mapId || (request.query as any)?.mapId || current.activeMapId;
    const targetMap = current.maps.find((m) => m.id === targetMapId) || current.maps[0];

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

    targetMap.lines.push(newLine);
    targetMap.updatedAt = now;

    syncActiveMapFields(current);
    saveMapData(current, tenantId);

    return reply.send({
      success: true,
      message: `Trazado "${newLine.name}" guardado (${(newLine.distanceMeters / 1000).toFixed(2)} km) en "${targetMap.name}".`,
      line: newLine,
      mapId: targetMap.id,
      stats: calculateMapStats(current),
    });
  });

  // 7. Actualizar una línea existente
  fastify.put("/maps/lines/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const body = request.body as any;

    const current = loadMapData(tenantId);
    let targetMap = current.maps.find((m) => m.lines.some((l) => l.id === id));
    if (!targetMap) targetMap = current.maps.find((m) => m.id === current.activeMapId) || current.maps[0];

    const idx = targetMap.lines.findIndex((l) => l.id === id);
    if (idx === -1) {
      return reply.status(404).send({
        success: false,
        message: `Línea con ID "${id}" no encontrada.`,
      });
    }

    const existing = targetMap.lines[idx];
    const coords = Array.isArray(body.coordinates) ? body.coordinates : existing.coordinates;

    let totalDist = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      totalDist += calculateHaversineDistance(coords[i], coords[i + 1]);
    }

    targetMap.lines[idx] = {
      ...existing,
      ...body,
      coordinates: coords,
      distanceMeters: Math.round(totalDist),
      id: existing.id,
      updatedAt: new Date().toISOString(),
    };
    targetMap.updatedAt = new Date().toISOString();

    syncActiveMapFields(current);
    saveMapData(current, tenantId);

    return reply.send({
      success: true,
      message: `Trazado "${targetMap.lines[idx].name}" actualizado.`,
      line: targetMap.lines[idx],
      mapId: targetMap.id,
      stats: calculateMapStats(current),
    });
  });

  // 8. Eliminar una línea
  fastify.delete("/maps/lines/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };

    const current = loadMapData(tenantId);
    let found = false;

    for (const map of current.maps) {
      const initialLen = map.lines.length;
      map.lines = map.lines.filter((l) => l.id !== id);
      if (map.lines.length !== initialLen) {
        found = true;
        map.updatedAt = new Date().toISOString();
      }
    }

    if (!found) {
      return reply.status(404).send({
        success: false,
        message: `Línea con ID "${id}" no encontrada.`,
      });
    }

    syncActiveMapFields(current);
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
    const targetMapId = body.mapId || (request.query as any)?.mapId || current.activeMapId;
    const targetMap = current.maps.find((m) => m.id === targetMapId) || current.maps[0];

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

    targetMap.areas.push(newArea);
    targetMap.updatedAt = now;

    syncActiveMapFields(current);
    saveMapData(current, tenantId);

    return reply.send({
      success: true,
      message: `Zona "${newArea.name}" guardada (${newArea.surfaceAreaKm2} km²) en "${targetMap.name}".`,
      area: newArea,
      mapId: targetMap.id,
      stats: calculateMapStats(current),
    });
  });

  // 10. Actualizar un área
  fastify.put("/maps/areas/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const body = request.body as any;

    const current = loadMapData(tenantId);
    let targetMap = current.maps.find((m) => m.areas.some((a) => a.id === id));
    if (!targetMap) targetMap = current.maps.find((m) => m.id === current.activeMapId) || current.maps[0];

    const idx = targetMap.areas.findIndex((a) => a.id === id);
    if (idx === -1) {
      return reply.status(404).send({
        success: false,
        message: `Área con ID "${id}" no encontrada.`,
      });
    }

    const existing = targetMap.areas[idx];
    const coords = Array.isArray(body.coordinates) ? body.coordinates : existing.coordinates;
    const surface = calculatePolygonAreaKm2(coords);

    targetMap.areas[idx] = {
      ...existing,
      ...body,
      coordinates: coords,
      surfaceAreaKm2: surface,
      id: existing.id,
      updatedAt: new Date().toISOString(),
    };
    targetMap.updatedAt = new Date().toISOString();

    syncActiveMapFields(current);
    saveMapData(current, tenantId);

    return reply.send({
      success: true,
      message: `Zona "${targetMap.areas[idx].name}" actualizada.`,
      area: targetMap.areas[idx],
      mapId: targetMap.id,
      stats: calculateMapStats(current),
    });
  });

  // 11. Eliminar un área
  fastify.delete("/maps/areas/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };

    const current = loadMapData(tenantId);
    let found = false;

    for (const map of current.maps) {
      const initialLen = map.areas.length;
      map.areas = map.areas.filter((a) => a.id !== id);
      if (map.areas.length !== initialLen) {
        found = true;
        map.updatedAt = new Date().toISOString();
      }
    }

    if (!found) {
      return reply.status(404).send({
        success: false,
        message: `Área con ID "${id}" no encontrada.`,
      });
    }

    syncActiveMapFields(current);
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
