import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { resolveTenantId, getTenantFilePath } from "../tenants/tenants.service";

export interface MessageItem {
  id: string;
  sender: "client" | "agent" | "system";
  senderName: string;
  text: string;
  timestamp: string;
  timeFormatted: string;
  status?: "sent" | "delivered" | "read";
  replyTo?: {
    id: string;
    senderName: string;
    text: string;
  };
  reactions?: Record<string, string[]>;
  isPinned?: boolean;
  isStarred?: boolean;
  isDeletedForEveryone?: boolean;
  deletedFor?: string[];
  forwarded?: boolean;
  attachment?: {
    type: "image" | "file" | "audio" | "location";
    url?: string;
    name?: string;
    size?: string;
    mimeType?: string;
    duration?: string;
    lat?: number;
    lng?: number;
    address?: string;
    isLive?: boolean;
    expiresAt?: string;
  };
}

export interface Conversation {
  id: string;
  type: "cliente" | "personal";
  contactId?: number | string;
  name: string;
  phone: string;
  email?: string;
  avatar: string;
  status: "online" | "offline" | "busy" | "away";
  tags: string[]; // e.g. ["clientes", "corte"], ["personal"], ["clientes", "pendiente"]
  isArchived?: boolean;
  pinnedMessageId?: string;
  planOrRole?: string;
  serviceStatus?: "active" | "suspended" | "pending";
  debtAmount?: number;
  unreadCount: number;
  lastMessage: string;
  lastMessageTime: string;
  lastMessageDate: string;
  messages: MessageItem[];
  createdAt: string;
  updatedAt: string;
  contractStartDate?: string;
  rating?: number;
  ratingLabel?: string;
  address?: string;
  backpackItems?: string[];
}

export interface MessageFilter {
  id: string;
  name: string;
  color: string;
  isSystem?: boolean;
}

const DEFAULT_FILTERS: MessageFilter[] = [
  { id: "all", name: "Todos", color: "blue", isSystem: true },
  { id: "personal", name: "Personal / Cuadrilla", color: "emerald", isSystem: true },
  { id: "clientes", name: "Clientes", color: "indigo", isSystem: true },
  { id: "corte", name: "Corte de Servicio", color: "rose", isSystem: true },
  { id: "pendiente", name: "Pendiente de Pago", color: "amber", isSystem: true },
  { id: "archived", name: "Archivados", color: "purple", isSystem: true },
];

function loadFiltersFromDisk(tenantId: string): MessageFilter[] {
  const filePath = getTenantFilePath(tenantId, "message_filters.json");
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(raw);
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch (err) {}
  saveFiltersToDisk(tenantId, DEFAULT_FILTERS);
  return DEFAULT_FILTERS;
}

function saveFiltersToDisk(tenantId: string, filters: MessageFilter[]) {
  const filePath = getTenantFilePath(tenantId, "message_filters.json");
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(filters, null, 2), "utf-8");
  } catch (err) {}
}

function generateInitialConversations(_tenantId: string): Conversation[] {
  return [];
}

function loadConversationsFromDisk(tenantId: string): Conversation[] {
  const filePath = getTenantFilePath(tenantId, "messages.json");
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data;
    }
  } catch (err) {}

  saveConversationsToDisk(tenantId, []);
  return [];
}

function saveConversationsToDisk(tenantId: string, conversations: Conversation[]) {
  const filePath = getTenantFilePath(tenantId, "messages.json");
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(conversations, null, 2), "utf-8");
  } catch (err) {}
}

const createFilterSchema = z.object({
  name: z.string().min(2, "El nombre del filtro debe tener al menos 2 caracteres"),
  color: z.string().min(1).default("blue"),
});

const updateFilterSchema = z.object({
  name: z.string().min(2).optional(),
  color: z.string().min(1).optional(),
});

const sendMessageSchema = z.object({
  text: z.string().optional().default(""),
  replyTo: z.object({
    id: z.string(),
    senderName: z.string(),
    text: z.string(),
  }).optional(),
  attachment: z.object({
    type: z.enum(["image", "file", "audio", "location"]),
    url: z.string().optional(),
    name: z.string().optional(),
    size: z.string().optional(),
    mimeType: z.string().optional(),
    duration: z.string().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    address: z.string().optional(),
    isLive: z.boolean().optional(),
    expiresAt: z.string().optional(),
  }).optional(),
});

