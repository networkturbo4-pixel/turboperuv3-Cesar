import { BotContext, BotDecision, BotSettings } from "./bot.types";
import { verifyCustomerByDocument } from "./customer-identity";
import { kbService } from "./knowledge-base.service";
import { toolRegistry } from "./tools/registry";

function normalize(text: string): string {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function matchesHandoffKeyword(text: string, settings: BotSettings): boolean {
  const norm = normalize(text);
  if (!norm) return false;
  return settings.handoffKeywords.some((kw) => {
    const cleanKw = normalize(kw);
    return cleanKw.length >= 3 && norm.includes(cleanKw);
  });
}

function formatDebtReply(customerName: string, data: Record<string, any>): string {
  const total = Number(data.totalDebt || 0);
  const pending = Array.isArray(data.pendingInvoices) ? data.pendingInvoices : [];
  if (pending.length === 0 || total <= 0) {
    return `Estimado(a) ${customerName}, su cuenta se encuentra al día y no registra facturas pendientes.`;
  }
  const lines = pending
    .slice(0, 3)
    .map((i: any) => `• ${i.invoiceNumber} (${i.period}): ${i.total}`)
    .join("\n");
  return `Estimado(a) ${customerName}, su saldo pendiente total es *${total.toFixed(2)}*:\n${lines}\n\nSi ya realizó su pago, puede enviarnos su comprobante por este medio.`;
}

function formatPlansReply(plans: any[]): string {
  if (!plans || plans.length === 0) {
    return "Por el momento no hay planes publicados en el catálogo. Si desea, puedo comunicarle con un asesor.";
  }
  const lines = plans
    .slice(0, 6)
    .map((p: any) => `• *${p.name}*: ${p.downloadMbps}/${p.uploadMbps} Mbps — ${p.currency}${p.price}/mes`)
    .join("\n");
  return `Estos son nuestros planes de internet disponibles:\n${lines}\n\n¿Le gustaría contratar alguno o verificar cobertura en su dirección?`;
}

/**
 * Reglas deterministas (sin costo de API). Siempre usan trato formal de usted.
 */
export async function matchDeterministicIntent(
  ctx: BotContext,
  settings: BotSettings
): Promise<BotDecision | null> {
  const raw = ctx.latestUserText.trim();
  const norm = normalize(raw);
  if (!norm) return null;

  // 1. Flujo pendiente de verificación por DNI / código
  if (ctx.state.pendingFlow === "await_dni") {
    const found = verifyCustomerByDocument(ctx.tenantId, raw);
    if (found) {
      const debtData = await toolRegistry.execute(
        "get_my_balance_and_invoices",
        {},
        {
          tenantId: ctx.tenantId,
          conversationId: ctx.conversation.id,
          verifiedCustomer: found,
          setPendingFlow: () => {},
          requestHandoff: () => {},
        }
      );
      return {
        path: "rule",
        intent: "customer_verified",
        toolsUsed: ["get_my_balance_and_invoices"],
        tokens: 0,
        verifiedCustomerId: found.id,
        setPendingFlow: "",
        text: `Gracias, hemos verificado su identidad.\n${formatDebtReply(found.fullName, debtData)}`,
      };
    }

    // Si el usuario escribió algo corto que parece un número de documento inválido
    if (/^\d{5,12}$/.test(norm) || /^[a-z0-9-]{4,15}$/.test(norm)) {
      return {
        path: "rule",
        intent: "verification_failed",
        toolsUsed: [],
        tokens: 0,
        setPendingFlow: "await_dni",
        text: "No encontramos un cliente registrado con ese documento o código. Por favor verifique el número e inténtelo nuevamente, o escriba *asesor* para recibir ayuda personalizada.",
      };
    }
    // Si escribió una frase distinta, continuamos evaluando pero limpiamos el flujo si pide otra cosa
  }

  // 2. Saludo corto
  if (/^(hola|buenas|buenos dias|buenas tardes|buenas noches|menu|inicio|ola|hi|hello)[!.,\s]*$/.test(norm)) {
    const greeting = ctx.customer
      ? `¡Hola ${ctx.customer.fullName}! Soy ${settings.botName}, su asistente virtual.`
      : `¡Hola! Soy ${settings.botName}, su asistente virtual.`;
    return {
      path: "rule",
      intent: "greeting_menu",
      toolsUsed: [],
      tokens: 0,
      text: `${greeting} ¿En qué puedo ayudarle hoy?\n\n1️⃣ Consultar deuda y medios de pago\n2️⃣ Soporte técnico\n3️⃣ Planes y precios\n4️⃣ Hablar con un asesor`,
    };
  }

  // 3. Opciones numéricas del menú o intenciones directas claras
  if (norm === "4") {
    return {
      path: "handoff",
      intent: "menu_handoff",
      toolsUsed: [],
      tokens: 0,
      handoff: true,
      reason: "Cliente seleccionó opción 4 (asesor)",
      text: "",
    };
  }

  if (norm === "1" || /^(deuda|cuanto debo|mi saldo|mis facturas|factura pendiente)$/.test(norm)) {
    if (ctx.customer) {
      const debtData = await toolRegistry.execute(
        "get_my_balance_and_invoices",
        {},
        {
          tenantId: ctx.tenantId,
          conversationId: ctx.conversation.id,
          verifiedCustomer: ctx.customer,
          setPendingFlow: () => {},
          requestHandoff: () => {},
        }
      );
      return {
        path: "rule",
        intent: "check_debt",
        toolsUsed: ["get_my_balance_and_invoices"],
        tokens: 0,
        text: formatDebtReply(ctx.customer.fullName, debtData),
      };
    }
    return {
      path: "rule",
      intent: "request_verification",
      toolsUsed: ["request_customer_verification"],
      tokens: 0,
      setPendingFlow: "await_dni",
      text: "Con mucho gusto consulto su estado de cuenta. Por favor indíqueme su número de *DNI / RUC* o *código de cliente*.",
    };
  }

  if (norm === "3" || /^(planes|ver planes|precios|tarifas)$/.test(norm)) {
    const plansRes = await toolRegistry.execute(
      "list_plans",
      {},
      {
        tenantId: ctx.tenantId,
        conversationId: ctx.conversation.id,
        verifiedCustomer: ctx.customer,
        setPendingFlow: () => {},
        requestHandoff: () => {},
      }
    );
    return {
      path: "rule",
      intent: "list_plans",
      toolsUsed: ["list_plans"],
      tokens: 0,
      text: formatPlansReply(plansRes.plans),
    };
  }

  if (norm === "2") {
    const hits = await kbService.search(ctx.tenantId, "no tengo internet reiniciar router", 1);
    const guide =
      hits[0]?.chunkText ||
      "Si presenta fallas en su conexión, por favor desconecte su router y ONU por 30 segundos y vuelva a conectarlos. Indíquenos si alguna luz está en rojo.";
    return {
      path: "rule",
      intent: "support_basic",
      toolsUsed: ["search_knowledge_base"],
      tokens: 0,
      text: guide,
    };
  }

  return null;
}

/**
 * Fallback cuando la IA está deshabilitada o no hay GEMINI_API_KEY configurada.
 */
export async function knowledgeBaseFallback(ctx: BotContext): Promise<BotDecision> {
  const hits = await kbService.search(ctx.tenantId, ctx.latestUserText, 2);
  if (hits.length > 0 && hits[0].score >= 0.35) {
    return {
      path: "rule",
      intent: "kb_keyword_match",
      toolsUsed: ["search_knowledge_base"],
      tokens: 0,
      text: hits[0].chunkText,
    };
  }
  return {
    path: "handoff",
    intent: "kb_no_match",
    toolsUsed: ["search_knowledge_base"],
    tokens: 0,
    handoff: true,
    reason: "Sin respuesta en base de conocimientos (IA no disponible)",
    text: "",
  };
}
