import fs from "fs";
import path from "path";
import { omnichannelDb as db } from "../messages/omnichannel-db";
import { getGeminiClient } from "./llm/gemini.client";
import { BotContext } from "./bot.types";

const MEDIA_DIR = path.resolve(process.cwd(), "data", "media");

export interface ParsedPaymentReceipt {
  isReceipt: boolean;
  method: string;
  amount: number;
  operationCode: string;
  receiptDate: string;
  senderName: string;
}

function resolveLocalMediaFile(mediaUrl: string): string | null {
  if (!mediaUrl) return null;
  const fileName = path.basename(mediaUrl.split("?")[0]);
  if (!fileName) return null;
  const fullPath = path.join(MEDIA_DIR, fileName);
  return fs.existsSync(fullPath) ? fullPath : null;
}

export function parseReceiptJson(rawText: string): ParsedPaymentReceipt | null {
  if (!rawText) return null;
  const match = rawText.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const obj = JSON.parse(match[0]);
    if (!obj || obj.isReceipt !== true) return null;
    return {
      isReceipt: true,
      method: String(obj.method || "transferencia").slice(0, 40),
      amount: Math.max(0, Number(obj.amount || 0)),
      operationCode: String(obj.operationCode || "").slice(0, 80),
      receiptDate: String(obj.receiptDate || "").slice(0, 60),
      senderName: String(obj.senderName || "").slice(0, 120),
    };
  } catch {
    return null;
  }
}

export async function transcribeAudioMessage(
  mediaUrl: string,
  mimeType = "audio/ogg"
): Promise<{ transcript: string; tokens: number } | null> {
  const gemini = getGeminiClient();
  if (!gemini.isConfigured() || !gemini.analyzeMedia) return null;
  const filePath = resolveLocalMediaFile(mediaUrl);
  if (!filePath) return null;

  const base64Data = fs.readFileSync(filePath).toString("base64");
  const res = await gemini.analyzeMedia({
    kind: "audio",
    mimeType: mimeType || "audio/ogg",
    base64Data,
    prompt:
      "Transcribe exactamente en español lo que dice esta nota de voz. Devuelve únicamente la transcripción, sin comentarios adicionales.",
  });
  if (!res || !res.text.trim()) return null;
  return { transcript: res.text.trim(), tokens: res.tokens };
}

export async function analyzePaymentReceiptImage(
  ctx: BotContext,
  mediaUrl: string,
  mimeType = "image/jpeg"
): Promise<{
  handled: boolean;
  replyText?: string;
  claimId?: number;
  tokens: number;
}> {
  const gemini = getGeminiClient();
  if (!gemini.isConfigured() || !gemini.analyzeMedia) {
    return { handled: false, tokens: 0 };
  }
  const filePath = resolveLocalMediaFile(mediaUrl);
  if (!filePath) return { handled: false, tokens: 0 };

  const base64Data = fs.readFileSync(filePath).toString("base64");
  const res = await gemini.analyzeMedia({
    kind: "image",
    mimeType: mimeType || "image/jpeg",
    base64Data,
    prompt:
      'Analiza si esta imagen es un comprobante de pago (Yape, Plin, transferencia bancaria o depósito). Responde ÚNICAMENTE con un JSON válido con esta forma: {"isReceipt": boolean, "method": "yape|plin|transferencia|otro", "amount": number, "operationCode": "string", "receiptDate": "string", "senderName": "string"}.',
  });
  if (!res) return { handled: false, tokens: 0 };

  const parsed = parseReceiptJson(res.text);
  if (!parsed) {
    return { handled: false, tokens: res.tokens };
  }

  const customerName = ctx.customer?.fullName || ctx.conversation.contactName || "Cliente";
  const ins = await db.query<{ id: number }>(
    `INSERT INTO bot_payment_claims
     (tenant_id, conversation_id, customer_id, customer_name, method, amount, operation_code, receipt_date, media_url, status, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending_validation', $10)
     RETURNING id`,
    [
      ctx.tenantId,
      ctx.conversation.id,
      ctx.customer?.id ?? null,
      customerName,
      parsed.method,
      parsed.amount,
      parsed.operationCode,
      parsed.receiptDate,
      mediaUrl,
      parsed.senderName ? `Titular leído: ${parsed.senderName}` : "",
    ]
  );

  const claimId = Number(ins.rows[0]?.id || 0);
  await db
    .query(
      `INSERT INTO conversation_notes (conversation_id, author_name, content, color)
       VALUES ($1, 'TurboBot', $2, '#10b981')`,
      [
        ctx.conversation.id,
        `Comprobante #${claimId} recibido (${parsed.method.toUpperCase()}) por ${parsed.amount.toFixed(
          2
        )}${parsed.operationCode ? ` · Op: ${parsed.operationCode}` : ""}. Pendiente de validación humana.`,
      ]
    )
    .catch(() => {});

  const replyText =
    `Hemos recibido su comprobante de pago #${claimId} (${parsed.method.toUpperCase()}` +
    `${parsed.amount > 0 ? ` por *${parsed.amount.toFixed(2)}*` : ""}` +
    `${parsed.operationCode ? `, operación *${parsed.operationCode}*` : ""}).\n\n` +
    `Su pago ha quedado *pendiente de validación* por nuestro equipo de cobranza. En cuanto sea confirmado, actualizaremos su estado de cuenta.`;

  return {
    handled: true,
    replyText,
    claimId,
    tokens: res.tokens,
  };
}
