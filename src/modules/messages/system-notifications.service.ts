import fs from "fs";
import path from "path";
import { getTenantFilePath } from "../tenants/tenants.service";
import { loadConnectionsConfig } from "../settings/connections.service";
import { Conversation, MessageItem, Community, broadcastMessageEvent } from "./messages.routes";
import { WhatsAppService, cleanPhoneNumber } from "./whatsapp.service";
import { loadTenantCustomers, saveTenantCustomers, CustomerRecord } from "../customers/customers.routes";
import { loadTenantInvoices, saveTenantInvoices, loadTenantDevices } from "../invoices/invoices.routes";
import { MikroTikService } from "../network/mikrotik.service";

export interface SystemNotificationOptions {
  senderName?: string;
  sendWhatsApp?: boolean;
  tag?: string;
}

export class SystemNotificationsService {
  /**
   * Buscar o inicializar conversación en TurboChat para un cliente
   */
  static findOrCreateCustomerConversation(
    tenantId: string,
    customer: { id?: number; fullName: string; phone?: string; address?: string; serviceName?: string; balance?: string; status?: string }
  ): { conversation: Conversation; conversationsList: Conversation[] } {
    const filePath = getTenantFilePath(tenantId, "messages.json");
    let list: Conversation[] = [];
    try {
      if (fs.existsSync(filePath)) {
        list = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      }
    } catch (e) {
      list = [];
    }

    const cleanCustPhone = cleanPhoneNumber(customer.phone || "");

    let conv = list.find((c) => {
      if (customer.id && c.contactId === customer.id) return true;
      if (cleanCustPhone) {
        const p = cleanPhoneNumber(c.phone || "");
        return p.endsWith(cleanCustPhone) || cleanCustPhone.endsWith(p);
      }
      return false;
    });

    const now = new Date();
    const timeFormatted = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    if (!conv) {
      conv = {
        id: "conv-sys-" + Date.now() + "-" + Math.random().toString(36).slice(2, 5),
        type: "cliente",
        contactId: customer.id,
        name: customer.fullName || "Cliente",
        phone: customer.phone || "+51 (Sin Teléfono)",
        avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(customer.fullName || "Cliente")}`,
        status: "online",
        tags: ["clientes"],
        isArchived: false,
        planOrRole: customer.serviceName || "Fibra Óptica",
        serviceStatus: (customer.status as any) || "active",
        debtAmount: customer.balance ? parseFloat(customer.balance) : 0,
        unreadCount: 0,
        lastMessage: "Canal del sistema activado",
        lastMessageTime: timeFormatted,
        lastMessageDate: now.toISOString().split("T")[0],
        messages: [],
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        address: customer.address,
      };
      list.unshift(conv);
    } else {
      // Actualizar datos frescos del cliente
      if (customer.id) conv.contactId = customer.id;
      if (customer.balance !== undefined) conv.debtAmount = parseFloat(customer.balance);
      if (customer.status) conv.serviceStatus = customer.status as any;
      if (customer.serviceName) conv.planOrRole = customer.serviceName;
    }

    return { conversation: conv, conversationsList: list };
  }

  /**
   * Enviar mensaje del sistema a un cliente (registra en TurboChat y envía a WhatsApp si corresponde)
   */
  static async sendSystemMessageToCustomer(
    tenantId: string,
    customer: { id?: number; fullName: string; phone?: string; address?: string; serviceName?: string; balance?: string; status?: string },
    messageText: string,
    options?: SystemNotificationOptions
  ): Promise<{ success: boolean; messageId: string; conversationId: string; whatsappSent: boolean }> {
    const { conversation, conversationsList } = this.findOrCreateCustomerConversation(tenantId, customer);

    const now = new Date();
    const timeFormatted = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const msgId = "sys-" + Date.now() + "-" + Math.random().toString(36).slice(2, 5);

    const newMsg: MessageItem = {
      id: msgId,
      sender: "system",
      senderName: options?.senderName || "Sistema TurboNetwork",
      text: messageText,
      timestamp: now.toISOString(),
      timeFormatted,
      status: "read",
    };

    conversation.messages.push(newMsg);
    conversation.lastMessage = messageText;
    conversation.lastMessageTime = timeFormatted;
    conversation.lastMessageDate = now.toISOString().split("T")[0];
    conversation.updatedAt = now.toISOString();

    // Guardar en disco
    const filePath = getTenantFilePath(tenantId, "messages.json");
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(conversationsList, null, 2), "utf-8");
    } catch (e) {}

    // Emitir Server-Sent Events en tiempo real
    broadcastMessageEvent({
      type: "new_message",
      tenantId,
      conversationId: conversation.id,
      message: newMsg,
      unreadCount: conversation.unreadCount,
      lastMessage: conversation.lastMessage,
      lastMessageTime: conversation.lastMessageTime,
    });

    // Enviar a WhatsApp si está habilitado y el cliente tiene teléfono
    let whatsappSent = false;
    const shouldSendWa = options?.sendWhatsApp !== false && Boolean(customer.phone);
    if (shouldSendWa && customer.phone) {
      try {
        const waRes = await WhatsAppService.sendMessage(tenantId, {
          to: customer.phone,
          text: messageText,
        });
        whatsappSent = waRes.success;
      } catch (err) {
        console.warn("Aviso: No se pudo despachar por WhatsApp:", err);
      }
    }

    return {
      success: true,
      messageId: msgId,
      conversationId: conversation.id,
      whatsappSent,
    };
  }

  // ==========================================================
  // 1. EVENTO: PAGO RECIBIDO & REACTIVACIÓN MIKROTIK
  // ==========================================================
  static async notifyPaymentReceived(
    tenantId: string,
    invoice: any,
    customer: any,
    mikrotikReport?: any
  ) {
    const config = loadConnectionsConfig(tenantId);
    if (config.whatsapp && config.whatsapp.notifyOnPayment === false) {
      // Si el usuario desactivó esta alerta específicamente
    }

    const mikrotikMsg = mikrotikReport
      ? `\n🌐 *Servicio de red MikroTik restablecido automáticamente.* (Tráfico habilitado)`
      : "";

    const text = `✅ *¡PAGO REGISTRADO CON ÉXITO!*
    
Estimado(a) *${customer.fullName || customer.name || "Cliente"}*, hemos recibido y procesado su pago satisfactoriamente:

- *Recibo Nº:* ${invoice.referenceNumber || invoice.id || "N/A"}
- *Monto Abonado:* S/ ${invoice.amount || invoice.total || "0.00"}
- *Método de Pago:* ${invoice.paymentMethod || "En Línea / Efectivo"}
- *Fecha:* ${new Date().toLocaleDateString("es-PE")} ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}${mikrotikMsg}

Agradecemos su puntualidad y confianza en TurboNetwork. ¡Que disfrute de su navegación!`;

    return this.sendSystemMessageToCustomer(tenantId, customer, text, {
      senderName: "Facturación TurboNetwork",
      sendWhatsApp: config.whatsapp?.notifyOnPayment !== false,
    });
  }

  // ==========================================================
  // 2. EVENTO: CORTE DE SERVICIO POR MORA
  // ==========================================================
  static async notifyServiceCutoff(
    tenantId: string,
    customer: any,
    invoice?: any
  ) {
    const config = loadConnectionsConfig(tenantId);
    const amount = customer.balance || invoice?.amount || "0.00";
    const receiptNum = invoice?.referenceNumber || invoice?.id || "Pendiente";

    const text = `⚠️ *AVISO DE SUSPENSIÓN TEMPORAL DE SERVICIO*

Estimado(a) *${customer.fullName || customer.name || "Cliente"}*, le informamos que su servicio de internet ha sido suspendido temporalmente por saldo vencido.

- *Saldo Pendiente:* S/ ${amount}
- *Recibo Asociado:* ${receiptNum}
- *Estado:* Tráfico Suspendido

*¿Cómo reactivar de inmediato?*
1. Realice su pago a través de nuestros canales oficiales (Yape, Plin o Transferencia).
2. Tan pronto se confirme el abono, nuestro sistema reactivará automáticamente su conexión a internet sin recargos.

Soporte y Consultas: Comuníquese por este medio.`;

    return this.sendSystemMessageToCustomer(tenantId, customer, text, {
      senderName: "NOC & Cobranzas TurboNetwork",
      sendWhatsApp: config.whatsapp?.notifyOnServiceCut !== false,
    });
  }

  // ==========================================================
  // 3. EVENTO: ASIGNACIÓN DE TAREA A TÉCNICO / CUADRILLA
  // ==========================================================
  static async notifyTechnicianTask(
    tenantId: string,
    technician: { id?: number | string; name: string; phone?: string; role?: string },
    task: { title: string; customerName: string; address: string; phone?: string; napPort?: string; details?: string }
  ) {
    const filePath = getTenantFilePath(tenantId, "messages.json");
    let list: Conversation[] = [];
    try {
      if (fs.existsSync(filePath)) {
        list = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      }
    } catch (e) {
      list = [];
    }

    const cleanTechPhone = cleanPhoneNumber(technician.phone || "");

    let conv = list.find((c) => {
      if (c.type !== "personal") return false;
      if (technician.id && c.contactId === technician.id) return true;
      if (cleanTechPhone) {
        const p = cleanPhoneNumber(c.phone || "");
        return p.endsWith(cleanTechPhone) || cleanTechPhone.endsWith(p);
      }
      return false;
    });

    const now = new Date();
    const timeFormatted = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    if (!conv) {
      conv = {
        id: "conv-tech-" + Date.now(),
        type: "personal",
        contactId: technician.id,
        name: technician.name || "Técnico Cuadrilla",
        phone: technician.phone || "+51 (Interno)",
        avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(technician.name || "Tecnico")}`,
        status: "online",
        tags: ["personal"],
        isArchived: false,
        planOrRole: technician.role || "Técnico de Campo",
        serviceStatus: "active",
        unreadCount: 0,
        lastMessage: "Asignación técnica",
        lastMessageTime: timeFormatted,
        lastMessageDate: now.toISOString().split("T")[0],
        messages: [],
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      list.unshift(conv);
    }

