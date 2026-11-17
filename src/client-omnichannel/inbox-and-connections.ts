import {
  ChannelConnections,
  OmnichannelConversation,
  OmnichannelMessage,
  QuickReplyItem,
  CrmTagItem,
  ConversationNoteItem,
  UserItem,
} from './types';
import {
  formatSystemCurrency,
  showSystemToast,
  showSystemConfirmModal,
} from './theme-engine';
import { svgIcon, IconName, filledBrandIcon, BrandChannelName } from './icons';
import { openWhatsAppPhotoEditor } from './photo-editor';
import { computeCleanInitials } from '../modules/messages/handle-utils';
import { formatDateSeparatorLabel, dayKey } from '../modules/messages/message-utils';

export interface PendingMediaAttachment {
  media_type: 'image' | 'video' | 'audio' | 'document' | 'sticker';
  media_url: string;
  media_filename: string;
  media_mimetype: string;
}

export interface WaSyncStatus {
  active: boolean;
  channel?: 'all' | 'whatsapp' | 'instagram' | 'facebook' | 'tiktok';
  title?: string;
  detail?: string;
  pct?: number;
  chats: number;
  totalMessages: number;
  processedMessages: number;
  elapsedMs: number;
}

export interface OmnichannelSubState {
  waSync?: WaSyncStatus;
  connections: ChannelConnections | null;
  conversations: OmnichannelConversation[];
  messages: OmnichannelMessage[];
  quickReplies: QuickReplyItem[];
  tags: CrmTagItem[];
  notes: ConversationNoteItem[];
  users: UserItem[];
  selectedConversationId: number | null;
  channelFilter: 'all' | 'whatsapp' | 'facebook' | 'instagram' | 'tiktok';
  tagFilter: string;
  messageLimit?: number;
  messageSearch?: { open: boolean; query: string };
  searchQuery: string;
  sideDrawerTab: 'none' | 'notes' | 'tags';
  pendingAttachment: PendingMediaAttachment | null;
  replyingTo?: {
    id: number;
    sender: string;
    body: string;
    media_url?: string;
    media_type?: string;
  } | null;
  lastSentMessageId?: number | null;
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderDeliveryChecks(
  status?: 'queued' | 'sent' | 'delivered' | 'read' | 'failed',
  messageId?: number
): string {
  const currentStatus = status || 'read';
  if (currentStatus === 'queued') {
    return `
      <span class="msg-checks check-queued" title="Enviando… se reintentará automáticamente al reconectar" role="img" aria-label="Enviando">
        ${svgIcon('clock', 13)}
      </span>
    `;
  }
  if (currentStatus === 'failed') {
    return `
      <span class="msg-checks check-failed" role="img" aria-label="No se pudo enviar" title="No se pudo enviar a WhatsApp">
        ${svgIcon('alertTriangle', 13)}
      </span>
      <button type="button" class="msg-retry-btn js-retry-send" data-id="${messageId ?? ''}" aria-label="Reintentar envío">
        ${svgIcon('refresh', 11)}<span>Reintentar</span>
      </button>
    `;
  }
  if (currentStatus === 'sent') {
    return `
      <span class="msg-checks check-sent" title="Enviado">
        <svg width="15" height="15" viewBox="0 0 16 15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 8.5L6.5 12L13 3.5"/>
        </svg>
      </span>
    `;
  }
  if (currentStatus === 'delivered') {
    return `
      <span class="msg-checks check-delivered" title="Entregado">
        <svg width="18" height="15" viewBox="0 0 20 15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 8.5L5.5 12L12 3.5"/>
          <path d="M7 8.5L10.5 12L17 3.5"/>
        </svg>
      </span>
    `;
  }
  return `
    <span class="msg-checks check-read" title="Visto / Leído">
      <svg width="18" height="15" viewBox="0 0 20 15" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 8.5L5.5 12L12 3.5"/>
        <path d="M7 8.5L10.5 12L17 3.5"/>
      </svg>
    </span>
  `;
}

function mediaFailedBoxHtml(canRetry: boolean): string {
  return `
    <div class="wa-media-failed-box" role="group" aria-label="Multimedia no disponible">
      <span class="wa-media-failed-icon" aria-hidden="true">${svgIcon('image', 20)}</span>
      <span class="wa-media-failed-text">No se pudo descargar</span>
      ${
        canRetry
          ? `<button type="button" class="wa-media-retry-btn js-retry-media">${svgIcon('refresh', 12)}<span>Reintentar</span></button>`
          : ''
      }
    </div>
  `;
}

export function parseTagsJson(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((t) => String(t).trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function getTagColor(tagName: string, catalog: CrmTagItem[]): string {
  const found = catalog.find((t) => t.name.toLowerCase() === tagName.toLowerCase());
  return found?.color || '#6366f1';
}

export function renderMinimalTagPill(
  tagName: string,
  catalog: CrmTagItem[],
  extraClass = '',
  attrs = ''
): string {
  const color = getTagColor(tagName, catalog);
  return `<span class="tag-pill-minimal ${extraClass}" style="--tag-color:${color};" ${attrs}><span class="tag-dot"></span><span>${tagName}</span></span>`;
}

function readLocalFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo seleccionado'));
    reader.readAsDataURL(file);
  });
}

function detectMediaTypeFromMime(mime: string): 'image' | 'video' | 'audio' | 'document' {
  const m = (mime || '').toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  return 'document';
}

function mediaTypeIcon(type?: string): IconName {
  switch (type) {
    case 'image':
      return 'image';
    case 'video':
      return 'video';
    case 'audio':
      return 'music';
    case 'document':
      return 'fileText';
    default:
      return 'messageSquare';
  }
}

function mediaTypeLabel(type?: string): string {
  switch (type) {
    case 'image':
      return 'Foto';
    case 'video':
      return 'Video';
    case 'audio':
      return 'Audio';
    case 'document':
      return 'Documento';
    default:
      return 'Texto';
  }
}

function channelIconName(channel: OmnichannelConversation['channel']): IconName {
  switch (channel) {
    case 'whatsapp':
      return 'whatsapp';
    case 'facebook':
      return 'facebook';
    case 'instagram':
      return 'instagram';
    case 'tiktok':
      return 'tiktok';
  }
}

function channelLabel(channel: OmnichannelConversation['channel']): string {
  switch (channel) {
    case 'whatsapp':
      return 'WhatsApp';
    case 'facebook':
      return 'Facebook';
    case 'instagram':
      return 'Instagram';
    case 'tiktok':
      return 'TikTok';
  }
}

function waSyncProgress(s: WaSyncStatus): { pct: number; detail: string; title: string } {
  const total = s.totalMessages || 0;
  const computedPct = total > 0 ? Math.min(99, Math.round((s.processedMessages / total) * 100)) : 25;
  const pct = typeof s.pct === 'number' && s.pct > 0 ? s.pct : computedPct;

  let defaultTitle = 'Sincronizando mensajes';
  let defaultDetail = 'Descargando conversaciones y mensajes en tiempo real...';

  if (s.channel === 'whatsapp') {
    defaultTitle = 'Sincronizando chats de WhatsApp';
    defaultDetail =
      total > 0
        ? `${s.processedMessages.toLocaleString('es-PE')} de ${total.toLocaleString('es-PE')} mensajes · ${s.chats.toLocaleString('es-PE')} chats`
        : 'Conectando con WhatsApp y recibiendo chats...';
  } else if (s.channel === 'instagram') {
    defaultTitle = 'Sincronizando Instagram Direct';
    defaultDetail = 'Descargando conversaciones y respuestas de Instagram...';
  } else if (s.channel === 'facebook') {
    defaultTitle = 'Sincronizando Facebook Messenger';
    defaultDetail = 'Descargando conversaciones de la Fan Page comercial...';
  } else if (s.channel === 'all') {
    defaultTitle = 'Sincronizando todas las redes';
    defaultDetail = 'Descargando mensajes de WhatsApp, Instagram y Facebook...';
  }

  const title = s.title || defaultTitle;
  const detail = s.detail || defaultDetail;

  return { pct, detail, title };
}

function renderWaSyncBanner(s?: WaSyncStatus): string {
  if (!s || !s.active) return '';
  const { pct, detail, title } = waSyncProgress(s);
  return `
    <div class="wa-sync-banner" id="wa-sync-banner" role="status" aria-live="polite">
      <span class="wa-sync-spinner" aria-hidden="true"></span>
      <div class="wa-sync-text">
        <strong id="wa-sync-title">${title}</strong>
        <span id="wa-sync-detail">${detail}</span>
      </div>
      <div class="wa-sync-bar"><i id="wa-sync-bar-fill" style="width:${pct}%"></i></div>
    </div>
  `;
}

export interface LinkPreviewData {
  title: string;
  description: string;
  image: string;
  favicon?: string;
  domain: string;
  siteName: string;
  error?: string;
}

const linkPreviewClientCache = new Map<string, LinkPreviewData>();

