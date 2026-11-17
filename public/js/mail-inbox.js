"use strict";(()=>{function w(){try{let e=localStorage.getItem("turbonetwork_session");if(e){let a=JSON.parse(e);if(a&&a.token)return String(a.token)}}catch{}return""}function k(){return localStorage.getItem("turbonetwork_active_tenant")||""}async function u(e,a={}){let s=w(),l=k(),o={"Content-Type":"application/json",...a.headers||{}};s&&(o.Authorization=`Bearer ${s}`),l&&(o["x-tenant-id"]=l);let n=await fetch(e,{...a,headers:o}),d=await n.text(),c={};try{c=d?JSON.parse(d):{}}catch{c={raw:d}}if(!n.ok)throw new Error(c?.error||c?.message||`Error HTTP ${n.status}`);return c}var t={accounts:[],folders:[],messages:[],totalMessages:0,selectedAccountId:null,selectedFolderRole:"inbox",searchQuery:"",onlyUnread:!1,selectedMessageId:null,detail:null,showRemoteImages:!1,loadingList:!1,loadingDetail:!1,syncing:!1,drawerOpen:!1,composerOpen:!1,accountsModalOpen:!1,editingAccountId:null,composerAttachments:[],replyToMessageId:null},b=null,v=null,S="";function r(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function m(e,a="info"){let s=window.showToast;typeof s=="function"?s(e,a):console.log(`[Mail ${a}]`,e)}function H(e){if(!e)return"";let a=new Date(e);if(isNaN(a.getTime()))return"";let s=new Date;return a.getFullYear()===s.getFullYear()&&a.getMonth()===s.getMonth()&&a.getDate()===s.getDate()?a.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):a.toLocaleDateString([],{day:"2-digit",month:"short"})}function L(e){return e?e<1024?`${e} B`:e<1024*1024?`${(e/1024).toFixed(1)} KB`:`${(e/(1024*1024)).toFixed(1)} MB`:"0 B"}function C(e,a){let s=(e||a||"?").trim(),l=s.split(/\s+/);return l.length>=2?(l[0][0]+l[1][0]).toUpperCase():s.slice(0,2).toUpperCase()}function B(e){return t.folders.filter(a=>a.role===e&&(!t.selectedAccountId||a.account_id===t.selectedAccountId)).reduce((a,s)=>a+Number(s.unread_count||0),0)}function j(){let e=t.folders.filter(s=>s.role==="inbox").reduce((s,l)=>s+Number(l.unread_count||0),0),a=document.getElementById("nav-mail-badge");a&&(e>0?(a.textContent=e>99?"99+":String(e),a.className="sidebar-text ml-auto px-1.5 py-0.5 rounded-md text-[9.5px] font-mono font-bold bg-blue-600 text-white"):(a.textContent=String(t.accounts.length||0),a.className="sidebar-text ml-auto px-1.5 py-0.5 rounded-md text-[9.5px] font-mono font-semibold bg-slate-200/60 dark:bg-white/5 text-slate-500 dark:text-slate-400"))}async function f(){let[e,a]=await Promise.all([u("/api/mail/accounts"),u("/api/mail/folders")]);t.accounts=e.accounts||[],t.folders=a.folders||[],j()}async function x(){t.loadingList=!0,i();try{let e=new URLSearchParams;t.selectedAccountId&&e.set("accountId",String(t.selectedAccountId)),t.selectedFolderRole==="starred"?e.set("starred","1"):e.set("folder",t.selectedFolderRole),t.onlyUnread&&e.set("unread","1"),t.searchQuery.trim()&&e.set("q",t.searchQuery.trim()),e.set("limit","50");let a=await u(`/api/mail/messages?${e.toString()}`);t.messages=a.items||[],t.totalMessages=a.total||0}catch(e){m(e?.message||"Error cargando correos","error")}finally{t.loadingList=!1,i()}}async function _(e){t.selectedMessageId=e,t.loadingDetail=!0,t.showRemoteImages=!1,i();try{let a=await u(`/api/mail/messages/${e}`);if(t.detail=a,!a.message.is_read){await u(`/api/mail/messages/${e}`,{method:"PATCH",body:JSON.stringify({isRead:!0})}).catch(()=>{});let s=t.messages.find(l=>l.id===e);s&&(s.is_read=!0),a.message.is_read=!0,f().then(()=>i()).catch(()=>{})}}catch(a){m(a?.message||"No se pudo abrir el correo","error")}finally{t.loadingDetail=!1,i()}}async function P(e,a,s){s?.stopPropagation();try{await u(`/api/mail/messages/${e}`,{method:"PATCH",body:JSON.stringify({isStarred:!a})});let l=t.messages.find(o=>o.id===e);l&&(l.is_starred=!a),t.detail?.message.id===e&&(t.detail.message.is_starred=!a),i()}catch(l){m(l?.message||"Error actualizando destacado","error")}}async function A(e,a){try{await u(`/api/mail/messages/${e}`,{method:"PATCH",body:JSON.stringify({moveToRole:a})}),m(a==="spam"?"Movido a Spam":a==="trash"?"Movido a Papelera":"Movido a Recibidos","success"),t.selectedMessageId===e&&(t.selectedMessageId=null,t.detail=null),await Promise.all([f(),x()])}catch(s){m(s?.message||"No se pudo mover el correo","error")}}async function N(e,a=!1){try{await u(`/api/mail/messages/${e}${a?"?permanent=1":""}`,{method:"DELETE"}),m(a?"Correo eliminado definitivamente":"Correo enviado a la papelera","success"),t.selectedMessageId===e&&(t.selectedMessageId=null,t.detail=null),await Promise.all([f(),x()])}catch(s){m(s?.message||"Error eliminando correo","error")}}async function R(){if(!(t.syncing||t.accounts.length===0)){t.syncing=!0,i();try{let e=t.selectedAccountId?t.accounts.filter(s=>s.id===t.selectedAccountId):t.accounts,a=0;for(let s of e){let l=await u(`/api/mail/accounts/${s.id}/sync`,{method:"POST",body:"{}"});a+=Number(l.syncedMessages||0)}await Promise.all([f(),x()]),m(a>0?`${a} correo(s) sincronizados`:"Bandeja actualizada","success")}catch(e){m(e?.message||"Error al sincronizar","error")}finally{t.syncing=!1,i()}}}function O(){v&&(v.close(),v=null);let e=w(),a=k();if(!e)return;let s=`/api/mail/events?token=${encodeURIComponent(e)}${a?`&tenantId=${encodeURIComponent(a)}`:""}`;try{v=new EventSource(s),v.addEventListener("mail",()=>{f().then(()=>x()).catch(()=>{})})}catch{}}function y(e){if(t.accounts.length===0){m("Primero conecta una cuenta de correo.","info"),t.accountsModalOpen=!0,t.editingAccountId=null,i();return}t.composerOpen=!0,t.composerAttachments=[],t.replyToMessageId=e?.replyToMessageId||null,i(),setTimeout(()=>{let a=document.getElementById("mail-comp-account"),s=document.getElementById("mail-comp-to"),l=document.getElementById("mail-comp-cc"),o=document.getElementById("mail-comp-subject"),n=document.getElementById("mail-comp-editor"),d=e?.accountId||t.selectedAccountId||t.accounts[0]?.id;a&&d&&(a.value=String(d)),s&&(s.value=e?.to||""),l&&(l.value=e?.cc||""),o&&(o.value=e?.subject||"");let c=t.accounts.find(g=>g.id===Number(d)),p=e?.htmlBody||"";c&&c.signatureHtml&&(e?.isReply?c.signatureDefaultReply:c.signatureDefaultNew)&&(p=`${p?p+"<br>":"<p><br></p>"}<div class="tn-mail-signature-preview" style="border-top:1px solid #e2e8f0;padding-top:8px;margin-top:12px;">${c.signatureHtml}</div>`),n&&(n.innerHTML=p),(e?.to?n:s)?.focus()},30)}function h(e,a,s){let l=t.selectedFolderRole===e,o=e==="inbox"||e==="spam"||e==="drafts"?B(e):0;return`
    <button type="button" data-mail-folder="${e}"
      class="mail-folder-btn w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition ${l?"active shadow-sm":""}">
      <span class="w-4 h-4 shrink-0">${s}</span>
      <span class="truncate">${a}</span>
      ${o>0?`<span class="ml-auto px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${l?"bg-white/20 text-white":"bg-blue-500/15 text-blue-600 dark:text-blue-400"}">${o}</span>`:""}
    </button>
  `}function D(){return`
    <aside class="mail-sidebar p-3 gap-3">
      <div class="flex items-center gap-2">
        <button type="button" id="mail-btn-compose"
          class="mail-btn-primary flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
          Redactar
        </button>
        <button type="button" id="mail-btn-drawer-close" class="lg:hidden p-2 rounded-xl mail-btn-subtle" title="Cerrar men\xFA">\u2715</button>
      </div>

      <div class="space-y-1">
        <div class="px-2 text-[10px] font-bold uppercase tracking-wider mail-text-muted">Carpetas</div>
        ${h("inbox","Recibidos",'<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/></svg>')}
        ${h("starred","Destacados",'<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>')}
        ${h("sent","Enviados",'<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>')}
        ${h("drafts","Borradores",'<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>')}
        ${h("spam","Spam",'<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>')}
        ${h("trash","Papelera",'<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>')}
      </div>

      <div class="pt-2 border-t mail-divider space-y-1 flex-1 min-h-0 overflow-y-auto">
        <div class="px-2 flex items-center justify-between">
          <span class="text-[10px] font-bold uppercase tracking-wider mail-text-muted">Cuentas del Tenant</span>
          <button type="button" id="mail-btn-manage-accounts" class="text-[11px] font-semibold text-blue-500 hover:underline">
            + Gestionar
          </button>
        </div>

        <button type="button" data-mail-account="all"
          class="mail-account-btn w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-[12.5px] font-medium transition ${t.selectedAccountId===null?"active":""}">
          <span class="w-2.5 h-2.5 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500"></span>
          <span class="truncate">Todas las cuentas</span>
        </button>

        ${t.accounts.map(e=>`
          <button type="button" data-mail-account="${e.id}"
            class="mail-account-btn w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-[12px] transition ${t.selectedAccountId===e.id?"active":""}">
            <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background:${r(e.color)}"></span>
            <span class="truncate flex-1 text-left">${r(e.displayName||e.email)}</span>
            ${e.status==="error"?`<span class="text-[10px] text-rose-500" title="${r(e.lastError)}">\u26A0</span>`:Number(e.unreadCount||0)>0?`<span class="text-[10px] font-mono mail-text-muted">${e.unreadCount}</span>`:""}
          </button>
        `).join("")}
      </div>

      <div class="pt-2 border-t mail-divider">
        <button type="button" id="mail-btn-open-settings"
          class="mail-folder-btn w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3"/></svg>
          Cuentas y Firmas
        </button>
      </div>
    </aside>
  `}function F(){return`
    <div class="mail-list-pane">
      <div class="p-3 mail-pane-header space-y-2.5">
        <div class="flex items-center gap-2">
          <button type="button" id="mail-btn-drawer-open" class="lg:hidden p-2 rounded-xl mail-btn-subtle">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
          </button>
          <h3 class="text-sm font-bold mail-title flex-1 truncate">
            ${{inbox:"Recibidos",starred:"Destacados",sent:"Enviados",drafts:"Borradores",spam:"Spam",trash:"Papelera"}[t.selectedFolderRole]||"Correos"}
            <span class="ml-1 text-xs font-normal mail-text-muted">(${t.totalMessages})</span>
          </h3>
          <button type="button" id="mail-btn-sync" title="Sincronizar ahora"
            class="p-2 rounded-xl mail-text-muted hover:opacity-80 transition ${t.syncing?"animate-spin text-blue-500":""}">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          </button>
        </div>

        <div class="flex items-center gap-1.5">
          <div class="relative flex-1">
            <input type="search" id="mail-search-input" value="${r(t.searchQuery)}" placeholder="Buscar asunto, remitente..."
              class="mail-input w-full pl-8 pr-3 py-1.5 rounded-xl text-xs" />
            <svg class="w-3.5 h-3.5 mail-text-muted absolute left-2.5 top-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          </div>
          <button type="button" id="mail-btn-unread-filter"
            class="px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition ${t.onlyUnread?"mail-btn-primary":"mail-btn-subtle"}">
            No le\xEDdos
          </button>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto">
        ${t.accounts.length===0?`<div class="p-8 text-center space-y-3">
                 <div class="w-12 h-12 mx-auto rounded-2xl bg-blue-500/15 text-blue-500 flex items-center justify-center">
                   <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                 </div>
                 <p class="text-sm font-semibold mail-title">Sin cuentas conectadas</p>
                 <p class="text-xs mail-text-muted">Conecta Gmail, Outlook o tu correo corporativo IMAP/SMTP en este tenant.</p>
                 <button type="button" id="mail-empty-connect" class="mail-btn-primary px-4 py-2 rounded-xl text-xs font-semibold shadow-sm">Conectar correo</button>
               </div>`:t.loadingList&&t.messages.length===0?'<div class="p-8 text-center text-xs mail-text-muted">Cargando correos...</div>':t.messages.length===0?'<div class="p-8 text-center text-xs mail-text-muted">No hay correos en esta carpeta.</div>':t.messages.map(a=>{let s=t.selectedMessageId===a.id,l=a.from_name||a.from_email||"(desconocido)";return`
                        <div data-mail-open="${a.id}"
                          class="mail-msg-row p-3 cursor-pointer transition flex gap-2.5 items-start ${s?"active":""}">
                          <div class="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold text-white"
                            style="background:${r(a.account_color||"#3b82f6")}">
                            ${r(C(a.from_name,a.from_email))}
                          </div>
                          <div class="flex-1 min-w-0">
                            <div class="flex items-center justify-between gap-1">
                              <span class="text-[12.5px] truncate ${a.is_read?"font-medium mail-text-sec":"font-bold mail-title"}">${r(l)}</span>
                              <span class="text-[10.5px] mail-text-muted shrink-0">${H(a.date)}</span>
                            </div>
                            <div class="flex items-center gap-1.5 mt-0.5">
                              ${a.is_read?"":'<span class="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>'}
                              <p class="text-xs truncate ${a.is_read?"mail-text-sec":"font-semibold mail-title"}">${r(a.subject)}</p>
                            </div>
                            <p class="text-[11px] mail-text-muted truncate mt-0.5">${r(a.snippet)}</p>
                            <div class="flex items-center justify-between mt-1">
                              <span class="text-[10px] mail-text-muted truncate">${r(a.account_email)}</span>
                              <div class="flex items-center gap-1.5">
                                ${a.has_attachments?'<span class="text-[11px] mail-text-muted" title="Tiene adjuntos">\u{1F4CE}</span>':""}
                                <button type="button" data-mail-star="${a.id}" data-starred="${a.is_starred?"1":"0"}"
                                  class="text-sm leading-none ${a.is_starred?"text-amber-400":"mail-text-muted hover:text-amber-400"}">\u2605</button>
                              </div>
                            </div>
                          </div>
                        </div>
                      `}).join("")}
      </div>
    </div>
  `}function z(){if(!t.selectedMessageId)return`
      <div class="mail-reader-pane items-center justify-center text-center p-8">
        <div class="max-w-xs space-y-2 mail-text-muted">
          <svg class="w-12 h-12 mx-auto opacity-60" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
          <p class="text-sm font-semibold mail-title">Selecciona un correo para leerlo</p>
          <p class="text-xs mail-text-muted">Puedes responder, reenviar, marcar como spam o gestionar firmas por cada cuenta.</p>
        </div>
      </div>
    `;if(t.loadingDetail||!t.detail)return'<div class="mail-reader-pane items-center justify-center text-xs mail-text-muted">Cargando mensaje...</div>';let e=t.detail.message,a=t.detail.attachments||[],s=e.body_html_sanitized||`<pre class="whitespace-pre-wrap font-sans">${r(e.body_text)}</pre>`;t.showRemoteImages&&(s=s.replace(/data-blocked-src=(["'])([^"']+)\1\s+src=(["'])[^"']+\3/gi,'src="$2"'));let l=(e.to_list||[]).map(o=>o.name?`${o.name} <${o.address}>`:o.address).join(", ");return`
    <div class="mail-reader-pane">
      <div class="p-3 border-b border-slate-200/80 dark:border-white/10 flex flex-wrap items-center gap-2">
        <button type="button" id="mail-mobile-back" class="md:hidden px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-white/10 text-xs font-semibold">\u2190 Volver</button>
        <button type="button" id="mail-btn-reply" class="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold">Responder</button>
        <button type="button" id="mail-btn-reply-all" class="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-medium hover:bg-slate-200 dark:hover:bg-white/15">Responder a todos</button>
        <button type="button" id="mail-btn-forward" class="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-medium hover:bg-slate-200 dark:hover:bg-white/15">Reenviar</button>
        <div class="ml-auto flex items-center gap-1.5">
          <button type="button" id="mail-btn-toggle-unread" class="px-2.5 py-1.5 rounded-xl text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10" title="Marcar no le\xEDdo">No le\xEDdo</button>
          ${e.folder_role!=="spam"?'<button type="button" id="mail-btn-spam" class="px-2.5 py-1.5 rounded-xl text-xs text-amber-600 hover:bg-amber-500/10">Spam</button>':'<button type="button" id="mail-btn-not-spam" class="px-2.5 py-1.5 rounded-xl text-xs text-emerald-600 hover:bg-emerald-500/10">No es spam</button>'}
          <button type="button" id="mail-btn-delete" class="px-2.5 py-1.5 rounded-xl text-xs text-rose-600 hover:bg-rose-500/10">
            ${e.folder_role==="trash"?"Eliminar definitivo":"Papelera"}
          </button>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        <div>
          <h2 class="text-lg font-bold text-slate-900 dark:text-white">${r(e.subject)}</h2>
          <div class="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <div>
              <span class="font-semibold text-slate-800 dark:text-slate-200">${r(e.from_name||e.from_email)}</span>
              ${e.from_name?`<span class="ml-1">&lt;${r(e.from_email)}&gt;</span>`:""}
              <div class="text-[11px] mt-0.5">Para: ${r(l||e.account_email)}</div>
            </div>
            <div class="text-right">
              <div>${new Date(e.date).toLocaleString()}</div>
              <div class="text-[10.5px] text-slate-400">Cuenta: ${r(e.account_email)}</div>
            </div>
          </div>
        </div>

        ${e.has_remote_images&&!t.showRemoteImages?`<div class="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between gap-2 text-xs text-amber-700 dark:text-amber-300">
                 <span>Se bloquearon im\xE1genes externas por privacidad.</span>
                 <button type="button" id="mail-btn-show-images" class="px-2.5 py-1 rounded-lg bg-amber-500 text-white font-semibold">Mostrar im\xE1genes</button>
               </div>`:""}

        <div class="mail-html-body">${s}</div>

        ${a.length>0?`<div class="space-y-2">
                 <div class="text-xs font-bold text-slate-600 dark:text-slate-300">Adjuntos (${a.length})</div>
                 <div class="flex flex-wrap gap-2">
                   ${a.map(o=>`
                     <a href="/api/mail/messages/${e.id}/attachments/${o.id}?token=${encodeURIComponent(w())}"
                       target="_blank"
                       class="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs hover:border-blue-500 transition">
                       <span>\u{1F4CE}</span>
                       <span class="font-medium truncate max-w-[180px]">${r(o.filename)}</span>
                       <span class="text-slate-400">(${L(o.size_bytes)})</span>
                     </a>
                   `).join("")}
                 </div>
               </div>`:""}
      </div>
    </div>
  `}function q(){return t.composerOpen?`
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3">
      <div class="w-full max-w-2xl rounded-2xl mail-modal-card shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <div class="px-4 py-3 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
          <h3 class="text-sm font-bold text-slate-900 dark:text-white">Nuevo Correo</h3>
          <button type="button" id="mail-comp-close" class="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white">\u2715</button>
        </div>
        <div class="p-4 space-y-2.5 overflow-y-auto flex-1">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label class="text-[11px] font-semibold text-slate-500">De (Cuenta)</label>
              <select id="mail-comp-account" class="w-full mt-0.5 px-3 py-1.5 rounded-xl text-xs bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                ${t.accounts.map(e=>`<option value="${e.id}">${r(e.displayName||e.email)} (${r(e.email)})</option>`).join("")}
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
              <button type="button" data-cmd="insertUnorderedList" class="px-2 py-1 rounded text-xs hover:bg-slate-200 dark:hover:bg-white/10">\u2022 Lista</button>
              <button type="button" id="mail-comp-link" class="px-2 py-1 rounded text-xs hover:bg-slate-200 dark:hover:bg-white/10">\u{1F517} Enlace</button>
            </div>
            <div id="mail-comp-editor" contenteditable="true" data-placeholder="Escribe tu mensaje aqu\xED..." class="mail-editor-area bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"></div>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <label class="cursor-pointer px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/10 text-xs font-medium hover:bg-slate-200 dark:hover:bg-white/15">
              \u{1F4CE} Adjuntar archivos
              <input type="file" id="mail-comp-files" multiple class="hidden" />
            </label>
            ${t.composerAttachments.map((e,a)=>`
              <span class="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[11px] flex items-center gap-1.5">
                ${r(e.filename)} (${L(e.size)})
                <button type="button" data-rm-att="${a}" class="font-bold">\xD7</button>
              </span>
            `).join("")}
          </div>
        </div>
        <div class="px-4 py-3 border-t border-slate-200 dark:border-white/10 flex items-center justify-end gap-2">
          <button type="button" id="mail-comp-cancel" class="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10">Cancelar</button>
          <button type="button" id="mail-comp-send" class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm">Enviar correo</button>
        </div>
      </div>
    </div>
  `:""}function U(){if(!t.accountsModalOpen)return"";let e=t.editingAccountId&&t.accounts.find(a=>a.id===t.editingAccountId)||null;return`
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3">
      <div class="w-full max-w-3xl rounded-2xl mail-modal-card shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <div class="px-5 py-3.5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
          <h3 class="text-sm font-bold text-slate-900 dark:text-white">Cuentas de Correo y Firmas del Tenant</h3>
          <button type="button" id="mail-acc-close" class="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white">\u2715</button>
        </div>

        <div class="p-5 overflow-y-auto space-y-5">
          ${t.accounts.length>0?`<div class="space-y-2">
                   <div class="flex items-center justify-between">
                     <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Cuentas Conectadas</span>
                     <button type="button" id="mail-acc-new" class="text-xs font-semibold text-blue-600 hover:underline">+ Conectar otra cuenta</button>
                   </div>
                   <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                     ${t.accounts.map(a=>`
                       <div class="p-3 rounded-xl border border-slate-200 dark:border-white/10 flex items-center justify-between gap-2">
                         <div class="min-w-0">
                           <div class="flex items-center gap-1.5">
                             <span class="w-2.5 h-2.5 rounded-full" style="background:${r(a.color)}"></span>
                             <span class="text-xs font-bold truncate">${r(a.displayName||a.email)}</span>
                           </div>
                           <div class="text-[11px] text-slate-400 truncate">${r(a.email)}</div>
                         </div>
                         <div class="flex items-center gap-1 shrink-0">
                           <button type="button" data-acc-edit="${a.id}" class="px-2 py-1 rounded-lg bg-slate-100 dark:bg-white/10 text-[11px] font-medium">Editar / Firma</button>
                           <button type="button" data-acc-del="${a.id}" class="px-2 py-1 rounded-lg text-rose-600 hover:bg-rose-500/10 text-[11px]">Eliminar</button>
                         </div>
                       </div>
                     `).join("")}
                   </div>
                 </div>`:""}

          <form id="mail-acc-form" class="space-y-3 pt-3 border-t border-slate-200 dark:border-white/10">
            <div class="text-xs font-bold text-slate-800 dark:text-white">
              ${e?`Editando: ${r(e.email)}`:"Conectar Nueva Cuenta (IMAP / SMTP)"}
            </div>
            <div id="mail-acc-hint" class="text-[11px] text-blue-600 dark:text-blue-400 hidden"></div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label class="text-[11px] font-semibold text-slate-500">Correo electr\xF3nico</label>
                <input id="mail-f-email" type="email" required value="${r(e?.email||"")}" ${e?"readonly":""}
                  placeholder="soporte@tuempresa.com" class="w-full mt-0.5 px-3 py-1.5 rounded-xl text-xs bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10" />
              </div>
              <div>
                <label class="text-[11px] font-semibold text-slate-500">Nombre visible</label>
                <input id="mail-f-name" type="text" value="${r(e?.displayName||"")}" placeholder="Soporte TurboNetwork"
                  class="w-full mt-0.5 px-3 py-1.5 rounded-xl text-xs bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10" />
              </div>
              <div>
                <label class="text-[11px] font-semibold text-slate-500">Color identificador</label>
                <input id="mail-f-color" type="color" value="${r(e?.color||"#3b82f6")}" class="w-full h-8 mt-0.5 rounded-xl bg-transparent cursor-pointer" />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label class="text-[11px] font-semibold text-slate-500">Usuario IMAP/SMTP</label>
                <input id="mail-f-user" type="text" value="${r(e?.username||"")}" placeholder="soporte@tuempresa.com"
                  class="w-full mt-0.5 px-3 py-1.5 rounded-xl text-xs bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10" />
              </div>
              <div>
                <label class="text-[11px] font-semibold text-slate-500">Contrase\xF1a ${e?"(dejar vac\xEDo para mantener)":"/ App Password"}</label>
                <input id="mail-f-pass" type="password" ${e?"":"required"} placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
                  class="w-full mt-0.5 px-3 py-1.5 rounded-xl text-xs bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10" />
              </div>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div class="col-span-2 sm:col-span-1">
                <label class="text-[11px] font-semibold text-slate-500">Servidor IMAP</label>
                <input id="mail-f-imap-host" type="text" required value="${r(e?.imapHost||"")}" placeholder="imap.gmail.com"
                  class="w-full mt-0.5 px-3 py-1.5 rounded-xl text-xs bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10" />
              </div>
              <div>
                <label class="text-[11px] font-semibold text-slate-500">Puerto IMAP</label>
                <input id="mail-f-imap-port" type="number" required value="${e?.imapPort||993}"
                  class="w-full mt-0.5 px-3 py-1.5 rounded-xl text-xs bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10" />
              </div>
              <div class="col-span-2 sm:col-span-1">
                <label class="text-[11px] font-semibold text-slate-500">Servidor SMTP</label>
                <input id="mail-f-smtp-host" type="text" required value="${r(e?.smtpHost||"")}" placeholder="smtp.gmail.com"
                  class="w-full mt-0.5 px-3 py-1.5 rounded-xl text-xs bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10" />
              </div>
              <div>
                <label class="text-[11px] font-semibold text-slate-500">Puerto SMTP</label>
                <input id="mail-f-smtp-port" type="number" required value="${e?.smtpPort||465}"
                  class="w-full mt-0.5 px-3 py-1.5 rounded-xl text-xs bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10" />
              </div>
            </div>

            <div class="flex flex-wrap gap-4 text-xs">
              <label class="flex items-center gap-1.5"><input id="mail-f-imap-ssl" type="checkbox" ${e?e.imapSecure?"checked":"":"checked"} /> IMAP SSL/TLS</label>
              <label class="flex items-center gap-1.5"><input id="mail-f-smtp-ssl" type="checkbox" ${e?e.smtpSecure?"checked":"":"checked"} /> SMTP SSL/TLS (465)</label>
            </div>

            <div class="space-y-1.5 pt-2 border-t border-slate-200 dark:border-white/10">
              <label class="text-[11px] font-semibold text-slate-500">Firma de correo (HTML)</label>
              <textarea id="mail-f-sig" rows="3" placeholder="<p><strong>Equipo Soporte</strong><br>TurboNetwork ISP</p>"
                class="w-full px-3 py-2 rounded-xl text-xs font-mono bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">${r(e?.signatureHtml||"")}</textarea>
              <div class="flex flex-wrap gap-4 text-xs">
                <label class="flex items-center gap-1.5"><input id="mail-f-sig-new" type="checkbox" ${e?e.signatureDefaultNew?"checked":"":"checked"} /> Incluir firma en correos nuevos</label>
                <label class="flex items-center gap-1.5"><input id="mail-f-sig-reply" type="checkbox" ${e?e.signatureDefaultReply?"checked":"":"checked"} /> Incluir firma en respuestas</label>
              </div>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-2 pt-2">
              <button type="button" id="mail-acc-test" class="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-white/10 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-white/15">Probar conexi\xF3n</button>
              <button type="submit" class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold">${e?"Guardar cambios":"Conectar y Guardar"}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `}function J(){if(!b)return;b.querySelectorAll("[data-mail-folder]").forEach(s=>{s.onclick=()=>{t.selectedFolderRole=s.dataset.mailFolder||"inbox",t.selectedMessageId=null,t.detail=null,t.drawerOpen=!1,x()}}),b.querySelectorAll("[data-mail-account]").forEach(s=>{s.onclick=()=>{let l=s.dataset.mailAccount;t.selectedAccountId=l==="all"?null:Number(l),t.selectedMessageId=null,t.detail=null,t.drawerOpen=!1,x()}}),b.querySelectorAll("[data-mail-open]").forEach(s=>{s.onclick=()=>_(Number(s.dataset.mailOpen))}),b.querySelectorAll("[data-mail-star]").forEach(s=>{s.onclick=l=>P(Number(s.dataset.mailStar),s.dataset.starred==="1",l)});let e=(s,l)=>{let o=document.getElementById(s);o&&(o.onclick=l)};e("mail-btn-compose",()=>y()),e("mail-btn-drawer-open",()=>{t.drawerOpen=!0,i()}),e("mail-btn-drawer-close",()=>{t.drawerOpen=!1,i()}),e("mail-mobile-back",()=>{t.selectedMessageId=null,t.detail=null,i()}),e("mail-btn-sync",()=>R()),e("mail-btn-unread-filter",()=>{t.onlyUnread=!t.onlyUnread,x()}),e("mail-btn-manage-accounts",()=>{t.accountsModalOpen=!0,t.editingAccountId=null,i()}),e("mail-btn-open-settings",()=>{t.accountsModalOpen=!0,t.editingAccountId=t.accounts[0]?.id||null,i()}),e("mail-empty-connect",()=>{t.accountsModalOpen=!0,t.editingAccountId=null,i()});let a=document.getElementById("mail-search-input");if(a&&(a.onkeydown=s=>{s.key==="Enter"&&(t.searchQuery=a.value,x())}),t.detail){let s=t.detail.message;e("mail-btn-show-images",()=>{t.showRemoteImages=!0,i()}),e("mail-btn-toggle-unread",async()=>{await u(`/api/mail/messages/${s.id}`,{method:"PATCH",body:JSON.stringify({isRead:!1})});let o=t.messages.find(n=>n.id===s.id);o&&(o.is_read=!1),s.is_read=!1,await f(),i()}),e("mail-btn-spam",()=>A(s.id,"spam")),e("mail-btn-not-spam",()=>A(s.id,"inbox")),e("mail-btn-delete",()=>N(s.id,s.folder_role==="trash"));let l=`<br><br><blockquote style="border-left:2px solid #cbd5e1;padding-left:10px;color:#64748b;">El ${new Date(s.date).toLocaleString()}, ${r(s.from_name||s.from_email)} escribi\xF3:<br>${s.body_html_sanitized||r(s.body_text)}</blockquote>`;e("mail-btn-reply",()=>y({accountId:s.account_id,to:s.reply_to||s.from_email,subject:s.subject.toLowerCase().startsWith("re:")?s.subject:`Re: ${s.subject}`,htmlBody:l,replyToMessageId:s.id,isReply:!0})),e("mail-btn-reply-all",()=>{let o=[...s.to_list||[],...s.cc_list||[]].map(n=>n.address).filter(n=>n&&n.toLowerCase()!==s.account_email.toLowerCase()&&n.toLowerCase()!==s.from_email.toLowerCase());y({accountId:s.account_id,to:s.from_email,cc:o.join(", "),subject:s.subject.toLowerCase().startsWith("re:")?s.subject:`Re: ${s.subject}`,htmlBody:l,replyToMessageId:s.id,isReply:!0})}),e("mail-btn-forward",()=>y({accountId:s.account_id,subject:s.subject.toLowerCase().startsWith("fwd:")?s.subject:`Fwd: ${s.subject}`,htmlBody:l,isReply:!0}))}if(t.composerOpen){e("mail-comp-close",()=>{t.composerOpen=!1,i()}),e("mail-comp-cancel",()=>{t.composerOpen=!1,i()}),b.querySelectorAll("[data-cmd]").forEach(l=>{l.onclick=()=>{document.execCommand(l.dataset.cmd||"",!1)}}),e("mail-comp-link",()=>{let l=prompt("URL del enlace (https://...):");l&&document.execCommand("createLink",!1,l)});let s=document.getElementById("mail-comp-files");s&&(s.onchange=async()=>{let l=Array.from(s.files||[]);for(let o of l){let n=await new Promise((d,c)=>{let p=new FileReader;p.onload=()=>{let g=String(p.result||"");d(g.includes(",")?g.split(",")[1]:g)},p.onerror=()=>c(p.error),p.readAsDataURL(o)});t.composerAttachments.push({filename:o.name,contentBase64:n,contentType:o.type||"application/octet-stream",size:o.size})}i()}),b.querySelectorAll("[data-rm-att]").forEach(l=>{l.onclick=()=>{t.composerAttachments.splice(Number(l.dataset.rmAtt),1),i()}}),e("mail-comp-send",async()=>{let l=Number(document.getElementById("mail-comp-account").value),o=document.getElementById("mail-comp-to").value,n=document.getElementById("mail-comp-cc").value,d=document.getElementById("mail-comp-subject").value,c=document.getElementById("mail-comp-editor").innerHTML;try{await u("/api/mail/send",{method:"POST",body:JSON.stringify({accountId:l,to:o,cc:n,subject:d,html:c,replyToMessageId:t.replyToMessageId||void 0,includeSignature:!1,attachments:t.composerAttachments})}),t.composerOpen=!1,m("Correo enviado correctamente","success"),await x()}catch(p){m(p?.message||"No se pudo enviar el correo","error")}})}if(t.accountsModalOpen){e("mail-acc-close",()=>{t.accountsModalOpen=!1,i()}),e("mail-acc-new",()=>{t.editingAccountId=null,i()}),b.querySelectorAll("[data-acc-edit]").forEach(n=>{n.onclick=()=>{t.editingAccountId=Number(n.dataset.accEdit),i()}}),b.querySelectorAll("[data-acc-del]").forEach(n=>{n.onclick=async()=>{confirm("\xBFEliminar esta cuenta y sus correos sincronizados en este tenant?")&&(await u(`/api/mail/accounts/${n.dataset.accDel}`,{method:"DELETE"}),t.editingAccountId===Number(n.dataset.accDel)&&(t.editingAccountId=null),await f(),await x(),m("Cuenta eliminada","success"))}});let s=document.getElementById("mail-f-email");s&&!t.editingAccountId&&(s.onblur=async()=>{let n=s.value.trim();if(n.includes("@"))try{let d=await u(`/api/mail/accounts/autodetect?email=${encodeURIComponent(n)}`),c=document.getElementById("mail-f-user"),p=document.getElementById("mail-f-imap-host"),g=document.getElementById("mail-f-imap-port"),I=document.getElementById("mail-f-imap-ssl"),$=document.getElementById("mail-f-smtp-host"),E=document.getElementById("mail-f-smtp-port"),T=document.getElementById("mail-f-smtp-ssl"),M=document.getElementById("mail-acc-hint");c&&!c.value&&(c.value=n),p&&(p.value=d.imapHost||""),g&&(g.value=String(d.imapPort||993)),I&&(I.checked=!!d.imapSecure),$&&($.value=d.smtpHost||""),E&&(E.value=String(d.smtpPort||465)),T&&(T.checked=!!d.smtpSecure),M&&d.hint&&(M.textContent=d.hint,M.classList.remove("hidden"))}catch{}});let l=()=>({email:document.getElementById("mail-f-email").value.trim(),displayName:document.getElementById("mail-f-name").value.trim(),color:document.getElementById("mail-f-color").value,username:document.getElementById("mail-f-user").value.trim(),password:document.getElementById("mail-f-pass").value,imapHost:document.getElementById("mail-f-imap-host").value.trim(),imapPort:Number(document.getElementById("mail-f-imap-port").value),imapSecure:document.getElementById("mail-f-imap-ssl").checked,smtpHost:document.getElementById("mail-f-smtp-host").value.trim(),smtpPort:Number(document.getElementById("mail-f-smtp-port").value),smtpSecure:document.getElementById("mail-f-smtp-ssl").checked,signatureHtml:document.getElementById("mail-f-sig").value,signatureDefaultNew:document.getElementById("mail-f-sig-new").checked,signatureDefaultReply:document.getElementById("mail-f-sig-reply").checked});e("mail-acc-test",async()=>{try{m("Probando conexi\xF3n IMAP/SMTP...","info");let n=await u("/api/mail/accounts/test",{method:"POST",body:JSON.stringify(l())});n.imapOk&&n.smtpOk?m(`Conexi\xF3n exitosa (${n.foldersCount} carpetas encontradas)`,"success"):m(n.error||"Fall\xF3 la prueba de conexi\xF3n","error")}catch(n){m(n?.message||"Error probando conexi\xF3n","error")}});let o=document.getElementById("mail-acc-form");o&&(o.onsubmit=async n=>{n.preventDefault();let d=l();try{t.editingAccountId?(await u(`/api/mail/accounts/${t.editingAccountId}`,{method:"PUT",body:JSON.stringify(d)}),m("Cuenta y firma actualizadas","success")):(await u("/api/mail/accounts",{method:"POST",body:JSON.stringify(d)}),m("Cuenta conectada correctamente. Sincronizando...","success")),t.accountsModalOpen=!1,await f(),await x()}catch(c){m(c?.message||"No se pudo guardar la cuenta","error")}})}}function i(){if(!b)return;let e=["mail-shell",t.drawerOpen?"mail-drawer-open":"",t.selectedMessageId?"mail-mobile-reading":""].filter(Boolean).join(" ");b.innerHTML=`
    <div class="${e}">
      ${D()}
      ${F()}
      ${z()}
    </div>
    ${q()}
    ${U()}
  `,J()}async function Q(e=!1){if(b=document.getElementById("mail-inbox-root"),!b)return;let a=k();e||a!==S?(S=a,t.selectedAccountId=null,t.selectedMessageId=null,t.detail=null,await f(),await x(),O()):i()}window.TurboMail={mount:Q,openComposer:y};})();
