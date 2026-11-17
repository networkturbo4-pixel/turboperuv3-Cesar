import assert from "node:assert/strict";
import { ConversationDebouncer } from "../modules/bot/debouncer";
import { isWithinBusinessHours, runGuards, decideForContext } from "../modules/bot/bot.engine";
import { splitIntoChunks, cosineSimilarity } from "../modules/bot/knowledge-base.service";
import { parseReceiptJson } from "../modules/bot/media-processor";
import { toolRegistry } from "../modules/bot/tools/registry";
import { setGeminiClientForTest, resetGeminiClient, GeminiClientAdapter } from "../modules/bot/llm/gemini.client";
import { BotContext, BotSettings } from "../modules/bot/bot.types";

function makeSettings(overrides: Partial<BotSettings> = {}): BotSettings {
  return {
    tenantId: "turbonetwork",
    enabled: true,
    channels: ["whatsapp", "facebook", "instagram"],
    botName: "Turbo",
    personaPrompt: "Asistente formal.",
    businessHours: {
      timezone: "America/Lima",
      days: [1, 2, 3, 4, 5, 6],
      start: "08:00",
      end: "20:00",
      holidays: ["2026-12-25"],
    },
    outOfHoursMessage: "Fuera de horario.",
    handoffKeywords: ["asesor", "humano"],
    humanPauseMinutes: 30,
    debounceMs: 50,
    maxRepliesPerHour: 20,
    dailyTokenBudget: 100000,
    aiEnabled: true,
    ...overrides,
  };
}

function makeCtx(overrides: Partial<BotContext> = {}): BotContext {
  return {
    tenantId: "turbonetwork",
    conversation: {
      id: 10,
      channel: "whatsapp",
      contactName: "Juan Pérez",
      contactHandle: "+51999888777",
    },
    state: {
      conversationId: 10,
      tenantId: "turbonetwork",
      mode: "bot",
      pausedUntil: null,
      customerId: null,
      verified: false,
      pendingFlow: "",
      failedAttempts: 0,
      lastInteractionId: "",
    },
    customer: null,
    recentMessages: [
      {
        id: 1,
        senderType: "contact",
        senderName: "Juan Pérez",
        body: "Hola",
        mediaType: "none",
        createdAt: new Date().toISOString(),
      },
    ],
    latestUserText: "Hola",
    latestUserMessageId: 1,
    ...overrides,
  };
}