function extractUrlsFromText(text: string): string[] {
  if (!text) return [];
  const urlRegex = /(https?:\/\/[^\s<>"']+)|(www\.[^\s<>"']+)/gi;
  const matches = text.match(urlRegex) || [];
  return matches.map((u) => (u.startsWith('http') ? u : `https://${u}`));
}

function renderFormattedMessageText(text: string): string {
  if (!text) return '';
  const escaped = escapeHtml(text);
  return escaped.replace(
    /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi,
    (url) => {
      const fullUrl = url.startsWith('http') ? url : `https://${url}`;
      return `<a href="${fullUrl}" target="_blank" rel="noopener noreferrer" class="chat-inline-link" onclick="event.stopPropagation();">${url}</a>`;
    }
  );
}

function renderLinkPreviewCardsHtml(text: string): string {
  const urls = extractUrlsFromText(text);
  if (urls.length === 0) return '';
  const firstUrl = urls[0];
  let domain = firstUrl;
  try {
    domain = new URL(firstUrl).hostname.replace(/^www\./, '');
  } catch {}

  const favicon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
  const cached = linkPreviewClientCache.get(firstUrl);
  if (cached) {
    const title = cached.title || domain;
    const desc = cached.description || '';
    const img = cached.image || '';

    return `
      <a href="${firstUrl}" target="_blank" rel="noopener noreferrer" class="wa-link-preview-card" onclick="event.stopPropagation();">
        ${
          img
            ? `<div class="wa-link-preview-img-box"><img src="${img}" alt="" class="wa-link-preview-img" loading="lazy" onerror="this.src='${favicon}'; this.className='wa-link-preview-fallback-favicon';" /></div>`
            : `<div class="wa-link-preview-img-box" style="background:rgba(0,0,0,0.04);display:flex;align-items:center;justify-content:center;height:60px;"><img src="${favicon}" alt="" class="wa-link-preview-fallback-favicon" style="width:32px;height:32px;" /></div>`
        }
        <div class="wa-link-preview-info">
          <strong class="wa-link-preview-title">${escapeHtml(title)}</strong>
          ${desc ? `<p class="wa-link-preview-desc">${escapeHtml(desc)}</p>` : ''}
          <span class="wa-link-preview-domain">${svgIcon('link', 11)} ${escapeHtml(cached.domain || domain)}</span>
        </div>
      </a>
    `;
  }

  return `
    <a href="${firstUrl}" target="_blank" rel="noopener noreferrer" class="wa-link-preview-card js-link-preview-target" data-url="${firstUrl}" onclick="event.stopPropagation();">
      <div class="wa-link-preview-info">
        <strong class="wa-link-preview-title">${escapeHtml(domain)}</strong>
        <span class="wa-link-preview-domain">${svgIcon('link', 11)} ${escapeHtml(domain)}</span>
      </div>
    </a>
  `;
}

async function fetchInboxHelper<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('nexus_crm_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as T;
}

async function hydrateLinkPreviews(): Promise<void> {
  const targets = document.querySelectorAll<HTMLElement>('.js-link-preview-target:not([data-hydrated])');
  targets.forEach(async (el) => {
    el.setAttribute('data-hydrated', 'true');
    const url = el.getAttribute('data-url');
    if (!url) return;

    try {
      let data = linkPreviewClientCache.get(url);
      if (!data) {
        data = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`).then((r) => r.json());
        if (data && !data.error) linkPreviewClientCache.set(url, data);
      }
      if (!data || data.error) return;

      let domain = data.domain || '';
      try {
        if (!domain) domain = new URL(url).hostname.replace(/^www\./, '');
      } catch {}

      const title = data.title || domain;
      const desc = data.description || '';
      const img = data.image || '';
      const favicon = data.favicon || `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;

      el.innerHTML = `
        ${
          img
            ? `<div class="wa-link-preview-img-box"><img src="${img}" alt="" class="wa-link-preview-img" loading="lazy" onerror="this.src='${favicon}'; this.className='wa-link-preview-fallback-favicon';" /></div>`
            : `<div class="wa-link-preview-img-box" style="background:rgba(0,0,0,0.04);display:flex;align-items:center;justify-content:center;height:60px;"><img src="${favicon}" alt="" class="wa-link-preview-fallback-favicon" style="width:32px;height:32px;" /></div>`
        }
        <div class="wa-link-preview-info">
          <strong class="wa-link-preview-title">${escapeHtml(title)}</strong>
          ${desc ? `<p class="wa-link-preview-desc">${escapeHtml(desc)}</p>` : ''}
          <span class="wa-link-preview-domain">${svgIcon('link', 11)} ${escapeHtml(data.domain || domain)}</span>
        </div>
      `;
    } catch {
      // Ignorar error y mantener tarjeta básica
    }
  });
}

function deliveryBadgeLabel(via: OmnichannelMessage['delivery_via']): string {
  switch (via) {
    case 'wa-qr':
      return 'WhatsApp';
    case 'wa-api':
      return 'WhatsApp API';
    case 'wa-chatbot':
      return 'Chatbot IA';
    case 'wa-broadcast':
      return 'Masivo API';
    case 'tiktok':
      return 'TikTok';
    default:
      return 'Meta Inbox';
  }
}

function renderMessageMediaHtml(m: OmnichannelMessage): string {
  const type = m.media_type || 'none';
  const url = m.media_url || '';
  if (type === 'none' || !url) return '';

  const filename = m.media_filename || 'archivo_adjunto';
  if (type === 'image') {
    // Las imágenes se procesan preferentemente como wa-standalone-image-card
    return `
      <div class="chat-media-attachment js-open-media-lightbox" data-media-type="image" data-media-url="${url}" data-media-title="${escapeHtml(filename)}" style="cursor:pointer;">
        <img src="${url}" alt="${escapeHtml(filename)}" loading="lazy" />
      </div>
    `;
  }
  if (type === 'video') {
    return `
      <div class="chat-media-attachment js-open-media-lightbox" data-media-type="video" data-media-url="${url}" data-media-title="${escapeHtml(filename)}" style="cursor:pointer;position:relative;border-radius:10px;overflow:hidden;background:#000;">
        <video src="${url}" preload="metadata" style="max-height:240px;width:100%;object-fit:cover;pointer-events:none;"></video>
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.35);">
          <span style="width:44px;height:44px;border-radius:50%;background:rgba(0,0,0,0.65);color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,0.4);">
            ${svgIcon('play', 20)}
          </span>
        </div>
      </div>
    `;
  }
  if (type === 'audio') {
    return `
      <div class="chat-media-attachment wa-audio-bubble" data-audio-src="${url}">
        <button type="button" class="wa-audio-play-btn js-wa-audio-toggle" aria-label="Reproducir nota de voz">
          ${svgIcon('play', 16)}
        </button>
        <div class="wa-audio-content">
          <div class="wa-audio-track-wrapper js-wa-audio-track">
            <div class="wa-audio-waveform-bars">
              ${[40, 65, 30, 85, 55, 95, 45, 75, 60, 90, 35, 70, 80, 50, 65, 85, 45, 95, 70, 40]
                .map((h) => `<span class="wa-wave-bar" style="height:${h}%;"></span>`)
                .join('')}
            </div>
            <div class="wa-audio-scrubber-track">
              <div class="wa-audio-scrubber-fill js-wa-audio-fill" style="width: 0%;"></div>
            </div>
          </div>
          <div class="wa-audio-meta-row">
            <span class="wa-audio-time-label js-wa-audio-time">0:00</span>
            <div style="display:flex;align-items:center;gap:0.4rem;">
              <button type="button" class="wa-audio-speed-btn js-wa-audio-speed" title="Velocidad de reproducción (1x, 1.5x, 2x)">1x</button>
              <span class="wa-audio-mic-indicator" title="Nota de voz">${svgIcon('mic', 12)}</span>
            </div>
          </div>
        </div>
        <audio class="wa-audio-native-tag" src="${url}" preload="metadata"></audio>
      </div>
    `;
  }
  return `
    <div class="chat-media-attachment">
      <div class="chat-media-doc-card js-open-media-lightbox" data-media-type="document" data-media-url="${url}" data-media-title="${escapeHtml(filename)}" style="cursor:pointer;display:flex;align-items:center;gap:0.6rem;">
        ${svgIcon('fileText', 20)}
        <div style="overflow:hidden;flex:1;">
          <strong style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(filename)}</strong>
          <span style="font-size:0.7rem;opacity:0.8;">Clic para visualizar o descargar</span>
        </div>
        <a href="${url}" download="${escapeHtml(filename)}" title="Descargar documento" style="color:inherit;padding:0.25rem;display:inline-flex;" onclick="event.stopPropagation();">
          ${svgIcon('download', 15)}
        </a>
      </div>
    </div>
  `;
}

// ============================================================================
// VISTA DEL MÓDULO PRINCIPAL: BANDEJA DE MENSAJES OMNICANAL TIPO WHATSAPP
// ============================================================================
export function renderOmnichannelInboxModuleHtml(
  sub: OmnichannelSubState,
  currencyCode: string,
  canCreate: boolean
): string {
  const conn = sub.connections || ({} as any);
  const filteredConvs = sub.conversations.filter((c) => {
    if (sub.channelFilter !== 'all' && c.channel !== sub.channelFilter) return false;
    if (sub.tagFilter && sub.tagFilter !== 'all') {
      const convTags = parseTagsJson(c.tags_json);
      const legacyMatch = c.tag && c.tag.toLowerCase() === sub.tagFilter.toLowerCase();
      if (!convTags.some((t) => t.toLowerCase() === sub.tagFilter.toLowerCase()) && !legacyMatch) {
        return false;
      }
    }
    if (sub.searchQuery.trim()) {
      const q = sub.searchQuery.toLowerCase();
      const convTags = parseTagsJson(c.tags_json).join(' ').toLowerCase();
      return (
        c.contact_name.toLowerCase().includes(q) ||
        c.contact_handle.toLowerCase().includes(q) ||
        c.last_message_text.toLowerCase().includes(q) ||
        convTags.includes(q)
      );
    }
    return true;
  });

  const activeConv =
    sub.selectedConversationId !== null
      ? filteredConvs.find((c) => c.id === sub.selectedConversationId) || null
      : null;

  const activeMessages = activeConv
    ? sub.messages.filter((m) => m.conversation_id === activeConv.id)
    : [];

  const activeNotes = activeConv
    ? sub.notes.filter((n) => n.conversation_id === activeConv.id)
    : [];

  const activeConvTags = activeConv ? parseTagsJson(activeConv.tags_json) : [];
  const assignedUser = activeConv?.assigned_user_id
    ? sub.users.find((u) => u.id === activeConv.assigned_user_id) || null
    : null;

  const convListHtml = filteredConvs
    .map((c) => {
      const isSelected = activeConv?.id === c.id;
      const initials = computeCleanInitials(c.contact_name, 'WA');

      const itemTags = parseTagsJson(c.tags_json);
      const visibleTags = itemTags.slice(0, 2);
      const extraTagsCount = Math.max(0, itemTags.length - 2);
      const assignedAgent = c.assigned_user_id
        ? sub.users.find((u) => u.id === c.assigned_user_id)
        : null;

      return `
        <button type="button" class="conv-item ${isSelected ? 'active' : ''} js-select-conv" data-conv-id="${c.id}">
          <div class="conv-avatar" style="background:${c.avatar_color};">
            <span>${initials || 'WA'}</span>
            <span class="conv-channel-badge ch-${c.channel}" title="${channelLabel(c.channel)}">
              ${svgIcon(channelIconName(c.channel), 11)}
            </span>
          </div>
          <div style="flex:1;overflow:hidden;min-width:0;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:0.4rem;">
              <strong style="font-size:0.86rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${c.contact_name}
              </strong>
              <span style="font-size:0.7rem;color:var(--text-muted);flex:none;">${c.last_message_time}</span>
            </div>
            <p style="font-size:0.78rem;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:0.12rem;">
              ${c.last_message_text}
            </p>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:0.35rem;margin-top:0.32rem;">
              <div class="conv-tags-inline">
                ${
                  visibleTags.length > 0
                    ? visibleTags.map((t) => renderMinimalTagPill(t, sub.tags)).join('')
                    : `<span style="font-size:0.67rem;color:var(--text-muted);">${c.contact_handle}</span>`
                }
                ${
                  extraTagsCount > 0
                    ? `<span class="tag-pill-minimal" style="--tag-color:var(--text-muted);">+${extraTagsCount}</span>`
                    : ''
                }
                ${
                  assignedAgent
                    ? `<span style="font-size:0.65rem;color:var(--text-muted);" title="Asignado a ${assignedAgent.full_name}">• ${assignedAgent.full_name.split(' ')[0]}</span>`
                    : ''
                }
              </div>
              ${
                c.unread_count > 0
                  ? `<span style="background:var(--btn-bg);color:var(--btn-text);font-size:0.66rem;font-weight:700;padding:0.06rem 0.42rem;border-radius:99px;flex:none;">
                      ${c.unread_count}
                    </span>`
                  : ''
              }
            </div>
          </div>
        </button>
      `;
    })
    .join('');

  const renderMessageRow = (m: OmnichannelMessage, idx: number): string => {
      const isIncoming = m.sender_type === 'contact';
      const isChatbot = m.sender_type === 'chatbot';
      const isLatest = idx === activeMessages.length - 1;
      const isAudio = m.media_type === 'audio';
      const isSticker = m.media_type === 'sticker' || Boolean(m.media_url?.includes('sticker'));
      const isImage = m.media_type === 'image' && !isSticker;
      const isVideo = m.media_type === 'video';

      // Caja de mensaje citado si responde a otro (con salto interactivo y miniatura de imagen)
      const hasQuoted = Boolean(m.reply_to_body || m.reply_to_media_url);
      const isQuotedImage = m.reply_to_media_type === 'image' || Boolean(m.reply_to_media_url);
      const quotedReplyHtml = hasQuoted
        ? `
          <div class="chat-quoted-box js-jump-to-reply" data-target-id="${m.reply_to_id || ''}" title="Clic para ir al mensaje citado">
            <div class="chat-quoted-inner">
              <div class="chat-quoted-sender">${escapeHtml(m.reply_to_sender || 'Mensaje')}</div>
              <div class="chat-quoted-body">
                ${isQuotedImage ? `<span style="display:inline-flex;align-items:center;gap:0.25rem;font-weight:600;">${svgIcon('image', 12)} Foto</span> ` : ''}
                ${escapeHtml(m.reply_to_body || (isQuotedImage ? 'Foto' : ''))}
              </div>
            </div>
            ${
              m.reply_to_media_url && isQuotedImage
                ? `
              <div class="chat-quoted-thumb-box">
                <img src="${m.reply_to_media_url}" class="chat-quoted-thumb" alt="" />
              </div>
            `
                : ''
            }
          </div>
        `
        : '';

      const isHighlight = m.id === sub.lastSentMessageId;
      const highlightClass = isHighlight ? 'chat-msg-highlight-pulse' : '';
      const isForwarded = Boolean(m.is_forwarded);
      const forwardedLabelHtml = isForwarded
        ? `<div class="chat-msg-forwarded-label">${svgIcon('cornerUpRight', 11)} <span>Reenviado</span></div>`
        : '';

      const reactionList: Array<{ emoji: string; by: string }> = Array.isArray(m.reactions_json) ? m.reactions_json : [];
      const reactionChipsHtml =
        reactionList.length > 0
          ? `<div class="msg-reactions" aria-label="Reacciones">${Object.entries(
              reactionList.reduce<Record<string, number>>((acc, r) => {
                acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                return acc;
              }, {})
            )
              .map(
                ([emoji, count]) =>
                  `<span class="msg-reaction-chip">${escapeHtml(emoji)}${count > 1 ? `<small>${count}</small>` : ''}</span>`
              )
              .join('')}</div>`
          : '';

      const actionsGroupHtml = `
        ${reactionChipsHtml}
        <div class="chat-msg-actions-group">
          <button
            type="button"
            class="chat-msg-action-btn js-react-msg"
            data-id="${m.id}"
            title="Reaccionar"
            aria-label="Reaccionar con emoji"
          >
            ${svgIcon('smile', 13)}
          </button>
          <button
            type="button"
            class="chat-msg-action-btn js-reply-msg"
            data-id="${m.id}"
            data-sender="${escapeHtml(m.sender_name)}"
            data-body="${escapeHtml(m.body || (m.media_type === 'image' ? 'Foto' : m.media_type ? `[${m.media_type}]` : ''))}"
            data-media-type="${m.media_type || 'none'}"
            data-media-url="${m.media_url || ''}"
            title="Responder"
          >
            ${svgIcon('cornerUpLeft', 13)}
          </button>
          <button
            type="button"
            class="chat-msg-action-btn js-forward-msg"
            data-id="${m.id}"
            data-sender="${escapeHtml(m.sender_name)}"
            data-body="${escapeHtml(m.body || '')}"
            data-media-type="${m.media_type || 'none'}"
            data-media-url="${m.media_url || ''}"
            data-media-filename="${escapeHtml(m.media_filename || '')}"
            title="Reenviar mensaje"
          >
            ${svgIcon('cornerUpRight', 13)}
          </button>
        </div>
      `;

      if (isAudio) {
        const audioUrl = m.media_url || '';
        return `
          <div class="chat-msg-row ${isIncoming ? 'incoming' : 'outgoing'} chat-audio-msg-row ${highlightClass}" data-id="${m.id}" data-sender="${escapeHtml(m.sender_name)}" data-body="[Nota de voz]" data-media-type="audio" data-media-url="${audioUrl}" data-is-incoming="${isIncoming}" data-is-deleted="${Boolean(m.is_deleted)}" data-is-edited="${Boolean(m.is_edited)}">
            <div class="chat-swipe-indicator-reply">${svgIcon('cornerUpLeft', 16)}</div>
            <div class="wa-standalone-audio-card wa-audio-bubble ${isLatest ? 'latest-target' : ''} ${isIncoming ? 'incoming' : 'outgoing'}" data-audio-src="${audioUrl}">
              ${forwardedLabelHtml}
              ${quotedReplyHtml}
              <div class="wa-standalone-audio-main">
                <button type="button" class="wa-audio-play-btn js-wa-audio-toggle" aria-label="Reproducir nota de voz">
                  ${svgIcon('play', 16)}
                </button>
                <div class="wa-audio-content">
                  <div class="wa-audio-track-wrapper js-wa-audio-track">
                    <div class="wa-audio-waveform-bars">
                      ${[40, 65, 30, 85, 55, 95, 45, 75, 60, 90, 35, 70, 80, 50, 65, 85, 45, 95, 70, 40]
                        .map((h) => `<span class="wa-wave-bar" style="height:${h}%;"></span>`)
                        .join('')}
                    </div>
                    <div class="wa-audio-scrubber-track">
                      <div class="wa-audio-scrubber-fill js-wa-audio-fill" style="width: 0%;"></div>
                    </div>
                  </div>
                  <div class="wa-audio-meta-row">
                    <span class="wa-audio-time-label js-wa-audio-time">0:00</span>
                    <div class="wa-audio-sub-meta">
                      <button type="button" class="wa-audio-speed-btn js-wa-audio-speed" title="Velocidad (1x, 1.5x, 2x)">1x</button>
                      <span class="wa-audio-mic-indicator" title="Nota de voz">${svgIcon('mic', 12)}</span>
                      <span class="wa-audio-time-stamp">${m.time_label}</span>
                      ${m.is_edited ? '<span class="chat-msg-edited-badge">editado</span>' : ''}
                      ${!isIncoming ? renderDeliveryChecks(m.delivery_status, m.id) : ''}
                    </div>
                  </div>
                </div>
              </div>
              ${actionsGroupHtml}
            </div>
          </div>
        `;
      }

      if (isSticker) {
        const stickerUrl = m.media_url || '';
        return `
          <div class="chat-msg-row ${isIncoming ? 'incoming' : 'outgoing'} chat-sticker-msg-row ${highlightClass}" data-id="${m.id}" data-sender="${escapeHtml(m.sender_name)}" data-body="[Sticker]" data-media-type="sticker" data-media-url="${stickerUrl}" data-is-incoming="${isIncoming}" data-is-deleted="${Boolean(m.is_deleted)}" data-is-edited="${Boolean(m.is_edited)}">
            <div class="chat-swipe-indicator-reply">${svgIcon('cornerUpLeft', 16)}</div>
            <div class="wa-standalone-sticker-card ${isLatest ? 'latest-target' : ''} ${isIncoming ? 'incoming' : 'outgoing'}">
              ${forwardedLabelHtml}
              ${quotedReplyHtml}
              <div class="wa-sticker-media-wrapper ${stickerUrl ? 'js-open-media-lightbox' : 'wa-media-failed'}" data-media-type="image" data-media-url="${stickerUrl}" data-media-title="Sticker de ${escapeHtml(m.sender_name)}">
                ${stickerUrl ? `<img src="${stickerUrl}" class="wa-sticker-img" alt="Sticker" loading="lazy" />` : mediaFailedBoxHtml(false)}
              </div>
              <div class="wa-sticker-meta-row">
                <span class="wa-sticker-time-badge">
                  <span>${m.time_label}</span>
                  ${m.is_edited ? '<span class="chat-msg-edited-badge">editado</span>' : ''}
                  ${!isIncoming ? renderDeliveryChecks(m.delivery_status, m.id) : ''}
                </span>
              </div>
              ${actionsGroupHtml}
            </div>
          </div>
        `;
      }

      if (isImage) {
        const imageUrl = m.media_url || '';
        const caption =
          m.body &&
          !m.body.startsWith('[Foto') &&
          m.body !== '[Foto enviada]' &&
          m.body !== 'null'
            ? m.body
            : '';
        return `
          <div class="chat-msg-row ${isIncoming ? 'incoming' : 'outgoing'} chat-image-msg-row ${highlightClass}" data-id="${m.id}" data-sender="${escapeHtml(m.sender_name)}" data-body="${escapeHtml(caption || 'Foto')}" data-media-type="image" data-media-url="${imageUrl}" data-is-incoming="${isIncoming}" data-is-deleted="${Boolean(m.is_deleted)}" data-is-edited="${Boolean(m.is_edited)}">
            <div class="chat-swipe-indicator-reply">${svgIcon('cornerUpLeft', 16)}</div>
            <div class="wa-standalone-image-card ${isLatest ? 'latest-target' : ''} ${isIncoming ? 'incoming' : 'outgoing'}">
              ${forwardedLabelHtml}
              ${quotedReplyHtml}
              <div class="wa-image-media-wrapper ${imageUrl ? 'js-open-media-lightbox' : 'wa-media-failed'}" data-media-type="image" data-media-url="${imageUrl}" data-media-title="${escapeHtml(m.media_filename || 'Foto de WhatsApp')}">
                ${imageUrl ? `<img src="${imageUrl}" alt="${escapeHtml(m.media_filename || 'Foto')}" class="wa-standalone-image-el" loading="lazy" />` : mediaFailedBoxHtml(false)}
                <div class="wa-image-gradient-overlay">
                  <span class="wa-image-time-stamp">${m.time_label}</span>
                  ${m.is_edited ? '<span class="chat-msg-edited-badge">editado</span>' : ''}
                  ${!isIncoming ? renderDeliveryChecks(m.delivery_status, m.id) : ''}
                </div>
              </div>
              ${caption ? `<div class="wa-image-caption-text">${renderFormattedMessageText(caption)}</div>` : ''}
              ${caption ? renderLinkPreviewCardsHtml(caption) : ''}
              ${actionsGroupHtml}
            </div>
          </div>
        `;
      }

      if (isVideo) {
        const videoUrl = m.media_url || '';
        const caption =
          m.body &&
          !m.body.startsWith('[Video') &&
          m.body !== '[Video enviado]' &&
          m.body !== 'null'
            ? m.body
            : '';
        return `
          <div class="chat-msg-row ${isIncoming ? 'incoming' : 'outgoing'} chat-video-msg-row ${highlightClass}" data-id="${m.id}" data-sender="${escapeHtml(m.sender_name)}" data-body="${escapeHtml(caption || 'Video')}" data-media-type="video" data-media-url="${videoUrl}" data-is-incoming="${isIncoming}" data-is-deleted="${Boolean(m.is_deleted)}" data-is-edited="${Boolean(m.is_edited)}">
            <div class="chat-swipe-indicator-reply">${svgIcon('cornerUpLeft', 16)}</div>
            <div class="wa-standalone-video-card ${isLatest ? 'latest-target' : ''} ${isIncoming ? 'incoming' : 'outgoing'}">
              ${forwardedLabelHtml}
              ${quotedReplyHtml}
              <div class="wa-video-media-wrapper ${videoUrl ? 'js-open-media-lightbox' : 'wa-media-failed'}" data-media-type="video" data-media-url="${videoUrl}" data-media-title="${escapeHtml(m.media_filename || 'Video de WhatsApp')}">
                <video src="${videoUrl}" preload="metadata" playsinline class="wa-standalone-video-el" style="max-height:260px;width:100%;object-fit:cover;border-radius:10px;background:#000;display:block;"></video>
                <div class="wa-video-play-overlay">
                  <span class="wa-video-center-btn" title="Reproducir en Visor Moderno">
                    ${svgIcon('play', 26)}
                  </span>
                </div>
                <div class="wa-video-gradient-overlay">
                  <span class="wa-video-time-stamp">${m.time_label}</span>
                  ${m.is_edited ? '<span class="chat-msg-edited-badge">editado</span>' : ''}
                  ${!isIncoming ? renderDeliveryChecks(m.delivery_status, m.id) : ''}
                </div>
              </div>
              ${caption ? `<div class="wa-video-caption-text">${renderFormattedMessageText(caption)}</div>` : ''}
              ${caption ? renderLinkPreviewCardsHtml(caption) : ''}
              ${actionsGroupHtml}
            </div>
          </div>
        `;
      }

      // Mensaje estándar (no audio, no imagen standalone, no video standalone)
      const cleanBody = m.body && m.body !== '[Audio enviado]' ? m.body : '';
      const previewCardsHtml = cleanBody ? renderLinkPreviewCardsHtml(cleanBody) : '';
      return `
        <div class="chat-msg-row ${isIncoming ? 'incoming' : 'outgoing'} ${isChatbot ? 'is-chatbot' : ''} ${highlightClass}" data-id="${m.id}" data-sender="${escapeHtml(m.sender_name)}" data-body="${escapeHtml(cleanBody)}" data-media-type="${m.media_type || 'none'}" data-media-url="${m.media_url || ''}" data-is-incoming="${isIncoming}" data-is-deleted="${Boolean(m.is_deleted)}" data-is-edited="${Boolean(m.is_edited)}">
          <div class="chat-swipe-indicator-reply">${svgIcon('cornerUpLeft', 16)}</div>
          <div class="chat-msg-bubble ${isLatest ? 'latest-target' : ''}">
            ${forwardedLabelHtml}
            <div style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;margin-bottom:0.25rem;font-size:0.7rem;opacity:0.82;">
              <strong style="display:inline-flex;align-items:center;gap:0.3rem;">
                ${isChatbot ? svgIcon('bot', 12) : m.sender_type === 'broadcast' ? svgIcon('megaphone', 12) : ''}
                <span>${m.sender_name}</span>
              </strong>
              <span>${deliveryBadgeLabel(m.delivery_via)}</span>
            </div>
            ${quotedReplyHtml}
            ${renderMessageMediaHtml(m)}
            ${m.is_deleted ? `<div style="font-style:italic;opacity:0.72;display:flex;align-items:center;gap:0.35rem;">🚫 Este mensaje fue eliminado</div>` : (cleanBody ? `<div style="white-space:pre-wrap;word-break:break-word;">${renderFormattedMessageText(cleanBody)}</div>` : '')}
            ${!m.is_deleted ? previewCardsHtml : ''}
            <div class="chat-msg-footer-row">
              <span class="chat-msg-time">${m.time_label}</span>
              ${m.is_edited ? '<span class="chat-msg-edited-badge">editado</span>' : ''}
              ${!isIncoming ? renderDeliveryChecks(m.delivery_status, m.id) : ''}
            </div>
            ${actionsGroupHtml}
          </div>
        </div>
      `;
  };

  let lastSeparatorDay = '';
  const messagesHtml = activeMessages
    .map((m, idx) => {
      let separatorHtml = '';
      const parsed = m.created_at ? new Date(m.created_at) : null;
      if (parsed && !Number.isNaN(parsed.getTime())) {
        const key = dayKey(parsed);
        if (key !== lastSeparatorDay) {
          lastSeparatorDay = key;
          separatorHtml = `<div class="chat-date-separator" role="separator"><span>${formatDateSeparatorLabel(parsed)}</span></div>`;
        }
      }
      return separatorHtml + renderMessageRow(m, idx);
    })
    .join('');

  const showNotifBanner =
    typeof Notification !== 'undefined' &&
    Notification.permission === 'default' &&
    !sessionStorage.getItem('nexus_dismiss_notif_banner');

  return `
    <div class="inbox-workspace-100vh">
      <header class="inbox-compact-header">
        <div class="inbox-header-title-box" style="display:flex;align-items:center;gap:0.65rem;flex-wrap:wrap;">
          <h1 style="font-size:1.2rem;font-weight:700;margin:0;color:var(--text-primary);">Bandeja de mensajes</h1>
          ${
            conn.wa_active_mode === 'qr'
              ? `<span id="inbox-wa-live-pill" class="tag-pill-minimal" style="--tag-color:${conn.wa_qr_status === 'connected' ? '#10b981' : '#f59e0b'};">
                  <span class="tag-dot" id="inbox-wa-live-dot"></span>
                  <span id="inbox-wa-live-label">${conn.wa_qr_status === 'connected' ? 'WhatsApp en vivo' : conn.wa_qr_status === 'reconnecting' ? 'Reconectando...' : 'QR pendiente'}</span>
                </span>`
              : ''
          }
        </div>

        <!-- Menú Desplegable para PC con las Opciones de Bandeja -->
        <div class="inbox-pc-dropdown-wrapper">
          <button type="button" class="btn btn-secondary btn-sm" id="btn-inbox-pc-menu" style="gap:0.45rem;">
            ${svgIcon('sliders', 14)}
            <span>Opciones</span>
            ${svgIcon('chevronDown', 11)}
          </button>
          <div class="inbox-pc-dropdown-menu" id="inbox-pc-dropdown-menu" style="display:none;">
            <button type="button" class="inbox-dropdown-item js-opt-new-contact">
              ${svgIcon('plus', 14)}
              <span>Añadir contacto / Iniciar chat</span>
            </button>
            <button type="button" class="inbox-dropdown-item js-opt-sync-all">
              ${svgIcon('refresh', 14)}
              <span>Sincronizar Todas las Redes</span>
            </button>
            <button type="button" class="inbox-dropdown-item js-opt-sync-wa">
              ${svgIcon('whatsapp', 14)}
              <span>Sincronizar WhatsApp</span>
            </button>
            <button type="button" class="inbox-dropdown-item js-opt-sync-ig">
              ${svgIcon('instagram', 14)}
              <span>Sincronizar Instagram Direct</span>
            </button>
            <button type="button" class="inbox-dropdown-item js-opt-sync-fb">
              ${svgIcon('facebook', 14)}
              <span>Sincronizar Facebook</span>
            </button>
            <button type="button" class="inbox-dropdown-item js-opt-quick-replies">
              ${svgIcon('zap', 14)}
              <span>Respuestas Rápidas (/)</span>
            </button>
            <button type="button" class="inbox-dropdown-item js-opt-tags">
              ${svgIcon('tag', 14)}
              <span>Etiquetas</span>
            </button>
            <div class="inbox-dropdown-divider"></div>
            <button type="button" class="inbox-dropdown-item js-opt-broadcast" style="color:var(--btn-bg);">
              ${svgIcon('megaphone', 14)}
              <strong>Mensaje Masivo</strong>
            </button>
          </div>
        </div>
      </header>

      ${
        showNotifBanner
          ? `
        <div class="inbox-notification-permission-banner" id="inbox-notification-banner">
          <div style="display:flex;align-items:center;gap:0.6rem;">
            <span class="inbox-notif-bell-icon">${svgIcon('bell', 16)}</span>
            <div style="font-size:0.8rem;line-height:1.3;">
              <strong>Activa las notificaciones en tiempo real</strong>
              <span style="opacity:0.85;display:block;">Recibe alertas sonoras y emergentes en tu navegador o celular APK cuando lleguen nuevos mensajes.</span>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:0.4rem;">
            <button type="button" class="btn btn-primary btn-sm" id="btn-request-notif-permission">Activar</button>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-dismiss-notif-banner" title="Ocultar">${svgIcon('close', 13)}</button>
          </div>
        </div>
      `
          : ''
      }

      ${renderWaSyncBanner(sub.waSync)}

      <!-- Contenedor tipo WhatsApp Web compacto a 100dvh -->
      <div class="omnichannel-shell">
        <!-- Columna Izquierda: Lista de Conversaciones, Filtros de Red y Filtro Minimalista de Etiquetas -->
        <aside class="inbox-sidebar">
          <div class="inbox-filter-bar">
            <input
              type="search"
              id="inbox-search-input"
              class="form-control"
              placeholder="Buscar contacto, número, mensaje o etiqueta..."
              value="${sub.searchQuery}"
              style="padding:0.42rem 0.68rem;font-size:0.82rem;"
            />
            <div class="channel-pills-row" role="tablist" aria-label="Filtrar por canal de mensajería">
              ${(
                [
                  { id: 'all', label: 'Todos los canales' },
                  { id: 'whatsapp', label: 'WhatsApp' },
                  { id: 'facebook', label: 'Facebook Messenger' },
                  { id: 'instagram', label: 'Instagram DM' },
                  { id: 'tiktok', label: 'TikTok Direct' },
                ] as const
              )
                .map(
                  (tab) => `
                  <button
                    type="button"
                    class="channel-filter-pill ${sub.channelFilter === tab.id ? 'active' : ''} js-filter-channel"
                    data-channel="${tab.id}"
                    title="${tab.label}"
                    aria-label="${tab.label}"
                  >
                    ${filledBrandIcon(tab.id, 18)}
                  </button>
                `
                )
                .join('')}
            </div>

            <!-- Filtro rápido por Etiquetas Minimalistas -->
            <div style="display:flex;align-items:center;flex-wrap:wrap;gap:0.3rem;overflow:visible;padding-bottom:0.15rem;">
              <button
                type="button"
                class="tag-pill-minimal interactive ${!sub.tagFilter || sub.tagFilter === 'all' ? 'active-filter' : ''} js-filter-tag"
                data-tag=""
                style="--tag-color:var(--widget-accent);"
              >
                <span>Todas (${sub.conversations.length})</span>
              </button>
              ${sub.tags
                .map((t) =>
                  renderMinimalTagPill(
                    t.name,
                    sub.tags,
                    `interactive ${sub.tagFilter.toLowerCase() === t.name.toLowerCase() ? 'active-filter' : ''} js-filter-tag`,
                    `data-tag="${t.name}" role="button" tabindex="0"`
                  )
                )
                .join('')}
            </div>
          </div>

          <div class="inbox-conversations-list">
            ${
              convListHtml ||
              (() => {
                if (sub.channelFilter === 'facebook') {
                  if (!conn.fb_connected) {
                    return `
                      <div class="inbox-empty-channel-box">
                        <span class="empty-icon-circle fb">${svgIcon('facebook', 30)}</span>
                        <strong>Facebook no conectado</strong>
                        <p>Para recibir y responder mensajes de tu Fan Page comercial, conéctala en la pestaña de Conexiones.</p>
                        <button type="button" class="btn btn-primary btn-sm js-goto-connections" style="margin-top:0.35rem;">
                          ${svgIcon('settings', 14)} <span>Configurar Facebook</span>
                        </button>
                      </div>
                    `;
                  }
                  return `
                    <div class="inbox-empty-channel-box">
                      <span class="empty-icon-circle fb">${svgIcon('facebook', 30)}</span>
                      <strong>Sin chats descargados</strong>
                      <p>Página "${conn.fb_page_name || 'Facebook'}" vinculada. Haz clic en sincronizar para descargar las conversaciones activas.</p>
                      <button type="button" class="btn btn-primary btn-sm js-opt-sync-fb" style="margin-top:0.35rem;">
                        ${svgIcon('refresh', 14)} <span>Sincronizar Facebook</span>
                      </button>
                    </div>
                  `;
                }

                if (sub.channelFilter === 'instagram') {
                  return `
                    <div class="inbox-empty-channel-box">
                      <span class="empty-icon-circle ig">${svgIcon('instagram', 30)}</span>
                      <strong>${conn.ig_connected ? 'Sin mensajes de Instagram' : 'Instagram sin activar'}</strong>
                      <p>${conn.ig_connected ? 'No hay mensajes directos nuevos registrados aún.' : 'Conecta tu cuenta profesional de Instagram en Configuración para atender DMs e historias.'}</p>
                      ${
                        !conn.ig_connected
                          ? `<button type="button" class="btn btn-primary btn-sm js-goto-connections" style="margin-top:0.35rem;">
                              ${svgIcon('settings', 14)} <span>Configurar Instagram</span>
                            </button>`
                          : `<button type="button" class="btn btn-primary btn-sm js-opt-sync-ig" style="margin-top:0.35rem;">
                              ${svgIcon('refresh', 14)} <span>Sincronizar Instagram</span>
                            </button>`
                      }
                    </div>
                  `;
                }

                if (sub.channelFilter === 'tiktok') {
                  return `
                    <div class="inbox-empty-channel-box">
                      <span class="empty-icon-circle tt">${svgIcon('tiktok', 30)}</span>
                      <strong>${conn.tt_connected ? 'Sin mensajes de TikTok' : 'TikTok Business sin activar'}</strong>
                      <p>${conn.tt_connected ? 'No hay mensajes o leads nuevos registrados aún.' : 'Conecta tu perfil comercial de TikTok en Configuración para atender mensajes y leads.'}</p>
                      ${
                        !conn.tt_connected
                          ? `<button type="button" class="btn btn-primary btn-sm js-goto-connections" style="margin-top:0.35rem;">
                              ${svgIcon('settings', 14)} <span>Configurar TikTok</span>
                            </button>`
                          : ''
                      }
                    </div>
                  `;
                }

                if (sub.channelFilter === 'whatsapp') {
                  if (conn.wa_qr_status !== 'connected') {
                    return `
                      <div class="inbox-empty-channel-box">
                        <span class="empty-icon-circle wa">${svgIcon('whatsapp', 30)}</span>
                        <strong>WhatsApp no vinculado</strong>
                        <p>Escanea el código QR en Conexiones para vincular tu WhatsApp Normal o Business.</p>
                        <button type="button" class="btn btn-primary btn-sm js-goto-connections" style="margin-top:0.35rem;">
                          ${svgIcon('settings', 14)} <span>Vincular WhatsApp</span>
                        </button>
                      </div>
                    `;
                  }
                  return `
                    <div class="inbox-empty-channel-box">
                      <span class="empty-icon-circle wa">${svgIcon('whatsapp', 30)}</span>
                      <strong>WhatsApp Vinculado y Activo</strong>
                      <p>Número vinculado: ${conn.wa_qr_phone || 'WhatsApp'}. Los mensajes entrantes o salientes se mostrarán aquí en vivo.</p>
                      <div style="display:flex;gap:0.4rem;flex-wrap:wrap;justify-content:center;margin-top:0.35rem;">
                        <button type="button" class="btn btn-secondary btn-sm js-opt-sync-wa">
                          ${svgIcon('refresh', 14)} <span>Sincronizar</span>
                        </button>
                        <button type="button" class="btn btn-primary btn-sm js-opt-new-contact">
                          ${svgIcon('plus', 14)} <span>Iniciar Chat</span>
                        </button>
                      </div>
                    </div>
                  `;
                }

                return `
                  <div class="inbox-empty-sidebar" style="padding:2.5rem 1.25rem;text-align:center;color:var(--text-muted);font-size:0.84rem;display:flex;flex-direction:column;align-items:center;gap:0.75rem;">
                    <span style="opacity:0.55;color:var(--widget-accent);">${svgIcon('messageSquare', 34)}</span>
                    <strong style="color:var(--text-primary);font-size:0.95rem;">Bandeja vacía</strong>
                    <span style="line-height:1.45;max-width:240px;">No hay conversaciones activas en este filtro.</span>
                    <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:0.5rem;margin-top:0.35rem;">
                      <button type="button" class="btn btn-primary btn-sm js-opt-new-contact">
                        ${svgIcon('plus', 14)} <span>Iniciar Chat</span>
                      </button>
                      <button type="button" class="btn btn-secondary btn-sm js-opt-sync-all">
                        ${svgIcon('refresh', 14)} <span>Sincronizar</span>
                      </button>
                    </div>
                  </div>
                `;
              })()
            }
          </div>
        </aside>

        <!-- Columna Derecha: Hilo de Mensajes, Compositor con Comandos / y Panel Lateral de Notas y Etiquetas -->
        <section class="chat-pane">
          ${
            activeConv
              ? `
            <div class="chat-contact-bar">
              <div style="display:flex;align-items:center;gap:0.55rem;min-width:0;">
                <button type="button" class="chat-mobile-back-btn js-chat-back-to-list" title="Regresar a la lista de chats">
                  ${svgIcon('arrowLeft', 18)}
                </button>
                <div class="conv-avatar" style="background:${activeConv.avatar_color};width:36px;height:36px;font-size:0.82rem;">
                  <span>${computeCleanInitials(activeConv.contact_name, 'WA')}</span>
                  <span class="conv-channel-badge ch-${activeConv.channel}">
                    ${svgIcon(channelIconName(activeConv.channel), 10)}
                  </span>
                </div>
                <div style="min-width:0;">
                  <div style="display:flex;align-items:center;gap:0.45rem;flex-wrap:wrap;">
                    <strong style="font-size:0.92rem;">${activeConv.contact_name}</strong>
                    <span style="font-size:0.74rem;color:var(--text-muted);">(${activeConv.contact_handle})</span>
                    ${
                      assignedUser
                        ? `<span class="tag-pill-minimal" style="--tag-color:#10b981;" title="Agente responsable asignado">
                            <span class="tag-dot"></span>
                            <span>Agente: ${assignedUser.full_name.split(' ')[0]}</span>
                          </span>`
                        : ''
                    }
                  </div>
                  <div style="display:flex;align-items:center;gap:0.3rem;flex-wrap:wrap;margin-top:0.2rem;">
                    ${
                      activeConvTags.length > 0
                        ? activeConvTags.map((t) => renderMinimalTagPill(t, sub.tags)).join('')
                        : `<span style="font-size:0.71rem;color:var(--text-muted);">Sin etiquetas asignadas</span>`
                    }
                  </div>
                </div>
              </div>

              <div class="chat-contact-actions">
                <button
                  type="button"
                  class="chat-header-action-btn ${sub.messageSearch?.open ? 'active' : ''}"
                  id="btn-toggle-chat-search"
                  title="Buscar en la conversación"
                  aria-label="Buscar en la conversación"
                  aria-expanded="${sub.messageSearch?.open ? 'true' : 'false'}"
                >
                  ${svgIcon('search', 15)}
                  <span class="chat-btn-label-desktop">Buscar</span>
                </button>
                <button
                  type="button"
                  class="chat-header-action-btn ${sub.sideDrawerTab === 'tags' ? 'active' : ''}"
                  id="btn-toggle-side-drawer-tags"
                  title="Etiquetas (${activeConvTags.length})"
                  aria-label="Etiquetas de la conversación"
                >
                  ${svgIcon('tag', 15)}
                  <span class="chat-btn-label-desktop">Etiquetas (${activeConvTags.length})</span>
                  ${activeConvTags.length > 0 ? `<span class="chat-btn-badge-mobile">${activeConvTags.length}</span>` : ''}
                </button>
                <button
                  type="button"
                  class="chat-header-action-btn ${sub.sideDrawerTab === 'notes' ? 'active' : ''}"
                  id="btn-toggle-side-drawer-notes"
                  title="Notas Aparte (${activeNotes.length})"
                  aria-label="Notas internas del cliente"
                >
                  ${svgIcon('stickyNote', 15)}
                  <span class="chat-btn-label-desktop">Notas Aparte (${activeNotes.length})</span>
                  ${activeNotes.length > 0 ? `<span class="chat-btn-badge-mobile">${activeNotes.length}</span>` : ''}
                </button>
              </div>
            </div>

            <!-- Cuerpo dividido: Mensajes + Drawer Lateral (Notas Aparte / Etiquetas) -->
            <div class="chat-body-split">
              <div class="chat-main-column" id="chat-main-column">
                <!-- Dropzone Overlay para Arrastrar y Soltar Archivos (Fotos, Videos, Audios, Docs) -->
                <div class="chat-dropzone-overlay" id="chat-dropzone-overlay" style="display:none;">
                  <div class="chat-dropzone-inner">
                    ${svgIcon('uploadCloud', 42)}
                    <h4>Suelte aquí sus archivos</h4>
                    <p>Arrastre imágenes, notas de audio, videos o documentos para enviar a este chat</p>
                  </div>
                </div>

                ${
                  sub.messageSearch?.open
                    ? `<div class="chat-search-bar" role="search">
                        <label for="chat-search-input" class="visually-hidden-label">Buscar en la conversación</label>
                        ${svgIcon('search', 14)}
                        <input type="search" id="chat-search-input" class="chat-search-input" placeholder="Buscar en los mensajes cargados…" value="${escapeHtml(sub.messageSearch.query || '')}" autocomplete="off" />
                        <span class="chat-search-count" id="chat-search-count" aria-live="polite"></span>
                        <button type="button" class="chat-search-nav" id="btn-chat-search-prev" aria-label="Resultado anterior">${svgIcon('chevronUp', 15)}</button>
                        <button type="button" class="chat-search-nav" id="btn-chat-search-next" aria-label="Resultado siguiente">${svgIcon('chevronDown', 15)}</button>
                        <button type="button" class="chat-search-nav" id="btn-chat-search-close" aria-label="Cerrar búsqueda">${svgIcon('close', 15)}</button>
                      </div>`
                    : ''
                }
                <div class="chat-messages-scroller" id="chat-messages-scroller">
                  ${activeMessages.length >= (sub.messageLimit || 250) ? `<div class="chat-load-older-row"><button type="button" class="chat-load-older-btn js-load-older">${svgIcon("clock", 13)}<span>Cargar mensajes anteriores</span></button></div>` : ""}
                  ${messagesHtml}
                </div>

                <!-- Contenedor del Compositor y Popover Flotante Slash (/) -->
                <div class="chat-composer-area">
                  <button type="button" class="chat-jump-bottom" id="chat-jump-bottom" style="display:none;" aria-label="Ir al último mensaje">
                    ${svgIcon('chevronDown', 16)}
                    <span class="chat-jump-bottom-count" style="display:none;"></span>
                  </button>
                  <!-- Menú flotante de Respuestas Rápidas al escribir / -->
                  <div class="slash-command-popover" id="slash-command-popover" style="display:none;">
                    <div class="slash-command-header">
                      <span><strong>Respuestas Automáticas / Rápidas</strong> — Clic o Enter para usar</span>
                      <button type="button" class="btn btn-secondary btn-sm" id="btn-popover-manage-qr" style="padding:0.15rem 0.5rem;font-size:0.7rem;">
                        ${svgIcon('plus', 11)}
                        <span>Gestionar / Crear</span>
                      </button>
                    </div>
                    <div class="slash-command-list" id="slash-command-list"></div>
                  </div>

                  ${
                    sub.replyingTo
                      ? `
                    <div class="chat-reply-preview-bar">
                      ${
                        sub.replyingTo.media_url && (sub.replyingTo.media_type === 'image' || !sub.replyingTo.media_type || sub.replyingTo.media_type === 'none')
                          ? `
                        <div class="chat-reply-preview-thumb">
                          <img src="${sub.replyingTo.media_url}" alt="Foto citada" />
                        </div>
                      `
                          : ''
                      }
                      <div class="chat-reply-preview-content">
                        <div class="chat-reply-preview-sender">
                          ${svgIcon('cornerUpLeft', 13)}
                          <span>Respondiendo a <strong>${escapeHtml(sub.replyingTo.sender)}</strong></span>
                        </div>
                        <div class="chat-reply-preview-text">
                          ${sub.replyingTo.media_type === 'image' || (sub.replyingTo.media_url && !sub.replyingTo.body) ? `<span style="display:inline-flex;align-items:center;gap:0.25rem;font-weight:600;">${svgIcon('image', 12)} Foto:</span> ` : ''}${escapeHtml(sub.replyingTo.body || (sub.replyingTo.media_type === 'image' ? 'Foto' : ''))}
                        </div>
                      </div>
                      <button type="button" class="chat-reply-cancel-btn js-cancel-reply" title="Cancelar respuesta">
                        ${svgIcon('close', 15)}
                      </button>
                    </div>
                  `
                      : ''
                  }

                  ${
                    sub.pendingAttachment
                      ? `
                    <div class="composer-media-preview-bar">
                      ${
                        sub.pendingAttachment.media_type === 'audio'
                          ? `<audio class="composer-attach-audio" controls preload="metadata" src="${sub.pendingAttachment.media_url}"></audio>`
                          : sub.pendingAttachment.media_type === 'video'
                          ? `<video class="composer-attach-thumb" muted playsinline preload="metadata" src="${sub.pendingAttachment.media_url}"></video>`
                          : sub.pendingAttachment.media_type === 'image' || sub.pendingAttachment.media_type === 'sticker'
                          ? `<img class="composer-attach-thumb" alt="" src="${sub.pendingAttachment.media_url}" />`
                          : ''
                      }
                      <div style="display:flex;align-items:center;gap:0.5rem;overflow:hidden;">
                        <span class="tag-pill-minimal" style="--tag-color:var(--widget-accent);">
                          ${svgIcon(mediaTypeIcon(sub.pendingAttachment.media_type), 12)}
                          <span>${mediaTypeLabel(sub.pendingAttachment.media_type)} listo para enviar</span>
                        </span>
                        <strong style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                          ${sub.pendingAttachment.media_filename}
                        </strong>
                      </div>
                      <button type="button" class="btn btn-secondary btn-sm" id="btn-clear-pending-media" style="padding:0.15rem 0.45rem;">
                        ${svgIcon('close', 13)}
                        <span>Quitar</span>
                      </button>
                    </div>
                  `
                      : ''
                  }

                  <!-- Barra Flotante de Vista Previa Open Graph en el Compositor (Estilo WhatsApp) -->
                  <div id="composer-link-preview-box" class="composer-link-preview-box" style="display:none;"></div>

                  <!-- Popover Selector de Emoticones / Emojis y Stickers -->
                  <div id="chat-emoji-picker-popover" class="chat-emoji-picker-popover" style="display:none;" role="dialog" aria-label="Selector de emoticones y stickers">
                    <input type="file" id="chat-sticker-file-input" accept="image/webp,image/png,image/jpeg,image/gif" style="display:none;" />
                    <div class="chat-emoji-tabs" role="tablist">
                      <button type="button" class="chat-emoji-tab active" data-emoji-cat="freq" role="tab" aria-selected="true">Frecuentes</button>
                      <button type="button" class="chat-emoji-tab" data-emoji-cat="faces" role="tab" aria-selected="false">Caras</button>
                      <button type="button" class="chat-emoji-tab" data-emoji-cat="hands" role="tab" aria-selected="false">Gestos</button>
                      <button type="button" class="chat-emoji-tab" data-emoji-cat="work" role="tab" aria-selected="false">Trabajo</button>
                      <button type="button" class="chat-emoji-tab" data-emoji-cat="symbols" role="tab" aria-selected="false">Símbolos</button>
                      <button type="button" class="chat-emoji-tab" data-emoji-cat="stickers" role="tab" aria-selected="false">Stickers</button>
                    </div>
                    <div class="chat-emoji-grid" id="chat-emoji-grid"></div>
                    <div class="chat-sticker-panel" id="chat-sticker-panel" style="display:none;"></div>
                  </div>

                  <form id="chat-composer-form" class="chat-composer-form">
                    <input
                      type="file"
                      id="chat-direct-file-input"
                      accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
                      style="display:none;"
                    />
                    <button
                      type="button"
                      class="btn btn-secondary btn-sm"
                      id="btn-toggle-emoji-picker"
                      title="Insertar emoticón"
                      aria-label="Insertar emoticón"
                      aria-expanded="false"
                      aria-controls="chat-emoji-picker-popover"
                      style="height:42px;width:42px;padding:0;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;flex-shrink:0;"
                      ${canCreate ? '' : 'disabled'}
                    >
                      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                        <line x1="9" y1="9" x2="9.01" y2="9"></line>
                        <line x1="15" y1="9" x2="15.01" y2="9"></line>
                      </svg>
                    </button>
                    <button
                      type="button"
                      class="btn btn-secondary btn-sm"
                      id="btn-attach-media-file"
                      title="Adjuntar Foto, Video, Audio o Documento para enviar a WhatsApp"
                      style="height:42px;width:42px;padding:0;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;flex-shrink:0;"
                      ${canCreate ? '' : 'disabled'}
                    >
                      ${svgIcon('paperclip', 18)}
                    </button>

                    <label for="chat-composer-input" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);">
                      Escribir mensaje para ${activeConv.contact_name}
                    </label>
                    <textarea
                      id="chat-composer-input"
                      class="chat-composer-textarea"
                      rows="1"
                      placeholder="Mensaje..."
                      ${canCreate ? '' : 'disabled'}
                    ></textarea>

                    <!-- Botón de Acción estilo WhatsApp: Micrófono cuando está vacío / Enviar con ícono cuando tiene texto -->
                    <button
                      type="submit"
                      class="chat-action-btn ${sub.pendingAttachment ? 'is-send' : 'is-mic'}"
                      id="btn-chat-action"
                      title="${sub.pendingAttachment ? 'Enviar mensaje' : 'Grabar nota de voz'}"
                      ${canCreate ? '' : 'disabled'}
                    >
                      <span class="chat-action-icon-send" style="display:${sub.pendingAttachment ? 'inline-flex' : 'none'};">
                        ${svgIcon('send', 17)}
                      </span>
                      <span class="chat-action-icon-mic" style="display:${sub.pendingAttachment ? 'none' : 'inline-flex'};">
                        ${svgIcon('mic', 18)}
                      </span>
                    </button>
                  </form>
                </div>
              </div>

              ${
                sub.sideDrawerTab === 'notes'
                  ? `
                <!-- BACKDROP TÁCTIL MÓVIL Y PANEL BOTTOM SHEET: NOTAS APARTE -->
                <div class="chat-side-drawer-backdrop" id="chat-side-drawer-backdrop" title="Tocar para cerrar"></div>
                <aside class="chat-side-drawer open" aria-label="Notas internas de la conversación">
                  <div class="chat-side-drawer-handle"></div>
                  <div class="chat-side-drawer-header">
                    <strong style="font-size:0.88rem;display:inline-flex;align-items:center;gap:0.4rem;">
                      ${svgIcon('stickyNote', 15)}
                      <span>Notas Aparte del Cliente</span>
                    </strong>
                    <button type="button" class="btn btn-secondary btn-sm" id="btn-close-side-drawer" style="padding:0.25rem 0.5rem;" title="Cerrar">
                      ${svgIcon('close', 13)}
                    </button>
                  </div>
                  <div class="chat-side-drawer-body">
                    <form id="form-add-conv-note" style="display:flex;flex-direction:column;gap:0.45rem;">
                      <textarea
                        id="new-conv-note-input"
                        class="form-control"
                        rows="3"
                        placeholder="Escriba una nota interna privada sobre este cliente o acuerdo..."
                        style="font-size:0.8rem;"
                        required
                      ></textarea>
                      <button type="submit" class="btn btn-primary btn-sm" style="align-self:flex-end;">
                        ${svgIcon('plus', 13)}
                        <span>Guardar Nota</span>
                      </button>
                    </form>

                    <div style="display:flex;flex-direction:column;gap:0.6rem;margin-top:0.25rem;">
                      ${
                        activeNotes.length > 0
                          ? activeNotes
                              .map(
                                (n) => `
                              <div class="note-card-item">
                                <div style="display:flex;align-items:center;justify-content:space-between;gap:0.4rem;font-size:0.69rem;color:var(--text-muted);">
                                  <strong>${n.author_name}</strong>
                                  <div style="display:inline-flex;align-items:center;gap:0.25rem;">
                                    <button type="button" class="btn btn-secondary btn-sm js-edit-conv-note" data-note-id="${n.id}" style="padding:0.1rem 0.3rem;" title="Editar nota">
                                      ${svgIcon('edit', 11)}
                                    </button>
                                    <button type="button" class="btn btn-danger btn-sm js-delete-conv-note" data-note-id="${n.id}" style="padding:0.1rem 0.3rem;" title="Eliminar nota">
                                      ${svgIcon('trash', 11)}
                                    </button>
                                  </div>
                                </div>
                                <div style="font-size:0.8rem;color:var(--text-primary);white-space:pre-wrap;line-height:1.4;">${n.content}</div>
                              </div>
                            `
                              )
                              .join('')
                          : `<p style="font-size:0.78rem;color:var(--text-muted);text-align:center;padding:1rem 0;">Aún no hay notas internas para este chat.</p>`
                      }
                    </div>
                  </div>
                </aside>
              `
                  : sub.sideDrawerTab === 'tags'
                  ? `
                <!-- BACKDROP TÁCTIL MÓVIL Y PANEL BOTTOM SHEET: ETIQUETAS Y ASIGNACIÓN -->
                <div class="chat-side-drawer-backdrop" id="chat-side-drawer-backdrop" title="Tocar para cerrar"></div>
                <aside class="chat-side-drawer open" aria-label="Etiquetas del chat y usuario">
                  <div class="chat-side-drawer-handle"></div>
                  <div class="chat-side-drawer-header">
                    <strong style="font-size:0.88rem;display:inline-flex;align-items:center;gap:0.4rem;">
                      ${svgIcon('tag', 15)}
                      <span>Etiquetas y Asignación</span>
                    </strong>
                    <button type="button" class="btn btn-secondary btn-sm" id="btn-close-side-drawer" style="padding:0.25rem 0.5rem;" title="Cerrar">
                      ${svgIcon('close', 13)}
                    </button>
                  </div>
                  <div class="chat-side-drawer-body">
                    <div>
                      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.45rem;">
                        <span style="font-size:0.74rem;font-weight:700;text-transform:uppercase;color:var(--text-muted);">
                          Etiquetas de este Chat
                        </span>
                        <button type="button" class="btn btn-secondary btn-sm" id="btn-drawer-open-tag-crud" style="padding:0.15rem 0.45rem;font-size:0.7rem;">
                          ${svgIcon('plus', 11)}
                          <span>Crear / Editar</span>
                        </button>
                      </div>
                      <p style="font-size:0.74rem;color:var(--text-muted);margin-bottom:0.55rem;">
                        Toque una etiqueta para asignarla o quitarla de <strong>${activeConv.contact_name}</strong>:
                      </p>
                      <div style="display:flex;flex-wrap:wrap;gap:0.38rem;">
                        ${sub.tags
                          .map((t) => {
                            const hasTag = activeConvTags.some(
                              (ct) => ct.toLowerCase() === t.name.toLowerCase()
                            );
                            return renderMinimalTagPill(
                              t.name,
                              sub.tags,
                              `interactive ${hasTag ? 'active-filter' : ''} js-toggle-conv-tag`,
                              `data-tag-name="${t.name}" role="button" tabindex="0"`
                            );
                          })
                          .join('')}
                      </div>
                    </div>

                    <div style="padding-top:0.75rem;border-top:1px dashed var(--widget-border);">
                      <label class="form-label" for="conv-assigned-user-select" style="font-size:0.74rem;text-transform:uppercase;color:var(--text-muted);">
                        Usuario / Agente Responsable del Chat
                      </label>
                      <select id="conv-assigned-user-select" class="form-select" style="margin-top:0.35rem;font-size:0.8rem;padding:0.4rem 0.6rem;">
                        <option value="">— Sin agente asignado —</option>
                        ${sub.users
                          .map(
                            (u) =>
                              `<option value="${u.id}" ${activeConv.assigned_user_id === u.id ? 'selected' : ''}>${u.full_name} (${u.role_name || 'Agente'})</option>`
                          )
                          .join('')}
                      </select>
                    </div>

                    <div style="padding-top:0.75rem;border-top:1px dashed var(--widget-border);">
                      <span style="font-size:0.74rem;font-weight:700;text-transform:uppercase;color:var(--text-muted);display:block;margin-bottom:0.45rem;">
                        Etiquetas por Usuario del Equipo
                      </span>
                      <div style="display:flex;flex-direction:column;gap:0.65rem;">
                        ${sub.users
                          .map((u) => {
                            const uTags = parseTagsJson(u.tags_json);
                            return `
                              <div style="padding:0.55rem 0.65rem;border-radius:0.65rem;background:var(--page-bg);border:1px solid var(--widget-border);">
                                <div style="display:flex;align-items:center;justify-content:space-between;gap:0.4rem;margin-bottom:0.35rem;">
                                  <strong style="font-size:0.78rem;">${u.full_name}</strong>
                                  <button type="button" class="btn btn-secondary btn-sm js-manage-user-tags" data-user-id="${u.id}" style="padding:0.1rem 0.4rem;font-size:0.68rem;">
                                    ${svgIcon('tag', 10)}
                                    <span>Asignar</span>
                                  </button>
                                </div>
                                <div style="display:flex;flex-wrap:wrap;gap:0.25rem;">
                                  ${
                                    uTags.length > 0
                                      ? uTags.map((ut) => renderMinimalTagPill(ut, sub.tags)).join('')
                                      : `<span style="font-size:0.7rem;color:var(--text-muted);">Sin etiquetas</span>`
                                  }
                                </div>
                              </div>
                            `;
                          })
                          .join('')}
                      </div>
                    </div>
                  </div>
                </aside>
              `
                  : ''
              }
            </div>
          `
              : `
              <div class="inbox-welcome-screen">
                <div class="inbox-welcome-illustration">
                  <div class="inbox-welcome-icon-circle">
                    ${
                      sub.channelFilter === 'facebook'
                        ? svgIcon('facebook', 44)
                        : sub.channelFilter === 'instagram'
                        ? svgIcon('instagram', 44)
                        : sub.channelFilter === 'tiktok'
                        ? svgIcon('tiktok', 44)
                        : svgIcon('messageSquare', 44)
                    }
                  </div>
                  <div class="inbox-welcome-badge">
                    ${svgIcon('check', 14)}
                  </div>
                </div>

                <h2 class="inbox-welcome-title">
                  ${
                    sub.channelFilter === 'facebook'
                      ? 'Bandeja de Facebook Messenger'
                      : sub.channelFilter === 'instagram'
                      ? 'Bandeja de Instagram Direct'
                      : sub.channelFilter === 'tiktok'
                      ? 'Bandeja de TikTok Business'
                      : sub.channelFilter === 'whatsapp'
                      ? 'Bandeja de WhatsApp'
                      : 'Empieza tu chat ahora'
                  }
                </h2>
                <p class="inbox-welcome-subtitle">
                  ${
                    sub.channelFilter === 'facebook'
                      ? `Atiende los mensajes y comentarios de ${conn.fb_page_name || 'tu Fan Page comercial'} en tiempo real.`
                      : sub.channelFilter === 'instagram'
                      ? `Gestiona mensajes directos, menciones y respuestas de historias de Instagram.`
                      : sub.channelFilter === 'tiktok'
                      ? `Gestiona prospectos de TikTok Ads y mensajes directos comerciales.`
                      : 'Envía y recibe mensajes omnicanal sin mantener tu teléfono conectado. Selecciona una conversación de la lista o inicia una nueva.'
                  }
                </p>

                <div class="inbox-welcome-actions">
                  <button type="button" class="btn btn-primary js-opt-new-contact" id="btn-welcome-new-chat">
                    ${svgIcon('plus', 15)}
                    <span>Añadir contacto / Iniciar chat</span>
                  </button>
                  ${
                    sub.channelFilter === 'instagram'
                      ? `
                    <button type="button" class="btn btn-secondary js-opt-sync-ig">
                      ${svgIcon('instagram', 15)}
                      <span>Sincronizar Instagram</span>
                    </button>
                    `
                      : sub.channelFilter === 'facebook'
                      ? `
                    <button type="button" class="btn btn-secondary js-opt-sync-fb">
                      ${svgIcon('facebook', 15)}
                      <span>Sincronizar Facebook</span>
                    </button>
                    `
                      : sub.channelFilter === 'whatsapp'
                      ? `
                    <button type="button" class="btn btn-secondary js-opt-sync-wa">
                      ${svgIcon('whatsapp', 15)}
                      <span>Sincronizar WhatsApp</span>
                    </button>
                    `
                      : `
                    <button type="button" class="btn btn-secondary js-opt-sync-all">
                      ${svgIcon('refresh', 15)}
                      <span>Sincronizar Todas las Redes</span>
                    </button>
                    `
                  }
                  <button type="button" class="btn btn-secondary js-opt-broadcast">
                    ${svgIcon('megaphone', 15)}
                    <span>Enviar Mensaje Masivo</span>
                  </button>
                </div>

                <div class="inbox-welcome-security-note">
                  ${svgIcon('lock', 13)}
                  <span>Tus mensajes personales y de clientes están protegidos con cifrado y trazabilidad oficial.</span>
                </div>
              </div>
            `
          }
        </section>
      </div>

      <!-- Botón Flotante para Móvil (FAB de Opciones de Bandeja) -->
      <button type="button" class="inbox-mobile-fab" id="btn-inbox-mobile-fab" aria-label="Opciones de Bandeja" title="Opciones de Bandeja">
        ${svgIcon('sliders', 22)}
      </button>

      <!-- Bottom Sheet de Opciones para Móvil -->
      <div class="inbox-mobile-sheet-overlay" id="inbox-mobile-sheet-overlay" style="display:none;">
        <div class="inbox-mobile-sheet">
          <div class="inbox-mobile-sheet-handle"></div>
          <div class="inbox-mobile-sheet-title">
            <strong style="font-size:0.95rem;">Opciones de Bandeja</strong>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-close-mobile-sheet" style="padding:0.2rem 0.45rem;">
              ${svgIcon('close', 14)}
            </button>
          </div>
          <div class="inbox-mobile-sheet-items">
            <button type="button" class="inbox-sheet-btn js-opt-new-contact">
              <span class="inbox-sheet-icon" style="background:rgba(16,185,129,0.15);color:#10b981;">${svgIcon('plus', 18)}</span>
              <div style="text-align:left;">
                <strong>Añadir contacto / Iniciar chat</strong>
                <p>Comenzar conversación con un nuevo número o cliente</p>
              </div>
            </button>
            <button type="button" class="inbox-sheet-btn js-opt-sync-all">
              <span class="inbox-sheet-icon" style="background:rgba(99,102,241,0.15);color:#6366f1;">${svgIcon('refresh', 18)}</span>
              <div style="text-align:left;">
                <strong>Sincronizar Todas las Redes</strong>
                <p>Descargar chats de WhatsApp, Instagram y Facebook</p>
              </div>
            </button>
            <button type="button" class="inbox-sheet-btn js-opt-sync-wa">
              <span class="inbox-sheet-icon" style="background:rgba(59,130,246,0.15);color:#3b82f6;">${svgIcon('whatsapp', 18)}</span>
              <div style="text-align:left;">
                <strong>Sincronizar WhatsApp</strong>
                <p>Descargar últimos chats de WhatsApp Normal y Business</p>
              </div>
            </button>
            <button type="button" class="inbox-sheet-btn js-opt-sync-ig">
              <span class="inbox-sheet-icon" style="background:rgba(225,48,108,0.15);color:#e1306c;">${svgIcon('instagram', 18)}</span>
              <div style="text-align:left;">
                <strong>Sincronizar Instagram Direct</strong>
                <p>Descargar DMs de tu cuenta comercial @romaagenciape</p>
              </div>
            </button>
            <button type="button" class="inbox-sheet-btn js-opt-sync-fb">
              <span class="inbox-sheet-icon" style="background:rgba(37,99,235,0.15);color:#2563eb;">${svgIcon('facebook', 18)}</span>
              <div style="text-align:left;">
                <strong>Sincronizar Facebook</strong>
                <p>Descargar chats de tu Fan Page comercial</p>
              </div>
            </button>
            <button type="button" class="inbox-sheet-btn js-opt-quick-replies">
              <span class="inbox-sheet-icon" style="background:rgba(245,158,11,0.15);color:#f59e0b;">${svgIcon('zap', 18)}</span>
              <div style="text-align:left;">
                <strong>Respuestas Rápidas (/)</strong>
                <p>Crear, editar o usar plantillas con multimedia</p>
              </div>
            </button>
            <button type="button" class="inbox-sheet-btn js-opt-tags">
              <span class="inbox-sheet-icon" style="background:rgba(16,185,129,0.15);color:#10b981;">${svgIcon('tag', 18)}</span>
              <div style="text-align:left;">
                <strong>Gestor de Etiquetas</strong>
                <p>Organizar chats de clientes y agentes</p>
              </div>
            </button>
            <button type="button" class="inbox-sheet-btn js-opt-broadcast">
              <span class="inbox-sheet-icon" style="background:rgba(99,102,241,0.15);color:#6366f1;">${svgIcon('megaphone', 18)}</span>
              <div style="text-align:left;">
                <strong>Mensaje Masivo</strong>
                <p>Difusión a listas de contactos y etiquetas</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// MODAL GESTOR DE RESPUESTAS AUTOMÁTICAS / RÁPIDAS CON SLASH (/) Y MULTIMEDIA
// ============================================================================
function openQuickRepliesManagerModal(callbacks: {
  sub: OmnichannelSubState;
  apiFetch: <T = any>(url: string, options?: RequestInit) => Promise<T>;
  refreshInbox: () => Promise<void>;
  editingItem?: QuickReplyItem;
  onSelect?: (qr: QuickReplyItem) => void;
}): void {
  const { sub, apiFetch, refreshInbox, editingItem, onSelect } = callbacks;
  const dialog = document.getElementById('global-form-dialog') as HTMLDialogElement | null;
  if (!dialog) return;

  let uploadedMediaUrl = editingItem?.media_url || '';
  let uploadedFilename = editingItem?.media_filename || '';
  let uploadedMime = editingItem?.media_mimetype || '';

  const renderModalContent = () => {
    const selectedType =
      (dialog.querySelector('#qr-media-type') as HTMLSelectElement | null)?.value ||
      editingItem?.media_type ||
      'none';

    dialog.innerHTML = `
      <div class="crm-form-modal-surface" style="max-width:740px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
          <div>
            <h3 id="form-dialog-title" style="font-size:1.15rem;display:flex;align-items:center;gap:0.5rem;">
              ${svgIcon('zap', 18)}
              <span>Respuestas Automáticas / Rápidas con Comando <code>/</code></span>
            </h3>
            <p style="font-size:0.8rem;color:var(--text-muted);">
              Cree respuestas con texto, audio, video, documento o foto. Al escribir <code>/</code> en el chat podrá enviarlas directo al WhatsApp del cliente.
            </p>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" id="close-qr-manager">
            ${svgIcon('close', 16)}
          </button>
        </div>

        <!-- Formulario para Crear o Editar Respuesta Rápida -->
        <form id="quick-reply-crud-form" style="padding:1rem;border-radius:0.85rem;background:var(--surface-subtle);border:1px solid var(--widget-border);margin-bottom:1.15rem;display:flex;flex-direction:column;gap:0.85rem;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <strong style="font-size:0.88rem;">
              ${editingItem ? `Editando comando /${editingItem.shortcut}` : 'Nueva Respuesta Automática (/)'}
            </strong>
            ${
              editingItem
                ? `<button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-edit-qr">Cancelar edición</button>`
                : ''
            }
          </div>

          <div class="config-grid-3">
            <div class="form-group">
              <label class="form-label" for="qr-shortcut">Comando (sin /) *</label>
              <input type="text" id="qr-shortcut" class="form-control" placeholder="ej. catalogo" value="${editingItem?.shortcut || ''}" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="qr-title">Título descriptivo *</label>
              <input type="text" id="qr-title" class="form-control" placeholder="ej. Catálogo PDF 2026" value="${editingItem?.title || ''}" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="qr-media-type">Tipo de Adjunto a Enviar</label>
              <select id="qr-media-type" class="form-select">
                <option value="none" ${selectedType === 'none' ? 'selected' : ''}>Solo Texto</option>
                <option value="image" ${selectedType === 'image' ? 'selected' : ''}>Foto / Imagen</option>
                <option value="video" ${selectedType === 'video' ? 'selected' : ''}>Video (MP4)</option>
                <option value="audio" ${selectedType === 'audio' ? 'selected' : ''}>Audio / Nota de Voz</option>
                <option value="document" ${selectedType === 'document' ? 'selected' : ''}>Documento (PDF / Office)</option>
              </select>
            </div>
          </div>

          <div class="form-group" id="qr-media-upload-row" style="display:${selectedType === 'none' ? 'none' : 'flex'};flex-direction:column;gap:0.45rem;">
            <label class="form-label" for="qr-media-file">Subir archivo de ${mediaTypeLabel(selectedType)} (se enviará por WhatsApp)</label>
            <div style="display:flex;flex-wrap:wrap;align-items:center;gap:0.6rem;">
              <input
                type="file"
                id="qr-media-file"
                class="form-control"
                style="flex:1;padding:0.38rem;font-size:0.8rem;"
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
              />
              <span id="qr-media-status-badge" class="tag-pill-minimal" style="--tag-color:#10b981;">
                <span class="tag-dot"></span>
                <span>${uploadedFilename ? `Archivo: ${uploadedFilename}` : 'Ningún archivo cargado aún'}</span>
              </span>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="qr-body">Texto del Mensaje / Pie de archivo *</label>
            <textarea id="qr-body" class="form-control" rows="2" placeholder="Escriba el texto que acompañará a esta respuesta rápida..." required>${editingItem?.body || ''}</textarea>
          </div>

          <div style="display:flex;justify-content:flex-end;">
            <button type="submit" class="btn btn-primary btn-sm">
              ${svgIcon('save', 14)}
              <span>${editingItem ? 'Actualizar Respuesta (/)' : 'Guardar Nueva Respuesta (/)'}</span>
            </button>
          </div>
        </form>

        <!-- Lista de Respuestas Rápidas Existentes -->
        <div style="display:flex;flex-direction:column;gap:0.5rem;max-height:260px;overflow-y:auto;">
          ${sub.quickReplies
            .map(
              (qr) => `
              <div style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;padding:0.65rem 0.85rem;border-radius:0.75rem;background:var(--page-bg);border:1px solid var(--widget-border);">
                <div style="min-width:0;flex:1;">
                  <div style="display:flex;align-items:center;gap:0.45rem;flex-wrap:wrap;">
                    <span class="slash-shortcut-code">/${qr.shortcut}</span>
                    <strong style="font-size:0.85rem;">${qr.title}</strong>
                    ${
                      qr.media_type && qr.media_type !== 'none'
                        ? `<span class="tag-pill-minimal" style="--tag-color:var(--widget-accent);">
                            ${svgIcon(mediaTypeIcon(qr.media_type), 11)}
                            <span>${mediaTypeLabel(qr.media_type)}: ${qr.media_filename || 'Adjunto'}</span>
                          </span>`
                        : ''
                    }
                  </div>
                  <p style="font-size:0.78rem;color:var(--text-secondary);margin-top:0.2rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                    ${qr.body}
                  </p>
                </div>
                <div style="display:flex;align-items:center;gap:0.35rem;flex:none;">
                  ${
                    onSelect
                      ? `
                    <button type="button" class="btn btn-primary btn-sm js-modal-use-qr" data-id="${qr.id}" style="padding:0.25rem 0.65rem;" title="Insertar esta respuesta en el chat activo">
                      ${svgIcon('send', 12)}
                      <span>Usar</span>
                    </button>
                  `
                      : ''
                  }
                  <button type="button" class="btn btn-secondary btn-sm js-modal-edit-qr" data-id="${qr.id}">
                    ${svgIcon('edit', 13)}
                  </button>
                  <button type="button" class="btn btn-danger btn-sm js-modal-delete-qr" data-id="${qr.id}" data-shortcut="${qr.shortcut}">
                    ${svgIcon('trash', 13)}
                  </button>
                </div>
              </div>
            `
            )
            .join('')}
        </div>
      </div>
    `;

    dialog.querySelectorAll('.js-modal-use-qr').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.getAttribute('data-id'));
        const found = sub.quickReplies.find((q) => q.id === id);
        if (found && onSelect) {
          onSelect(found);
          dialog.close();
        }
      });
    });

    dialog.querySelector('#close-qr-manager')?.addEventListener('click', () => dialog.close());
    dialog.querySelector('#btn-cancel-edit-qr')?.addEventListener('click', () => {
      openQuickRepliesManagerModal({ sub, apiFetch, refreshInbox, onSelect });
    });

    const typeSelect = dialog.querySelector('#qr-media-type') as HTMLSelectElement | null;
    const uploadRow = dialog.querySelector('#qr-media-upload-row') as HTMLElement | null;
    typeSelect?.addEventListener('change', () => {
      if (uploadRow) {
        uploadRow.style.display = typeSelect.value === 'none' ? 'none' : 'flex';
      }
    });

    const fileInput = dialog.querySelector('#qr-media-file') as HTMLInputElement | null;
    fileInput?.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      uploadedMediaUrl = await readLocalFileAsDataUrl(file);
      uploadedFilename = file.name;
      uploadedMime = file.type || 'application/octet-stream';
      const badge = dialog.querySelector('#qr-media-status-badge');
      if (badge) {
        badge.innerHTML = `<span class="tag-dot"></span><span>Cargado: ${uploadedFilename}</span>`;
      }
    });

    dialog.querySelector('#quick-reply-crud-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const shortcut = (dialog.querySelector('#qr-shortcut') as HTMLInputElement).value.trim();
      const title = (dialog.querySelector('#qr-title') as HTMLInputElement).value.trim();
      const body = (dialog.querySelector('#qr-body') as HTMLTextAreaElement).value.trim();
      const media_type = (dialog.querySelector('#qr-media-type') as HTMLSelectElement).value as QuickReplyItem['media_type'];

      if (media_type !== 'none' && !uploadedMediaUrl) {
        showSystemToast(
          'Suba un archivo multimedia',
          `Seleccione un archivo de ${mediaTypeLabel(media_type)} o cambie el tipo a "Solo Texto".`,
          'warning'
        );
        return;
      }

      try {
        const payload = {
          shortcut,
          title,
          body,
          media_type,
          media_url: media_type === 'none' ? '' : uploadedMediaUrl,
          media_filename: media_type === 'none' ? '' : uploadedFilename,
          media_mimetype: media_type === 'none' ? '' : uploadedMime,
        };

        if (editingItem) {
          await apiFetch(`/api/inbox/quick-replies/${editingItem.id}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
          showSystemToast('Respuesta actualizada', `El comando /${shortcut} fue actualizado.`, 'success');
        } else {
          await apiFetch('/api/inbox/quick-replies', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          showSystemToast('Respuesta creada', `El comando /${shortcut} ya está disponible con /.`, 'success');
        }
        await refreshInbox();
        openQuickRepliesManagerModal({ sub, apiFetch, refreshInbox });
      } catch (err) {
        showSystemToast('Error guardando respuesta', (err as Error).message, 'danger');
      }
    });

    dialog.querySelectorAll('.js-modal-edit-qr').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.getAttribute('data-id'));
        const item = sub.quickReplies.find((q) => q.id === id);
        if (item) {
          openQuickRepliesManagerModal({ sub, apiFetch, refreshInbox, editingItem: item });
        }
      });
    });

    dialog.querySelectorAll('.js-modal-delete-qr').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.getAttribute('data-id'));
        const sc = btn.getAttribute('data-shortcut') || '';
        try {
          await apiFetch(`/api/inbox/quick-replies/${id}`, { method: 'DELETE' });
          showSystemToast('Respuesta eliminada', `Se eliminó /${sc}.`, 'info');
          await refreshInbox();
          openQuickRepliesManagerModal({ sub, apiFetch, refreshInbox });
        } catch (err) {
          showSystemToast('Error al eliminar', (err as Error).message, 'danger');
        }
      });
    });
  };

  renderModalContent();
  if (!dialog.open) dialog.showModal();
}

