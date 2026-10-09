import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { resolveTenantId, getTenantFilePath } from "../tenants/tenants.service";
import { WhatsAppService } from "./whatsapp.service";

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
    type: "image" | "file" | "audio" | "location" | "video";
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
    thumbnailUrl?: string;
    width?: number;
    height?: number;
  };
}

export interface CommunityGroup {
  id: string;
  communityId: string;
  name: string;
  description?: string;
  type: "announcements" | "support" | "billing" | "general";
  isReadOnly: boolean;
  icon?: string;
  unreadCount?: number;
  lastMessage?: string;
  lastMessageTime?: string;
  messages: MessageItem[];
  createdAt: string;
  updatedAt: string;
}

export interface Community {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  avatarUrl?: string;
  coverImage?: string;
  type: "zone" | "building" | "custom";
  linkedNaps?: string[];
  linkedZones?: string[];
  memberCount: number;
  groups: CommunityGroup[];
  createdAt: string;
  updatedAt: string;
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

function generateInitialCommunities(tenantId: string): Community[] {
  const now = new Date();
  const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return [
    {
      id: "comm-1",
      tenantId,
      name: "Condominio Los Jazmines (Sector Norte)",
      description: "Comunidad residencial conectada a la Troncal GPON Norte (Cajas NAP 01 a 06).",
      avatarUrl: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=150&auto=format&fit=crop&q=80",
      coverImage: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&auto=format&fit=crop&q=80",
      type: "building",
      linkedNaps: ["NAP-01", "NAP-02", "NAP-03"],
      linkedZones: ["Sector Norte"],
      memberCount: 42,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      groups: [
        {
          id: "grp-1-1",
          communityId: "comm-1",
          name: "📢 Avisos Oficiales & Red",
          description: "Canal exclusivo del ISP para alertas de mantenimiento y comunicados de corte preventivo.",
          type: "announcements",
          isReadOnly: true,
          unreadCount: 0,
          lastMessage: "Mantenimiento preventivo completado con éxito.",
          lastMessageTime: timeFormatted,
          messages: [
            {
              id: "gm-1",
              sender: "system",
              senderName: "NOC TurboNetwork",
              text: "Bienvenido al canal oficial de avisos de Condominio Los Jazmines. Aquí recibirás novedades de red y mejoras de servicio.",
              timestamp: now.toISOString(),
              timeFormatted,
              status: "read",
            },
            {
              id: "gm-2",
              sender: "agent",
              senderName: "Ing. Carlos Mendoza (NOC)",
              text: "Mantenimiento preventivo de fibra óptica completado. Todos los enlaces operando con potencia -18.4 dBm dentro de rango óptimo.",
              timestamp: now.toISOString(),
              timeFormatted,
              status: "read",
              reactions: { "👍": ["client1", "client2", "agent"], "👏": ["client3"] }
            }
          ],
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
        {
          id: "grp-1-2",
          communityId: "comm-1",
          name: "🛠️ Soporte Técnico & Fibra",
          description: "Canal abierto para consultas técnicas y reportes de vecinos del condominio.",
          type: "support",
          isReadOnly: false,
          unreadCount: 0,
          lastMessage: "Técnico en ruta para revisión de router en Dpto 402.",
          lastMessageTime: timeFormatted,
          messages: [
            {
              id: "gm-3",
              sender: "client",
              senderName: "Juan Pérez (Dpto 402)",
              text: "Buenas tardes, ¿hay alguna lentitud en el bloque B?",
              timestamp: now.toISOString(),
              timeFormatted,
              status: "read",
            },
            {
              id: "gm-4",
              sender: "agent",
              senderName: "Soporte Técnico TurboNetwork",
              text: "Hola Juan, verificamos la potencia de tu ONU y está en orden. Vamos a reiniciar la sesión PPPoE desde la central.",
              timestamp: now.toISOString(),
              timeFormatted,
              status: "read",
            }
          ],
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
        {
          id: "grp-1-3",
          communityId: "comm-1",
          name: "💳 Pagos & Facturación",
          description: "Fechas de corte, métodos de pago y comprobantes para vecinos.",
          type: "billing",
          isReadOnly: false,
          unreadCount: 0,
          lastMessage: "Recordatorio: La fecha de vencimiento es el 15 de cada mes.",
          lastMessageTime: timeFormatted,
          messages: [
            {
              id: "gm-5",
              sender: "agent",
              senderName: "Facturación TurboNetwork",
              text: "Estimados vecinos, pueden realizar sus pagos mediante Yape, Plin o Transferencia bancaria indicando su código de cliente.",
              timestamp: now.toISOString(),
              timeFormatted,
              status: "read",
            }
          ],
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        }
      ]
    },
    {
      id: "comm-2",
      tenantId,
      name: "Urbanización El Sol (Troncal Este)",
      description: "Sector Este con conexión GPON fibra directa hasta el hogar (Cajas NAP 10 a 16).",
      avatarUrl: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=150&auto=format&fit=crop&q=80",
      coverImage: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop&q=80",
      type: "zone",
      linkedNaps: ["NAP-10", "NAP-11", "NAP-12"],
      linkedZones: ["Sector Este"],
      memberCount: 58,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      groups: [
        {
          id: "grp-2-1",
          communityId: "comm-2",
          name: "📢 Comunicados Generales",
          description: "Avisos oficiales y estados de red para Urbanización El Sol.",
          type: "announcements",
          isReadOnly: true,
          unreadCount: 0,
          lastMessage: "Nuevas velocidades disponibles con tecnología Wi-Fi 6.",
          lastMessageTime: timeFormatted,
          messages: [
            {
              id: "gm-6",
              sender: "agent",
              senderName: "Administración TurboNetwork",
              text: "Aviso importante: Hemos habilitado planes de hasta 600 Mbps simétricos para la Urbanización El Sol.",
              timestamp: now.toISOString(),
              timeFormatted,
              status: "read",
              reactions: { "🎉": ["client1", "client2"] }
            }
          ],
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
        {
          id: "grp-2-2",
          communityId: "comm-2",
          name: "🛠️ Atención al Cliente",
          description: "Canal abierto para dudas de instalación y servicio.",
          type: "support",
          isReadOnly: false,
          unreadCount: 0,
          lastMessage: "Servicio restablecido en la manzana D.",
          lastMessageTime: timeFormatted,
          messages: [],
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        }
      ]
    }
  ];
}

function loadCommunitiesFromDisk(tenantId: string): Community[] {
  const filePath = getTenantFilePath(tenantId, "communities.json");
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(raw);
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch (err) {}

  const initial = generateInitialCommunities(tenantId);
  saveCommunitiesToDisk(tenantId, initial);
  return initial;
}

function saveCommunitiesToDisk(tenantId: string, communities: Community[]) {
  const filePath = getTenantFilePath(tenantId, "communities.json");
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(communities, null, 2), "utf-8");
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
  sender: z.enum(["agent", "client", "system"]).optional().default("agent"),
  senderName: z.string().optional(),
  replyTo: z.object({
    id: z.string(),
    senderName: z.string(),
    text: z.string(),
  }).optional(),
  attachment: z.object({
    type: z.enum(["image", "file", "audio", "location", "video"]),
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
    thumbnailUrl: z.string().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
  }).optional(),
});

export interface ChatBranding {
  appName: string;
  logoUrl?: string;
  accentColor?: string;
  statusText?: string;
}

export function loadChatBranding(tenantId: string): ChatBranding {
  const filePath = getTenantFilePath(tenantId, "chat_branding.json");
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {}
  return {
    appName: "TurboChat",
    logoUrl: "",
    accentColor: "#2563eb",
    statusText: "En Línea"
  };
}

export function saveChatBranding(tenantId: string, branding: ChatBranding) {
  const filePath = getTenantFilePath(tenantId, "chat_branding.json");
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(branding, null, 2), "utf-8");
  } catch (err) {}
}

