import {
  OmnichannelSubState,
  renderOmnichannelInboxModuleHtml,
  bindOmnichannelInboxEvents,
  renderTabConnectionsHtml,
  bindTabConnectionsEvents,
} from './inbox-and-connections';
import {
  ChannelConnections,
  OmnichannelConversation,
  OmnichannelMessage,
  QuickReplyItem,
  CrmTagItem,
  ConversationNoteItem,
  UserItem,
} from './types';

const state: OmnichannelSubState = {
  connections: null,
  conversations: [],
  messages: [],
  quickReplies: [],
  tags: [],
  notes: [],
  users: [],
  selectedConversationId: null,
  channelFilter: 'all',
  tagFilter: '',
  searchQuery: '',
  sideDrawerTab: 'none',
  pendingAttachment: null,
  replyingTo: null,
  lastSentMessageId: null,
};

function getAuthToken(): string {
  try {
    const raw = localStorage.getItem('turbonetwork_session');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.token) return String(parsed.token);
    }
  } catch {}
  return '';
}

async function apiFetch<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const activeTenant = localStorage.getItem('turbonetwork_active_tenant') || '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (activeTenant) {
    headers['x-tenant-id'] = activeTenant;
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || 'Error de respuesta del servidor' };
  }

  if (!res.ok) {
    throw new Error(data.error || data.message || `Error HTTP ${res.status}`);
  }
  return data as T;
}

async function loadInboxAndConnections(): Promise<void> {
  const selectedConvId = state.selectedConversationId;
  const url = selectedConvId
    ? `/api/inbox?active_conv_id=${selectedConvId}&msg_limit=${state.messageLimit || 250}`
    : `/api/inbox`;

  const data = await apiFetch<{
    conversations: OmnichannelConversation[];
    messages: OmnichannelMessage[];
    connections: ChannelConnections;
    quickReplies?: QuickReplyItem[];
    tags?: CrmTagItem[];
    notes?: ConversationNoteItem[];
    users?: UserItem[];
  }>(url);

  state.conversations = data.conversations || [];
  state.messages = data.messages || [];
  state.connections = data.connections || null;
  state.quickReplies = data.quickReplies || [];
  state.tags = data.tags || [];
  state.notes = data.notes || [];
  state.users = data.users || [];

  if (
    !state.selectedConversationId &&
    state.conversations.length > 0 &&
    window.innerWidth > 768
  ) {
    state.selectedConversationId = state.conversations[0].id;
  }
}

function updateNavUnreadBadge(): void {
  const badge = document.getElementById('nav-messages-badge');
  if (!badge) return;
  const totalUnread = state.conversations.reduce(
    (acc, c) => acc + Number(c.unread_count || 0),
    0
  );
  if (totalUnread > 0) {
    badge.textContent = String(totalUnread);
    badge.classList.remove('hidden');
  } else {
    badge.textContent = '0';
    badge.classList.add('hidden');
  }
}

function syncMobileChatClasses(container: HTMLElement): void {
  container.classList.add('app-shell');
  const isMobile = window.innerWidth <= 768;
  const inChat = isMobile && state.selectedConversationId !== null;
  container.classList.toggle('mobile-in-chat', inChat);
  document.body.classList.toggle('mobile-chat-open', inChat);
}

let lastRenderedConversationId: number | null = null;