// ============================================================================
// MODAL GESTOR DE ETIQUETAS MODERNAS (PARA CHATS Y USUARIOS)
// ============================================================================
export function openTagsManagerModal(callbacks: {
  sub: OmnichannelSubState;
  apiFetch: <T = any>(url: string, options?: RequestInit) => Promise<T>;
  refreshInbox: () => Promise<void>;
  editingTag?: CrmTagItem;
}): void {
  const { sub, apiFetch, refreshInbox, editingTag } = callbacks;
  const dialog = document.getElementById('global-form-dialog') as HTMLDialogElement | null;
  if (!dialog) return;

  dialog.innerHTML = `
    <div class="crm-form-modal-surface" style="max-width:620px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
        <div>
          <h3 id="form-dialog-title" style="font-size:1.15rem;display:flex;align-items:center;gap:0.5rem;">
            ${svgIcon('tag', 18)}
            <span>Gestor de Etiquetas Modernas Minimalistas</span>
          </h3>
          <p style="font-size:0.8rem;color:var(--text-muted);">
            Diseñadas con borde sutil y punto de color para no saturar visualmente los chats ni las tablas de usuarios.
          </p>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" id="close-tags-manager">
          ${svgIcon('close', 16)}
        </button>
      </div>

      <form id="tag-crud-form" style="padding:0.95rem;border-radius:0.85rem;background:var(--surface-subtle);border:1px solid var(--widget-border);margin-bottom:1.1rem;display:flex;flex-wrap:wrap;align-items:flex-end;gap:0.75rem;">
        <div class="form-group" style="flex:1;min-width:180px;">
          <label class="form-label" for="tag-crud-name">Nombre de la Etiqueta *</label>
          <input type="text" id="tag-crud-name" class="form-control" placeholder="Ej. Cliente Mayorista" value="${editingTag?.name || ''}" required />
        </div>
        <div class="form-group" style="width:130px;">
          <label class="form-label" for="tag-crud-color">Color del Punto</label>
          <div class="color-picker-row" style="padding:0.25rem 0.5rem;">
            <input type="color" id="tag-crud-color" value="${editingTag?.color || '#10b981'}" style="width:28px;height:28px;" />
            <input type="text" id="tag-crud-color-txt" value="${editingTag?.color || '#10b981'}" readonly style="font-size:0.78rem;" />
          </div>
        </div>
        <div class="form-group" style="width:140px;">
          <label class="form-label" for="tag-crud-scope">Ámbito</label>
          <select id="tag-crud-scope" class="form-select">
            <option value="both" ${editingTag?.scope === 'both' ? 'selected' : ''}>Chats y Usuarios</option>
            <option value="chat" ${editingTag?.scope === 'chat' ? 'selected' : ''}>Solo Chats</option>
            <option value="user" ${editingTag?.scope === 'user' ? 'selected' : ''}>Solo Usuarios</option>
          </select>
        </div>
        <button type="submit" class="btn btn-primary btn-sm" style="height:38px;">
          ${svgIcon('save', 14)}
          <span>${editingTag ? 'Actualizar' : 'Crear Etiqueta'}</span>
        </button>
      </form>

      <div style="display:flex;flex-direction:column;gap:0.45rem;max-height:280px;overflow-y:auto;">
        ${sub.tags
          .map(
            (t) => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:0.55rem 0.8rem;border-radius:0.7rem;background:var(--page-bg);border:1px solid var(--widget-border);">
              <div style="display:flex;align-items:center;gap:0.65rem;">
                ${renderMinimalTagPill(t.name, sub.tags)}
                <span style="font-size:0.72rem;color:var(--text-muted);">
                  ${t.scope === 'chat' ? 'Chats' : t.scope === 'user' ? 'Usuarios' : 'Chats y Usuarios'}
                </span>
              </div>
              <div style="display:flex;align-items:center;gap:0.35rem;">
                <button type="button" class="btn btn-secondary btn-sm js-edit-tag-item" data-id="${t.id}">
                  ${svgIcon('edit', 12)}
                </button>
                <button type="button" class="btn btn-danger btn-sm js-delete-tag-item" data-id="${t.id}" data-name="${t.name}">
                  ${svgIcon('trash', 12)}
                </button>
              </div>
            </div>
          `
          )
          .join('')}
      </div>
    </div>
  `;

  dialog.querySelector('#close-tags-manager')?.addEventListener('click', () => dialog.close());
  const colorPicker = dialog.querySelector('#tag-crud-color') as HTMLInputElement | null;
  const colorTxt = dialog.querySelector('#tag-crud-color-txt') as HTMLInputElement | null;
  colorPicker?.addEventListener('input', () => {
    if (colorTxt) colorTxt.value = colorPicker.value;
  });

  dialog.querySelector('#tag-crud-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = (dialog.querySelector('#tag-crud-name') as HTMLInputElement).value.trim();
    const color = colorPicker?.value || '#6366f1';
    const scope = (dialog.querySelector('#tag-crud-scope') as HTMLSelectElement).value;

    try {
      if (editingTag) {
        await apiFetch(`/api/inbox/tags/${editingTag.id}`, {
          method: 'PUT',
          body: JSON.stringify({ name, color, scope }),
        });
        showSystemToast('Etiqueta actualizada', `Se actualizó "${name}".`, 'success');
      } else {
        await apiFetch('/api/inbox/tags', {
          method: 'POST',
          body: JSON.stringify({ name, color, scope }),
        });
        showSystemToast('Etiqueta creada', `La etiqueta "${name}" está lista para usarse.`, 'success');
      }
      await refreshInbox();
      openTagsManagerModal({ sub, apiFetch, refreshInbox });
    } catch (err) {
      showSystemToast('Error guardando etiqueta', (err as Error).message, 'danger');
    }
  });

  dialog.querySelectorAll('.js-edit-tag-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number(btn.getAttribute('data-id'));
      const found = sub.tags.find((x) => x.id === id);
      if (found) openTagsManagerModal({ sub, apiFetch, refreshInbox, editingTag: found });
    });
  });

  dialog.querySelectorAll('.js-delete-tag-item').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.getAttribute('data-id'));
      try {
        await apiFetch(`/api/inbox/tags/${id}`, { method: 'DELETE' });
        await refreshInbox();
        openTagsManagerModal({ sub, apiFetch, refreshInbox });
      } catch (err) {
        showSystemToast('Error al eliminar etiqueta', (err as Error).message, 'danger');
      }
    });
  });

  if (!dialog.open) dialog.showModal();
}

// ============================================================================
// PESTAÑA 4 DEL MÓDULO CONFIGURACIÓN: CONEXIONES (WhatsApp QR vs API, FB, IG, TikTok)
// ============================================================================
export function renderTabConnectionsHtml(
  conn: ChannelConnections | null,
  canEdit: boolean
): string {
  if (!conn) {
    return `<div class="crm-widget">Cargando configuración de conexiones...</div>`;
  }

  const disabledAttr = canEdit ? '' : 'disabled';
  const isQrMode = conn.wa_active_mode === 'qr';
  const webhookUrl = `${window.location.origin}/api/webhooks/omnichannel`;

  return `
    <div style="display:flex;flex-direction:column;gap:1.5rem;">
      <!-- 1. ARQUITECTURA DUAL DE WHATSAPP: SERVIDOR QR (WHATSAPP NORMAL O BUSINESS) VS WHATSAPP CLOUD API -->
      <div class="crm-widget crm-widget-accent-top">
        <div style="display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:1.15rem;">
          <div>
            <h3 style="font-size:1.15rem;display:flex;align-items:center;gap:0.5rem;">
              ${svgIcon('whatsapp', 20)}
              <span>Conexión de WhatsApp (Normal y Business) — Selector de Modalidad</span>
            </h3>
            <p style="font-size:0.84rem;color:var(--text-muted);margin-top:0.2rem;">
              Compatible con <strong>WhatsApp Business</strong> y <strong>WhatsApp Normal</strong>. Sincroniza automáticamente todos sus chats existentes y mensajes entrantes/salientes.
            </p>
          </div>
          <span class="badge">
            Modalidad Activa: ${isQrMode ? 'Servidor QR Interno (WhatsApp Normal / Business)' : 'WhatsApp Cloud API (Masivos y Chatbot)'}
          </span>
        </div>

        <!-- Selector de las 2 modalidades de WhatsApp -->
        <div class="wa-mode-selector-grid">
          <button type="button" class="wa-mode-card ${isQrMode ? 'active' : ''} js-select-wa-mode" data-mode="qr" ${disabledAttr}>
            <div style="display:flex;align-items:center;justify-content:space-between;width:100%;">
              <strong style="font-size:0.98rem;display:inline-flex;align-items:center;gap:0.5rem;color:var(--text-primary);">
                ${svgIcon('qrCode', 18)}
                <span>Opción 1: Servidor QR Interno (WhatsApp Normal o Business)</span>
              </strong>
              ${isQrMode ? `<span class="micro-perm-pill on">${svgIcon('check', 12)} <span>Activo</span></span>` : ''}
            </div>
            <p style="font-size:0.8rem;color:var(--text-secondary);line-height:1.45;">
              Ideal para sincronizar todos sus chats de <strong>WhatsApp Business o WhatsApp Normal</strong> escaneando el código QR oficial, con envío de texto, fotos, videos, audios y documentos.
            </p>
          </button>

          <button type="button" class="wa-mode-card ${!isQrMode ? 'active' : ''} js-select-wa-mode" data-mode="api" ${disabledAttr}>
            <div style="display:flex;align-items:center;justify-content:space-between;width:100%;">
              <strong style="font-size:0.98rem;display:inline-flex;align-items:center;gap:0.5rem;color:var(--text-primary);">
                ${svgIcon('bot', 18)}
                <span>Opción 2: WhatsApp Cloud API (Masivos + Chatbot)</span>
              </strong>
              ${!isQrMode ? `<span class="micro-perm-pill on">${svgIcon('check', 12)} <span>Activo</span></span>` : ''}
            </div>
            <p style="font-size:0.8rem;color:var(--text-secondary);line-height:1.45;">
              Ideal para <strong>mensajes masivos (Broadcast)</strong>, <strong>chatbots inteligentes</strong>, flujos automatizados y multi-agente de alto volumen mediante la API oficial de Meta.
            </p>
          </button>
        </div>

        <!-- Panel Dinámico según la modalidad de WhatsApp elegida -->
        ${
          isQrMode
            ? `
          <div id="wa-qr-live-panel" style="padding:1.25rem;border-radius:0.95rem;background:var(--surface-subtle);border:1px solid var(--widget-border);">
            <div class="config-grid-2" style="align-items:center;">
              <div style="display:flex;flex-direction:column;gap:0.85rem;">
                <div style="display:flex;flex-wrap:wrap;align-items:center;gap:0.5rem;">
                  <span class="micro-perm-pill ${conn.wa_qr_status === 'connected' ? 'on' : 'off'}">
                    <span class="status-dot"></span>
                    <span>${
                      conn.wa_qr_status === 'connected'
                        ? 'Sesión QR Vinculada y Sincronizando Chats'
                        : conn.wa_qr_status === 'awaiting_scan'
                        ? 'Código QR Oficial Listo para Escanear'
                        : 'Servidor QR Desconectado'
                    }</span>
                  </span>
                  <span style="font-size:0.75rem;color:var(--text-muted);">Soporta WhatsApp Normal y WhatsApp Business</span>
                </div>

                <h4 style="font-size:1.05rem;">Vinculación Directa por Código QR (Servidor Interno)</h4>
                <p style="font-size:0.83rem;color:var(--text-secondary);line-height:1.5;">
                  1. Abra <strong>WhatsApp</strong> o <strong>WhatsApp Business</strong> en su teléfono.<br/>
                  2. Toque en <strong>Dispositivos vinculados</strong> y luego en <strong>Vincular un dispositivo</strong>.<br/>
                  3. Escanee el código QR de la derecha para sincronizar todos sus chats e historial en la Bandeja de Entrada.
                </p>

                <div class="config-grid-2">
                  <div class="form-group">
                    <label class="form-label" for="conn-wa-qr-phone">Número de WhatsApp Vinculado</label>
                    <input type="tel" id="conn-wa-qr-phone" class="form-control" value="${conn.wa_qr_phone}" ${disabledAttr} />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="conn-wa-qr-device">Nombre del Servidor / Nodo</label>
                    <input type="text" id="conn-wa-qr-device" class="form-control" value="${conn.wa_qr_device}" ${disabledAttr} />
                  </div>
                </div>

                <div style="display:flex;flex-wrap:wrap;gap:0.55rem;margin-top:0.25rem;">
                  <button type="button" class="btn btn-primary btn-sm" id="btn-wa-qr-generate" ${disabledAttr}>
                    ${svgIcon('refresh', 14)}
                    <span>Generar Nuevo Código QR</span>
                  </button>
                  ${
                    conn.wa_qr_status === 'connected'
                      ? `<button type="button" class="btn btn-danger btn-sm" id="btn-wa-qr-disconnect" ${disabledAttr}>
                          ${svgIcon('xCircle', 14)}
                          <span>Cerrar Sesión QR / Desvincular</span>
                        </button>`
                      : ''
                  }
                </div>
              </div>

              <!-- Visor del Código QR Oficial de WhatsApp Web -->
              <div style="text-align:center;">
                <div class="qr-scanner-box" id="wa-qr-box-container">
                  ${
                    conn.wa_qr_status === 'connected'
                      ? `
                        <div style="padding:1.2rem 0.5rem;display:flex;flex-direction:column;align-items:center;gap:0.65rem;color:#059669;">
                          ${svgIcon('checkCircle', 62)}
                          <strong style="font-size:0.95rem;color:#0f172a;">WhatsApp Vinculado</strong>
                          <span style="font-size:0.8rem;color:#475569;font-weight:600;">${conn.wa_qr_phone}</span>
                          <span style="font-size:0.72rem;color:#64748b;">Chats sincronizados en Bandeja de Mensajes</span>
                        </div>
                      `
                      : conn.wa_qr_session_code && conn.wa_qr_session_code.startsWith('data:image/')
                      ? `
                        <img
                          id="wa-real-qr-img"
                          src="${conn.wa_qr_session_code}"
                          alt="Código QR Oficial de WhatsApp Web"
                          style="width:236px;height:236px;display:block;border-radius:0.5rem;"
                        />
                        <span style="font-size:0.75rem;font-weight:700;margin-top:0.5rem;color:#0f172a;">
                          Escanee con WhatsApp o WhatsApp Business
                        </span>
                      `
                      : `
                        <div style="padding:1.5rem 0.75rem;display:flex;flex-direction:column;align-items:center;gap:0.65rem;color:#475569;">
                          ${svgIcon('qrCode', 48)}
                          <strong style="font-size:0.84rem;color:#0f172a;">Generando QR oficial de WhatsApp...</strong>
                          <span style="font-size:0.74rem;color:#64748b;">Conectando con servidores de WhatsApp Web</span>
                        </div>
                      `
                  }
                </div>
              </div>
            </div>
          </div>
        `
            : `
          <!-- PANEL MODO 2: WHATSAPP CLOUD API OFICIAL (MASIVOS + CHATBOT IA) -->
          <div style="padding:1.25rem;border-radius:0.95rem;background:var(--surface-subtle);border:1px solid var(--widget-border);display:flex;flex-direction:column;gap:1.1rem;">
            <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:0.75rem;">
              <div>
                <h4 style="font-size:1.05rem;">Credenciales de WhatsApp Cloud API, Mensajes Masivos y Chatbot</h4>
                <p style="font-size:0.8rem;color:var(--text-muted);">
                  Conecte su cuenta de Meta for Developers para habilitar envíos masivos, plantillas verificadas y respuestas de Chatbot.
                </p>
              </div>
              <span class="micro-perm-pill on">
                ${svgIcon('checkCircle', 13)}
                <span>API Lista para Masivos y Chatbot</span>
              </span>
            </div>

            <div class="config-grid-3">
              <div class="form-group">
                <label class="form-label" for="conn-wa-phone-id">Phone Number ID *</label>
                <input type="text" id="conn-wa-phone-id" class="form-control" placeholder="Ej. 102938475610293" value="${conn.wa_phone_number_id || ''}" ${disabledAttr} />
              </div>
              <div class="form-group">
                <label class="form-label" for="conn-wa-waba-id">WhatsApp Business Account ID *</label>
                <input type="text" id="conn-wa-waba-id" class="form-control" placeholder="Ej. 192837465019283" value="${conn.wa_business_account_id || ''}" ${disabledAttr} />
              </div>
              <div class="form-group">
                <label class="form-label" for="conn-wa-verify-token">Webhook Verify Token *</label>
                <input type="text" id="conn-wa-verify-token" class="form-control" placeholder="Token de verificación" value="${conn.wa_verify_token || ''}" ${disabledAttr} />
              </div>
            </div>

            <div class="config-grid-2">
              <div class="form-group">
                <label class="form-label" for="conn-wa-access-token">Token Permanente de Acceso (System User Token) *</label>
                <input type="password" id="conn-wa-access-token" class="form-control" placeholder="EAAG..." value="${conn.wa_access_token || ''}" ${disabledAttr} />
              </div>
              <div class="form-group">
                <label class="form-label">URL de Webhook para Meta App Dashboard</label>
                <div style="display:flex;gap:0.45rem;">
                  <input type="text" class="form-control" value="${webhookUrl}" readonly />
                  <button type="button" class="btn btn-secondary btn-sm" id="btn-copy-webhook" data-url="${webhookUrl}">
                    ${svgIcon('copy', 14)}
                    <span>Copiar</span>
                  </button>
                </div>
              </div>
            </div>

            <div class="config-grid-2" style="padding-top:0.5rem;border-top:1px dashed var(--widget-border);">
              <div style="display:flex;flex-direction:column;gap:0.55rem;">
                <label style="display:flex;align-items:center;gap:0.65rem;font-size:0.88rem;font-weight:600;cursor:pointer;">
                  <input type="checkbox" id="conn-wa-mass-enabled" switch ${conn.wa_mass_messaging_enabled ? 'checked' : ''} ${disabledAttr} />
                  <span>Habilitar Módulo de Mensajes Masivos (Campañas / Broadcast)</span>
                </label>
                <label style="display:flex;align-items:center;gap:0.65rem;font-size:0.88rem;font-weight:600;cursor:pointer;">
                  <input type="checkbox" id="conn-wa-chatbot-enabled" switch ${conn.wa_chatbot_enabled ? 'checked' : ''} ${disabledAttr} />
                  <span>Habilitar Respuesta Automática de Chatbot IA al recibir mensajes</span>
                </label>
              </div>

              <div class="form-group">
                <label class="form-label" for="conn-wa-chatbot-prompt">Mensaje / Prompt de Bienvenida del Chatbot Automático</label>
                <textarea id="conn-wa-chatbot-prompt" class="form-control" rows="2" placeholder="Escribe el mensaje inicial del asistente..." ${disabledAttr}>${conn.wa_chatbot_prompt || ''}</textarea>
              </div>
            </div>
          </div>
        `
        }
      </div>

      <!-- 2. CONEXIÓN FÁCIL DE BANDEJAS DE FACEBOOK MESSENGER, INSTAGRAM DIRECT Y TIKTOK -->
      <div class="config-grid-3">
        <!-- FACEBOOK MESSENGER -->
        <div class="crm-widget" style="border-top:3px solid #2563eb;display:flex;flex-direction:column;justify-content:space-between;gap:1rem;">
          <div style="display:flex;flex-direction:column;gap:0.85rem;">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div style="display:flex;align-items:center;gap:0.55rem;">
                <span style="width:36px;height:36px;border-radius:10px;background:#2563eb;color:#fff;display:inline-flex;align-items:center;justify-content:center;">
                  ${svgIcon('facebook', 18)}
                </span>
                <div>
                  <h4 style="font-size:1rem;">Facebook Messenger</h4>
                  <span style="font-size:0.73rem;color:var(--text-muted);">Bandeja de Página Comercial</span>
                </div>
              </div>
              <span class="micro-perm-pill ${conn.fb_connected ? 'on' : 'off'}">
                <span class="status-dot"></span>
                <span>${conn.fb_connected ? 'Conectado' : 'Desconectado'}</span>
              </span>
            </div>

            <div class="form-group">
              <label class="form-label" for="conn-fb-page-name">Nombre de la Página de Facebook</label>
              <input type="text" id="conn-fb-page-name" class="form-control" placeholder="Ej. Mi Empresa ISP" value="${conn.fb_page_name || ''}" ${disabledAttr} />
            </div>

            <div class="form-group">
              <label class="form-label" for="conn-fb-page-id">ID de Página (Page ID)</label>
              <input type="text" id="conn-fb-page-id" class="form-control" placeholder="Ej. 10492837465" value="${conn.fb_page_id || ''}" ${disabledAttr} />
            </div>

            <div class="form-group">
              <label class="form-label" for="conn-fb-token">Token de Acceso de Página</label>
              <input type="password" id="conn-fb-token" class="form-control" placeholder="EAAG..." value="${conn.fb_access_token || ''}" ${disabledAttr} />
            </div>

            <label style="display:flex;align-items:center;gap:0.55rem;font-size:0.82rem;font-weight:600;cursor:pointer;">
              <input type="checkbox" id="conn-fb-sync" switch ${conn.fb_auto_sync ? 'checked' : ''} ${disabledAttr} />
              <span>Recibir mensajes y comentarios de Facebook en Bandeja</span>
            </label>
          </div>

          <div style="display:flex;gap:0.45rem;">
            <button type="button" class="btn ${conn.fb_connected ? 'btn-secondary' : 'btn-primary'} btn-sm js-verify-fb-conn" style="flex:1;" ${disabledAttr}>
              ${svgIcon('facebook', 14)}
              <span>${conn.fb_connected ? 'Reconectar / Sincronizar Facebook' : 'Conectar Facebook Messenger'}</span>
            </button>
            ${
              conn.fb_connected
                ? `<button type="button" class="btn btn-outline-danger btn-sm js-disconnect-fb-conn" title="Desconectar página" ${disabledAttr}>
                    ${svgIcon('close', 14)}
                  </button>`
                : ''
            }
          </div>
        </div>

        <!-- INSTAGRAM DIRECT -->
        <div class="crm-widget" style="border-top:3px solid #ec4899;display:flex;flex-direction:column;justify-content:space-between;gap:1rem;">
          <div style="display:flex;flex-direction:column;gap:0.85rem;">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div style="display:flex;align-items:center;gap:0.55rem;">
                <span style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#f59e0b,#ec4899,#8b5cf6);color:#fff;display:inline-flex;align-items:center;justify-content:center;">
                  ${svgIcon('instagram', 18)}
                </span>
                <div>
                  <h4 style="font-size:1rem;">Instagram Direct</h4>
                  <span style="font-size:0.73rem;color:var(--text-muted);">DMs, Historias y Reels</span>
                </div>
              </div>
              <span class="micro-perm-pill ${conn.ig_connected ? 'on' : 'off'}">
                <span class="status-dot"></span>
                <span>${conn.ig_connected ? 'Conectado' : 'Sin activar'}</span>
              </span>
            </div>

            <div class="form-group">
              <label class="form-label" for="conn-ig-username">Usuario de Instagram Profesional</label>
              <input type="text" id="conn-ig-username" class="form-control" placeholder="@tuempresa" value="${conn.ig_username || ''}" ${disabledAttr} />
            </div>

            <div class="form-group">
              <label class="form-label" for="conn-ig-id">Instagram Business Account ID</label>
              <input type="text" id="conn-ig-id" class="form-control" placeholder="17841..." value="${conn.ig_account_id || ''}" ${disabledAttr} />
            </div>

            <div class="form-group">
              <label class="form-label" for="conn-ig-token">Token de Mensajería Instagram</label>
              <input type="password" id="conn-ig-token" class="form-control" placeholder="Token de Instagram Graph API" value="${conn.ig_access_token || ''}" ${disabledAttr} />
            </div>

            <label style="display:flex;align-items:center;gap:0.55rem;font-size:0.82rem;font-weight:600;cursor:pointer;">
              <input type="checkbox" id="conn-ig-stories" switch ${conn.ig_sync_stories ? 'checked' : ''} ${disabledAttr} />
              <span>Sincronizar menciones en Historias y mensajes directos</span>
            </label>
          </div>

          <div style="display:flex;gap:0.45rem;">
            <button type="button" class="btn ${conn.ig_connected ? 'btn-secondary' : 'btn-primary'} btn-sm js-verify-ig-conn" style="flex:1;" ${disabledAttr}>
              ${svgIcon('instagram', 14)}
              <span>${conn.ig_connected ? 'Reconectar / Verificar Instagram' : 'Conectar Instagram Direct'}</span>
            </button>
            ${
              conn.ig_connected
                ? `<button type="button" class="btn btn-outline-danger btn-sm js-disconnect-ig-conn" title="Desconectar Instagram" ${disabledAttr}>
                    ${svgIcon('close', 14)}
                  </button>`
                : ''
            }
          </div>
        </div>

        <!-- TIKTOK BUSINESS MESSAGING -->
        <div class="crm-widget" style="border-top:3px solid #14b8a6;display:flex;flex-direction:column;justify-content:space-between;gap:1rem;">
          <div style="display:flex;flex-direction:column;gap:0.85rem;">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div style="display:flex;align-items:center;gap:0.55rem;">
                <span style="width:36px;height:36px;border-radius:10px;background:#0f172a;color:#fff;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--widget-border);">
                  ${svgIcon('tiktok', 18)}
                </span>
                <div>
                  <h4 style="font-size:1rem;">TikTok Business</h4>
                  <span style="font-size:0.73rem;color:var(--text-muted);">Bandeja de Entrada y TikTok Leads</span>
                </div>
              </div>
              <span class="micro-perm-pill ${conn.tt_connected ? 'on' : 'off'}">
                <span class="status-dot"></span>
                <span>${conn.tt_connected ? 'Conectado' : 'Sin activar'}</span>
              </span>
            </div>

            <div class="form-group">
              <label class="form-label" for="conn-tt-handle">Cuenta Oficial de TikTok</label>
              <input type="text" id="conn-tt-handle" class="form-control" placeholder="@tunegocio" value="${conn.tt_account_handle || ''}" ${disabledAttr} />
            </div>

            <div class="form-group">
              <label class="form-label" for="conn-tt-key">TikTok App / Client Key</label>
              <input type="text" id="conn-tt-key" class="form-control" placeholder="Client Key" value="${conn.tt_client_key || ''}" ${disabledAttr} />
            </div>

            <div class="form-group">
              <label class="form-label" for="conn-tt-token">Token de Acceso TikTok Business</label>
              <input type="password" id="conn-tt-token" class="form-control" placeholder="Access Token de TikTok" value="${conn.tt_access_token || ''}" ${disabledAttr} />
            </div>

            <label style="display:flex;align-items:center;gap:0.55rem;font-size:0.82rem;font-weight:600;cursor:pointer;">
              <input type="checkbox" id="conn-tt-leads" switch ${conn.tt_sync_leads ? 'checked' : ''} ${disabledAttr} />
              <span>Recibir mensajes directos y formularios de TikTok Ads</span>
            </label>
          </div>

          <div style="display:flex;gap:0.45rem;">
            <button type="button" class="btn ${conn.tt_connected ? 'btn-secondary' : 'btn-primary'} btn-sm js-verify-tt-conn" style="flex:1;" ${disabledAttr}>
              ${svgIcon('tiktok', 14)}
              <span>${conn.tt_connected ? 'Reconectar / Verificar TikTok' : 'Conectar TikTok Business'}</span>
            </button>
            ${
              conn.tt_connected
                ? `<button type="button" class="btn btn-outline-danger btn-sm js-disconnect-tt-conn" title="Desconectar TikTok" ${disabledAttr}>
                    ${svgIcon('close', 14)}
                  </button>`
                : ''
            }
          </div>
        </div>
      </div>

      <div style="display:flex;justify-content:flex-end;">
        <button type="button" class="btn btn-primary crm-mobile-btn-full" id="btn-save-all-connections" ${disabledAttr}>
          ${svgIcon('save', 16)}
          <span>Guardar Configuración de Conexiones Omnicanal</span>
        </button>
      </div>
    </div>
  `;
}

// ============================================================================
// ENLACE DE EVENTOS PARA BANDEJA DE MENSAJES Y CONEXIONES
// ============================================================================
export function scrollLatestChatMessageIntoView(): void {
  if (!CSS.supports('scroll-initial-target', 'nearest')) {
    const target = document.querySelector('.chat-msg-bubble.latest-target');
    if (target) {
      target.scrollIntoView({ behavior: 'instant' as ScrollBehavior, block: 'end' });
    }
  } else {
    const scroller = document.getElementById('chat-messages-scroller');
    if (scroller) {
      scroller.scrollTop = scroller.scrollHeight;
    }
  }
}

let activeQrPollTimer: number | null = null;
let activeInboxPollTimer: number | null = null;
let activeInboxEventSource: EventSource | null = null;

function clearLiveTimers() {
  if (activeQrPollTimer !== null) {
    window.clearInterval(activeQrPollTimer);
    activeQrPollTimer = null;
  }
  if (activeInboxPollTimer !== null) {
    window.clearInterval(activeInboxPollTimer);
    activeInboxPollTimer = null;
  }
  if (activeInboxEventSource !== null) {
    activeInboxEventSource.close();
    activeInboxEventSource = null;
  }
}

export const conversationMessagesCache = new Map<number, OmnichannelMessage[]>();
let maxKnownMessageId = 0;

export function playNotificationSound(): void {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Doble tono nítido tipo WhatsApp / Mac
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now); // A5
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.14);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1174.66, now + 0.1); // D6
    gain2.gain.setValueAtTime(0.25, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.35);
  } catch {
    // Si el navegador bloquea el audio antes del primer gesto
  }
}

export function triggerNewMessageNotification(sender: string, body: string): void {
  playNotificationSound();
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      new Notification(`Mensaje de ${sender}`, {
        body: body || 'Archivo multimedia o nota de voz recibida.',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'crm-whatsapp-msg',
      });
    } catch {
      // Ignorar restricciones en WebView
    }
  }
}

export function openMediaLightboxModal(opts: {
  mediaType: 'image' | 'video' | 'document';
  mediaUrl: string;
  mediaTitle: string;
}): void {
  document.getElementById('chat-media-viewer-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'chat-media-viewer-modal';
  modal.className = 'chat-media-lightbox-overlay';

  let contentHtml = '';
  if (opts.mediaType === 'image') {
    contentHtml = `
      <img src="${opts.mediaUrl}" alt="${escapeHtml(opts.mediaTitle)}" id="lightbox-main-img" class="lightbox-main-img" />
    `;
  } else if (opts.mediaType === 'video') {
    contentHtml = `
      <div class="modern-video-theater-wrapper">
        <video src="${opts.mediaUrl}" autoplay playsinline class="lightbox-main-video js-theater-video" id="theater-video-element"></video>
        <div class="theater-video-controls" id="theater-video-controls">
          <button type="button" class="theater-ctrl-btn js-theater-play-pause" title="Play / Pausa (Espacio)">
            ${svgIcon('pause', 18)}
          </button>
          <div class="theater-progress-wrapper js-theater-scrub" title="Avanzar / Retroceder">
            <div class="theater-progress-bar">
              <div class="theater-progress-fill js-theater-progress-fill" style="width: 0%;"></div>
            </div>
          </div>
          <span class="theater-time-display js-theater-time">0:00 / 0:00</span>
          <button type="button" class="theater-speed-btn js-theater-speed" title="Velocidad (1x, 1.25x, 1.5x, 2x)">1x</button>
          <button type="button" class="theater-ctrl-btn js-theater-mute" title="Silenciar / Activar sonido (M)">
            ${svgIcon('volume2', 17)}
          </button>
          <button type="button" class="theater-ctrl-btn js-theater-fullscreen" title="Pantalla Completa (F)">
            ${svgIcon('maximize', 17)}
          </button>
        </div>
      </div>
    `;
  } else {
    contentHtml = `
      <iframe src="${opts.mediaUrl}" class="lightbox-main-iframe" title="${escapeHtml(opts.mediaTitle)}"></iframe>
    `;
  }

  modal.innerHTML = `
    <header class="lightbox-header">
      <div class="lightbox-title-box">
        <strong class="lightbox-filename">${escapeHtml(opts.mediaTitle || 'Archivo Adjunto')}</strong>
        <span class="lightbox-filetype">${opts.mediaType.toUpperCase()}</span>
      </div>
      <div class="lightbox-actions-box">
        ${
          opts.mediaType === 'image'
            ? `
          <button type="button" class="lightbox-btn" id="lightbox-zoom-in" title="Acercar (+)">
            ${svgIcon('plus', 16)}
          </button>
          <button type="button" class="lightbox-btn" id="lightbox-zoom-out" title="Alejar (-)">
            ${svgIcon('minus', 16)}
          </button>
          <button type="button" class="lightbox-btn" id="lightbox-zoom-reset" title="Restablecer (100%)">
            1x
          </button>
        `
            : ''
        }
        <a href="${opts.mediaUrl}" download="${escapeHtml(opts.mediaTitle || 'archivo')}" class="lightbox-btn" title="Descargar archivo" target="_blank" rel="noopener">
          ${svgIcon('download', 16)}
        </a>
        <button type="button" class="lightbox-btn lightbox-btn-close" id="lightbox-btn-close" title="Cerrar visor (Esc)">
          ${svgIcon('close', 18)}
        </button>
      </div>
    </header>
    <div class="lightbox-content-body">
      ${contentHtml}
    </div>
  `;

  document.body.appendChild(modal);

  const closeViewer = () => modal.remove();
  modal.querySelector('#lightbox-btn-close')?.addEventListener('click', closeViewer);
  modal.addEventListener('click', (e) => {
    if (e.target === modal || (e.target as HTMLElement).classList.contains('lightbox-content-body')) {
      closeViewer();
    }
  });

  if (opts.mediaType === 'image') {
    let currentZoom = 1;
    const imgEl = modal.querySelector('#lightbox-main-img') as HTMLImageElement | null;
    modal.querySelector('#lightbox-zoom-in')?.addEventListener('click', () => {
      currentZoom = Math.min(3, currentZoom + 0.3);
      if (imgEl) imgEl.style.transform = `scale(${currentZoom})`;
    });
    modal.querySelector('#lightbox-zoom-out')?.addEventListener('click', () => {
      currentZoom = Math.max(0.4, currentZoom - 0.3);
      if (imgEl) imgEl.style.transform = `scale(${currentZoom})`;
    });
    modal.querySelector('#lightbox-zoom-reset')?.addEventListener('click', () => {
      currentZoom = 1;
      if (imgEl) imgEl.style.transform = 'scale(1)';
    });
  }

  if (opts.mediaType === 'video') {
    const videoEl = modal.querySelector<HTMLVideoElement>('.js-theater-video');
    const playPauseBtn = modal.querySelector<HTMLButtonElement>('.js-theater-play-pause');
    const progressFill = modal.querySelector<HTMLElement>('.js-theater-progress-fill');
    const progressTrack = modal.querySelector<HTMLElement>('.js-theater-scrub');
    const timeDisplay = modal.querySelector<HTMLElement>('.js-theater-time');
    const speedBtn = modal.querySelector<HTMLButtonElement>('.js-theater-speed');
    const muteBtn = modal.querySelector<HTMLButtonElement>('.js-theater-mute');
    const fsBtn = modal.querySelector<HTMLButtonElement>('.js-theater-fullscreen');

    if (videoEl) {
      const formatSecs = (sec: number) => {
        if (isNaN(sec) || !isFinite(sec)) return '0:00';
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
      };

      const updateTimes = () => {
        if (timeDisplay) {
          timeDisplay.textContent = `${formatSecs(videoEl.currentTime)} / ${formatSecs(videoEl.duration || 0)}`;
        }
        if (progressFill && videoEl.duration) {
          const pct = Math.min(100, (videoEl.currentTime / videoEl.duration) * 100);
          progressFill.style.width = `${pct}%`;
        }
      };

      videoEl.addEventListener('timeupdate', updateTimes);
      videoEl.addEventListener('loadedmetadata', updateTimes);

      const togglePlay = () => {
        if (videoEl.paused) {
          videoEl.play().catch(() => {});
          if (playPauseBtn) playPauseBtn.innerHTML = svgIcon('pause', 18);
        } else {
          videoEl.pause();
          if (playPauseBtn) playPauseBtn.innerHTML = svgIcon('play', 18);
        }
      };

      playPauseBtn?.addEventListener('click', togglePlay);
      videoEl.addEventListener('click', togglePlay);

      videoEl.addEventListener('ended', () => {
        if (playPauseBtn) playPauseBtn.innerHTML = svgIcon('play', 18);
      });

      if (progressTrack) {
        const handleSeek = (e: MouseEvent) => {
          const rect = progressTrack.getBoundingClientRect();
          const clickX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
          const seekPct = clickX / rect.width;
          if (videoEl.duration) {
            videoEl.currentTime = seekPct * videoEl.duration;
            updateTimes();
          }
        };
        progressTrack.addEventListener('click', handleSeek);
      }

      const speeds = [1, 1.25, 1.5, 2];
      let speedIdx = 0;
      speedBtn?.addEventListener('click', () => {
        speedIdx = (speedIdx + 1) % speeds.length;
        const s = speeds[speedIdx];
        videoEl.playbackRate = s;
        if (speedBtn) speedBtn.textContent = `${s}x`;
      });

      muteBtn?.addEventListener('click', () => {
        videoEl.muted = !videoEl.muted;
        if (muteBtn) {
          muteBtn.innerHTML = videoEl.muted ? svgIcon('volumeX', 17) : svgIcon('volume2', 17);
        }
      });

      fsBtn?.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          modal.querySelector('.modern-video-theater-wrapper')?.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      });

      const handleKeydown = (e: KeyboardEvent) => {
        if (e.key === ' ' || e.code === 'Space') {
          e.preventDefault();
          togglePlay();
        } else if (e.key === 'ArrowRight') {
          videoEl.currentTime = Math.min(videoEl.duration || 0, videoEl.currentTime + 5);
        } else if (e.key === 'ArrowLeft') {
          videoEl.currentTime = Math.max(0, videoEl.currentTime - 5);
        } else if (e.key === 'm' || e.key === 'M') {
          videoEl.muted = !videoEl.muted;
          if (muteBtn) {
            muteBtn.innerHTML = videoEl.muted ? svgIcon('volumeX', 17) : svgIcon('volume2', 17);
          }
        } else if (e.key === 'f' || e.key === 'F') {
          fsBtn?.click();
        }
      };
      window.addEventListener('keydown', handleKeydown);

      const closeBtn = modal.querySelector('#lightbox-btn-close');
      closeBtn?.addEventListener('click', () => {
        window.removeEventListener('keydown', handleKeydown);
      });
    }
  }
}

function bindSwipeToReplyEvents(
  container: HTMLElement,
  onReply: (item: { id: number; sender: string; body: string; media_type?: string; media_url?: string }) => void
): void {
  const rows = container.querySelectorAll<HTMLElement>('.chat-msg-row');
  rows.forEach((row) => {
    let touchStartX = 0;
    let touchStartY = 0;
    let isHorizontalSwipe = false;
    let currentDeltaX = 0;
    const targetBubble = row.querySelector<HTMLElement>(
      '.chat-msg-bubble, .wa-standalone-audio-card, .wa-standalone-image-card, .wa-standalone-video-card'
    );
    if (!targetBubble) return;

    row.addEventListener(
      'touchstart',
      (e: TouchEvent) => {
        if (e.touches.length !== 1) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        isHorizontalSwipe = false;
        currentDeltaX = 0;
        targetBubble.style.transition = 'none';
      },
      { passive: true }
    );

    row.addEventListener(
      'touchmove',
      (e: TouchEvent) => {
        if (e.touches.length !== 1) return;
        const deltaX = e.touches[0].clientX - touchStartX;
        const deltaY = e.touches[0].clientY - touchStartY;

        if (!isHorizontalSwipe && Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
          isHorizontalSwipe = true;
        }

        if (isHorizontalSwipe) {
          const clamped = Math.sign(deltaX) * Math.min(80, Math.pow(Math.abs(deltaX), 0.85) * 2.2);
          currentDeltaX = deltaX;
          targetBubble.style.transform = `translateX(${clamped}px)`;
          row.classList.toggle('swipe-active', Math.abs(clamped) > 35);
        }
      },
      { passive: true }
    );

    row.addEventListener(
      'touchend',
      () => {
        if (isHorizontalSwipe) {
          targetBubble.style.transition = 'transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1)';
          targetBubble.style.transform = 'translateX(0)';
          row.classList.remove('swipe-active');

          if (Math.abs(currentDeltaX) > 55) {
            const id = Number(row.getAttribute('data-id') || 0);
            const sender = row.getAttribute('data-sender') || 'Mensaje';
            const body = row.getAttribute('data-body') || '';
            const media_type = row.getAttribute('data-media-type') || 'none';
            const media_url = row.getAttribute('data-media-url') || '';
            if (id) {
              if (navigator.vibrate) navigator.vibrate(35);
              onReply({ id, sender, body, media_type, media_url });
            }
          }
        }
      },
      { passive: true }
    );
  });
}

export function openForwardMessageModal(callbacks: {
  messageId: number;
  body: string;
  sender: string;
  mediaType: string;
  mediaUrl: string;
  mediaFilename: string;
  sub: OmnichannelSubState;
  apiFetch: <T = any>(url: string, options?: RequestInit) => Promise<T>;
  refreshInbox: () => Promise<void>;
}): void {
  const { messageId, body, mediaType, mediaUrl, mediaFilename, sub, apiFetch, refreshInbox } = callbacks;
  document.getElementById('crm-forward-modal-overlay')?.remove();

  const selectedIds = new Set<number>();
  let searchQuery = '';

  const modal = document.createElement('div');
  modal.id = 'crm-forward-modal-overlay';
  modal.className = 'system-confirm-overlay';

  // Contenido de la vista previa del mensaje que se va a reenviar
  let previewContentHtml = '';
  if (mediaType === 'image' && mediaUrl) {
    previewContentHtml = `
      <img src="${mediaUrl}" style="width:42px;height:42px;border-radius:6px;object-fit:cover;flex-shrink:0;box-shadow:0 1px 4px rgba(0,0,0,0.15);" alt="" />
      <div style="flex:1;min-width:0;font-size:0.8rem;color:var(--text-primary);">
        <strong style="display:flex;align-items:center;gap:0.3rem;color:var(--widget-accent);">${svgIcon('image', 12)} Foto</strong>
        <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;opacity:0.85;">${escapeHtml(body || 'Foto de WhatsApp')}</span>
      </div>
    `;
  } else if (mediaType === 'video') {
    previewContentHtml = `
      <div style="width:42px;height:42px;border-radius:6px;background:#000;display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0;">
        ${svgIcon('play', 18)}
      </div>
      <div style="flex:1;min-width:0;font-size:0.8rem;color:var(--text-primary);">
        <strong style="display:flex;align-items:center;gap:0.3rem;color:var(--widget-accent);">${svgIcon('video', 12)} Video</strong>
        <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;opacity:0.85;">${escapeHtml(body || 'Video')}</span>
      </div>
    `;
  } else if (mediaType === 'audio') {
    previewContentHtml = `
      <div style="width:42px;height:42px;border-radius:6px;background:rgba(16,185,129,0.15);color:#10b981;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        ${svgIcon('mic', 18)}
      </div>
      <div style="flex:1;min-width:0;font-size:0.8rem;color:var(--text-primary);">
        <strong style="display:block;color:#10b981;">Nota de voz</strong>
        <span style="opacity:0.85;">Audio de WhatsApp</span>
      </div>
    `;
  } else if (mediaType === 'document') {
    previewContentHtml = `
      <div style="width:42px;height:42px;border-radius:6px;background:rgba(59,130,246,0.15);color:#3b82f6;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        ${svgIcon('fileText', 18)}
      </div>
      <div style="flex:1;min-width:0;font-size:0.8rem;color:var(--text-primary);">
        <strong style="display:block;color:#3b82f6;">Documento</strong>
        <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;opacity:0.85;">${escapeHtml(mediaFilename || 'Archivo adjunto')}</span>
      </div>
    `;
  } else {
    previewContentHtml = `
      <div style="flex:1;min-width:0;font-size:0.82rem;color:var(--text-primary);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.35;">
        ${escapeHtml(body)}
      </div>
    `;
  }

  modal.innerHTML = `
    <div class="forward-modal-card">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:0.85rem 1rem;border-bottom:1px solid var(--widget-border);">
        <div style="display:flex;align-items:center;gap:0.5rem;">
          <span style="color:var(--widget-accent);display:inline-flex;">${svgIcon('cornerUpRight', 18)}</span>
          <h3 style="margin:0;font-size:1.05rem;font-weight:700;color:var(--text-primary);">Reenviar mensaje</h3>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-close-forward-modal" style="padding:0.25rem 0.5rem;" title="Cerrar">
          ${svgIcon('close', 15)}
        </button>
      </div>

      <div class="forward-modal-preview">
        ${previewContentHtml}
      </div>

      <div class="forward-modal-search-box">
        <div style="position:relative;">
          <input
            type="text"
            id="forward-search-input"
            class="form-input"
            placeholder="Buscar chat o contacto..."
            style="width:100%;padding-left:2rem;height:38px;font-size:0.85rem;"
          />
          <span style="position:absolute;left:0.65rem;top:50%;transform:translateY(-50%);color:var(--text-muted);pointer-events:none;">
            ${svgIcon('search', 14)}
          </span>
        </div>
      </div>

      <div class="forward-modal-list" id="forward-contacts-container"></div>

      <div style="display:flex;align-items:center;justify-content:space-between;padding:0.75rem 1rem;border-top:1px solid var(--widget-border);background:var(--widget-bg);">
        <span id="forward-selected-count" style="font-size:0.78rem;color:var(--text-muted);">0 chats seleccionados</span>
        <div style="display:flex;align-items:center;gap:0.5rem;">
          <button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-forward">Cancelar</button>
          <button type="button" class="btn btn-primary btn-sm" id="btn-confirm-forward" disabled style="display:inline-flex;align-items:center;gap:0.4rem;">
            ${svgIcon('cornerUpRight', 14)}
            <span id="forward-confirm-text">Reenviar</span>
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const container = modal.querySelector('#forward-contacts-container') as HTMLElement;
  const searchInput = modal.querySelector('#forward-search-input') as HTMLInputElement;
  const confirmBtn = modal.querySelector('#btn-confirm-forward') as HTMLButtonElement;
  const confirmText = modal.querySelector('#forward-confirm-text') as HTMLElement;
  const countLabel = modal.querySelector('#forward-selected-count') as HTMLElement;

  const renderContactList = () => {
    const q = searchQuery.toLowerCase().trim();
    const filtered = sub.conversations.filter((c) => {
      if (!q) return true;
      return (
        c.contact_name.toLowerCase().includes(q) ||
        c.contact_handle.toLowerCase().includes(q)
      );
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="padding:2rem 1rem;text-align:center;color:var(--text-muted);font-size:0.85rem;">
          No se encontraron contactos para reenviar.
        </div>
      `;
      return;
    }

    container.innerHTML = filtered
      .map((c) => {
        const isChecked = selectedIds.has(c.id);
        const initials = c.contact_name ? c.contact_name.slice(0, 2).toUpperCase() : 'WA';
        return `
          <div class="forward-contact-item ${isChecked ? 'is-selected' : ''}" data-conv-id="${c.id}">
            <input type="checkbox" class="forward-contact-checkbox" ${isChecked ? 'checked' : ''} tabindex="-1" />
            <div class="avatar-circle-sm" style="width:34px;height:34px;font-size:0.75rem;flex-shrink:0;">
              ${initials}
            </div>
            <div style="flex:1;min-width:0;">
              <strong style="font-size:0.85rem;color:var(--text-primary);display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${escapeHtml(c.contact_name)}
              </strong>
              <span style="font-size:0.72rem;color:var(--text-muted);display:block;">
                ${escapeHtml(c.contact_handle)}
              </span>
            </div>
            <span class="tag-pill-minimal" style="font-size:0.68rem;text-transform:capitalize;">
              ${c.channel}
            </span>
          </div>
        `;
      })
      .join('');

    container.querySelectorAll('.forward-contact-item').forEach((item) => {
      item.addEventListener('click', () => {
        const convId = Number(item.getAttribute('data-conv-id'));
        if (!convId) return;

        if (selectedIds.has(convId)) {
          selectedIds.delete(convId);
        } else {
          selectedIds.add(convId);
        }
        updateControls();
        renderContactList();
      });
    });
  };

  const updateControls = () => {
    const total = selectedIds.size;
    countLabel.textContent = `${total} chat${total === 1 ? '' : 's'} seleccionado${total === 1 ? '' : 's'}`;
    if (total === 0) {
      confirmBtn.disabled = true;
      confirmText.textContent = 'Reenviar';
    } else if (total === 1) {
      confirmBtn.disabled = false;
      confirmText.textContent = 'Reenviar a 1 chat';
    } else {
      confirmBtn.disabled = false;
      confirmText.textContent = `Reenviar a ${total} chats`;
    }
  };

  searchInput?.addEventListener('input', () => {
    searchQuery = searchInput.value;
    renderContactList();
  });

  const closeModal = () => modal.remove();
  modal.querySelector('#btn-close-forward-modal')?.addEventListener('click', closeModal);
  modal.querySelector('#btn-cancel-forward')?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  confirmBtn.addEventListener('click', async () => {
    if (selectedIds.size === 0) return;
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = `<div class="wa-media-loading-spinner" style="width:14px;height:14px;border-width:2px;"></div> <span>Reenviando...</span>`;

    try {
      await apiFetch(`/api/inbox/messages/${messageId}/forward`, {
        method: 'POST',
        body: JSON.stringify({
          target_conversation_ids: Array.from(selectedIds),
        }),
      });
      showSystemToast('Mensaje reenviado', `El mensaje fue reenviado a ${selectedIds.size} chat(s) con éxito.`, 'success');
      closeModal();
      await refreshInbox();
    } catch (err: any) {
      showSystemToast('Error al reenviar', err.message || 'No se pudo reenviar el mensaje', 'danger');
      confirmBtn.disabled = false;
      updateControls();
    }
  });

  renderContactList();
  setTimeout(() => searchInput?.focus(), 80);
}

export function openNewContactModal(callbacks: {
  sub: OmnichannelSubState;
  apiFetch: <T = any>(url: string, options?: RequestInit) => Promise<T>;
  refreshInbox: () => Promise<void>;
  rerender: () => void;
}): void {
  const { sub, apiFetch, refreshInbox } = callbacks;
  document.getElementById('inbox-new-contact-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'inbox-new-contact-modal';
  modal.className = 'system-confirm-overlay';
  modal.innerHTML = `
    <div class="system-confirm-card" style="max-width:440px;text-align:left;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
        <h3 style="margin:0;font-size:1.1rem;font-weight:700;display:flex;align-items:center;gap:0.5rem;color:var(--text-primary);">
          <span style="color:#10b981;display:inline-flex;">${svgIcon('messageSquare', 20)}</span>
          <span>Iniciar Nueva Conversación</span>
        </h3>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-close-new-contact-modal" style="padding:0.25rem 0.5rem;" title="Cerrar">
          ${svgIcon('close', 15)}
        </button>
      </div>

      <form id="form-new-contact" style="display:flex;flex-direction:column;gap:0.95rem;">
        <div class="form-group" style="display:flex;flex-direction:column;gap:0.35rem;">
          <label class="form-label" for="new-contact-name" style="font-weight:600;font-size:0.86rem;color:var(--text-primary);">Nombre del Contacto o Cliente *</label>
          <input type="text" id="new-contact-name" class="form-control" placeholder="Ej. Juan Pérez" required autocomplete="off" />
        </div>

        <div class="form-group" style="display:flex;flex-direction:column;gap:0.35rem;">
          <label class="form-label" for="new-contact-phone" style="font-weight:600;font-size:0.86rem;color:var(--text-primary);">Número de WhatsApp / Teléfono *</label>
          <input type="tel" id="new-contact-phone" class="form-control" placeholder="Ej. +51 987 654 321" required autocomplete="off" />
          <span class="form-hint" style="font-size:0.75rem;color:var(--text-muted);margin-top:0.2rem;">Escriba el número con código de país (ej. +51 para Perú o +54 para Argentina).</span>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:0.6rem;margin-top:0.6rem;">
          <button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-new-contact">Cancelar</button>
          <button type="submit" class="btn btn-primary btn-sm" id="btn-submit-new-contact">
            ${svgIcon('send', 14)}
            <span>Comenzar Chat</span>
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      closeModal();
    }
  };
  window.addEventListener('keydown', handleKeyDown);

  const closeModal = () => {
    window.removeEventListener('keydown', handleKeyDown);
    modal.remove();
  };
  modal.querySelector('#btn-close-new-contact-modal')?.addEventListener('click', closeModal);
  modal.querySelector('#btn-cancel-new-contact')?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  const form = modal.querySelector('#form-new-contact') as HTMLFormElement;
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameInput = modal.querySelector('#new-contact-name') as HTMLInputElement;
    const phoneInput = modal.querySelector('#new-contact-phone') as HTMLInputElement;
    const submitBtn = modal.querySelector('#btn-submit-new-contact') as HTMLButtonElement;

    const contactName = nameInput.value.trim();
    const contactPhone = phoneInput.value.trim();
    if (!contactName || !contactPhone) return;

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Iniciando chat...';
      const res = await apiFetch<{ id: number; alreadyExists?: boolean; success?: boolean }>('/api/inbox/conversations', {
        method: 'POST',
        body: JSON.stringify({
          contact_name: contactName,
          contact_handle: contactPhone,
          channel: 'whatsapp',
        }),
      });

      closeModal();
      sub.selectedConversationId = res.id;
      await refreshInbox();
      showSystemToast('Chat Abierto', `Conversación lista con ${contactName}.`, 'success');
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Comenzar Chat';
      showSystemToast('Error al iniciar chat', (err as Error).message, 'danger');
    }
  });

  setTimeout(() => {
    (modal.querySelector('#new-contact-name') as HTMLInputElement)?.focus();
  }, 50);
}