    const taskText = `📋 *NUEVA ORDEN DE TRABAJO ASIGNADA*

Hola *${technician.name}*, tienes una nueva orden en ruta:
- *Tipo:* ${task.title}
- *Abonado:* ${task.customerName}
- *Dirección:* ${task.address}
- *Teléfono Cliente:* ${task.phone || "No especificado"}
${task.napPort ? `- *Caja NAP / Puerto:* ${task.napPort}\n` : ""}${task.details ? `- *Detalles:* ${task.details}\n` : ""}
Favor de confirmar recepción e iniciar navegación con Waze/Maps.`;

    const newMsg: MessageItem = {
      id: "sys-ot-" + Date.now(),
      sender: "system",
      senderName: "Despacho & Operaciones",
      text: taskText,
      timestamp: now.toISOString(),
      timeFormatted,
      status: "delivered",
    };

    conv.messages.push(newMsg);
    conv.lastMessage = taskText;
    conv.lastMessageTime = timeFormatted;
    conv.updatedAt = now.toISOString();

    try {
      fs.writeFileSync(filePath, JSON.stringify(list, null, 2), "utf-8");
    } catch (e) {}

    broadcastMessageEvent({
      type: "new_message",
      tenantId,
      conversationId: conv.id,
      message: newMsg,
      unreadCount: conv.unreadCount,
      lastMessage: conv.lastMessage,
      lastMessageTime: conv.lastMessageTime,
    });