function renderInboxIntoContainer(): void {
  const container = document.getElementById('omnichannel-inbox-root');
  if (!container) return;

  syncMobileChatClasses(container);

  // Capturar posición de scroll previa para que un re-render (mensaje nuevo, envío, sync) no salte el chat
  const prevScroller = document.getElementById('chat-messages-scroller');
  const sameConversation =
    Boolean(prevScroller) && lastRenderedConversationId === state.selectedConversationId;
  const prevScrollTop = prevScroller?.scrollTop ?? 0;
  const wasNearBottom = prevScroller
    ? prevScroller.scrollHeight - prevScroller.scrollTop - prevScroller.clientHeight < 120
    : true;
  const prevSidebarScroll =
    (document.querySelector('.inbox-conversations-list') as HTMLElement | null)?.scrollTop ?? 0;

  const currency = (window as any).systemCurrencyCode || 'PEN';
  container.innerHTML = renderOmnichannelInboxModuleHtml(state, currency, true);
  updateNavUnreadBadge();

  bindOmnichannelInboxEvents({
    sub: state,
    apiFetch,
    refreshInbox: async () => {
      await loadInboxAndConnections();
      renderInboxIntoContainer();
    },
    goToConnectionsTab: () => {
      const w = window as any;
      if (typeof w.switchTab === 'function') {
        w.switchTab('settings');
      }
      if (typeof w.switchConfigSubTab === 'function') {
        w.switchConfigSubTab('connections');
      }
      setTimeout(() => {
        mountConnections();
      }, 60);
    },
    rerender: () => renderInboxIntoContainer(),
  });

  const nextScroller = document.getElementById('chat-messages-scroller');
  if (nextScroller) {
    const stickToBottom = !sameConversation || wasNearBottom;
    if (stickToBottom) {
      nextScroller.scrollTop = nextScroller.scrollHeight;
      // Fotos, stickers y videos cargan después y aumentan la altura: mantener el fondo mientras cargan
      const stickUntil = Date.now() + 4000;
      let sticking = true;
      const restick = () => {
        if (sticking && Date.now() < stickUntil) nextScroller.scrollTop = nextScroller.scrollHeight;
      };
      nextScroller.addEventListener('load', restick, true);
      nextScroller.addEventListener('loadedmetadata', restick, true);
      // Cancelar el anclaje si el usuario sube manualmente
      const cancelStick = () => {
        sticking = false;
      };
      nextScroller.addEventListener('wheel', cancelStick, { passive: true, once: true });
      nextScroller.addEventListener('touchmove', cancelStick, { passive: true, once: true });
    } else {
      nextScroller.scrollTop = prevScrollTop;
    }
  }
  const nextSidebar = document.querySelector('.inbox-conversations-list') as HTMLElement | null;
  if (nextSidebar && prevSidebarScroll > 0) nextSidebar.scrollTop = prevSidebarScroll;
  lastRenderedConversationId = state.selectedConversationId;
}

function renderConnectionsIntoContainer(): void {
  const container = document.getElementById('omnichannel-connections-root');
  if (!container) return;

  container.innerHTML = renderTabConnectionsHtml(state.connections, true);
  bindTabConnectionsEvents({
    sub: state,
    apiFetch,
    rerender: () => renderConnectionsIntoContainer(),
  });
}

let inboxLoadedOnce = false;

export async function mountInbox(forceReload = true): Promise<void> {
  const container = document.getElementById('omnichannel-inbox-root');
  if (!container) return;

  if (!inboxLoadedOnce) {
    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100%;min-height:320px;color:var(--text-muted,#94a3b8);font-size:13px;gap:10px;">
        <span>Cargando bandeja omnicanal...</span>
      </div>
    `;
  }

  try {
    if (forceReload || !inboxLoadedOnce) {
      await loadInboxAndConnections();
      inboxLoadedOnce = true;
    }
    renderInboxIntoContainer();
  } catch (err) {
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;min-height:320px;padding:24px;text-align:center;">
        <div class="pro-card" style="max-width:420px;width:100%;padding:24px;border-radius:16px;display:flex;flex-direction:column;align-items:center;gap:12px;">
          <p style="color:#ef4444;font-weight:600;font-size:15px;margin:0;">No se pudo cargar la bandeja de mensajes</p>
          <p style="color:var(--text-muted,#cbd5e1);font-size:12px;margin:0;line-height:1.5;">${(err as Error).message}</p>
          <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:4px;">
            <button type="button" class="btn btn-primary" onclick="window.TurboOmnichannel?.mountInbox(true)">Reintentar</button>
            <button type="button" class="btn btn-secondary" onclick="window.location.reload()">Recargar</button>
            <button type="button" class="btn btn-secondary" onclick="window.switchTab?.('dashboard')">Ir al Dashboard</button>
          </div>
        </div>
      </div>
    `;
  }
}

export async function mountConnections(forceReload = true): Promise<void> {
  const container = document.getElementById('omnichannel-connections-root');
  if (!container) return;

  try {
    if (forceReload || !state.connections) {
      const data = await apiFetch<{ connections: ChannelConnections }>('/api/connections');
      state.connections = data.connections;
    }
    renderConnectionsIntoContainer();
  } catch (err) {
    container.innerHTML = `
      <div class="pro-card" style="padding:18px;border-radius:14px;border:1px solid rgba(239,68,68,0.35);display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;">
        <div style="color:#ef4444;font-size:13px;">Error cargando conexiones omnicanal: ${(err as Error).message}</div>
        <button type="button" class="btn btn-primary btn-sm" onclick="window.TurboOmnichannel?.mountConnections(true)">Reintentar</button>
      </div>
    `;
  }
}

window.addEventListener('resize', () => {
  const container = document.getElementById('omnichannel-inbox-root');
  if (container && !document.getElementById('tab-messages')?.classList.contains('hidden')) {
    syncMobileChatClasses(container);
  } else {
    document.body.classList.remove('mobile-chat-open');
  }
});

(window as any).TurboOmnichannel = {
  mountInbox,
  mountConnections,
  getState: () => state,
};