export const messagesRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. Obtener lista de filtros de mensajes
  fastify.get("/messages/filters", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const filters = loadFiltersFromDisk(tenantId);
    return reply.send({ success: true, tenantId, data: filters });
  });

  // 2. Crear nuevo filtro personalizado
  fastify.post("/messages/filters", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const parse = createFilterSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, errors: parse.error.format() });
    }

    const filters = loadFiltersFromDisk(tenantId);
    const id = parse.data.name.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 20) + "_" + Date.now().toString().slice(-4);
    const newFilter: MessageFilter = {
      id,
      name: parse.data.name,
      color: parse.data.color,
      isSystem: false,
    };
    filters.push(newFilter);
    saveFiltersToDisk(tenantId, filters);

    return reply.status(201).send({ success: true, message: "Filtro creado exitosamente", data: newFilter });
  });

  // 3. Editar filtro existente
  fastify.put("/messages/filters/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const parse = updateFilterSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, errors: parse.error.format() });
    }

    const filters = loadFiltersFromDisk(tenantId);
    const filter = filters.find(f => f.id === id);
    if (!filter) {
      return reply.status(404).send({ success: false, message: "Filtro no encontrado" });
    }

    if (parse.data.name) filter.name = parse.data.name;
    if (parse.data.color) filter.color = parse.data.color;

    saveFiltersToDisk(tenantId, filters);
    return reply.send({ success: true, message: "Filtro actualizado", data: filter });
  });

  // 4. Eliminar filtro
  fastify.delete("/messages/filters/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };

    const filters = loadFiltersFromDisk(tenantId);
    const index = filters.findIndex(f => f.id === id);
    if (index === -1) {
      return reply.status(404).send({ success: false, message: "Filtro no encontrado" });
    }

    if (filters[index].isSystem) {
      return reply.status(403).send({ success: false, message: "No es posible eliminar filtros base del sistema" });
    }

    const deleted = filters.splice(index, 1)[0];
    saveFiltersToDisk(tenantId, filters);
    return reply.send({ success: true, message: "Filtro eliminado", data: deleted });
  });

  // 5. Listar conversaciones
  fastify.get("/messages/conversations", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const query = request.query as { category?: string; q?: string; includeArchived?: string } | undefined;
    let list = loadConversationsFromDisk(tenantId);

    // Filtro por archivados o categoría
    const isArchivedFilter = query?.category === "archived";
    if (isArchivedFilter) {
      list = list.filter(c => c.isArchived === true);
    } else {
      // Por defecto no mostrar archivados a menos que se especifique
      if (query?.includeArchived !== "true") {
        list = list.filter(c => !c.isArchived);
      }

      if (query?.category && query.category !== "all") {
        const cat = query.category.toLowerCase();
        list = list.filter(c => c.tags && c.tags.some(t => t.toLowerCase() === cat));
      }
    }

    // Búsqueda por texto (nombre, teléfono, mensaje)
    if (query?.q && query.q.trim()) {
      const term = query.q.toLowerCase().trim();
      list = list.filter(c => 
        c.name.toLowerCase().includes(term) ||
        c.phone.toLowerCase().includes(term) ||
        (c.lastMessage && c.lastMessage.toLowerCase().includes(term)) ||
        (c.planOrRole && c.planOrRole.toLowerCase().includes(term))
      );
    }

    return reply.send({ success: true, tenantId, count: list.length, data: list });
  });

  // 6. Obtener una conversación específica con historial
  fastify.get("/messages/conversations/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const list = loadConversationsFromDisk(tenantId);
    const conv = list.find(c => c.id === id);
    if (!conv) {
      return reply.status(404).send({ success: false, message: "Conversación no encontrada" });
    }

    // Marcar como leída
    conv.unreadCount = 0;
    saveConversationsToDisk(tenantId, list);

    return reply.send({ success: true, data: conv });
  });

  // 7. Enviar mensaje a una conversación
  fastify.post("/messages/conversations/:id/messages", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const parse = sendMessageSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, errors: parse.error.format() });
    }

    const list = loadConversationsFromDisk(tenantId);
    const conv = list.find(c => c.id === id);
    if (!conv) {
      return reply.status(404).send({ success: false, message: "Conversación no encontrada" });
    }

    const now = new Date();
    const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const attachment = parse.data.attachment;
    let fallbackText = parse.data.text || "";
    if (!fallbackText && attachment) {
      if (attachment.type === 'audio') fallbackText = `Nota de voz (${attachment.duration || '0:05'})`;
      else if (attachment.type === 'image') fallbackText = 'Foto enviada';
      else if (attachment.type === 'location') fallbackText = attachment.isLive ? 'Ubicación en tiempo real' : 'Ubicación enviada';
      else fallbackText = attachment.name || 'Archivo adjunto';
    }

    const newMsg: MessageItem = {
      id: "m-" + Date.now(),
      sender: "agent",
      senderName: "Operador TurboNetwork",
      text: fallbackText,
      timestamp: now.toISOString(),
      timeFormatted,
      status: "read",
      replyTo: parse.data.replyTo,
      attachment,
    };

    conv.messages.push(newMsg);
    conv.lastMessage = fallbackText;
    conv.lastMessageTime = timeFormatted;
    conv.lastMessageDate = now.toISOString().split("T")[0];
    conv.updatedAt = now.toISOString();

    saveConversationsToDisk(tenantId, list);

    return reply.status(201).send({ success: true, message: "Mensaje enviado", data: newMsg });
  });

  // 7.1. Reaccionar a un mensaje
  fastify.post("/messages/conversations/:id/messages/:msgId/reaction", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id, msgId } = request.params as { id: string; msgId: string };
    const { emoji } = (request.body as { emoji: string }) || {};
    if (!emoji) {
      return reply.status(400).send({ success: false, message: "Emoji requerido" });
    }

    const list = loadConversationsFromDisk(tenantId);
    const conv = list.find(c => c.id === id);
    if (!conv) {
      return reply.status(404).send({ success: false, message: "Conversación no encontrada" });
    }

    const msg = conv.messages.find(m => m.id === msgId);
    if (!msg) {
      return reply.status(404).send({ success: false, message: "Mensaje no encontrado" });
    }

    if (!msg.reactions) msg.reactions = {};
    const userKey = "agent";
    const currentList = msg.reactions[emoji] || [];

    if (currentList.includes(userKey)) {
      msg.reactions[emoji] = currentList.filter(u => u !== userKey);
      if (msg.reactions[emoji].length === 0) {
        delete msg.reactions[emoji];
      }
    } else {
      msg.reactions[emoji] = [...currentList, userKey];
    }

    conv.updatedAt = new Date().toISOString();
    saveConversationsToDisk(tenantId, list);

    return reply.send({ success: true, reactions: msg.reactions, message: "Reacción guardada" });
  });

  // 7.2. Fijar / Desfijar mensaje
  fastify.post("/messages/conversations/:id/messages/:msgId/pin", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id, msgId } = request.params as { id: string; msgId: string };
    const body = (request.body as { pinned?: boolean }) || {};

    const list = loadConversationsFromDisk(tenantId);
    const conv = list.find(c => c.id === id);
    if (!conv) {
      return reply.status(404).send({ success: false, message: "Conversación no encontrada" });
    }

    const msg = conv.messages.find(m => m.id === msgId);
    if (!msg) {
      return reply.status(404).send({ success: false, message: "Mensaje no encontrado" });
    }

    const isPinned = typeof body.pinned === "boolean" ? body.pinned : !msg.isPinned;
    if (isPinned) {
      conv.messages.forEach(m => (m.isPinned = false));
      msg.isPinned = true;
      conv.pinnedMessageId = msg.id;
    } else {
      msg.isPinned = false;
      if (conv.pinnedMessageId === msgId) {
        delete conv.pinnedMessageId;
      }
    }

    conv.updatedAt = new Date().toISOString();
    saveConversationsToDisk(tenantId, list);

    return reply.send({ success: true, isPinned, pinnedMessageId: conv.pinnedMessageId, message: isPinned ? "Mensaje fijado" : "Mensaje desfijado" });
  });

  // 7.3. Destacar / Quitar destacado a un mensaje
  fastify.post("/messages/conversations/:id/messages/:msgId/star", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id, msgId } = request.params as { id: string; msgId: string };
    const body = (request.body as { starred?: boolean }) || {};

    const list = loadConversationsFromDisk(tenantId);
    const conv = list.find(c => c.id === id);
    if (!conv) {
      return reply.status(404).send({ success: false, message: "Conversación no encontrada" });
    }

    const msg = conv.messages.find(m => m.id === msgId);
    if (!msg) {
      return reply.status(404).send({ success: false, message: "Mensaje no encontrado" });
    }

    const isStarred = typeof body.starred === "boolean" ? body.starred : !msg.isStarred;
    msg.isStarred = isStarred;

    conv.updatedAt = new Date().toISOString();
    saveConversationsToDisk(tenantId, list);

    return reply.send({ success: true, isStarred, message: isStarred ? "Mensaje destacado" : "Destacado eliminado" });
  });

  // 7.4. Eliminar mensaje (Para todos o Para mí)
  fastify.delete("/messages/conversations/:id/messages/:msgId", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id, msgId } = request.params as { id: string; msgId: string };
    const query = request.query as { mode?: "everyone" | "me" };
    const mode = query?.mode || "everyone";

    const list = loadConversationsFromDisk(tenantId);
    const conv = list.find(c => c.id === id);
    if (!conv) {
      return reply.status(404).send({ success: false, message: "Conversación no encontrada" });
    }

    const msgIndex = conv.messages.findIndex(m => m.id === msgId);
    if (msgIndex === -1) {
      return reply.status(404).send({ success: false, message: "Mensaje no encontrado" });
    }

    if (mode === "everyone") {
      conv.messages[msgIndex].isDeletedForEveryone = true;
      conv.messages[msgIndex].text = "Este mensaje fue eliminado";
      delete conv.messages[msgIndex].attachment;
      delete conv.messages[msgIndex].reactions;
      conv.messages[msgIndex].isPinned = false;
      if (conv.pinnedMessageId === msgId) delete conv.pinnedMessageId;
    } else {
      conv.messages.splice(msgIndex, 1);
      if (conv.pinnedMessageId === msgId) delete conv.pinnedMessageId;
    }

    if (conv.messages.length > 0) {
      const last = conv.messages[conv.messages.length - 1];
      conv.lastMessage = last.text;
      conv.lastMessageTime = last.timeFormatted;
    } else {
      conv.lastMessage = "Sin mensajes";
    }

    conv.updatedAt = new Date().toISOString();
    saveConversationsToDisk(tenantId, list);

    return reply.send({ success: true, message: mode === "everyone" ? "Mensaje eliminado para todos" : "Mensaje eliminado para ti", mode });
  });

  // 7.5. Acciones por lote sobre mensajes seleccionados
  fastify.post("/messages/conversations/:id/messages/batch-action", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const { action, messageIds, mode } = (request.body as { action: "delete" | "star" | "unstar"; messageIds: string[]; mode?: "everyone" | "me" }) || {};

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return reply.status(400).send({ success: false, message: "No se seleccionaron mensajes" });
    }

    const list = loadConversationsFromDisk(tenantId);
    const conv = list.find(c => c.id === id);
    if (!conv) {
      return reply.status(404).send({ success: false, message: "Conversación no encontrada" });
    }

    const idSet = new Set(messageIds);

    if (action === "star" || action === "unstar") {
      const starVal = action === "star";
      conv.messages.forEach(m => {
        if (idSet.has(m.id)) m.isStarred = starVal;
      });
    } else if (action === "delete") {
      const deleteMode = mode || "everyone";
      if (deleteMode === "everyone") {
        conv.messages.forEach(m => {
          if (idSet.has(m.id)) {
            m.isDeletedForEveryone = true;
            m.text = "Este mensaje fue eliminado";
            delete m.attachment;
            delete m.reactions;
            m.isPinned = false;
            if (conv.pinnedMessageId === m.id) delete conv.pinnedMessageId;
          }
        });
      } else {
        conv.messages = conv.messages.filter(m => !idSet.has(m.id));
        if (conv.pinnedMessageId && idSet.has(conv.pinnedMessageId)) {
          delete conv.pinnedMessageId;
        }
      }
    }

    if (conv.messages.length > 0) {
      const last = conv.messages[conv.messages.length - 1];
      conv.lastMessage = last.text;
      conv.lastMessageTime = last.timeFormatted;
    } else {
      conv.lastMessage = "Sin mensajes";
    }

    conv.updatedAt = new Date().toISOString();
    saveConversationsToDisk(tenantId, list);

    return reply.send({ success: true, message: `Acción '${action}' aplicada a ${messageIds.length} mensajes` });
  });

  // 7.6. Reenviar mensajes seleccionados a otras conversaciones
  fastify.post("/messages/conversations/forward", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const body = (request.body as { targetConversationIds: string[]; messages?: any[]; messageIds?: string[] }) || {};
    const { targetConversationIds } = body;

    const list = loadConversationsFromDisk(tenantId);
    let forwardItems = Array.isArray(body.messages) ? [...body.messages] : [];

    if (forwardItems.length === 0 && Array.isArray(body.messageIds)) {
      const idSet = new Set(body.messageIds);
      for (const conv of list) {
        for (const m of conv.messages) {
          if (idSet.has(m.id)) {
            forwardItems.push(m);
          }
        }
      }
    }

    if (!Array.isArray(targetConversationIds) || targetConversationIds.length === 0) {
      return reply.status(400).send({ success: false, message: "Selecciona al menos un chat de destino" });
    }
    if (forwardItems.length === 0) {
      return reply.status(400).send({ success: false, message: "No hay mensajes para reenviar" });
    }

    const now = new Date();
    const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let sentCount = 0;
    for (const targetId of targetConversationIds) {
      const conv = list.find(c => c.id === targetId);
      if (!conv) continue;

      for (const m of forwardItems) {
        const cleanTxt = m.text || "";
        const fwdMsg: MessageItem = {
          id: "m-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
          sender: "agent",
          senderName: "Operador TurboNetwork",
          text: cleanTxt,
          timestamp: now.toISOString(),
          timeFormatted,
          status: "read",
          forwarded: true,
          attachment: m.attachment ? JSON.parse(JSON.stringify(m.attachment)) : undefined,
        };
        conv.messages.push(fwdMsg);
        conv.lastMessage = cleanTxt || (fwdMsg.attachment ? "Archivo reenviado" : "Mensaje reenviado");
        conv.lastMessageTime = timeFormatted;
        conv.updatedAt = now.toISOString();
        sentCount++;
      }
    }

    saveConversationsToDisk(tenantId, list);
    return reply.send({ success: true, message: `Reenviado con éxito a ${targetConversationIds.length} chat(s)`, count: sentCount });
  });

  // 8. Crear nueva conversación
  fastify.post("/messages/conversations", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const body = request.body as any;
    const name = body.name || body.contactName;
    const type = body.type || body.contactType || "cliente";
    let phone = body.phone || body.contactPhone;
    if (!phone && type === "personal") {
      phone = body.email || `INT-${body.contactId || body.userId || Date.now().toString().slice(-4)}`;
    }

    if (!name) {
      return reply.status(400).send({ success: false, message: "Nombre del contacto es obligatorio" });
    }
    if (!phone && type !== "personal") {
      return reply.status(400).send({ success: false, message: "Teléfono del contacto es obligatorio" });
    }
    if (!phone) phone = "+51 (Interno)";

    const list = loadConversationsFromDisk(tenantId);
    const now = new Date();
    const newConv: Conversation = {
      id: "conv-" + Date.now(),
      type: type as ("cliente" | "personal"),
      contactId: body.contactId || body.userId,
      name,
      phone,
      email: body.email,
      avatar: body.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`,
      status: "online",
      tags: body.tags || (body.tag ? [body.tag] : (type === "personal" ? ["personal"] : ["clientes"])),
      isArchived: false,
      planOrRole: body.planOrRole || body.contactDetail || (type === "personal" ? "Colaborador de Empresa" : "Cliente Activo"),
      serviceStatus: "active",
      unreadCount: 0,
      lastMessage: "Conversación iniciada",
      lastMessageTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      lastMessageDate: now.toISOString().split("T")[0],
      messages: [
        {
          id: "m-" + Date.now(),
          sender: "system",
          senderName: "Sistema",
          text: `Canal de mensajería iniciado con ${name}.`,
          timestamp: now.toISOString(),
          timeFormatted: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: "read",
        }
      ],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      contractStartDate: body.contractStartDate,
      rating: body.rating,
      ratingLabel: body.ratingLabel,
      address: body.address,
      backpackItems: body.backpackItems,
    };

    list.unshift(newConv);
    saveConversationsToDisk(tenantId, list);

    return reply.status(201).send({ success: true, message: "Chat creado exitosamente", data: newConv });
  });

  // 9. Actualizar conversación (tags, archivar/desarchivar)
  fastify.patch("/messages/conversations/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const body = request.body as { tags?: string[]; isArchived?: boolean };

    const list = loadConversationsFromDisk(tenantId);
    const conv = list.find(c => c.id === id);
    if (!conv) {
      return reply.status(404).send({ success: false, message: "Conversación no encontrada" });
    }

    if (Array.isArray(body.tags)) conv.tags = body.tags;
    if (typeof body.isArchived === "boolean") conv.isArchived = body.isArchived;
    conv.updatedAt = new Date().toISOString();

    saveConversationsToDisk(tenantId, list);
    return reply.send({ success: true, message: "Conversación actualizada", data: conv });
  });

  // 10. Eliminar conversación
  fastify.delete("/messages/conversations/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };

    const list = loadConversationsFromDisk(tenantId);
    const index = list.findIndex(c => c.id === id);
    if (index === -1) {
      return reply.status(404).send({ success: false, message: "Conversación no encontrada" });
    }

    const deleted = list.splice(index, 1)[0];
    saveConversationsToDisk(tenantId, list);
    return reply.send({ success: true, message: "Conversación eliminada", data: deleted });
  });
};
