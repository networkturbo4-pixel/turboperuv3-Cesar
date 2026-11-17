import { loadTenantInvoices, loadTenantServices } from "../../invoices/invoices.routes";
import { loadCustomersFromDisk, saveCustomersToDisk } from "../../customers/customers.routes";
import { omnichannelDb as db } from "../../messages/omnichannel-db";
import { kbService } from "../knowledge-base.service";
import { BotToolContext, BotToolDefinition } from "../bot.types";
import { GeminiToolDeclaration } from "../llm/gemini.client";

const TOOLS: BotToolDefinition[] = [
  {
    name: "search_knowledge_base",
    description:
      "Busca información oficial en la base de conocimientos de la empresa (pagos, soporte técnico básico, horarios, políticas).",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Pregunta o tema a buscar en la base de conocimientos",
        },
      },
      required: ["query"],
    },
    async execute(args, ctx) {
      const hits = await kbService.search(ctx.tenantId, String(args.query || ""), 4);
      return {
        results: hits.map((h) => ({
          title: h.title,
          category: h.category,
          content: h.chunkText,
          score: h.score,
        })),
      };
    },
  },
  {
    name: "list_plans",
    description: "Lista los planes de internet activos con sus velocidades y precios.",
    parameters: {
      type: "object",
      properties: {},
    },
    async execute(_args, ctx) {
      const services = loadTenantServices(ctx.tenantId) || [];
      const active = services
        .filter((s: any) => s.isActive !== false)
        .map((s: any) => ({
          name: s.name,
          downloadMbps: s.downloadSpeedMbps,
          uploadMbps: s.uploadSpeedMbps,
          price: s.price,
          currency: s.currency || "$",
          technology: s.technology || "Fibra Óptica",
          details: s.details || "",
        }));
      return { plans: active };
    },
  },
  {
    name: "get_my_service_status",
    description:
      "Consulta el estado del servicio de internet del cliente verificado en esta conversación (plan, estado activo/suspendido, dirección).",
    requiresVerifiedCustomer: true,
    parameters: {
      type: "object",
      properties: {},
    },
    async execute(_args, ctx) {
      if (!ctx.verifiedCustomer) {
        return { error: "Cliente no verificado. Solicite primero su DNI o código de cliente." };
      }
      return {
        customer: {
          fullName: ctx.verifiedCustomer.fullName,
          customerCode: ctx.verifiedCustomer.customerCode,
          status: ctx.verifiedCustomer.status,
          address: ctx.verifiedCustomer.address,
        },
      };
    },
  },
  {
    name: "get_my_balance_and_invoices",
    description:
      "Consulta las facturas pendientes o vencidas y el saldo total del cliente verificado en esta conversación.",
    requiresVerifiedCustomer: true,
    parameters: {
      type: "object",
      properties: {},
    },
    async execute(_args, ctx) {
      if (!ctx.verifiedCustomer) {
        return { error: "Cliente no verificado. Solicite primero su DNI o código de cliente." };
      }
      const allInvoices = loadTenantInvoices(ctx.tenantId) || [];
      const mine = allInvoices.filter(
        (inv: any) => Number(inv.customerId) === Number(ctx.verifiedCustomer!.id)
      );
      const pending = mine.filter((inv: any) => inv.status === "pending" || inv.status === "overdue");
      const totalDebt = pending.reduce((sum: number, inv: any) => sum + Number(inv.total || 0), 0);
      return {
        customerName: ctx.verifiedCustomer.fullName,
        pendingCount: pending.length,
        totalDebt: Number(totalDebt.toFixed(2)),
        pendingInvoices: pending.slice(0, 5).map((inv: any) => ({
          invoiceNumber: inv.invoiceNumber,
          period: inv.period,
          total: inv.total,
          dueDate: inv.dueDate,
          status: inv.status,
        })),
      };
    },
  },
  {
    name: "request_customer_verification",
    description:
      "Activa el flujo de verificación de identidad cuando el cliente pregunta por su deuda, facturas o servicio pero aún no está verificado.",
    parameters: {
      type: "object",
      properties: {},
    },
    async execute(_args, ctx) {
      ctx.setPendingFlow("await_dni");
      return {
        ok: true,
        instruction: "Pida amablemente al cliente su número de DNI o código de cliente para verificar su identidad.",
      };
    },
  },
  {
    name: "request_human",
    description:
      "Transfiere la conversación a un asesor humano cuando el cliente lo solicita o el bot no puede resolver la consulta.",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Motivo breve del traspaso a asesor humano",
        },
      },
      required: ["reason"],
    },
    async execute(args, ctx) {
      const reason = String(args.reason || "Consulta derivada a asesor");
      ctx.requestHandoff(reason);
      return { ok: true, handoff: true, reason };
    },
  },
  {
    name: "create_support_ticket",
    description:
      "Crea un ticket de soporte técnico para revisión o visita de técnico cuando el cliente reporta una falla que no se resolvió con el reinicio básico.",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Categoría: sin_internet, lentitud, router_onu, cableado, otro",
        },
        subject: {
          type: "string",
          description: "Resumen corto del problema",
        },
        description: {
          type: "string",
          description: "Detalle reportado por el cliente",
        },
        priority: {
          type: "string",
          description: "normal o high",
        },
      },
      required: ["subject", "description"],
    },
    async execute(args, ctx) {
      const ins = await db.query<{ id: number }>(
        `INSERT INTO bot_support_tickets
         (tenant_id, conversation_id, customer_id, customer_name, category, priority, subject, description, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open')
         RETURNING id`,
        [
          ctx.tenantId,
          ctx.conversationId || null,
          ctx.verifiedCustomer?.id ?? null,
          ctx.verifiedCustomer?.fullName || "Cliente",
          String(args.category || "soporte").slice(0, 60),
          args.priority === "high" ? "high" : "normal",
          String(args.subject || "Falla de servicio").slice(0, 200),
          String(args.description || "").slice(0, 2000),
        ]
      );
      const ticketId = Number(ins.rows[0]?.id || 0);
      if (ctx.conversationId) {
        await db
          .query(
            `INSERT INTO conversation_notes (conversation_id, author_name, content, color)
             VALUES ($1, 'TurboBot', $2, '#0ea5e9')`,
            [ctx.conversationId, `Ticket de soporte #${ticketId} creado: ${args.subject}`]
          )
          .catch(() => {});
      }
      return { ok: true, ticketId, status: "open" };
    },
  },
  {
    name: "register_installation_lead",
    description:
      "Registra un nuevo prospecto/cliente interesado en contratar e instalar el servicio de internet.",
    parameters: {
      type: "object",
      properties: {
        fullName: { type: "string", description: "Nombre completo del interesado" },
        phone: { type: "string", description: "Teléfono de contacto" },
        address: { type: "string", description: "Dirección o referencia de instalación" },
        planName: { type: "string", description: "Nombre del plan de interés" },
        preferredSchedule: { type: "string", description: "Horario preferido para la visita" },
      },
      required: ["fullName", "address"],
    },
    async execute(args, ctx) {
      const customers = loadCustomersFromDisk(ctx.tenantId);
      const nextId = customers.reduce((max, c) => Math.max(max, Number(c.id || 0)), 0) + 1;
      const newLead = {
        id: nextId,
        customerCode: `LEAD-${String(nextId).padStart(4, "0")}`,
        fullName: String(args.fullName || "Prospecto").trim(),
        identification: "POR-VALIDAR",
        phone: String(args.phone || "").trim() || "Por confirmar",
        email: "",
        address: String(args.address || "").trim(),
        status: "pending_installation" as const,
        notes: `Lead registrado por Bot. Plan: ${args.planName || "Por definir"}. Horario: ${args.preferredSchedule || "A coordinar"}.`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      customers.push(newLead as any);
      saveCustomersToDisk(ctx.tenantId, customers);
      if (ctx.conversationId) {
        await db
          .query(
            `INSERT INTO conversation_notes (conversation_id, author_name, content, color)
             VALUES ($1, 'TurboBot', $2, '#10b981')`,
            [ctx.conversationId, `Lead de instalación registrado (${newLead.customerCode}) — ${newLead.address}`]
          )
          .catch(() => {});
      }
      return { ok: true, customerCode: newLead.customerCode, status: "pending_installation" };
    },
  },
  {
    name: "send_my_last_receipt",
    description:
      "Obtiene el detalle del último recibo o factura (pagada o pendiente) del cliente verificado para enviárselo.",
    requiresVerifiedCustomer: true,
    parameters: {
      type: "object",
      properties: {},
    },
    async execute(_args, ctx) {
      if (!ctx.verifiedCustomer) {
        return { error: "Cliente no verificado. Solicite primero su DNI o código de cliente." };
      }
      const allInvoices = loadTenantInvoices(ctx.tenantId) || [];
      const mine = allInvoices
        .filter((inv: any) => Number(inv.customerId) === Number(ctx.verifiedCustomer!.id))
        .sort((a: any, b: any) => Number(b.id || 0) - Number(a.id || 0));
      const latest = mine[0];
      if (!latest) {
        return { found: false, message: "No se encontraron recibos emitidos para su cuenta." };
      }
      return {
        found: true,
        receipt: {
          invoiceNumber: latest.invoiceNumber,
          period: latest.period,
          total: latest.total,
          status: latest.status,
          dueDate: latest.dueDate,
        },
      };
    },
  },
];

export class BotToolRegistry {
  getDeclarations(hasVerifiedCustomer: boolean): GeminiToolDeclaration[] {
    return TOOLS.filter((t) => !t.requiresVerifiedCustomer || hasVerifiedCustomer).map((t) => ({
      type: "function",
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
  }

  async execute(name: string, args: Record<string, any>, ctx: BotToolContext): Promise<Record<string, any>> {
    const tool = TOOLS.find((t) => t.name === name);
    if (!tool) {
      return { error: `Herramienta desconocida: ${name}` };
    }
    if (tool.requiresVerifiedCustomer && !ctx.verifiedCustomer) {
      return { error: "Cliente no verificado. Use request_customer_verification primero." };
    }
    try {
      return await tool.execute(args || {}, ctx);
    } catch (err) {
      return { error: `Error ejecutando ${name}: ${(err as Error).message}` };
    }
  }
}

export const toolRegistry = new BotToolRegistry();
