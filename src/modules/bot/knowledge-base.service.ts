import { omnichannelDb as db } from "../messages/omnichannel-db";
import { loadTenantServices } from "../invoices/invoices.routes";
import { getGeminiClient } from "./llm/gemini.client";
import { KnowledgeArticle, KnowledgeSearchHit } from "./bot.types";

function normalizeText(raw: string): string {
  return String(raw || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitIntoChunks(text: string, maxChars = 800, overlap = 120): string[] {
  const clean = String(text || "").trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];

  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(clean.length, start + maxChars);
    if (end < clean.length) {
      const lastBreak = clean.lastIndexOf("\n", end);
      const lastSpace = clean.lastIndexOf(" ", end);
      if (lastBreak > start + maxChars * 0.5) end = lastBreak;
      else if (lastSpace > start + maxChars * 0.5) end = lastSpace;
    }
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks.filter(Boolean);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

function keywordScore(query: string, title: string, keywords: string[], chunkText: string): number {
  const qWords = normalizeText(query)
    .split(" ")
    .filter((w) => w.length >= 3);
  if (qWords.length === 0) return 0;

  const titleNorm = normalizeText(title);
  const kwNorm = keywords.map(normalizeText).join(" ");
  const bodyNorm = normalizeText(chunkText);

  let hits = 0;
  for (const w of qWords) {
    if (kwNorm.includes(w)) hits += 2.0;
    else if (titleNorm.includes(w)) hits += 1.5;
    else if (bodyNorm.includes(w)) hits += 1.0;
  }
  return Math.min(1, hits / (qWords.length * 1.8));
}

function mapArticleRow(row: any): KnowledgeArticle {
  let keywords: string[] = [];
  if (Array.isArray(row.keywords_json)) keywords = row.keywords_json.map(String);
  else if (typeof row.keywords_json === "string") {
    try {
      keywords = JSON.parse(row.keywords_json);
    } catch {
      keywords = [];
    }
  }
  return {
    id: Number(row.id),
    tenantId: row.tenant_id || "turbonetwork",
    title: row.title,
    category: row.category || "general",
    content: row.content,
    keywords,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
  };
}

export class KnowledgeBaseService {
  async ensureSeedArticles(tenantId: string): Promise<void> {
    const existing = await db.query(
      "SELECT id FROM kb_articles WHERE tenant_id = $1 LIMIT 1",
      [tenantId]
    );
    if ((existing.rowCount ?? 0) > 0) return;

    const services = loadTenantServices(tenantId) || [];
    const activePlans = services.filter((s: any) => s.isActive !== false);
    const plansBody =
      activePlans.length > 0
        ? activePlans
            .map(
              (p: any) =>
                `- ${p.name}: ${p.downloadSpeedMbps}/${p.uploadSpeedMbps} Mbps, precio ${p.currency || "$"}${p.price}/mes (${p.technology || "Fibra Óptica"}). ${p.details || ""}`
            )
            .join("\n")
        : "Consulte con un asesor por nuestros planes de fibra óptica disponibles en su zona.";

    const seeds = [
      {
        title: "Planes de Internet Disponibles",
        category: "planes",
        keywords: ["plan", "planes", "megas", "velocidad", "precio", "tarifa", "fibra"],
        content: `Contamos con los siguientes planes de internet:\n${plansBody}\nLa instalación se coordina según cobertura técnica en su dirección.`,
      },
      {
        title: "Medios de Pago y Envío de Comprobantes",
        category: "pagos",
        keywords: ["pago", "pagar", "yape", "plin", "transferencia", "cuenta", "banco", "comprobante"],
        content:
          "Puede realizar su pago mediante Yape, Plin o transferencia bancaria. Después de pagar, envíe la foto o captura de su comprobante por este mismo chat para que nuestro equipo lo valide y registre.",
      },
      {
        title: "Pasos Básicos si No Tiene Internet (Reinicio de Router)",
        category: "soporte",
        keywords: ["lento", "sin internet", "no tengo internet", "rojo", "los", "router", "onu", "wifi", "desconectado"],
        content:
          "Si no tiene conexión o está lenta: 1) Verifique que el router y la ONU tengan energía eléctrica. 2) Desenchufe ambos equipos por 30 segundos y vuelva a conectarlos. 3) Revise si el foco LOS o PON está parpadeando en rojo; si sigue en rojo, indíquenoslo por aquí para enviar soporte técnico.",
      },
      {
        title: "Horario de Atención",
        category: "general",
        keywords: ["horario", "horarios", "atienden", "atencion", "abierto", "sabado", "domingo"],
        content:
          "Nuestro equipo de atención al cliente atiende de lunes a sábado de 08:00 a 20:00. Fuera de ese horario nuestro asistente virtual sigue disponible para consultas de deuda, planes y reportes.",
      },
    ];

    for (const s of seeds) {
      await this.createArticle(tenantId, s);
    }
  }

  async listArticles(tenantId: string): Promise<KnowledgeArticle[]> {
    await this.ensureSeedArticles(tenantId);
    const res = await db.query(
      "SELECT * FROM kb_articles WHERE tenant_id = $1 ORDER BY id DESC",
      [tenantId]
    );
    return res.rows.map(mapArticleRow);
  }

  async createArticle(
    tenantId: string,
    input: { title: string; category?: string; content: string; keywords?: string[]; isActive?: boolean }
  ): Promise<KnowledgeArticle> {
    const res = await db.query(
      `INSERT INTO kb_articles (tenant_id, title, category, content, keywords_json, is_active)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)
       RETURNING *`,
      [
        tenantId,
        input.title.trim(),
        (input.category || "general").trim(),
        input.content.trim(),
        JSON.stringify(input.keywords || []),
        input.isActive !== false,
      ]
    );
    const article = mapArticleRow(res.rows[0]);
    await this.indexArticleChunks(article);
    return article;
  }

  async updateArticle(
    tenantId: string,
    id: number,
    input: Partial<{ title: string; category: string; content: string; keywords: string[]; isActive: boolean }>
  ): Promise<KnowledgeArticle | null> {
    const existingRes = await db.query(
      "SELECT * FROM kb_articles WHERE id = $1 AND tenant_id = $2 LIMIT 1",
      [id, tenantId]
    );
    if (!existingRes.rows[0]) return null;
    const cur = mapArticleRow(existingRes.rows[0]);
    const res = await db.query(
      `UPDATE kb_articles SET
        title = $1,
        category = $2,
        content = $3,
        keywords_json = $4::jsonb,
        is_active = $5,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 AND tenant_id = $7
       RETURNING *`,
      [
        input.title !== undefined ? input.title.trim() : cur.title,
        input.category !== undefined ? input.category.trim() : cur.category,
        input.content !== undefined ? input.content.trim() : cur.content,
        JSON.stringify(input.keywords !== undefined ? input.keywords : cur.keywords),
        input.isActive !== undefined ? input.isActive : cur.isActive,
        id,
        tenantId,
      ]
    );
    const updated = mapArticleRow(res.rows[0]);
    await this.indexArticleChunks(updated);
    return updated;
  }

  async deleteArticle(tenantId: string, id: number): Promise<boolean> {
    const res = await db.query(
      "DELETE FROM kb_articles WHERE id = $1 AND tenant_id = $2 RETURNING id",
      [id, tenantId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  async indexArticleChunks(article: KnowledgeArticle): Promise<number> {
    await db.query("DELETE FROM kb_chunks WHERE article_id = $1 AND tenant_id = $2", [
      article.id,
      article.tenantId,
    ]);
    if (!article.isActive) return 0;

    const chunks = splitIntoChunks(`${article.title}\n${article.content}`);
    const gemini = getGeminiClient();
    const canEmbed = gemini.isConfigured();

    let count = 0;
    for (const chunk of chunks) {
      const emb = canEmbed ? await gemini.embedText(chunk) : null;
      await db.query(
        `INSERT INTO kb_chunks (tenant_id, article_id, chunk_text, embedding_json)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [article.tenantId, article.id, chunk, emb ? JSON.stringify(emb) : null]
      );
      count++;
    }
    return count;
  }

  async reindexAll(tenantId: string): Promise<{ articles: number; chunks: number }> {
    const articles = await this.listArticles(tenantId);
    let chunks = 0;
    for (const art of articles) {
      chunks += await this.indexArticleChunks(art);
    }
    return { articles: articles.length, chunks };
  }

  async search(tenantId: string, query: string, topK = 4): Promise<KnowledgeSearchHit[]> {
    await this.ensureSeedArticles(tenantId);
    const rowsRes = await db.query<{
      article_id: number;
      title: string;
      category: string;
      keywords_json: any;
      chunk_text: string;
      embedding_json: any;
    }>(
      `SELECT c.article_id, a.title, a.category, a.keywords_json, c.chunk_text, c.embedding_json
       FROM kb_chunks c
       JOIN kb_articles a ON a.id = c.article_id
       WHERE c.tenant_id = $1 AND a.is_active = TRUE`,
      [tenantId]
    );

    if (rowsRes.rows.length === 0) return [];

    const gemini = getGeminiClient();
    const hasEmbeddings = rowsRes.rows.some((r) => Array.isArray(r.embedding_json) && r.embedding_json.length > 0);
    const queryEmb = hasEmbeddings && gemini.isConfigured() ? await gemini.embedText(query) : null;

    const scored: KnowledgeSearchHit[] = rowsRes.rows.map((r) => {
      let kw: string[] = [];
      if (Array.isArray(r.keywords_json)) kw = r.keywords_json.map(String);
      const kwScore = keywordScore(query, r.title, kw, r.chunk_text);

      let vecScore = 0;
      if (queryEmb && Array.isArray(r.embedding_json) && r.embedding_json.length === queryEmb.length) {
        vecScore = Math.max(0, cosineSimilarity(queryEmb, r.embedding_json));
      }

      const finalScore = queryEmb && vecScore > 0 ? vecScore * 0.75 + kwScore * 0.25 : kwScore;
      return {
        articleId: Number(r.article_id),
        title: r.title,
        category: r.category,
        chunkText: r.chunk_text,
        score: Number(finalScore.toFixed(4)),
      };
    });

    return scored
      .filter((h) => h.score > 0.12)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}

export const kbService = new KnowledgeBaseService();
