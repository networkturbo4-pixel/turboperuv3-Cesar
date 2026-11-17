import { BotContext, BotDecision, BotSettings } from "./bot.types";
import { getGeminiClient } from "./llm/gemini.client";
import { toolRegistry } from "./tools/registry";
import { knowledgeBaseFallback } from "./intents";

const MAX_TOOL_ITERATIONS = 4;

function buildSystemPrompt(ctx: BotContext, settings: BotSettings): string {
  const customerSection = ctx.customer
    ? `Cliente verificado en esta conversación: ${ctx.customer.fullName} (Código: ${ctx.customer.customerCode}, Estado: ${ctx.customer.status}).`
    : "Cliente NO verificado todavía. Si pregunta por su deuda, facturas o estado de servicio, use la herramienta request_customer_verification.";

  return [
    settings.personaPrompt,
    `Su nombre es ${settings.botName}.`,
    "Reglas obligatorias:",
    "- Trate siempre al cliente de usted, con respeto, claridad y respuestas breves aptas para chat.",
    "- Responda únicamente con información obtenida de sus herramientas o de la base de conocimientos. Nunca invente precios, deudas ni fechas.",
    "- Si no encuentra información suficiente o el cliente muestra molestia, llame a la herramienta request_human.",
    "- Use formato simple (negritas con *texto* si ayuda), sin tablas Markdown complejas.",
    customerSection,
  ].join("\n");
}

function buildConversationTranscript(ctx: BotContext): string {
  const recent = ctx.recentMessages.slice(-12);
  if (recent.length === 0) return ctx.latestUserText;
  return recent
    .map((m) => {
      const role = m.senderType === "contact" ? "Cliente" : settingsLabel(m.senderType);
      return `${role}: ${m.body}`;
    })
    .join("\n");
}

function settingsLabel(senderType: string): string {
  if (senderType === "bot" || senderType === "chatbot") return "Asistente";
  if (senderType === "agent") return "Asesor";
  return "Sistema";
}

export async function respondWithAi(
  ctx: BotContext,
  settings: BotSettings
): Promise<BotDecision> {
  const gemini = getGeminiClient();
  if (!gemini.isConfigured()) {
    return knowledgeBaseFallback(ctx);
  }

  const systemInstruction = buildSystemPrompt(ctx, settings);
  const declarations = toolRegistry.getDeclarations(Boolean(ctx.customer));
  const toolsUsed: string[] = [];
  let totalTokens = 0;
  let pendingFlowUpdate: string | undefined;
  let handoffReason: string | undefined;

  let currentInput: any = buildConversationTranscript(ctx);

  try {
    for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
      const turn = await gemini.runInteraction({
        systemInstruction,
        input: currentInput,
        tools: declarations,
      });
      totalTokens += turn.tokens;

      if (turn.toolCalls.length === 0) {
        if (handoffReason) {
          return {
            path: "handoff",
            intent: "ai_handoff",
            toolsUsed,
            tokens: totalTokens,
            handoff: true,
            reason: handoffReason,
            text: "",
          };
        }
        const replyText = turn.text.trim();
        if (!replyText) {
          return {
            path: "handoff",
            intent: "ai_empty_reply",
            toolsUsed,
            tokens: totalTokens,
            handoff: true,
            reason: "Respuesta vacía de la IA",
            text: "",
          };
        }
        return {
          path: "ai",
          intent: toolsUsed[0] || "ai_general",
          toolsUsed,
          tokens: totalTokens,
          setPendingFlow: pendingFlowUpdate,
          text: replyText,
        };
      }

      const toolResultsText: string[] = [];
      for (const call of turn.toolCalls) {
        toolsUsed.push(call.name);
        const result = await toolRegistry.execute(call.name, call.arguments, {
          tenantId: ctx.tenantId,
          conversationId: ctx.conversation.id,
          verifiedCustomer: ctx.customer,
          setPendingFlow: (flow) => {
            pendingFlowUpdate = flow;
          },
          requestHandoff: (reason) => {
            handoffReason = reason;
          },
        });
        toolResultsText.push(`[Resultado de ${call.name}]: ${JSON.stringify(result)}`);
      }

      if (handoffReason) {
        return {
          path: "handoff",
          intent: "ai_handoff",
          toolsUsed,
          tokens: totalTokens,
          handoff: true,
          reason: handoffReason,
          text: "",
        };
      }

      currentInput = `${buildConversationTranscript(ctx)}\n\nHerramientas consultadas:\n${toolResultsText.join("\n")}\n\nRedacte la respuesta final para el cliente.`;
    }

    return {
      path: "handoff",
      intent: "ai_max_iterations",
      toolsUsed,
      tokens: totalTokens,
      handoff: true,
      reason: "Se alcanzó el límite de iteraciones de herramientas",
      text: "",
    };
  } catch (err) {
    console.warn("[Bot AI] Error en Gemini, aplicando fallback KB:", (err as Error).message);
    const fb = await knowledgeBaseFallback(ctx);
    return {
      ...fb,
      tokens: totalTokens,
    };
  }
}
