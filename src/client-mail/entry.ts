import { mailApi, getActiveTenantId, getMailAuthToken } from "./api";
import type {
  MailAccount,
  MailFolder,
  MailMessageSummary,
  MailMessageFull,
  MailAttachmentMeta,
} from "./types";

interface MailAppState {
  accounts: MailAccount[];
  folders: MailFolder[];
  messages: MailMessageSummary[];
  totalMessages: number;
  selectedAccountId: number | null; // null = Todas las cuentas
  selectedFolderRole: string; // inbox | starred | sent | drafts | spam | trash
  searchQuery: string;
  onlyUnread: boolean;
  selectedMessageId: number | null;
  detail: {
    message: MailMessageFull;
    attachments: MailAttachmentMeta[];
    thread: any[];
  } | null;
  showRemoteImages: boolean;
  loadingList: boolean;
  loadingDetail: boolean;
  syncing: boolean;
  drawerOpen: boolean;
  composerOpen: boolean;
  accountsModalOpen: boolean;
  editingAccountId: number | null;
  composerAttachments: Array<{ filename: string; contentBase64: string; contentType: string; size: number }>;
  replyToMessageId: number | null;
}

const state: MailAppState = {
  accounts: [],
  folders: [],
  messages: [],
  totalMessages: 0,
  selectedAccountId: null,
  selectedFolderRole: "inbox",
  searchQuery: "",
  onlyUnread: false,
  selectedMessageId: null,
  detail: null,
  showRemoteImages: false,
  loadingList: false,
  loadingDetail: false,
  syncing: false,
  drawerOpen: false,
  composerOpen: false,
  accountsModalOpen: false,
  editingAccountId: null,
  composerAttachments: [],
  replyToMessageId: null,
};

let rootEl: HTMLElement | null = null;
let sseSource: EventSource | null = null;
let lastTenantMounted = "";

function esc(val: any): string {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toast(msg: string, type: "success" | "error" | "info" = "info") {
  const fn = (window as any).showToast;
  if (typeof fn === "function") {
    fn(msg, type);
  } else {
    console.log(`[Mail ${type}]`, msg);
  }
}

function formatDateShort(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { day: "2-digit", month: "short" });
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getInitials(name?: string, email?: string): string {
  const src = (name || email || "?").trim();
  const parts = src.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

function getFolderUnreadCount(role: string): number {
  return state.folders
    .filter((f) => f.role === role && (!state.selectedAccountId || f.account_id === state.selectedAccountId))
    .reduce((acc, f) => acc + Number(f.unread_count || 0), 0);
}

function updateNavBadge() {
  const totalInboxUnread = state.folders
    .filter((f) => f.role === "inbox")
    .reduce((acc, f) => acc + Number(f.unread_count || 0), 0);
  const badge = document.getElementById("nav-mail-badge");
  if (badge) {
    if (totalInboxUnread > 0) {
      badge.textContent = totalInboxUnread > 99 ? "99+" : String(totalInboxUnread);
      badge.className =
        "sidebar-text ml-auto px-1.5 py-0.5 rounded-md text-[9.5px] font-mono font-bold bg-blue-600 text-white";
    } else {
      badge.textContent = String(state.accounts.length || 0);
      badge.className =
        "sidebar-text ml-auto px-1.5 py-0.5 rounded-md text-[9.5px] font-mono font-semibold bg-slate-200/60 dark:bg-white/5 text-slate-500 dark:text-slate-400";
    }
  }
}

async function loadAccountsAndFolders() {
  const [accRes, fldRes] = await Promise.all([
    mailApi<{ accounts: MailAccount[] }>("/api/mail/accounts"),
    mailApi<{ folders: MailFolder[] }>("/api/mail/folders"),
  ]);
  state.accounts = accRes.accounts || [];
  state.folders = fldRes.folders || [];
  updateNavBadge();
}

async function loadMessages() {
  state.loadingList = true;
  render();
  try {
    const params = new URLSearchParams();
    if (state.selectedAccountId) params.set("accountId", String(state.selectedAccountId));
    if (state.selectedFolderRole === "starred") {
      params.set("starred", "1");
    } else {
      params.set("folder", state.selectedFolderRole);
    }
    if (state.onlyUnread) params.set("unread", "1");
    if (state.searchQuery.trim()) params.set("q", state.searchQuery.trim());
    params.set("limit", "50");

    const res = await mailApi<{ items: MailMessageSummary[]; total: number }>(
      `/api/mail/messages?${params.toString()}`
    );
    state.messages = res.items || [];
    state.totalMessages = res.total || 0;
  } catch (err: any) {
    toast(err?.message || "Error cargando correos", "error");
  } finally {
    state.loadingList = false;
    render();
  }
}

async function openMessage(id: number) {
  state.selectedMessageId = id;
  state.loadingDetail = true;
  state.showRemoteImages = false;
  render();

  try {
    const detail = await mailApi<{
      message: MailMessageFull;
      attachments: MailAttachmentMeta[];
      thread: any[];
    }>(`/api/mail/messages/${id}`);
    state.detail = detail;

    if (!detail.message.is_read) {
      await mailApi(`/api/mail/messages/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isRead: true }),
      }).catch(() => {});
      const item = state.messages.find((m) => m.id === id);
      if (item) item.is_read = true;
      detail.message.is_read = true;
      loadAccountsAndFolders().then(() => render()).catch(() => {});
    }
  } catch (err: any) {
    toast(err?.message || "No se pudo abrir el correo", "error");
  } finally {
    state.loadingDetail = false;
    render();
  }
}

async function toggleStar(id: number, current: boolean, ev?: Event) {
  ev?.stopPropagation();
  try {
    await mailApi(`/api/mail/messages/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ isStarred: !current }),
    });
    const item = state.messages.find((m) => m.id === id);
    if (item) item.is_starred = !current;
    if (state.detail?.message.id === id) state.detail.message.is_starred = !current;
    render();
  } catch (err: any) {
    toast(err?.message || "Error actualizando destacado", "error");
  }
}

