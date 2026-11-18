"use strict";(()=>{function A(){try{let e=localStorage.getItem("turbonetwork_session");if(e){let l=JSON.parse(e);if(l&&l.token)return String(l.token)}}catch{}return""}function L(){let e=window;return(typeof e.activeTenantId=="string"&&e.activeTenantId.trim()?e.activeTenantId.trim():"")||localStorage.getItem("turbonetwork_active_tenant")||"turbonetwork"}async function b(e,l={}){let a=A(),n=L(),r={"Content-Type":"application/json",...l.headers||{}};a&&(r.Authorization=`Bearer ${a}`),n&&(r["x-tenant-id"]=n);let m=await fetch(e,{...l,headers:r}),s=await m.text(),o={};try{o=s?JSON.parse(s):{}}catch{o={raw:s}}if(!m.ok)throw new Error(o?.error||o?.message||`Error HTTP ${m.status}`);return o}var t={accounts:[],folders:[],messages:[],totalMessages:0,selectedAccountId:null,selectedFolderRole:"inbox",searchQuery:"",onlyUnread:!1,selectedMessageId:null,detail:null,showRemoteImages:!1,loadingList:!1,loadingDetail:!1,syncing:!1,drawerOpen:!1,composerOpen:!1,accountsModalOpen:!1,editingAccountId:null,composerAttachments:[],replyToMessageId:null,editingAvatarDataUrl:"",clearAccountAvatar:!1},x=null,S=null,B="";function i(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function p(e,l="info"){let a=window.showToast;typeof a=="function"?a(e,l):console.log(`[Mail ${l}]`,e)}function P(e){if(!e)return"";let l=new Date(e);if(isNaN(l.getTime()))return"";let a=new Date;return l.getFullYear()===a.getFullYear()&&l.getMonth()===a.getMonth()&&l.getDate()===a.getDate()?l.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):l.toLocaleDateString([],{day:"2-digit",month:"short"})}function _(e){return e?e<1024?`${e} B`:e<1024*1024?`${(e/1024).toFixed(1)} KB`:`${(e/(1024*1024)).toFixed(1)} MB`:"0 B"}function R(e,l){let a=(e||l||"?").trim(),n=a.split(/\s+/);return n.length>=2?(n[0][0]+n[1][0]).toUpperCase():a.slice(0,2).toUpperCase()}function D(e){if(!e)return"";if(e.startsWith("/api/mail/")){let l=A(),a=L(),n=e.includes("?")?"&":"?";return`${e}${l?`${n}token=${encodeURIComponent(l)}`:""}${a?`&tenantId=${encodeURIComponent(a)}`:""}`}return e}function $(e,l,a,n,r="w-8 h-8 text-[11px]"){let m=D(a);return`
    <div class="${r} relative rounded-full shrink-0 overflow-hidden flex items-center justify-center font-bold text-white"
      style="background:${i(n||"#3b82f6")}">
      <span>${i(R(e,l))}</span>
      ${m?`<img src="${i(m)}" alt="" loading="lazy" class="absolute inset-0 w-full h-full object-cover" onerror="this.remove()" />`:""}
    </div>
  `}function O(e){return t.folders.filter(l=>l.role===e&&(!t.selectedAccountId||l.account_id===t.selectedAccountId)).reduce((l,a)=>l+Number(a.unread_count||0),0)}function F(){let e=t.folders.filter(a=>a.role==="inbox").reduce((a,n)=>a+Number(n.unread_count||0),0),l=document.getElementById("nav-mail-badge");l&&(e>0?(l.textContent=e>99?"99+":String(e),l.className="sidebar-text ml-auto px-1.5 py-0.5 rounded-md text-[9.5px] font-mono font-bold bg-blue-600 text-white"):(l.textContent=String(t.accounts.length||0),l.className="sidebar-text ml-auto px-1.5 py-0.5 rounded-md text-[9.5px] font-mono font-semibold bg-slate-200/60 dark:bg-white/5 text-slate-500 dark:text-slate-400"))}async function h(){let[e,l]=await Promise.all([b("/api/mail/accounts"),b("/api/mail/folders")]);t.accounts=e.accounts||[],t.folders=l.folders||[],F()}async function g(){t.loadingList=!0,u();try{let e=new URLSearchParams;t.selectedAccountId&&e.set("accountId",String(t.selectedAccountId)),t.selectedFolderRole==="starred"?e.set("starred","1"):e.set("folder",t.selectedFolderRole),t.onlyUnread&&e.set("unread","1"),t.searchQuery.trim()&&e.set("q",t.searchQuery.trim()),e.set("limit","50");let l=await b(`/api/mail/messages?${e.toString()}`);t.messages=l.items||[],t.totalMessages=l.total||0}catch(e){p(e?.message||"Error cargando correos","error")}finally{t.loadingList=!1,u()}}async function U(e){t.selectedMessageId=e,t.loadingDetail=!0,t.showRemoteImages=!1,u();try{let l=await b(`/api/mail/messages/${e}`);if(t.detail=l,!l.message.is_read){await b(`/api/mail/messages/${e}`,{method:"PATCH",body:JSON.stringify({isRead:!0})}).catch(()=>{});let a=t.messages.find(n=>n.id===e);a&&(a.is_read=!0),l.message.is_read=!0,h().then(()=>u()).catch(()=>{})}}catch(l){p(l?.message||"No se pudo abrir el correo","error")}finally{t.loadingDetail=!1,u()}}async function z(e,l,a){a?.stopPropagation();try{await b(`/api/mail/messages/${e}`,{method:"PATCH",body:JSON.stringify({isStarred:!l})});let n=t.messages.find(r=>r.id===e);n&&(n.is_starred=!l),t.detail?.message.id===e&&(t.detail.message.is_starred=!l),u()}catch(n){p(n?.message||"Error actualizando destacado","error")}}async function j(e,l){try{await b(`/api/mail/messages/${e}`,{method:"PATCH",body:JSON.stringify({moveToRole:l})}),p(l==="spam"?"Movido a Spam":l==="trash"?"Movido a Papelera":"Movido a Recibidos","success"),t.selectedMessageId===e&&(t.selectedMessageId=null,t.detail=null),await Promise.all([h(),g()])}catch(a){p(a?.message||"No se pudo mover el correo","error")}}async function q(e,l=!1){try{await b(`/api/mail/messages/${e}${l?"?permanent=1":""}`,{method:"DELETE"}),p(l?"Correo eliminado definitivamente":"Correo enviado a la papelera","success"),t.selectedMessageId===e&&(t.selectedMessageId=null,t.detail=null),await Promise.all([h(),g()])}catch(a){p(a?.message||"Error eliminando correo","error")}}async function J(){if(!(t.syncing||t.accounts.length===0)){t.syncing=!0,u();try{let e=t.selectedAccountId?t.accounts.filter(a=>a.id===t.selectedAccountId):t.accounts,l=0;for(let a of e){let n=await b(`/api/mail/accounts/${a.id}/sync`,{method:"POST",body:"{}"});l+=Number(n.syncedMessages||0)}await Promise.all([h(),g()]),p(l>0?`${l} correo(s) sincronizados`:"Bandeja actualizada","success")}catch(e){p(e?.message||"Error al sincronizar","error")}finally{t.syncing=!1,u()}}}function Q(){S&&(S.close(),S=null);let e=A(),l=L();if(!e)return;let a=`/api/mail/events?token=${encodeURIComponent(e)}${l?`&tenantId=${encodeURIComponent(l)}`:""}`;try{S=new EventSource(a),S.addEventListener("mail",()=>{h().then(()=>g()).catch(()=>{})})}catch{}}function H(e){if(t.accounts.length===0){p("Primero conecta una cuenta de correo.","info"),t.accountsModalOpen=!0,t.editingAccountId=null,u();return}t.composerOpen=!0,t.composerAttachments=[],t.replyToMessageId=e?.replyToMessageId||null,u(),setTimeout(()=>{let l=document.getElementById("mail-comp-account"),a=document.getElementById("mail-comp-to"),n=document.getElementById("mail-comp-cc"),r=document.getElementById("mail-comp-subject"),m=document.getElementById("mail-comp-editor"),s=e?.accountId||t.selectedAccountId||t.accounts[0]?.id;l&&s&&(l.value=String(s)),a&&(a.value=e?.to||""),n&&(n.value=e?.cc||""),r&&(r.value=e?.subject||"");let o=t.accounts.find(y=>y.id===Number(s)),d=e?.htmlBody||"";o&&o.signatureHtml&&(e?.isReply?o.signatureDefaultReply:o.signatureDefaultNew)&&(d=`${d?d+"<br>":"<p><br></p>"}<div class="tn-mail-signature-preview" style="border-top:1px solid #e2e8f0;padding-top:8px;margin-top:12px;">${o.signatureHtml}</div>`),m&&(m.innerHTML=d),(e?.to?m:a)?.focus()},30)}function E(e,l,a){let n=t.selectedFolderRole===e,r=e==="inbox"||e==="spam"||e==="drafts"?O(e):0;return`
    <button type="button" data-mail-folder="${e}"
      class="mail-folder-btn w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition ${n?"active shadow-sm":""}">
      <span class="w-4 h-4 shrink-0">${a}</span>
      <span class="truncate">${l}</span>
      ${r>0?`<span class="ml-auto px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${n?"bg-white/20 text-white":"bg-blue-500/15 text-blue-600 dark:text-blue-400"}">${r}</span>`:""}
    </button>
  `}function V(){return`
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
        ${E("inbox","Recibidos",'<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/></svg>')}
        ${E("starred","Destacados",'<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>')}
        ${E("sent","Enviados",'<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>')}
        ${E("drafts","Borradores",'<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>')}
        ${E("spam","Spam",'<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>')}
        ${E("trash","Papelera",'<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>')}
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
            ${e.avatarUrl?$(e.displayName,e.email,e.avatarUrl,e.color,"w-5 h-5 text-[9px]"):`<span class="w-2.5 h-2.5 rounded-full shrink-0" style="background:${i(e.color)}"></span>`}
            <span class="truncate flex-1 text-left">${i(e.displayName||e.email)}</span>
            ${e.status==="error"?`<span class="text-[10px] text-rose-500" title="${i(e.lastError)}">\u26A0</span>`:Number(e.unreadCount||0)>0?`<span class="text-[10px] font-mono mail-text-muted">${e.unreadCount}</span>`:""}
          </button>
        `).join("")}
      </div>
    </aside>
  `}function G(){return`
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
            <input type="search" id="mail-search-input" value="${i(t.searchQuery)}" placeholder="Buscar asunto, remitente..."
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
               </div>`:t.loadingList&&t.messages.length===0?'<div class="p-8 text-center text-xs mail-text-muted">Cargando correos...</div>':t.messages.length===0?'<div class="p-8 text-center text-xs mail-text-muted">No hay correos en esta carpeta.</div>':t.messages.map(l=>{let a=t.selectedMessageId===l.id,n=l.from_name||l.from_email||"(desconocido)";return`
                        <div data-mail-open="${l.id}"
                          class="mail-msg-row p-3 cursor-pointer transition flex gap-2.5 items-start ${a?"active":""}">
                          ${$(l.from_name,l.from_email,l.sender_avatar_url,l.account_color,"w-8 h-8 text-[11px]")}
                          <div class="flex-1 min-w-0">
                            <div class="flex items-center justify-between gap-1">
                              <span class="text-[12.5px] truncate ${l.is_read?"font-medium mail-text-sec":"font-bold mail-title"}">${i(n)}</span>
                              <span class="text-[10.5px] mail-text-muted shrink-0">${P(l.date)}</span>
                            </div>
                            <div class="flex items-center gap-1.5 mt-0.5">
                              ${l.is_read?"":'<span class="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>'}
                              <p class="text-xs truncate ${l.is_read?"mail-text-sec":"font-semibold mail-title"}">${i(l.subject)}</p>
                            </div>
                            <p class="text-[11px] mail-text-muted truncate mt-0.5">${i(l.snippet)}</p>
                            <div class="flex items-center justify-between mt-1">
                              <span class="text-[10px] mail-text-muted truncate">${i(l.account_email)}</span>
                              <div class="flex items-center gap-1.5">
                                ${l.has_attachments?'<span class="text-[11px] mail-text-muted" title="Tiene adjuntos">\u{1F4CE}</span>':""}
                                <button type="button" data-mail-star="${l.id}" data-starred="${l.is_starred?"1":"0"}"
                                  class="text-sm leading-none ${l.is_starred?"text-amber-400":"mail-text-muted hover:text-amber-400"}">\u2605</button>
                              </div>
                            </div>
                          </div>
                        </div>
                      `}).join("")}
      </div>
    </div>
  `}function K(){if(!t.selectedMessageId)return`
      <div class="mail-reader-pane items-center justify-center text-center p-8">
        <div class="max-w-xs space-y-2 mail-text-muted">
          <svg class="w-12 h-12 mx-auto opacity-60" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
          <p class="text-sm font-semibold mail-title">Selecciona un correo para leerlo</p>
          <p class="text-xs mail-text-muted">Puedes responder, reenviar, marcar como spam o gestionar firmas por cada cuenta.</p>
        </div>
      </div>
    `;if(t.loadingDetail||!t.detail)return'<div class="mail-reader-pane items-center justify-center text-xs mail-text-muted">Cargando mensaje...</div>';let e=t.detail.message,l=t.detail.attachments||[],a=e.body_html_sanitized||`<pre class="whitespace-pre-wrap font-sans">${i(e.body_text)}</pre>`;t.showRemoteImages&&(a=a.replace(/data-blocked-src=(["'])([^"']+)\1\s+src=(["'])[^"']+\3/gi,'src="$2"'));let n=(e.to_list||[]).map(r=>r.name?`${r.name} <${r.address}>`:r.address).join(", ");return`
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
          <h2 class="text-lg font-bold text-slate-900 dark:text-white">${i(e.subject)}</h2>
          <div class="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs mail-text-muted">
            <div class="flex items-center gap-2.5">
              ${$(e.from_name,e.from_email,e.sender_avatar_url,e.account_color,"w-9 h-9 text-xs")}
              <div>
                <span class="font-semibold mail-title">${i(e.from_name||e.from_email)}</span>
                ${e.from_name?`<span class="ml-1">&lt;${i(e.from_email)}&gt;</span>`:""}
                <div class="text-[11px] mt-0.5">Para: ${i(n||e.account_email)}</div>
              </div>
            </div>
            <div class="text-right">
              <div>${new Date(e.date).toLocaleString()}</div>
              <div class="text-[10.5px] text-slate-400">Cuenta: ${i(e.account_email)}</div>
            </div>
          </div>
        </div>

        ${e.has_remote_images&&!t.showRemoteImages?`<div class="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between gap-2 text-xs text-amber-700 dark:text-amber-300">
                 <span>Se bloquearon im\xE1genes externas por privacidad.</span>
                 <button type="button" id="mail-btn-show-images" class="px-2.5 py-1 rounded-lg bg-amber-500 text-white font-semibold">Mostrar im\xE1genes</button>
               </div>`:""}

        <div class="mail-html-body">${a}</div>

        ${l.length>0?`<div class="space-y-2">
                 <div class="text-xs font-bold text-slate-600 dark:text-slate-300">Adjuntos (${l.length})</div>
                 <div class="flex flex-wrap gap-2">
                   ${l.map(r=>`
                     <a href="/api/mail/messages/${e.id}/attachments/${r.id}?token=${encodeURIComponent(A())}"
                       target="_blank"
                       class="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs hover:border-blue-500 transition">
                       <span>\u{1F4CE}</span>
                       <span class="font-medium truncate max-w-[180px]">${i(r.filename)}</span>
                       <span class="text-slate-400">(${_(r.size_bytes)})</span>
                     </a>
                   `).join("")}
                 </div>
               </div>`:""}
      </div>
    </div>
  `}function N(){return t.composerAttachments.map((e,l)=>`
    <span class="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[11px] flex items-center gap-1.5">
      ${i(e.filename)} (${_(e.size)})
      <button type="button" data-rm-att="${l}" class="font-bold hover:text-rose-500">\xD7</button>
    </span>
  `).join("")}function W(){return t.composerOpen?`
    <dialog id="mail-composer-dialog" class="mail-native-dialog" aria-labelledby="mail-comp-title">
      <div class="w-full h-full rounded-2xl sm:rounded-2xl mail-modal-card flex flex-col max-h-[92dvh] overflow-hidden">
        <div class="px-4 py-3 mail-pane-header flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
            <h3 id="mail-comp-title" class="text-sm font-bold mail-title">Nuevo Correo</h3>
          </div>
          <div class="flex items-center gap-1">
            <button type="button" id="mail-comp-expand" title="Ampliar / Reducir" class="mail-toolbar-btn mail-text-muted">\u2922</button>
            <button type="button" id="mail-comp-close" aria-label="Cerrar" class="mail-toolbar-btn mail-text-muted">\u2715</button>
          </div>
        </div>

        <div class="p-4 space-y-2.5 overflow-y-auto flex-1">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label for="mail-comp-account" class="text-[11px] font-semibold mail-text-muted">De (Cuenta)</label>
              <select id="mail-comp-account" class="mail-input w-full mt-0.5 px-3 py-1.5 rounded-xl text-xs">
                ${t.accounts.map(e=>`<option value="${e.id}">${i(e.displayName||e.email)} (${i(e.email)})</option>`).join("")}
              </select>
            </div>
            <div>
              <div class="flex items-center justify-between">
                <label for="mail-comp-to" class="text-[11px] font-semibold mail-text-muted">Para</label>
                <button type="button" id="mail-comp-toggle-cc" class="text-[10.5px] font-semibold text-blue-500 hover:underline">CC / CCO</button>
              </div>
              <input id="mail-comp-to" type="text" autofocus placeholder="destinatario@dominio.com" class="mail-input w-full mt-0.5 px-3 py-1.5 rounded-xl text-xs" />
            </div>
          </div>

          <div id="mail-comp-cc-row" class="hidden grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label for="mail-comp-cc" class="text-[11px] font-semibold mail-text-muted">CC</label>
              <input id="mail-comp-cc" type="text" placeholder="cc1@dominio.com, cc2@..." class="mail-input w-full mt-0.5 px-3 py-1.5 rounded-xl text-xs" />
            </div>
            <div>
              <label for="mail-comp-bcc" class="text-[11px] font-semibold mail-text-muted">CCO (Oculto)</label>
              <input id="mail-comp-bcc" type="text" placeholder="cco@dominio.com" class="mail-input w-full mt-0.5 px-3 py-1.5 rounded-xl text-xs" />
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div class="sm:col-span-2">
              <label for="mail-comp-subject" class="text-[11px] font-semibold mail-text-muted">Asunto</label>
              <input id="mail-comp-subject" type="text" placeholder="Asunto del correo" class="mail-input w-full mt-0.5 px-3 py-1.5 rounded-xl text-xs" />
            </div>
            <div>
              <label for="mail-comp-template" class="text-[11px] font-semibold mail-text-muted">Plantilla r\xE1pida</label>
              <select id="mail-comp-template" class="mail-input w-full mt-0.5 px-2.5 py-1.5 rounded-xl text-xs">
                <option value="">Insertar plantilla...</option>
                <option value="saludo">Saludo corporativo</option>
                <option value="soporte">Seguimiento t\xE9cnico</option>
                <option value="cobranza">Recordatorio de pago</option>
              </select>
            </div>
          </div>

          <div class="rounded-xl border mail-divider overflow-hidden">
            <div class="px-2 py-1.5 bg-slate-50 dark:bg-white/[0.04] border-b mail-divider flex flex-wrap items-center gap-1">
              <select id="mail-comp-block" title="Formato de bloque" class="mail-input px-1.5 py-1 rounded text-[11px]">
                <option value="P">P\xE1rrafo</option>
                <option value="H2">T\xEDtulo</option>
                <option value="H3">Subt\xEDtulo</option>
                <option value="BLOCKQUOTE">Cita</option>
              </select>
              <span class="w-px h-4 bg-slate-300 dark:bg-white/15 mx-0.5"></span>
              <button type="button" data-cmd="bold" title="Negrita" class="mail-toolbar-btn font-bold">B</button>
              <button type="button" data-cmd="italic" title="Cursiva" class="mail-toolbar-btn italic">I</button>
              <button type="button" data-cmd="underline" title="Subrayado" class="mail-toolbar-btn underline">U</button>
              <button type="button" data-cmd="strikeThrough" title="Tachado" class="mail-toolbar-btn line-through">S</button>
              <span class="w-px h-4 bg-slate-300 dark:bg-white/15 mx-0.5"></span>
              <label title="Color de texto" class="mail-toolbar-btn cursor-pointer flex items-center gap-1">
                <span class="text-[11px] font-bold">A</span>
                <input type="color" id="mail-comp-forecolor" value="#1e293b" class="w-4 h-4 p-0 border-0 bg-transparent cursor-pointer">
              </label>
              <label title="Resaltado" class="mail-toolbar-btn cursor-pointer flex items-center gap-1">
                <span class="text-[11px] px-1 rounded bg-amber-300 text-slate-900">ab</span>
                <input type="color" id="mail-comp-hilite" value="#fef08a" class="w-4 h-4 p-0 border-0 bg-transparent cursor-pointer">
              </label>
              <span class="w-px h-4 bg-slate-300 dark:bg-white/15 mx-0.5"></span>
              <button type="button" data-cmd="justifyLeft" title="Alinear izquierda" class="mail-toolbar-btn">\u2B05</button>
              <button type="button" data-cmd="justifyCenter" title="Centrar" class="mail-toolbar-btn">\u2B0C</button>
              <button type="button" data-cmd="justifyRight" title="Alinear derecha" class="mail-toolbar-btn">\u27A1</button>
              <span class="w-px h-4 bg-slate-300 dark:bg-white/15 mx-0.5"></span>
              <button type="button" data-cmd="insertUnorderedList" title="Lista con vi\xF1etas" class="mail-toolbar-btn">\u2022 Lista</button>
              <button type="button" data-cmd="insertOrderedList" title="Lista numerada" class="mail-toolbar-btn">1. Lista</button>
              <button type="button" data-cmd="insertHorizontalRule" title="L\xEDnea separadora" class="mail-toolbar-btn">\u2014</button>
              <button type="button" id="mail-comp-link" title="Insertar enlace" class="mail-toolbar-btn">\u{1F517}</button>
              <button type="button" data-cmd="removeFormat" title="Limpiar formato" class="mail-toolbar-btn">\u2715Fmt</button>
            </div>
            <div id="mail-comp-editor" contenteditable="true" data-placeholder="Escribe tu mensaje aqu\xED... (tambi\xE9n puedes arrastrar archivos)" class="mail-editor-area"></div>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <label class="cursor-pointer px-3 py-1.5 rounded-xl mail-btn-subtle text-xs font-medium">
              \u{1F4CE} Adjuntar archivos
              <input type="file" id="mail-comp-files" multiple class="hidden" />
            </label>
            <div id="mail-comp-att-chips" class="flex flex-wrap items-center gap-1.5">
              ${N()}
            </div>
          </div>
        </div>

        <div class="px-4 py-3 border-t mail-divider flex items-center justify-between gap-2">
          <span class="text-[11px] mail-text-muted hidden sm:inline">Esc para cerrar</span>
          <div class="flex items-center gap-2 ml-auto">
            <button type="button" id="mail-comp-cancel" class="px-3.5 py-2 rounded-xl text-xs font-medium mail-btn-subtle">Cancelar</button>
            <button type="button" id="mail-comp-send" class="mail-btn-primary px-4 py-2 rounded-xl text-xs font-semibold shadow-sm">Enviar correo</button>
          </div>
        </div>
      </div>
    </dialog>
  `:""}function Y(){if(!t.accountsModalOpen)return"";let e=t.editingAccountId&&t.accounts.find(l=>l.id===t.editingAccountId)||null;return`
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
                     ${t.accounts.map(l=>`
                       <div class="p-3 rounded-xl border border-slate-200 dark:border-white/10 flex items-center justify-between gap-2">
                         <div class="min-w-0">
                           <div class="flex items-center gap-1.5">
                             <span class="w-2.5 h-2.5 rounded-full" style="background:${i(l.color)}"></span>
                             <span class="text-xs font-bold truncate">${i(l.displayName||l.email)}</span>
                           </div>
                           <div class="text-[11px] text-slate-400 truncate">${i(l.email)}</div>
                         </div>
                         <div class="flex items-center gap-1 shrink-0">
                           <button type="button" data-acc-edit="${l.id}" class="px-2 py-1 rounded-lg bg-slate-100 dark:bg-white/10 text-[11px] font-medium">Editar / Firma</button>
                           <button type="button" data-acc-del="${l.id}" class="px-2 py-1 rounded-lg text-rose-600 hover:bg-rose-500/10 text-[11px]">Eliminar</button>
                         </div>
                       </div>
                     `).join("")}
                   </div>
                 </div>`:""}

          <form id="mail-acc-form" class="space-y-3 pt-3 border-t border-slate-200 dark:border-white/10">
            <div class="text-xs font-bold text-slate-800 dark:text-white">
              ${e?`Editando: ${i(e.email)}`:"Conectar Nueva Cuenta (IMAP / SMTP)"}
            </div>
            <div id="mail-acc-hint" class="text-[11px] text-blue-600 dark:text-blue-400 hidden"></div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label class="text-[11px] font-semibold text-slate-500">Correo electr\xF3nico</label>
                <input id="mail-f-email" type="email" required value="${i(e?.email||"")}" ${e?"readonly":""}
                  placeholder="soporte@tuempresa.com" class="w-full mt-0.5 px-3 py-1.5 rounded-xl text-xs bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10" />
              </div>
              <div>
                <label class="text-[11px] font-semibold text-slate-500">Nombre visible</label>
                <input id="mail-f-name" type="text" value="${i(e?.displayName||"")}" placeholder="Soporte TurboNetwork"
                  class="w-full mt-0.5 px-3 py-1.5 rounded-xl text-xs bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10" />
              </div>
              <div>
                <label class="text-[11px] font-semibold text-slate-500">Color identificador</label>
                <input id="mail-f-color" type="color" value="${i(e?.color||"#3b82f6")}" class="w-full h-8 mt-0.5 rounded-xl bg-transparent cursor-pointer" />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label class="text-[11px] font-semibold text-slate-500">Usuario IMAP/SMTP</label>
                <input id="mail-f-user" type="text" value="${i(e?.username||"")}" placeholder="soporte@tuempresa.com"
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
                <input id="mail-f-imap-host" type="text" required value="${i(e?.imapHost||"")}" placeholder="imap.gmail.com"
                  class="w-full mt-0.5 px-3 py-1.5 rounded-xl text-xs bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10" />
              </div>
              <div>
                <label class="text-[11px] font-semibold text-slate-500">Puerto IMAP</label>
                <input id="mail-f-imap-port" type="number" required value="${e?.imapPort||993}"
                  class="w-full mt-0.5 px-3 py-1.5 rounded-xl text-xs bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10" />
              </div>
              <div class="col-span-2 sm:col-span-1">
                <label class="text-[11px] font-semibold text-slate-500">Servidor SMTP</label>
                <input id="mail-f-smtp-host" type="text" required value="${i(e?.smtpHost||"")}" placeholder="smtp.gmail.com"
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

            <div class="space-y-1.5 pt-2 border-t mail-divider">
              <label class="text-[11px] font-semibold mail-text-muted">Foto de perfil del buz\xF3n (opcional)</label>
              <div class="flex flex-wrap items-center gap-3">
                <div id="mail-f-avatar-preview">
                  ${$(e?.displayName,e?.email,t.clearAccountAvatar?"":t.editingAvatarDataUrl||e?.avatarUrl,e?.color||"#3b82f6","w-11 h-11 text-sm")}
                </div>
                <label class="cursor-pointer px-3 py-1.5 rounded-xl mail-btn-subtle text-xs font-medium">
                  \u{1F4F7} Subir foto
                  <input type="file" id="mail-f-avatar-file" accept="image/png,image/jpeg,image/webp,image/gif" class="hidden" />
                </label>
                ${e?.avatarUrl||t.editingAvatarDataUrl?'<button type="button" id="mail-f-avatar-clear" class="px-2.5 py-1.5 rounded-xl text-xs text-rose-500 hover:bg-rose-500/10">Quitar foto</button>':""}
              </div>
            </div>

            <div class="space-y-1.5 pt-2 border-t mail-divider">
              <label class="text-[11px] font-semibold mail-text-muted">Firma de correo (HTML)</label>
              <textarea id="mail-f-sig" rows="3" placeholder="<p><strong>Equipo Soporte</strong><br>TurboNetwork ISP</p>"
                class="mail-input w-full px-3 py-2 rounded-xl text-xs font-mono">${i(e?.signatureHtml||"")}</textarea>
              <div class="flex flex-wrap gap-4 text-xs">
                <label class="flex items-center gap-1.5"><input id="mail-f-sig-new" type="checkbox" ${e?e.signatureDefaultNew?"checked":"":"checked"} /> Incluir firma en correos nuevos</label>
                <label class="flex items-center gap-1.5"><input id="mail-f-sig-reply" type="checkbox" ${e?e.signatureDefaultReply?"checked":"":"checked"} /> Incluir firma en respuestas</label>
              </div>
            </div>

            <div id="mail-acc-dns-box" class="hidden p-2.5 rounded-xl border mail-divider text-[11px] space-y-1"></div>

            <div class="flex flex-wrap items-center justify-between gap-2 pt-2">
              <div class="flex items-center gap-2">
                <button type="button" id="mail-acc-test" class="mail-btn-subtle px-3.5 py-2 rounded-xl text-xs font-semibold">Probar conexi\xF3n</button>
                <button type="button" id="mail-acc-dns-check" class="mail-btn-subtle px-3 py-2 rounded-xl text-xs font-semibold">Verificar SPF / DMARC</button>
              </div>
              <button type="submit" class="mail-btn-primary px-4 py-2 rounded-xl text-xs font-semibold">${e?"Guardar cambios":"Conectar y Guardar"}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `}function X(){if(!x)return;x.querySelectorAll("[data-mail-folder]").forEach(a=>{a.onclick=()=>{t.selectedFolderRole=a.dataset.mailFolder||"inbox",t.selectedMessageId=null,t.detail=null,t.drawerOpen=!1,g()}}),x.querySelectorAll("[data-mail-account]").forEach(a=>{a.onclick=()=>{let n=a.dataset.mailAccount;t.selectedAccountId=n==="all"?null:Number(n),t.selectedMessageId=null,t.detail=null,t.drawerOpen=!1,g()}}),x.querySelectorAll("[data-mail-open]").forEach(a=>{a.onclick=()=>U(Number(a.dataset.mailOpen))}),x.querySelectorAll("[data-mail-star]").forEach(a=>{a.onclick=n=>z(Number(a.dataset.mailStar),a.dataset.starred==="1",n)});let e=(a,n)=>{let r=document.getElementById(a);r&&(r.onclick=n)};e("mail-btn-compose",()=>H()),e("mail-btn-drawer-open",()=>{t.drawerOpen=!0,u()}),e("mail-btn-drawer-close",()=>{t.drawerOpen=!1,u()}),e("mail-mobile-back",()=>{t.selectedMessageId=null,t.detail=null,u()}),e("mail-btn-sync",()=>J()),e("mail-btn-unread-filter",()=>{t.onlyUnread=!t.onlyUnread,g()}),e("mail-btn-manage-accounts",()=>{t.accountsModalOpen=!0,t.editingAccountId=null,u()}),e("mail-empty-connect",()=>{t.accountsModalOpen=!0,t.editingAccountId=null,u()});let l=document.getElementById("mail-search-input");if(l&&(l.onkeydown=a=>{a.key==="Enter"&&(t.searchQuery=l.value,g())}),t.detail){let a=t.detail.message;e("mail-btn-show-images",()=>{t.showRemoteImages=!0,u()}),e("mail-btn-toggle-unread",async()=>{await b(`/api/mail/messages/${a.id}`,{method:"PATCH",body:JSON.stringify({isRead:!1})});let r=t.messages.find(m=>m.id===a.id);r&&(r.is_read=!1),a.is_read=!1,await h(),u()}),e("mail-btn-spam",()=>j(a.id,"spam")),e("mail-btn-not-spam",()=>j(a.id,"inbox")),e("mail-btn-delete",()=>q(a.id,a.folder_role==="trash"));let n=`<br><br><blockquote style="border-left:2px solid #cbd5e1;padding-left:10px;color:#64748b;">El ${new Date(a.date).toLocaleString()}, ${i(a.from_name||a.from_email)} escribi\xF3:<br>${a.body_html_sanitized||i(a.body_text)}</blockquote>`;e("mail-btn-reply",()=>H({accountId:a.account_id,to:a.reply_to||a.from_email,subject:a.subject.toLowerCase().startsWith("re:")?a.subject:`Re: ${a.subject}`,htmlBody:n,replyToMessageId:a.id,isReply:!0})),e("mail-btn-reply-all",()=>{let r=[...a.to_list||[],...a.cc_list||[]].map(m=>m.address).filter(m=>m&&m.toLowerCase()!==a.account_email.toLowerCase()&&m.toLowerCase()!==a.from_email.toLowerCase());H({accountId:a.account_id,to:a.from_email,cc:r.join(", "),subject:a.subject.toLowerCase().startsWith("re:")?a.subject:`Re: ${a.subject}`,htmlBody:n,replyToMessageId:a.id,isReply:!0})}),e("mail-btn-forward",()=>H({accountId:a.account_id,subject:a.subject.toLowerCase().startsWith("fwd:")?a.subject:`Fwd: ${a.subject}`,htmlBody:n,isReply:!0}))}if(t.composerOpen){let a=document.getElementById("mail-composer-dialog");if(a&&!a.open){try{a.showModal()}catch{}a.addEventListener("close",()=>{t.composerOpen&&(t.composerOpen=!1,u())})}let n=()=>{t.composerOpen=!1,a?.open&&a.close(),u()};e("mail-comp-close",n),e("mail-comp-cancel",n),e("mail-comp-expand",()=>{a?.classList.toggle("mail-composer-expanded")}),e("mail-comp-toggle-cc",()=>{document.getElementById("mail-comp-cc-row")?.classList.toggle("hidden")}),x.querySelectorAll("[data-cmd]").forEach(c=>{c.onclick=()=>{document.execCommand(c.dataset.cmd||"",!1),document.getElementById("mail-comp-editor")?.focus()}});let r=document.getElementById("mail-comp-block");r&&(r.onchange=()=>{document.execCommand("formatBlock",!1,`<${r.value}>`),document.getElementById("mail-comp-editor")?.focus()});let m=document.getElementById("mail-comp-forecolor");m&&(m.onchange=()=>document.execCommand("foreColor",!1,m.value));let s=document.getElementById("mail-comp-hilite");s&&(s.onchange=()=>document.execCommand("hiliteColor",!1,s.value));let o=document.getElementById("mail-comp-template");o&&(o.onchange=()=>{let c=document.getElementById("mail-comp-editor"),f=document.getElementById("mail-comp-subject");if(!c)return;let v={saludo:{subject:"Comunicaci\xF3n importante - TurboNetwork",body:"<p>Estimado(a) cliente,</p><p>Esperamos que se encuentre muy bien. Nos comunicamos con usted para brindarle la siguiente informaci\xF3n:</p><p><br></p>"},soporte:{subject:"Actualizaci\xF3n de soporte t\xE9cnico",body:"<p>Hola,</p><p>Hemos revisado su reporte t\xE9cnico y nuestro equipo ya se encuentra trabajando en su solicitud. Le mantendremos informado por este medio.</p>"},cobranza:{subject:"Recordatorio de estado de cuenta",body:"<p>Estimado(a) cliente,</p><p>Le recordamos amablemente que su recibo del servicio de internet se encuentra pr\xF3ximo a vencer. Puede realizar el pago y enviarnos su comprobante respondiendo a este correo.</p>"}}[o.value];v&&(f&&!f.value.trim()&&(f.value=v.subject),c.innerHTML=v.body+c.innerHTML,o.value="")}),e("mail-comp-link",()=>{let c=prompt("URL del enlace (https://...):");c&&document.execCommand("createLink",!1,c)});let d=()=>{let c=document.getElementById("mail-comp-att-chips");c&&(c.innerHTML=N(),c.querySelectorAll("[data-rm-att]").forEach(f=>{f.onclick=()=>{t.composerAttachments.splice(Number(f.dataset.rmAtt),1),d()}}))},y=async c=>{for(let f of c){let I=await new Promise((v,C)=>{let M=new FileReader;M.onload=()=>{let T=String(M.result||"");v(T.includes(",")?T.split(",")[1]:T)},M.onerror=()=>C(M.error),M.readAsDataURL(f)});t.composerAttachments.push({filename:f.name,contentBase64:I,contentType:f.type||"application/octet-stream",size:f.size})}d()},w=document.getElementById("mail-comp-files");w&&(w.onchange=async()=>{await y(Array.from(w.files||[])),w.value=""});let k=document.getElementById("mail-comp-editor");k&&(k.ondragover=c=>{c.preventDefault()},k.ondrop=async c=>{c.dataTransfer?.files?.length&&(c.preventDefault(),await y(Array.from(c.dataTransfer.files)))}),d(),e("mail-comp-send",async()=>{let c=Number(document.getElementById("mail-comp-account").value),f=document.getElementById("mail-comp-to").value,I=document.getElementById("mail-comp-cc")?.value||"",v=document.getElementById("mail-comp-bcc")?.value||"",C=document.getElementById("mail-comp-subject").value,M=document.getElementById("mail-comp-editor").innerHTML;try{await b("/api/mail/send",{method:"POST",body:JSON.stringify({accountId:c,to:f,cc:I,bcc:v,subject:C,html:M,replyToMessageId:t.replyToMessageId||void 0,includeSignature:!1,attachments:t.composerAttachments})}),t.composerOpen=!1,a?.open&&a.close(),p("Correo enviado correctamente","success"),await g()}catch(T){p(T?.message||"No se pudo enviar el correo","error")}})}if(t.accountsModalOpen){e("mail-acc-close",()=>{t.accountsModalOpen=!1,t.editingAvatarDataUrl="",t.clearAccountAvatar=!1,u()}),e("mail-acc-new",()=>{t.editingAccountId=null,t.editingAvatarDataUrl="",t.clearAccountAvatar=!1,u()}),x.querySelectorAll("[data-acc-edit]").forEach(s=>{s.onclick=()=>{t.editingAccountId=Number(s.dataset.accEdit),t.editingAvatarDataUrl="",t.clearAccountAvatar=!1,u()}}),x.querySelectorAll("[data-acc-del]").forEach(s=>{s.onclick=async()=>{confirm("\xBFEliminar esta cuenta y sus correos sincronizados en este tenant?")&&(await b(`/api/mail/accounts/${s.dataset.accDel}`,{method:"DELETE"}),t.editingAccountId===Number(s.dataset.accDel)&&(t.editingAccountId=null),await h(),await g(),p("Cuenta eliminada","success"))}});let a=document.getElementById("mail-f-email");a&&!t.editingAccountId&&(a.onblur=async()=>{let s=a.value.trim();if(s.includes("@"))try{let o=await b(`/api/mail/accounts/autodetect?email=${encodeURIComponent(s)}`),d=document.getElementById("mail-f-user"),y=document.getElementById("mail-f-imap-host"),w=document.getElementById("mail-f-imap-port"),k=document.getElementById("mail-f-imap-ssl"),c=document.getElementById("mail-f-smtp-host"),f=document.getElementById("mail-f-smtp-port"),I=document.getElementById("mail-f-smtp-ssl"),v=document.getElementById("mail-acc-hint");d&&!d.value&&(d.value=s),y&&(y.value=o.imapHost||""),w&&(w.value=String(o.imapPort||993)),k&&(k.checked=!!o.imapSecure),c&&(c.value=o.smtpHost||""),f&&(f.value=String(o.smtpPort||465)),I&&(I.checked=!!o.smtpSecure),v&&o.hint&&(v.textContent=o.hint,v.classList.remove("hidden"))}catch{}});let n=()=>({email:document.getElementById("mail-f-email").value.trim(),displayName:document.getElementById("mail-f-name").value.trim(),color:document.getElementById("mail-f-color").value,username:document.getElementById("mail-f-user").value.trim(),password:document.getElementById("mail-f-pass").value,imapHost:document.getElementById("mail-f-imap-host").value.trim(),imapPort:Number(document.getElementById("mail-f-imap-port").value),imapSecure:document.getElementById("mail-f-imap-ssl").checked,smtpHost:document.getElementById("mail-f-smtp-host").value.trim(),smtpPort:Number(document.getElementById("mail-f-smtp-port").value),smtpSecure:document.getElementById("mail-f-smtp-ssl").checked,signatureHtml:document.getElementById("mail-f-sig").value,signatureDefaultNew:document.getElementById("mail-f-sig-new").checked,signatureDefaultReply:document.getElementById("mail-f-sig-reply").checked,avatarDataUrl:t.editingAvatarDataUrl||void 0,clearAvatar:t.clearAccountAvatar||void 0}),r=document.getElementById("mail-f-avatar-file");r&&(r.onchange=()=>{let s=r.files?.[0];if(!s)return;if(s.size>2*1024*1024){p("La imagen debe pesar menos de 2 MB","error");return}let o=new FileReader;o.onload=()=>{t.editingAvatarDataUrl=String(o.result||""),t.clearAccountAvatar=!1;let d=document.getElementById("mail-f-avatar-preview");d&&(d.innerHTML=$(document.getElementById("mail-f-name")?.value,document.getElementById("mail-f-email")?.value,t.editingAvatarDataUrl,document.getElementById("mail-f-color")?.value||"#3b82f6","w-11 h-11 text-sm"))},o.readAsDataURL(s)}),e("mail-f-avatar-clear",()=>{t.editingAvatarDataUrl="",t.clearAccountAvatar=!0;let s=document.getElementById("mail-f-avatar-preview");s&&(s.innerHTML=$(document.getElementById("mail-f-name")?.value,document.getElementById("mail-f-email")?.value,"",document.getElementById("mail-f-color")?.value||"#3b82f6","w-11 h-11 text-sm"))}),e("mail-acc-dns-check",async()=>{let s=document.getElementById("mail-f-email")?.value.trim();if(!s||!s.includes("@")){p("Ingresa un correo v\xE1lido para verificar DNS","info");return}let o=document.getElementById("mail-acc-dns-box");o&&(o.classList.remove("hidden"),o.innerHTML=`<span class="mail-text-muted">Consultando SPF, DKIM y DMARC de ${i(s.split("@")[1])}...</span>`);try{let d=await b(`/api/mail/deliverability?email=${encodeURIComponent(s)}`);o&&(o.innerHTML=`
            <div class="font-bold mail-title">Diagn\xF3stico DNS (${i(d.domain)})</div>
            <div class="flex flex-wrap gap-2">
              <span class="${d.spf.ok?"text-emerald-500":"text-rose-500"}">SPF: ${d.spf.ok?"OK":"Falta"}</span>
              <span class="${d.dkim.ok?"text-emerald-500":"text-amber-500"}">DKIM: ${d.dkim.ok?"OK":"No detectado"}</span>
              <span class="${d.dmarc.ok?"text-emerald-500":"text-amber-500"}">DMARC: ${i(d.dmarc.policy)}</span>
            </div>
            ${(d.recommendations||[]).map(y=>`<div class="text-amber-500">\u2022 ${i(y)}</div>`).join("")}
          `)}catch(d){o&&(o.innerHTML=`<span class="text-rose-500">${i(d?.message||"Error consultando DNS")}</span>`)}}),e("mail-acc-test",async()=>{try{p("Probando conexi\xF3n IMAP/SMTP...","info");let s=await b("/api/mail/accounts/test",{method:"POST",body:JSON.stringify(n())});s.imapOk&&s.smtpOk?p(`Conexi\xF3n exitosa (${s.foldersCount} carpetas encontradas)`,"success"):p(s.error||"Fall\xF3 la prueba de conexi\xF3n","error")}catch(s){p(s?.message||"Error probando conexi\xF3n","error")}});let m=document.getElementById("mail-acc-form");m&&(m.onsubmit=async s=>{s.preventDefault();let o=n();try{t.editingAccountId?(await b(`/api/mail/accounts/${t.editingAccountId}`,{method:"PUT",body:JSON.stringify(o)}),p("Cuenta y firma actualizadas","success")):(await b("/api/mail/accounts",{method:"POST",body:JSON.stringify(o)}),p("Cuenta conectada correctamente. Sincronizando...","success")),t.accountsModalOpen=!1,await h(),await g()}catch(d){p(d?.message||"No se pudo guardar la cuenta","error")}})}}function u(){if(!x)return;let e=["mail-shell",t.drawerOpen?"mail-drawer-open":"",t.selectedMessageId?"mail-mobile-reading":""].filter(Boolean).join(" ");x.innerHTML=`
    <div class="${e}">
      ${V()}
      ${G()}
      ${K()}
    </div>
    ${W()}
    ${Y()}
  `,X()}async function Z(e=!1){if(x=document.getElementById("mail-inbox-root"),!x)return;let l=L();e||l!==B?(B=l,t.selectedAccountId=null,t.selectedMessageId=null,t.detail=null,await h(),await g(),Q()):u()}window.TurboMail={mount:Z,openComposer:H};})();
