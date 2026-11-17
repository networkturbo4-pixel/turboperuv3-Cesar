import { GoogleGenAI } from "@google/genai";
import { env } from "../../../config/env";

export interface GeminiToolDeclaration {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description: string }>;
    required?: string[];
  };
  type: "function";
}

export interface GeminiToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface GeminiTurnResult {
  text: string;
  tokens: number;
  toolCalls: GeminiToolCall[];
  rawSteps: any[];
}

export interface GeminiClientAdapter {
  isConfigured(): boolean;
  embedText(text: string): Promise<number[] | null>;
  analyzeMedia?(params: {
    mimeType: string;
    base64Data: string;
    prompt: string;
    kind: "image" | "audio";
  }): Promise<{ text: string; tokens: number } | null>;
  runInteraction(params: {
    systemInstruction: string;
    input: any;
    tools: GeminiToolDeclaration[];
    timeoutMs?: number;
  }): Promise<GeminiTurnResult>;
}

class RealGeminiClient implements GeminiClientAdapter {
  private client: GoogleGenAI | null = null;

  private getClient(): GoogleGenAI | null {
    const key = (env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || "").trim();
    if (!key) return null;
    if (!this.client) {
      this.client = new GoogleGenAI({ apiKey: key });
    }
    return this.client;
  }

  isConfigured(): boolean {
    return Boolean((env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || "").trim());
  }

  async embedText(text: string): Promise<number[] | null> {
    const ai = this.getClient();
    if (!ai) return null;
    try {
      const res = await ai.models.embedContent({
        model: env.BOT_EMBEDDING_MODEL || "gemini-embedding-001",
        contents: text.slice(0, 4000),
      });
      const values = res?.embeddings?.[0]?.values;
      return Array.isArray(values) && values.length > 0 ? values : null;
    } catch (err) {
      console.warn("[Bot Gemini] Error generando embedding:", (err as Error).message);
      return null;
    }
  }

  async analyzeMedia(params: {
    mimeType: string;
    base64Data: string;
    prompt: string;
    kind: "image" | "audio";
  }): Promise<{ text: string; tokens: number } | null> {
    const ai = this.getClient();
    if (!ai) return null;
    try {
      const mediaPart =
        params.kind === "audio"
          ? { type: "audio", data: params.base64Data, mime_type: params.mimeType }
          : { type: "image", data: params.base64Data, mime_type: params.mimeType };
      const interaction: any = await Promise.race([
        ai.interactions.create({
          model: env.BOT_MODEL || "gemini-3.8-flash",
          input: [{ type: "text", text: params.prompt }, mediaPart] as any,
          store: false,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Gemini media timeout")), 25000)
        ),
      ]);
      const text = String(interaction?.output_text || "").trim();
      const tokens = Number(interaction?.usage?.total_tokens || 0);
      return { text, tokens };
    } catch (err) {
      console.warn("[Bot Gemini] Error analizando media:", (err as Error).message);
      return null;
    }
  }

  async runInteraction(params: {
    systemInstruction: string;
    input: any;
    tools: GeminiToolDeclaration[];
    timeoutMs?: number;
  }): Promise<GeminiTurnResult> {
    const ai = this.getClient();
    if (!ai) {
      throw new Error("GEMINI_API_KEY no configurada");
    }

    const timeoutMs = params.timeoutMs ?? 20000;
    const call = ai.interactions.create({
      model: env.BOT_MODEL || "gemini-3.8-flash",
      system_instruction: params.systemInstruction,
      input: params.input,
      tools: params.tools as any,
      store: false,
    });

    const interaction: any = await Promise.race([
      call,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Gemini API timeout")), timeoutMs)
      ),
    ]);

    const steps = Array.isArray(interaction?.steps) ? interaction.steps : [];
    const outputs = Array.isArray(interaction?.outputs) ? interaction.outputs : [];
    const toolCalls: GeminiToolCall[] = [];

    for (const step of [...steps, ...outputs]) {
      if (step?.type === "function_call" && step?.name) {
        toolCalls.push({
          id: String(step.id || step.call_id || step.name),
          name: String(step.name),
          arguments:
            typeof step.arguments === "string"
              ? (() => {
                  try {
                    return JSON.parse(step.arguments);
                  } catch {
                    return {};
                  }
                })()
              : (step.arguments as Record<string, any>) || {},
        });
      }
    }

    const text =
      (typeof interaction?.output_text === "string" && interaction.output_text) ||
      outputs
        .filter((o: any) => o?.type === "text" && typeof o?.text === "string")
        .map((o: any) => o.text)
        .join("\n") ||
      "";

    const tokens = Number(interaction?.usage?.total_tokens || 0);
    return {
      text: text.trim(),
      tokens,
      toolCalls,
      rawSteps: steps,
    };
  }
}

let activeAdapter: GeminiClientAdapter = new RealGeminiClient();

export function getGeminiClient(): GeminiClientAdapter {
  return activeAdapter;
}

export function setGeminiClientForTest(adapter: GeminiClientAdapter): void {
  activeAdapter = adapter;
}

export function resetGeminiClient(): void {
  activeAdapter = new RealGeminiClient();
}