type MessageListener = (data: any) => void;
const messageListeners = new Set<MessageListener>();

export function broadcastMessageEvent(event: {
  type: "new_message" | "community_message" | "conversation_read" | "reaction";
  tenantId: string;
  conversationId?: string;
  communityId?: string;
  groupId?: string;
  message?: MessageItem;
  unreadCount?: number;
  lastMessage?: string;
  lastMessageTime?: string;
  isRealtime?: boolean;
}) {
  const payload = { ...event, isRealtime: true };
  for (const listener of messageListeners) {
    try {
      listener(payload);
    } catch (err) {}
  }
}

export const messagesRoutes: FastifyPluginAsync = async (fastify) => {
  // 0. Event Stream en Tiempo Real (Server-Sent Events)
  fastify.get("/messages/events", (request, reply) => {
    const tenantId = resolveTenantId(request);

    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("Access-Control-Allow-Origin", "*");
    reply.raw.setHeader("X-Accel-Buffering", "no");
    reply.raw.flushHeaders?.();

    // Evento inicial de confirmación de conexión
    reply.raw.write(`data: ${JSON.stringify({ type: "connected", tenantId, time: new Date().toISOString() })}\n\n`);

    // Latido / Heartbeat cada 25 segundos para mantener viva la conexión
    const heartbeatTimer = setInterval(() => {
      try {
        reply.raw.write(`: heartbeat\n\n`);
      } catch (e) {
        clearInterval(heartbeatTimer);
      }
    }, 25000);

    const listener: MessageListener = (event) => {
      if (!event.tenantId || event.tenantId === tenantId) {
        try {
          reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
        } catch (err) {}
      }
    };

    messageListeners.add(listener);

    request.raw.on("close", () => {
      clearInterval(heartbeatTimer);
      messageListeners.delete(listener);
    });
  });

  // 0.1 Obtener configuración de marca / branding exclusiva para TurboChat
  fastify.get("/messages/branding", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const branding = loadChatBranding(tenantId);
    return reply.send({ success: true, branding });
  });

  // 0.2 Actualizar imagen de la app, nombre y colores exclusivos de TurboChat
  fastify.post("/messages/branding", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const body = (request.body || {}) as Partial<ChatBranding>;
    const current = loadChatBranding(tenantId);
    const updated: ChatBranding = {
      appName: body.appName || current.appName || "TurboChat",
      logoUrl: body.logoUrl !== undefined ? body.logoUrl : current.logoUrl,
      accentColor: body.accentColor || current.accentColor || "#2563eb",
      statusText: body.statusText || current.statusText || "En Línea"
    };
    saveChatBranding(tenantId, updated);
    return reply.send({ success: true, message: "Ajustes de TurboChat guardados con éxito", branding: updated });
  });

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

  // 6. Obtener una conversación específica con historial paginado
  fastify.get("/messages/conversations/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const query = (request.query as { limit?: string; before?: string; all?: string }) || {};

    const list = loadConversationsFromDisk(tenantId);
    const conv = list.find(c => c.id === id);
    if (!conv) {
      return reply.status(404).send({ success: false, message: "Conversación no encontrada" });
    }

    // Marcar como leída
    conv.unreadCount = 0;
    saveConversationsToDisk(tenantId, list);

    const totalMessages = conv.messages.length;
    // Si no se pide all=true, por defecto paginamos a 35 mensajes para máxima fluidez
    const limitNum = query.limit ? parseInt(query.limit, 10) : (query.all === "true" ? 0 : 35);

    let messagesToReturn = conv.messages;
    let hasMore = false;

    if (limitNum > 0 && totalMessages > limitNum) {
      if (query.before) {
        const idx = conv.messages.findIndex(m => m.id === query.before);
        if (idx > 0) {
          const startIdx = Math.max(0, idx - limitNum);
          messagesToReturn = conv.messages.slice(startIdx, idx);
          hasMore = startIdx > 0;
        } else {
          messagesToReturn = [];
          hasMore = false;
        }
      } else {
        const startIdx = Math.max(0, totalMessages - limitNum);
        messagesToReturn = conv.messages.slice(startIdx);
        hasMore = startIdx > 0;
      }
    }

    return reply.send({
      success: true,
      data: {
        ...conv,
        messages: messagesToReturn,
        totalMessages,
        hasMore
      }
    });
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
      else if (attachment.type === 'video') fallbackText = `Video enviado (${attachment.duration || 'Video'})`;
      else if (attachment.type === 'location') fallbackText = attachment.isLive ? 'Ubicación en tiempo real' : 'Ubicación enviada';
      else fallbackText = attachment.name || 'Archivo adjunto';
    }

    const sender = parse.data.sender || "agent";
    const senderName = parse.data.senderName || (sender === "client" ? (conv.name || "Cliente") : "Operador TurboNetwork");

    const newMsg: MessageItem = {
      id: "m-" + Date.now(),
      sender,
      senderName,
      text: fallbackText,
      timestamp: now.toISOString(),
      timeFormatted,
      status: sender === "client" ? "delivered" : "read",
      replyTo: parse.data.replyTo,
      attachment,
    };

    conv.messages.push(newMsg);
    if (sender === "client") {
      conv.unreadCount = (conv.unreadCount || 0) + 1;
    }
    conv.lastMessage = fallbackText;
    conv.lastMessageTime = timeFormatted;
    conv.lastMessageDate = now.toISOString().split("T")[0];
    conv.updatedAt = now.toISOString();

    saveConversationsToDisk(tenantId, list);

    broadcastMessageEvent({
      type: "new_message",
      tenantId,
      conversationId: id,
      message: newMsg,
      unreadCount: conv.unreadCount,
      lastMessage: conv.lastMessage,
      lastMessageTime: conv.lastMessageTime
    });

    // Si el remitente es un operador y el chat tiene teléfono real, despachar copia a WhatsApp
    if (sender === "agent" && conv.phone && !conv.phone.includes("(Interno)")) {
      WhatsAppService.sendMessage(tenantId, {
        to: conv.phone,
        text: fallbackText,
        attachmentUrl: attachment?.url,
        attachmentType: attachment?.type as any,
      }).catch((waErr) => {
        console.warn("Aviso al reenviar mensaje de operador a WhatsApp:", waErr?.message);
      });
    }

    return reply.status(201).send({ success: true, message: "Mensaje enviado", data: newMsg });
  });

  // 7.01 Marcar conversación como leída
  fastify.post("/messages/conversations/:id/read", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };

    const list = loadConversationsFromDisk(tenantId);
    const conv = list.find(c => c.id === id);
    if (!conv) {
      return reply.status(404).send({ success: false, message: "Conversación no encontrada" });
    }

    conv.unreadCount = 0;
    saveConversationsToDisk(tenantId, list);

    broadcastMessageEvent({
      type: "conversation_read",
      tenantId,
      conversationId: id,
      unreadCount: 0
    });

    return reply.send({ success: true, message: "Conversación marcada como leída" });
  });

  // 7.02 Simular mensaje entrante de cliente / técnico (Webhook / Demo / Prueba)
  fastify.post("/messages/conversations/:id/incoming", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as { text?: string; senderName?: string; attachment?: any };

    const list = loadConversationsFromDisk(tenantId);
    const conv = list.find(c => c.id === id);
    if (!conv) {
      return reply.status(404).send({ success: false, message: "Conversación no encontrada" });
    }

    const now = new Date();
    const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const text = body.text || "Hola, quisiera consultar sobre el estado de mi conexión y velocidad.";
    const senderName = body.senderName || conv.name || "Cliente";

    const newMsg: MessageItem = {
      id: "m-" + Date.now(),
      sender: "client",
      senderName,
      text,
      timestamp: now.toISOString(),
      timeFormatted,
      status: "delivered",
      attachment: body.attachment,
    };

    conv.messages.push(newMsg);
    conv.unreadCount = (conv.unreadCount || 0) + 1;
    conv.lastMessage = text;
    conv.lastMessageTime = timeFormatted;
    conv.lastMessageDate = now.toISOString().split("T")[0];
    conv.updatedAt = now.toISOString();

    saveConversationsToDisk(tenantId, list);

    broadcastMessageEvent({
      type: "new_message",
      tenantId,
      conversationId: id,
      message: newMsg,
      unreadCount: conv.unreadCount,
      lastMessage: conv.lastMessage,
      lastMessageTime: conv.lastMessageTime
    });

    return reply.status(201).send({ success: true, message: "Mensaje entrante simulado", data: newMsg });
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

  // ==========================================
  // 11. GESTIÓN Y LIMPIEZA DE ALMACENAMIENTO
  // ==========================================

  // 11.1 Estadísticas de uso de almacenamiento de mensajes y multimedia
  fastify.get("/messages/storage/stats", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const convs = loadConversationsFromDisk(tenantId);
    const comms = loadCommunitiesFromDisk(tenantId);

    let directMessagesCount = 0;
    let communityMessagesCount = 0;
    let imagesCount = 0;
    let videosCount = 0;
    let audiosCount = 0;
    let filesCount = 0;
    let locationsCount = 0;
    let totalBytesEstimated = 0;

    const countAttachment = (m: MessageItem) => {
      if (m.text) totalBytesEstimated += m.text.length * 2;
      if (m.attachment) {
        if (m.attachment.url && m.attachment.url.startsWith("data:")) {
          totalBytesEstimated += m.attachment.url.length;
        } else if (m.attachment.size) {
          totalBytesEstimated += 200000;
        }
        if (m.attachment.thumbnailUrl && m.attachment.thumbnailUrl.startsWith("data:")) {
          totalBytesEstimated += m.attachment.thumbnailUrl.length;
        }
        if (m.attachment.type === "image") imagesCount++;
        else if (m.attachment.type === "video") videosCount++;
        else if (m.attachment.type === "audio") audiosCount++;
        else if (m.attachment.type === "location") locationsCount++;
        else filesCount++;
      }
    };

    for (const c of convs) {
      directMessagesCount += c.messages.length;
      for (const m of c.messages) {
        countAttachment(m);
      }
    }

    for (const comm of comms) {
      for (const g of comm.groups) {
        communityMessagesCount += g.messages.length;
        for (const m of g.messages) {
          countAttachment(m);
        }
      }
    }

    const totalMessages = directMessagesCount + communityMessagesCount;
    const formattedSize = totalBytesEstimated > 1024 * 1024
      ? (totalBytesEstimated / (1024 * 1024)).toFixed(2) + " MB"
      : (totalBytesEstimated / 1024).toFixed(1) + " KB";

    return reply.send({
      success: true,
      tenantId,
      stats: {
        totalConversations: convs.length,
        totalCommunities: comms.length,
        directMessagesCount,
        communityMessagesCount,
        totalMessages,
        attachments: {
          images: imagesCount,
          videos: videosCount,
          audios: audiosCount,
          files: filesCount,
          locations: locationsCount,
          total: imagesCount + videosCount + audiosCount + filesCount + locationsCount,
        },
        storageBytes: totalBytesEstimated,
        formattedSize,
      }
    });
  });

  // 11.2 Limpieza / Depuración de almacenamiento
  fastify.post("/messages/storage/cleanup", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const body = (request.body as {
      action: "prune_older_than" | "prune_media_only" | "prune_deleted" | "reset_all";
      days?: number;
    }) || { action: "prune_deleted" };

    const days = typeof body.days === "number" ? body.days : 30;
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const convs = loadConversationsFromDisk(tenantId);
    const comms = loadCommunitiesFromDisk(tenantId);

    let affectedMessages = 0;
    let freedMediaCount = 0;

    if (body.action === "prune_older_than") {
      // Elimina mensajes anteriores a la fecha de corte
      for (const c of convs) {
        const prevLen = c.messages.length;
        c.messages = c.messages.filter(m => m.timestamp >= cutoffDate);
        affectedMessages += prevLen - c.messages.length;
        if (c.messages.length > 0) {
          c.lastMessage = c.messages[c.messages.length - 1].text;
        }
      }
      for (const comm of comms) {
        for (const g of comm.groups) {
          const prevLen = g.messages.length;
          g.messages = g.messages.filter(m => m.timestamp >= cutoffDate);
          affectedMessages += prevLen - g.messages.length;
          if (g.messages.length > 0) {
            g.lastMessage = g.messages[g.messages.length - 1].text;
          }
        }
      }
    } else if (body.action === "prune_media_only") {
      // Mantiene el texto pero libera el peso de multimedia antigua
      for (const c of convs) {
        for (const m of c.messages) {
          if (m.timestamp < cutoffDate && m.attachment && (m.attachment.url || m.attachment.thumbnailUrl)) {
            delete m.attachment.url;
            delete m.attachment.thumbnailUrl;
            m.text = m.text ? `${m.text} [Multimedia purgada]` : `[Archivo purgado (${m.attachment.name || m.attachment.type})]`;
            freedMediaCount++;
          }
        }
      }
      for (const comm of comms) {
        for (const g of comm.groups) {
          for (const m of g.messages) {
            if (m.timestamp < cutoffDate && m.attachment && (m.attachment.url || m.attachment.thumbnailUrl)) {
              delete m.attachment.url;
              delete m.attachment.thumbnailUrl;
              m.text = m.text ? `${m.text} [Multimedia purgada]` : `[Archivo purgado (${m.attachment.name || m.attachment.type})]`;
              freedMediaCount++;
            }
          }
        }
      }
    } else if (body.action === "prune_deleted") {
      // Purga mensajes marcados como eliminados
      for (const c of convs) {
        const prevLen = c.messages.length;
        c.messages = c.messages.filter(m => !m.isDeletedForEveryone);
        affectedMessages += prevLen - c.messages.length;
      }
      for (const comm of comms) {
        for (const g of comm.groups) {
          const prevLen = g.messages.length;
          g.messages = g.messages.filter(m => !m.isDeletedForEveryone);
          affectedMessages += prevLen - g.messages.length;
        }
      }
    } else if (body.action === "reset_all") {
      for (const c of convs) {
        affectedMessages += c.messages.length;
        c.messages = [];
        c.lastMessage = "Historial reiniciado";
      }
      for (const comm of comms) {
        for (const g of comm.groups) {
          affectedMessages += g.messages.length;
          g.messages = [];
          g.lastMessage = "Historial reiniciado";
        }
      }
    }

    saveConversationsToDisk(tenantId, convs);
    saveCommunitiesToDisk(tenantId, comms);

    return reply.send({
      success: true,
      message: `Limpieza ejecutada exitosamente (${affectedMessages || freedMediaCount} elementos procesados).`,
      affectedMessages,
      freedMediaCount,
    });
  });

  // ==========================================
  // 12. COMUNIDADES Y GRUPOS (CHANNELS)
  // ==========================================

  // 12.1 Listar todas las comunidades con resumen de grupos
  fastify.get("/messages/communities", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const communities = loadCommunitiesFromDisk(tenantId);

    // Mapeo ligero sin arrays de mensajes pesados para listar al instante
    const lightList = communities.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description,
      avatarUrl: c.avatarUrl,
      coverImage: c.coverImage,
      type: c.type,
      linkedNaps: c.linkedNaps || [],
      linkedZones: c.linkedZones || [],
      memberCount: c.memberCount || 0,
      createdAt: c.createdAt,
      groups: c.groups.map(g => ({
        id: g.id,
        communityId: g.communityId,
        name: g.name,
        description: g.description,
        type: g.type,
        isReadOnly: g.isReadOnly,
        icon: g.icon,
        unreadCount: g.unreadCount || 0,
        lastMessage: g.lastMessage || "Sin mensajes",
        lastMessageTime: g.lastMessageTime || "",
        messageCount: g.messages.length,
      })),
    }));

    return reply.send({ success: true, tenantId, count: lightList.length, data: lightList });
  });

  // 12.2 Crear nueva comunidad
  fastify.post("/messages/communities", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const body = (request.body as {
      name: string;
      description?: string;
      avatarUrl?: string;
      coverImage?: string;
      type?: "zone" | "building" | "custom";
      linkedNaps?: string[];
      linkedZones?: string[];
      memberCount?: number;
    }) || {};

    if (!body.name || !body.name.trim()) {
      return reply.status(400).send({ success: false, message: "El nombre de la comunidad es obligatorio" });
    }

    const communities = loadCommunitiesFromDisk(tenantId);
    const commId = "comm-" + Date.now();
    const now = new Date();
    const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newCommunity: Community = {
      id: commId,
      tenantId,
      name: body.name.trim(),
      description: body.description?.trim() || "Comunidad de telecomunicaciones TurboNetwork",
      avatarUrl: body.avatarUrl || `https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=150&auto=format&fit=crop&q=80`,
      coverImage: body.coverImage || `https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&auto=format&fit=crop&q=80`,
      type: body.type || "zone",
      linkedNaps: body.linkedNaps || [],
      linkedZones: body.linkedZones || [],
      memberCount: body.memberCount || 1,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      groups: [
        {
          id: `grp-${commId}-1`,
          communityId: commId,
          name: "📢 Avisos Oficiales",
          description: "Canal de difusión exclusiva del ISP para avisos y mantenimiento.",
          type: "announcements",
          isReadOnly: true,
          unreadCount: 0,
          lastMessage: "Canal de avisos inaugurado",
          lastMessageTime: timeFormatted,
          messages: [
            {
              id: "gm-" + Date.now(),
              sender: "system",
              senderName: "Sistema TurboNetwork",
              text: `Canal oficial de avisos de ${body.name.trim()} activado.`,
              timestamp: now.toISOString(),
              timeFormatted,
              status: "read",
            }
          ],
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
        {
          id: `grp-${commId}-2`,
          communityId: commId,
          name: "🛠️ Soporte Técnico",
          description: "Canal bidireccional para reportes y ayuda de servicio.",
          type: "support",
          isReadOnly: false,
          unreadCount: 0,
          lastMessage: "Canal de soporte disponible",
          lastMessageTime: timeFormatted,
          messages: [],
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
        {
          id: `grp-${commId}-3`,
          communityId: commId,
          name: "💬 Comunidad General",
          description: "Espacio de conversación para los miembros del sector.",
          type: "general",
          isReadOnly: false,
          unreadCount: 0,
          lastMessage: "Bienvenidos a la comunidad",
          lastMessageTime: timeFormatted,
          messages: [],
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        }
      ]
    };

    communities.unshift(newCommunity);
    saveCommunitiesToDisk(tenantId, communities);

    return reply.status(201).send({ success: true, message: "Comunidad creada exitosamente", data: newCommunity });
  });

  // 12.3 Actualizar comunidad
  fastify.put("/messages/communities/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const body = request.body as Partial<Community>;

    const communities = loadCommunitiesFromDisk(tenantId);
    const comm = communities.find(c => c.id === id);
    if (!comm) {
      return reply.status(404).send({ success: false, message: "Comunidad no encontrada" });
    }

    if (body.name) comm.name = body.name.trim();
    if (body.description) comm.description = body.description.trim();
    if (body.avatarUrl) comm.avatarUrl = body.avatarUrl;
    if (body.coverImage) comm.coverImage = body.coverImage;
    if (body.type) comm.type = body.type;
    if (Array.isArray(body.linkedNaps)) comm.linkedNaps = body.linkedNaps;
    if (Array.isArray(body.linkedZones)) comm.linkedZones = body.linkedZones;
    if (typeof body.memberCount === "number") comm.memberCount = body.memberCount;
    comm.updatedAt = new Date().toISOString();

    saveCommunitiesToDisk(tenantId, communities);
    return reply.send({ success: true, message: "Comunidad actualizada", data: comm });
  });

  // 12.4 Eliminar comunidad
  fastify.delete("/messages/communities/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };

    const communities = loadCommunitiesFromDisk(tenantId);
    const idx = communities.findIndex(c => c.id === id);
    if (idx === -1) {
      return reply.status(404).send({ success: false, message: "Comunidad no encontrada" });
    }

    const deleted = communities.splice(idx, 1)[0];
    saveCommunitiesToDisk(tenantId, communities);
    return reply.send({ success: true, message: "Comunidad eliminada con éxito", data: deleted });
  });

  // 12.5 Agregar nuevo canal/grupo a una comunidad
  fastify.post("/messages/communities/:id/groups", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const body = (request.body as {
      name: string;
      description?: string;
      type?: "announcements" | "support" | "billing" | "general";
      isReadOnly?: boolean;
    }) || {};

    if (!body.name || !body.name.trim()) {
      return reply.status(400).send({ success: false, message: "El nombre del canal es obligatorio" });
    }

    const communities = loadCommunitiesFromDisk(tenantId);
    const comm = communities.find(c => c.id === id);
    if (!comm) {
      return reply.status(404).send({ success: false, message: "Comunidad no encontrada" });
    }

    const now = new Date();
    const type = body.type || "general";
    const isReadOnly = type === "announcements" ? true : (body.isReadOnly ?? false);

    const newGroup: CommunityGroup = {
      id: `grp-${id}-${Date.now().toString().slice(-4)}`,
      communityId: id,
      name: body.name.trim(),
      description: body.description?.trim() || "",
      type,
      isReadOnly,
      unreadCount: 0,
      lastMessage: "Canal creado",
      lastMessageTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      messages: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    comm.groups.push(newGroup);
    comm.updatedAt = now.toISOString();
    saveCommunitiesToDisk(tenantId, communities);

    return reply.status(201).send({ success: true, message: "Canal creado exitosamente", data: newGroup });
  });

  // 12.6 Eliminar canal/grupo de una comunidad
  fastify.delete("/messages/communities/:id/groups/:groupId", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id, groupId } = request.params as { id: string; groupId: string };

    const communities = loadCommunitiesFromDisk(tenantId);
    const comm = communities.find(c => c.id === id);
    if (!comm) {
      return reply.status(404).send({ success: false, message: "Comunidad no encontrada" });
    }

    const grpIdx = comm.groups.findIndex(g => g.id === groupId);
    if (grpIdx === -1) {
      return reply.status(404).send({ success: false, message: "Canal no encontrado" });
    }

    const deleted = comm.groups.splice(grpIdx, 1)[0];
    comm.updatedAt = new Date().toISOString();
    saveCommunitiesToDisk(tenantId, communities);

    return reply.send({ success: true, message: "Canal eliminado", data: deleted });
  });

  // 12.7 Obtener historial paginado de un canal/grupo
  fastify.get("/messages/communities/:id/groups/:groupId", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id, groupId } = request.params as { id: string; groupId: string };
    const query = (request.query as { limit?: string; before?: string; all?: string }) || {};

    const communities = loadCommunitiesFromDisk(tenantId);
    const comm = communities.find(c => c.id === id);
    if (!comm) {
      return reply.status(404).send({ success: false, message: "Comunidad no encontrada" });
    }

    const group = comm.groups.find(g => g.id === groupId);
    if (!group) {
      return reply.status(404).send({ success: false, message: "Canal no encontrado" });
    }

    group.unreadCount = 0;
    saveCommunitiesToDisk(tenantId, communities);

    const totalMessages = group.messages.length;
    const limitNum = query.limit ? parseInt(query.limit, 10) : (query.all === "true" ? 0 : 35);

    let messagesToReturn = group.messages;
    let hasMore = false;

    if (limitNum > 0 && totalMessages > limitNum) {
      if (query.before) {
        const idx = group.messages.findIndex(m => m.id === query.before);
        if (idx > 0) {
          const startIdx = Math.max(0, idx - limitNum);
          messagesToReturn = group.messages.slice(startIdx, idx);
          hasMore = startIdx > 0;
        } else {
          messagesToReturn = [];
          hasMore = false;
        }
      } else {
        const startIdx = Math.max(0, totalMessages - limitNum);
        messagesToReturn = group.messages.slice(startIdx);
        hasMore = startIdx > 0;
      }
    }

    return reply.send({
      success: true,
      data: {
        communityId: comm.id,
        communityName: comm.name,
        communityAvatar: comm.avatarUrl,
        memberCount: comm.memberCount,
        group: {
          ...group,
          messages: messagesToReturn,
          totalMessages,
          hasMore,
        }
      }
    });
  });

  // 12.8 Enviar mensaje a un canal/grupo
  fastify.post("/messages/communities/:id/groups/:groupId/messages", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id, groupId } = request.params as { id: string; groupId: string };
    const parse = sendMessageSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, errors: parse.error.format() });
    }

    const communities = loadCommunitiesFromDisk(tenantId);
    const comm = communities.find(c => c.id === id);
    if (!comm) {
      return reply.status(404).send({ success: false, message: "Comunidad no encontrada" });
    }

    const group = comm.groups.find(g => g.id === groupId);
    if (!group) {
      return reply.status(404).send({ success: false, message: "Canal no encontrado" });
    }

    const now = new Date();
    const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const attachment = parse.data.attachment;
    let fallbackText = parse.data.text || "";
    if (!fallbackText && attachment) {
      if (attachment.type === 'audio') fallbackText = `Nota de voz (${attachment.duration || '0:05'})`;
      else if (attachment.type === 'image') fallbackText = 'Foto enviada';
      else if (attachment.type === 'video') fallbackText = `Video enviado (${attachment.duration || 'Video'})`;
      else if (attachment.type === 'location') fallbackText = attachment.isLive ? 'Ubicación en tiempo real' : 'Ubicación enviada';
      else fallbackText = attachment.name || 'Archivo adjunto';
    }

    const newMsg: MessageItem = {
      id: "gm-" + Date.now(),
      sender: "agent",
      senderName: group.type === "announcements" ? "NOC TurboNetwork Oficial" : "Operador TurboNetwork",
      text: fallbackText,
      timestamp: now.toISOString(),
      timeFormatted,
      status: "read",
      replyTo: parse.data.replyTo,
      attachment,
    };

    group.messages.push(newMsg);
    group.lastMessage = fallbackText;
    group.lastMessageTime = timeFormatted;
    group.updatedAt = now.toISOString();
    comm.updatedAt = now.toISOString();

    saveCommunitiesToDisk(tenantId, communities);

    broadcastMessageEvent({
      type: "community_message",
      tenantId,
      communityId: id,
      groupId,
      message: newMsg,
      lastMessage: fallbackText,
      lastMessageTime: timeFormatted
    });

    return reply.status(201).send({ success: true, message: "Mensaje publicado en canal", data: newMsg });
  });

  // 12.9 Reaccionar a un mensaje de canal/grupo
  fastify.post("/messages/communities/:id/groups/:groupId/messages/:msgId/reaction", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id, groupId, msgId } = request.params as { id: string; groupId: string; msgId: string };
    const { emoji } = (request.body as { emoji: string }) || {};
    if (!emoji) {
      return reply.status(400).send({ success: false, message: "Emoji requerido" });
    }

    const communities = loadCommunitiesFromDisk(tenantId);
    const comm = communities.find(c => c.id === id);
    if (!comm) return reply.status(404).send({ success: false, message: "Comunidad no encontrada" });

    const group = comm.groups.find(g => g.id === groupId);
    if (!group) return reply.status(404).send({ success: false, message: "Canal no encontrado" });

    const msg = group.messages.find(m => m.id === msgId);
    if (!msg) return reply.status(404).send({ success: false, message: "Mensaje no encontrado" });

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

    group.updatedAt = new Date().toISOString();
    saveCommunitiesToDisk(tenantId, communities);

    return reply.send({ success: true, reactions: msg.reactions, message: "Reacción guardada" });
  });
};

