import fs from "fs";
import path from "path";
import { loadConnectionsConfig, EvolutionSettings, MetaSettings } from "../settings/connections.service";
import { getTenantFilePath } from "../tenants/tenants.service";
import { Conversation, MessageItem, broadcastMessageEvent, getFormattedTime } from "./messages.routes";
import { loadTenantCustomers } from "../customers/customers.routes";

export function cleanPhoneNumber(rawPhone: string): string {
  if (!rawPhone) return "";
  // Quitar espacios, guiones, paréntesis y signos
  let clean = rawPhone.replace(/[^\d]/g, "");

  // Si tiene 9 dígitos (formato estándar móvil en Perú: 9XXXXXXXX), anteponer prefijo de país 51
  if (clean.length === 9 && clean.startsWith("9")) {
    clean = "51" + clean;
  }
  return clean;
}

export interface SendWhatsAppResult {
  success: boolean;
  provider: "evolution" | "meta" | "none";
  messageId?: string;
  error?: string;
  rawResponse?: any;
}

export class WhatsAppService {
  /**
   * Enviar mensaje de WhatsApp usando el proveedor configurado (Evolution API o Meta Cloud API)
   */
  static async sendMessage(
    tenantId: string,
    options: {
      to: string;
      text: string;
      attachmentUrl?: string;
      attachmentType?: "image" | "document" | "audio" | "video";
      caption?: string;
    }
  ): Promise<SendWhatsAppResult> {
    const config = loadConnectionsConfig(tenantId);
    const waConfig = config.whatsapp;
    if (!waConfig) {
      return { success: false, provider: "none", error: "Módulo WhatsApp no configurado" };
    }

    const cleanPhone = cleanPhoneNumber(options.to);
    if (!cleanPhone) {
      return { success: false, provider: "none", error: "Número de teléfono inválido" };
    }

    const activeProvider = waConfig.activeProvider || "evolution";

    // Intentar primero con el proveedor activo
    if (activeProvider === "evolution" && waConfig.evolution?.enabled) {
      const evoRes = await this.sendViaEvolution(waConfig.evolution, cleanPhone, options);
      if (evoRes.success || waConfig.provider !== "both") {
        return evoRes;
      }
      // Fallback a Meta si provider es 'both'
      if (waConfig.meta?.enabled) {
        return this.sendViaMeta(waConfig.meta, cleanPhone, options);
      }
      return evoRes;
    }

    if (activeProvider === "meta" && waConfig.meta?.enabled) {
      const metaRes = await this.sendViaMeta(waConfig.meta, cleanPhone, options);
      if (metaRes.success || waConfig.provider !== "both") {
        return metaRes;
      }
      // Fallback a Evolution si provider es 'both'
      if (waConfig.evolution?.enabled) {
        return this.sendViaEvolution(waConfig.evolution, cleanPhone, options);
      }
      return metaRes;
    }

    // Si ninguno de los anteriores fue disparado, revisar si alguno está habilitado
    if (waConfig.evolution?.enabled) {
      return this.sendViaEvolution(waConfig.evolution, cleanPhone, options);
    }
    if (waConfig.meta?.enabled) {
      return this.sendViaMeta(waConfig.meta, cleanPhone, options);
    }

    return {
      success: false,
      provider: "none",
      error: "No hay ningún proveedor de WhatsApp habilitado en Ajustes de Conexión.",
    };
  }