// Estado y Reproductor Global Persistente para Notas de Voz de WhatsApp
interface NexusGlobalAudioState {
  audio: HTMLAudioElement;
  currentSrc: string | null;
  currentMessageId: number | null;
  conversationId: number | null;
  senderName: string;
  playbackRate: number;
}

const globalAudioState: NexusGlobalAudioState =
  ((window as any).__nexusGlobalAudio =
    (window as any).__nexusGlobalAudio || {
      audio: new Audio(),
      currentSrc: null,
      currentMessageId: null,
      conversationId: null,
      senderName: '',
      playbackRate: 1,
    });

function formatAudioTime(sec: number): string {
  if (isNaN(sec) || !isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function setupGlobalAudioListeners(): void {
  if ((window as any).__nexusGlobalAudioInitialized) return;
  (window as any).__nexusGlobalAudioInitialized = true;

  const updateUI = () => {
    const audio = globalAudioState.audio;
    const isPlaying = !audio.paused && !audio.ended;
    const dur = audio.duration || 0;
    const cur = audio.currentTime || 0;
    const pct = dur > 0 ? (cur / dur) * 100 : 0;

    // 1. Sincronizar la burbuja de audio en el chat si está en pantalla
    if (globalAudioState.currentMessageId) {
      const bubble = document.querySelector(
        `.chat-msg-row[data-id="${globalAudioState.currentMessageId}"] .wa-audio-bubble`
      );
      if (bubble) {
        const toggleBtn = bubble.querySelector<HTMLButtonElement>('.js-wa-audio-toggle');
        const fill = bubble.querySelector<HTMLElement>('.js-wa-audio-fill');
        const timeLabel = bubble.querySelector<HTMLElement>('.js-wa-audio-time');
        const speedBtn = bubble.querySelector<HTMLButtonElement>('.js-wa-audio-speed');

        if (toggleBtn) {
          toggleBtn.innerHTML = isPlaying ? svgIcon('pause', 16) : svgIcon('play', 16);
        }
        if (fill) fill.style.width = `${pct}%`;
        if (timeLabel) timeLabel.textContent = isPlaying || cur > 0 ? formatAudioTime(cur) : formatAudioTime(dur);
        if (speedBtn) speedBtn.textContent = `${globalAudioState.playbackRate}x`;

        if (isPlaying) {
          bubble.classList.add('playing');
        } else {
          bubble.classList.remove('playing');
        }
      }
    }

    // 2. Sincronizar el reproductor flotante inferior
    const floatingBar = document.getElementById('nexus-floating-audio-bar');
    if (floatingBar) {
      const currentSelectedConvId = (window as any).__nexusCurrentSubState?.selectedConversationId;
      const isOutsideConv = currentSelectedConvId !== globalAudioState.conversationId;
      const bubbleExists = globalAudioState.currentMessageId
        ? Boolean(document.querySelector(`.chat-msg-row[data-id="${globalAudioState.currentMessageId}"]`))
        : false;

      // Se muestra flotante si hay audio activo Y (se cambió de chat O la burbuja no está en el DOM actual)
      const shouldShowFloating = Boolean(globalAudioState.currentSrc) && (isOutsideConv || !bubbleExists);
      if (shouldShowFloating) {
        floatingBar.style.display = 'flex';
        const floatPlayBtn = floatingBar.querySelector<HTMLButtonElement>('.js-floating-audio-toggle');
        const floatSender = floatingBar.querySelector<HTMLElement>('.js-floating-audio-sender');
        const floatFill = floatingBar.querySelector<HTMLElement>('.js-floating-audio-fill');
        const floatTime = floatingBar.querySelector<HTMLElement>('.js-floating-audio-time');
        const floatSpeed = floatingBar.querySelector<HTMLButtonElement>('.js-floating-audio-speed');

        if (floatPlayBtn) {
          floatPlayBtn.innerHTML = isPlaying ? svgIcon('pause', 18) : svgIcon('play', 18);
        }
        if (floatSender) {
          floatSender.innerHTML = `${svgIcon('mic', 13)} <span>${escapeHtml(globalAudioState.senderName || 'Nota de voz')}</span>`;
        }
        if (floatFill) floatFill.style.width = `${pct}%`;
        if (floatTime) floatTime.textContent = `${formatAudioTime(cur)} / ${formatAudioTime(dur)}`;
        if (floatSpeed) floatSpeed.textContent = `${globalAudioState.playbackRate}x`;
      } else {
        floatingBar.style.display = 'none';
      }
    }
  };

  const a = globalAudioState.audio;
  a.addEventListener('timeupdate', updateUI);
  a.addEventListener('play', updateUI);
  a.addEventListener('pause', updateUI);
  a.addEventListener('ended', () => {
    updateUI();
    const floatingBar = document.getElementById('nexus-floating-audio-bar');
    if (floatingBar) floatingBar.style.display = 'none';
    globalAudioState.currentSrc = null;
    globalAudioState.currentMessageId = null;
  });
  a.addEventListener('loadedmetadata', updateUI);
}

function ensureFloatingAudioBar(callbacks: {
  sub: OmnichannelSubState;
  rerender: () => void;
}): void {
  (window as any).__nexusCurrentSubState = callbacks.sub;
  (window as any).__nexusCurrentRerender = callbacks.rerender;
  setupGlobalAudioListeners();

  let bar = document.getElementById('nexus-floating-audio-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'nexus-floating-audio-bar';
    bar.className = 'nexus-floating-audio-bar';
    bar.style.display = 'none';
    bar.innerHTML = `
      <button type="button" class="nexus-floating-audio-play-btn js-floating-audio-toggle" title="Reproducir / Pausar">
        ${svgIcon('play', 18)}
      </button>
      <div class="nexus-floating-audio-info">
        <div class="nexus-floating-audio-sender js-floating-audio-sender" style="cursor:pointer;" title="Haga clic para ir a esta conversación">
          ${svgIcon('mic', 13)} <span>Nota de voz</span>
        </div>
        <div class="nexus-floating-audio-track js-floating-audio-track">
          <div class="nexus-floating-audio-fill js-floating-audio-fill"></div>
        </div>
        <div class="nexus-floating-audio-meta">
          <span class="js-floating-audio-time">0:00 / 0:00</span>
          <button type="button" class="nexus-floating-audio-speed js-floating-audio-speed" title="Velocidad (1x, 1.5x, 2x)">1x</button>
        </div>
      </div>
      <button type="button" class="nexus-floating-audio-close js-floating-audio-close" title="Cerrar reproductor">
        ${svgIcon('close', 16)}
      </button>
    `;
    document.body.appendChild(bar);

    bar.querySelector('.js-floating-audio-toggle')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const a = globalAudioState.audio;
      if (a.paused) {
        a.play().catch(() => {});
      } else {
        a.pause();
      }
    });

    bar.querySelector('.js-floating-audio-track')?.addEventListener('click', (e: any) => {
      e.stopPropagation();
      const track = bar?.querySelector('.js-floating-audio-track') as HTMLElement;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(1, clickX / rect.width));
      if (globalAudioState.audio.duration) {
        globalAudioState.audio.currentTime = pct * globalAudioState.audio.duration;
      }
    });

    bar.querySelector('.js-floating-audio-speed')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (globalAudioState.playbackRate === 1) {
        globalAudioState.playbackRate = 1.5;
      } else if (globalAudioState.playbackRate === 1.5) {
        globalAudioState.playbackRate = 2;
      } else {
        globalAudioState.playbackRate = 1;
      }
      globalAudioState.audio.playbackRate = globalAudioState.playbackRate;
      const btn = bar?.querySelector('.js-floating-audio-speed');
      if (btn) btn.textContent = `${globalAudioState.playbackRate}x`;
    });

    bar.querySelector('.js-floating-audio-close')?.addEventListener('click', (e) => {
      e.stopPropagation();
      globalAudioState.audio.pause();
      globalAudioState.currentSrc = null;
      globalAudioState.currentMessageId = null;
      if (bar) bar.style.display = 'none';
    });

    bar.querySelector('.js-floating-audio-sender')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const subState = (window as any).__nexusCurrentSubState as OmnichannelSubState | undefined;
      const rerenderFn = (window as any).__nexusCurrentRerender as (() => void) | undefined;
      if (globalAudioState.conversationId && subState && rerenderFn) {
        if (subState.selectedConversationId !== globalAudioState.conversationId) {
          subState.selectedConversationId = globalAudioState.conversationId;
          rerenderFn();
        }
      }
    });
  }
}