    if (technician.phone) {
      await WhatsAppService.sendMessage(tenantId, {
        to: technician.phone,
        text: taskText,
      });
    }

    return { success: true, conversationId: conv.id };
  }

  // ==========================================================
  // 4. EVENTO: ALERTA DE RED / NOC EN CANALES COMUNITARIOS
  // ==========================================================
  static async notifyNetworkAlertToCommunity(
    tenantId: string,
    alert: { title: string; message: string; communityId?: string; napName?: string }
  ) {
    const filePath = getTenantFilePath(tenantId, "communities.json");
    let communities: Community[] = [];
    try {
      if (fs.existsSync(filePath)) {
        communities = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      }
    } catch (e) {
      communities = [];
    }

    const now = new Date();
    const timeFormatted = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    let targetCommunities = communities;
    if (alert.communityId) {
      targetCommunities = communities.filter((c) => c.id === alert.communityId);
    } else if (alert.napName) {
      targetCommunities = communities.filter((c) => c.linkedNaps && c.linkedNaps.includes(alert.napName!));
    }

    for (const comm of targetCommunities) {
      // Buscar canal de avisos
      const group = comm.groups.find((g) => g.type === "announcements") || comm.groups[0];
      if (!group) continue;

      const fullText = `🚨 *ALERTA DE RED - NOC TURBONETWORK*
*${alert.title}*

${alert.message}

Hora de registro: ${timeFormatted}`;

      const newMsg: MessageItem = {
        id: "gm-alert-" + Date.now(),
        sender: "system",
        senderName: "NOC TurboNetwork Oficial",
        text: fullText,
        timestamp: now.toISOString(),
        timeFormatted,
        status: "read",
      };

      group.messages.push(newMsg);
      group.lastMessage = fullText;
      group.lastMessageTime = timeFormatted;
      group.updatedAt = now.toISOString();
      comm.updatedAt = now.toISOString();

      broadcastMessageEvent({
        type: "community_message",
        tenantId,
        communityId: comm.id,
        groupId: group.id,
        message: newMsg,
        lastMessage: fullText,
        lastMessageTime: timeFormatted,
      });
    }

    try {
      fs.writeFileSync(filePath, JSON.stringify(communities, null, 2), "utf-8");
    } catch (e) {}

    return { success: true, impactedCommunities: targetCommunities.length };
  }

  // ==========================================================
  // 5. MOTOR DE AUTOMATIZACIÓN DE RECIBOS (CONFIGURADO EN MODAL DE FACTURACIÓN)
  // ==========================================================
  static async executeAutomatedReceiptDispatch(
    tenantId: string,
    options?: { forceStage?: "beforeDue" | "onDue" | "onCut"; dryRun?: boolean }
  ): Promise<{
    success: boolean;
    totalScanned: number;
    dispatchedCount: number;
    stagesBreakdown: { beforeDue: number; onDue: number; onCut: number };
    results: any[];
  }> {
    // 1. Cargar la configuración guardada por el usuario desde el modal de Facturación
    const dispatchFile = getTenantFilePath(tenantId, "receipt_dispatch.json");
    let dispatchConfig: any = null;
    try {
      if (fs.existsSync(dispatchFile)) {
        dispatchConfig = JSON.parse(fs.readFileSync(dispatchFile, "utf-8"));
      }
    } catch (e) {}

    if (!dispatchConfig || !dispatchConfig.enabled) {
      return {
        success: false,
        totalScanned: 0,
        dispatchedCount: 0,
        stagesBreakdown: { beforeDue: 0, onDue: 0, onCut: 0 },
        results: [{ error: "El despacho automático está inactivo en la configuración de la empresa." }],
      };
    }

    const customers: CustomerRecord[] = loadTenantCustomers(tenantId);
    const invoices = loadTenantInvoices(tenantId);

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const todayMidnight = new Date(todayStr).getTime();

    const stages = dispatchConfig.stages || {};
    const beforeDueCfg = stages.beforeDue || { enabled: false, daysBefore: 3 };
    const onDueCfg = stages.onDue || { enabled: false };
    const onCutCfg = stages.onCut || { enabled: false, graceDaysAfterDue: 2, actionType: "suspend_traffic" };

    let dispatchedCount = 0;
    const stagesBreakdown = { beforeDue: 0, onDue: 0, onCut: 0 };
    const results: any[] = [];

    // Filtrar facturas pendientes o vencidas
    const unpaidInvoices = invoices.filter((i: any) => i.status === "pending" || i.status === "overdue");

    for (const inv of unpaidInvoices) {
      const customer = customers.find((c: any) => c.id === inv.customerId);
      if (!customer) continue;

      const dueDateStr = inv.dueDate || inv.due_date || todayStr;
      const dueMidnight = new Date(dueDateStr).getTime();
      const diffDays = Math.round((dueMidnight - todayMidnight) / (1000 * 60 * 60 * 24));

      let matchedStage: "beforeDue" | "onDue" | "onCut" | null = null;

      if (options?.forceStage) {
        matchedStage = options.forceStage;
      } else {
        // Etapa 1: Preventivo (antes del vencimiento)
        if (beforeDueCfg.enabled && diffDays === Number(beforeDueCfg.daysBefore || 3)) {
          matchedStage = "beforeDue";
        }
        // Etapa 2: Día de vencimiento (hoy)
        else if (onDueCfg.enabled && diffDays === 0) {
          matchedStage = "onDue";
        }
        // Etapa 3: Corte de servicio (días de gracia superados)
        else if (onCutCfg.enabled && diffDays <= -Number(onCutCfg.graceDaysAfterDue || 2)) {
          matchedStage = "onCut";
        }
      }

      if (!matchedStage) continue;

      const stageCfg = stages[matchedStage];
      if (!stageCfg || !stageCfg.enabled) continue;

      // Renderizar plantilla
      const rawTemplate = stageCfg.template || "Aviso de recibo emitido.";
      const renderedText = rawTemplate
        .replace(/\{cliente\}/g, customer.fullName)
        .replace(/\{documento\}/g, customer.identification || "")
        .replace(/\{servicio\}/g, customer.serviceName || "Fibra Óptica")
        .replace(/\{velocidad\}/g, customer.serviceSpeed || "")
        .replace(/\{monto\}/g, inv.amount || inv.total || customer.balance || "0.00")
        .replace(/\{recibo_nro\}/g, inv.referenceNumber || inv.id || "N/A")
        .replace(/\{fecha_vencimiento\}/g, dueDateStr)
        .replace(/\{enlace_pago\}/g, dispatchConfig.paymentLinkDefault || "https://pagos.turbonetwork.net/pago")
        .replace(/\{dias_vencido\}/g, String(Math.abs(diffDays)))
        .replace(/\{empresa\}/g, dispatchConfig.companyName || "TurboNetwork Fibra")
        .replace(/\{telefono_soporte\}/g, dispatchConfig.supportPhone || "+51 987 654 321");

      let mikrotikActionDone = false;

      // Si es etapa de CORTE y la regla es cortar tráfico en MikroTik
      if (matchedStage === "onCut" && onCutCfg.actionType === "suspend_traffic" && !options?.dryRun) {
        try {
          customer.status = "suspended";
          customer.updatedAt = new Date().toISOString();
          saveTenantCustomers(tenantId, customers);

          const devices = loadTenantDevices(tenantId);
          const mktRouter = devices.find((d: any) => d.vendor === "mikrotik");
          if (mktRouter) {
            await MikroTikService.suspendCustomerService(mktRouter, {
              id: customer.id,
              name: customer.fullName,
              ip: customer.assignedIp || customer.ip,
              pppoeUsername: customer.pppoeUsername,
            });
            mikrotikActionDone = true;
          }
        } catch (mktErr: any) {
          console.warn("Aviso al suspender en MikroTik durante auto-despacho:", mktErr?.message);
        }
      }

      if (!options?.dryRun) {
        // Enviar notificación al chat y a WhatsApp si está activo el canal en el modal
        const sendViaWa = Boolean(stageCfg.channels?.whatsapp);
        await this.sendSystemMessageToCustomer(tenantId, customer, renderedText, {
          senderName: matchedStage === "onCut" ? "NOC & Cobranzas" : "Facturación TurboNetwork",
          sendWhatsApp: sendViaWa,
        });
      }

      dispatchedCount++;
      stagesBreakdown[matchedStage]++;
      results.push({
        customerId: customer.id,
        customerName: customer.fullName,
        invoiceId: inv.id,
        stage: matchedStage,
        mikrotikCutExecuted: mikrotikActionDone,
        dispatchedAt: new Date().toISOString(),
      });
    }

    return {
      success: true,
      totalScanned: unpaidInvoices.length,
      dispatchedCount,
      stagesBreakdown,
      results,
    };
  }
}