  /**
   * Envío a través de Evolution API / WAHA (Sesión por código QR)
   */
  private static async sendViaEvolution(
    evoConfig: EvolutionSettings,
    cleanPhone: string,
    options: { text: string; attachmentUrl?: string; attachmentType?: string; caption?: string }
  ): Promise<SendWhatsAppResult> {
    const baseUrl = (evoConfig.apiUrl || "http://localhost:8080").replace(/\/$/, "");
    const instance = evoConfig.instanceName || "turbonetwork";

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      let url = `${baseUrl}/message/sendText/${encodeURIComponent(instance)}`;
      let body: any = {
        number: cleanPhone,
        text: options.text,
      };

      if (options.attachmentUrl) {
        url = `${baseUrl}/message/sendMedia/${encodeURIComponent(instance)}`;
        body = {
          number: cleanPhone,
          mediaMessage: {
            mediatype: options.attachmentType || "image",
            media: options.attachmentUrl,
            caption: options.caption || options.text,
          },
        };
      }

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: evoConfig.apiKey || "",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        return {
          success: true,
          provider: "evolution",
          messageId: data?.key?.id || data?.id || `evo-${Date.now()}`,
          rawResponse: data,
        };
      } else {
        return {
          success: false,
          provider: "evolution",
          error: data?.message || data?.error || `Error HTTP ${res.status} desde Evolution API`,
          rawResponse: data,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        provider: "evolution",
        error: `Fallo al conectar con Evolution API (${baseUrl}): ${err.message}`,
      };
    }
  }

  /**
   * Envío a través de Meta Cloud API Oficial (WhatsApp Business Platform)
   */
  private static async sendViaMeta(
    metaConfig: MetaSettings,
    cleanPhone: string,
    options: { text: string; attachmentUrl?: string; attachmentType?: string; caption?: string }
  ): Promise<SendWhatsAppResult> {
    const phoneNumberId = metaConfig.phoneNumberId;
    if (!phoneNumberId || !metaConfig.accessToken) {
      return {
        success: false,
        provider: "meta",
        error: "Credenciales de Meta Cloud API incompletas (Falta Phone Number ID o Access Token)",
      };
    }

    const url = `https://graph.facebook.com/v20.0/${encodeURIComponent(phoneNumberId)}/messages`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      let body: any = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanPhone,
      };

      if (options.attachmentUrl) {
        const type = options.attachmentType || "image";
        body.type = type;
        body[type] = {
          link: options.attachmentUrl,
          caption: options.caption || options.text,
        };
      } else {
        body.type = "text";
        body.text = { body: options.text, preview_url: true };
      }

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${metaConfig.accessToken}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await res.json().catch(() => ({}));

      if (res.ok && data?.messages?.[0]?.id) {
        return {
          success: true,
          provider: "meta",
          messageId: data.messages[0].id,
          rawResponse: data,
        };
      } else {
        const errDetail = data?.error?.message || `HTTP ${res.status}`;
        return {
          success: false,
          provider: "meta",
          error: `Error de Meta API: ${errDetail}`,
          rawResponse: data,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        provider: "meta",
        error: `Fallo al conectar con Meta Cloud API: ${err.message}`,
      };
    }
  }

  /**
   * Verificar estado y obtener código QR de Evolution API / WAHA
   */
  static async getEvolutionQr(
    tenantId: string,
    overrides?: {
      apiUrl?: string;
      apiKey?: string;
      instanceName?: string;
      demo?: boolean;
    }
  ): Promise<{
    success: boolean;
    status: "connected" | "disconnected" | "qrcode" | "error" | "server_offline";
    qrcode?: string;
    pairingCode?: string;
    message: string;
    details?: string;
    apiUrl?: string;
    instance?: string;
  }> {
    // Modo demostración / diagnóstico para pruebas de interfaz y renderizado
    if (overrides?.demo) {
      const demoPayload = `turbonetwork:demo:${tenantId}:${Date.now()}`;
      const demoQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=${encodeURIComponent(demoPayload)}`;
      return {
        success: true,
        status: "qrcode",
        qrcode: demoQrUrl,
        pairingCode: "TURBO-DEMO",
        apiUrl: overrides.apiUrl || "demo",
        instance: overrides.instanceName || "turbonetwork",
        message: "Código QR de demostración generado con éxito.",
      };
    }

    const config = loadConnectionsConfig(tenantId);
    const evo = config.whatsapp?.evolution;

    const baseUrl = (overrides?.apiUrl || evo?.apiUrl || "http://localhost:8080").trim().replace(/\/$/, "");
    const apiKey = (overrides?.apiKey !== undefined ? overrides.apiKey : evo?.apiKey || "").trim();
    const instance = (overrides?.instanceName || evo?.instanceName || "turbonetwork").trim();

    if (!baseUrl) {
      return {
        success: false,
        status: "error",
        apiUrl: baseUrl,
        instance,
        message: "URL de Evolution API no configurada en Ajustes.",
      };
    }

    // 1. Probar conectividad con el servidor Evolution API / WAHA (Health Check)
    let isServerReachable = false;
    try {
      const pingCtrl = new AbortController();
      const pingTimer = setTimeout(() => pingCtrl.abort(), 3500);

      // Verificamos si responde el endpoint de instancias o la raíz
      const pingRes = await fetch(`${baseUrl}/instance/fetchInstances`, {
        headers: apiKey ? { apikey: apiKey } : {},
        signal: pingCtrl.signal,
      }).catch(async () => {
        // Fallback a consultar raíz o WAHA
        const wahaCtrl = new AbortController();
        const wahaTimer = setTimeout(() => wahaCtrl.abort(), 2000);
        return fetch(`${baseUrl}/`, { signal: wahaCtrl.signal }).catch(() => null);
      });

      clearTimeout(pingTimer);
      if (pingRes) {
        isServerReachable = true;
      }
    } catch {
      isServerReachable = false;
    }

    if (!isServerReachable) {
      return {
        success: false,
        status: "server_offline",
        apiUrl: baseUrl,
        instance,
        message: `Servidor de WhatsApp no detectado en ${baseUrl}`,
        details: "No se pudo conectar a la dirección indicada. Verifica que el contenedor Docker o servicio de Evolution API / WAHA esté en ejecución y el puerto sea accesible.",
      };
    }

    // 2. Si el servidor responde, verificar estado de conexión de la instancia
    try {
      const stateCtrl = new AbortController();
      const stateTimer = setTimeout(() => stateCtrl.abort(), 4500);

      const stateRes = await fetch(`${baseUrl}/instance/connectionState/${encodeURIComponent(instance)}`, {
        headers: apiKey ? { apikey: apiKey } : {},
        signal: stateCtrl.signal,
      }).catch(() => null);

      clearTimeout(stateTimer);

      if (stateRes && stateRes.ok) {
        const stateData = await stateRes.json().catch(() => ({}));
        const state = stateData?.instance?.state || stateData?.state;
        if (state === "open" || state === "connected") {
          return {
            success: true,
            status: "connected",
            apiUrl: baseUrl,
            instance,
            message: `Instancia '${instance}' conectada y operativa en WhatsApp.`,
          };
        }
      }

      // 3. Si la instancia no existe aún (HTTP 404), crearla automáticamente en Evolution API
      if (stateRes && stateRes.status === 404) {
        try {
          const createCtrl = new AbortController();
          const createTimer = setTimeout(() => createCtrl.abort(), 6000);

          const createRes = await fetch(`${baseUrl}/instance/create`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(apiKey ? { apikey: apiKey } : {}),
            },
            body: JSON.stringify({
              instanceName: instance,
              token: apiKey || instance,
              qrcode: true,
              integration: "WHATSAPP-BAILEYS",
            }),
            signal: createCtrl.signal,
          });

          clearTimeout(createTimer);

          if (createRes.ok) {
            const createData = await createRes.json().catch(() => ({}));
            const rawQr = createData?.qrcode?.base64 || createData?.base64 || createData?.qrcode?.code || createData?.code;
            const pairingCode = createData?.pairingCode;

            if (rawQr) {
              const qrcode = rawQr.startsWith("data:")
                ? rawQr
                : rawQr.startsWith("http")
                ? rawQr
                : rawQr.length > 200
                ? `data:image/png;base64,${rawQr}`
                : `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=${encodeURIComponent(rawQr)}`;

              return {
                success: true,
                status: "qrcode",
                qrcode,
                pairingCode,
                apiUrl: baseUrl,
                instance,
                message: "Instancia creada en Evolution API. Escanea el código QR desde WhatsApp.",
              };
            }
          }
        } catch {
          // continuar con el flujo normal de connect
        }
      }

      // 4. Solicitar el QR de conexión
      const qrCtrl = new AbortController();
      const qrTimer = setTimeout(() => qrCtrl.abort(), 6000);

      const qrRes = await fetch(`${baseUrl}/instance/connect/${encodeURIComponent(instance)}`, {
        headers: apiKey ? { apikey: apiKey } : {},
        signal: qrCtrl.signal,
      }).catch(() => null);

      clearTimeout(qrTimer);

      if (qrRes && qrRes.ok) {
        const qrData = await qrRes.json().catch(() => ({}));
        const rawQr = qrData?.base64 || qrData?.qrcode?.base64 || qrData?.code || qrData?.qrcode?.code;
        const pairingCode = qrData?.pairingCode;

        if (rawQr) {
          const qrcode = rawQr.startsWith("data:")
            ? rawQr
            : rawQr.startsWith("http")
            ? rawQr
            : rawQr.length > 200
            ? `data:image/png;base64,${rawQr}`
            : `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=${encodeURIComponent(rawQr)}`;

          return {
            success: true,
            status: "qrcode",
            qrcode,
            pairingCode,
            apiUrl: baseUrl,
            instance,
            message: "Código QR generado. Escanea desde WhatsApp en tu teléfono móvil.",
          };
        }
      }

      // 5. Fallback para WAHA (WhatsApp HTTP API)
      try {
        const wahaRes = await fetch(`${baseUrl}/api/default/auth/qr`, { signal: AbortSignal.timeout(4000) }).catch(() => null);
        if (wahaRes && wahaRes.ok) {
          const contentType = wahaRes.headers.get("content-type") || "";
          if (contentType.includes("image")) {
            const buf = await wahaRes.arrayBuffer();
            const b64 = Buffer.from(buf).toString("base64");
            return {
              success: true,
              status: "qrcode",
              qrcode: `data:image/png;base64,${b64}`,
              apiUrl: baseUrl,
              instance,
              message: "Código QR obtenido de WAHA. Escanea desde WhatsApp.",
            };
          }
        }
      } catch {}

      return {
        success: false,
        status: "disconnected",
        apiUrl: baseUrl,
        instance,
        message: `Instancia '${instance}' no conectada en Evolution API.`,
        details: "El servidor respondió pero no entregó código QR activo. Reintenta en unos instantes o revisa los logs de Evolution API.",
      };
    } catch (err: any) {
      return {
        success: false,
        status: "error",
        apiUrl: baseUrl,
        instance,
        message: `Error al comunicar con Evolution API: ${err.message}`,
      };
    }
  }

  /**
   * Probar credenciales de Meta Cloud API
   */
  static async testMetaCredentials(metaConfig: MetaSettings): Promise<{
    success: boolean;
    displayPhoneNumber?: string;
    verifiedName?: string;
    qualityRating?: string;
    message: string;
  }> {
    if (!metaConfig.phoneNumberId || !metaConfig.accessToken) {
      return {
        success: false,
        message: "Debe ingresar el Phone Number ID y el Access Token de Meta.",
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const url = `https://graph.facebook.com/v20.0/${encodeURIComponent(metaConfig.phoneNumberId)}?fields=verified_name,code_verification_status,display_phone_number,quality_rating`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${metaConfig.accessToken}` },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await res.json().catch(() => ({}));

      if (res.ok && (data.display_phone_number || data.verified_name)) {
        return {
          success: true,
          displayPhoneNumber: data.display_phone_number,
          verifiedName: data.verified_name,
          qualityRating: data.quality_rating,
          message: `¡Meta API conectada exitosamente! Número verificado: ${data.display_phone_number || "Registrado"} (${data.verified_name || "TurboNetwork"}).`,
        };
      } else {
        const errorMsg = data?.error?.message || `HTTP ${res.status}`;
        return {
          success: false,
          message: `Error retornado por Meta: ${errorMsg}`,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: `Fallo al conectar con servidores de Meta: ${err.message}`,
      };
    }
  }

  /**
   * Procesador universal de Webhook entrante de WhatsApp (soporta Evolution API y Meta Cloud API)
   */
  static async processInboundWebhook(
    tenantId: string,
    rawPayload: any
  ): Promise<{ success: boolean; handled: boolean; conversationId?: string; messageId?: string; detail?: string }> {
    if (!rawPayload || typeof rawPayload !== "object") {
      return { success: false, handled: false, detail: "Payload vacío" };
    }

    let fromPhone = "";
    let senderName = "";
    let messageText = "";
    let attachment: any = undefined;

    // ========================================================
    // CASO 1: Formato Meta Cloud API Oficial
    // ========================================================
    if (rawPayload.object === "whatsapp_business_account" || Array.isArray(rawPayload.entry)) {
      try {
        const entry = rawPayload.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;
        const msg = value?.messages?.[0];
        const contact = value?.contacts?.[0];

        if (!msg) {
          // Puede ser evento de estado (delivered, read, sent), retornamos handled sin error
          return { success: true, handled: true, detail: "Evento de estado Meta procesado" };
        }

        fromPhone = msg.from || "";
        senderName = contact?.profile?.name || "Cliente WhatsApp";

        if (msg.type === "text") {
          messageText = msg.text?.body || "";
        } else if (msg.type === "image") {
          messageText = msg.image?.caption || "Foto recibida por WhatsApp";
          attachment = { type: "image", mimeType: msg.image?.mime_type, url: msg.image?.id };
        } else if (msg.type === "audio" || msg.type === "voice") {
          messageText = "Nota de voz recibida";
          attachment = { type: "audio", mimeType: msg.audio?.mime_type };
        } else if (msg.type === "document") {
          messageText = msg.document?.filename || "Documento recibido";
          attachment = { type: "file", name: msg.document?.filename, mimeType: msg.document?.mime_type };
        } else if (msg.type === "location") {
          messageText = `Ubicación compartida: ${msg.location?.name || ""}`;
          attachment = {
            type: "location",
            lat: msg.location?.latitude,
            lng: msg.location?.longitude,
            address: msg.location?.address,
          };
        } else {
          messageText = `Mensaje de WhatsApp (${msg.type || "desconocido"})`;
        }
      } catch (err: any) {
        return { success: false, handled: false, detail: `Error parseando Meta payload: ${err.message}` };
      }
    }

    // ========================================================
    // CASO 2: Formato Evolution API / WAHA
    // ========================================================
    else if (rawPayload.event === "messages.upsert" || rawPayload.data?.key?.remoteJid || rawPayload.key?.remoteJid) {
      try {
        const item = rawPayload.data || rawPayload;
        const key = item.key || {};

        // Ignorar mensajes enviados por nosotros mismos (fromMe = true)
        if (key.fromMe) {
          return { success: true, handled: true, detail: "Mensaje propio ignorado" };
        }

        const remoteJid = key.remoteJid || "";
        // remoteJid tiene formato "51987654321@s.whatsapp.net" o "xxx@g.us"
        if (remoteJid.endsWith("@g.us")) {
          // Ignorar mensajes de grupos externos no vinculados si se desea
        }

        fromPhone = remoteJid.replace(/@.*$/, "");
        senderName = item.pushName || "Cliente WhatsApp";

        const msgContent = item.message || {};
        if (msgContent.conversation) {
          messageText = msgContent.conversation;
        } else if (msgContent.extendedTextMessage?.text) {
          messageText = msgContent.extendedTextMessage.text;
        } else if (msgContent.imageMessage) {
          messageText = msgContent.imageMessage.caption || "Foto recibida por WhatsApp";
          attachment = { type: "image", mimeType: msgContent.imageMessage.mimetype };
        } else if (msgContent.audioMessage) {
          messageText = "Nota de voz recibida";
          attachment = { type: "audio", duration: `${msgContent.audioMessage.seconds || 5}s` };
        } else if (msgContent.documentMessage) {
          messageText = msgContent.documentMessage.fileName || "Documento recibido";
          attachment = { type: "file", name: msgContent.documentMessage.fileName };
        } else if (msgContent.locationMessage) {
          messageText = "Ubicación compartida";
          attachment = {
            type: "location",
            lat: msgContent.locationMessage.degreesLatitude,
            lng: msgContent.locationMessage.degreesLongitude,
          };
        } else {
          messageText = "Nuevo mensaje de WhatsApp";
        }
      } catch (err: any) {
        return { success: false, handled: false, detail: `Error parseando Evolution payload: ${err.message}` };
      }
    }

    // ========================================================
    // CASO 3: Formato Genérico Simple / Webhook directo
    // ========================================================
    else if (rawPayload.phone || rawPayload.from || rawPayload.number) {
      fromPhone = String(rawPayload.phone || rawPayload.from || rawPayload.number);
      senderName = rawPayload.name || rawPayload.senderName || "Contacto WhatsApp";
      messageText = rawPayload.text || rawPayload.message || "Mensaje recibido";
      attachment = rawPayload.attachment;
    }

    fromPhone = cleanPhoneNumber(fromPhone);
    if (!fromPhone || !messageText) {
      return { success: false, handled: false, detail: "No se identificó número de origen o texto" };
    }

    // ========================================================
    // INSERTAR EN TURBOCHAT & VINCULAR CON CLIENTE
    // ========================================================
    return this.ingestIncomingMessage(tenantId, {
      phone: fromPhone,
      senderName,
      text: messageText,
      attachment,
    });
  }

  /**
   * Inserta un mensaje entrante en la bandeja de TurboChat, cruza datos con clientes y emite SSE
   */
  static ingestIncomingMessage(
    tenantId: string,
    data: {
      phone: string;
      senderName?: string;
      text: string;
      attachment?: any;
    }
  ): { success: boolean; handled: boolean; conversationId?: string; messageId?: string } {
    const cleanPhone = cleanPhoneNumber(data.phone);
    const filePath = getTenantFilePath(tenantId, "messages.json");
    let conversations: Conversation[] = [];

    try {
      if (fs.existsSync(filePath)) {
        conversations = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      }
    } catch (e) {
      conversations = [];
    }

    // Buscar si existe cliente en la base de datos de TurboNetwork con este teléfono
    const customers = loadTenantCustomers(tenantId);
    const matchedCustomer = customers.find((c: any) => {
      if (!c.phone) return false;
      const cPhone = cleanPhoneNumber(c.phone);
      return cPhone.endsWith(cleanPhone) || cleanPhone.endsWith(cPhone);
    });

    // Buscar si ya existe una conversación abierta para este teléfono
    let conv = conversations.find((c) => {
      const convPhone = cleanPhoneNumber(c.phone || "");
      return convPhone.endsWith(cleanPhone) || cleanPhone.endsWith(convPhone);
    });

    const now = new Date();
    const timeFormatted = getFormattedTime(now);
    const msgId = "wa-" + Date.now() + "-" + Math.random().toString(36).substring(2, 5);

    const newMsg: MessageItem = {
      id: msgId,
      sender: "client",
      senderName: data.senderName || matchedCustomer?.fullName || `+${cleanPhone}`,
      text: data.text,
      timestamp: now.toISOString(),
      timeFormatted,
      status: "delivered",
      attachment: data.attachment,
    };

    if (conv) {
      // Conversación existente: agregar mensaje y actualizar contadores
      conv.messages.push(newMsg);
      conv.unreadCount = (conv.unreadCount || 0) + 1;
      conv.lastMessage = data.text;
      conv.lastMessageTime = timeFormatted;
      conv.lastMessageDate = now.toISOString().split("T")[0];
      conv.lastMessageAt = now.toISOString();
      conv.updatedAt = now.toISOString();

      if (matchedCustomer) {
        conv.contactId = matchedCustomer.id;
        conv.serviceStatus = (matchedCustomer.status as any) || "active";
        conv.planOrRole = matchedCustomer.serviceName || matchedCustomer.serviceSpeed || conv.planOrRole;
        conv.debtAmount = parseFloat(matchedCustomer.balance || "0");
        if (matchedCustomer.address && !conv.address) conv.address = matchedCustomer.address;
      }
    } else {
      // Nueva conversación: crear entrada en la bandeja
      const convName = matchedCustomer?.fullName || data.senderName || `+${cleanPhone}`;
      conv = {
        id: "conv-wa-" + Date.now(),
        type: "cliente",
        contactId: matchedCustomer?.id,
        name: convName,
        phone: "+" + cleanPhone,
        avatar: matchedCustomer?.avatar || matchedCustomer?.photo || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(convName)}`,
        status: "online",
        tags: matchedCustomer ? ["clientes", "whatsapp"] : ["clientes", "whatsapp", "prospecto"],
        isArchived: false,
        planOrRole: matchedCustomer?.serviceName || "Consulta WhatsApp",
        serviceStatus: (matchedCustomer?.status as any) || "active",
        debtAmount: matchedCustomer ? parseFloat(matchedCustomer.balance || "0") : 0,
        unreadCount: 1,
        lastMessage: data.text,
        lastMessageTime: timeFormatted,
        lastMessageDate: now.toISOString().split("T")[0],
        lastMessageAt: now.toISOString(),
        messages: [newMsg],
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        address: matchedCustomer?.address,
      };
      conversations.push(conv);
    }

    // Mover la conversación al inicio respetando chats fijados
    conversations.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const timeA = new Date(a.lastMessageAt || a.updatedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.lastMessageAt || b.updatedAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(conversations, null, 2), "utf-8");
    } catch (err) {
      console.error("Error guardando mensajes de WhatsApp:", err);
    }

    // Notificar en tiempo real a todos los navegadores conectados vía Server-Sent Events
    broadcastMessageEvent({
      type: "new_message",
      tenantId,
      conversationId: conv.id,
      message: newMsg,
      unreadCount: conv.unreadCount,
      lastMessage: conv.lastMessage,
      lastMessageTime: conv.lastMessageTime,
    });

    return {
      success: true,
      handled: true,
      conversationId: conv.id,
      messageId: msgId,
    };
  }
}
