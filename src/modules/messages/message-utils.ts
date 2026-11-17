// Utilidades puras (sin dependencias de Node ni del DOM) compartidas entre servidor, cliente y pruebas.

export type DeliveryStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed';

export const SEND_QUEUE_MAX_ATTEMPTS = 5;
export const SEND_QUEUE_MAX_AGE_MS = 30 * 60 * 1000;

/** Convierte el código numérico de Baileys (messages.update) al estado de entrega mostrado en la bandeja. */
export function deliveryStatusFromBaileys(status: number | undefined | null): DeliveryStatus {
  if (status === undefined || status === null) return 'sent';
  if (status >= 4) return 'read';
  if (status === 3) return 'delivered';
  return 'sent';
}

/** Evita que un estado "menor" (ej. sent) pise a uno mayor (ej. read) cuando llegan eventos desordenados. */
export function mergeDeliveryStatus(current: string | undefined, incoming: DeliveryStatus): DeliveryStatus {
  const rank: Record<string, number> = { failed: 0, queued: 1, sent: 2, delivered: 3, read: 4 };
  const cur = rank[current || 'sent'] ?? 2;
  return rank[incoming] >= cur ? incoming : ((current as DeliveryStatus) || incoming);
}

/** Los cuerpos de respaldo "[Foto]", "[Video]" o "[Documento: x]" no deben enviarse como pie de foto. */
export function captionForQueuedBody(body: string | null | undefined, mediaType: string | null | undefined): string {
  const text = String(body || '').trim();
  if (!mediaType || mediaType === 'none') return text;
  if (/^\[(Foto|Video|Audio|Sticker|Documento)(:[^\]]*)?( enviad[oa])?\]$/i.test(text)) return '';
  return text;
}

export function isQueuedMessageExpired(queuedAtMs: number, nowMs: number): boolean {
  return nowMs - queuedAtMs > SEND_QUEUE_MAX_AGE_MS;
}

/** Etiqueta para separadores de fecha en el chat: "Hoy", "Ayer", día de la semana o fecha completa. */
export function formatDateSeparatorLabel(date: Date, now: Date = new Date()): string {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((startOf(now) - startOf(date)) / dayMs);
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays > 1 && diffDays < 7) {
    const name = date.toLocaleDateString('es-PE', { weekday: 'long' });
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
}

/** Clave estable por día local para agrupar mensajes. */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export type MessageReaction = { emoji: string; by: 'agent' | 'contact' };

/** Una reacci�n por remitente: reemplaza la anterior; un emoji vac�o la quita. */
export function applyReaction(
  list: MessageReaction[] | null | undefined,
  by: 'agent' | 'contact',
  emoji: string
): MessageReaction[] {
  const base = Array.isArray(list) ? list.filter((r) => r && r.by !== by) : [];
  const clean = String(emoji || '').trim();
  return clean ? [...base, { emoji: clean, by }] : base;
}