async function runBotTests() {
  console.log("🤖 Ejecutando suite de pruebas del Bot de Automatización (TurboBot)...");

  // 1. Debouncer agrupa ráfagas de 3 mensajes en 1 ejecución
  const deb = new ConversationDebouncer();
  let calls = 0;
  deb.schedule(1, 30, async () => { calls++; });
  deb.schedule(1, 30, async () => { calls++; });
  deb.schedule(1, 30, async () => { calls++; });
  await new Promise((r) => setTimeout(r, 90));
  assert.equal(calls, 1, "El debouncer debe agrupar 3 mensajes seguidos en 1 sola ejecución");
  deb.clearAll();
  console.log("  ✅ [1/7] Debounce de ráfagas verificado");

  // 2. Guardias: grupos, modo humano, pausa vigente y último emisor no-contact
  const settings = makeSettings();
  const groupGuard = await runGuards(
    makeCtx({
      conversation: { id: 1, channel: "whatsapp", contactName: "Grupo", contactHandle: "12345@g.us" },
    }),
    settings
  );
  assert.equal(groupGuard.skip, true);
  assert.equal(groupGuard.reason, "group_chat");

  const humanGuard = await runGuards(
    makeCtx({
      state: { ...makeCtx().state, mode: "human" },
    }),
    settings
  );
  assert.equal(humanGuard.skip, true);
  assert.equal(humanGuard.reason, "mode_human");

  const pausedGuard = await runGuards(
    makeCtx({
      state: { ...makeCtx().state, mode: "paused", pausedUntil: new Date(Date.now() + 60000).toISOString() },
    }),
    settings
  );
  assert.equal(pausedGuard.skip, true);
  assert.equal(pausedGuard.reason, "mode_paused");

  const selfLastGuard = await runGuards(
    makeCtx({
      recentMessages: [
        { id: 2, senderType: "bot", senderName: "Turbo", body: "Hola", mediaType: "none", createdAt: new Date().toISOString() },
      ],
    }),
    settings
  );
  assert.equal(selfLastGuard.skip, true);
  assert.equal(selfLastGuard.reason, "last_message_not_contact");
  console.log("  ✅ [2/7] Guardias de grupo, modo humano, pausa y anti-bucle verificadas");

  // 3. Horarios de atención configurables y feriados
  // 2026-11-17 es martes; 15:00 en Lima (UTC-5) = 20:00Z
  assert.equal(isWithinBusinessHours(settings, new Date("2026-11-17T20:00:00Z")), true);
  assert.equal(isWithinBusinessHours(settings, new Date("2026-11-17T03:00:00Z")), false); // 22:00 del día anterior en Lima
  assert.equal(isWithinBusinessHours(settings, new Date("2026-12-25T16:00:00Z")), false); // feriado
  console.log("  ✅ [3/7] Horario de atención y feriados verificados");

  // 4. Palabras de traspaso y menú determinista con trato de usted
  const handoffDec = await decideForContext(makeCtx({ latestUserText: "Quiero hablar con un asesor por favor" }), settings);
  assert.equal(handoffDec.path, "handoff");

  const menuDec = await decideForContext(makeCtx({ latestUserText: "Hola" }), settings);
  assert.equal(menuDec.path, "rule");
  assert.ok(menuDec.text.includes("ayudarle"), "Debe mantener trato formal de usted");

  const debtUnverified = await decideForContext(makeCtx({ latestUserText: "cuanto debo" }), settings);
  assert.equal(debtUnverified.path, "rule");
  assert.equal(debtUnverified.setPendingFlow, "await_dni");
  console.log("  ✅ [4/7] Reglas deterministas, trato de usted y flujo de verificación verificados");

  // 5. Seguridad de herramientas: get_my_balance_and_invoices sin cliente verificado
  const unverifiedToolRes = await toolRegistry.execute("get_my_balance_and_invoices", {}, {
    tenantId: "turbonetwork",
    conversationId: 10,
    verifiedCustomer: null,
    setPendingFlow: () => {},
    requestHandoff: () => {},
  });
  assert.ok(unverifiedToolRes.error, "No debe permitir consultar deuda sin cliente verificado");
  assert.equal(toolRegistry.getDeclarations(false).some((t) => t.name === "get_my_balance_and_invoices"), false);
  assert.equal(toolRegistry.getDeclarations(true).some((t) => t.name === "get_my_balance_and_invoices"), true);
  console.log("  ✅ [5/7] Aislamiento de herramientas por cliente verificado comprobado");

  // 6. Chunking y similitud coseno de Base de Conocimientos
  const chunks = splitIntoChunks("A".repeat(1700), 800, 100);
  assert.ok(chunks.length >= 2);
  assert.ok(Math.abs(cosineSimilarity([1, 0], [1, 0]) - 1) < 1e-6);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  console.log("  ✅ [6/7] Chunking y similitud coseno verificados");

  // 7. Orquestador Gemini simulado: tool calling + corte en 4 iteraciones
  let iterCallCount = 0;
  const mockSuccess: GeminiClientAdapter = {
    isConfigured: () => true,
    embedText: async () => null,
    runInteraction: async () => {
      iterCallCount++;
      if (iterCallCount === 1) {
        return {
          text: "",
          tokens: 120,
          toolCalls: [{ id: "c1", name: "list_plans", arguments: {} }],
          rawSteps: [],
        };
      }
      return {
        text: "Contamos con planes de fibra óptica desde 50 Mbps.",
        tokens: 80,
        toolCalls: [],
        rawSteps: [],
      };
    },
  };
  setGeminiClientForTest(mockSuccess);
  const aiDec = await decideForContext(
    makeCtx({ latestUserText: "Qué velocidades ofrecen para empresa?" }),
    settings
  );
  assert.equal(aiDec.path, "ai");
  assert.equal(aiDec.tokens, 200);
  assert.ok(aiDec.toolsUsed.includes("list_plans"));

  // Bucle infinito de herramientas -> debe cortar en 4 iteraciones y derivar a humano
  let loopCalls = 0;
  setGeminiClientForTest({
    isConfigured: () => true,
    embedText: async () => null,
    runInteraction: async () => {
      loopCalls++;
      return {
        text: "",
        tokens: 10,
        toolCalls: [{ id: `c${loopCalls}`, name: "list_plans", arguments: {} }],
        rawSteps: [],
      };
    },
  });
  const loopDec = await decideForContext(
    makeCtx({ latestUserText: "Pregunta compleja" }),
    settings
  );
  assert.equal(loopCalls, 4, "Debe cortar exactamente en 4 iteraciones");
  assert.equal(loopDec.path, "handoff");
  resetGeminiClient();
  console.log("  ✅ [7/7] Orquestador Gemini (tool calling y límite de 4 iteraciones) verificado");

  // 8. Fase 2: Herramientas de tickets, leads, recibos y parser de comprobantes
  const unverifiedDecls = toolRegistry.getDeclarations(false).map((t) => t.name);
  const verifiedDecls = toolRegistry.getDeclarations(true).map((t) => t.name);
  assert.ok(unverifiedDecls.includes("create_support_ticket"));
  assert.ok(unverifiedDecls.includes("register_installation_lead"));
  assert.equal(unverifiedDecls.includes("send_my_last_receipt"), false);
  assert.ok(verifiedDecls.includes("send_my_last_receipt"));

  const receipt = parseReceiptJson('```json\n{"isReceipt":true,"method":"yape","amount":65.5,"operationCode":"998877","receiptDate":"2026-11-17","senderName":"Juan"}\n```');
  assert.ok(receipt);
  assert.equal(receipt!.method, "yape");
  assert.equal(receipt!.amount, 65.5);
  assert.equal(parseReceiptJson('{"isReceipt":false}'), null);
  console.log("  ✅ [8/8] Fase 2: herramientas (tickets, leads, recibos) y lectura de comprobantes verificadas");

  console.log("\n🎉 Suite del Bot de Automatización completada exitosamente.");
  process.exit(0);
}

runBotTests().catch((err) => {
  console.error("❌ Falló la suite del Bot:", err);
  process.exit(1);
});