function initWhatsAppAudioPlayers(
  container: HTMLElement | Document = document,
  sub?: OmnichannelSubState
): void {
  setupGlobalAudioListeners();

  const bubbles = container.querySelectorAll<HTMLElement>('.wa-audio-bubble');
  bubbles.forEach((bubble) => {
    const row = bubble.closest('.chat-msg-row') as HTMLElement | null;
    const msgId = row ? Number(row.getAttribute('data-id')) : 0;
    const sender = row?.getAttribute('data-sender') || 'Nota de voz';
    const audioSrc = bubble.getAttribute('data-audio-src') || row?.getAttribute('data-media-url') || '';

    const playBtn = bubble.querySelector<HTMLButtonElement>('.js-wa-audio-toggle');
    const fill = bubble.querySelector<HTMLElement>('.js-wa-audio-fill');
    const track = bubble.querySelector<HTMLElement>('.js-wa-audio-track');
    const timeLabel = bubble.querySelector<HTMLElement>('.js-wa-audio-time');
    const speedBtn = bubble.querySelector<HTMLButtonElement>('.js-wa-audio-speed');

    if (!playBtn || !audioSrc) return;

    // Sincronizar estado visual si coincide con el audio global actualmente cargado
    if (globalAudioState.currentMessageId === msgId && globalAudioState.currentSrc === audioSrc) {
      const a = globalAudioState.audio;
      const isPlaying = !a.paused && !a.ended;
      playBtn.innerHTML = isPlaying ? svgIcon('pause', 16) : svgIcon('play', 16);
      if (isPlaying) bubble.classList.add('playing');
      const dur = a.duration || 0;
      const cur = a.currentTime || 0;
      const pct = dur > 0 ? (cur / dur) * 100 : 0;
      if (fill) fill.style.width = `${pct}%`;
      if (timeLabel) timeLabel.textContent = isPlaying || cur > 0 ? formatAudioTime(cur) : formatAudioTime(dur);
      if (speedBtn) speedBtn.textContent = `${globalAudioState.playbackRate}x`;
    }

    playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const a = globalAudioState.audio;
      if (globalAudioState.currentSrc === audioSrc) {
        if (a.paused) {
          a.play().catch(() => {});
        } else {
          a.pause();
        }
      } else {
        a.pause();
        globalAudioState.currentSrc = audioSrc;
        globalAudioState.currentMessageId = msgId;
        globalAudioState.conversationId = sub?.selectedConversationId || null;
        globalAudioState.senderName = sender;
        a.src = audioSrc;
        a.playbackRate = globalAudioState.playbackRate;
        a.play().catch(() => {});
      }
    });

    track?.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation();
      const a = globalAudioState.audio;
      if (globalAudioState.currentSrc !== audioSrc) {
        a.pause();
        globalAudioState.currentSrc = audioSrc;
        globalAudioState.currentMessageId = msgId;
        globalAudioState.conversationId = sub?.selectedConversationId || null;
        globalAudioState.senderName = sender;
        a.src = audioSrc;
        a.playbackRate = globalAudioState.playbackRate;
      }
      const rect = track.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(1, clickX / rect.width));
      if (a.duration) {
        a.currentTime = pct * a.duration;
      }
      if (a.paused) {
        a.play().catch(() => {});
      }
    });

    speedBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (globalAudioState.playbackRate === 1) {
        globalAudioState.playbackRate = 1.5;
      } else if (globalAudioState.playbackRate === 1.5) {
        globalAudioState.playbackRate = 2;
      } else {
        globalAudioState.playbackRate = 1;
      }
      globalAudioState.audio.playbackRate = globalAudioState.playbackRate;
      speedBtn.textContent = `${globalAudioState.playbackRate}x`;
    });
  });
}

export function openEditMessageModal(options: {
  messageId: number;
  currentBody: string;
  sub: OmnichannelSubState;
  apiFetch: <T = any>(url: string, options?: RequestInit) => Promise<T>;
  refreshInbox: () => Promise<void>;
}): void {
  const { messageId, currentBody, apiFetch, refreshInbox } = options;
  document.getElementById('inbox-edit-msg-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'inbox-edit-msg-modal';
  modal.className = 'system-confirm-overlay';
  modal.innerHTML = `
    <div class="system-confirm-card" style="max-width:480px;text-align:left;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
        <h3 style="margin:0;font-size:1.1rem;font-weight:700;display:flex;align-items:center;gap:0.5rem;color:var(--text-primary);">
          <span style="color:#10b981;display:inline-flex;">${svgIcon('edit', 18)}</span>
          <span>Editar Mensaje</span>
        </h3>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-close-edit-modal" style="padding:0.25rem 0.5rem;" title="Cerrar">
          ${svgIcon('close', 15)}
        </button>
      </div>

      <form id="form-edit-message" style="display:flex;flex-direction:column;gap:0.95rem;">
        <div class="form-group" style="display:flex;flex-direction:column;gap:0.35rem;">
          <label class="form-label" for="edit-message-text" style="font-weight:600;font-size:0.86rem;color:var(--text-primary);">Contenido del Mensaje</label>
          <textarea id="edit-message-text" class="form-control" rows="4" style="resize:vertical;font-size:0.92rem;line-height:1.45;" required>${escapeHtml(currentBody)}</textarea>
          <span class="form-hint" style="font-size:0.75rem;color:var(--text-muted);">Al guardar, el mensaje mostrará el distintivo "(editado)" junto a la hora.</span>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:0.6rem;margin-top:0.4rem;">
          <button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-edit">Cancelar</button>
          <button type="submit" class="btn btn-primary btn-sm" id="btn-submit-edit">
            ${svgIcon('check', 14)}
            <span>Guardar Cambios</span>
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  const textarea = modal.querySelector('#edit-message-text') as HTMLTextAreaElement;
  setTimeout(() => {
    if (textarea) {
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }
  }, 60);

  const closeModal = () => modal.remove();
  modal.querySelector('#btn-close-edit-modal')?.addEventListener('click', closeModal);
  modal.querySelector('#btn-cancel-edit')?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  const form = modal.querySelector('#form-edit-message') as HTMLFormElement;
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newBody = textarea.value.trim();
    if (!newBody) return;

    const submitBtn = modal.querySelector('#btn-submit-edit') as HTMLButtonElement;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Guardando...';

    try {
      await apiFetch(`/api/inbox/messages/${messageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: newBody }),
      });
      closeModal();
      await refreshInbox();
      showSystemToast('Mensaje editado', 'El mensaje fue actualizado correctamente.', 'success');
    } catch (err: any) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Guardar Cambios';
      showSystemToast('Error al editar', err.message || 'No se pudo editar el mensaje', 'danger');
    }
  });
}

// ============================================================================
// SUBIDA DE ADJUNTOS CON BARRA DE PROGRESO
// ============================================================================
function showUploadProgress(label: string): { update: (pct: number) => void; done: () => void } {
  document.getElementById('upload-progress-toast')?.remove();
  const el = document.createElement('div');
  el.id = 'upload-progress-toast';
  el.className = 'upload-progress-toast';
  el.setAttribute('role', 'status');
  el.innerHTML = `
    <div class="upload-progress-title"><span>Enviando ${escapeHtml(label)}</span><strong id="upload-progress-pct">0%</strong></div>
    <div class="upload-progress-track"><div class="upload-progress-fill" id="upload-progress-fill" style="width:0%"></div></div>
  `;
  document.body.appendChild(el);
  return {
    update: (pct: number) => {
      const p = Math.max(0, Math.min(100, Math.round(pct)));
      const fill = document.getElementById('upload-progress-fill');
      const txt = document.getElementById('upload-progress-pct');
      if (fill) fill.style.width = `${p}%`;
      if (txt) txt.textContent = `${p}%`;
    },
    done: () => window.setTimeout(() => el.remove(), 250),
  };
}