async function moveMessage(id: number, moveToRole: string) {
  try {
    await mailApi(`/api/mail/messages/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ moveToRole }),
    });
    toast(
      moveToRole === "spam"
        ? "Movido a Spam"
        : moveToRole === "trash"
          ? "Movido a Papelera"
          : "Movido a Recibidos",
      "success"
    );
    if (state.selectedMessageId === id) {
      state.selectedMessageId = null;
      state.detail = null;
    }
    await Promise.all([loadAccountsAndFolders(), loadMessages()]);
  } catch (err: any) {
    toast(err?.message || "No se pudo mover el correo", "error");
  }
}

async function deleteMessage(id: number, permanent = false) {
  try {
    await mailApi(`/api/mail/messages/${id}${permanent ? "?permanent=1" : ""}`, {
      method: "DELETE",
    });
    toast(permanent ? "Correo eliminado definitivamente" : "Correo enviado a la papelera", "success");
    if (state.selectedMessageId === id) {
      state.selectedMessageId = null;
      state.detail = null;
    }
    await Promise.all([loadAccountsAndFolders(), loadMessages()]);
  } catch (err: any) {
    toast(err?.message || "Error eliminando correo", "error");
  }
}

async function syncAllNow() {
  if (state.syncing || state.accounts.length === 0) return;
  state.syncing = true;
  render();
  try {
    const targets = state.selectedAccountId
      ? state.accounts.filter((a) => a.id === state.selectedAccountId)
      : state.accounts;
    let totalNew = 0;
    for (const acc of targets) {
      const r = await mailApi<{ syncedMessages: number }>(`/api/mail/accounts/${acc.id}/sync`, {
        method: "POST",
        body: "{}",
      });
      totalNew += Number(r.syncedMessages || 0);
    }
    await Promise.all([loadAccountsAndFolders(), loadMessages()]);
    toast(totalNew > 0 ? `${totalNew} correo(s) sincronizados` : "Bandeja actualizada", "success");
  } catch (err: any) {
    toast(err?.message || "Error al sincronizar", "error");
  } finally {
    state.syncing = false;
    render();
  }
}

function connectSse() {
  if (sseSource) {
    sseSource.close();
    sseSource = null;
  }
  const token = getMailAuthToken();
  const tenant = getActiveTenantId();
  if (!token) return;

  const url = `/api/mail/events?token=${encodeURIComponent(token)}${tenant ? `&tenantId=${encodeURIComponent(tenant)}` : ""}`;
  try {
    sseSource = new EventSource(url);
    sseSource.addEventListener("mail", () => {
      loadAccountsAndFolders()
        .then(() => loadMessages())
        .catch(() => {});
    });
  } catch {}
}

function openComposer(opts?: {
  accountId?: number;
  to?: string;
  cc?: string;
  subject?: string;
  htmlBody?: string;
  replyToMessageId?: number;
  isReply?: boolean;
}) {
  if (state.accounts.length === 0) {
    toast("Primero conecta una cuenta de correo.", "info");
    state.accountsModalOpen = true;
    state.editingAccountId = null;
    render();
    return;
  }
  state.composerOpen = true;
  state.composerAttachments = [];
  state.replyToMessageId = opts?.replyToMessageId || null;
  render();

  setTimeout(() => {
    const accSel = document.getElementById("mail-comp-account") as HTMLSelectElement | null;
    const toInput = document.getElementById("mail-comp-to") as HTMLInputElement | null;
    const ccInput = document.getElementById("mail-comp-cc") as HTMLInputElement | null;
    const subjInput = document.getElementById("mail-comp-subject") as HTMLInputElement | null;
    const editor = document.getElementById("mail-comp-editor") as HTMLElement | null;

    const chosenAccId = opts?.accountId || state.selectedAccountId || state.accounts[0]?.id;
    if (accSel && chosenAccId) accSel.value = String(chosenAccId);
    if (toInput) toInput.value = opts?.to || "";
    if (ccInput) ccInput.value = opts?.cc || "";
    if (subjInput) subjInput.value = opts?.subject || "";

    const acc = state.accounts.find((a) => a.id === Number(chosenAccId));
    let initialHtml = opts?.htmlBody || "";
    if (acc && acc.signatureHtml) {
      const shouldInclude = opts?.isReply ? acc.signatureDefaultReply : acc.signatureDefaultNew;
      if (shouldInclude) {
        initialHtml = `${initialHtml ? initialHtml + "<br>" : "<p><br></p>"}<div class="tn-mail-signature-preview" style="border-top:1px solid #e2e8f0;padding-top:8px;margin-top:12px;">${acc.signatureHtml}</div>`;
      }
    }
    if (editor) editor.innerHTML = initialHtml;
    (opts?.to ? editor : toInput)?.focus();
  }, 30);
}

function renderFolderItem(role: string, label: string, iconSvg: string) {
  const active = state.selectedFolderRole === role;
  const unread = role === "inbox" || role === "spam" || role === "drafts" ? getFolderUnreadCount(role) : 0;
  return `
    <button type="button" data-mail-folder="${role}"
      class="mail-folder-btn w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition ${
        active ? "active shadow-sm" : ""
      }">
      <span class="w-4 h-4 shrink-0">${iconSvg}</span>
      <span class="truncate">${label}</span>
      ${
        unread > 0
          ? `<span class="ml-auto px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
              active ? "bg-white/20 text-white" : "bg-blue-500/15 text-blue-600 dark:text-blue-400"
            }">${unread}</span>`
          : ""
      }
    </button>
  `;
}

function renderSidebar(): string {
  return `
    <aside class="mail-sidebar p-3 gap-3">
      <div class="flex items-center gap-2">
        <button type="button" id="mail-btn-compose"
          class="mail-btn-primary flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
          Redactar
        </button>
        <button type="button" id="mail-btn-drawer-close" class="lg:hidden p-2 rounded-xl mail-btn-subtle" title="Cerrar menú">✕</button>
      </div>

      <div class="space-y-1">
        <div class="px-2 text-[10px] font-bold uppercase tracking-wider mail-text-muted">Carpetas</div>
        ${renderFolderItem("inbox", "Recibidos", '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/></svg>')}
        ${renderFolderItem("starred", "Destacados", '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>')}
        ${renderFolderItem("sent", "Enviados", '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>')}
        ${renderFolderItem("drafts", "Borradores", '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>')}
        ${renderFolderItem("spam", "Spam", '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>')}
        ${renderFolderItem("trash", "Papelera", '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>')}
      </div>

      <div class="pt-2 border-t mail-divider space-y-1 flex-1 min-h-0 overflow-y-auto">
        <div class="px-2 flex items-center justify-between">
          <span class="text-[10px] font-bold uppercase tracking-wider mail-text-muted">Cuentas del Tenant</span>
          <button type="button" id="mail-btn-manage-accounts" class="text-[11px] font-semibold text-blue-500 hover:underline">
            + Gestionar
          </button>
        </div>

        <button type="button" data-mail-account="all"
          class="mail-account-btn w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-[12.5px] font-medium transition ${
            state.selectedAccountId === null ? "active" : ""
          }">
          <span class="w-2.5 h-2.5 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500"></span>
          <span class="truncate">Todas las cuentas</span>
        </button>

        ${state.accounts
          .map(
            (a) => `
          <button type="button" data-mail-account="${a.id}"
            class="mail-account-btn w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-[12px] transition ${
              state.selectedAccountId === a.id ? "active" : ""
            }">
            <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background:${esc(a.color)}"></span>
            <span class="truncate flex-1 text-left">${esc(a.displayName || a.email)}</span>
            ${
              a.status === "error"
                ? `<span class="text-[10px] text-rose-500" title="${esc(a.lastError)}">⚠</span>`
                : Number(a.unreadCount || 0) > 0
                  ? `<span class="text-[10px] font-mono mail-text-muted">${a.unreadCount}</span>`
                  : ""
            }
          </button>
        `
          )
          .join("")}
      </div>

      <div class="pt-2 border-t mail-divider">
        <button type="button" id="mail-btn-open-settings"
          class="mail-folder-btn w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3"/></svg>
          Cuentas y Firmas
        </button>
      </div>
    </aside>
  `;
}

function renderMessageList(): string {
  const folderLabels: Record<string, string> = {
    inbox: "Recibidos",
    starred: "Destacados",
    sent: "Enviados",
    drafts: "Borradores",
    spam: "Spam",
    trash: "Papelera",
  };

  return `
    <div class="mail-list-pane">
      <div class="p-3 mail-pane-header space-y-2.5">
        <div class="flex items-center gap-2">
          <button type="button" id="mail-btn-drawer-open" class="lg:hidden p-2 rounded-xl mail-btn-subtle">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
          </button>
          <h3 class="text-sm font-bold mail-title flex-1 truncate">
            ${folderLabels[state.selectedFolderRole] || "Correos"}
            <span class="ml-1 text-xs font-normal mail-text-muted">(${state.totalMessages})</span>
          </h3>
          <button type="button" id="mail-btn-sync" title="Sincronizar ahora"
            class="p-2 rounded-xl mail-text-muted hover:opacity-80 transition ${state.syncing ? "animate-spin text-blue-500" : ""}">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          </button>
        </div>

        <div class="flex items-center gap-1.5">
          <div class="relative flex-1">
            <input type="search" id="mail-search-input" value="${esc(state.searchQuery)}" placeholder="Buscar asunto, remitente..."
              class="mail-input w-full pl-8 pr-3 py-1.5 rounded-xl text-xs" />
            <svg class="w-3.5 h-3.5 mail-text-muted absolute left-2.5 top-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          </div>
          <button type="button" id="mail-btn-unread-filter"
            class="px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition ${
              state.onlyUnread
                ? "mail-btn-primary"
                : "mail-btn-subtle"
            }">
            No leídos
          </button>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto">
        ${
          state.accounts.length === 0
            ? `<div class="p-8 text-center space-y-3">
                 <div class="w-12 h-12 mx-auto rounded-2xl bg-blue-500/15 text-blue-500 flex items-center justify-center">
                   <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                 </div>
                 <p class="text-sm font-semibold mail-title">Sin cuentas conectadas</p>
                 <p class="text-xs mail-text-muted">Conecta Gmail, Outlook o tu correo corporativo IMAP/SMTP en este tenant.</p>
                 <button type="button" id="mail-empty-connect" class="mail-btn-primary px-4 py-2 rounded-xl text-xs font-semibold shadow-sm">Conectar correo</button>
               </div>`
            : state.loadingList && state.messages.length === 0
              ? `<div class="p-8 text-center text-xs mail-text-muted">Cargando correos...</div>`
              : state.messages.length === 0
                ? `<div class="p-8 text-center text-xs mail-text-muted">No hay correos en esta carpeta.</div>`
                : state.messages
                    .map((m) => {
                      const active = state.selectedMessageId === m.id;
                      const sender = m.from_name || m.from_email || "(desconocido)";
                      return `
                        <div data-mail-open="${m.id}"
                          class="mail-msg-row p-3 cursor-pointer transition flex gap-2.5 items-start ${
                            active ? "active" : ""
                          }">
                          <div class="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold text-white"
                            style="background:${esc(m.account_color || "#3b82f6")}">
                            ${esc(getInitials(m.from_name, m.from_email))}
                          </div>
                          <div class="flex-1 min-w-0">
                            <div class="flex items-center justify-between gap-1">
                              <span class="text-[12.5px] truncate ${
                                !m.is_read ? "font-bold mail-title" : "font-medium mail-text-sec"
                              }">${esc(sender)}</span>
                              <span class="text-[10.5px] mail-text-muted shrink-0">${formatDateShort(m.date)}</span>
                            </div>
                            <div class="flex items-center gap-1.5 mt-0.5">
                              ${!m.is_read ? `<span class="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>` : ""}
                              <p class="text-xs truncate ${
                                !m.is_read ? "font-semibold mail-title" : "mail-text-sec"
                              }">${esc(m.subject)}</p>
                            </div>
                            <p class="text-[11px] mail-text-muted truncate mt-0.5">${esc(m.snippet)}</p>
                            <div class="flex items-center justify-between mt-1">
                              <span class="text-[10px] mail-text-muted truncate">${esc(m.account_email)}</span>
                              <div class="flex items-center gap-1.5">
                                ${m.has_attachments ? `<span class="text-[11px] mail-text-muted" title="Tiene adjuntos">📎</span>` : ""}
                                <button type="button" data-mail-star="${m.id}" data-starred="${m.is_starred ? "1" : "0"}"
                                  class="text-sm leading-none ${m.is_starred ? "text-amber-400" : "mail-text-muted hover:text-amber-400"}">★</button>
                              </div>
                            </div>
                          </div>
                        </div>
                      `;
                    })
                    .join("")
        }
      </div>
    </div>
  `;
}

function renderReader(): string {
  if (!state.selectedMessageId) {
    return `
      <div class="mail-reader-pane items-center justify-center text-center p-8">
        <div class="max-w-xs space-y-2 mail-text-muted">
          <svg class="w-12 h-12 mx-auto opacity-60" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
          <p class="text-sm font-semibold mail-title">Selecciona un correo para leerlo</p>
          <p class="text-xs mail-text-muted">Puedes responder, reenviar, marcar como spam o gestionar firmas por cada cuenta.</p>
        </div>
      </div>
    `;
  }

  if (state.loadingDetail || !state.detail) {
    return `<div class="mail-reader-pane items-center justify-center text-xs mail-text-muted">Cargando mensaje...</div>`;
  }

  const m = state.detail.message;
  const atts = state.detail.attachments || [];
  let htmlBody = m.body_html_sanitized || `<pre class="whitespace-pre-wrap font-sans">${esc(m.body_text)}</pre>`;
  if (state.showRemoteImages) {
    htmlBody = htmlBody.replace(/data-blocked-src=(["'])([^"']+)\1\s+src=(["'])[^"']+\3/gi, 'src="$2"');
  }

  const toText = (m.to_list || []).map((t) => (t.name ? `${t.name} <${t.address}>` : t.address)).join(", ");

  return `
    <div class="mail-reader-pane">
      <div class="p-3 border-b border-slate-200/80 dark:border-white/10 flex flex-wrap items-center gap-2">
        <button type="button" id="mail-mobile-back" class="md:hidden px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-white/10 text-xs font-semibold">← Volver</button>
        <button type="button" id="mail-btn-reply" class="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold">Responder</button>
        <button type="button" id="mail-btn-reply-all" class="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-medium hover:bg-slate-200 dark:hover:bg-white/15">Responder a todos</button>
        <button type="button" id="mail-btn-forward" class="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-medium hover:bg-slate-200 dark:hover:bg-white/15">Reenviar</button>
        <div class="ml-auto flex items-center gap-1.5">
          <button type="button" id="mail-btn-toggle-unread" class="px-2.5 py-1.5 rounded-xl text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10" title="Marcar no leído">No leído</button>
          ${
            m.folder_role !== "spam"
              ? `<button type="button" id="mail-btn-spam" class="px-2.5 py-1.5 rounded-xl text-xs text-amber-600 hover:bg-amber-500/10">Spam</button>`
              : `<button type="button" id="mail-btn-not-spam" class="px-2.5 py-1.5 rounded-xl text-xs text-emerald-600 hover:bg-emerald-500/10">No es spam</button>`
          }
          <button type="button" id="mail-btn-delete" class="px-2.5 py-1.5 rounded-xl text-xs text-rose-600 hover:bg-rose-500/10">
            ${m.folder_role === "trash" ? "Eliminar definitivo" : "Papelera"}
          </button>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        <div>
          <h2 class="text-lg font-bold text-slate-900 dark:text-white">${esc(m.subject)}</h2>
          <div class="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <div>
              <span class="font-semibold text-slate-800 dark:text-slate-200">${esc(m.from_name || m.from_email)}</span>
              ${m.from_name ? `<span class="ml-1">&lt;${esc(m.from_email)}&gt;</span>` : ""}
              <div class="text-[11px] mt-0.5">Para: ${esc(toText || m.account_email)}</div>
            </div>
            <div class="text-right">
              <div>${new Date(m.date).toLocaleString()}</div>
              <div class="text-[10.5px] text-slate-400">Cuenta: ${esc(m.account_email)}</div>
            </div>
          </div>
        </div>

        ${
          m.has_remote_images && !state.showRemoteImages
            ? `<div class="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between gap-2 text-xs text-amber-700 dark:text-amber-300">
                 <span>Se bloquearon imágenes externas por privacidad.</span>
                 <button type="button" id="mail-btn-show-images" class="px-2.5 py-1 rounded-lg bg-amber-500 text-white font-semibold">Mostrar imágenes</button>
               </div>`
            : ""
        }

        <div class="mail-html-body">${htmlBody}</div>

        ${
          atts.length > 0
            ? `<div class="space-y-2">
                 <div class="text-xs font-bold text-slate-600 dark:text-slate-300">Adjuntos (${atts.length})</div>
                 <div class="flex flex-wrap gap-2">
                   ${atts
                     .map(
                       (a) => `
                     <a href="/api/mail/messages/${m.id}/attachments/${a.id}?token=${encodeURIComponent(getMailAuthToken())}"
                       target="_blank"
                       class="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs hover:border-blue-500 transition">
                       <span>📎</span>
                       <span class="font-medium truncate max-w-[180px]">${esc(a.filename)}</span>
                       <span class="text-slate-400">(${formatBytes(a.size_bytes)})</span>
                     </a>
                   `
                     )
                     .join("")}
                 </div>
               </div>`
            : ""
        }
      </div>
    </div>
  `;
}

function renderComposerModal(): string {
  if (!state.composerOpen) return "";
  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3">
      <div class="w-full max-w-2xl rounded-2xl mail-modal-card shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <div class="px-4 py-3 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
          <h3 class="text-sm font-bold text-slate-900 dark:text-white">Nuevo Correo</h3>
          <button type="button" id="mail-comp-close" class="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white">✕</button>
        </div>
        <div class="p-4 space-y-2.5 overflow-y-auto flex-1">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label class="text-[11px] font-semibold text-slate-500">De (Cuenta)</label>
              <select id="mail-comp-account" class="w-full mt-0.5 px-3 py-1.5 rounded-xl text-xs bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                ${state.accounts.map((a) => `<option value="${a.id}">${esc(a.displayName || a.email)} (${esc(a.email)})</option>`).join("")}
              </select>
            </div>
            <div>
              <label class="text-[11px] font-semibold text-slate-500">CC (opcional)</label>
              <input id="mail-comp-cc" type="text" placeholder="cc1@dominio.com, cc2@..." class="w-full mt-0.5 px-3 py-1.5 rounded-xl text-xs bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10" />
            </div>
          </div>
          <div>
            <label class="text-[11px] font-semibold text-slate-500">Para</label>
            <input id="mail-comp-to" type="text" placeholder="destinatario@dominio.com" class="w-full mt-0.5 px-3 py-1.5 rounded-xl text-xs bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10" />
          </div>
          <div>
            <label class="text-[11px] font-semibold text-slate-500">Asunto</label>
            <input id="mail-comp-subject" type="text" placeholder="Asunto del correo" class="w-full mt-0.5 px-3 py-1.5 rounded-xl text-xs bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10" />
          </div>

          <div class="rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
            <div class="px-2 py-1.5 bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 flex flex-wrap gap-1">
              <button type="button" data-cmd="bold" class="px-2 py-1 rounded text-xs font-bold hover:bg-slate-200 dark:hover:bg-white/10">B</button>
              <button type="button" data-cmd="italic" class="px-2 py-1 rounded text-xs italic hover:bg-slate-200 dark:hover:bg-white/10">I</button>
              <button type="button" data-cmd="underline" class="px-2 py-1 rounded text-xs underline hover:bg-slate-200 dark:hover:bg-white/10">U</button>
              <button type="button" data-cmd="insertUnorderedList" class="px-2 py-1 rounded text-xs hover:bg-slate-200 dark:hover:bg-white/10">• Lista</button>
              <button type="button" id="mail-comp-link" class="px-2 py-1 rounded text-xs hover:bg-slate-200 dark:hover:bg-white/10">🔗 Enlace</button>
            </div>
            <div id="mail-comp-editor" contenteditable="true" data-placeholder="Escribe tu mensaje aquí..." class="mail-editor-area bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"></div>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <label class="cursor-pointer px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/10 text-xs font-medium hover:bg-slate-200 dark:hover:bg-white/15">
              📎 Adjuntar archivos
              <input type="file" id="mail-comp-files" multiple class="hidden" />
            </label>
            ${state.composerAttachments
              .map(
                (a, i) => `
              <span class="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[11px] flex items-center gap-1.5">
                ${esc(a.filename)} (${formatBytes(a.size)})
                <button type="button" data-rm-att="${i}" class="font-bold">×</button>
              </span>
            `
              )
              .join("")}
          </div>
        </div>
        <div class="px-4 py-3 border-t border-slate-200 dark:border-white/10 flex items-center justify-end gap-2">
          <button type="button" id="mail-comp-cancel" class="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10">Cancelar</button>
          <button type="button" id="mail-comp-send" class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm">Enviar correo</button>
        </div>
      </div>
    </div>
  `;
}

function renderAccountsModal(): string {
  if (!state.accountsModalOpen) return "";
  const editing = state.editingAccountId
    ? state.accounts.find((a) => a.id === state.editingAccountId) || null
    : null;

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3">
      <div class="w-full max-w-3xl rounded-2xl mail-modal-card shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <div class="px-5 py-3.5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
          <h3 class="text-sm font-bold text-slate-900 dark:text-white">Cuentas de Correo y Firmas del Tenant</h3>
          <button type="button" id="mail-acc-close" class="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white">✕</button>
        </div>

        <div class="p-5 overflow-y-auto space-y-5">
          ${
            state.accounts.length > 0
              ? `<div class="space-y-2">
                   <div class="flex items-center justify-between">
                     <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Cuentas Conectadas</span>
                     <button type="button" id="mail-acc-new" class="text-xs font-semibold text-blue-600 hover:underline">+ Conectar otra cuenta</button>
                   </div>
                   <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                     ${state.accounts
                       .map(
                         (a) => `
                       <div class="p-3 rounded-xl border border-slate-200 dark:border-white/10 flex items-center justify-between gap-2">
                         <div class="min-w-0">
                           <div class="flex items-center gap-1.5">
                             <span class="w-2.5 h-2.5 rounded-full" style="background:${esc(a.color)}"></span>
                             <span class="text-xs font-bold truncate">${esc(a.displayName || a.email)}</span>
                           </div>
                           <div class="text-[11px] text-slate-400 truncate">${esc(a.email)}</div>
                         </div>
                         <div class="flex items-center gap-1 shrink-0">
                           <button type="button" data-acc-edit="${a.id}" class="px-2 py-1 rounded-lg bg-slate-100 dark:bg-white/10 text-[11px] font-medium">Editar / Firma</button>
                           <button type="button" data-acc-del="${a.id}" class="px-2 py-1 rounded-lg text-rose-600 hover:bg-rose-500/10 text-[11px]">Eliminar</button>
                         </div>
                       </div>
                     `
                       )
                       .join("")}
                   </div>
                 </div>`
              : ""
          }

          <form id="mail-acc-form" class="space-y-3 pt-3 border-t border-slate-200 dark:border-white/10">
            <div class="text-xs font-bold text-slate-800 dark:text-white">
              ${editing ? `Editando: ${esc(editing.email)}` : "Conectar Nueva Cuenta (IMAP / SMTP)"}
            </div>
            <div id="mail-acc-hint" class="text-[11px] text-blue-600 dark:text-blue-400 hidden"></div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label class="text-[11px] font-semibold text-slate-500">Correo electrónico</label>
                <input id="mail-f-email" type="email" required value="${esc(editing?.email || "")}" ${editing ? "readonly" : ""}
                  placeholder="soporte@tuempresa.com" class="w-full mt-0.5 px-3 py-1.5 rounded-xl text-xs bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10" />
              </div>
              <div>
                <label class="text-[11px] font-semibold text-slate-500">Nombre visible</label>
                <input id="mail-f-name" type="text" value="${esc(editing?.displayName || "")}" placeholder="Soporte TurboNetwork"
                  class="w-full mt-0.5 px-3 py-1.5 rounded-xl text-xs bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10" />
              </div>
              <div>
                <label class="text-[11px] font-semibold text-slate-500">Color identificador</label>
                <input id="mail-f-color" type="color" value="${esc(editing?.color || "#3b82f6")}" class="w-full h-8 mt-0.5 rounded-xl bg-transparent cursor-pointer" />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label class="text-[11px] font-semibold text-slate-500">Usuario IMAP/SMTP</label>
                <input id="mail-f-user" type="text" value="${esc(editing?.username || "")}" placeholder="soporte@tuempresa.com"
                  class="w-full mt-0.5 px-3 py-1.5 rounded-xl text-xs bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10" />
              </div>
              <div>
                <label class="text-[11px] font-semibold text-slate-500">Contraseña ${editing ? "(dejar vacío para mantener)" : "/ App Password"}</label>
                <input id="mail-f-pass" type="password" ${editing ? "" : "required"} placeholder="••••••••••••"
                  class="w-full mt-0.5 px-3 py-1.5 rounded-xl text-xs bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10" />
              </div>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div class="col-span-2 sm:col-span-1">
                <label class="text-[11px] font-semibold text-slate-500">Servidor IMAP</label>
                <input id="mail-f-imap-host" type="text" required value="${esc(editing?.imapHost || "")}" placeholder="imap.gmail.com"
                  class="w-full mt-0.5 px-3 py-1.5 rounded-xl text-xs bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10" />
              </div>
              <div>
                <label class="text-[11px] font-semibold text-slate-500">Puerto IMAP</label>
                <input id="mail-f-imap-port" type="number" required value="${editing?.imapPort || 993}"
                  class="w-full mt-0.5 px-3 py-1.5 rounded-xl text-xs bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10" />
              </div>
              <div class="col-span-2 sm:col-span-1">
                <label class="text-[11px] font-semibold text-slate-500">Servidor SMTP</label>
                <input id="mail-f-smtp-host" type="text" required value="${esc(editing?.smtpHost || "")}" placeholder="smtp.gmail.com"
                  class="w-full mt-0.5 px-3 py-1.5 rounded-xl text-xs bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10" />
              </div>
              <div>
                <label class="text-[11px] font-semibold text-slate-500">Puerto SMTP</label>
                <input id="mail-f-smtp-port" type="number" required value="${editing?.smtpPort || 465}"
                  class="w-full mt-0.5 px-3 py-1.5 rounded-xl text-xs bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10" />
              </div>
            </div>

            <div class="flex flex-wrap gap-4 text-xs">
              <label class="flex items-center gap-1.5"><input id="mail-f-imap-ssl" type="checkbox" ${editing ? (editing.imapSecure ? "checked" : "") : "checked"} /> IMAP SSL/TLS</label>
              <label class="flex items-center gap-1.5"><input id="mail-f-smtp-ssl" type="checkbox" ${editing ? (editing.smtpSecure ? "checked" : "") : "checked"} /> SMTP SSL/TLS (465)</label>
            </div>

            <div class="space-y-1.5 pt-2 border-t border-slate-200 dark:border-white/10">
              <label class="text-[11px] font-semibold text-slate-500">Firma de correo (HTML)</label>
              <textarea id="mail-f-sig" rows="3" placeholder="<p><strong>Equipo Soporte</strong><br>TurboNetwork ISP</p>"
                class="w-full px-3 py-2 rounded-xl text-xs font-mono bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">${esc(editing?.signatureHtml || "")}</textarea>
              <div class="flex flex-wrap gap-4 text-xs">
                <label class="flex items-center gap-1.5"><input id="mail-f-sig-new" type="checkbox" ${editing ? (editing.signatureDefaultNew ? "checked" : "") : "checked"} /> Incluir firma en correos nuevos</label>
                <label class="flex items-center gap-1.5"><input id="mail-f-sig-reply" type="checkbox" ${editing ? (editing.signatureDefaultReply ? "checked" : "") : "checked"} /> Incluir firma en respuestas</label>
              </div>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-2 pt-2">
              <button type="button" id="mail-acc-test" class="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-white/10 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-white/15">Probar conexión</button>
              <button type="submit" class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold">${editing ? "Guardar cambios" : "Conectar y Guardar"}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
}

function bindEvents() {
  if (!rootEl) return;

  rootEl.querySelectorAll<HTMLElement>("[data-mail-folder]").forEach((btn) => {
    btn.onclick = () => {
      state.selectedFolderRole = btn.dataset.mailFolder || "inbox";
      state.selectedMessageId = null;
      state.detail = null;
      state.drawerOpen = false;
      loadMessages();
    };
  });

  rootEl.querySelectorAll<HTMLElement>("[data-mail-account]").forEach((btn) => {
    btn.onclick = () => {
      const val = btn.dataset.mailAccount;
      state.selectedAccountId = val === "all" ? null : Number(val);
      state.selectedMessageId = null;
      state.detail = null;
      state.drawerOpen = false;
      loadMessages();
    };
  });

  rootEl.querySelectorAll<HTMLElement>("[data-mail-open]").forEach((el) => {
    el.onclick = () => openMessage(Number(el.dataset.mailOpen));
  });

  rootEl.querySelectorAll<HTMLElement>("[data-mail-star]").forEach((btn) => {
    btn.onclick = (e) => toggleStar(Number(btn.dataset.mailStar), btn.dataset.starred === "1", e);
  });

  const bindClick = (id: string, fn: () => void) => {
    const el = document.getElementById(id);
    if (el) el.onclick = fn;
  };

  bindClick("mail-btn-compose", () => openComposer());
  bindClick("mail-btn-drawer-open", () => { state.drawerOpen = true; render(); });
  bindClick("mail-btn-drawer-close", () => { state.drawerOpen = false; render(); });
  bindClick("mail-mobile-back", () => { state.selectedMessageId = null; state.detail = null; render(); });
  bindClick("mail-btn-sync", () => syncAllNow());
  bindClick("mail-btn-unread-filter", () => { state.onlyUnread = !state.onlyUnread; loadMessages(); });
  bindClick("mail-btn-manage-accounts", () => { state.accountsModalOpen = true; state.editingAccountId = null; render(); });
  bindClick("mail-btn-open-settings", () => { state.accountsModalOpen = true; state.editingAccountId = state.accounts[0]?.id || null; render(); });
  bindClick("mail-empty-connect", () => { state.accountsModalOpen = true; state.editingAccountId = null; render(); });

  const searchInput = document.getElementById("mail-search-input") as HTMLInputElement | null;
  if (searchInput) {
    searchInput.onkeydown = (e) => {
      if (e.key === "Enter") {
        state.searchQuery = searchInput.value;
        loadMessages();
      }
    };
  }

  // Acciones de lectura
  if (state.detail) {
    const m = state.detail.message;
    bindClick("mail-btn-show-images", () => { state.showRemoteImages = true; render(); });
    bindClick("mail-btn-toggle-unread", async () => {
      await mailApi(`/api/mail/messages/${m.id}`, { method: "PATCH", body: JSON.stringify({ isRead: false }) });
      const item = state.messages.find((x) => x.id === m.id);
      if (item) item.is_read = false;
      m.is_read = false;
      await loadAccountsAndFolders();
      render();
    });
    bindClick("mail-btn-spam", () => moveMessage(m.id, "spam"));
    bindClick("mail-btn-not-spam", () => moveMessage(m.id, "inbox"));
    bindClick("mail-btn-delete", () => deleteMessage(m.id, m.folder_role === "trash"));

    const quoteHtml = `<br><br><blockquote style="border-left:2px solid #cbd5e1;padding-left:10px;color:#64748b;">El ${new Date(m.date).toLocaleString()}, ${esc(m.from_name || m.from_email)} escribió:<br>${m.body_html_sanitized || esc(m.body_text)}</blockquote>`;

    bindClick("mail-btn-reply", () =>
      openComposer({
        accountId: m.account_id,
        to: m.reply_to || m.from_email,
        subject: m.subject.toLowerCase().startsWith("re:") ? m.subject : `Re: ${m.subject}`,
        htmlBody: quoteHtml,
        replyToMessageId: m.id,
        isReply: true,
      })
    );
    bindClick("mail-btn-reply-all", () => {
      const others = [...(m.to_list || []), ...(m.cc_list || [])]
        .map((x) => x.address)
        .filter((addr) => addr && addr.toLowerCase() !== m.account_email.toLowerCase() && addr.toLowerCase() !== m.from_email.toLowerCase());
      openComposer({
        accountId: m.account_id,
        to: m.from_email,
        cc: others.join(", "),
        subject: m.subject.toLowerCase().startsWith("re:") ? m.subject : `Re: ${m.subject}`,
        htmlBody: quoteHtml,
        replyToMessageId: m.id,
        isReply: true,
      });
    });
    bindClick("mail-btn-forward", () =>
      openComposer({
        accountId: m.account_id,
        subject: m.subject.toLowerCase().startsWith("fwd:") ? m.subject : `Fwd: ${m.subject}`,
        htmlBody: quoteHtml,
        isReply: true,
      })
    );
  }

  // Composer events
  if (state.composerOpen) {
    bindClick("mail-comp-close", () => { state.composerOpen = false; render(); });
    bindClick("mail-comp-cancel", () => { state.composerOpen = false; render(); });
    rootEl.querySelectorAll<HTMLElement>("[data-cmd]").forEach((btn) => {
      btn.onclick = () => {
        document.execCommand(btn.dataset.cmd || "", false);
      };
    });
    bindClick("mail-comp-link", () => {
      const url = prompt("URL del enlace (https://...):");
      if (url) document.execCommand("createLink", false, url);
    });
    const fileInput = document.getElementById("mail-comp-files") as HTMLInputElement | null;
    if (fileInput) {
      fileInput.onchange = async () => {
        const files = Array.from(fileInput.files || []);
        for (const f of files) {
          const b64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const res = String(reader.result || "");
              resolve(res.includes(",") ? res.split(",")[1] : res);
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(f);
          });
          state.composerAttachments.push({
            filename: f.name,
            contentBase64: b64,
            contentType: f.type || "application/octet-stream",
            size: f.size,
          });
        }
        render();
      };
    }
    rootEl.querySelectorAll<HTMLElement>("[data-rm-att]").forEach((btn) => {
      btn.onclick = () => {
        state.composerAttachments.splice(Number(btn.dataset.rmAtt), 1);
        render();
      };
    });
    bindClick("mail-comp-send", async () => {
      const accountId = Number((document.getElementById("mail-comp-account") as HTMLSelectElement).value);
      const to = (document.getElementById("mail-comp-to") as HTMLInputElement).value;
      const cc = (document.getElementById("mail-comp-cc") as HTMLInputElement).value;
      const subject = (document.getElementById("mail-comp-subject") as HTMLInputElement).value;
      const html = (document.getElementById("mail-comp-editor") as HTMLElement).innerHTML;
      try {
        await mailApi("/api/mail/send", {
          method: "POST",
          body: JSON.stringify({
            accountId,
            to,
            cc,
            subject,
            html,
            replyToMessageId: state.replyToMessageId || undefined,
            includeSignature: false, // ya se insertó en el editor
            attachments: state.composerAttachments,
          }),
        });
        state.composerOpen = false;
        toast("Correo enviado correctamente", "success");
        await loadMessages();
      } catch (err: any) {
        toast(err?.message || "No se pudo enviar el correo", "error");
      }
    });
  }

  // Accounts modal events
  if (state.accountsModalOpen) {
    bindClick("mail-acc-close", () => { state.accountsModalOpen = false; render(); });
    bindClick("mail-acc-new", () => { state.editingAccountId = null; render(); });
    rootEl.querySelectorAll<HTMLElement>("[data-acc-edit]").forEach((btn) => {
      btn.onclick = () => { state.editingAccountId = Number(btn.dataset.accEdit); render(); };
    });
    rootEl.querySelectorAll<HTMLElement>("[data-acc-del]").forEach((btn) => {
      btn.onclick = async () => {
        if (!confirm("¿Eliminar esta cuenta y sus correos sincronizados en este tenant?")) return;
        await mailApi(`/api/mail/accounts/${btn.dataset.accDel}`, { method: "DELETE" });
        if (state.editingAccountId === Number(btn.dataset.accDel)) state.editingAccountId = null;
        await loadAccountsAndFolders();
        await loadMessages();
        toast("Cuenta eliminada", "success");
      };
    });

    const emailEl = document.getElementById("mail-f-email") as HTMLInputElement | null;
    if (emailEl && !state.editingAccountId) {
      emailEl.onblur = async () => {
        const val = emailEl.value.trim();
        if (!val.includes("@")) return;
        try {
          const preset = await mailApi<any>(`/api/mail/accounts/autodetect?email=${encodeURIComponent(val)}`);
          const userEl = document.getElementById("mail-f-user") as HTMLInputElement;
          const imapH = document.getElementById("mail-f-imap-host") as HTMLInputElement;
          const imapP = document.getElementById("mail-f-imap-port") as HTMLInputElement;
          const imapS = document.getElementById("mail-f-imap-ssl") as HTMLInputElement;
          const smtpH = document.getElementById("mail-f-smtp-host") as HTMLInputElement;
          const smtpP = document.getElementById("mail-f-smtp-port") as HTMLInputElement;
          const smtpS = document.getElementById("mail-f-smtp-ssl") as HTMLInputElement;
          const hintEl = document.getElementById("mail-acc-hint");
          if (userEl && !userEl.value) userEl.value = val;
          if (imapH) imapH.value = preset.imapHost || "";
          if (imapP) imapP.value = String(preset.imapPort || 993);
          if (imapS) imapS.checked = Boolean(preset.imapSecure);
          if (smtpH) smtpH.value = preset.smtpHost || "";
          if (smtpP) smtpP.value = String(preset.smtpPort || 465);
          if (smtpS) smtpS.checked = Boolean(preset.smtpSecure);
          if (hintEl && preset.hint) {
            hintEl.textContent = preset.hint;
            hintEl.classList.remove("hidden");
          }
        } catch {}
      };
    }

    const collectForm = () => ({
      email: (document.getElementById("mail-f-email") as HTMLInputElement).value.trim(),
      displayName: (document.getElementById("mail-f-name") as HTMLInputElement).value.trim(),
      color: (document.getElementById("mail-f-color") as HTMLInputElement).value,
      username: (document.getElementById("mail-f-user") as HTMLInputElement).value.trim(),
      password: (document.getElementById("mail-f-pass") as HTMLInputElement).value,
      imapHost: (document.getElementById("mail-f-imap-host") as HTMLInputElement).value.trim(),
      imapPort: Number((document.getElementById("mail-f-imap-port") as HTMLInputElement).value),
      imapSecure: (document.getElementById("mail-f-imap-ssl") as HTMLInputElement).checked,
      smtpHost: (document.getElementById("mail-f-smtp-host") as HTMLInputElement).value.trim(),
      smtpPort: Number((document.getElementById("mail-f-smtp-port") as HTMLInputElement).value),
      smtpSecure: (document.getElementById("mail-f-smtp-ssl") as HTMLInputElement).checked,
      signatureHtml: (document.getElementById("mail-f-sig") as HTMLTextAreaElement).value,
      signatureDefaultNew: (document.getElementById("mail-f-sig-new") as HTMLInputElement).checked,
      signatureDefaultReply: (document.getElementById("mail-f-sig-reply") as HTMLInputElement).checked,
    });

    bindClick("mail-acc-test", async () => {
      try {
        toast("Probando conexión IMAP/SMTP...", "info");
        const res = await mailApi<any>("/api/mail/accounts/test", {
          method: "POST",
          body: JSON.stringify(collectForm()),
        });
        if (res.imapOk && res.smtpOk) {
          toast(`Conexión exitosa (${res.foldersCount} carpetas encontradas)`, "success");
        } else {
          toast(res.error || "Falló la prueba de conexión", "error");
        }
      } catch (err: any) {
        toast(err?.message || "Error probando conexión", "error");
      }
    });

    const form = document.getElementById("mail-acc-form") as HTMLFormElement | null;
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const payload = collectForm();
        try {
          if (state.editingAccountId) {
            await mailApi(`/api/mail/accounts/${state.editingAccountId}`, {
              method: "PUT",
              body: JSON.stringify(payload),
            });
            toast("Cuenta y firma actualizadas", "success");
          } else {
            await mailApi("/api/mail/accounts", {
              method: "POST",
              body: JSON.stringify(payload),
            });
            toast("Cuenta conectada correctamente. Sincronizando...", "success");
          }
          state.accountsModalOpen = false;
          await loadAccountsAndFolders();
          await loadMessages();
        } catch (err: any) {
          toast(err?.message || "No se pudo guardar la cuenta", "error");
        }
      };
    }
  }
}

function render() {
  if (!rootEl) return;
  const shellClasses = [
    "mail-shell",
    state.drawerOpen ? "mail-drawer-open" : "",
    state.selectedMessageId ? "mail-mobile-reading" : "",
  ]
    .filter(Boolean)
    .join(" ");

  rootEl.innerHTML = `
    <div class="${shellClasses}">
      ${renderSidebar()}
      ${renderMessageList()}
      ${renderReader()}
    </div>
    ${renderComposerModal()}
    ${renderAccountsModal()}
  `;
  bindEvents();
}

export async function mountMailModule(forceReload = false) {
  rootEl = document.getElementById("mail-inbox-root");
  if (!rootEl) return;

  const tenant = getActiveTenantId();
  if (forceReload || tenant !== lastTenantMounted) {
    lastTenantMounted = tenant;
    state.selectedAccountId = null;
    state.selectedMessageId = null;
    state.detail = null;
    await loadAccountsAndFolders();
    await loadMessages();
    connectSse();
  } else {
    render();
  }
}

(window as any).TurboMail = {
  mount: mountMailModule,
  openComposer,
};