function postJsonWithProgress<T>(url: string, payload: unknown, onProgress: (pct: number) => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', 'application/json');
    try {
      const raw = localStorage.getItem('turbonetwork_session');
      const token = raw ? JSON.parse(raw)?.token : '';
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      const tenant = localStorage.getItem('turbonetwork_active_tenant') || '';
      if (tenant) xhr.setRequestHeader('x-tenant-id', tenant);
    } catch {}
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress((e.loaded / e.total) * 100);
    };
    xhr.onload = () => {
      let data: any = {};
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : {};
      } catch {
        data = { error: xhr.responseText || 'Error de respuesta del servidor' };
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data as T);
      else reject(new Error(data.error || data.message || `Error HTTP ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('Error de red al subir el archivo.'));
    xhr.send(JSON.stringify(payload));
  });
}

// ============================================================================
// DELEGADOS GLOBALES (se instalan una sola vez): reintentos, multimedia fallida, banner de conexión
// ============================================================================
type InboxRuntimeCtx = {
  sub: OmnichannelSubState;
  apiFetch: <T = any>(url: string, options?: RequestInit) => Promise<T>;
  refreshInbox: () => Promise<void>;
  goToConnectionsTab: () => void;
};
let inboxRuntimeCtx: InboxRuntimeCtx | null = null;
let delegatesInstalled = false;
const failedMediaOriginalHtml = new WeakMap<HTMLElement, string>();
let waWasEverConnected = false;
let lastWaStatus = '';
let waAlertTimer: number | null = null;
let pendingNewBelow = 0;
let lastJumpConversationId: number | null = null;

function playAlertBeep(): void {
  try {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
    osc.onended = () => void ctx.close();
  } catch {}
}

function removeWaConnectionBanner(): void {
  document.getElementById('wa-conn-banner')?.remove();
}

function renderWaConnectionBanner(status: string): void {
  let el = document.getElementById('wa-conn-banner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'wa-conn-banner';
    el.className = 'wa-conn-banner';
    el.setAttribute('role', 'alert');
    document.body.appendChild(el);
  }
  const needsScan = status === 'awaiting_scan' || status === 'disconnected';
  el.classList.toggle('is-danger', needsScan);
  el.innerHTML = `
    <span class="wa-conn-banner-icon" aria-hidden="true">${svgIcon('alertTriangle', 18)}</span>
    <div class="wa-conn-banner-text">
      <strong>${needsScan ? 'WhatsApp desconectado' : 'Reconectando WhatsApp…'}</strong>
      <span>${
        needsScan
          ? 'Vuelve a escanear el código QR para seguir recibiendo y enviando mensajes.'
          : 'Los mensajes que envíes quedarán en cola y saldrán al reconectar.'
      }</span>
    </div>
    ${
      needsScan
        ? '<button type="button" class="wa-conn-banner-btn js-wa-banner-connect">Escanear QR</button>'
        : ''
    }
    <button type="button" class="wa-conn-banner-close js-wa-banner-close" aria-label="Cerrar aviso">${svgIcon('close', 14)}</button>
  `;
}

export function handleWhatsAppConnectionStatus(status: string): void {
  if (!status) return;
  if (status === 'connected') {
    if (waAlertTimer !== null) {
      window.clearTimeout(waAlertTimer);
      waAlertTimer = null;
    }
    const wasDown = waWasEverConnected && lastWaStatus !== '' && lastWaStatus !== 'connected';
    waWasEverConnected = true;
    lastWaStatus = status;
    removeWaConnectionBanner();
    if (wasDown) showSystemToast('WhatsApp reconectado', 'La conexión se restableció. Los mensajes en cola se están enviando.', 'success');
    return;
  }
  const wasConnected = lastWaStatus === 'connected' || waWasEverConnected;
  lastWaStatus = status;
  if (!wasConnected) return;
  renderWaConnectionBanner(status);

  // Alerta sonora y de escritorio si sigue caído pasados unos segundos (evita falsas alarmas por micro-cortes)
  if (waAlertTimer !== null) window.clearTimeout(waAlertTimer);
  const needsScan = status === 'awaiting_scan' || status === 'disconnected';
  waAlertTimer = window.setTimeout(
    () => {
      waAlertTimer = null;
      if (lastWaStatus === 'connected') return;
      playAlertBeep();
      try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
          new Notification('WhatsApp desconectado', {
            body: needsScan
              ? 'Escanea el QR de nuevo para no perder mensajes de clientes.'
              : 'No se pudo reconectar. Revisa la conexión del servidor.',
            icon: '/icons/icon-192.png',
            tag: 'wa-disconnected',
          });
        }
      } catch {}
    },
    needsScan ? 1500 : 8000
  );
}

function updateJumpToBottomButton(): void {
  const btn = document.getElementById('chat-jump-bottom') as HTMLButtonElement | null;
  const scroller = document.getElementById('chat-messages-scroller');
  if (!btn || !scroller) return;
  const distance = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
  if (distance < 160) pendingNewBelow = 0;
  const show = distance >= 260 || pendingNewBelow > 0;
  btn.style.display = show ? 'inline-flex' : 'none';
  const badge = btn.querySelector('.chat-jump-bottom-count') as HTMLElement | null;
  if (badge) {
    badge.textContent = pendingNewBelow > 0 ? String(pendingNewBelow) : '';
    badge.style.display = pendingNewBelow > 0 ? 'inline-flex' : 'none';
  }
}

function installInboxGlobalDelegates(): void {
  if (delegatesInstalled) return;
  delegatesInstalled = true;

  document.addEventListener('click', async (ev) => {
    const target = ev.target as HTMLElement | null;
    if (!target) return;

    // Reintentar envío de un mensaje fallido
    const retryBtn = target.closest('.js-retry-send') as HTMLElement | null;
    if (retryBtn && inboxRuntimeCtx) {
      ev.stopPropagation();
      const id = retryBtn.getAttribute('data-id');
      if (!id) return;
      (retryBtn as HTMLButtonElement).disabled = true;
      try {
        await inboxRuntimeCtx.apiFetch(`/api/inbox/messages/${id}/retry`, { method: 'POST' });
        await inboxRuntimeCtx.refreshInbox();
      } catch (err) {
        (retryBtn as HTMLButtonElement).disabled = false;
        showSystemToast('No se pudo reintentar', (err as Error).message, 'danger');
      }
      return;
    }

    // Reintentar carga de multimedia
    const mediaRetry = target.closest('.js-retry-media') as HTMLElement | null;
    if (mediaRetry) {
      ev.stopPropagation();
      const wrapper = mediaRetry.closest('.wa-media-failed') as HTMLElement | null;
      const original = wrapper ? failedMediaOriginalHtml.get(wrapper) : undefined;
      if (wrapper && original) {
        const stamp = `r=${Date.now()}`;
        wrapper.innerHTML = original.replace(/(src=")([^"]+)(")/g, (_m, a, url, c) => {
          return `${a}${url}${url.includes('?') ? '&' : '?'}${stamp}${c}`;
        });
        wrapper.classList.remove('wa-media-failed');
        wrapper.classList.add('js-open-media-lightbox');
      }
      return;
    }

    // Banner de conexión
    if (target.closest('.js-wa-banner-connect') && inboxRuntimeCtx) {
      ev.stopPropagation();
      inboxRuntimeCtx.goToConnectionsTab();
      return;
    }
    if (target.closest('.js-wa-banner-close')) {
      removeWaConnectionBanner();
      return;
    }

    // Reacciones con emoji: abrir selector
    const reactBtn = target.closest('.js-react-msg') as HTMLElement | null;
    if (reactBtn) {
      ev.stopPropagation();
      const existing = document.getElementById('msg-reaction-popover');
      const sameId = existing?.getAttribute('data-for');
      existing?.remove();
      const msgId = reactBtn.getAttribute('data-id') || '';
      if (sameId === msgId) return;
      const pop = document.createElement('div');
      pop.id = 'msg-reaction-popover';
      pop.className = 'msg-reaction-popover';
      pop.setAttribute('data-for', msgId);
      pop.setAttribute('role', 'menu');
      pop.innerHTML =
        ['👍', '❤️', '😂', '😮', '😢', '🙏']
          .map((e) => `<button type="button" class="msg-reaction-pick js-pick-reaction" role="menuitem" data-emoji="${e}" aria-label="Reaccionar con ${e}">${e}</button>`)
          .join('') +
        `<button type="button" class="msg-reaction-pick js-pick-reaction" role="menuitem" data-emoji="" aria-label="Quitar reacción">${svgIcon('close', 13)}</button>`;
      document.body.appendChild(pop);
      const rect = reactBtn.getBoundingClientRect();
      const popW = pop.offsetWidth || 260;
      pop.style.top = `${Math.max(8, rect.top - 48)}px`;
      pop.style.left = `${Math.min(window.innerWidth - popW - 8, Math.max(8, rect.left - popW / 2))}px`;
      return;
    }
    const pickBtn = target.closest('.js-pick-reaction') as HTMLElement | null;
    if (pickBtn && inboxRuntimeCtx) {
      ev.stopPropagation();
      const pop = document.getElementById('msg-reaction-popover');
      const msgId = pop?.getAttribute('data-for');
      const emoji = pickBtn.getAttribute('data-emoji') || '';
      pop?.remove();
      if (!msgId) return;
      try {
        await inboxRuntimeCtx.apiFetch(`/api/inbox/messages/${msgId}/reaction`, {
          method: 'POST',
          body: JSON.stringify({ emoji }),
        });
        await inboxRuntimeCtx.refreshInbox();
      } catch (err) {
        showSystemToast('No se pudo reaccionar', (err as Error).message, 'danger');
      }
      return;
    }
    document.getElementById('msg-reaction-popover')?.remove();

    // Cargar mensajes anteriores (paginación por tramos)
    const olderBtn = target.closest('.js-load-older') as HTMLButtonElement | null;
    if (olderBtn && inboxRuntimeCtx) {
      ev.stopPropagation();
      const scroller = document.getElementById('chat-messages-scroller');
      const prevHeight = scroller?.scrollHeight ?? 0;
      const prevTop = scroller?.scrollTop ?? 0;
      olderBtn.disabled = true;
      inboxRuntimeCtx.sub.messageLimit = (inboxRuntimeCtx.sub.messageLimit || 250) + 250;
      try {
        await inboxRuntimeCtx.refreshInbox();
        const after = document.getElementById('chat-messages-scroller');
        if (after) after.scrollTop = after.scrollHeight - prevHeight + prevTop;
      } catch (err) {
        showSystemToast('No se pudieron cargar mensajes anteriores', (err as Error).message, 'danger');
      }
      return;
    }

    // Ir al último mensaje
    if (target.closest('#chat-jump-bottom')) {
      const scroller = document.getElementById('chat-messages-scroller');
      if (scroller) scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
      pendingNewBelow = 0;
      updateJumpToBottomButton();
    }
  });

  // Errores de carga de imagen / sticker / video: mostrar placeholder con botón de reintento
  document.addEventListener(
    'error',
    (ev) => {
      const el = ev.target as HTMLElement | null;
      if (!el || !(el instanceof HTMLImageElement || el instanceof HTMLVideoElement)) return;
      if (!/wa-sticker-img|wa-standalone-image-el|wa-standalone-video-el/.test(el.className)) return;
      const wrapper = el.closest('.wa-sticker-media-wrapper, .wa-image-media-wrapper, .wa-video-media-wrapper') as HTMLElement | null;
      if (!wrapper || wrapper.classList.contains('wa-media-failed')) return;
      failedMediaOriginalHtml.set(wrapper, wrapper.innerHTML);
      wrapper.classList.remove('js-open-media-lightbox');
      wrapper.classList.add('wa-media-failed');
      wrapper.innerHTML = mediaFailedBoxHtml(true);
    },
    true
  );
}

export function bindOmnichannelInboxEvents(callbacks: {
  sub: OmnichannelSubState;
  apiFetch: <T = any>(url: string, options?: RequestInit) => Promise<T>;
  refreshInbox: () => Promise<void>;
  goToConnectionsTab: () => void;
  rerender: () => void;
}): void {
  const { sub, apiFetch, refreshInbox, goToConnectionsTab, rerender } = callbacks;

  inboxRuntimeCtx = { sub, apiFetch, refreshInbox, goToConnectionsTab };
  installInboxGlobalDelegates();
  if (sub.connections?.wa_active_mode === 'qr' && sub.connections?.wa_qr_status) {
    const st = String(sub.connections.wa_qr_status);
    if (st !== lastWaStatus) handleWhatsAppConnectionStatus(st);
  }

  // Botón flotante "ir al último mensaje" con contador de mensajes nuevos
  if (lastJumpConversationId !== sub.selectedConversationId) {
    pendingNewBelow = 0;
    lastJumpConversationId = sub.selectedConversationId;
  }
  const jumpScroller = document.getElementById('chat-messages-scroller');
  jumpScroller?.addEventListener('scroll', updateJumpToBottomButton, { passive: true });
  window.setTimeout(updateJumpToBottomButton, 60);

  // Búsqueda dentro de la conversación (sobre los mensajes cargados)
  let searchHits: HTMLElement[] = [];
  let searchIndex = -1;
  const chatSearchInput = document.getElementById('chat-search-input') as HTMLInputElement | null;
  const searchCount = document.getElementById('chat-search-count');
  const focusSearchHit = (scroll: boolean) => {
    searchHits.forEach((h) => h.classList.remove('chat-search-current'));
    const current = searchHits[searchIndex];
    if (current) {
      current.classList.add('chat-search-current');
      if (scroll) current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    if (searchCount) {
      searchCount.textContent =
        searchHits.length > 0 ? `${searchIndex + 1} de ${searchHits.length}` : chatSearchInput?.value.trim() ? 'Sin resultados' : '';
    }
  };
  const runChatSearch = (scroll: boolean) => {
    document.querySelectorAll('.chat-search-hit').forEach((el) => el.classList.remove('chat-search-hit', 'chat-search-current'));
    searchHits = [];
    const q = (sub.messageSearch?.query || '').trim().toLowerCase();
    if (q) {
      document.querySelectorAll<HTMLElement>('#chat-messages-scroller .chat-msg-row').forEach((row) => {
        const text = (row.textContent || '').toLowerCase();
        if (text.includes(q)) {
          row.classList.add('chat-search-hit');
          searchHits.push(row);
        }
      });
    }
    searchIndex = searchHits.length > 0 ? searchHits.length - 1 : -1;
    focusSearchHit(scroll);
  };
  const stepChatSearch = (dir: 1 | -1) => {
    if (searchHits.length === 0) return;
    searchIndex = (searchIndex + dir + searchHits.length) % searchHits.length;
    focusSearchHit(true);
  };
  document.getElementById('btn-toggle-chat-search')?.addEventListener('click', () => {
    const open = !sub.messageSearch?.open;
    sub.messageSearch = { open, query: open ? sub.messageSearch?.query || '' : '' };
    rerender();
    if (open) document.getElementById('chat-search-input')?.focus();
  });
  document.getElementById('btn-chat-search-close')?.addEventListener('click', () => {
    sub.messageSearch = { open: false, query: '' };
    rerender();
  });
  document.getElementById('btn-chat-search-next')?.addEventListener('click', () => stepChatSearch(1));
  document.getElementById('btn-chat-search-prev')?.addEventListener('click', () => stepChatSearch(-1));
  let searchDebounce: number | null = null;
  chatSearchInput?.addEventListener('input', () => {
    sub.messageSearch = { open: true, query: chatSearchInput.value };
    if (searchDebounce !== null) window.clearTimeout(searchDebounce);
    searchDebounce = window.setTimeout(() => runChatSearch(true), 180);
  });
  chatSearchInput?.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      stepChatSearch(e.shiftKey ? -1 : 1);
    } else if (e.key === 'Escape') {
      sub.messageSearch = { open: false, query: '' };
      rerender();
    }
  });
  if (sub.messageSearch?.open && sub.messageSearch.query) {
    runChatSearch(false);
  }

  clearLiveTimers();
  scrollLatestChatMessageIntoView();
  ensureFloatingAudioBar({ sub, rerender });
  initWhatsAppAudioPlayers(document, sub);

  if (sub.selectedConversationId && sub.messages && sub.messages.length > 0) {
    conversationMessagesCache.set(sub.selectedConversationId, sub.messages);
  }

  // Botón para volver a la lista en responsive móvil estilo WhatsApp
  document.querySelectorAll('.js-chat-back-to-list').forEach((btn) => {
    btn.addEventListener('click', () => {
      sub.selectedConversationId = null;
      rerender();
    });
  });

  const applyQuickReplyToComposer = (qr: QuickReplyItem) => {
    const composer = document.getElementById('chat-composer-input') as HTMLTextAreaElement | null;
    const popover = document.getElementById('slash-command-popover') as HTMLElement | null;
    if (popover) popover.style.display = 'none';

    if (qr.media_type && qr.media_type !== 'none' && qr.media_url) {
      sub.pendingAttachment = {
        media_type: qr.media_type,
        media_url: qr.media_url,
        media_filename: qr.media_filename || `${qr.shortcut}`,
        media_mimetype: qr.media_mimetype || 'application/octet-stream',
      };
      rerender();
      const updatedInput = document.getElementById('chat-composer-input') as HTMLTextAreaElement | null;
      if (updatedInput) {
        updatedInput.value = qr.body;
        updatedInput.focus();
      }
    } else {
      if (composer) {
        composer.value = qr.body;
        composer.focus();
      }
    }
  };

  // Polling silencioso en tiempo real + SSE push inmediato para nuevos mensajes y checks
  let lastFullInboxPoll = 0;
  let pollInFlight = false;
  let sseDebounceTimer: number | null = null;

  const runLiveInboxPoll = async (forceBypassSyncThrottle = false) => {
    if (pollInFlight) return;
    if (!document.querySelector('.inbox-workspace-100vh')) {
      clearLiveTimers();
      return;
    }
    pollInFlight = true;
    const activeEl = document.activeElement;
    const isTyping =
      activeEl &&
      (activeEl.id === 'inbox-search-input' ||
        activeEl.id === 'chat-composer-input' ||
        activeEl.id === 'new-conv-note-input');

    try {
      // Estado ligero de sincronización: evita descargar todos los mensajes mientras WhatsApp sincroniza
      let syncJustFinished = false;
      try {
        const st = await apiFetch<WaSyncStatus>('/api/inbox/sync-status');
        const wasActive = Boolean(sub.waSync?.active);
        sub.waSync = st;
        if (st.active) {
          const bannerEl = document.getElementById('wa-sync-banner');
          if (!bannerEl) {
            rerender();
          } else {
            const { pct, detail, title } = waSyncProgress(st);
            const titleEl = document.getElementById('wa-sync-title');
            const detailEl = document.getElementById('wa-sync-detail');
            const fillEl = document.getElementById('wa-sync-bar-fill');
            if (titleEl) titleEl.textContent = title;
            if (detailEl) detailEl.textContent = detail;
            if (fillEl) fillEl.style.width = `${pct}%`;
          }
          if (!forceBypassSyncThrottle && Date.now() - lastFullInboxPoll < 2000) return;
        } else if (wasActive) {
          syncJustFinished = true;
          const bannerEl = document.getElementById('wa-sync-banner');
          if (bannerEl) bannerEl.remove();
        }
      } catch {
        // Ignorar: si falla el estado se continúa con el sondeo normal
      }
      lastFullInboxPoll = Date.now();

      const pollUrl = sub.selectedConversationId
        ? `/api/inbox?active_conv_id=${sub.selectedConversationId}&msg_limit=${sub.messageLimit || 250}`
        : `/api/inbox`;

      const latest = await apiFetch<{
        conversations: OmnichannelConversation[];
        messages: OmnichannelMessage[];
        connections: ChannelConnections;
        quickReplies: QuickReplyItem[];
        tags: CrmTagItem[];
        notes: ConversationNoteItem[];
      }>(pollUrl);

      // 1. Detectar si hay mensajes nuevos de contactos
      if (maxKnownMessageId === 0) {
        maxKnownMessageId = latest.messages.reduce((max, m) => Math.max(max, m.id), 0);
      } else {
        const newIncoming = latest.messages.filter(
          (m) => m.id > maxKnownMessageId && m.sender_type === 'contact'
        );
        if (newIncoming.length > 0) {
          const newest = newIncoming[newIncoming.length - 1];
          maxKnownMessageId = latest.messages.reduce((max, m) => Math.max(max, m.id), 0);
          triggerNewMessageNotification(newest.sender_name, newest.body);
          showSystemToast(
            `Mensaje de ${newest.sender_name}`,
            newest.body || 'Nuevo archivo o nota de voz recibido.',
            'info'
          );
        } else {
          maxKnownMessageId = Math.max(
            maxKnownMessageId,
            latest.messages.reduce((max, m) => Math.max(max, m.id), 0)
          );
        }
      }

      // 2. Comprobar si cambió el número de mensajes, el estado de los checks de entrega, o los no leídos
      const msgCountChanged = latest.messages.length !== sub.messages.length;
      const lastMsgChanged =
        (latest.messages[latest.messages.length - 1]?.id ?? 0) !==
        (sub.messages[sub.messages.length - 1]?.id ?? 0);
      const statusChanged = latest.messages.some((m) => {
        const oldM = sub.messages.find((x) => x.id === m.id);
        return (
          oldM &&
          (oldM.delivery_status !== m.delivery_status ||
            JSON.stringify(oldM.reactions_json || []) !== JSON.stringify(m.reactions_json || []))
        );
      });
      const unreadChanged = latest.conversations.some((c) => {
        const oldC = sub.conversations.find((x) => x.id === c.id);
        return oldC && oldC.unread_count !== c.unread_count;
      });

      if (msgCountChanged || lastMsgChanged || statusChanged || unreadChanged || syncJustFinished || latest.conversations.length !== sub.conversations.length) {
        const wasFocused = document.activeElement?.id === 'chat-composer-input';
        const draft =
          (document.getElementById('chat-composer-input') as HTMLTextAreaElement | null)?.value || '';
        const selStart =
          (document.getElementById('chat-composer-input') as HTMLTextAreaElement | null)?.selectionStart ??
          draft.length;
        const selEnd =
          (document.getElementById('chat-composer-input') as HTMLTextAreaElement | null)?.selectionEnd ??
          draft.length;

        const prevSidebarList = document.querySelector('.inbox-conversations-list') as HTMLElement | null;
        const prevSidebarScroll = prevSidebarList?.scrollTop ?? 0;
        const prevMsgScroller = document.getElementById('chat-messages-scroller') as HTMLElement | null;
        const prevMsgScroll = prevMsgScroller?.scrollTop ?? 0;
        const wasNearBottom = prevMsgScroller
          ? prevMsgScroller.scrollHeight - prevMsgScroller.scrollTop - prevMsgScroller.clientHeight < 90
          : true;
        const wasDropdownOpen =
          (document.getElementById('inbox-pc-dropdown-menu') as HTMLElement | null)?.style.display === 'flex';
        const wasEmojiOpen =
          (document.getElementById('chat-emoji-picker-popover') as HTMLElement | null)?.style.display === 'flex';
        const searchWasFocused = document.activeElement?.id === 'chat-search-input';
        const prevEmojiCat =
          document.querySelector('#chat-emoji-picker-popover .chat-emoji-tab.active')?.getAttribute('data-emoji-cat') ||
          'freq';

        if (!wasNearBottom && sub.selectedConversationId) {
          const knownIds = new Set(sub.messages.map((x) => x.id));
          pendingNewBelow += latest.messages.filter((x) => !knownIds.has(x.id) && x.sender_type === 'contact').length;
        }

        sub.conversations = latest.conversations;
        sub.messages = latest.messages;
        if (sub.selectedConversationId) {
          conversationMessagesCache.set(sub.selectedConversationId, latest.messages);
        }
        sub.connections = latest.connections;
        sub.quickReplies = latest.quickReplies || sub.quickReplies;
        sub.tags = latest.tags || sub.tags;
        sub.notes = latest.notes || sub.notes;
        rerender();

        const nextSidebarList = document.querySelector('.inbox-conversations-list') as HTMLElement | null;
        if (nextSidebarList && prevSidebarScroll > 0) {
          nextSidebarList.scrollTop = prevSidebarScroll;
        }
        const nextMsgScroller = document.getElementById('chat-messages-scroller') as HTMLElement | null;
        if (nextMsgScroller) {
          if (wasNearBottom) {
            nextMsgScroller.scrollTop = nextMsgScroller.scrollHeight;
          } else {
            nextMsgScroller.scrollTop = prevMsgScroll;
          }
        }
        if (wasDropdownOpen) {
          const nextDropdown = document.getElementById('inbox-pc-dropdown-menu') as HTMLElement | null;
          if (nextDropdown) nextDropdown.style.display = 'flex';
        }
        if (searchWasFocused) {
          const si = document.getElementById('chat-search-input') as HTMLInputElement | null;
          if (si) {
            si.focus();
            try {
              si.setSelectionRange(si.value.length, si.value.length);
            } catch {}
          }
        }
        if (wasEmojiOpen) {
          const nextEmojiPopover = document.getElementById('chat-emoji-picker-popover') as HTMLElement | null;
          const nextEmojiBtn = document.getElementById('btn-toggle-emoji-picker') as HTMLButtonElement | null;
          if (nextEmojiPopover) {
            nextEmojiPopover.style.display = 'flex';
            if (nextEmojiBtn) nextEmojiBtn.setAttribute('aria-expanded', 'true');
            const targetTab = nextEmojiPopover.querySelector(`.chat-emoji-tab[data-emoji-cat="${prevEmojiCat}"]`) as HTMLButtonElement | null;
            if (targetTab && prevEmojiCat !== 'freq') {
              targetTab.click();
            }
          }
        }

        const newComposer = document.getElementById('chat-composer-input') as HTMLTextAreaElement | null;
        if (newComposer) {
          if (draft) newComposer.value = draft;
          if (wasFocused || isTyping) {
            newComposer.focus();
            try {
              newComposer.setSelectionRange(selStart, selEnd);
            } catch {}
          }
        }
      }
    } catch {
      // Ignorar errores de red temporales
    } finally {
      pollInFlight = false;
    }
  };

  if (typeof EventSource !== 'undefined') {
    try {
      activeInboxEventSource = new EventSource('/api/inbox/events');
      activeInboxEventSource.addEventListener('inbox', (ev: MessageEvent) => {
        try {
          const payload = ev.data ? JSON.parse(ev.data) : null;
          if (payload?.type === 'connection_status') {
            handleWhatsAppConnectionStatus(String(payload.status || ''));
            const pill = document.getElementById('inbox-wa-live-pill');
            const lbl = document.getElementById('inbox-wa-live-label');
            if (pill && lbl) {
              const color = payload.status === 'connected' ? '#10b981' : '#f59e0b';
              pill.style.setProperty('--tag-color', color);
              lbl.textContent =
                payload.status === 'connected'
                  ? 'WhatsApp en vivo'
                  : payload.status === 'reconnecting'
                  ? 'Reconectando...'
                  : 'QR pendiente';
            }
          }
        } catch {}
        if (sseDebounceTimer !== null) window.clearTimeout(sseDebounceTimer);
        sseDebounceTimer = window.setTimeout(() => {
          void runLiveInboxPoll(true);
        }, 120);
      });
    } catch {
      // Fallback al polling periódico si SSE no está disponible
    }
  }

  activeInboxPollTimer = window.setInterval(() => {
    void runLiveInboxPoll(false);
  }, 2500);

  // Menú Desplegable de Opciones en PC
  const pcDropdown = document.getElementById('inbox-pc-dropdown-menu');
  document.getElementById('btn-inbox-pc-menu')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (pcDropdown) {
      pcDropdown.style.display = pcDropdown.style.display === 'flex' ? 'none' : 'flex';
    }
  });
  document.addEventListener('click', () => {
    if (pcDropdown) pcDropdown.style.display = 'none';
  });

  // Botón Flotante (FAB) y Bottom Sheet en Móvil
  const mobileSheet = document.getElementById('inbox-mobile-sheet-overlay');
  document.getElementById('btn-inbox-mobile-fab')?.addEventListener('click', () => {
    if (mobileSheet) mobileSheet.style.display = 'flex';
  });
  document.getElementById('btn-close-mobile-sheet')?.addEventListener('click', () => {
    if (mobileSheet) mobileSheet.style.display = 'none';
  });
  mobileSheet?.addEventListener('click', (e) => {
    if (e.target === mobileSheet) mobileSheet.style.display = 'none';
  });

  // 1. Opción Sincronizar WhatsApp (PC y Móvil)
  document.querySelectorAll('.js-opt-sync-wa').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (pcDropdown) pcDropdown.style.display = 'none';
      if (mobileSheet) mobileSheet.style.display = 'none';
      try {
        const res = await apiFetch<{
          synced: boolean;
          totalConversations?: number;
          message?: string;
        }>('/api/inbox/sync-whatsapp', { method: 'POST' });
        await refreshInbox();
        showSystemToast(
          res.synced ? 'Chats Sincronizados' : 'Estado de Sincronización',
          res.message || `${res.totalConversations ?? 0} conversación(es) de WhatsApp en bandeja.`,
          res.synced ? 'success' : 'info'
        );
      } catch (err) {
        showSystemToast('Error al sincronizar WhatsApp', (err as Error).message, 'danger');
      }
    });
  });

  // Opción Sincronizar Instagram Direct (PC y Móvil)
  document.querySelectorAll('.js-opt-sync-ig').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (pcDropdown) pcDropdown.style.display = 'none';
      if (mobileSheet) mobileSheet.style.display = 'none';
      try {
        const res = await apiFetch<{
          synced: boolean;
          syncedConversations: number;
          syncedMessages: number;
          message?: string;
          error?: string;
        }>('/api/inbox/sync-instagram', { method: 'POST' });
        await refreshInbox();
        showSystemToast(
          res.synced ? 'Instagram Sincronizado' : 'Aviso de Instagram Direct',
          res.message || (res.synced ? `Se sincronizaron ${res.syncedConversations} chats de Instagram.` : 'No se recibieron mensajes.'),
          res.synced ? 'success' : 'info'
        );
      } catch (err) {
        showSystemToast('Error al sincronizar Instagram', (err as Error).message, 'danger');
      }
    });
  });

  // Opción Sincronizar Todas las Redes (PC y Móvil)
  document.querySelectorAll('.js-opt-sync-all').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (pcDropdown) pcDropdown.style.display = 'none';
      if (mobileSheet) mobileSheet.style.display = 'none';
      try {
        await apiFetch('/api/inbox/sync-all', { method: 'POST' });
        await refreshInbox();
        showSystemToast(
          'Redes Sincronizadas',
          'Se sincronizaron todas las redes conectadas (WhatsApp, Instagram, Facebook).',
          'success'
        );
      } catch (err) {
        showSystemToast('Error al sincronizar redes', (err as Error).message, 'danger');
      }
    });
  });

  // Opción Sincronizar Facebook (PC y Móvil)
  document.querySelectorAll('.js-opt-sync-fb').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (pcDropdown) pcDropdown.style.display = 'none';
      if (mobileSheet) mobileSheet.style.display = 'none';
      try {
        const res = await apiFetch<{
          synced: boolean;
          syncedConversations: number;
          syncedMessages: number;
        }>('/api/inbox/sync-facebook', { method: 'POST' });
        await refreshInbox();
        showSystemToast(
          'Facebook Sincronizado',
          `Se descargaron ${res.syncedConversations} chats y ${res.syncedMessages} mensajes de tu página de Facebook.`,
          'success'
        );
      } catch (err) {
        showSystemToast('Error al sincronizar Facebook', (err as Error).message, 'danger');
      }
    });
  });

  // Botón para saltar a la pestaña de Conexiones
  document.querySelectorAll('.js-goto-connections').forEach((btn) => {
    btn.addEventListener('click', () => {
      goToConnectionsTab();
    });
  });

  // 2. Opción Respuestas Rápidas (PC y Móvil)
  document.querySelectorAll('.js-opt-quick-replies').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (pcDropdown) pcDropdown.style.display = 'none';
      if (mobileSheet) mobileSheet.style.display = 'none';
      openQuickRepliesManagerModal({ sub, apiFetch, refreshInbox, onSelect: applyQuickReplyToComposer });
    });
  });

  // 3. Opción Etiquetas (PC y Móvil)
  document.querySelectorAll('.js-opt-tags').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (pcDropdown) pcDropdown.style.display = 'none';
      if (mobileSheet) mobileSheet.style.display = 'none';
      openTagsManagerModal({ sub, apiFetch, refreshInbox });
    });
  });

  // 4. Opción Mensaje Masivo (PC y Móvil)
  const openBroadcastCampaignModal = async () => {
    const conn = sub.connections || ({} as any);
    if (conn?.wa_active_mode !== 'api') {
      const switchNow = await showSystemConfirmModal({
        title: 'Mensajes Masivos requiere WhatsApp Cloud API',
        description:
          'Actualmente WhatsApp está configurado en modo "Servidor QR Interno". ¿Desea ir a la pestaña Conexiones para activar el modo WhatsApp Cloud API oficial?',
        confirmLabel: 'Ir a Conexiones',
        cancelLabel: 'Cancelar',
      });
      if (switchNow) {
        goToConnectionsTab();
      }
      return;
    }

    const dialog = document.getElementById('global-form-dialog') as HTMLDialogElement | null;
    if (!dialog) return;

    dialog.innerHTML = `
      <form id="broadcast-modal-form" class="crm-form-modal-surface">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
          <div>
            <h3 id="form-dialog-title" style="font-size:1.18rem;display:flex;align-items:center;gap:0.5rem;">
              ${svgIcon('megaphone', 18)}
              <span>Campaña de Mensajes Masivos (WhatsApp Cloud API)</span>
            </h3>
            <p style="font-size:0.8rem;color:var(--text-muted);">
              Se enviará simultáneamente a todos los contactos de WhatsApp mediante su conexión oficial Cloud API.
            </p>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" id="close-broadcast-modal">
            ${svgIcon('close', 16)}
          </button>
        </div>

        <div class="form-group" style="margin-bottom:1.25rem;">
          <label class="form-label" for="broadcast-message-text">Contenido de la Plantilla / Mensaje Masivo *</label>
          <textarea id="broadcast-message-text" class="form-control" rows="4" required>Hola, le saludamos desde nuestro canal oficial. Tenemos una promoción corporativa especial disponible esta semana para su empresa.</textarea>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:0.65rem;">
          <button type="button" class="btn btn-secondary" id="cancel-broadcast-modal">Cancelar</button>
          <button type="submit" class="btn btn-primary">
            ${svgIcon('send', 15)}
            <span>Disparar Envío Masivo Ahora</span>
          </button>
        </div>
      </form>
    `;

    const close = () => dialog.close();
    dialog.querySelector('#close-broadcast-modal')?.addEventListener('click', close);
    dialog.querySelector('#cancel-broadcast-modal')?.addEventListener('click', close);

    dialog.querySelector('#broadcast-modal-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = (dialog.querySelector('#broadcast-message-text') as HTMLTextAreaElement).value.trim();
      try {
        const res = await apiFetch<{ sentCount: number }>('/api/inbox/whatsapp-broadcast', {
          method: 'POST',
          body: JSON.stringify({ messageText: text }),
        });
        close();
        await refreshInbox();
        showSystemToast(
          'Difusión enviada',
          `Mensaje masivo enviado a ${res.sentCount} contactos por WhatsApp Cloud API.`,
          'success'
        );
      } catch (err) {
        showSystemToast('Error en difusión masiva', (err as Error).message, 'danger');
      }
    });

    dialog.showModal();
  };

  document.querySelectorAll('.js-opt-broadcast').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (pcDropdown) pcDropdown.style.display = 'none';
      if (mobileSheet) mobileSheet.style.display = 'none';
      await openBroadcastCampaignModal();
    });
  });

  // Filtro por canal
  document.querySelectorAll('.js-filter-channel').forEach((btn) => {
    btn.addEventListener('click', () => {
      sub.channelFilter = (btn.getAttribute('data-channel') as any) || 'all';
      rerender();
    });
  });

  // Filtro por etiqueta minimalista
  document.querySelectorAll('.js-filter-tag').forEach((pill) => {
    pill.addEventListener('click', () => {
      const tag = pill.getAttribute('data-tag') || '';
      sub.tagFilter = sub.tagFilter === tag ? '' : tag;
      rerender();
    });
  });

  // Búsqueda
  const searchInput = document.getElementById('inbox-search-input') as HTMLInputElement | null;
  searchInput?.addEventListener('input', () => {
    sub.searchQuery = searchInput.value;
    rerender();
    const el = document.getElementById('inbox-search-input') as HTMLInputElement | null;
    if (el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  });

  // Seleccionar conversación con respuesta inmediata (0ms de latencia)
  document.querySelectorAll('.js-select-conv').forEach((btn) => {
    btn.addEventListener('click', () => {
      const convId = Number(btn.getAttribute('data-conv-id'));
      if (sub.selectedConversationId === convId) return;

      sub.selectedConversationId = convId;
      sub.messageLimit = 250;
      sub.messageSearch = { open: false, query: '' };
      // Limpiar badge no leído de forma optimista en la memoria local
      const conv = sub.conversations.find((c) => c.id === convId);
      if (conv) conv.unread_count = 0;

      // Si ya tenemos los mensajes en caché, renderizar de inmediato y refrescar en segundo plano
      if (conversationMessagesCache.has(convId)) {
        sub.messages = conversationMessagesCache.get(convId)!;
        rerender();
      } else {
        sub.messages = [];
        rerender();
      }
      apiFetch<OmnichannelMessage[]>(`/api/inbox/conversations/${convId}/messages?limit=250`)
        .then((msgs) => {
          const prevLen = conversationMessagesCache.get(convId)?.length ?? -1;
          conversationMessagesCache.set(convId, msgs);
          if (sub.selectedConversationId === convId && (msgs.length !== prevLen || sub.messages.length !== msgs.length)) {
            sub.messages = msgs;
            rerender();
          }
        })
        .catch(() => {});

      // Marcar como leído en segundo plano de manera no bloqueante
      apiFetch(`/api/inbox/conversations/${convId}/read`, { method: 'POST' }).catch(() => {});
    });
  });

  // Abrir / Cerrar Drawer Lateral de Notas Aparte y Etiquetas
  document.getElementById('btn-toggle-side-drawer-notes')?.addEventListener('click', () => {
    sub.sideDrawerTab = sub.sideDrawerTab === 'notes' ? 'none' : 'notes';
    rerender();
  });

  document.getElementById('btn-toggle-side-drawer-tags')?.addEventListener('click', () => {
    sub.sideDrawerTab = sub.sideDrawerTab === 'tags' ? 'none' : 'tags';
    rerender();
  });

  document.getElementById('btn-close-side-drawer')?.addEventListener('click', () => {
    sub.sideDrawerTab = 'none';
    rerender();
  });

  document.getElementById('chat-side-drawer-backdrop')?.addEventListener('click', () => {
    sub.sideDrawerTab = 'none';
    rerender();
  });

  document.getElementById('btn-drawer-open-tag-crud')?.addEventListener('click', () => {
    openTagsManagerModal({ sub, apiFetch, refreshInbox });
  });

  // Asignar / quitar etiqueta a la conversación activa
  const activeConv =
    sub.conversations.find((c) => c.id === sub.selectedConversationId) || sub.conversations[0];

  document.querySelectorAll('.js-toggle-conv-tag').forEach((pill) => {
    pill.addEventListener('click', async () => {
      if (!activeConv) return;
      const tagName = pill.getAttribute('data-tag-name') || '';
      if (!tagName) return;

      const currentTags = parseTagsJson(activeConv.tags_json);
      const exists = currentTags.some((t) => t.toLowerCase() === tagName.toLowerCase());
      const nextTags = exists
        ? currentTags.filter((t) => t.toLowerCase() !== tagName.toLowerCase())
        : [...currentTags, tagName];

      try {
        await apiFetch(`/api/inbox/conversations/${activeConv.id}/tags`, {
          method: 'PUT',
          body: JSON.stringify({
            tags: nextTags,
            assigned_user_id: activeConv.assigned_user_id,
          }),
        });
        await refreshInbox();
      } catch (err) {
        showSystemToast('Error actualizando etiquetas', (err as Error).message, 'danger');
      }
    });
  });

  // Asignar agente responsable al chat activo
  const assignedSelect = document.getElementById(
    'conv-assigned-user-select'
  ) as HTMLSelectElement | null;
  assignedSelect?.addEventListener('change', async () => {
    if (!activeConv) return;
    const assigned_user_id = assignedSelect.value ? Number(assignedSelect.value) : null;
    try {
      await apiFetch(`/api/inbox/conversations/${activeConv.id}/tags`, {
        method: 'PUT',
        body: JSON.stringify({
          tags: parseTagsJson(activeConv.tags_json),
          assigned_user_id,
        }),
      });
      await refreshInbox();
      showSystemToast('Responsable actualizado', 'Se actualizó la asignación del chat.', 'success');
    } catch (err) {
      showSystemToast('Error asignando usuario', (err as Error).message, 'danger');
    }
  });

  // Gestionar etiquetas de un Usuario del equipo
  document.querySelectorAll('.js-manage-user-tags').forEach((btn) => {
    btn.addEventListener('click', () => {
      const userId = Number(btn.getAttribute('data-user-id'));
      const targetUser = sub.users.find((u) => u.id === userId);
      if (!targetUser) return;

      const dialog = document.getElementById('global-form-dialog') as HTMLDialogElement | null;
      if (!dialog) return;

      let currentUserTags = parseTagsJson(targetUser.tags_json);

      const renderUserTagsDialog = () => {
        dialog.innerHTML = `
          <div class="crm-form-modal-surface" style="max-width:480px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.85rem;">
              <div>
                <h3 style="font-size:1.05rem;">Etiquetas de ${targetUser.full_name}</h3>
                <p style="font-size:0.78rem;color:var(--text-muted);">Toque las etiquetas para asignarlas o quitarlas de este usuario.</p>
              </div>
              <button type="button" class="btn btn-secondary btn-sm" id="close-user-tags-modal">
                ${svgIcon('close', 15)}
              </button>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:0.45rem;padding:0.85rem;border-radius:0.75rem;background:var(--surface-subtle);border:1px solid var(--widget-border);margin-bottom:1rem;">
              ${sub.tags
                .map((t) => {
                  const active = currentUserTags.some(
                    (ut) => ut.toLowerCase() === t.name.toLowerCase()
                  );
                  return renderMinimalTagPill(
                    t.name,
                    sub.tags,
                    `interactive ${active ? 'active-filter' : ''} js-pick-user-tag`,
                    `data-tag-name="${t.name}"`
                  );
                })
                .join('')}
            </div>
            <div style="display:flex;justify-content:flex-end;gap:0.5rem;">
              <button type="button" class="btn btn-secondary btn-sm" id="cancel-user-tags-modal">Cerrar</button>
              <button type="button" class="btn btn-primary btn-sm" id="save-user-tags-modal">
                ${svgIcon('save', 14)}
                <span>Guardar Etiquetas de Usuario</span>
              </button>
            </div>
          </div>
        `;

        dialog.querySelector('#close-user-tags-modal')?.addEventListener('click', () => dialog.close());
        dialog.querySelector('#cancel-user-tags-modal')?.addEventListener('click', () => dialog.close());

        dialog.querySelectorAll('.js-pick-user-tag').forEach((pill) => {
          pill.addEventListener('click', () => {
            const tName = pill.getAttribute('data-tag-name') || '';
            const exists = currentUserTags.some((x) => x.toLowerCase() === tName.toLowerCase());
            currentUserTags = exists
              ? currentUserTags.filter((x) => x.toLowerCase() !== tName.toLowerCase())
              : [...currentUserTags, tName];
            renderUserTagsDialog();
          });
        });

        dialog.querySelector('#save-user-tags-modal')?.addEventListener('click', async () => {
          try {
            await apiFetch(`/api/users/${targetUser.id}/tags`, {
              method: 'PUT',
              body: JSON.stringify({ tags: currentUserTags }),
            });
            dialog.close();
            await refreshInbox();
            showSystemToast(
              'Etiquetas de Usuario Guardadas',
              `Se actualizaron las etiquetas de ${targetUser.full_name}.`,
              'success'
            );
          } catch (err) {
            showSystemToast('Error guardando etiquetas', (err as Error).message, 'danger');
          }
        });
      };

      renderUserTagsDialog();
      dialog.showModal();
    });
  });

  // Eventos de Notas Aparte del Cliente (`conversation_notes`)
  document.getElementById('form-add-conv-note')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeConv) return;
    const noteInput = document.getElementById('new-conv-note-input') as HTMLTextAreaElement | null;
    if (!noteInput || !noteInput.value.trim()) return;

    try {
      await apiFetch(`/api/inbox/conversations/${activeConv.id}/notes`, {
        method: 'POST',
        body: JSON.stringify({ content: noteInput.value.trim() }),
      });
      noteInput.value = '';
      await refreshInbox();
      showSystemToast('Nota guardada', 'La nota interna fue añadida a este cliente.', 'success');
    } catch (err) {
      showSystemToast('Error guardando nota', (err as Error).message, 'danger');
    }
  });

  document.querySelectorAll('.js-edit-conv-note').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const noteId = Number(btn.getAttribute('data-note-id'));
      const note = sub.notes.find((n) => n.id === noteId);
      if (!note) return;

      const dialog = document.getElementById('global-form-dialog') as HTMLDialogElement | null;
      if (!dialog) return;

      dialog.innerHTML = `
        <form id="edit-note-modal-form" class="crm-form-modal-surface" style="max-width:460px;">
          <h3 style="font-size:1.05rem;margin-bottom:0.75rem;">Editar Nota Interna</h3>
          <textarea id="edit-note-textarea" class="form-control" rows="4" required>${note.content}</textarea>
          <div style="display:flex;justify-content:flex-end;gap:0.5rem;margin-top:0.85rem;">
            <button type="button" class="btn btn-secondary btn-sm" id="cancel-edit-note">Cancelar</button>
            <button type="submit" class="btn btn-primary btn-sm">Guardar Cambios</button>
          </div>
        </form>
      `;
      dialog.querySelector('#cancel-edit-note')?.addEventListener('click', () => dialog.close());
      dialog.querySelector('#edit-note-modal-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const content = (dialog.querySelector('#edit-note-textarea') as HTMLTextAreaElement).value.trim();
        await apiFetch(`/api/inbox/notes/${note.id}`, {
          method: 'PUT',
          body: JSON.stringify({ content }),
        });
        dialog.close();
        await refreshInbox();
      });
      dialog.showModal();
    });
  });

  document.querySelectorAll('.js-delete-conv-note').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const noteId = Number(btn.getAttribute('data-note-id'));
      try {
        await apiFetch(`/api/inbox/notes/${noteId}`, { method: 'DELETE' });
        await refreshInbox();
      } catch (err) {
        showSystemToast('Error eliminando nota', (err as Error).message, 'danger');
      }
    });
  });

  // ==========================================================================
  // COMPOSITOR CON ADJUNTOS DIRECTOS Y COMANDOS SLASH (/) PARA RESPUESTAS RÁPIDAS
  // ==========================================================================
  const composerTextarea = document.getElementById('chat-composer-input') as HTMLTextAreaElement | null;
  const composerForm = document.getElementById('chat-composer-form') as HTMLFormElement | null;
  const slashPopover = document.getElementById('slash-command-popover') as HTMLElement | null;
  const slashList = document.getElementById('slash-command-list') as HTMLElement | null;
  const directFileInput = document.getElementById('chat-direct-file-input') as HTMLInputElement | null;

  // Selector de Emoticones / Emojis y Stickers en el compositor
  const emojiPopover = document.getElementById('chat-emoji-picker-popover') as HTMLElement | null;
  const emojiGrid = document.getElementById('chat-emoji-grid') as HTMLElement | null;
  const stickerPanel = document.getElementById('chat-sticker-panel') as HTMLElement | null;
  const stickerFileInput = document.getElementById('chat-sticker-file-input') as HTMLInputElement | null;
  const emojiToggleBtn = document.getElementById('btn-toggle-emoji-picker') as HTMLButtonElement | null;

  const EMOJI_CATALOG: Record<string, string[]> = {
    freq: ['👍', '🙏', '😊', '😂', '❤️', '🔥', '✅', '👋', '🎉', '💯', '👌', '🤝', '🙌', '😉', '😍', '🤔', '😅', '🚀', '⚡', '📌', '📞', '📡', '🔧', '📄'],
    faces: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😋', '😛', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤯', '😳', '😱', '🤗', '🤔', '🤫', '😶', '😐', '🙄', '😴'],
    hands: ['👋', '🤚', '🖐️', '✋', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '💪'],
    work: ['📡', '🌐', '💻', '📱', '☎️', '🔧', '🛠️', '📦', '📋', '📄', '📍', '🏠', '🏢', '🚗', '⚡', '🔌', '🔋', '💡', '🔔', '⏰', '📅', '💰', '💳', '🧾', '📈', '📊', '🔒', '🔑'],
    symbols: ['✅', '❌', '⚠️', '❗', '❓', '💬', '💭', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💯', '🔥', '✨', '⭐', '🌟', '🎯', '🏆', '🎉', '🎊', '➡️', '⬅️', '⬆️', '⬇️', '🔄'],
  };

  const QUICK_STICKER_PRESETS: Array<{ id: string; emoji: string; label: string; accent: string }> = [
    { id: 'ok', emoji: '👍', label: '¡Listo!', accent: '#2563eb' },
    { id: 'thanks', emoji: '🙏', label: 'Gracias', accent: '#10b981' },
    { id: 'hello', emoji: '👋', label: '¡Hola!', accent: '#0ea5e9' },
    { id: 'tech', emoji: '🔧', label: 'En camino', accent: '#f59e0b' },
    { id: 'approved', emoji: '✅', label: 'Aprobado', accent: '#16a34a' },
    { id: 'online', emoji: '📡', label: 'Conectado', accent: '#6366f1' },
    { id: 'great', emoji: '❤️', label: 'Genial', accent: '#e11d48' },
    { id: 'party', emoji: '🎉', label: '¡Éxito!', accent: '#9333ea' },
  ];

  const buildQuickStickerWebp = (emoji: string, label: string, accent: string): string => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.clearRect(0, 0, 512, 512);
    // Tarjeta circular/pill limpia con borde blanco estilo sticker
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(36, 36, 440, 440, 96);
    ctx.fillStyle = accent;
    ctx.fill();
    ctx.lineWidth = 18;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.restore();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '210px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
    ctx.fillText(emoji, 256, 215);
    ctx.font = 'bold 64px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, 256, 395);
    return canvas.toDataURL('image/webp', 0.92);
  };

  const convertImageFileToStickerWebp = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (file.type === 'image/webp' && file.size <= 512 * 1024) {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('No se pudo leer el archivo WebP.'));
        reader.readAsDataURL(file);
        return;
      }
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 512;
          canvas.height = 512;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Canvas no disponible.'));
            return;
          }
          ctx.clearRect(0, 0, 512, 512);
          const scale = Math.min(480 / img.width, 480 / img.height);
          const drawW = Math.round(img.width * scale);
          const drawH = Math.round(img.height * scale);
          const dx = Math.round((512 - drawW) / 2);
          const dy = Math.round((512 - drawH) / 2);
          ctx.drawImage(img, dx, dy, drawW, drawH);
          const webpUrl = canvas.toDataURL('image/webp', 0.92);
          URL.revokeObjectURL(objectUrl);
          resolve(webpUrl);
        } catch (err) {
          URL.revokeObjectURL(objectUrl);
          reject(err);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Imagen no válida para sticker.'));
      };
      img.src = objectUrl;
    });
  };

  const sendStickerToActiveChat = async (mediaUrl: string, filename = 'sticker.webp') => {
    const activeConv = sub.conversations.find((c) => c.id === sub.selectedConversationId);
    if (!activeConv || !mediaUrl) return;
    if (emojiPopover) {
      emojiPopover.style.display = 'none';
      emojiToggleBtn?.setAttribute('aria-expanded', 'false');
    }
    const replyId = sub.replyingTo?.id || null;
    const replySender = sub.replyingTo?.sender || '';
    const replyBody = sub.replyingTo?.body || '';
    const replyMediaUrl = sub.replyingTo?.media_url || '';
    const replyMediaType = sub.replyingTo?.media_type || 'none';
    sub.replyingTo = null;

    try {
      const res = await apiFetch<{ success: boolean; message?: OmnichannelMessage }>(
        `/api/inbox/conversations/${activeConv.id}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            body: '',
            sender: 'agent',
            media_type: 'sticker',
            media_url: mediaUrl,
            media_filename: filename,
            media_mimetype: 'image/webp',
            reply_to_id: replyId,
            reply_to_sender: replySender,
            reply_to_body: replyBody,
            reply_to_media_url: replyMediaUrl,
            reply_to_media_type: replyMediaType,
          }),
        }
      );
      if (res?.message?.id) {
        sub.lastSentMessageId = res.message.id;
      }
      await refreshInbox();
      if (sub.lastSentMessageId) {
        const sentRow = document.querySelector(`.chat-msg-row[data-id="${sub.lastSentMessageId}"]`) as HTMLElement | null;
        if (sentRow) {
          sentRow.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
      }
    } catch (err) {
      showSystemToast('Error al enviar sticker', (err as Error).message, 'danger');
    }
  };

  let cachedRecentStickers: Array<{ media_url: string; media_filename?: string }> | null = null;

  const renderStickersPanel = async () => {
    if (!emojiGrid || !stickerPanel) return;
    emojiGrid.style.display = 'none';
    stickerPanel.style.display = 'flex';

    if (!cachedRecentStickers) {
      try {
        const data = await apiFetch<{ stickers: Array<{ media_url: string; media_filename?: string }> }>(
          '/api/inbox/stickers'
        );
        cachedRecentStickers = data.stickers || [];
      } catch {
        cachedRecentStickers = [];
      }
    }

    const recentHtml =
      cachedRecentStickers.length > 0
        ? `
          <div class="chat-sticker-section-title">Stickers recientes de WhatsApp</div>
          <div class="chat-sticker-grid">
            ${cachedRecentStickers
              .map(
                (st) => `
                  <button type="button" class="chat-sticker-item js-send-existing-sticker" data-sticker-url="${escapeHtml(st.media_url)}" data-sticker-name="${escapeHtml(st.media_filename || 'sticker.webp')}" title="Enviar sticker">
                    <img src="${escapeHtml(st.media_url)}" alt="Sticker" class="chat-sticker-thumb" loading="lazy" />
                  </button>
                `
              )
              .join('')}
          </div>
        `
        : '';

    const quickHtml = `
      <div class="chat-sticker-section-title">Stickers rápidos</div>
      <div class="chat-sticker-grid">
        ${QUICK_STICKER_PRESETS.map((p) => {
          const previewUrl = buildQuickStickerWebp(p.emoji, p.label, p.accent);
          return `
            <button type="button" class="chat-sticker-item js-send-quick-sticker" data-sticker-url="${previewUrl}" data-sticker-name="sticker_${p.id}.webp" title="Enviar sticker ${escapeHtml(p.label)}">
              <img src="${previewUrl}" alt="${escapeHtml(p.label)}" class="chat-sticker-thumb" />
            </button>
          `;
        }).join('')}
      </div>
    `;

    stickerPanel.innerHTML = `
      <div class="chat-sticker-toolbar">
        <button type="button" class="chat-sticker-upload-btn" id="btn-upload-custom-sticker">
          ${svgIcon('plus', 14)}
          <span>Crear sticker desde imagen</span>
        </button>
      </div>
      <div class="chat-sticker-scroll">
        ${recentHtml}
        ${quickHtml}
      </div>
    `;

    stickerPanel.querySelector('#btn-upload-custom-sticker')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      stickerFileInput?.click();
    });

    stickerPanel
      .querySelectorAll('.js-send-existing-sticker, .js-send-quick-sticker')
      .forEach((btn) => {
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const url = btn.getAttribute('data-sticker-url') || '';
          const name = btn.getAttribute('data-sticker-name') || 'sticker.webp';
          void sendStickerToActiveChat(url, name);
        });
      });
  };

  const renderEmojiCategory = (cat: string) => {
    if (cat === 'stickers') {
      void renderStickersPanel();
      return;
    }
    if (!emojiGrid) return;
    if (stickerPanel) stickerPanel.style.display = 'none';
    emojiGrid.style.display = 'grid';
    const list = EMOJI_CATALOG[cat] || EMOJI_CATALOG.freq;
    emojiGrid.innerHTML = list
      .map((em) => `<button type="button" class="chat-emoji-item" data-emoji="${em}">${em}</button>`)
      .join('');
    emojiGrid.querySelectorAll('.chat-emoji-item').forEach((itemBtn) => {
      itemBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const emoji = itemBtn.getAttribute('data-emoji') || '';
        const inputEl = document.getElementById('chat-composer-input') as HTMLTextAreaElement | null;
        if (!inputEl || !emoji) return;
        const start = inputEl.selectionStart ?? inputEl.value.length;
        const end = inputEl.selectionEnd ?? inputEl.value.length;
        inputEl.value = inputEl.value.slice(0, start) + emoji + inputEl.value.slice(end);
        const nextPos = start + emoji.length;
        inputEl.focus();
        try {
          inputEl.setSelectionRange(nextPos, nextPos);
        } catch {}
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });
  };

  if (stickerFileInput) {
    stickerFileInput.addEventListener('change', async () => {
      const file = stickerFileInput.files?.[0];
      stickerFileInput.value = '';
      if (!file) return;
      try {
        const webpDataUrl = await convertImageFileToStickerWebp(file);
        cachedRecentStickers = null;
        await sendStickerToActiveChat(webpDataUrl, `sticker_${Date.now()}.webp`);
      } catch (err) {
        showSystemToast('Error al crear sticker', (err as Error).message, 'danger');
      }
    });
  }

  if (emojiPopover && emojiToggleBtn) {
    renderEmojiCategory('freq');
    emojiToggleBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const isOpen = emojiPopover.style.display === 'flex';
      emojiPopover.style.display = isOpen ? 'none' : 'flex';
      emojiToggleBtn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
    });
    emojiPopover.addEventListener('click', (ev) => {
      ev.stopPropagation();
    });
    emojiPopover.querySelectorAll('.chat-emoji-tab').forEach((tabBtn) => {
      tabBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const cat = tabBtn.getAttribute('data-emoji-cat') || 'freq';
        emojiPopover.querySelectorAll('.chat-emoji-tab').forEach((b) => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        tabBtn.classList.add('active');
        tabBtn.setAttribute('aria-selected', 'true');
        renderEmojiCategory(cat);
      });
    });
    const winFlags = window as unknown as Record<string, boolean>;
    if (!winFlags.__turboEmojiDocListenersBound) {
      winFlags.__turboEmojiDocListenersBound = true;
      document.addEventListener('click', () => {
        const pop = document.getElementById('chat-emoji-picker-popover');
        const btn = document.getElementById('btn-toggle-emoji-picker');
        if (pop && pop.style.display === 'flex') {
          pop.style.display = 'none';
          btn?.setAttribute('aria-expanded', 'false');
        }
      });
      document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') {
          const pop = document.getElementById('chat-emoji-picker-popover');
          const btn = document.getElementById('btn-toggle-emoji-picker');
          if (pop && pop.style.display === 'flex') {
            pop.style.display = 'none';
            btn?.setAttribute('aria-expanded', 'false');
            btn?.focus();
          }
        }
      });
    }
  }

  document.getElementById('btn-attach-media-file')?.addEventListener('click', () => {
    directFileInput?.click();
  });

  directFileInput?.addEventListener('change', async () => {
    const file = directFileInput.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      const activeConv = sub.conversations.find((c) => c.id === sub.selectedConversationId);
      openWhatsAppPhotoEditor({
        imageFile: file,
        onSend: async (result) => {
          if (!activeConv) return;
          const replyId = sub.replyingTo?.id || null;
          const replySender = sub.replyingTo?.sender || '';
          const replyBody = sub.replyingTo?.body || '';
          const replyMediaUrl = sub.replyingTo?.media_url || '';
          const replyMediaType = sub.replyingTo?.media_type || 'none';
          sub.replyingTo = null;

          try {
            const res = await apiFetch<{ success: boolean; message?: OmnichannelMessage }>(
              `/api/inbox/conversations/${activeConv.id}/messages`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  body: result.caption || '',
                  sender: 'agent',
                  media_type: 'image',
                  media_url: result.dataUrl,
                  media_filename: result.filename,
                  media_mimetype: 'image/jpeg',
                  reply_to_id: replyId,
                  reply_to_sender: replySender,
                  reply_to_body: replyBody,
                  reply_to_media_url: replyMediaUrl,
                  reply_to_media_type: replyMediaType,
                }),
              }
            );
            if (res?.message?.id) {
              sub.lastSentMessageId = res.message.id;
            }
            await refreshInbox();

            if (sub.lastSentMessageId) {
              const sentRow = document.querySelector(`.chat-msg-row[data-id="${sub.lastSentMessageId}"]`) as HTMLElement | null;
              if (sentRow) {
                sentRow.scrollIntoView({ behavior: 'smooth', block: 'end' });
                sentRow.classList.add('chat-msg-highlight-pulse');
                setTimeout(() => {
                  sentRow.classList.remove('chat-msg-highlight-pulse');
                  if (sub.lastSentMessageId === res?.message?.id) {
                    sub.lastSentMessageId = null;
                  }
                }, 2600);
              }
            }
          } catch (err) {
            showSystemToast('Error enviando imagen', (err as Error).message, 'danger');
          } finally {
            const inputAfter = document.getElementById('chat-composer-input') as HTMLTextAreaElement | null;
            inputAfter?.focus();
          }
        },
      });
      directFileInput.value = '';
      return;
    }

    try {
      const dataUrl = await readLocalFileAsDataUrl(file);
      sub.pendingAttachment = {
        media_type: detectMediaTypeFromMime(file.type),
        media_url: dataUrl,
        media_filename: file.name,
        media_mimetype: file.type || 'application/octet-stream',
      };
      rerender();
      const inputAfter = document.getElementById('chat-composer-input') as HTMLTextAreaElement | null;
      inputAfter?.focus();
    } catch (err) {
      showSystemToast('Error adjuntando archivo', (err as Error).message, 'danger');
    }
  });

  document.getElementById('btn-clear-pending-media')?.addEventListener('click', () => {
    sub.pendingAttachment = null;
    rerender();
  });

  document.getElementById('btn-popover-manage-qr')?.addEventListener('click', () => {
    openQuickRepliesManagerModal({ sub, apiFetch, refreshInbox, onSelect: applyQuickReplyToComposer });
  });

  let selectedQrIndex = 0;

  const updateSlashMenu = () => {
    if (!composerTextarea || !slashPopover || !slashList) return;
    const raw = composerTextarea.value;
    const trimmed = raw.trim();
    if (!trimmed.startsWith('/')) {
      slashPopover.style.display = 'none';
      return;
    }

    const query = trimmed.slice(1).trim().toLowerCase();
    const matches = sub.quickReplies.filter(
      (q) =>
        q.shortcut.toLowerCase().includes(query) ||
        q.title.toLowerCase().includes(query) ||
        q.body.toLowerCase().includes(query)
    );

    if (matches.length === 0) {
      slashList.innerHTML = `
        <div style="padding:0.85rem 1rem;font-size:0.8rem;color:var(--text-muted);display:flex;align-items:center;justify-content:space-between;gap:0.5rem;">
          <span>No hay respuestas automáticas con "<strong>/${query}</strong>".</span>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-quick-create-qr" style="padding:0.2rem 0.5rem;font-size:0.72rem;">
            ${svgIcon('plus', 11)}
            <span>Crear nueva</span>
          </button>
        </div>
      `;
      slashList.querySelector('#btn-quick-create-qr')?.addEventListener('click', () => {
        openQuickRepliesManagerModal({ sub, apiFetch, refreshInbox, onSelect: applyQuickReplyToComposer });
      });
      slashPopover.style.display = 'flex';
      return;
    }

    selectedQrIndex = 0;
    slashList.innerHTML = matches
      .map(
        (qr, idx) => `
        <button type="button" class="slash-command-item ${idx === 0 ? 'active' : ''} js-pick-slash-qr" data-qr-id="${qr.id}" data-index="${idx}">
          <div style="min-width:0;flex:1;">
            <div style="display:flex;align-items:center;gap:0.45rem;">
              <span class="slash-shortcut-code">/${qr.shortcut}</span>
              <strong style="font-size:0.82rem;">${qr.title}</strong>
              ${
                qr.media_type && qr.media_type !== 'none'
                  ? `<span class="tag-pill-minimal" style="--tag-color:var(--widget-accent);">
                      ${svgIcon(mediaTypeIcon(qr.media_type), 10)}
                      <span>${mediaTypeLabel(qr.media_type)}</span>
                    </span>`
                  : ''
              }
            </div>
            <div style="font-size:0.75rem;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:0.15rem;">
              ${qr.body}
            </div>
          </div>
          <span style="font-size:0.7rem;color:var(--text-muted);flex:none;">Usar ↵</span>
        </button>
      `
      )
      .join('');

    slashPopover.style.display = 'flex';

    slashList.querySelectorAll('.js-pick-slash-qr').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(btn.getAttribute('data-qr-id'));
        const found = sub.quickReplies.find((q) => q.id === id);
        if (found) applyQuickReplyToComposer(found);
      });
    });
  };

  document.getElementById('btn-trigger-slash-menu')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!composerTextarea) return;
    if (slashPopover && slashPopover.style.display === 'flex') {
      slashPopover.style.display = 'none';
      return;
    }
    if (!composerTextarea.value.trim().startsWith('/')) {
      composerTextarea.value = '/';
    }
    composerTextarea.focus();
    updateSlashMenu();
  });

  const updateChatActionButtonState = () => {
    const actionBtn = document.getElementById('btn-chat-action') as HTMLButtonElement | null;
    const sendIcon = actionBtn?.querySelector('.chat-action-icon-send') as HTMLElement | null;
    const micIcon = actionBtn?.querySelector('.chat-action-icon-mic') as HTMLElement | null;
    const hasText = Boolean(composerTextarea?.value.trim());
    const hasAttachment = Boolean(sub.pendingAttachment);
    const shouldSend = hasText || hasAttachment;

    if (actionBtn && sendIcon && micIcon) {
      if (shouldSend) {
        actionBtn.classList.remove('is-mic');
        actionBtn.classList.add('is-send');
        actionBtn.title = 'Enviar mensaje';
        sendIcon.style.display = 'inline-flex';
        micIcon.style.display = 'none';
      } else {
        actionBtn.classList.remove('is-send');
        actionBtn.classList.add('is-mic');
        actionBtn.title = 'Grabar nota de voz';
        sendIcon.style.display = 'none';
        micIcon.style.display = 'inline-flex';
      }
    }
  };

  let activeMediaRecorder: MediaRecorder | null = null;
  let recordedAudioChunks: Blob[] = [];
  let isRecordingAudio = false;
  let recordingTimerInterval: number | null = null;
  let recordingSecondsCount = 0;

  const handleVoiceRecording = async () => {
    const actionBtn = document.getElementById('btn-chat-action');
    if (!actionBtn) return;

    if (isRecordingAudio) {
      if (activeMediaRecorder && activeMediaRecorder.state !== 'inactive') {
        activeMediaRecorder.stop();
      }
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showSystemToast('Audio no soportado', 'Su navegador no soporta grabación directa de audio.', 'info');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      activeMediaRecorder = new MediaRecorder(stream);
      recordedAudioChunks = [];
      recordingSecondsCount = 0;
      isRecordingAudio = true;

      actionBtn.classList.add('is-recording');
      actionBtn.title = 'Detener y enviar nota de voz';

      const recordingIndicator = document.createElement('div');
      recordingIndicator.id = 'live-recording-indicator';
      recordingIndicator.className = 'live-voice-recording-bar';
      recordingIndicator.innerHTML = `
        <div style="display:flex;align-items:center;gap:0.6rem;color:#ef4444;font-size:0.85rem;font-weight:600;">
          <span class="recording-pulse-dot"></span>
          <span>Grabando nota de voz... <strong id="recording-timer-text">0:00</strong></span>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-recording" style="padding:0.2rem 0.5rem;font-size:0.75rem;">
          ${svgIcon('close', 12)}
          <span>Cancelar</span>
        </button>
      `;
      const composerArea = document.querySelector('.chat-composer-area');
      composerArea?.prepend(recordingIndicator);

      recordingTimerInterval = window.setInterval(() => {
        recordingSecondsCount++;
        const m = Math.floor(recordingSecondsCount / 60);
        const s = recordingSecondsCount % 60;
        const timerText = document.getElementById('recording-timer-text');
        if (timerText) timerText.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
      }, 1000);

      recordingIndicator.querySelector('#btn-cancel-recording')?.addEventListener('click', (ev) => {
        ev.stopPropagation();
        cleanupRecording(true);
        stream.getTracks().forEach((track) => track.stop());
      });

      activeMediaRecorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) {
          recordedAudioChunks.push(ev.data);
        }
      };

      activeMediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        cleanupRecording(false);
        if (recordedAudioChunks.length > 0) {
          const audioBlob = new Blob(recordedAudioChunks, { type: 'audio/ogg; codecs=opus' });
          const reader = new FileReader();
          reader.onload = async () => {
            const dataUrl = String(reader.result);
            sub.pendingAttachment = {
              media_type: 'audio',
              media_url: dataUrl,
              media_filename: `nota_voz_${Date.now()}.ogg`,
              media_mimetype: 'audio/ogg',
            };
            rerender();
          };
          reader.readAsDataURL(audioBlob);
        }
      };

      activeMediaRecorder.start();
    } catch {
      isRecordingAudio = false;
      actionBtn.classList.remove('is-recording');
      showSystemToast('Permiso de Micrófono', 'Se requiere acceso al micrófono para grabar notas de voz.', 'info');
    }
  };

  const cleanupRecording = (cancelled: boolean) => {
    isRecordingAudio = false;
    if (recordingTimerInterval !== null) {
      window.clearInterval(recordingTimerInterval);
      recordingTimerInterval = null;
    }
    document.getElementById('live-recording-indicator')?.remove();
    const actionBtn = document.getElementById('btn-chat-action');
    actionBtn?.classList.remove('is-recording');
    if (cancelled) {
      recordedAudioChunks = [];
    }
  };

  // ==========================================================================
  // VISTA PREVIA EN VIVO DE OPEN GRAPH (URL PREVIEWS) EN EL COMPOSITOR
  // ==========================================================================
  const previewBox = document.getElementById('composer-link-preview-box');
  let activePreviewUrl = '';
  let dismissedPreviewUrl = '';
  let previewDebounceTimer: any = null;

  const renderComposerPreviewCard = (data: any, domain: string, url: string) => {
    if (!previewBox) return;
    const title = data.title || domain;
    const desc = data.description || '';
    const imgUrl = data.image || '';
    const faviconUrl = data.favicon || `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;

    previewBox.style.display = 'block';
    previewBox.innerHTML = `
      <div class="composer-link-preview-bar">
        ${
          imgUrl
            ? `
          <div class="composer-link-preview-thumb-box">
            <img src="${imgUrl}" alt="" class="composer-link-preview-thumb" onerror="this.src='${faviconUrl}'; this.style.objectFit='contain'; this.style.padding='8px';" />
          </div>
        `
            : `
          <div class="composer-link-preview-favicon-box">
            <img src="${faviconUrl}" alt="" class="composer-link-preview-favicon" />
          </div>
        `
        }
        <div class="composer-link-preview-content">
          <div class="composer-link-preview-header">
            <span class="composer-link-preview-badge">${svgIcon('externalLink', 11)} ${escapeHtml(data.domain || domain)}</span>
          </div>
          <strong class="composer-link-preview-title">${escapeHtml(title)}</strong>
          ${desc ? `<p class="composer-link-preview-desc">${escapeHtml(desc)}</p>` : ''}
        </div>
        <button type="button" class="composer-link-preview-close js-dismiss-link-preview" title="Quitar vista previa">
          ${svgIcon('close', 14)}
        </button>
      </div>
    `;

    previewBox.querySelector('.js-dismiss-link-preview')?.addEventListener('click', (e) => {
      e.stopPropagation();
      dismissedPreviewUrl = url;
      activePreviewUrl = '';
      previewBox.style.display = 'none';
      previewBox.innerHTML = '';
      composerTextarea?.focus();
    });
  };

  const updateComposerLinkPreview = () => {
    if (!previewBox || !composerTextarea) return;
    const text = composerTextarea.value || '';
    const urls = extractUrlsFromText(text);

    if (urls.length === 0) {
      activePreviewUrl = '';
      previewBox.style.display = 'none';
      previewBox.innerHTML = '';
      return;
    }

    const targetUrl = urls[0];
    if (targetUrl === dismissedPreviewUrl) {
      previewBox.style.display = 'none';
      return;
    }

    if (targetUrl === activePreviewUrl && previewBox.innerHTML) {
      previewBox.style.display = 'block';
      return;
    }

    activePreviewUrl = targetUrl;
    let domain = targetUrl;
    try {
      domain = new URL(targetUrl).hostname.replace(/^www\./, '');
    } catch {}

    // Si ya está en caché del cliente, renderizarlo de inmediato
    const cached = linkPreviewClientCache.get(targetUrl);
    if (cached) {
      renderComposerPreviewCard(cached, domain, targetUrl);
      return;
    }

    // Mostrar estado de carga elegante
    previewBox.style.display = 'block';
    previewBox.innerHTML = `
      <div class="composer-link-preview-bar is-loading">
        <div class="composer-link-preview-spinner-box">
          <div class="wa-media-loading-spinner" style="width:18px;height:18px;border-width:2px;"></div>
        </div>
        <div class="composer-link-preview-content">
          <div class="composer-link-preview-header">
            <span class="composer-link-preview-badge">${svgIcon('externalLink', 11)} ${escapeHtml(domain)}</span>
          </div>
          <div class="composer-link-preview-loading-text">Obteniendo información del enlace...</div>
        </div>
        <button type="button" class="composer-link-preview-close js-dismiss-link-preview" title="Quitar vista previa">
          ${svgIcon('close', 14)}
        </button>
      </div>
    `;

    previewBox.querySelector('.js-dismiss-link-preview')?.addEventListener('click', (e) => {
      e.stopPropagation();
      dismissedPreviewUrl = targetUrl;
      activePreviewUrl = '';
      previewBox.style.display = 'none';
      previewBox.innerHTML = '';
      composerTextarea?.focus();
    });

    // Petición al endpoint
    fetch(`/api/link-preview?url=${encodeURIComponent(targetUrl)}`)
      .then((r) => r.json())
      .then((data) => {
        if (activePreviewUrl !== targetUrl) return;
        if (data && !data.error) {
          linkPreviewClientCache.set(targetUrl, data);
          renderComposerPreviewCard(data, domain, targetUrl);
        }
      })
      .catch(() => {
        // Fallback silencioso
      });
  };

  composerTextarea?.addEventListener('input', () => {
    updateSlashMenu();
    updateChatActionButtonState();
    if (composerTextarea) {
      composerTextarea.style.height = 'auto';
      composerTextarea.style.height = `${Math.min(composerTextarea.scrollHeight, 120)}px`;
    }
    clearTimeout(previewDebounceTimer);
    previewDebounceTimer = setTimeout(updateComposerLinkPreview, 320);
  });

  if (composerTextarea?.value.trim()) {
    updateComposerLinkPreview();
  }

  document.addEventListener('click', (e) => {
    if (!slashPopover || slashPopover.style.display === 'none') return;
    const target = e.target as HTMLElement;
    if (
      !slashPopover.contains(target) &&
      target.id !== 'btn-trigger-slash-menu' &&
      target !== composerTextarea
    ) {
      slashPopover.style.display = 'none';
    }
  });

  composerTextarea?.addEventListener('keydown', (event: KeyboardEvent) => {
    if (slashPopover && slashPopover.style.display !== 'none') {
      const items = Array.from(slashList?.querySelectorAll<HTMLElement>('.slash-command-item') || []);
      if (event.key === 'Escape') {
        slashPopover.style.display = 'none';
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (items.length > 0) {
          items[selectedQrIndex]?.classList.remove('active');
          selectedQrIndex = (selectedQrIndex + 1) % items.length;
          items[selectedQrIndex]?.classList.add('active');
          items[selectedQrIndex]?.scrollIntoView({ block: 'nearest' });
        }
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (items.length > 0) {
          items[selectedQrIndex]?.classList.remove('active');
          selectedQrIndex = (selectedQrIndex - 1 + items.length) % items.length;
          items[selectedQrIndex]?.classList.add('active');
          items[selectedQrIndex]?.scrollIntoView({ block: 'nearest' });
        }
        return;
      }
      if (event.key === 'Tab' || (event.key === 'Enter' && !event.shiftKey)) {
        event.preventDefault();
        const activeItem = items[selectedQrIndex] || items[0];
        if (activeItem) {
          const id = Number(activeItem.getAttribute('data-qr-id'));
          const found = sub.quickReplies.find((q) => q.id === id);
          if (found) {
            applyQuickReplyToComposer(found);
            return;
          }
        }
      }
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (event.isComposing || event.keyCode === 229) {
        return;
      }
      composerForm?.requestSubmit();
    }
  });

  // Soporte directo para Pegar con Ctrl + V (Imágenes, capturas de pantalla y archivos)
  const handleClipboardPaste = async (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items || items.length === 0) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1 || (item.kind === 'file' && item.type.startsWith('image/'))) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          try {
            const dataUrl = await readLocalFileAsDataUrl(file);
            sub.pendingAttachment = {
              media_type: 'image',
              media_url: dataUrl,
              media_filename: file.name || `captura_${Date.now()}.png`,
              media_mimetype: file.type || 'image/png',
            };
            rerender();
            const inputAfter = document.getElementById('chat-composer-input') as HTMLTextAreaElement | null;
            inputAfter?.focus();
            showSystemToast('Imagen pegada (Ctrl + V)', 'Captura adjuntada lista para enviar.', 'info');
          } catch (err) {
            showSystemToast('Error al procesar imagen pegada', (err as Error).message, 'danger');
          }
          return;
        }
      }
    }
    // Si se pegó texto, actualizar la vista previa de enlace inmediatamente
    setTimeout(updateComposerLinkPreview, 80);
  };

  composerTextarea?.addEventListener('paste', handleClipboardPaste);

  composerForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeConv) return;

    activePreviewUrl = '';
    dismissedPreviewUrl = '';
    if (previewBox) {
      previewBox.style.display = 'none';
      previewBox.innerHTML = '';
    }

    const actionBtn = document.getElementById('btn-chat-action');
    const isMic = actionBtn?.classList.contains('is-mic');

    if (isMic && !sub.pendingAttachment && !composerTextarea?.value.trim()) {
      handleVoiceRecording();
      return;
    }

    const bodyText = composerTextarea?.value.trim() || '';
    const attachment = sub.pendingAttachment;

    if (!bodyText && !attachment) {
      composerTextarea?.focus();
      return;
    }

    if (composerTextarea) {
      composerTextarea.value = '';
      composerTextarea.style.height = 'auto';
      composerTextarea.focus(); // Mantener seleccionado de inmediato
    }
    sub.pendingAttachment = null;
    if (slashPopover) slashPopover.style.display = 'none';
    updateChatActionButtonState();

    const replyId = sub.replyingTo?.id || null;
    const replySender = sub.replyingTo?.sender || '';
    const replyBody = sub.replyingTo?.body || '';
    const replyMediaUrl = sub.replyingTo?.media_url || '';
    const replyMediaType = sub.replyingTo?.media_type || 'none';
    sub.replyingTo = null;

    try {
      const sendUrl = `/api/inbox/conversations/${activeConv.id}/messages`;
      const sendPayload = {
        body: bodyText,
        media_type: attachment?.media_type || 'none',
        media_url: attachment?.media_url || '',
        media_filename: attachment?.media_filename || '',
        media_mimetype: attachment?.media_mimetype || '',
        reply_to_id: replyId,
        reply_to_sender: replySender,
        reply_to_body: replyBody,
        reply_to_media_url: replyMediaUrl,
        reply_to_media_type: replyMediaType,
      };
      // Adjuntos grandes: barra de progreso de subida
      const bigUpload = Boolean(attachment && attachment.media_url.length > 700_000);
      const progress = bigUpload ? showUploadProgress(attachment?.media_filename || 'archivo') : null;
      let res: { success: boolean; message?: OmnichannelMessage };
      try {
        res = bigUpload
          ? await postJsonWithProgress<{ success: boolean; message?: OmnichannelMessage }>(
              sendUrl,
              sendPayload,
              (pct) => progress?.update(pct)
            )
          : await apiFetch<{ success: boolean; message?: OmnichannelMessage }>(sendUrl, {
              method: 'POST',
              body: JSON.stringify(sendPayload),
            });
      } finally {
        progress?.done();
      }
      if (res?.message?.id) {
        sub.lastSentMessageId = res.message.id;
      }
      await refreshInbox();

      if (sub.lastSentMessageId) {
        const sentRow = document.querySelector(`.chat-msg-row[data-id="${sub.lastSentMessageId}"]`) as HTMLElement | null;
        if (sentRow) {
          sentRow.scrollIntoView({ behavior: 'smooth', block: 'end' });
          sentRow.classList.add('chat-msg-highlight-pulse');
          setTimeout(() => {
            sentRow.classList.remove('chat-msg-highlight-pulse');
            if (sub.lastSentMessageId === res?.message?.id) {
              sub.lastSentMessageId = null;
            }
          }, 2600);
        }
      }
    } catch (err) {
      showSystemToast('Error al enviar mensaje', (err as Error).message, 'danger');
    } finally {
      // Reenfocar SIEMPRE el campo de mensaje para continuar escribiendo sin necesidad de hacer clic
      const inputAfter = document.getElementById('chat-composer-input') as HTMLTextAreaElement | null;
      inputAfter?.focus();
    }
  });

  // Eventos para Respuestas Rápidas a Mensajes (Botón Citar / Responder)
  document.querySelectorAll<HTMLButtonElement>('.js-reply-msg').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = Number(btn.getAttribute('data-id'));
      const sender = btn.getAttribute('data-sender') || 'Contacto';
      const body = btn.getAttribute('data-body') || '';
      const media_type = btn.getAttribute('data-media-type') || 'none';
      const media_url = btn.getAttribute('data-media-url') || '';
      if (!id) return;
      sub.replyingTo = { id, sender, body, media_type, media_url };
      rerender();
      const inputAfter = document.getElementById('chat-composer-input') as HTMLTextAreaElement | null;
      inputAfter?.focus();
    });
  });

  // Doble clic en cualquier fila de mensaje para responder rápidamente (estilo WhatsApp / Telegram)
  document.querySelectorAll<HTMLElement>('.chat-msg-row').forEach((row) => {
    row.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      const id = Number(row.getAttribute('data-id'));
      const sender = row.getAttribute('data-sender') || 'Contacto';
      const body = row.getAttribute('data-body') || '';
      const media_type = row.getAttribute('data-media-type') || 'none';
      const media_url = row.getAttribute('data-media-url') || '';
      if (!id) return;
      sub.replyingTo = { id, sender, body, media_type, media_url };
      rerender();
      const inputAfter = document.getElementById('chat-composer-input') as HTMLTextAreaElement | null;
      inputAfter?.focus();
    });
  });

  // Salto interactivo al hacer clic en un mensaje citado (.chat-quoted-box / .js-jump-to-reply) con resaltado visual
  document.querySelectorAll<HTMLElement>('.js-jump-to-reply').forEach((box) => {
    box.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetId = box.getAttribute('data-target-id');
      if (!targetId) return;
      const targetRow = document.querySelector(`.chat-msg-row[data-id="${targetId}"]`) as HTMLElement | null;
      if (targetRow) {
        targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetRow.classList.remove('chat-msg-highlight-pulse');
        void targetRow.offsetWidth; // retrigger reflow
        targetRow.classList.add('chat-msg-highlight-pulse');
        setTimeout(() => {
          targetRow.classList.remove('chat-msg-highlight-pulse');
        }, 2600);
      } else {
        showSystemToast('Mensaje citado', 'El mensaje original se encuentra en el historial anterior.', 'info');
      }
    });
  });

  // Evento para Reenviar Mensaje a otro chat / contacto
  document.querySelectorAll<HTMLButtonElement>('.js-forward-msg').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const messageId = Number(btn.getAttribute('data-id'));
      const sender = btn.getAttribute('data-sender') || '';
      const body = btn.getAttribute('data-body') || '';
      const mediaType = btn.getAttribute('data-media-type') || 'none';
      const mediaUrl = btn.getAttribute('data-media-url') || '';
      const mediaFilename = btn.getAttribute('data-media-filename') || '';
      if (!messageId) return;

      openForwardMessageModal({
        messageId,
        sender,
        body,
        mediaType,
        mediaUrl,
        mediaFilename,
        sub,
        apiFetch,
        refreshInbox,
      });
    });
  });

  // Menú Contextual (Click Derecho) en mensajes de chat (Copiar, Responder, Reenviar, Editar, Eliminar)
  const chatMessagesScroller = document.getElementById('chat-messages-scroller');
  if (chatMessagesScroller) {
    chatMessagesScroller.addEventListener('contextmenu', (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const row = target?.closest('.chat-msg-row') as HTMLElement | null;
      if (!row) return;

      e.preventDefault();
      e.stopPropagation();

      document.querySelectorAll('.chat-msg-context-menu').forEach((el) => el.remove());

      const msgId = Number(row.getAttribute('data-id'));
      const sender = row.getAttribute('data-sender') || '';
      const body = row.getAttribute('data-body') || '';
      const mediaType = row.getAttribute('data-media-type') || 'none';
      const mediaUrl = row.getAttribute('data-media-url') || '';
      const mediaFilename = row.getAttribute('data-media-filename') || '';
      const isIncoming = row.getAttribute('data-is-incoming') === 'true';
      const isDeleted = row.getAttribute('data-is-deleted') === 'true';

      if (!msgId || isDeleted) return;

      const menu = document.createElement('div');
      menu.className = 'chat-msg-context-menu';

      const canEdit = !isIncoming && !isDeleted && (mediaType === 'none' || Boolean(body));

      menu.innerHTML = `
        <button type="button" class="chat-context-menu-item js-ctx-copy">
          ${svgIcon('copy', 14)}
          <span>Copiar mensaje</span>
        </button>
        <button type="button" class="chat-context-menu-item js-ctx-reply">
          ${svgIcon('cornerUpLeft', 14)}
          <span>Responder</span>
        </button>
        <button type="button" class="chat-context-menu-item js-ctx-forward">
          ${svgIcon('forward', 14)}
          <span>Reenviar</span>
        </button>
        ${
          canEdit
            ? `
          <button type="button" class="chat-context-menu-item js-ctx-edit">
            ${svgIcon('edit', 14)}
            <span>Editar mensaje</span>
          </button>
        `
            : ''
        }
        <div class="chat-context-menu-divider"></div>
        <button type="button" class="chat-context-menu-item danger js-ctx-delete">
          ${svgIcon('trash', 14)}
          <span>Eliminar mensaje</span>
        </button>
      `;

      document.body.appendChild(menu);

      const menuWidth = 195;
      const menuHeight = canEdit ? 210 : 170;
      let posX = e.clientX;
      let posY = e.clientY;

      if (posX + menuWidth > window.innerWidth) {
        posX = window.innerWidth - menuWidth - 12;
      }
      if (posY + menuHeight > window.innerHeight) {
        posY = window.innerHeight - menuHeight - 12;
      }

      menu.style.left = `${Math.max(10, posX)}px`;
      menu.style.top = `${Math.max(10, posY)}px`;

      const removeMenu = () => {
        menu.remove();
        document.removeEventListener('click', onDocClick);
        document.removeEventListener('keydown', onKey);
      };

      const onDocClick = (evt: MouseEvent) => {
        if (!menu.contains(evt.target as Node)) {
          removeMenu();
        }
      };

      const onKey = (evt: KeyboardEvent) => {
        if (evt.key === 'Escape') removeMenu();
      };

      setTimeout(() => {
        document.addEventListener('click', onDocClick);
        document.addEventListener('keydown', onKey);
      }, 10);

      menu.querySelector('.js-ctx-copy')?.addEventListener('click', async () => {
        removeMenu();
        const textToCopy = body || mediaUrl;
        if (textToCopy) {
          try {
            await navigator.clipboard.writeText(textToCopy);
            showSystemToast('Copiado', 'Contenido copiado al portapapeles.', 'info');
          } catch {
            showSystemToast('Error', 'No se pudo copiar al portapapeles.', 'danger');
          }
        }
      });

      menu.querySelector('.js-ctx-reply')?.addEventListener('click', () => {
        removeMenu();
        sub.replyingTo = { id: msgId, sender, body, media_type: mediaType, media_url: mediaUrl };
        rerender();
        const composer = document.getElementById('chat-composer-input') as HTMLTextAreaElement | null;
        composer?.focus();
      });

      menu.querySelector('.js-ctx-forward')?.addEventListener('click', () => {
        removeMenu();
        openForwardMessageModal({
          messageId: msgId,
          sender,
          body,
          mediaType,
          mediaUrl,
          mediaFilename,
          sub,
          apiFetch,
          refreshInbox,
        });
      });

      menu.querySelector('.js-ctx-edit')?.addEventListener('click', () => {
        removeMenu();
        openEditMessageModal({
          messageId: msgId,
          currentBody: body,
          sub,
          apiFetch,
          refreshInbox,
        });
      });

      menu.querySelector('.js-ctx-delete')?.addEventListener('click', async () => {
        removeMenu();
        const confirmed = await showSystemConfirmModal({
          title: '¿Eliminar este mensaje?',
          description: 'El mensaje se marcará como eliminado para todos los participantes.',
          confirmLabel: 'Eliminar Mensaje',
          cancelLabel: 'Cancelar',
          danger: true,
        });
        if (confirmed) {
          try {
            await apiFetch(`/api/inbox/messages/${msgId}`, { method: 'DELETE' });
            showSystemToast('Mensaje eliminado', 'El mensaje ha sido eliminado correctamente.', 'info');
            await refreshInbox();
          } catch (err: any) {
            showSystemToast('Error al eliminar', err.message || 'No se pudo eliminar el mensaje.', 'danger');
          }
        }
      });
    });
  }

  document.querySelector('.js-cancel-reply')?.addEventListener('click', (e) => {
    e.stopPropagation();
    sub.replyingTo = null;
    rerender();
    const inputAfter = document.getElementById('chat-composer-input') as HTMLTextAreaElement | null;
    inputAfter?.focus();
  });

  // Soporte para Arrastrar y Soltar (Drag & Drop) de Archivos (Fotos, Videos, Audios, Docs)
  const chatCol = document.getElementById('chat-main-column');
  const dropzone = document.getElementById('chat-dropzone-overlay');
  if (chatCol && dropzone) {
    let dragCounter = 0;
    chatCol.addEventListener('dragenter', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter++;
      dropzone.style.display = 'flex';
    });
    chatCol.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    chatCol.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        dropzone.style.display = 'none';
      }
    });
    chatCol.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter = 0;
      dropzone.style.display = 'none';

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;
      const file = files[0];

      if (file.type.startsWith('image/')) {
        const activeConv = sub.conversations.find((c) => c.id === sub.selectedConversationId);
        openWhatsAppPhotoEditor({
          imageFile: file,
          onSend: async (result) => {
            if (!activeConv) return;
            const replyId = sub.replyingTo?.id || null;
            const replySender = sub.replyingTo?.sender || '';
            const replyBody = sub.replyingTo?.body || '';
            const replyMediaUrl = sub.replyingTo?.media_url || '';
            const replyMediaType = sub.replyingTo?.media_type || 'none';
            sub.replyingTo = null;

            try {
              const res = await apiFetch<{ success: boolean; message?: OmnichannelMessage }>(
                `/api/inbox/conversations/${activeConv.id}/messages`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    body: result.caption || '',
                    sender: 'agent',
                    media_type: 'image',
                    media_url: result.dataUrl,
                    media_filename: result.filename,
                    media_mimetype: 'image/jpeg',
                    reply_to_id: replyId,
                    reply_to_sender: replySender,
                    reply_to_body: replyBody,
                    reply_to_media_url: replyMediaUrl,
                    reply_to_media_type: replyMediaType,
                  }),
                }
              );
              if (res?.message?.id) {
                sub.lastSentMessageId = res.message.id;
              }
              await refreshInbox();

              if (sub.lastSentMessageId) {
                const sentRow = document.querySelector(`.chat-msg-row[data-id="${sub.lastSentMessageId}"]`) as HTMLElement | null;
                if (sentRow) {
                  sentRow.scrollIntoView({ behavior: 'smooth', block: 'end' });
                  sentRow.classList.add('chat-msg-highlight-pulse');
                  setTimeout(() => {
                    sentRow.classList.remove('chat-msg-highlight-pulse');
                    if (sub.lastSentMessageId === res?.message?.id) {
                      sub.lastSentMessageId = null;
                    }
                  }, 2600);
                }
              }
            } catch (err) {
              showSystemToast('Error enviando imagen', (err as Error).message, 'danger');
            } finally {
              const inputAfter = document.getElementById('chat-composer-input') as HTMLTextAreaElement | null;
              inputAfter?.focus();
            }
          },
        });
        return;
      }

      try {
        const dataUrl = await readLocalFileAsDataUrl(file);
        sub.pendingAttachment = {
          media_type: detectMediaTypeFromMime(file.type),
          media_url: dataUrl,
          media_filename: file.name,
          media_mimetype: file.type || 'application/octet-stream',
        };
        rerender();
        const inputAfter = document.getElementById('chat-composer-input') as HTMLTextAreaElement | null;
        inputAfter?.focus();
      } catch (err) {
        showSystemToast('Error adjuntando archivo', (err as Error).message, 'danger');
      }
    });
  }

  // Envío de Campaña Masiva por WhatsApp Cloud API
  document.getElementById('btn-open-broadcast-modal')?.addEventListener('click', openBroadcastCampaignModal);

  // Apertura de Visor Multimedia Pantalla Completa (Fotos, Videos, Documentos)
  document.querySelectorAll('.js-open-media-lightbox').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const type = (el.getAttribute('data-media-type') || 'image') as 'image' | 'video' | 'document';
      const url = el.getAttribute('data-media-url') || '';
      const title = el.getAttribute('data-media-title') || 'Archivo adjunto';
      if (url) {
        openMediaLightboxModal({ mediaType: type, mediaUrl: url, mediaTitle: title });
      }
    });
  });

  // Gesto Táctil de Deslizar para Responder (Swipe to Reply) en Móvil y APK
  const messagesScroller = document.getElementById('chat-messages-scroller');
  if (messagesScroller) {
    bindSwipeToReplyEvents(messagesScroller, (item) => {
      sub.replyingTo = item;
      rerender();
      const composer = document.getElementById('chat-composer-input') as HTMLTextAreaElement | null;
      composer?.focus();
    });
  }

  // Banner de Permiso de Notificaciones en Tiempo Real
  document.getElementById('btn-request-notif-permission')?.addEventListener('click', async () => {
    if (typeof Notification !== 'undefined') {
      try {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          showSystemToast('Notificaciones activadas', 'Recibirás alertas en tiempo real de nuevos mensajes.', 'success');
          playNotificationSound();
        }
        rerender();
      } catch {
        // Ignorar
      }
    }
  });

  document.getElementById('btn-dismiss-notif-banner')?.addEventListener('click', () => {
    sessionStorage.setItem('nexus_dismiss_notif_banner', '1');
    const banner = document.getElementById('inbox-notification-banner');
    if (banner) banner.style.display = 'none';
  });

  // Botón para Iniciar Nuevo Chat / Añadir Contacto
  document.querySelectorAll('.js-opt-new-contact').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (pcDropdown) pcDropdown.style.display = 'none';
      if (mobileSheet) mobileSheet.style.display = 'none';
      openNewContactModal({ sub, apiFetch, refreshInbox, rerender });
    });
  });

  // Hidratar tarjetas de Link Preview para enlaces en mensajes
  hydrateLinkPreviews().catch(() => {});
}

export function bindTabConnectionsEvents(callbacks: {
  sub: OmnichannelSubState;
  apiFetch: <T = any>(url: string, options?: RequestInit) => Promise<T>;
  rerender: () => void;
}): void {
  const { sub, apiFetch, rerender } = callbacks;
  const conn = sub.connections || ({} as any);
  if (!conn) return;

  clearLiveTimers();

  if (conn.wa_active_mode === 'qr') {
    activeQrPollTimer = window.setInterval(async () => {
      if (!document.getElementById('wa-qr-live-panel')) {
        clearLiveTimers();
        return;
      }
      try {
        const res = await apiFetch<{ connections: ChannelConnections }>('/api/connections');
        const next = res.connections;
        const prevStatus = sub.connections?.wa_qr_status;
        const prevCode = sub.connections?.wa_qr_session_code;

        if (prevStatus !== 'connected' && next.wa_qr_status === 'connected') {
          sub.connections = next;
          showSystemToast(
            '¡WhatsApp Vinculado en Tiempo Real!',
            `Su dispositivo ${next.wa_qr_phone} se ha sincronizado exitosamente con el Servidor QR Interno.`,
            'success'
          );
          rerender();
          return;
        }

        if (next.wa_qr_status !== prevStatus || next.wa_qr_session_code !== prevCode) {
          sub.connections = next;
          const qrImg = document.getElementById('wa-real-qr-img') as HTMLImageElement | null;
          if (
            qrImg &&
            next.wa_qr_status === 'awaiting_scan' &&
            next.wa_qr_session_code?.startsWith('data:image/')
          ) {
            qrImg.src = next.wa_qr_session_code;
          } else {
            rerender();
          }
        }
      } catch {
        // Ignorar errores de red temporales en polling
      }
    }, 2200);
  }

  document.querySelectorAll('.js-select-wa-mode').forEach((card) => {
    card.addEventListener('click', async () => {
      const mode = card.getAttribute('data-mode') as 'qr' | 'api';
      if (!mode || conn.wa_active_mode === mode) return;
      try {
        const res = await apiFetch<{ connections: ChannelConnections }>('/api/connections', {
          method: 'PUT',
          body: JSON.stringify({ wa_active_mode: mode }),
        });
        sub.connections = res.connections;
        showSystemToast(
          mode === 'qr' ? 'Modo Servidor QR Activado' : 'Modo WhatsApp Cloud API Activado',
          mode === 'qr'
            ? 'WhatsApp operará mediante código QR interno (compatible con WhatsApp Normal y Business).'
            : 'WhatsApp operará mediante Cloud API oficial con soporte de Mensajes Masivos y Chatbot.',
          'info'
        );
        rerender();
      } catch (err) {
        showSystemToast('Error cambiando modalidad', (err as Error).message, 'danger');
      }
    });
  });

  document.getElementById('btn-wa-qr-generate')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    btn.disabled = true;
    try {
      const phone = (document.getElementById('conn-wa-qr-phone') as HTMLInputElement | null)?.value;
      const res = await apiFetch<{ connections: ChannelConnections }>('/api/connections/whatsapp-qr/action', {
        method: 'POST',
        body: JSON.stringify({ action: 'generate_qr', phone }),
      });
      sub.connections = res.connections;
      showSystemToast(
        'Nuevo Código QR Oficial Generado',
        'Abra WhatsApp o WhatsApp Business -> Dispositivos vinculados -> Vincular un dispositivo y escanee el código.',
        'info'
      );
      rerender();
    } catch (err) {
      showSystemToast('Error generando QR', (err as Error).message, 'danger');
      btn.disabled = false;
    }
  });

  document.getElementById('btn-wa-qr-disconnect')?.addEventListener('click', async () => {
    const ok = await showSystemConfirmModal({
      title: '¿Desvincular sesión QR de WhatsApp?',
      description: 'El servidor interno dejará de recibir mensajes hasta que vuelva a escanear un código QR.',
      confirmLabel: 'Sí, desvincular QR',
      danger: true,
    });
    if (!ok) return;

    try {
      const res = await apiFetch<{ connections: ChannelConnections }>('/api/connections/whatsapp-qr/action', {
        method: 'POST',
        body: JSON.stringify({ action: 'disconnect' }),
      });
      sub.connections = res.connections;
      showSystemToast('Sesión QR cerrada', 'El dispositivo fue desvinculado.', 'warning');
      rerender();
    } catch (err) {
      showSystemToast('Error al desconectar', (err as Error).message, 'danger');
    }
  });

  document.getElementById('btn-copy-webhook')?.addEventListener('click', (e) => {
    const url = (e.currentTarget as HTMLElement).getAttribute('data-url') || '';
    navigator.clipboard?.writeText(url).catch(() => {});
    showSystemToast('Webhook Copiado', `URL copiada al portapapeles: ${url}`, 'info');
  });

  // Verificación y Desconexión de Redes Sociales (Facebook, Instagram, TikTok)
  document.querySelector('.js-verify-fb-conn')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    btn.disabled = true;
    const token = (document.getElementById('conn-fb-token') as HTMLInputElement | null)?.value?.trim();
    const pageId = (document.getElementById('conn-fb-page-id') as HTMLInputElement | null)?.value?.trim();
    const pageName = (document.getElementById('conn-fb-page-name') as HTMLInputElement | null)?.value?.trim();

    try {
      const res = await apiFetch<{
        success: boolean;
        connections: ChannelConnections;
        pageName: string;
        pageId: string;
        syncedConversations: number;
        syncedMessages: number;
      }>('/api/connections/facebook/verify', {
        method: 'POST',
        body: JSON.stringify({ token, page_id: pageId, page_name: pageName }),
      });
      sub.connections = res.connections;
      showSystemToast(
        'Facebook Conectado y Verificado',
        `Página "${res.pageName}" vinculada exitosamente. Se sincronizaron ${res.syncedConversations} chats y ${res.syncedMessages} mensajes.`,
        'success'
      );
      rerender();
    } catch (err) {
      showSystemToast('Error al verificar Facebook', (err as Error).message, 'danger');
      btn.disabled = false;
    }
  });

  document.querySelector('.js-disconnect-fb-conn')?.addEventListener('click', async () => {
    try {
      const res = await apiFetch<{ connections: ChannelConnections }>('/api/connections/facebook/disconnect', {
        method: 'POST',
      });
      sub.connections = res.connections;
      showSystemToast('Facebook Desconectado', 'La Fan Page fue desvinculada de la bandeja.', 'info');
      rerender();
    } catch (err) {
      showSystemToast('Error al desconectar', (err as Error).message, 'danger');
    }
  });

  document.querySelector('.js-verify-ig-conn')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    btn.disabled = true;
    const username = (document.getElementById('conn-ig-username') as HTMLInputElement | null)?.value?.trim();
    const account_id = (document.getElementById('conn-ig-id') as HTMLInputElement | null)?.value?.trim();
    const token = (document.getElementById('conn-ig-token') as HTMLInputElement | null)?.value?.trim();

    try {
      const res = await apiFetch<{ success: boolean; connections: ChannelConnections }>('/api/connections/instagram/verify', {
        method: 'POST',
        body: JSON.stringify({ username, account_id, token }),
      });
      sub.connections = res.connections;
      showSystemToast('Instagram Conectado', 'Cuenta profesional de Instagram vinculada con éxito.', 'success');
      rerender();
    } catch (err) {
      showSystemToast('Error al verificar Instagram', (err as Error).message, 'danger');
      btn.disabled = false;
    }
  });

  document.querySelector('.js-disconnect-ig-conn')?.addEventListener('click', async () => {
    try {
      const res = await apiFetch<{ connections: ChannelConnections }>('/api/connections/instagram/disconnect', {
        method: 'POST',
      });
      sub.connections = res.connections;
      showSystemToast('Instagram Desconectado', 'La cuenta de Instagram fue desvinculada.', 'info');
      rerender();
    } catch (err) {
      showSystemToast('Error al desconectar', (err as Error).message, 'danger');
    }
  });

  document.querySelector('.js-verify-tt-conn')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    btn.disabled = true;
    const handle = (document.getElementById('conn-tt-handle') as HTMLInputElement | null)?.value?.trim();
    const client_key = (document.getElementById('conn-tt-key') as HTMLInputElement | null)?.value?.trim();
    const token = (document.getElementById('conn-tt-token') as HTMLInputElement | null)?.value?.trim();

    try {
      const res = await apiFetch<{ success: boolean; connections: ChannelConnections }>('/api/connections/tiktok/verify', {
        method: 'POST',
        body: JSON.stringify({ handle, client_key, token }),
      });
      sub.connections = res.connections;
      showSystemToast('TikTok Conectado', 'Perfil comercial de TikTok vinculado con éxito.', 'success');
      rerender();
    } catch (err) {
      showSystemToast('Error al verificar TikTok', (err as Error).message, 'danger');
      btn.disabled = false;
    }
  });

  document.querySelector('.js-disconnect-tt-conn')?.addEventListener('click', async () => {
    try {
      const res = await apiFetch<{ connections: ChannelConnections }>('/api/connections/tiktok/disconnect', {
        method: 'POST',
      });
      sub.connections = res.connections;
      showSystemToast('TikTok Desconectado', 'El perfil comercial de TikTok fue desvinculado.', 'info');
      rerender();
    } catch (err) {
      showSystemToast('Error al desconectar', (err as Error).message, 'danger');
    }
  });

  document.getElementById('btn-save-all-connections')?.addEventListener('click', async () => {
    const val = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value?.trim();
    const chk = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.checked;

    const payload: Partial<ChannelConnections> = {
      wa_qr_phone: val('conn-wa-qr-phone') ?? conn.wa_qr_phone,
      wa_qr_device: val('conn-wa-qr-device') ?? conn.wa_qr_device,
      wa_phone_number_id: val('conn-wa-phone-id') ?? conn.wa_phone_number_id,
      wa_business_account_id: val('conn-wa-waba-id') ?? conn.wa_business_account_id,
      wa_verify_token: val('conn-wa-verify-token') ?? conn.wa_verify_token,
      wa_access_token: val('conn-wa-access-token') ?? conn.wa_access_token,
      wa_mass_messaging_enabled: chk('conn-wa-mass-enabled') ?? conn.wa_mass_messaging_enabled,
      wa_chatbot_enabled: chk('conn-wa-chatbot-enabled') ?? conn.wa_chatbot_enabled,
      wa_chatbot_prompt:
        (document.getElementById('conn-wa-chatbot-prompt') as HTMLTextAreaElement | null)?.value?.trim() ??
        conn.wa_chatbot_prompt,

      fb_page_name: val('conn-fb-page-name') ?? conn.fb_page_name,
      fb_page_id: val('conn-fb-page-id') ?? conn.fb_page_id,
      fb_access_token: val('conn-fb-token') ?? conn.fb_access_token,
      fb_auto_sync: chk('conn-fb-sync') ?? conn.fb_auto_sync,

      ig_username: val('conn-ig-username') ?? conn.ig_username,
      ig_account_id: val('conn-ig-id') ?? conn.ig_account_id,
      ig_access_token: val('conn-ig-token') ?? conn.ig_access_token,
      ig_sync_stories: chk('conn-ig-stories') ?? conn.ig_sync_stories,

      tt_account_handle: val('conn-tt-handle') ?? conn.tt_account_handle,
      tt_client_key: val('conn-tt-key') ?? conn.tt_client_key,
      tt_access_token: val('conn-tt-token') ?? conn.tt_access_token,
      tt_sync_leads: chk('conn-tt-leads') ?? conn.tt_sync_leads,
    };

    try {
      const res = await apiFetch<{ connections: ChannelConnections }>('/api/connections', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      sub.connections = res.connections;
      showSystemToast(
        'Conexiones Omnicanal Guardadas',
        'Los parámetros de WhatsApp (QR / API), Facebook, Instagram y TikTok se han actualizado.',
        'success'
      );
      rerender();
    } catch (err) {
      showSystemToast('Error guardando conexiones', (err as Error).message, 'danger');
    }
  });
}
