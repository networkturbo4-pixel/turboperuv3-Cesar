"use strict";(()=>{function E(t,e,n="info"){let o=n==="danger"?"error":n==="warning"?"warning":n==="success"?"success":"info",s=window;if(typeof s.showToast=="function"){s.showToast(`${t}: ${e}`,o);return}console.log(`[Toast ${o}] ${t}: ${e}`)}function et(t){return new Promise(e=>{let n=document.getElementById("omnichannel-confirm-dialog");n&&n.remove();let o=document.createElement("dialog");o.id="omnichannel-confirm-dialog",o.className="crm-modal-surface",o.setAttribute("data-style","modern-clean"),o.style.cssText="padding:0;border:none;border-radius:18px;max-width:420px;width:92%;box-shadow:0 24px 60px rgba(0,0,0,0.45);background:var(--widget-bg,#ffffff);color:var(--text-primary,#0f172a);";let s=t.variant==="danger"?"#ef4444":t.variant==="warning"?"#f59e0b":"#4f46e5";o.innerHTML=`
      <div style="padding:20px 22px;">
        <h3 style="margin:0 0 8px 0;font-size:16px;font-weight:700;">${t.title}</h3>
        <p style="margin:0 0 18px 0;font-size:13px;line-height:1.5;opacity:0.85;">${t.message}</p>
        <div style="display:flex;justify-content:flex-end;gap:10px;">
          <button type="button" id="omni-confirm-cancel" style="padding:8px 14px;border-radius:10px;border:1px solid rgba(148,163,184,0.35);background:transparent;color:inherit;font-size:12.5px;font-weight:600;cursor:pointer;">
            ${t.cancelText||"Cancelar"}
          </button>
          <button type="button" id="omni-confirm-ok" style="padding:8px 16px;border-radius:10px;border:none;background:${s};color:#fff;font-size:12.5px;font-weight:600;cursor:pointer;">
            ${t.confirmText||"Confirmar"}
          </button>
        </div>
      </div>
    `,document.body.appendChild(o);let r=u=>{try{o.close()}catch{}o.remove(),e(u)};o.querySelector("#omni-confirm-cancel")?.addEventListener("click",()=>r(!1)),o.querySelector("#omni-confirm-ok")?.addEventListener("click",()=>r(!0)),o.addEventListener("cancel",u=>{u.preventDefault(),r(!1)}),typeof o.showModal=="function"?o.showModal():r(window.confirm(`${t.title}

${t.message}`))})}var kt={sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',moon:'<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',building:'<rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>',palette:'<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',save:'<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',smartphone:'<rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>',externalLink:'<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',type:'<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>',bell:'<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',zap:'<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',sliders:'<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',table:'<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="9" x2="9" y2="21"/><line x1="15" y1="9" x2="15" y2="21"/>',eye:'<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',eyeOff:'<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>',plus:'<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',edit:'<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',trash:'<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',users:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',lock:'<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',sparkles:'<path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z"/>',logOut:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',menu:'<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>',close:'<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',chevronUp:'<polyline points="18 15 12 9 6 15"/>',chevronDown:'<polyline points="6 9 12 15 18 9"/>',checkCircle:'<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',info:'<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',alertTriangle:'<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',xCircle:'<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',layout:'<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>',check:'<polyline points="20 6 9 17 4 12"/>',messageSquare:'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',link:'<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',whatsapp:'<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/><path d="M9.5 9.5c.3 1.8 1.7 3.2 3.5 3.5l1.2-1.2c.2-.2.5-.2.7-.1.7.3 1.4.5 2.1.6.3 0 .5.3.5.6v2c0 .3-.2.6-.6.6C10.9 15.5 8.5 13.1 8.5 7.1c0-.4.3-.6.6-.6h2c.3 0 .6.2.6.5.1.7.3 1.4.6 2.1.1.2.1.5-.1.7L9.5 9.5z"/>',facebook:'<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>',instagram:'<rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>',tiktok:'<path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/>',qrCode:'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M7 7h.01M17 7h.01M7 17h.01"/>',bot:'<rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4M8 16h.01M16 16h.01"/>',megaphone:'<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',send:'<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',refresh:'<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',copy:'<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',tag:'<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',stickyNote:'<path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z"/><path d="M15 3v6h6"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>',image:'<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',video:'<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>',music:'<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',fileText:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',paperclip:'<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',slash:'<line x1="16" y1="3" x2="8" y2="21"/>',arrowLeft:'<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',arrowRight:'<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',play:'<polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/>',pause:'<rect x="6" y="4" width="4" height="16" fill="currentColor"/><rect x="14" y="4" width="4" height="16" fill="currentColor"/>',square:'<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>',circle:'<circle cx="12" cy="12" r="10"/>',clock:'<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',mapPin:'<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',smile:'<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>',undo:'<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',rotateCw:'<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',mic:'<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>',cornerUpLeft:'<polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>',cornerUpRight:'<polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/>',forward:'<polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/>',uploadCloud:'<polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>',chevronRight:'<polyline points="9 18 15 12 9 6"/>',volume2:'<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>',volumeX:'<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>',maximize:'<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>',minus:'<line x1="5" y1="12" x2="19" y2="12"/>',search:'<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'};function c(t,e=16,n=""){let o=kt[t]||kt.info;return`<svg class="crm-svg-icon ${n}" width="${e}" height="${e}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${o}</svg>`}var $t={all:"ri-message-3-fill",whatsapp:"ri-whatsapp-fill",facebook:"ri-facebook-circle-fill",instagram:"ri-instagram-fill",tiktok:"ri-tiktok-fill"};function Tt(t,e=18,n=""){return`<i class="${$t[t]||$t.all} crm-brand-filled-icon ${n}" style="font-size:${e}px;line-height:1;display:inline-flex;align-items:center;justify-content:center;" aria-hidden="true"></i>`}function Jt(t,e){if(!e.points||e.points.length===0)return;if(t.save(),t.shadowColor="transparent",t.shadowBlur=0,t.shadowOffsetX=0,t.shadowOffsetY=0,t.globalAlpha=1,t.globalCompositeOperation="source-over",t.strokeStyle=e.color,t.lineWidth=e.width,t.lineCap="round",t.lineJoin="round",t.fillStyle="transparent",e.points.length===1){t.beginPath(),t.arc(e.points[0].x,e.points[0].y,Math.max(.5,e.width/2),0,Math.PI*2),t.fillStyle=e.color,t.fill(),t.restore();return}if(t.beginPath(),e.points.length===2){t.moveTo(e.points[0].x,e.points[0].y),t.lineTo(e.points[1].x,e.points[1].y),t.stroke(),t.restore();return}t.moveTo(e.points[0].x,e.points[0].y);for(let s=1;s<e.points.length-1;s++){let r=e.points[s],u=e.points[s+1],m=(r.x+u.x)/2,h=(r.y+u.y)/2;t.quadraticCurveTo(r.x,r.y,m,h)}let n=e.points[e.points.length-1],o=e.points[e.points.length-2];t.quadraticCurveTo(o.x,o.y,n.x,n.y),t.stroke(),t.restore()}function tt(t,e,n,o,s,r){if(typeof t.roundRect=="function"){t.roundRect(e,n,o,s,Math.min(r,Math.min(Math.abs(o),Math.abs(s))/2));return}let u=Math.min(Math.abs(o),Math.abs(s)),m=Math.min(r,u/2);t.beginPath(),t.moveTo(e+m,n),t.lineTo(e+o-m,n),t.quadraticCurveTo(e+o,n,e+o,n+m),t.lineTo(e+o,n+s-m),t.quadraticCurveTo(e+o,n+s,e+o-m,n+s),t.lineTo(e+m,n+s),t.quadraticCurveTo(e,n+s,e,n+s-m),t.lineTo(e,n+m),t.quadraticCurveTo(e,n,e+m,n),t.closePath()}function dt(t){let{imageFile:e,onSend:n,onCancel:o}=t,s=document.createElement("div");s.className="wa-photo-editor-overlay",document.body.appendChild(s);let r=new FileReader;r.onload=()=>{let m=new Image;m.onload=()=>{u(m)},m.src=String(r.result)},r.readAsDataURL(e);function u(m){let h=0,v="#10b981",x=7,$="none",k=[],R=[],D=[],a=null,q=!1,L=!1,G=null,z=0,N=0,A=0,se=0,ne=0,Y=0,me=36,V=0,ue=null,Z=0,xe=0,ce=0,ie=0;s.innerHTML=`
      <div class="wa-photo-editor-container">
        <!-- Barra Superior WhatsApp Tools (Dise\xF1o Responsivo en 2 filas compactas) -->
        <header class="wa-editor-topbar">
          <div class="wa-editor-topbar-row1">
            <div class="wa-editor-actions-left">
              <button type="button" class="wa-editor-btn" id="wa-btn-cancel" title="Cancelar">
                ${c("close",18)}
              </button>
              <button type="button" class="wa-editor-btn" id="wa-btn-rotate" title="Girar 90\xB0">
                ${c("rotateCw",16)}
              </button>
              <button type="button" class="wa-editor-btn" id="wa-btn-undo" title="Deshacer acci\xF3n">
                ${c("undo",16)}
              </button>
              <button type="button" class="wa-editor-btn" id="wa-btn-delete-selected" title="Eliminar elemento seleccionado" style="color:#ef4444;display:none;">
                ${c("trash",16)}
              </button>
            </div>

            <div class="wa-editor-styling-right">
              <!-- Selector de Grosor de Trazos -->
              <div class="wa-stroke-palette" id="wa-stroke-palette" title="Grosor de trazo">
                <button type="button" class="wa-stroke-btn" data-width="3" title="Trazo fino (3px)">
                  <span style="width:4px;height:4px;"></span>
                </button>
                <button type="button" class="wa-stroke-btn active" data-width="7" title="Trazo medio (7px)">
                  <span style="width:7px;height:7px;"></span>
                </button>
                <button type="button" class="wa-stroke-btn" data-width="14" title="Trazo grueso (14px)">
                  <span style="width:11px;height:11px;"></span>
                </button>
                <button type="button" class="wa-stroke-btn" data-width="24" title="Trazo extra grueso (24px)">
                  <span style="width:15px;height:15px;"></span>
                </button>
              </div>

              <!-- Paleta de Color R\xE1pida -->
              <div class="wa-color-palette" id="wa-color-palette">
                ${["#10b981","#3b82f6","#ef4444","#f59e0b","#8b5cf6","#ffffff","#000000"].map((w,T)=>`
                    <button type="button" class="wa-color-swatch ${T===0?"active":""}" style="background-color:${w};" data-color="${w}"></button>
                  `).join("")}
              </div>
            </div>
          </div>

          <!-- Selector de Herramientas Desplazable Horizontalmente para M\xF3vil y PC -->
          <div class="wa-editor-tools-scroller">
            <button type="button" class="wa-tool-pill" data-tool="pencil" title="Dibujar trazo libre">
              ${c("edit",16)}
              <span class="wa-tool-name">L\xE1piz</span>
            </button>
            <button type="button" class="wa-tool-pill" data-tool="arrow" title="Insertar Flecha">
              ${c("arrowRight",16)}
              <span class="wa-tool-name">Flecha</span>
            </button>
            <button type="button" class="wa-tool-pill" data-tool="rect" title="Insertar Rect\xE1ngulo / Cuadrado">
              ${c("square",16)}
              <span class="wa-tool-name">Cuadrado</span>
            </button>
            <button type="button" class="wa-tool-pill" data-tool="circle" title="Insertar C\xEDrculo">
              ${c("circle",16)}
              <span class="wa-tool-name">C\xEDrculo</span>
            </button>
            <button type="button" class="wa-tool-pill" data-tool="text" title="Escribir Texto">
              ${c("type",16)}
              <span class="wa-tool-name">Texto</span>
            </button>
            <button type="button" class="wa-tool-pill" data-tool="emoji" title="Stickers y Emoticones">
              ${c("smile",16)}
              <span class="wa-tool-name">Sticker</span>
            </button>
            <button type="button" class="wa-tool-pill" id="wa-tool-location" title="A\xF1adir Sticker de Ubicaci\xF3n">
              ${c("mapPin",16)}
              <span class="wa-tool-name">Ubicaci\xF3n</span>
            </button>
            <button type="button" class="wa-tool-pill" id="wa-tool-clock" title="A\xF1adir Sticker de Hora / Reloj">
              ${c("clock",16)}
              <span class="wa-tool-name">Reloj</span>
            </button>
          </div>
        </header>

        <!-- Submen\xFA Popover de Emojis / Stickers -->
        <div class="wa-stickers-popover" id="wa-stickers-popover" style="display:none;">
          <div class="wa-stickers-grid">
            ${["\u{1F525}","\u2B50","\u2764\uFE0F","\u2705","\u{1F4CD}","\u{1F552}","\u{1F3AF}","\u{1F680}","\u{1F4AF}","\u{1F44D}","\u{1F4BC}","\u{1F4E6}","\u26A0\uFE0F","\u{1F4A1}","\u{1F389}","\u{1F44F}","\u{1F91D}","\u26A1","\u{1F31F}","\u{1F4CC}"].map(w=>`
                <button type="button" class="wa-emoji-item" data-emoji="${w}">${w}</button>
              `).join("")}
          </div>
        </div>

        <!-- Modal overlay para Texto y Ubicaci\xF3n (Reemplazo sin window.prompt) -->
        <div class="wa-editor-modal" id="wa-input-modal" style="display:none;">
          <div class="wa-editor-modal-card">
            <h3 id="wa-input-modal-title">Escribir Texto</h3>
            <input type="text" id="wa-input-modal-text" class="form-control" placeholder="Escriba aqu\xED..." autocomplete="off" />
            <div class="wa-editor-modal-actions">
              <button type="button" class="btn btn-secondary btn-sm" id="wa-input-modal-cancel">Cancelar</button>
              <button type="button" class="btn btn-primary btn-sm" id="wa-input-modal-confirm">Aceptar</button>
            </div>
          </div>
        </div>

        <!-- \xC1rea Central de Lienzo / Canvas -->
        <div class="wa-editor-viewport" id="wa-editor-viewport">
          <canvas id="wa-photo-canvas"></canvas>
        </div>

        <!-- Barra Inferior WhatsApp: Pie de Foto Moderno Glassmorphism + Bot\xF3n Enviar Circular -->
        <footer class="wa-editor-bottombar">
          <div class="wa-editor-caption-card">
            <span class="wa-editor-caption-prefix">
              ${c("smile",18)}
            </span>
            <input
              type="text"
              id="wa-caption-input"
              class="wa-caption-input"
              placeholder="A\xF1adir un pie de foto..."
              autocomplete="off"
            />
          </div>
          <button type="button" class="wa-btn-send-photo" id="wa-btn-send" title="Enviar Foto a WhatsApp">
            ${c("send",19)}
          </button>
        </footer>
      </div>
    `;let P=s.querySelector("#wa-photo-canvas"),p=P.getContext("2d"),de=s.querySelector("#wa-editor-viewport"),fe=s.querySelector("#wa-stickers-popover"),J=s.querySelector("#wa-caption-input"),ee=s.querySelector("#wa-btn-delete-selected"),Xe=s.querySelector("#wa-input-modal"),rt=s.querySelector("#wa-input-modal-title"),Ee=s.querySelector("#wa-input-modal-text"),Te=s.querySelector("#wa-input-modal-cancel"),lt=s.querySelector("#wa-input-modal-confirm"),_e=null;function re(w,T){return new Promise(S=>{rt.textContent=w,Ee.value=T,Xe.style.display="flex",Ee.focus(),Ee.select(),_e=S})}let je=w=>{Xe.style.display="none",_e&&(_e(w),_e=null)};Te.addEventListener("click",()=>je(null)),lt.addEventListener("click",()=>je(Ee.value.trim()||null)),Ee.addEventListener("keydown",w=>{w.key==="Enter"?(w.preventDefault(),je(Ee.value.trim()||null)):w.key==="Escape"&&je(null)});function oe(){D.push({objects:JSON.parse(JSON.stringify(k)),strokes:JSON.parse(JSON.stringify(R))}),D.length>25&&D.shift()}function ve(){let w=h===90||h===270,T=w?m.naturalHeight:m.naturalWidth,S=w?m.naturalWidth:m.naturalHeight,f=Math.min(de.clientWidth-20,960),H=Math.min(de.clientHeight-20,680),M=Math.min(f/T,H/S,1);P.width=T,P.height=S,P.style.width=`${Math.round(T*M)}px`,P.style.height=`${Math.round(S*M)}px`,X()}function X(){p.clearRect(0,0,P.width,P.height),p.save(),p.translate(P.width/2,P.height/2),p.rotate(h*Math.PI/180);let w=h===90||h===270,T=w?P.height:P.width,S=w?P.width:P.height;p.drawImage(m,-T/2,-S/2,T,S),p.restore();for(let f of R)Jt(p,f);for(let f of k){p.save(),p.translate(f.x+f.width/2,f.y+f.height/2),p.rotate(f.rotation);let H=f.width/2,M=f.height/2;if(f.type==="rect")p.lineWidth=f.strokeWidth||6,p.strokeStyle=f.color,p.strokeRect(-H,-M,f.width,f.height);else if(f.type==="circle")p.beginPath(),p.lineWidth=f.strokeWidth||6,p.strokeStyle=f.color,p.ellipse(0,0,Math.abs(H),Math.abs(M),0,0,Math.PI*2),p.stroke();else if(f.type==="arrow"){let _=f.strokeWidth||7;p.beginPath(),p.lineWidth=_,p.strokeStyle=f.color,p.fillStyle=f.color,p.moveTo(-H,0),p.lineTo(H-_*2.5,0),p.stroke(),p.beginPath(),p.moveTo(H,0),p.lineTo(H-_*3.5,-_*2),p.lineTo(H-_*3.5,_*2),p.closePath(),p.fill()}else if(f.type==="text")p.font=`bold ${f.fontSize||36}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`,p.fillStyle=f.color,p.textAlign="center",p.textBaseline="middle",p.shadowColor="rgba(0,0,0,0.85)",p.shadowBlur=Math.round((f.fontSize||36)*.2),p.fillText(f.text||"",0,0);else if(f.type==="emoji")p.font=`${f.fontSize||64}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`,p.textAlign="center",p.textBaseline="middle",p.fillText(f.text||"\u2B50",0,0);else if(f.type==="location"){let _=f.width,O=f.height,i=O/2,l=O/50;p.save(),p.shadowColor="rgba(0, 0, 0, 0.28)",p.shadowBlur=Math.round(14*l),p.shadowOffsetX=0,p.shadowOffsetY=Math.round(4*l);let d=f.cardStyle==="dark";d?p.fillStyle="rgba(15, 23, 42, 0.9)":p.fillStyle="#ffffff",tt(p,-H,-M,_,O,i),p.fill(),p.restore(),p.strokeStyle=d?"rgba(255, 255, 255, 0.22)":"rgba(0, 0, 0, 0.08)",p.lineWidth=d?1.5:1,tt(p,-H,-M,_,O,i),p.stroke();let y=l,g=-H+20*y+6*y,b=-2*y;p.save(),p.translate(g,b),p.scale(y,y),p.beginPath(),p.ellipse(0,11,4.5,2,0,0,Math.PI*2),p.fillStyle="rgba(0, 0, 0, 0.22)",p.fill(),p.beginPath(),p.arc(0,-3,7.8,Math.PI*.8,Math.PI*.2,!0),p.lineTo(0,9.5),p.closePath(),p.fillStyle=f.color&&f.color!=="#ffffff"&&f.color!=="#000000"?f.color:"#ef4444",p.fill(),p.beginPath(),p.arc(0,-3,3,0,Math.PI*2),p.fillStyle="#ffffff",p.fill(),p.restore();let C=g+17*y;p.font=`bold ${f.fontSize||Math.round(20*y)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`,p.textAlign="left",p.textBaseline="middle",p.fillStyle=d?"#ffffff":"#0f172a",p.fillText(f.text||"Lima, Per\xFA",C,0)}else if(f.type==="clock"){let _=f.width,O=f.height,i=O/2,l=O/50;p.save(),p.shadowColor="rgba(0, 0, 0, 0.32)",p.shadowBlur=Math.round(14*l),p.shadowOffsetX=0,p.shadowOffsetY=Math.round(4*l);let d=f.cardStyle!=="white";d?p.fillStyle="rgba(15, 23, 42, 0.9)":p.fillStyle="#ffffff",tt(p,-H,-M,_,O,i),p.fill(),p.restore(),p.strokeStyle=d?"rgba(255, 255, 255, 0.22)":"rgba(0, 0, 0, 0.08)",p.lineWidth=d?1.5:1,tt(p,-H,-M,_,O,i),p.stroke();let y=-H+20*l+6*l,g=0,b=9.8*l;p.beginPath(),p.arc(y,g,b,0,Math.PI*2),p.fillStyle=d?"rgba(56, 189, 248, 0.25)":"rgba(37, 99, 235, 0.12)",p.fill(),p.strokeStyle=f.color&&f.color!=="#ffffff"&&f.color!=="#000000"?f.color:d?"#38bdf8":"#2563eb",p.lineWidth=2*l,p.stroke(),p.beginPath(),p.arc(y,g,1.8*l,0,Math.PI*2),p.fillStyle=d?"#38bdf8":"#2563eb",p.fill();let C=(f.text||"12:00").split(":"),W=parseInt(C[0],10)||12,F=parseInt(C[1],10)||0,U=(W%12+F/60)*(Math.PI/6)-Math.PI/2,Q=F*(Math.PI/30)-Math.PI/2;p.beginPath(),p.moveTo(y,g),p.lineTo(y+Math.cos(U)*(b*.54),g+Math.sin(U)*(b*.54)),p.strokeStyle=d?"#ffffff":"#0f172a",p.lineWidth=2.2*l,p.lineCap="round",p.stroke(),p.beginPath(),p.moveTo(y,g),p.lineTo(y+Math.cos(Q)*(b*.78),g+Math.sin(Q)*(b*.78)),p.strokeStyle=d?"#38bdf8":"#2563eb",p.lineWidth=1.6*l,p.lineCap="round",p.stroke();let B=y+17*l;p.font=`bold ${f.fontSize||Math.round(24*l)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace`,p.textAlign="left",p.textBaseline="middle",p.fillStyle=d?"#ffffff":"#0f172a",p.fillText(f.text||"12:00",B,0)}if(a===f.id){let _=Ce(),O=10*_,i=Math.max(8*_,8),l=26*_;p.strokeStyle="#ffffff",p.lineWidth=Math.max(2*_,2),p.setLineDash([6*_,6*_]),p.strokeRect(-H-O,-M-O,f.width+O*2,f.height+O*2),p.setLineDash([]);let d=[{x:-H-O,y:-M-O},{x:H+O,y:-M-O},{x:-H-O,y:M+O},{x:H+O,y:M+O}];for(let y of d)p.beginPath(),p.arc(y.x,y.y,i,0,Math.PI*2),p.fillStyle="#10b981",p.fill(),p.strokeStyle="#ffffff",p.lineWidth=Math.max(2*_,2),p.stroke();p.beginPath(),p.moveTo(0,-M-O),p.lineTo(0,-M-O-l),p.strokeStyle="#3b82f6",p.lineWidth=Math.max(2*_,2),p.stroke(),p.beginPath(),p.arc(0,-M-O-l,i,0,Math.PI*2),p.fillStyle="#3b82f6",p.fill(),p.strokeStyle="#ffffff",p.lineWidth=Math.max(2*_,2),p.stroke()}p.restore()}ee&&(ee.style.display=a?"inline-flex":"none")}function Ce(){let w=P.getBoundingClientRect();return w.width?P.width/w.width:1}function Ie(w){let T=P.getBoundingClientRect(),S="touches"in w&&w.touches.length>0?w.touches[0].clientX:w.clientX,f="touches"in w&&w.touches.length>0?w.touches[0].clientY:w.clientY,H=P.width/T.width,M=P.height/T.height;return{x:(S-T.left)*H,y:(f-T.top)*M}}function De(w,T){let S=Ce(),f=Math.max(30*S,30),H=26*S;for(let M=k.length-1;M>=0;M--){let _=k[M],O=_.x+_.width/2,i=_.y+_.height/2,l=w-O,d=T-i,y=Math.cos(-_.rotation),g=Math.sin(-_.rotation),b=l*y-d*g,C=l*g+d*y,W=_.width/2,F=_.height/2,U=10*S;if(a===_.id){if(Math.hypot(b,C-(-F-U-H))<=f)return{hitObject:_,handle:"rotate"};let Q=[{x:-W-U,y:-F-U},{x:W+U,y:-F-U},{x:-W-U,y:F+U},{x:W+U,y:F+U}];for(let B of Q)if(Math.hypot(b-B.x,C-B.y)<=f)return{hitObject:_,handle:"scale"}}if(Math.abs(b)<=W+U+15*S&&Math.abs(C)<=F+U+15*S)return{hitObject:_,handle:null}}return{hitObject:null,handle:null}}let Ne=w=>{let{x:T,y:S}=Ie(w);if(Z=T,xe=S,ce=T,ie=S,$==="pencil"){oe();let M=Math.max(1,Math.sqrt(Math.max(P.width,P.height)/720));ue={color:v,width:Math.round(x*M),points:[{x:T,y:S}]},R.push(ue),X(),w.cancelable&&w.preventDefault();return}let{hitObject:f,handle:H}=De(T,S);f?(a=f.id,z=T,N=S,A=f.x,se=f.y,ne=f.width,Y=f.height,me=f.fontSize||36,V=f.rotation||0,H==="scale"||H==="rotate"?(L=!0,G=H):q=!0,X(),w.cancelable&&w.preventDefault()):(a=null,X())},Ae=w=>{let{x:T,y:S}=Ie(w);if(ce=T,ie=S,$==="pencil"&&ue){let f=ue.points[ue.points.length-1];(!f||Math.hypot(T-f.x,S-f.y)>=2)&&(ue.points.push({x:T,y:S}),X()),w.cancelable&&w.preventDefault();return}if(q&&a){let f=k.find(H=>H.id===a);f&&(f.x=A+(T-z),f.y=se+(S-N),X()),w.cancelable&&w.preventDefault();return}if(L&&a&&G){let f=k.find(H=>H.id===a);if(f){let H=A+ne/2,M=se+Y/2;if(G==="scale"){let _=Math.hypot(T-H,S-M),O=Math.max(20,Math.hypot(z-H,N-M)),i=_/O,l=Math.max(28,Math.round(ne*i)),d=Math.max(28,Math.round(Y*i));f.x=H-l/2,f.y=M-d/2,f.width=l,f.height=d,me&&(f.fontSize=Math.max(14,Math.round(me*i)))}else if(G==="rotate"){let _=Math.atan2(S-M,T-H),O=Math.atan2(N-M,z-H);f.rotation=V+(_-O)}X()}w.cancelable&&w.preventDefault()}},te=()=>{let w=Math.hypot(Z-ce,xe-ie);if(a&&!L&&!ue&&w<8){let T=k.find(S=>S.id===a);T&&(T.type==="location"||T.type==="clock")&&(oe(),T.cardStyle=T.cardStyle==="white"?"dark":"white",X())}$==="pencil"&&ue&&(ue=null),(q||L)&&oe(),q=!1,L=!1,G=null};P.addEventListener("mousedown",Ne),window.addEventListener("mousemove",Ae),window.addEventListener("mouseup",te),P.addEventListener("touchstart",Ne,{passive:!1}),window.addEventListener("touchmove",Ae,{passive:!1}),window.addEventListener("touchend",te,{passive:!1}),s.querySelectorAll(".wa-color-swatch").forEach(w=>{w.addEventListener("click",()=>{if(s.querySelectorAll(".wa-color-swatch").forEach(T=>T.classList.remove("active")),w.classList.add("active"),v=w.getAttribute("data-color")||"#10b981",a){let T=k.find(S=>S.id===a);T&&(oe(),T.color=v,X())}})}),s.querySelectorAll(".wa-stroke-btn").forEach(w=>{w.addEventListener("click",()=>{if(s.querySelectorAll(".wa-stroke-btn").forEach(T=>T.classList.remove("active")),w.classList.add("active"),x=Number(w.getAttribute("data-width"))||7,a){let T=k.find(S=>S.id===a);if(T){oe();let S=Math.max(1,Math.sqrt(Math.max(P.width,P.height)/720));T.strokeWidth=Math.round(x*S),X()}}})}),ee.addEventListener("click",()=>{if(a){oe();let w=k.findIndex(T=>T.id===a);w!==-1&&k.splice(w,1),a=null,X()}}),window.addEventListener("keydown",w=>{if((w.key==="Delete"||w.key==="Backspace")&&a){let T=document.activeElement;if(T===J||T===Ee)return;oe();let S=k.findIndex(f=>f.id===a);S!==-1&&k.splice(S,1),a=null,X()}}),s.querySelectorAll(".wa-tool-pill[data-tool]").forEach(w=>{w.addEventListener("click",async()=>{let T=w.getAttribute("data-tool");if(T==="emoji"){fe.style.display=fe.style.display==="none"?"block":"none";return}if(fe.style.display="none",T==="pencil"){$=$==="pencil"?"none":"pencil",s.querySelectorAll(".wa-tool-pill").forEach(M=>M.classList.remove("active")),$==="pencil"&&w.classList.add("active");return}$="none",s.querySelectorAll(".wa-tool-pill").forEach(M=>M.classList.remove("active"));let S=Math.max(1,Math.max(P.width,P.height)/750),f=P.width/2,H=P.height/2;if(T==="arrow"){oe();let M=Math.round(180*S),_=Math.round(50*S),O={id:`arrow_${Date.now()}`,type:"arrow",x:f-M/2,y:H-_/2,width:M,height:_,rotation:0,color:v,strokeWidth:Math.round(x*S)};k.push(O),a=O.id,X()}else if(T==="rect"){oe();let M=Math.round(180*S),_={id:`rect_${Date.now()}`,type:"rect",x:f-M/2,y:H-M/2,width:M,height:M,rotation:0,color:v,strokeWidth:Math.round(x*S)};k.push(_),a=_.id,X()}else if(T==="circle"){oe();let M=Math.round(180*S),_={id:`circle_${Date.now()}`,type:"circle",x:f-M/2,y:H-M/2,width:M,height:M,rotation:0,color:v,strokeWidth:Math.round(x*S)};k.push(_),a=_.id,X()}else if(T==="text"){let M=await re("Escriba el texto para la foto:","Texto corporativo");if(M){oe();let _=Math.round(38*S),O=Math.round(Math.max(200,M.length*24)*S),i=Math.round(60*S),l={id:`text_${Date.now()}`,type:"text",text:M,x:f-O/2,y:H-i/2,width:O,height:i,rotation:0,color:v,fontSize:_};k.push(l),a=l.id,X()}}})}),s.querySelectorAll(".wa-emoji-item").forEach(w=>{w.addEventListener("click",()=>{let T=w.getAttribute("data-emoji")||"\u2B50";fe.style.display="none",oe();let S=Math.max(1,Math.max(P.width,P.height)/750),f=Math.round(100*S),H={id:`emoji_${Date.now()}`,type:"emoji",text:T,x:P.width/2-f/2,y:P.height/2-f/2,width:f,height:f,rotation:0,color:v,fontSize:Math.round(64*S)};k.push(H),a=H.id,X()})}),s.querySelector("#wa-tool-location")?.addEventListener("click",async()=>{let w=await re("Nombre de la ubicaci\xF3n para la foto:","Lima, Per\xFA")||"Ubicaci\xF3n Actual";oe();let T=Math.max(1,Math.sqrt(Math.max(P.width,P.height)/720)),S=Math.round(18*T);p.font=`bold ${S}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;let f=p.measureText(w),H=Math.round(f.width+68*T),M=Math.round(48*T),_={id:`loc_${Date.now()}`,type:"location",text:w,x:P.width/2-H/2,y:P.height/2-M/2,width:H,height:M,rotation:0,color:v==="#ffffff"?"#ef4444":v,fontSize:S,cardStyle:"white"};k.push(_),a=_.id,X()}),s.querySelector("#wa-tool-clock")?.addEventListener("click",()=>{let w=new Date,T=`${String(w.getHours()).padStart(2,"0")}:${String(w.getMinutes()).padStart(2,"0")}`;oe();let S=Math.max(1,Math.sqrt(Math.max(P.width,P.height)/720)),f=Math.round(22*S);p.font=`bold ${f}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace`;let H=p.measureText(T),M=Math.round(H.width+68*S),_=Math.round(48*S),O={id:`clock_${Date.now()}`,type:"clock",text:T,x:P.width/2-M/2,y:P.height/2-_/2,width:M,height:_,rotation:0,color:v==="#ffffff"?"#38bdf8":v,fontSize:f,cardStyle:"dark"};k.push(O),a=O.id,X()}),s.querySelector("#wa-btn-rotate")?.addEventListener("click",()=>{h=(h+90)%360,ve()}),s.querySelector("#wa-btn-undo")?.addEventListener("click",()=>{if(D.length>0){let w=D.pop();k.length=0,k.push(...w.objects),R.length=0,R.push(...w.strokes),a=null,X()}}),s.querySelector("#wa-btn-cancel")?.addEventListener("click",()=>{qe(),o&&o()});let ke=()=>{a=null,X();let w=P.toDataURL("image/jpeg",.9),T=J.value.trim(),S=e.name.replace(/\.[^/.]+$/,"")+"-editada.jpg";qe(),n({dataUrl:w,filename:S,caption:T})};s.querySelector("#wa-btn-send")?.addEventListener("click",ke),J.addEventListener("keydown",w=>{w.key==="Enter"&&(w.preventDefault(),ke())});function qe(){P.removeEventListener("mousedown",Ne),window.removeEventListener("mousemove",Ae),window.removeEventListener("mouseup",te),P.removeEventListener("touchstart",Ne),window.removeEventListener("touchmove",Ae),window.removeEventListener("touchend",te),s.remove()}ve(),window.addEventListener("resize",ve,{once:!0}),J.focus()}}function pt(t,e="WA"){let n=String(t||"").trim();if(!n)return e;let o=n.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/g);if(o&&o.length>=2)return(o[0][0]+o[1][0]).toUpperCase();if(o&&o.length===1)return o[0].slice(0,2).toUpperCase();let s=n.replace(/\D/g,"");return s.length>=2?s.slice(-2):e}function St(t,e=new Date){let n=r=>new Date(r.getFullYear(),r.getMonth(),r.getDate()).getTime(),s=Math.round((n(e)-n(t))/864e5);if(s===0)return"Hoy";if(s===1)return"Ayer";if(s>1&&s<7){let r=t.toLocaleDateString("es-PE",{weekday:"long"});return r.charAt(0).toUpperCase()+r.slice(1)}return t.toLocaleDateString("es-PE",{day:"2-digit",month:"long",year:"numeric"})}function Mt(t){return`${t.getFullYear()}-${t.getMonth()+1}-${t.getDate()}`}function j(t){return t?t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"):""}function Ue(t,e){let n=t||"read";return n==="queued"?`
      <span class="msg-checks check-queued" title="Enviando\u2026 se reintentar\xE1 autom\xE1ticamente al reconectar" role="img" aria-label="Enviando">
        ${c("clock",13)}
      </span>
    `:n==="failed"?`
      <span class="msg-checks check-failed" role="img" aria-label="No se pudo enviar" title="No se pudo enviar a WhatsApp">
        ${c("alertTriangle",13)}
      </span>
      <button type="button" class="msg-retry-btn js-retry-send" data-id="${e??""}" aria-label="Reintentar env\xEDo">
        ${c("refresh",11)}<span>Reintentar</span>
      </button>
    `:n==="sent"?`
      <span class="msg-checks check-sent" title="Enviado">
        <svg width="15" height="15" viewBox="0 0 16 15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 8.5L6.5 12L13 3.5"/>
        </svg>
      </span>
    `:n==="delivered"?`
      <span class="msg-checks check-delivered" title="Entregado">
        <svg width="18" height="15" viewBox="0 0 20 15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 8.5L5.5 12L12 3.5"/>
          <path d="M7 8.5L10.5 12L17 3.5"/>
        </svg>
      </span>
    `:`
    <span class="msg-checks check-read" title="Visto / Le\xEDdo">
      <svg width="18" height="15" viewBox="0 0 20 15" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 8.5L5.5 12L12 3.5"/>
        <path d="M7 8.5L10.5 12L17 3.5"/>
      </svg>
    </span>
  `}function yt(t){return`
    <div class="wa-media-failed-box" role="group" aria-label="Multimedia no disponible">
      <span class="wa-media-failed-icon" aria-hidden="true">${c("image",20)}</span>
      <span class="wa-media-failed-text">No se pudo descargar</span>
      ${t?`<button type="button" class="wa-media-retry-btn js-retry-media">${c("refresh",12)}<span>Reintentar</span></button>`:""}
    </div>
  `}function Me(t){if(!t)return[];try{let e=JSON.parse(t);return Array.isArray(e)?e.map(n=>String(n).trim()).filter(Boolean):[]}catch{return[]}}function Xt(t,e){return e.find(o=>o.name.toLowerCase()===t.toLowerCase())?.color||"#6366f1"}function ze(t,e,n="",o=""){let s=Xt(t,e);return`<span class="tag-pill-minimal ${n}" style="--tag-color:${s};" ${o}><span class="tag-dot"></span><span>${t}</span></span>`}function nt(t){return new Promise((e,n)=>{let o=new FileReader;o.onload=()=>e(String(o.result)),o.onerror=()=>n(new Error("No se pudo leer el archivo seleccionado")),o.readAsDataURL(t)})}function Lt(t){let e=(t||"").toLowerCase();return e.startsWith("image/")?"image":e.startsWith("video/")?"video":e.startsWith("audio/")?"audio":"document"}function ht(t){switch(t){case"image":return"image";case"video":return"video";case"audio":return"music";case"document":return"fileText";default:return"messageSquare"}}function Ve(t){switch(t){case"image":return"Foto";case"video":return"Video";case"audio":return"Audio";case"document":return"Documento";default:return"Texto"}}function _t(t){switch(t){case"whatsapp":return"whatsapp";case"facebook":return"facebook";case"instagram":return"instagram";case"tiktok":return"tiktok"}}function Kt(t){switch(t){case"whatsapp":return"WhatsApp";case"facebook":return"Facebook";case"instagram":return"Instagram";case"tiktok":return"TikTok"}}function Bt(t){let e=t.totalMessages||0,n=e>0?Math.min(99,Math.round(t.processedMessages/e*100)):25,o=typeof t.pct=="number"&&t.pct>0?t.pct:n,s="Sincronizando mensajes",r="Descargando conversaciones y mensajes en tiempo real...";t.channel==="whatsapp"?(s="Sincronizando chats de WhatsApp",r=e>0?`${t.processedMessages.toLocaleString("es-PE")} de ${e.toLocaleString("es-PE")} mensajes \xB7 ${t.chats.toLocaleString("es-PE")} chats`:"Conectando con WhatsApp y recibiendo chats..."):t.channel==="instagram"?(s="Sincronizando Instagram Direct",r="Descargando conversaciones y respuestas de Instagram..."):t.channel==="facebook"?(s="Sincronizando Facebook Messenger",r="Descargando conversaciones de la Fan Page comercial..."):t.channel==="all"&&(s="Sincronizando todas las redes",r="Descargando mensajes de WhatsApp, Instagram y Facebook...");let u=t.title||s,m=t.detail||r;return{pct:o,detail:m,title:u}}function Yt(t){if(!t||!t.active)return"";let{pct:e,detail:n,title:o}=Bt(t);return`
    <div class="wa-sync-banner" id="wa-sync-banner" role="status" aria-live="polite">
      <span class="wa-sync-spinner" aria-hidden="true"></span>
      <div class="wa-sync-text">
        <strong id="wa-sync-title">${o}</strong>
        <span id="wa-sync-detail">${n}</span>
      </div>
      <div class="wa-sync-bar"><i id="wa-sync-bar-fill" style="width:${e}%"></i></div>
    </div>
  `}var Je=new Map;function Ht(t){if(!t)return[];let e=/(https?:\/\/[^\s<>"']+)|(www\.[^\s<>"']+)/gi;return(t.match(e)||[]).map(o=>o.startsWith("http")?o:`https://${o}`)}function mt(t){return t?j(t).replace(/(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi,n=>`<a href="${n.startsWith("http")?n:`https://${n}`}" target="_blank" rel="noopener noreferrer" class="chat-inline-link" onclick="event.stopPropagation();">${n}</a>`):""}function ut(t){let e=Ht(t);if(e.length===0)return"";let n=e[0],o=n;try{o=new URL(n).hostname.replace(/^www\./,"")}catch{}let s=`https://www.google.com/s2/favicons?domain=${encodeURIComponent(o)}&sz=128`,r=Je.get(n);if(r){let u=r.title||o,m=r.description||"",h=r.image||"";return`
      <a href="${n}" target="_blank" rel="noopener noreferrer" class="wa-link-preview-card" onclick="event.stopPropagation();">
        ${h?`<div class="wa-link-preview-img-box"><img src="${h}" alt="" class="wa-link-preview-img" loading="lazy" onerror="this.src='${s}'; this.className='wa-link-preview-fallback-favicon';" /></div>`:`<div class="wa-link-preview-img-box" style="background:rgba(0,0,0,0.04);display:flex;align-items:center;justify-content:center;height:60px;"><img src="${s}" alt="" class="wa-link-preview-fallback-favicon" style="width:32px;height:32px;" /></div>`}
        <div class="wa-link-preview-info">
          <strong class="wa-link-preview-title">${j(u)}</strong>
          ${m?`<p class="wa-link-preview-desc">${j(m)}</p>`:""}
          <span class="wa-link-preview-domain">${c("link",11)} ${j(r.domain||o)}</span>
        </div>
      </a>
    `}return`
    <a href="${n}" target="_blank" rel="noopener noreferrer" class="wa-link-preview-card js-link-preview-target" data-url="${n}" onclick="event.stopPropagation();">
      <div class="wa-link-preview-info">
        <strong class="wa-link-preview-title">${j(o)}</strong>
        <span class="wa-link-preview-domain">${c("link",11)} ${j(o)}</span>
      </div>
    </a>
  `}async function Zt(){document.querySelectorAll(".js-link-preview-target:not([data-hydrated])").forEach(async e=>{e.setAttribute("data-hydrated","true");let n=e.getAttribute("data-url");if(n)try{let o=Je.get(n);if(o||(o=await fetch(`/api/link-preview?url=${encodeURIComponent(n)}`).then(v=>v.json()),o&&!o.error&&Je.set(n,o)),!o||o.error)return;let s=o.domain||"";try{s||(s=new URL(n).hostname.replace(/^www\./,""))}catch{}let r=o.title||s,u=o.description||"",m=o.image||"",h=o.favicon||`https://www.google.com/s2/favicons?domain=${encodeURIComponent(s)}&sz=128`;e.innerHTML=`
        ${m?`<div class="wa-link-preview-img-box"><img src="${m}" alt="" class="wa-link-preview-img" loading="lazy" onerror="this.src='${h}'; this.className='wa-link-preview-fallback-favicon';" /></div>`:`<div class="wa-link-preview-img-box" style="background:rgba(0,0,0,0.04);display:flex;align-items:center;justify-content:center;height:60px;"><img src="${h}" alt="" class="wa-link-preview-fallback-favicon" style="width:32px;height:32px;" /></div>`}
        <div class="wa-link-preview-info">
          <strong class="wa-link-preview-title">${j(r)}</strong>
          ${u?`<p class="wa-link-preview-desc">${j(u)}</p>`:""}
          <span class="wa-link-preview-domain">${c("link",11)} ${j(o.domain||s)}</span>
        </div>
      `}catch{}})}function en(t){switch(t){case"wa-qr":return"WhatsApp";case"wa-api":return"WhatsApp API";case"wa-chatbot":return"Chatbot IA";case"wa-broadcast":return"Masivo API";case"tiktok":return"TikTok";default:return"Meta Inbox"}}function tn(t){let e=t.media_type||"none",n=t.media_url||"";if(e==="none"||!n)return"";let o=t.media_filename||"archivo_adjunto";return e==="image"?`
      <div class="chat-media-attachment js-open-media-lightbox" data-media-type="image" data-media-url="${n}" data-media-title="${j(o)}" style="cursor:pointer;">
        <img src="${n}" alt="${j(o)}" loading="lazy" />
      </div>
    `:e==="video"?`
      <div class="chat-media-attachment js-open-media-lightbox" data-media-type="video" data-media-url="${n}" data-media-title="${j(o)}" style="cursor:pointer;position:relative;border-radius:10px;overflow:hidden;background:#000;">
        <video src="${n}" preload="metadata" style="max-height:240px;width:100%;object-fit:cover;pointer-events:none;"></video>
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.35);">
          <span style="width:44px;height:44px;border-radius:50%;background:rgba(0,0,0,0.65);color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,0.4);">
            ${c("play",20)}
          </span>
        </div>
      </div>
    `:e==="audio"?`
      <div class="chat-media-attachment wa-audio-bubble" data-audio-src="${n}">
        <button type="button" class="wa-audio-play-btn js-wa-audio-toggle" aria-label="Reproducir nota de voz">
          ${c("play",16)}
        </button>
        <div class="wa-audio-content">
          <div class="wa-audio-track-wrapper js-wa-audio-track">
            <div class="wa-audio-waveform-bars">
              ${[40,65,30,85,55,95,45,75,60,90,35,70,80,50,65,85,45,95,70,40].map(s=>`<span class="wa-wave-bar" style="height:${s}%;"></span>`).join("")}
            </div>
            <div class="wa-audio-scrubber-track">
              <div class="wa-audio-scrubber-fill js-wa-audio-fill" style="width: 0%;"></div>
            </div>
          </div>
          <div class="wa-audio-meta-row">
            <span class="wa-audio-time-label js-wa-audio-time">0:00</span>
            <div style="display:flex;align-items:center;gap:0.4rem;">
              <button type="button" class="wa-audio-speed-btn js-wa-audio-speed" title="Velocidad de reproducci\xF3n (1x, 1.5x, 2x)">1x</button>
              <span class="wa-audio-mic-indicator" title="Nota de voz">${c("mic",12)}</span>
            </div>
          </div>
        </div>
        <audio class="wa-audio-native-tag" src="${n}" preload="metadata"></audio>
      </div>
    `:`
    <div class="chat-media-attachment">
      <div class="chat-media-doc-card js-open-media-lightbox" data-media-type="document" data-media-url="${n}" data-media-title="${j(o)}" style="cursor:pointer;display:flex;align-items:center;gap:0.6rem;">
        ${c("fileText",20)}
        <div style="overflow:hidden;flex:1;">
          <strong style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${j(o)}</strong>
          <span style="font-size:0.7rem;opacity:0.8;">Clic para visualizar o descargar</span>
        </div>
        <a href="${n}" download="${j(o)}" title="Descargar documento" style="color:inherit;padding:0.25rem;display:inline-flex;" onclick="event.stopPropagation();">
          ${c("download",15)}
        </a>
      </div>
    </div>
  `}function Rt(t,e,n){let o=t.connections||{},s=t.conversations.filter(a=>{if(t.channelFilter!=="all"&&a.channel!==t.channelFilter)return!1;if(t.tagFilter&&t.tagFilter!=="all"){let q=Me(a.tags_json),L=a.tag&&a.tag.toLowerCase()===t.tagFilter.toLowerCase();if(!q.some(G=>G.toLowerCase()===t.tagFilter.toLowerCase())&&!L)return!1}if(t.searchQuery.trim()){let q=t.searchQuery.toLowerCase(),L=Me(a.tags_json).join(" ").toLowerCase();return a.contact_name.toLowerCase().includes(q)||a.contact_handle.toLowerCase().includes(q)||a.last_message_text.toLowerCase().includes(q)||L.includes(q)}return!0}),r=t.selectedConversationId!==null&&s.find(a=>a.id===t.selectedConversationId)||null,u=r?t.messages.filter(a=>a.conversation_id===r.id):[],m=r?t.notes.filter(a=>a.conversation_id===r.id):[],h=r?Me(r.tags_json):[],v=r?.assigned_user_id&&t.users.find(a=>a.id===r.assigned_user_id)||null,x=s.map(a=>{let q=r?.id===a.id,L=pt(a.contact_name,"WA"),G=Me(a.tags_json),z=G.slice(0,2),N=Math.max(0,G.length-2),A=a.assigned_user_id?t.users.find(se=>se.id===a.assigned_user_id):null;return`
        <button type="button" class="conv-item ${q?"active":""} js-select-conv" data-conv-id="${a.id}">
          <div class="conv-avatar" style="background:${a.avatar_color};">
            <span>${L||"WA"}</span>
            <span class="conv-channel-badge ch-${a.channel}" title="${Kt(a.channel)}">
              ${c(_t(a.channel),11)}
            </span>
          </div>
          <div style="flex:1;overflow:hidden;min-width:0;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:0.4rem;">
              <strong style="font-size:0.86rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${a.contact_name}
              </strong>
              <span style="font-size:0.7rem;color:var(--text-muted);flex:none;">${a.last_message_time}</span>
            </div>
            <p style="font-size:0.78rem;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:0.12rem;">
              ${a.last_message_text}
            </p>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:0.35rem;margin-top:0.32rem;">
              <div class="conv-tags-inline">
                ${z.length>0?z.map(se=>ze(se,t.tags)).join(""):`<span style="font-size:0.67rem;color:var(--text-muted);">${a.contact_handle}</span>`}
                ${N>0?`<span class="tag-pill-minimal" style="--tag-color:var(--text-muted);">+${N}</span>`:""}
                ${A?`<span style="font-size:0.65rem;color:var(--text-muted);" title="Asignado a ${A.full_name}">\u2022 ${A.full_name.split(" ")[0]}</span>`:""}
              </div>
              ${a.unread_count>0?`<span style="background:var(--btn-bg);color:var(--btn-text);font-size:0.66rem;font-weight:700;padding:0.06rem 0.42rem;border-radius:99px;flex:none;">
                      ${a.unread_count}
                    </span>`:""}
            </div>
          </div>
        </button>
      `}).join(""),$=(a,q)=>{let L=a.sender_type==="contact",G=a.sender_type==="chatbot",z=q===u.length-1,N=a.media_type==="audio",A=a.media_type==="sticker"||!!a.media_url?.includes("sticker"),se=a.media_type==="image"&&!A,ne=a.media_type==="video",Y=!!(a.reply_to_body||a.reply_to_media_url),me=a.reply_to_media_type==="image"||!!a.reply_to_media_url,V=Y?`
          <div class="chat-quoted-box js-jump-to-reply" data-target-id="${a.reply_to_id||""}" title="Clic para ir al mensaje citado">
            <div class="chat-quoted-inner">
              <div class="chat-quoted-sender">${j(a.reply_to_sender||"Mensaje")}</div>
              <div class="chat-quoted-body">
                ${me?`<span style="display:inline-flex;align-items:center;gap:0.25rem;font-weight:600;">${c("image",12)} Foto</span> `:""}
                ${j(a.reply_to_body||(me?"Foto":""))}
              </div>
            </div>
            ${a.reply_to_media_url&&me?`
              <div class="chat-quoted-thumb-box">
                <img src="${a.reply_to_media_url}" class="chat-quoted-thumb" alt="" />
              </div>
            `:""}
          </div>
        `:"",Z=a.id===t.lastSentMessageId?"chat-msg-highlight-pulse":"",ce=!!a.is_forwarded?`<div class="chat-msg-forwarded-label">${c("cornerUpRight",11)} <span>Reenviado</span></div>`:"",ie=Array.isArray(a.reactions_json)?a.reactions_json:[],p=`
        ${ie.length>0?`<div class="msg-reactions" aria-label="Reacciones">${Object.entries(ie.reduce((J,ee)=>(J[ee.emoji]=(J[ee.emoji]||0)+1,J),{})).map(([J,ee])=>`<span class="msg-reaction-chip">${j(J)}${ee>1?`<small>${ee}</small>`:""}</span>`).join("")}</div>`:""}
        <div class="chat-msg-actions-group">
          <button
            type="button"
            class="chat-msg-action-btn js-react-msg"
            data-id="${a.id}"
            title="Reaccionar"
            aria-label="Reaccionar con emoji"
          >
            ${c("smile",13)}
          </button>
          <button
            type="button"
            class="chat-msg-action-btn js-reply-msg"
            data-id="${a.id}"
            data-sender="${j(a.sender_name)}"
            data-body="${j(a.body||(a.media_type==="image"?"Foto":a.media_type?`[${a.media_type}]`:""))}"
            data-media-type="${a.media_type||"none"}"
            data-media-url="${a.media_url||""}"
            title="Responder"
          >
            ${c("cornerUpLeft",13)}
          </button>
          <button
            type="button"
            class="chat-msg-action-btn js-forward-msg"
            data-id="${a.id}"
            data-sender="${j(a.sender_name)}"
            data-body="${j(a.body||"")}"
            data-media-type="${a.media_type||"none"}"
            data-media-url="${a.media_url||""}"
            data-media-filename="${j(a.media_filename||"")}"
            title="Reenviar mensaje"
          >
            ${c("cornerUpRight",13)}
          </button>
        </div>
      `;if(N){let J=a.media_url||"";return`
          <div class="chat-msg-row ${L?"incoming":"outgoing"} chat-audio-msg-row ${Z}" data-id="${a.id}" data-sender="${j(a.sender_name)}" data-body="[Nota de voz]" data-media-type="audio" data-media-url="${J}" data-is-incoming="${L}" data-is-deleted="${!!a.is_deleted}" data-is-edited="${!!a.is_edited}">
            <div class="chat-swipe-indicator-reply">${c("cornerUpLeft",16)}</div>
            <div class="wa-standalone-audio-card wa-audio-bubble ${z?"latest-target":""} ${L?"incoming":"outgoing"}" data-audio-src="${J}">
              ${ce}
              ${V}
              <div class="wa-standalone-audio-main">
                <button type="button" class="wa-audio-play-btn js-wa-audio-toggle" aria-label="Reproducir nota de voz">
                  ${c("play",16)}
                </button>
                <div class="wa-audio-content">
                  <div class="wa-audio-track-wrapper js-wa-audio-track">
                    <div class="wa-audio-waveform-bars">
                      ${[40,65,30,85,55,95,45,75,60,90,35,70,80,50,65,85,45,95,70,40].map(ee=>`<span class="wa-wave-bar" style="height:${ee}%;"></span>`).join("")}
                    </div>
                    <div class="wa-audio-scrubber-track">
                      <div class="wa-audio-scrubber-fill js-wa-audio-fill" style="width: 0%;"></div>
                    </div>
                  </div>
                  <div class="wa-audio-meta-row">
                    <span class="wa-audio-time-label js-wa-audio-time">0:00</span>
                    <div class="wa-audio-sub-meta">
                      <button type="button" class="wa-audio-speed-btn js-wa-audio-speed" title="Velocidad (1x, 1.5x, 2x)">1x</button>
                      <span class="wa-audio-mic-indicator" title="Nota de voz">${c("mic",12)}</span>
                      <span class="wa-audio-time-stamp">${a.time_label}</span>
                      ${a.is_edited?'<span class="chat-msg-edited-badge">editado</span>':""}
                      ${L?"":Ue(a.delivery_status,a.id)}
                    </div>
                  </div>
                </div>
              </div>
              ${p}
            </div>
          </div>
        `}if(A){let J=a.media_url||"";return`
          <div class="chat-msg-row ${L?"incoming":"outgoing"} chat-sticker-msg-row ${Z}" data-id="${a.id}" data-sender="${j(a.sender_name)}" data-body="[Sticker]" data-media-type="sticker" data-media-url="${J}" data-is-incoming="${L}" data-is-deleted="${!!a.is_deleted}" data-is-edited="${!!a.is_edited}">
            <div class="chat-swipe-indicator-reply">${c("cornerUpLeft",16)}</div>
            <div class="wa-standalone-sticker-card ${z?"latest-target":""} ${L?"incoming":"outgoing"}">
              ${ce}
              ${V}
              <div class="wa-sticker-media-wrapper ${J?"js-open-media-lightbox":"wa-media-failed"}" data-media-type="image" data-media-url="${J}" data-media-title="Sticker de ${j(a.sender_name)}">
                ${J?`<img src="${J}" class="wa-sticker-img" alt="Sticker" loading="lazy" />`:yt(!1)}
              </div>
              <div class="wa-sticker-meta-row">
                <span class="wa-sticker-time-badge">
                  <span>${a.time_label}</span>
                  ${a.is_edited?'<span class="chat-msg-edited-badge">editado</span>':""}
                  ${L?"":Ue(a.delivery_status,a.id)}
                </span>
              </div>
              ${p}
            </div>
          </div>
        `}if(se){let J=a.media_url||"",ee=a.body&&!a.body.startsWith("[Foto")&&a.body!=="[Foto enviada]"&&a.body!=="null"?a.body:"";return`
          <div class="chat-msg-row ${L?"incoming":"outgoing"} chat-image-msg-row ${Z}" data-id="${a.id}" data-sender="${j(a.sender_name)}" data-body="${j(ee||"Foto")}" data-media-type="image" data-media-url="${J}" data-is-incoming="${L}" data-is-deleted="${!!a.is_deleted}" data-is-edited="${!!a.is_edited}">
            <div class="chat-swipe-indicator-reply">${c("cornerUpLeft",16)}</div>
            <div class="wa-standalone-image-card ${z?"latest-target":""} ${L?"incoming":"outgoing"}">
              ${ce}
              ${V}
              <div class="wa-image-media-wrapper ${J?"js-open-media-lightbox":"wa-media-failed"}" data-media-type="image" data-media-url="${J}" data-media-title="${j(a.media_filename||"Foto de WhatsApp")}">
                ${J?`<img src="${J}" alt="${j(a.media_filename||"Foto")}" class="wa-standalone-image-el" loading="lazy" />`:yt(!1)}
                <div class="wa-image-gradient-overlay">
                  <span class="wa-image-time-stamp">${a.time_label}</span>
                  ${a.is_edited?'<span class="chat-msg-edited-badge">editado</span>':""}
                  ${L?"":Ue(a.delivery_status,a.id)}
                </div>
              </div>
              ${ee?`<div class="wa-image-caption-text">${mt(ee)}</div>`:""}
              ${ee?ut(ee):""}
              ${p}
            </div>
          </div>
        `}if(ne){let J=a.media_url||"",ee=a.body&&!a.body.startsWith("[Video")&&a.body!=="[Video enviado]"&&a.body!=="null"?a.body:"";return`
          <div class="chat-msg-row ${L?"incoming":"outgoing"} chat-video-msg-row ${Z}" data-id="${a.id}" data-sender="${j(a.sender_name)}" data-body="${j(ee||"Video")}" data-media-type="video" data-media-url="${J}" data-is-incoming="${L}" data-is-deleted="${!!a.is_deleted}" data-is-edited="${!!a.is_edited}">
            <div class="chat-swipe-indicator-reply">${c("cornerUpLeft",16)}</div>
            <div class="wa-standalone-video-card ${z?"latest-target":""} ${L?"incoming":"outgoing"}">
              ${ce}
              ${V}
              <div class="wa-video-media-wrapper ${J?"js-open-media-lightbox":"wa-media-failed"}" data-media-type="video" data-media-url="${J}" data-media-title="${j(a.media_filename||"Video de WhatsApp")}">
                <video src="${J}" preload="metadata" playsinline class="wa-standalone-video-el" style="max-height:260px;width:100%;object-fit:cover;border-radius:10px;background:#000;display:block;"></video>
                <div class="wa-video-play-overlay">
                  <span class="wa-video-center-btn" title="Reproducir en Visor Moderno">
                    ${c("play",26)}
                  </span>
                </div>
                <div class="wa-video-gradient-overlay">
                  <span class="wa-video-time-stamp">${a.time_label}</span>
                  ${a.is_edited?'<span class="chat-msg-edited-badge">editado</span>':""}
                  ${L?"":Ue(a.delivery_status,a.id)}
                </div>
              </div>
              ${ee?`<div class="wa-video-caption-text">${mt(ee)}</div>`:""}
              ${ee?ut(ee):""}
              ${p}
            </div>
          </div>
        `}let de=a.body&&a.body!=="[Audio enviado]"?a.body:"",fe=de?ut(de):"";return`
        <div class="chat-msg-row ${L?"incoming":"outgoing"} ${G?"is-chatbot":""} ${Z}" data-id="${a.id}" data-sender="${j(a.sender_name)}" data-body="${j(de)}" data-media-type="${a.media_type||"none"}" data-media-url="${a.media_url||""}" data-is-incoming="${L}" data-is-deleted="${!!a.is_deleted}" data-is-edited="${!!a.is_edited}">
          <div class="chat-swipe-indicator-reply">${c("cornerUpLeft",16)}</div>
          <div class="chat-msg-bubble ${z?"latest-target":""}">
            ${ce}
            <div style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;margin-bottom:0.25rem;font-size:0.7rem;opacity:0.82;">
              <strong style="display:inline-flex;align-items:center;gap:0.3rem;">
                ${G?c("bot",12):a.sender_type==="broadcast"?c("megaphone",12):""}
                <span>${a.sender_name}</span>
              </strong>
              <span>${en(a.delivery_via)}</span>
            </div>
            ${V}
            ${tn(a)}
            ${a.is_deleted?'<div style="font-style:italic;opacity:0.72;display:flex;align-items:center;gap:0.35rem;">\u{1F6AB} Este mensaje fue eliminado</div>':de?`<div style="white-space:pre-wrap;word-break:break-word;">${mt(de)}</div>`:""}
            ${a.is_deleted?"":fe}
            <div class="chat-msg-footer-row">
              <span class="chat-msg-time">${a.time_label}</span>
              ${a.is_edited?'<span class="chat-msg-edited-badge">editado</span>':""}
              ${L?"":Ue(a.delivery_status,a.id)}
            </div>
            ${p}
          </div>
        </div>
      `},k="",R=u.map((a,q)=>{let L="",G=a.created_at?new Date(a.created_at):null;if(G&&!Number.isNaN(G.getTime())){let z=Mt(G);z!==k&&(k=z,L=`<div class="chat-date-separator" role="separator"><span>${St(G)}</span></div>`)}return L+$(a,q)}).join(""),D=typeof Notification<"u"&&Notification.permission==="default"&&!sessionStorage.getItem("nexus_dismiss_notif_banner");return`
    <div class="inbox-workspace-100vh">
      <header class="inbox-compact-header">
        <div class="inbox-header-title-box" style="display:flex;align-items:center;gap:0.65rem;flex-wrap:wrap;">
          <h1 style="font-size:1.2rem;font-weight:700;margin:0;color:var(--text-primary);">Bandeja de mensajes</h1>
          ${o.wa_active_mode==="qr"?`<span id="inbox-wa-live-pill" class="tag-pill-minimal" style="--tag-color:${o.wa_qr_status==="connected"?"#10b981":"#f59e0b"};">
                  <span class="tag-dot" id="inbox-wa-live-dot"></span>
                  <span id="inbox-wa-live-label">${o.wa_qr_status==="connected"?"WhatsApp en vivo":o.wa_qr_status==="reconnecting"?"Reconectando...":"QR pendiente"}</span>
                </span>`:""}
        </div>

        <!-- Men\xFA Desplegable para PC con las Opciones de Bandeja -->
        <div class="inbox-pc-dropdown-wrapper">
          <button type="button" class="btn btn-secondary btn-sm" id="btn-inbox-pc-menu" style="gap:0.45rem;">
            ${c("sliders",14)}
            <span>Opciones</span>
            ${c("chevronDown",11)}
          </button>
          <div class="inbox-pc-dropdown-menu" id="inbox-pc-dropdown-menu" style="display:none;">
            <button type="button" class="inbox-dropdown-item js-opt-new-contact">
              ${c("plus",14)}
              <span>A\xF1adir contacto / Iniciar chat</span>
            </button>
            <button type="button" class="inbox-dropdown-item js-opt-sync-all">
              ${c("refresh",14)}
              <span>Sincronizar Todas las Redes</span>
            </button>
            <button type="button" class="inbox-dropdown-item js-opt-sync-wa">
              ${c("whatsapp",14)}
              <span>Sincronizar WhatsApp</span>
            </button>
            <button type="button" class="inbox-dropdown-item js-opt-sync-ig">
              ${c("instagram",14)}
              <span>Sincronizar Instagram Direct</span>
            </button>
            <button type="button" class="inbox-dropdown-item js-opt-sync-fb">
              ${c("facebook",14)}
              <span>Sincronizar Facebook</span>
            </button>
            <button type="button" class="inbox-dropdown-item js-opt-quick-replies">
              ${c("zap",14)}
              <span>Respuestas R\xE1pidas (/)</span>
            </button>
            <button type="button" class="inbox-dropdown-item js-opt-tags">
              ${c("tag",14)}
              <span>Etiquetas</span>
            </button>
            <div class="inbox-dropdown-divider"></div>
            <button type="button" class="inbox-dropdown-item js-opt-broadcast" style="color:var(--btn-bg);">
              ${c("megaphone",14)}
              <strong>Mensaje Masivo</strong>
            </button>
          </div>
        </div>
      </header>

      ${D?`
        <div class="inbox-notification-permission-banner" id="inbox-notification-banner">
          <div style="display:flex;align-items:center;gap:0.6rem;">
            <span class="inbox-notif-bell-icon">${c("bell",16)}</span>
            <div style="font-size:0.8rem;line-height:1.3;">
              <strong>Activa las notificaciones en tiempo real</strong>
              <span style="opacity:0.85;display:block;">Recibe alertas sonoras y emergentes en tu navegador o celular APK cuando lleguen nuevos mensajes.</span>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:0.4rem;">
            <button type="button" class="btn btn-primary btn-sm" id="btn-request-notif-permission">Activar</button>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-dismiss-notif-banner" title="Ocultar">${c("close",13)}</button>
          </div>
        </div>
      `:""}

      ${Yt(t.waSync)}

      <!-- Contenedor tipo WhatsApp Web compacto a 100dvh -->
      <div class="omnichannel-shell">
        <!-- Columna Izquierda: Lista de Conversaciones, Filtros de Red y Filtro Minimalista de Etiquetas -->
        <aside class="inbox-sidebar">
          <div class="inbox-filter-bar">
            <input
              type="search"
              id="inbox-search-input"
              class="form-control"
              placeholder="Buscar contacto, n\xFAmero, mensaje o etiqueta..."
              value="${t.searchQuery}"
              style="padding:0.42rem 0.68rem;font-size:0.82rem;"
            />
            <div class="channel-pills-row" role="tablist" aria-label="Filtrar por canal de mensajer\xEDa">
              ${[{id:"all",label:"Todos los canales"},{id:"whatsapp",label:"WhatsApp"},{id:"facebook",label:"Facebook Messenger"},{id:"instagram",label:"Instagram DM"},{id:"tiktok",label:"TikTok Direct"}].map(a=>`
                  <button
                    type="button"
                    class="channel-filter-pill ${t.channelFilter===a.id?"active":""} js-filter-channel"
                    data-channel="${a.id}"
                    title="${a.label}"
                    aria-label="${a.label}"
                  >
                    ${Tt(a.id,18)}
                  </button>
                `).join("")}
            </div>

            <!-- Filtro r\xE1pido por Etiquetas Minimalistas -->
            <div style="display:flex;align-items:center;flex-wrap:wrap;gap:0.3rem;overflow:visible;padding-bottom:0.15rem;">
              <button
                type="button"
                class="tag-pill-minimal interactive ${!t.tagFilter||t.tagFilter==="all"?"active-filter":""} js-filter-tag"
                data-tag=""
                style="--tag-color:var(--widget-accent);"
              >
                <span>Todas (${t.conversations.length})</span>
              </button>
              ${t.tags.map(a=>ze(a.name,t.tags,`interactive ${t.tagFilter.toLowerCase()===a.name.toLowerCase()?"active-filter":""} js-filter-tag`,`data-tag="${a.name}" role="button" tabindex="0"`)).join("")}
            </div>
          </div>

          <div class="inbox-conversations-list">
            ${x||(t.channelFilter==="facebook"?o.fb_connected?`
                    <div class="inbox-empty-channel-box">
                      <span class="empty-icon-circle fb">${c("facebook",30)}</span>
                      <strong>Sin chats descargados</strong>
                      <p>P\xE1gina "${o.fb_page_name||"Facebook"}" vinculada. Haz clic en sincronizar para descargar las conversaciones activas.</p>
                      <button type="button" class="btn btn-primary btn-sm js-opt-sync-fb" style="margin-top:0.35rem;">
                        ${c("refresh",14)} <span>Sincronizar Facebook</span>
                      </button>
                    </div>
                  `:`
                      <div class="inbox-empty-channel-box">
                        <span class="empty-icon-circle fb">${c("facebook",30)}</span>
                        <strong>Facebook no conectado</strong>
                        <p>Para recibir y responder mensajes de tu Fan Page comercial, con\xE9ctala en la pesta\xF1a de Conexiones.</p>
                        <button type="button" class="btn btn-primary btn-sm js-goto-connections" style="margin-top:0.35rem;">
                          ${c("settings",14)} <span>Configurar Facebook</span>
                        </button>
                      </div>
                    `:t.channelFilter==="instagram"?`
                    <div class="inbox-empty-channel-box">
                      <span class="empty-icon-circle ig">${c("instagram",30)}</span>
                      <strong>${o.ig_connected?"Sin mensajes de Instagram":"Instagram sin activar"}</strong>
                      <p>${o.ig_connected?"No hay mensajes directos nuevos registrados a\xFAn.":"Conecta tu cuenta profesional de Instagram en Configuraci\xF3n para atender DMs e historias."}</p>
                      ${o.ig_connected?`<button type="button" class="btn btn-primary btn-sm js-opt-sync-ig" style="margin-top:0.35rem;">
                              ${c("refresh",14)} <span>Sincronizar Instagram</span>
                            </button>`:`<button type="button" class="btn btn-primary btn-sm js-goto-connections" style="margin-top:0.35rem;">
                              ${c("settings",14)} <span>Configurar Instagram</span>
                            </button>`}
                    </div>
                  `:t.channelFilter==="tiktok"?`
                    <div class="inbox-empty-channel-box">
                      <span class="empty-icon-circle tt">${c("tiktok",30)}</span>
                      <strong>${o.tt_connected?"Sin mensajes de TikTok":"TikTok Business sin activar"}</strong>
                      <p>${o.tt_connected?"No hay mensajes o leads nuevos registrados a\xFAn.":"Conecta tu perfil comercial de TikTok en Configuraci\xF3n para atender mensajes y leads."}</p>
                      ${o.tt_connected?"":`<button type="button" class="btn btn-primary btn-sm js-goto-connections" style="margin-top:0.35rem;">
                              ${c("settings",14)} <span>Configurar TikTok</span>
                            </button>`}
                    </div>
                  `:t.channelFilter==="whatsapp"?o.wa_qr_status!=="connected"?`
                      <div class="inbox-empty-channel-box">
                        <span class="empty-icon-circle wa">${c("whatsapp",30)}</span>
                        <strong>WhatsApp no vinculado</strong>
                        <p>Escanea el c\xF3digo QR en Conexiones para vincular tu WhatsApp Normal o Business.</p>
                        <button type="button" class="btn btn-primary btn-sm js-goto-connections" style="margin-top:0.35rem;">
                          ${c("settings",14)} <span>Vincular WhatsApp</span>
                        </button>
                      </div>
                    `:`
                    <div class="inbox-empty-channel-box">
                      <span class="empty-icon-circle wa">${c("whatsapp",30)}</span>
                      <strong>WhatsApp Vinculado y Activo</strong>
                      <p>N\xFAmero vinculado: ${o.wa_qr_phone||"WhatsApp"}. Los mensajes entrantes o salientes se mostrar\xE1n aqu\xED en vivo.</p>
                      <div style="display:flex;gap:0.4rem;flex-wrap:wrap;justify-content:center;margin-top:0.35rem;">
                        <button type="button" class="btn btn-secondary btn-sm js-opt-sync-wa">
                          ${c("refresh",14)} <span>Sincronizar</span>
                        </button>
                        <button type="button" class="btn btn-primary btn-sm js-opt-new-contact">
                          ${c("plus",14)} <span>Iniciar Chat</span>
                        </button>
                      </div>
                    </div>
                  `:`
                  <div class="inbox-empty-sidebar" style="padding:2.5rem 1.25rem;text-align:center;color:var(--text-muted);font-size:0.84rem;display:flex;flex-direction:column;align-items:center;gap:0.75rem;">
                    <span style="opacity:0.55;color:var(--widget-accent);">${c("messageSquare",34)}</span>
                    <strong style="color:var(--text-primary);font-size:0.95rem;">Bandeja vac\xEDa</strong>
                    <span style="line-height:1.45;max-width:240px;">No hay conversaciones activas en este filtro.</span>
                    <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:0.5rem;margin-top:0.35rem;">
                      <button type="button" class="btn btn-primary btn-sm js-opt-new-contact">
                        ${c("plus",14)} <span>Iniciar Chat</span>
                      </button>
                      <button type="button" class="btn btn-secondary btn-sm js-opt-sync-all">
                        ${c("refresh",14)} <span>Sincronizar</span>
                      </button>
                    </div>
                  </div>
                `)}
          </div>
        </aside>

        <!-- Columna Derecha: Hilo de Mensajes, Compositor con Comandos / y Panel Lateral de Notas y Etiquetas -->
        <section class="chat-pane">
          ${r?`
            <div class="chat-contact-bar">
              <div style="display:flex;align-items:center;gap:0.55rem;min-width:0;">
                <button type="button" class="chat-mobile-back-btn js-chat-back-to-list" title="Regresar a la lista de chats">
                  ${c("arrowLeft",18)}
                </button>
                <div class="conv-avatar" style="background:${r.avatar_color};width:36px;height:36px;font-size:0.82rem;">
                  <span>${pt(r.contact_name,"WA")}</span>
                  <span class="conv-channel-badge ch-${r.channel}">
                    ${c(_t(r.channel),10)}
                  </span>
                </div>
                <div style="min-width:0;">
                  <div style="display:flex;align-items:center;gap:0.45rem;flex-wrap:wrap;">
                    <strong style="font-size:0.92rem;">${r.contact_name}</strong>
                    <span style="font-size:0.74rem;color:var(--text-muted);">(${r.contact_handle})</span>
                    ${v?`<span class="tag-pill-minimal" style="--tag-color:#10b981;" title="Agente responsable asignado">
                            <span class="tag-dot"></span>
                            <span>Agente: ${v.full_name.split(" ")[0]}</span>
                          </span>`:""}
                  </div>
                  <div style="display:flex;align-items:center;gap:0.3rem;flex-wrap:wrap;margin-top:0.2rem;">
                    ${h.length>0?h.map(a=>ze(a,t.tags)).join(""):'<span style="font-size:0.71rem;color:var(--text-muted);">Sin etiquetas asignadas</span>'}
                  </div>
                </div>
              </div>

              <div class="chat-contact-actions">
                <button
                  type="button"
                  class="chat-header-action-btn ${t.messageSearch?.open?"active":""}"
                  id="btn-toggle-chat-search"
                  title="Buscar en la conversaci\xF3n"
                  aria-label="Buscar en la conversaci\xF3n"
                  aria-expanded="${t.messageSearch?.open?"true":"false"}"
                >
                  ${c("search",15)}
                  <span class="chat-btn-label-desktop">Buscar</span>
                </button>
                <button
                  type="button"
                  class="chat-header-action-btn ${t.sideDrawerTab==="tags"?"active":""}"
                  id="btn-toggle-side-drawer-tags"
                  title="Etiquetas (${h.length})"
                  aria-label="Etiquetas de la conversaci\xF3n"
                >
                  ${c("tag",15)}
                  <span class="chat-btn-label-desktop">Etiquetas (${h.length})</span>
                  ${h.length>0?`<span class="chat-btn-badge-mobile">${h.length}</span>`:""}
                </button>
                <button
                  type="button"
                  class="chat-header-action-btn ${t.sideDrawerTab==="notes"?"active":""}"
                  id="btn-toggle-side-drawer-notes"
                  title="Notas Aparte (${m.length})"
                  aria-label="Notas internas del cliente"
                >
                  ${c("stickyNote",15)}
                  <span class="chat-btn-label-desktop">Notas Aparte (${m.length})</span>
                  ${m.length>0?`<span class="chat-btn-badge-mobile">${m.length}</span>`:""}
                </button>
              </div>
            </div>

            <!-- Cuerpo dividido: Mensajes + Drawer Lateral (Notas Aparte / Etiquetas) -->
            <div class="chat-body-split">
              <div class="chat-main-column" id="chat-main-column">
                <!-- Dropzone Overlay para Arrastrar y Soltar Archivos (Fotos, Videos, Audios, Docs) -->
                <div class="chat-dropzone-overlay" id="chat-dropzone-overlay" style="display:none;">
                  <div class="chat-dropzone-inner">
                    ${c("uploadCloud",42)}
                    <h4>Suelte aqu\xED sus archivos</h4>
                    <p>Arrastre im\xE1genes, notas de audio, videos o documentos para enviar a este chat</p>
                  </div>
                </div>

                ${t.messageSearch?.open?`<div class="chat-search-bar" role="search">
                        <label for="chat-search-input" class="visually-hidden-label">Buscar en la conversaci\xF3n</label>
                        ${c("search",14)}
                        <input type="search" id="chat-search-input" class="chat-search-input" placeholder="Buscar en los mensajes cargados\u2026" value="${j(t.messageSearch.query||"")}" autocomplete="off" />
                        <span class="chat-search-count" id="chat-search-count" aria-live="polite"></span>
                        <button type="button" class="chat-search-nav" id="btn-chat-search-prev" aria-label="Resultado anterior">${c("chevronUp",15)}</button>
                        <button type="button" class="chat-search-nav" id="btn-chat-search-next" aria-label="Resultado siguiente">${c("chevronDown",15)}</button>
                        <button type="button" class="chat-search-nav" id="btn-chat-search-close" aria-label="Cerrar b\xFAsqueda">${c("close",15)}</button>
                      </div>`:""}
                <div class="chat-messages-scroller" id="chat-messages-scroller">
                  ${u.length>=(t.messageLimit||250)?`<div class="chat-load-older-row"><button type="button" class="chat-load-older-btn js-load-older">${c("clock",13)}<span>Cargar mensajes anteriores</span></button></div>`:""}
                  ${R}
                </div>

                <!-- Contenedor del Compositor y Popover Flotante Slash (/) -->
                <div class="chat-composer-area">
                  <button type="button" class="chat-jump-bottom" id="chat-jump-bottom" style="display:none;" aria-label="Ir al \xFAltimo mensaje">
                    ${c("chevronDown",16)}
                    <span class="chat-jump-bottom-count" style="display:none;"></span>
                  </button>
                  <!-- Men\xFA flotante de Respuestas R\xE1pidas al escribir / -->
                  <div class="slash-command-popover" id="slash-command-popover" style="display:none;">
                    <div class="slash-command-header">
                      <span><strong>Respuestas Autom\xE1ticas / R\xE1pidas</strong> \u2014 Clic o Enter para usar</span>
                      <button type="button" class="btn btn-secondary btn-sm" id="btn-popover-manage-qr" style="padding:0.15rem 0.5rem;font-size:0.7rem;">
                        ${c("plus",11)}
                        <span>Gestionar / Crear</span>
                      </button>
                    </div>
                    <div class="slash-command-list" id="slash-command-list"></div>
                  </div>

                  ${t.replyingTo?`
                    <div class="chat-reply-preview-bar">
                      ${t.replyingTo.media_url&&(t.replyingTo.media_type==="image"||!t.replyingTo.media_type||t.replyingTo.media_type==="none")?`
                        <div class="chat-reply-preview-thumb">
                          <img src="${t.replyingTo.media_url}" alt="Foto citada" />
                        </div>
                      `:""}
                      <div class="chat-reply-preview-content">
                        <div class="chat-reply-preview-sender">
                          ${c("cornerUpLeft",13)}
                          <span>Respondiendo a <strong>${j(t.replyingTo.sender)}</strong></span>
                        </div>
                        <div class="chat-reply-preview-text">
                          ${t.replyingTo.media_type==="image"||t.replyingTo.media_url&&!t.replyingTo.body?`<span style="display:inline-flex;align-items:center;gap:0.25rem;font-weight:600;">${c("image",12)} Foto:</span> `:""}${j(t.replyingTo.body||(t.replyingTo.media_type==="image"?"Foto":""))}
                        </div>
                      </div>
                      <button type="button" class="chat-reply-cancel-btn js-cancel-reply" title="Cancelar respuesta">
                        ${c("close",15)}
                      </button>
                    </div>
                  `:""}

                  ${t.pendingAttachment?`
                    <div class="composer-media-preview-bar">
                      ${t.pendingAttachment.media_type==="audio"?`<audio class="composer-attach-audio" controls preload="metadata" src="${t.pendingAttachment.media_url}"></audio>`:t.pendingAttachment.media_type==="video"?`<video class="composer-attach-thumb" muted playsinline preload="metadata" src="${t.pendingAttachment.media_url}"></video>`:t.pendingAttachment.media_type==="image"||t.pendingAttachment.media_type==="sticker"?`<img class="composer-attach-thumb" alt="" src="${t.pendingAttachment.media_url}" />`:""}
                      <div style="display:flex;align-items:center;gap:0.5rem;overflow:hidden;">
                        <span class="tag-pill-minimal" style="--tag-color:var(--widget-accent);">
                          ${c(ht(t.pendingAttachment.media_type),12)}
                          <span>${Ve(t.pendingAttachment.media_type)} listo para enviar</span>
                        </span>
                        <strong style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                          ${t.pendingAttachment.media_filename}
                        </strong>
                      </div>
                      <button type="button" class="btn btn-secondary btn-sm" id="btn-clear-pending-media" style="padding:0.15rem 0.45rem;">
                        ${c("close",13)}
                        <span>Quitar</span>
                      </button>
                    </div>
                  `:""}

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
                      <button type="button" class="chat-emoji-tab" data-emoji-cat="symbols" role="tab" aria-selected="false">S\xEDmbolos</button>
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
                      title="Insertar emotic\xF3n"
                      aria-label="Insertar emotic\xF3n"
                      aria-expanded="false"
                      aria-controls="chat-emoji-picker-popover"
                      style="height:42px;width:42px;padding:0;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;flex-shrink:0;"
                      ${n?"":"disabled"}
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
                      ${n?"":"disabled"}
                    >
                      ${c("paperclip",18)}
                    </button>

                    <label for="chat-composer-input" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);">
                      Escribir mensaje para ${r.contact_name}
                    </label>
                    <textarea
                      id="chat-composer-input"
                      class="chat-composer-textarea"
                      rows="1"
                      placeholder="Mensaje..."
                      ${n?"":"disabled"}
                    ></textarea>

                    <!-- Bot\xF3n de Acci\xF3n estilo WhatsApp: Micr\xF3fono cuando est\xE1 vac\xEDo / Enviar con \xEDcono cuando tiene texto -->
                    <button
                      type="submit"
                      class="chat-action-btn ${t.pendingAttachment?"is-send":"is-mic"}"
                      id="btn-chat-action"
                      title="${t.pendingAttachment?"Enviar mensaje":"Grabar nota de voz"}"
                      ${n?"":"disabled"}
                    >
                      <span class="chat-action-icon-send" style="display:${t.pendingAttachment?"inline-flex":"none"};">
                        ${c("send",17)}
                      </span>
                      <span class="chat-action-icon-mic" style="display:${t.pendingAttachment?"none":"inline-flex"};">
                        ${c("mic",18)}
                      </span>
                    </button>
                  </form>
                </div>
              </div>

              ${t.sideDrawerTab==="notes"?`
                <!-- BACKDROP T\xC1CTIL M\xD3VIL Y PANEL BOTTOM SHEET: NOTAS APARTE -->
                <div class="chat-side-drawer-backdrop" id="chat-side-drawer-backdrop" title="Tocar para cerrar"></div>
                <aside class="chat-side-drawer open" aria-label="Notas internas de la conversaci\xF3n">
                  <div class="chat-side-drawer-handle"></div>
                  <div class="chat-side-drawer-header">
                    <strong style="font-size:0.88rem;display:inline-flex;align-items:center;gap:0.4rem;">
                      ${c("stickyNote",15)}
                      <span>Notas Aparte del Cliente</span>
                    </strong>
                    <button type="button" class="btn btn-secondary btn-sm" id="btn-close-side-drawer" style="padding:0.25rem 0.5rem;" title="Cerrar">
                      ${c("close",13)}
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
                        ${c("plus",13)}
                        <span>Guardar Nota</span>
                      </button>
                    </form>

                    <div style="display:flex;flex-direction:column;gap:0.6rem;margin-top:0.25rem;">
                      ${m.length>0?m.map(a=>`
                              <div class="note-card-item">
                                <div style="display:flex;align-items:center;justify-content:space-between;gap:0.4rem;font-size:0.69rem;color:var(--text-muted);">
                                  <strong>${a.author_name}</strong>
                                  <div style="display:inline-flex;align-items:center;gap:0.25rem;">
                                    <button type="button" class="btn btn-secondary btn-sm js-edit-conv-note" data-note-id="${a.id}" style="padding:0.1rem 0.3rem;" title="Editar nota">
                                      ${c("edit",11)}
                                    </button>
                                    <button type="button" class="btn btn-danger btn-sm js-delete-conv-note" data-note-id="${a.id}" style="padding:0.1rem 0.3rem;" title="Eliminar nota">
                                      ${c("trash",11)}
                                    </button>
                                  </div>
                                </div>
                                <div style="font-size:0.8rem;color:var(--text-primary);white-space:pre-wrap;line-height:1.4;">${a.content}</div>
                              </div>
                            `).join(""):'<p style="font-size:0.78rem;color:var(--text-muted);text-align:center;padding:1rem 0;">A\xFAn no hay notas internas para este chat.</p>'}
                    </div>
                  </div>
                </aside>
              `:t.sideDrawerTab==="tags"?`
                <!-- BACKDROP T\xC1CTIL M\xD3VIL Y PANEL BOTTOM SHEET: ETIQUETAS Y ASIGNACI\xD3N -->
                <div class="chat-side-drawer-backdrop" id="chat-side-drawer-backdrop" title="Tocar para cerrar"></div>
                <aside class="chat-side-drawer open" aria-label="Etiquetas del chat y usuario">
                  <div class="chat-side-drawer-handle"></div>
                  <div class="chat-side-drawer-header">
                    <strong style="font-size:0.88rem;display:inline-flex;align-items:center;gap:0.4rem;">
                      ${c("tag",15)}
                      <span>Etiquetas y Asignaci\xF3n</span>
                    </strong>
                    <button type="button" class="btn btn-secondary btn-sm" id="btn-close-side-drawer" style="padding:0.25rem 0.5rem;" title="Cerrar">
                      ${c("close",13)}
                    </button>
                  </div>
                  <div class="chat-side-drawer-body">
                    <div>
                      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.45rem;">
                        <span style="font-size:0.74rem;font-weight:700;text-transform:uppercase;color:var(--text-muted);">
                          Etiquetas de este Chat
                        </span>
                        <button type="button" class="btn btn-secondary btn-sm" id="btn-drawer-open-tag-crud" style="padding:0.15rem 0.45rem;font-size:0.7rem;">
                          ${c("plus",11)}
                          <span>Crear / Editar</span>
                        </button>
                      </div>
                      <p style="font-size:0.74rem;color:var(--text-muted);margin-bottom:0.55rem;">
                        Toque una etiqueta para asignarla o quitarla de <strong>${r.contact_name}</strong>:
                      </p>
                      <div style="display:flex;flex-wrap:wrap;gap:0.38rem;">
                        ${t.tags.map(a=>{let q=h.some(L=>L.toLowerCase()===a.name.toLowerCase());return ze(a.name,t.tags,`interactive ${q?"active-filter":""} js-toggle-conv-tag`,`data-tag-name="${a.name}" role="button" tabindex="0"`)}).join("")}
                      </div>
                    </div>

                    <div style="padding-top:0.75rem;border-top:1px dashed var(--widget-border);">
                      <label class="form-label" for="conv-assigned-user-select" style="font-size:0.74rem;text-transform:uppercase;color:var(--text-muted);">
                        Usuario / Agente Responsable del Chat
                      </label>
                      <select id="conv-assigned-user-select" class="form-select" style="margin-top:0.35rem;font-size:0.8rem;padding:0.4rem 0.6rem;">
                        <option value="">\u2014 Sin agente asignado \u2014</option>
                        ${t.users.map(a=>`<option value="${a.id}" ${r.assigned_user_id===a.id?"selected":""}>${a.full_name} (${a.role_name||"Agente"})</option>`).join("")}
                      </select>
                    </div>

                    <div style="padding-top:0.75rem;border-top:1px dashed var(--widget-border);">
                      <span style="font-size:0.74rem;font-weight:700;text-transform:uppercase;color:var(--text-muted);display:block;margin-bottom:0.45rem;">
                        Etiquetas por Usuario del Equipo
                      </span>
                      <div style="display:flex;flex-direction:column;gap:0.65rem;">
                        ${t.users.map(a=>{let q=Me(a.tags_json);return`
                              <div style="padding:0.55rem 0.65rem;border-radius:0.65rem;background:var(--page-bg);border:1px solid var(--widget-border);">
                                <div style="display:flex;align-items:center;justify-content:space-between;gap:0.4rem;margin-bottom:0.35rem;">
                                  <strong style="font-size:0.78rem;">${a.full_name}</strong>
                                  <button type="button" class="btn btn-secondary btn-sm js-manage-user-tags" data-user-id="${a.id}" style="padding:0.1rem 0.4rem;font-size:0.68rem;">
                                    ${c("tag",10)}
                                    <span>Asignar</span>
                                  </button>
                                </div>
                                <div style="display:flex;flex-wrap:wrap;gap:0.25rem;">
                                  ${q.length>0?q.map(L=>ze(L,t.tags)).join(""):'<span style="font-size:0.7rem;color:var(--text-muted);">Sin etiquetas</span>'}
                                </div>
                              </div>
                            `}).join("")}
                      </div>
                    </div>
                  </div>
                </aside>
              `:""}
            </div>
          `:`
              <div class="inbox-welcome-screen">
                <div class="inbox-welcome-illustration">
                  <div class="inbox-welcome-icon-circle">
                    ${t.channelFilter==="facebook"?c("facebook",44):t.channelFilter==="instagram"?c("instagram",44):t.channelFilter==="tiktok"?c("tiktok",44):c("messageSquare",44)}
                  </div>
                  <div class="inbox-welcome-badge">
                    ${c("check",14)}
                  </div>
                </div>

                <h2 class="inbox-welcome-title">
                  ${t.channelFilter==="facebook"?"Bandeja de Facebook Messenger":t.channelFilter==="instagram"?"Bandeja de Instagram Direct":t.channelFilter==="tiktok"?"Bandeja de TikTok Business":t.channelFilter==="whatsapp"?"Bandeja de WhatsApp":"Empieza tu chat ahora"}
                </h2>
                <p class="inbox-welcome-subtitle">
                  ${t.channelFilter==="facebook"?`Atiende los mensajes y comentarios de ${o.fb_page_name||"tu Fan Page comercial"} en tiempo real.`:t.channelFilter==="instagram"?"Gestiona mensajes directos, menciones y respuestas de historias de Instagram.":t.channelFilter==="tiktok"?"Gestiona prospectos de TikTok Ads y mensajes directos comerciales.":"Env\xEDa y recibe mensajes omnicanal sin mantener tu tel\xE9fono conectado. Selecciona una conversaci\xF3n de la lista o inicia una nueva."}
                </p>

                <div class="inbox-welcome-actions">
                  <button type="button" class="btn btn-primary js-opt-new-contact" id="btn-welcome-new-chat">
                    ${c("plus",15)}
                    <span>A\xF1adir contacto / Iniciar chat</span>
                  </button>
                  ${t.channelFilter==="instagram"?`
                    <button type="button" class="btn btn-secondary js-opt-sync-ig">
                      ${c("instagram",15)}
                      <span>Sincronizar Instagram</span>
                    </button>
                    `:t.channelFilter==="facebook"?`
                    <button type="button" class="btn btn-secondary js-opt-sync-fb">
                      ${c("facebook",15)}
                      <span>Sincronizar Facebook</span>
                    </button>
                    `:t.channelFilter==="whatsapp"?`
                    <button type="button" class="btn btn-secondary js-opt-sync-wa">
                      ${c("whatsapp",15)}
                      <span>Sincronizar WhatsApp</span>
                    </button>
                    `:`
                    <button type="button" class="btn btn-secondary js-opt-sync-all">
                      ${c("refresh",15)}
                      <span>Sincronizar Todas las Redes</span>
                    </button>
                    `}
                  <button type="button" class="btn btn-secondary js-opt-broadcast">
                    ${c("megaphone",15)}
                    <span>Enviar Mensaje Masivo</span>
                  </button>
                </div>

                <div class="inbox-welcome-security-note">
                  ${c("lock",13)}
                  <span>Tus mensajes personales y de clientes est\xE1n protegidos con cifrado y trazabilidad oficial.</span>
                </div>
              </div>
            `}
        </section>
      </div>

      <!-- Bot\xF3n Flotante para M\xF3vil (FAB de Opciones de Bandeja) -->
      <button type="button" class="inbox-mobile-fab" id="btn-inbox-mobile-fab" aria-label="Opciones de Bandeja" title="Opciones de Bandeja">
        ${c("sliders",22)}
      </button>

      <!-- Bottom Sheet de Opciones para M\xF3vil -->
      <div class="inbox-mobile-sheet-overlay" id="inbox-mobile-sheet-overlay" style="display:none;">
        <div class="inbox-mobile-sheet">
          <div class="inbox-mobile-sheet-handle"></div>
          <div class="inbox-mobile-sheet-title">
            <strong style="font-size:0.95rem;">Opciones de Bandeja</strong>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-close-mobile-sheet" style="padding:0.2rem 0.45rem;">
              ${c("close",14)}
            </button>
          </div>
          <div class="inbox-mobile-sheet-items">
            <button type="button" class="inbox-sheet-btn js-opt-new-contact">
              <span class="inbox-sheet-icon" style="background:rgba(16,185,129,0.15);color:#10b981;">${c("plus",18)}</span>
              <div style="text-align:left;">
                <strong>A\xF1adir contacto / Iniciar chat</strong>
                <p>Comenzar conversaci\xF3n con un nuevo n\xFAmero o cliente</p>
              </div>
            </button>
            <button type="button" class="inbox-sheet-btn js-opt-sync-all">
              <span class="inbox-sheet-icon" style="background:rgba(99,102,241,0.15);color:#6366f1;">${c("refresh",18)}</span>
              <div style="text-align:left;">
                <strong>Sincronizar Todas las Redes</strong>
                <p>Descargar chats de WhatsApp, Instagram y Facebook</p>
              </div>
            </button>
            <button type="button" class="inbox-sheet-btn js-opt-sync-wa">
              <span class="inbox-sheet-icon" style="background:rgba(59,130,246,0.15);color:#3b82f6;">${c("whatsapp",18)}</span>
              <div style="text-align:left;">
                <strong>Sincronizar WhatsApp</strong>
                <p>Descargar \xFAltimos chats de WhatsApp Normal y Business</p>
              </div>
            </button>
            <button type="button" class="inbox-sheet-btn js-opt-sync-ig">
              <span class="inbox-sheet-icon" style="background:rgba(225,48,108,0.15);color:#e1306c;">${c("instagram",18)}</span>
              <div style="text-align:left;">
                <strong>Sincronizar Instagram Direct</strong>
                <p>Descargar DMs de tu cuenta comercial @romaagenciape</p>
              </div>
            </button>
            <button type="button" class="inbox-sheet-btn js-opt-sync-fb">
              <span class="inbox-sheet-icon" style="background:rgba(37,99,235,0.15);color:#2563eb;">${c("facebook",18)}</span>
              <div style="text-align:left;">
                <strong>Sincronizar Facebook</strong>
                <p>Descargar chats de tu Fan Page comercial</p>
              </div>
            </button>
            <button type="button" class="inbox-sheet-btn js-opt-quick-replies">
              <span class="inbox-sheet-icon" style="background:rgba(245,158,11,0.15);color:#f59e0b;">${c("zap",18)}</span>
              <div style="text-align:left;">
                <strong>Respuestas R\xE1pidas (/)</strong>
                <p>Crear, editar o usar plantillas con multimedia</p>
              </div>
            </button>
            <button type="button" class="inbox-sheet-btn js-opt-tags">
              <span class="inbox-sheet-icon" style="background:rgba(16,185,129,0.15);color:#10b981;">${c("tag",18)}</span>
              <div style="text-align:left;">
                <strong>Gestor de Etiquetas</strong>
                <p>Organizar chats de clientes y agentes</p>
              </div>
            </button>
            <button type="button" class="inbox-sheet-btn js-opt-broadcast">
              <span class="inbox-sheet-icon" style="background:rgba(99,102,241,0.15);color:#6366f1;">${c("megaphone",18)}</span>
              <div style="text-align:left;">
                <strong>Mensaje Masivo</strong>
                <p>Difusi\xF3n a listas de contactos y etiquetas</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  `}function Pe(t){let{sub:e,apiFetch:n,refreshInbox:o,editingItem:s,onSelect:r}=t,u=document.getElementById("global-form-dialog");if(!u)return;let m=s?.media_url||"",h=s?.media_filename||"",v=s?.media_mimetype||"";(()=>{let $=u.querySelector("#qr-media-type")?.value||s?.media_type||"none";u.innerHTML=`
      <div class="crm-form-modal-surface" style="max-width:740px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
          <div>
            <h3 id="form-dialog-title" style="font-size:1.15rem;display:flex;align-items:center;gap:0.5rem;">
              ${c("zap",18)}
              <span>Respuestas Autom\xE1ticas / R\xE1pidas con Comando <code>/</code></span>
            </h3>
            <p style="font-size:0.8rem;color:var(--text-muted);">
              Cree respuestas con texto, audio, video, documento o foto. Al escribir <code>/</code> en el chat podr\xE1 enviarlas directo al WhatsApp del cliente.
            </p>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" id="close-qr-manager">
            ${c("close",16)}
          </button>
        </div>

        <!-- Formulario para Crear o Editar Respuesta R\xE1pida -->
        <form id="quick-reply-crud-form" style="padding:1rem;border-radius:0.85rem;background:var(--surface-subtle);border:1px solid var(--widget-border);margin-bottom:1.15rem;display:flex;flex-direction:column;gap:0.85rem;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <strong style="font-size:0.88rem;">
              ${s?`Editando comando /${s.shortcut}`:"Nueva Respuesta Autom\xE1tica (/)"}
            </strong>
            ${s?'<button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-edit-qr">Cancelar edici\xF3n</button>':""}
          </div>

          <div class="config-grid-3">
            <div class="form-group">
              <label class="form-label" for="qr-shortcut">Comando (sin /) *</label>
              <input type="text" id="qr-shortcut" class="form-control" placeholder="ej. catalogo" value="${s?.shortcut||""}" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="qr-title">T\xEDtulo descriptivo *</label>
              <input type="text" id="qr-title" class="form-control" placeholder="ej. Cat\xE1logo PDF 2026" value="${s?.title||""}" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="qr-media-type">Tipo de Adjunto a Enviar</label>
              <select id="qr-media-type" class="form-select">
                <option value="none" ${$==="none"?"selected":""}>Solo Texto</option>
                <option value="image" ${$==="image"?"selected":""}>Foto / Imagen</option>
                <option value="video" ${$==="video"?"selected":""}>Video (MP4)</option>
                <option value="audio" ${$==="audio"?"selected":""}>Audio / Nota de Voz</option>
                <option value="document" ${$==="document"?"selected":""}>Documento (PDF / Office)</option>
              </select>
            </div>
          </div>

          <div class="form-group" id="qr-media-upload-row" style="display:${$==="none"?"none":"flex"};flex-direction:column;gap:0.45rem;">
            <label class="form-label" for="qr-media-file">Subir archivo de ${Ve($)} (se enviar\xE1 por WhatsApp)</label>
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
                <span>${h?`Archivo: ${h}`:"Ning\xFAn archivo cargado a\xFAn"}</span>
              </span>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="qr-body">Texto del Mensaje / Pie de archivo *</label>
            <textarea id="qr-body" class="form-control" rows="2" placeholder="Escriba el texto que acompa\xF1ar\xE1 a esta respuesta r\xE1pida..." required>${s?.body||""}</textarea>
          </div>

          <div style="display:flex;justify-content:flex-end;">
            <button type="submit" class="btn btn-primary btn-sm">
              ${c("save",14)}
              <span>${s?"Actualizar Respuesta (/)":"Guardar Nueva Respuesta (/)"}</span>
            </button>
          </div>
        </form>

        <!-- Lista de Respuestas R\xE1pidas Existentes -->
        <div style="display:flex;flex-direction:column;gap:0.5rem;max-height:260px;overflow-y:auto;">
          ${e.quickReplies.map(a=>`
              <div style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;padding:0.65rem 0.85rem;border-radius:0.75rem;background:var(--page-bg);border:1px solid var(--widget-border);">
                <div style="min-width:0;flex:1;">
                  <div style="display:flex;align-items:center;gap:0.45rem;flex-wrap:wrap;">
                    <span class="slash-shortcut-code">/${a.shortcut}</span>
                    <strong style="font-size:0.85rem;">${a.title}</strong>
                    ${a.media_type&&a.media_type!=="none"?`<span class="tag-pill-minimal" style="--tag-color:var(--widget-accent);">
                            ${c(ht(a.media_type),11)}
                            <span>${Ve(a.media_type)}: ${a.media_filename||"Adjunto"}</span>
                          </span>`:""}
                  </div>
                  <p style="font-size:0.78rem;color:var(--text-secondary);margin-top:0.2rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                    ${a.body}
                  </p>
                </div>
                <div style="display:flex;align-items:center;gap:0.35rem;flex:none;">
                  ${r?`
                    <button type="button" class="btn btn-primary btn-sm js-modal-use-qr" data-id="${a.id}" style="padding:0.25rem 0.65rem;" title="Insertar esta respuesta en el chat activo">
                      ${c("send",12)}
                      <span>Usar</span>
                    </button>
                  `:""}
                  <button type="button" class="btn btn-secondary btn-sm js-modal-edit-qr" data-id="${a.id}">
                    ${c("edit",13)}
                  </button>
                  <button type="button" class="btn btn-danger btn-sm js-modal-delete-qr" data-id="${a.id}" data-shortcut="${a.shortcut}">
                    ${c("trash",13)}
                  </button>
                </div>
              </div>
            `).join("")}
        </div>
      </div>
    `,u.querySelectorAll(".js-modal-use-qr").forEach(a=>{a.addEventListener("click",()=>{let q=Number(a.getAttribute("data-id")),L=e.quickReplies.find(G=>G.id===q);L&&r&&(r(L),u.close())})}),u.querySelector("#close-qr-manager")?.addEventListener("click",()=>u.close()),u.querySelector("#btn-cancel-edit-qr")?.addEventListener("click",()=>{Pe({sub:e,apiFetch:n,refreshInbox:o,onSelect:r})});let k=u.querySelector("#qr-media-type"),R=u.querySelector("#qr-media-upload-row");k?.addEventListener("change",()=>{R&&(R.style.display=k.value==="none"?"none":"flex")});let D=u.querySelector("#qr-media-file");D?.addEventListener("change",async()=>{let a=D.files?.[0];if(!a)return;m=await nt(a),h=a.name,v=a.type||"application/octet-stream";let q=u.querySelector("#qr-media-status-badge");q&&(q.innerHTML=`<span class="tag-dot"></span><span>Cargado: ${h}</span>`)}),u.querySelector("#quick-reply-crud-form")?.addEventListener("submit",async a=>{a.preventDefault();let q=u.querySelector("#qr-shortcut").value.trim(),L=u.querySelector("#qr-title").value.trim(),G=u.querySelector("#qr-body").value.trim(),z=u.querySelector("#qr-media-type").value;if(z!=="none"&&!m){E("Suba un archivo multimedia",`Seleccione un archivo de ${Ve(z)} o cambie el tipo a "Solo Texto".`,"warning");return}try{let N={shortcut:q,title:L,body:G,media_type:z,media_url:z==="none"?"":m,media_filename:z==="none"?"":h,media_mimetype:z==="none"?"":v};s?(await n(`/api/inbox/quick-replies/${s.id}`,{method:"PUT",body:JSON.stringify(N)}),E("Respuesta actualizada",`El comando /${q} fue actualizado.`,"success")):(await n("/api/inbox/quick-replies",{method:"POST",body:JSON.stringify(N)}),E("Respuesta creada",`El comando /${q} ya est\xE1 disponible con /.`,"success")),await o(),Pe({sub:e,apiFetch:n,refreshInbox:o})}catch(N){E("Error guardando respuesta",N.message,"danger")}}),u.querySelectorAll(".js-modal-edit-qr").forEach(a=>{a.addEventListener("click",()=>{let q=Number(a.getAttribute("data-id")),L=e.quickReplies.find(G=>G.id===q);L&&Pe({sub:e,apiFetch:n,refreshInbox:o,editingItem:L})})}),u.querySelectorAll(".js-modal-delete-qr").forEach(a=>{a.addEventListener("click",async()=>{let q=Number(a.getAttribute("data-id")),L=a.getAttribute("data-shortcut")||"";try{await n(`/api/inbox/quick-replies/${q}`,{method:"DELETE"}),E("Respuesta eliminada",`Se elimin\xF3 /${L}.`,"info"),await o(),Pe({sub:e,apiFetch:n,refreshInbox:o})}catch(G){E("Error al eliminar",G.message,"danger")}})})})(),u.open||u.showModal()}function Qe(t){let{sub:e,apiFetch:n,refreshInbox:o,editingTag:s}=t,r=document.getElementById("global-form-dialog");if(!r)return;r.innerHTML=`
    <div class="crm-form-modal-surface" style="max-width:620px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
        <div>
          <h3 id="form-dialog-title" style="font-size:1.15rem;display:flex;align-items:center;gap:0.5rem;">
            ${c("tag",18)}
            <span>Gestor de Etiquetas Modernas Minimalistas</span>
          </h3>
          <p style="font-size:0.8rem;color:var(--text-muted);">
            Dise\xF1adas con borde sutil y punto de color para no saturar visualmente los chats ni las tablas de usuarios.
          </p>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" id="close-tags-manager">
          ${c("close",16)}
        </button>
      </div>

      <form id="tag-crud-form" style="padding:0.95rem;border-radius:0.85rem;background:var(--surface-subtle);border:1px solid var(--widget-border);margin-bottom:1.1rem;display:flex;flex-wrap:wrap;align-items:flex-end;gap:0.75rem;">
        <div class="form-group" style="flex:1;min-width:180px;">
          <label class="form-label" for="tag-crud-name">Nombre de la Etiqueta *</label>
          <input type="text" id="tag-crud-name" class="form-control" placeholder="Ej. Cliente Mayorista" value="${s?.name||""}" required />
        </div>
        <div class="form-group" style="width:130px;">
          <label class="form-label" for="tag-crud-color">Color del Punto</label>
          <div class="color-picker-row" style="padding:0.25rem 0.5rem;">
            <input type="color" id="tag-crud-color" value="${s?.color||"#10b981"}" style="width:28px;height:28px;" />
            <input type="text" id="tag-crud-color-txt" value="${s?.color||"#10b981"}" readonly style="font-size:0.78rem;" />
          </div>
        </div>
        <div class="form-group" style="width:140px;">
          <label class="form-label" for="tag-crud-scope">\xC1mbito</label>
          <select id="tag-crud-scope" class="form-select">
            <option value="both" ${s?.scope==="both"?"selected":""}>Chats y Usuarios</option>
            <option value="chat" ${s?.scope==="chat"?"selected":""}>Solo Chats</option>
            <option value="user" ${s?.scope==="user"?"selected":""}>Solo Usuarios</option>
          </select>
        </div>
        <button type="submit" class="btn btn-primary btn-sm" style="height:38px;">
          ${c("save",14)}
          <span>${s?"Actualizar":"Crear Etiqueta"}</span>
        </button>
      </form>

      <div style="display:flex;flex-direction:column;gap:0.45rem;max-height:280px;overflow-y:auto;">
        ${e.tags.map(h=>`
            <div style="display:flex;align-items:center;justify-content:space-between;padding:0.55rem 0.8rem;border-radius:0.7rem;background:var(--page-bg);border:1px solid var(--widget-border);">
              <div style="display:flex;align-items:center;gap:0.65rem;">
                ${ze(h.name,e.tags)}
                <span style="font-size:0.72rem;color:var(--text-muted);">
                  ${h.scope==="chat"?"Chats":h.scope==="user"?"Usuarios":"Chats y Usuarios"}
                </span>
              </div>
              <div style="display:flex;align-items:center;gap:0.35rem;">
                <button type="button" class="btn btn-secondary btn-sm js-edit-tag-item" data-id="${h.id}">
                  ${c("edit",12)}
                </button>
                <button type="button" class="btn btn-danger btn-sm js-delete-tag-item" data-id="${h.id}" data-name="${h.name}">
                  ${c("trash",12)}
                </button>
              </div>
            </div>
          `).join("")}
      </div>
    </div>
  `,r.querySelector("#close-tags-manager")?.addEventListener("click",()=>r.close());let u=r.querySelector("#tag-crud-color"),m=r.querySelector("#tag-crud-color-txt");u?.addEventListener("input",()=>{m&&(m.value=u.value)}),r.querySelector("#tag-crud-form")?.addEventListener("submit",async h=>{h.preventDefault();let v=r.querySelector("#tag-crud-name").value.trim(),x=u?.value||"#6366f1",$=r.querySelector("#tag-crud-scope").value;try{s?(await n(`/api/inbox/tags/${s.id}`,{method:"PUT",body:JSON.stringify({name:v,color:x,scope:$})}),E("Etiqueta actualizada",`Se actualiz\xF3 "${v}".`,"success")):(await n("/api/inbox/tags",{method:"POST",body:JSON.stringify({name:v,color:x,scope:$})}),E("Etiqueta creada",`La etiqueta "${v}" est\xE1 lista para usarse.`,"success")),await o(),Qe({sub:e,apiFetch:n,refreshInbox:o})}catch(k){E("Error guardando etiqueta",k.message,"danger")}}),r.querySelectorAll(".js-edit-tag-item").forEach(h=>{h.addEventListener("click",()=>{let v=Number(h.getAttribute("data-id")),x=e.tags.find($=>$.id===v);x&&Qe({sub:e,apiFetch:n,refreshInbox:o,editingTag:x})})}),r.querySelectorAll(".js-delete-tag-item").forEach(h=>{h.addEventListener("click",async()=>{let v=Number(h.getAttribute("data-id"));try{await n(`/api/inbox/tags/${v}`,{method:"DELETE"}),await o(),Qe({sub:e,apiFetch:n,refreshInbox:o})}catch(x){E("Error al eliminar etiqueta",x.message,"danger")}})}),r.open||r.showModal()}function zt(t,e){if(!t)return'<div class="crm-widget">Cargando configuraci\xF3n de conexiones...</div>';let n=e?"":"disabled",o=t.wa_active_mode==="qr",s=`${window.location.origin}/api/webhooks/omnichannel`;return`
    <div style="display:flex;flex-direction:column;gap:1.5rem;">
      <!-- 1. ARQUITECTURA DUAL DE WHATSAPP: SERVIDOR QR (WHATSAPP NORMAL O BUSINESS) VS WHATSAPP CLOUD API -->
      <div class="crm-widget crm-widget-accent-top">
        <div style="display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:1.15rem;">
          <div>
            <h3 style="font-size:1.15rem;display:flex;align-items:center;gap:0.5rem;">
              ${c("whatsapp",20)}
              <span>Conexi\xF3n de WhatsApp (Normal y Business) \u2014 Selector de Modalidad</span>
            </h3>
            <p style="font-size:0.84rem;color:var(--text-muted);margin-top:0.2rem;">
              Compatible con <strong>WhatsApp Business</strong> y <strong>WhatsApp Normal</strong>. Sincroniza autom\xE1ticamente todos sus chats existentes y mensajes entrantes/salientes.
            </p>
          </div>
          <span class="badge">
            Modalidad Activa: ${o?"Servidor QR Interno (WhatsApp Normal / Business)":"WhatsApp Cloud API (Masivos y Chatbot)"}
          </span>
        </div>

        <!-- Selector de las 2 modalidades de WhatsApp -->
        <div class="wa-mode-selector-grid">
          <button type="button" class="wa-mode-card ${o?"active":""} js-select-wa-mode" data-mode="qr" ${n}>
            <div style="display:flex;align-items:center;justify-content:space-between;width:100%;">
              <strong style="font-size:0.98rem;display:inline-flex;align-items:center;gap:0.5rem;color:var(--text-primary);">
                ${c("qrCode",18)}
                <span>Opci\xF3n 1: Servidor QR Interno (WhatsApp Normal o Business)</span>
              </strong>
              ${o?`<span class="micro-perm-pill on">${c("check",12)} <span>Activo</span></span>`:""}
            </div>
            <p style="font-size:0.8rem;color:var(--text-secondary);line-height:1.45;">
              Ideal para sincronizar todos sus chats de <strong>WhatsApp Business o WhatsApp Normal</strong> escaneando el c\xF3digo QR oficial, con env\xEDo de texto, fotos, videos, audios y documentos.
            </p>
          </button>

          <button type="button" class="wa-mode-card ${o?"":"active"} js-select-wa-mode" data-mode="api" ${n}>
            <div style="display:flex;align-items:center;justify-content:space-between;width:100%;">
              <strong style="font-size:0.98rem;display:inline-flex;align-items:center;gap:0.5rem;color:var(--text-primary);">
                ${c("bot",18)}
                <span>Opci\xF3n 2: WhatsApp Cloud API (Masivos + Chatbot)</span>
              </strong>
              ${o?"":`<span class="micro-perm-pill on">${c("check",12)} <span>Activo</span></span>`}
            </div>
            <p style="font-size:0.8rem;color:var(--text-secondary);line-height:1.45;">
              Ideal para <strong>mensajes masivos (Broadcast)</strong>, <strong>chatbots inteligentes</strong>, flujos automatizados y multi-agente de alto volumen mediante la API oficial de Meta.
            </p>
          </button>
        </div>

        <!-- Panel Din\xE1mico seg\xFAn la modalidad de WhatsApp elegida -->
        ${o?`
          <div id="wa-qr-live-panel" style="padding:1.25rem;border-radius:0.95rem;background:var(--surface-subtle);border:1px solid var(--widget-border);">
            <div class="config-grid-2" style="align-items:center;">
              <div style="display:flex;flex-direction:column;gap:0.85rem;">
                <div style="display:flex;flex-wrap:wrap;align-items:center;gap:0.5rem;">
                  <span class="micro-perm-pill ${t.wa_qr_status==="connected"?"on":"off"}">
                    <span class="status-dot"></span>
                    <span>${t.wa_qr_status==="connected"?"Sesi\xF3n QR Vinculada y Sincronizando Chats":t.wa_qr_status==="awaiting_scan"?"C\xF3digo QR Oficial Listo para Escanear":"Servidor QR Desconectado"}</span>
                  </span>
                  <span style="font-size:0.75rem;color:var(--text-muted);">Soporta WhatsApp Normal y WhatsApp Business</span>
                </div>

                <h4 style="font-size:1.05rem;">Vinculaci\xF3n Directa por C\xF3digo QR (Servidor Interno)</h4>
                <p style="font-size:0.83rem;color:var(--text-secondary);line-height:1.5;">
                  1. Abra <strong>WhatsApp</strong> o <strong>WhatsApp Business</strong> en su tel\xE9fono.<br/>
                  2. Toque en <strong>Dispositivos vinculados</strong> y luego en <strong>Vincular un dispositivo</strong>.<br/>
                  3. Escanee el c\xF3digo QR de la derecha para sincronizar todos sus chats e historial en la Bandeja de Entrada.
                </p>

                <div class="config-grid-2">
                  <div class="form-group">
                    <label class="form-label" for="conn-wa-qr-phone">N\xFAmero de WhatsApp Vinculado</label>
                    <input type="tel" id="conn-wa-qr-phone" class="form-control" value="${t.wa_qr_phone}" ${n} />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="conn-wa-qr-device">Nombre del Servidor / Nodo</label>
                    <input type="text" id="conn-wa-qr-device" class="form-control" value="${t.wa_qr_device}" ${n} />
                  </div>
                </div>

                <div style="display:flex;flex-wrap:wrap;gap:0.55rem;margin-top:0.25rem;">
                  <button type="button" class="btn btn-primary btn-sm" id="btn-wa-qr-generate" ${n}>
                    ${c("refresh",14)}
                    <span>Generar Nuevo C\xF3digo QR</span>
                  </button>
                  ${t.wa_qr_status==="connected"?`<button type="button" class="btn btn-danger btn-sm" id="btn-wa-qr-disconnect" ${n}>
                          ${c("xCircle",14)}
                          <span>Cerrar Sesi\xF3n QR / Desvincular</span>
                        </button>`:""}
                </div>
              </div>

              <!-- Visor del C\xF3digo QR Oficial de WhatsApp Web -->
              <div style="text-align:center;">
                <div class="qr-scanner-box" id="wa-qr-box-container">
                  ${t.wa_qr_status==="connected"?`
                        <div style="padding:1.2rem 0.5rem;display:flex;flex-direction:column;align-items:center;gap:0.65rem;color:#059669;">
                          ${c("checkCircle",62)}
                          <strong style="font-size:0.95rem;color:#0f172a;">WhatsApp Vinculado</strong>
                          <span style="font-size:0.8rem;color:#475569;font-weight:600;">${t.wa_qr_phone}</span>
                          <span style="font-size:0.72rem;color:#64748b;">Chats sincronizados en Bandeja de Mensajes</span>
                        </div>
                      `:t.wa_qr_session_code&&t.wa_qr_session_code.startsWith("data:image/")?`
                        <img
                          id="wa-real-qr-img"
                          src="${t.wa_qr_session_code}"
                          alt="C\xF3digo QR Oficial de WhatsApp Web"
                          style="width:236px;height:236px;display:block;border-radius:0.5rem;"
                        />
                        <span style="font-size:0.75rem;font-weight:700;margin-top:0.5rem;color:#0f172a;">
                          Escanee con WhatsApp o WhatsApp Business
                        </span>
                      `:`
                        <div style="padding:1.5rem 0.75rem;display:flex;flex-direction:column;align-items:center;gap:0.65rem;color:#475569;">
                          ${c("qrCode",48)}
                          <strong style="font-size:0.84rem;color:#0f172a;">Generando QR oficial de WhatsApp...</strong>
                          <span style="font-size:0.74rem;color:#64748b;">Conectando con servidores de WhatsApp Web</span>
                        </div>
                      `}
                </div>
              </div>
            </div>
          </div>
        `:`
          <!-- PANEL MODO 2: WHATSAPP CLOUD API OFICIAL (MASIVOS + CHATBOT IA) -->
          <div style="padding:1.25rem;border-radius:0.95rem;background:var(--surface-subtle);border:1px solid var(--widget-border);display:flex;flex-direction:column;gap:1.1rem;">
            <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:0.75rem;">
              <div>
                <h4 style="font-size:1.05rem;">Credenciales de WhatsApp Cloud API, Mensajes Masivos y Chatbot</h4>
                <p style="font-size:0.8rem;color:var(--text-muted);">
                  Conecte su cuenta de Meta for Developers para habilitar env\xEDos masivos, plantillas verificadas y respuestas de Chatbot.
                </p>
              </div>
              <span class="micro-perm-pill on">
                ${c("checkCircle",13)}
                <span>API Lista para Masivos y Chatbot</span>
              </span>
            </div>

            <div class="config-grid-3">
              <div class="form-group">
                <label class="form-label" for="conn-wa-phone-id">Phone Number ID *</label>
                <input type="text" id="conn-wa-phone-id" class="form-control" placeholder="Ej. 102938475610293" value="${t.wa_phone_number_id||""}" ${n} />
              </div>
              <div class="form-group">
                <label class="form-label" for="conn-wa-waba-id">WhatsApp Business Account ID *</label>
                <input type="text" id="conn-wa-waba-id" class="form-control" placeholder="Ej. 192837465019283" value="${t.wa_business_account_id||""}" ${n} />
              </div>
              <div class="form-group">
                <label class="form-label" for="conn-wa-verify-token">Webhook Verify Token *</label>
                <input type="text" id="conn-wa-verify-token" class="form-control" placeholder="Token de verificaci\xF3n" value="${t.wa_verify_token||""}" ${n} />
              </div>
            </div>

            <div class="config-grid-2">
              <div class="form-group">
                <label class="form-label" for="conn-wa-access-token">Token Permanente de Acceso (System User Token) *</label>
                <input type="password" id="conn-wa-access-token" class="form-control" placeholder="EAAG..." value="${t.wa_access_token||""}" ${n} />
              </div>
              <div class="form-group">
                <label class="form-label">URL de Webhook para Meta App Dashboard</label>
                <div style="display:flex;gap:0.45rem;">
                  <input type="text" class="form-control" value="${s}" readonly />
                  <button type="button" class="btn btn-secondary btn-sm" id="btn-copy-webhook" data-url="${s}">
                    ${c("copy",14)}
                    <span>Copiar</span>
                  </button>
                </div>
              </div>
            </div>

            <div class="config-grid-2" style="padding-top:0.5rem;border-top:1px dashed var(--widget-border);">
              <div style="display:flex;flex-direction:column;gap:0.55rem;">
                <label style="display:flex;align-items:center;gap:0.65rem;font-size:0.88rem;font-weight:600;cursor:pointer;">
                  <input type="checkbox" id="conn-wa-mass-enabled" switch ${t.wa_mass_messaging_enabled?"checked":""} ${n} />
                  <span>Habilitar M\xF3dulo de Mensajes Masivos (Campa\xF1as / Broadcast)</span>
                </label>
                <label style="display:flex;align-items:center;gap:0.65rem;font-size:0.88rem;font-weight:600;cursor:pointer;">
                  <input type="checkbox" id="conn-wa-chatbot-enabled" switch ${t.wa_chatbot_enabled?"checked":""} ${n} />
                  <span>Habilitar Respuesta Autom\xE1tica de Chatbot IA al recibir mensajes</span>
                </label>
              </div>

              <div class="form-group">
                <label class="form-label" for="conn-wa-chatbot-prompt">Mensaje / Prompt de Bienvenida del Chatbot Autom\xE1tico</label>
                <textarea id="conn-wa-chatbot-prompt" class="form-control" rows="2" placeholder="Escribe el mensaje inicial del asistente..." ${n}>${t.wa_chatbot_prompt||""}</textarea>
              </div>
            </div>
          </div>
        `}
      </div>

      <!-- 2. CONEXI\xD3N F\xC1CIL DE BANDEJAS DE FACEBOOK MESSENGER, INSTAGRAM DIRECT Y TIKTOK -->
      <div class="config-grid-3">
        <!-- FACEBOOK MESSENGER -->
        <div class="crm-widget" style="border-top:3px solid #2563eb;display:flex;flex-direction:column;justify-content:space-between;gap:1rem;">
          <div style="display:flex;flex-direction:column;gap:0.85rem;">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div style="display:flex;align-items:center;gap:0.55rem;">
                <span style="width:36px;height:36px;border-radius:10px;background:#2563eb;color:#fff;display:inline-flex;align-items:center;justify-content:center;">
                  ${c("facebook",18)}
                </span>
                <div>
                  <h4 style="font-size:1rem;">Facebook Messenger</h4>
                  <span style="font-size:0.73rem;color:var(--text-muted);">Bandeja de P\xE1gina Comercial</span>
                </div>
              </div>
              <span class="micro-perm-pill ${t.fb_connected?"on":"off"}">
                <span class="status-dot"></span>
                <span>${t.fb_connected?"Conectado":"Desconectado"}</span>
              </span>
            </div>

            <div class="form-group">
              <label class="form-label" for="conn-fb-page-name">Nombre de la P\xE1gina de Facebook</label>
              <input type="text" id="conn-fb-page-name" class="form-control" placeholder="Ej. Mi Empresa ISP" value="${t.fb_page_name||""}" ${n} />
            </div>

            <div class="form-group">
              <label class="form-label" for="conn-fb-page-id">ID de P\xE1gina (Page ID)</label>
              <input type="text" id="conn-fb-page-id" class="form-control" placeholder="Ej. 10492837465" value="${t.fb_page_id||""}" ${n} />
            </div>

            <div class="form-group">
              <label class="form-label" for="conn-fb-token">Token de Acceso de P\xE1gina</label>
              <input type="password" id="conn-fb-token" class="form-control" placeholder="EAAG..." value="${t.fb_access_token||""}" ${n} />
            </div>

            <label style="display:flex;align-items:center;gap:0.55rem;font-size:0.82rem;font-weight:600;cursor:pointer;">
              <input type="checkbox" id="conn-fb-sync" switch ${t.fb_auto_sync?"checked":""} ${n} />
              <span>Recibir mensajes y comentarios de Facebook en Bandeja</span>
            </label>
          </div>

          <div style="display:flex;gap:0.45rem;">
            <button type="button" class="btn ${t.fb_connected?"btn-secondary":"btn-primary"} btn-sm js-verify-fb-conn" style="flex:1;" ${n}>
              ${c("facebook",14)}
              <span>${t.fb_connected?"Reconectar / Sincronizar Facebook":"Conectar Facebook Messenger"}</span>
            </button>
            ${t.fb_connected?`<button type="button" class="btn btn-outline-danger btn-sm js-disconnect-fb-conn" title="Desconectar p\xE1gina" ${n}>
                    ${c("close",14)}
                  </button>`:""}
          </div>
        </div>

        <!-- INSTAGRAM DIRECT -->
        <div class="crm-widget" style="border-top:3px solid #ec4899;display:flex;flex-direction:column;justify-content:space-between;gap:1rem;">
          <div style="display:flex;flex-direction:column;gap:0.85rem;">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div style="display:flex;align-items:center;gap:0.55rem;">
                <span style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#f59e0b,#ec4899,#8b5cf6);color:#fff;display:inline-flex;align-items:center;justify-content:center;">
                  ${c("instagram",18)}
                </span>
                <div>
                  <h4 style="font-size:1rem;">Instagram Direct</h4>
                  <span style="font-size:0.73rem;color:var(--text-muted);">DMs, Historias y Reels</span>
                </div>
              </div>
              <span class="micro-perm-pill ${t.ig_connected?"on":"off"}">
                <span class="status-dot"></span>
                <span>${t.ig_connected?"Conectado":"Sin activar"}</span>
              </span>
            </div>

            <div class="form-group">
              <label class="form-label" for="conn-ig-username">Usuario de Instagram Profesional</label>
              <input type="text" id="conn-ig-username" class="form-control" placeholder="@tuempresa" value="${t.ig_username||""}" ${n} />
            </div>

            <div class="form-group">
              <label class="form-label" for="conn-ig-id">Instagram Business Account ID</label>
              <input type="text" id="conn-ig-id" class="form-control" placeholder="17841..." value="${t.ig_account_id||""}" ${n} />
            </div>

            <div class="form-group">
              <label class="form-label" for="conn-ig-token">Token de Mensajer\xEDa Instagram</label>
              <input type="password" id="conn-ig-token" class="form-control" placeholder="Token de Instagram Graph API" value="${t.ig_access_token||""}" ${n} />
            </div>

            <label style="display:flex;align-items:center;gap:0.55rem;font-size:0.82rem;font-weight:600;cursor:pointer;">
              <input type="checkbox" id="conn-ig-stories" switch ${t.ig_sync_stories?"checked":""} ${n} />
              <span>Sincronizar menciones en Historias y mensajes directos</span>
            </label>
          </div>

          <div style="display:flex;gap:0.45rem;">
            <button type="button" class="btn ${t.ig_connected?"btn-secondary":"btn-primary"} btn-sm js-verify-ig-conn" style="flex:1;" ${n}>
              ${c("instagram",14)}
              <span>${t.ig_connected?"Reconectar / Verificar Instagram":"Conectar Instagram Direct"}</span>
            </button>
            ${t.ig_connected?`<button type="button" class="btn btn-outline-danger btn-sm js-disconnect-ig-conn" title="Desconectar Instagram" ${n}>
                    ${c("close",14)}
                  </button>`:""}
          </div>
        </div>

        <!-- TIKTOK BUSINESS MESSAGING -->
        <div class="crm-widget" style="border-top:3px solid #14b8a6;display:flex;flex-direction:column;justify-content:space-between;gap:1rem;">
          <div style="display:flex;flex-direction:column;gap:0.85rem;">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div style="display:flex;align-items:center;gap:0.55rem;">
                <span style="width:36px;height:36px;border-radius:10px;background:#0f172a;color:#fff;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--widget-border);">
                  ${c("tiktok",18)}
                </span>
                <div>
                  <h4 style="font-size:1rem;">TikTok Business</h4>
                  <span style="font-size:0.73rem;color:var(--text-muted);">Bandeja de Entrada y TikTok Leads</span>
                </div>
              </div>
              <span class="micro-perm-pill ${t.tt_connected?"on":"off"}">
                <span class="status-dot"></span>
                <span>${t.tt_connected?"Conectado":"Sin activar"}</span>
              </span>
            </div>

            <div class="form-group">
              <label class="form-label" for="conn-tt-handle">Cuenta Oficial de TikTok</label>
              <input type="text" id="conn-tt-handle" class="form-control" placeholder="@tunegocio" value="${t.tt_account_handle||""}" ${n} />
            </div>

            <div class="form-group">
              <label class="form-label" for="conn-tt-key">TikTok App / Client Key</label>
              <input type="text" id="conn-tt-key" class="form-control" placeholder="Client Key" value="${t.tt_client_key||""}" ${n} />
            </div>

            <div class="form-group">
              <label class="form-label" for="conn-tt-token">Token de Acceso TikTok Business</label>
              <input type="password" id="conn-tt-token" class="form-control" placeholder="Access Token de TikTok" value="${t.tt_access_token||""}" ${n} />
            </div>

            <label style="display:flex;align-items:center;gap:0.55rem;font-size:0.82rem;font-weight:600;cursor:pointer;">
              <input type="checkbox" id="conn-tt-leads" switch ${t.tt_sync_leads?"checked":""} ${n} />
              <span>Recibir mensajes directos y formularios de TikTok Ads</span>
            </label>
          </div>

          <div style="display:flex;gap:0.45rem;">
            <button type="button" class="btn ${t.tt_connected?"btn-secondary":"btn-primary"} btn-sm js-verify-tt-conn" style="flex:1;" ${n}>
              ${c("tiktok",14)}
              <span>${t.tt_connected?"Reconectar / Verificar TikTok":"Conectar TikTok Business"}</span>
            </button>
            ${t.tt_connected?`<button type="button" class="btn btn-outline-danger btn-sm js-disconnect-tt-conn" title="Desconectar TikTok" ${n}>
                    ${c("close",14)}
                  </button>`:""}
          </div>
        </div>
      </div>

      <div style="display:flex;justify-content:flex-end;">
        <button type="button" class="btn btn-primary crm-mobile-btn-full" id="btn-save-all-connections" ${n}>
          ${c("save",16)}
          <span>Guardar Configuraci\xF3n de Conexiones Omnicanal</span>
        </button>
      </div>
    </div>
  `}function nn(){if(CSS.supports("scroll-initial-target","nearest")){let t=document.getElementById("chat-messages-scroller");t&&(t.scrollTop=t.scrollHeight)}else{let t=document.querySelector(".chat-msg-bubble.latest-target");t&&t.scrollIntoView({behavior:"instant",block:"end"})}}var at=null,ot=null,Ge=null;function st(){at!==null&&(window.clearInterval(at),at=null),ot!==null&&(window.clearInterval(ot),ot=null),Ge!==null&&(Ge.close(),Ge=null)}var Oe=new Map,Fe=0;function Pt(){try{let t=window.AudioContext||window.webkitAudioContext;if(!t)return;let e=new t,n=e.currentTime,o=e.createOscillator(),s=e.createGain();o.type="sine",o.frequency.setValueAtTime(880,n),s.gain.setValueAtTime(.2,n),s.gain.exponentialRampToValueAtTime(.001,n+.14),o.connect(s),s.connect(e.destination),o.start(n),o.stop(n+.14);let r=e.createOscillator(),u=e.createGain();r.type="sine",r.frequency.setValueAtTime(1174.66,n+.1),u.gain.setValueAtTime(.25,n+.1),u.gain.exponentialRampToValueAtTime(.001,n+.35),r.connect(u),u.connect(e.destination),r.start(n+.1),r.stop(n+.35)}catch{}}function an(t,e){if(Pt(),typeof Notification<"u"&&Notification.permission==="granted")try{new Notification(`Mensaje de ${t}`,{body:e||"Archivo multimedia o nota de voz recibida.",icon:"/favicon.ico",badge:"/favicon.ico",tag:"crm-whatsapp-msg"})}catch{}}function on(t){document.getElementById("chat-media-viewer-modal")?.remove();let e=document.createElement("div");e.id="chat-media-viewer-modal",e.className="chat-media-lightbox-overlay";let n="";t.mediaType==="image"?n=`
      <img src="${t.mediaUrl}" alt="${j(t.mediaTitle)}" id="lightbox-main-img" class="lightbox-main-img" />
    `:t.mediaType==="video"?n=`
      <div class="modern-video-theater-wrapper">
        <video src="${t.mediaUrl}" autoplay playsinline class="lightbox-main-video js-theater-video" id="theater-video-element"></video>
        <div class="theater-video-controls" id="theater-video-controls">
          <button type="button" class="theater-ctrl-btn js-theater-play-pause" title="Play / Pausa (Espacio)">
            ${c("pause",18)}
          </button>
          <div class="theater-progress-wrapper js-theater-scrub" title="Avanzar / Retroceder">
            <div class="theater-progress-bar">
              <div class="theater-progress-fill js-theater-progress-fill" style="width: 0%;"></div>
            </div>
          </div>
          <span class="theater-time-display js-theater-time">0:00 / 0:00</span>
          <button type="button" class="theater-speed-btn js-theater-speed" title="Velocidad (1x, 1.25x, 1.5x, 2x)">1x</button>
          <button type="button" class="theater-ctrl-btn js-theater-mute" title="Silenciar / Activar sonido (M)">
            ${c("volume2",17)}
          </button>
          <button type="button" class="theater-ctrl-btn js-theater-fullscreen" title="Pantalla Completa (F)">
            ${c("maximize",17)}
          </button>
        </div>
      </div>
    `:n=`
      <iframe src="${t.mediaUrl}" class="lightbox-main-iframe" title="${j(t.mediaTitle)}"></iframe>
    `,e.innerHTML=`
    <header class="lightbox-header">
      <div class="lightbox-title-box">
        <strong class="lightbox-filename">${j(t.mediaTitle||"Archivo Adjunto")}</strong>
        <span class="lightbox-filetype">${t.mediaType.toUpperCase()}</span>
      </div>
      <div class="lightbox-actions-box">
        ${t.mediaType==="image"?`
          <button type="button" class="lightbox-btn" id="lightbox-zoom-in" title="Acercar (+)">
            ${c("plus",16)}
          </button>
          <button type="button" class="lightbox-btn" id="lightbox-zoom-out" title="Alejar (-)">
            ${c("minus",16)}
          </button>
          <button type="button" class="lightbox-btn" id="lightbox-zoom-reset" title="Restablecer (100%)">
            1x
          </button>
        `:""}
        <a href="${t.mediaUrl}" download="${j(t.mediaTitle||"archivo")}" class="lightbox-btn" title="Descargar archivo" target="_blank" rel="noopener">
          ${c("download",16)}
        </a>
        <button type="button" class="lightbox-btn lightbox-btn-close" id="lightbox-btn-close" title="Cerrar visor (Esc)">
          ${c("close",18)}
        </button>
      </div>
    </header>
    <div class="lightbox-content-body">
      ${n}
    </div>
  `,document.body.appendChild(e);let o=()=>e.remove();if(e.querySelector("#lightbox-btn-close")?.addEventListener("click",o),e.addEventListener("click",s=>{(s.target===e||s.target.classList.contains("lightbox-content-body"))&&o()}),t.mediaType==="image"){let s=1,r=e.querySelector("#lightbox-main-img");e.querySelector("#lightbox-zoom-in")?.addEventListener("click",()=>{s=Math.min(3,s+.3),r&&(r.style.transform=`scale(${s})`)}),e.querySelector("#lightbox-zoom-out")?.addEventListener("click",()=>{s=Math.max(.4,s-.3),r&&(r.style.transform=`scale(${s})`)}),e.querySelector("#lightbox-zoom-reset")?.addEventListener("click",()=>{s=1,r&&(r.style.transform="scale(1)")})}if(t.mediaType==="video"){let s=e.querySelector(".js-theater-video"),r=e.querySelector(".js-theater-play-pause"),u=e.querySelector(".js-theater-progress-fill"),m=e.querySelector(".js-theater-scrub"),h=e.querySelector(".js-theater-time"),v=e.querySelector(".js-theater-speed"),x=e.querySelector(".js-theater-mute"),$=e.querySelector(".js-theater-fullscreen");if(s){let k=z=>{if(isNaN(z)||!isFinite(z))return"0:00";let N=Math.floor(z/60),A=Math.floor(z%60);return`${N}:${A<10?"0":""}${A}`},R=()=>{if(h&&(h.textContent=`${k(s.currentTime)} / ${k(s.duration||0)}`),u&&s.duration){let z=Math.min(100,s.currentTime/s.duration*100);u.style.width=`${z}%`}};s.addEventListener("timeupdate",R),s.addEventListener("loadedmetadata",R);let D=()=>{s.paused?(s.play().catch(()=>{}),r&&(r.innerHTML=c("pause",18))):(s.pause(),r&&(r.innerHTML=c("play",18)))};if(r?.addEventListener("click",D),s.addEventListener("click",D),s.addEventListener("ended",()=>{r&&(r.innerHTML=c("play",18))}),m){let z=N=>{let A=m.getBoundingClientRect(),ne=Math.max(0,Math.min(A.width,N.clientX-A.left))/A.width;s.duration&&(s.currentTime=ne*s.duration,R())};m.addEventListener("click",z)}let a=[1,1.25,1.5,2],q=0;v?.addEventListener("click",()=>{q=(q+1)%a.length;let z=a[q];s.playbackRate=z,v&&(v.textContent=`${z}x`)}),x?.addEventListener("click",()=>{s.muted=!s.muted,x&&(x.innerHTML=s.muted?c("volumeX",17):c("volume2",17))}),$?.addEventListener("click",()=>{document.fullscreenElement?document.exitFullscreen().catch(()=>{}):e.querySelector(".modern-video-theater-wrapper")?.requestFullscreen().catch(()=>{})});let L=z=>{z.key===" "||z.code==="Space"?(z.preventDefault(),D()):z.key==="ArrowRight"?s.currentTime=Math.min(s.duration||0,s.currentTime+5):z.key==="ArrowLeft"?s.currentTime=Math.max(0,s.currentTime-5):z.key==="m"||z.key==="M"?(s.muted=!s.muted,x&&(x.innerHTML=s.muted?c("volumeX",17):c("volume2",17))):(z.key==="f"||z.key==="F")&&$?.click()};window.addEventListener("keydown",L),e.querySelector("#lightbox-btn-close")?.addEventListener("click",()=>{window.removeEventListener("keydown",L)})}}}function sn(t,e){t.querySelectorAll(".chat-msg-row").forEach(o=>{let s=0,r=0,u=!1,m=0,h=o.querySelector(".chat-msg-bubble, .wa-standalone-audio-card, .wa-standalone-image-card, .wa-standalone-video-card");h&&(o.addEventListener("touchstart",v=>{v.touches.length===1&&(s=v.touches[0].clientX,r=v.touches[0].clientY,u=!1,m=0,h.style.transition="none")},{passive:!0}),o.addEventListener("touchmove",v=>{if(v.touches.length!==1)return;let x=v.touches[0].clientX-s,$=v.touches[0].clientY-r;if(!u&&Math.abs(x)>10&&Math.abs(x)>Math.abs($)*1.2&&(u=!0),u){let k=Math.sign(x)*Math.min(80,Math.pow(Math.abs(x),.85)*2.2);m=x,h.style.transform=`translateX(${k}px)`,o.classList.toggle("swipe-active",Math.abs(k)>35)}},{passive:!0}),o.addEventListener("touchend",()=>{if(u&&(h.style.transition="transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1)",h.style.transform="translateX(0)",o.classList.remove("swipe-active"),Math.abs(m)>55)){let v=Number(o.getAttribute("data-id")||0),x=o.getAttribute("data-sender")||"Mensaje",$=o.getAttribute("data-body")||"",k=o.getAttribute("data-media-type")||"none",R=o.getAttribute("data-media-url")||"";v&&(navigator.vibrate&&navigator.vibrate(35),e({id:v,sender:x,body:$,media_type:k,media_url:R}))}},{passive:!0}))})}function jt(t){let{messageId:e,body:n,mediaType:o,mediaUrl:s,mediaFilename:r,sub:u,apiFetch:m,refreshInbox:h}=t;document.getElementById("crm-forward-modal-overlay")?.remove();let v=new Set,x="",$=document.createElement("div");$.id="crm-forward-modal-overlay",$.className="system-confirm-overlay";let k="";o==="image"&&s?k=`
      <img src="${s}" style="width:42px;height:42px;border-radius:6px;object-fit:cover;flex-shrink:0;box-shadow:0 1px 4px rgba(0,0,0,0.15);" alt="" />
      <div style="flex:1;min-width:0;font-size:0.8rem;color:var(--text-primary);">
        <strong style="display:flex;align-items:center;gap:0.3rem;color:var(--widget-accent);">${c("image",12)} Foto</strong>
        <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;opacity:0.85;">${j(n||"Foto de WhatsApp")}</span>
      </div>
    `:o==="video"?k=`
      <div style="width:42px;height:42px;border-radius:6px;background:#000;display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0;">
        ${c("play",18)}
      </div>
      <div style="flex:1;min-width:0;font-size:0.8rem;color:var(--text-primary);">
        <strong style="display:flex;align-items:center;gap:0.3rem;color:var(--widget-accent);">${c("video",12)} Video</strong>
        <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;opacity:0.85;">${j(n||"Video")}</span>
      </div>
    `:o==="audio"?k=`
      <div style="width:42px;height:42px;border-radius:6px;background:rgba(16,185,129,0.15);color:#10b981;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        ${c("mic",18)}
      </div>
      <div style="flex:1;min-width:0;font-size:0.8rem;color:var(--text-primary);">
        <strong style="display:block;color:#10b981;">Nota de voz</strong>
        <span style="opacity:0.85;">Audio de WhatsApp</span>
      </div>
    `:o==="document"?k=`
      <div style="width:42px;height:42px;border-radius:6px;background:rgba(59,130,246,0.15);color:#3b82f6;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        ${c("fileText",18)}
      </div>
      <div style="flex:1;min-width:0;font-size:0.8rem;color:var(--text-primary);">
        <strong style="display:block;color:#3b82f6;">Documento</strong>
        <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;opacity:0.85;">${j(r||"Archivo adjunto")}</span>
      </div>
    `:k=`
      <div style="flex:1;min-width:0;font-size:0.82rem;color:var(--text-primary);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.35;">
        ${j(n)}
      </div>
    `,$.innerHTML=`
    <div class="forward-modal-card">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:0.85rem 1rem;border-bottom:1px solid var(--widget-border);">
        <div style="display:flex;align-items:center;gap:0.5rem;">
          <span style="color:var(--widget-accent);display:inline-flex;">${c("cornerUpRight",18)}</span>
          <h3 style="margin:0;font-size:1.05rem;font-weight:700;color:var(--text-primary);">Reenviar mensaje</h3>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-close-forward-modal" style="padding:0.25rem 0.5rem;" title="Cerrar">
          ${c("close",15)}
        </button>
      </div>

      <div class="forward-modal-preview">
        ${k}
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
            ${c("search",14)}
          </span>
        </div>
      </div>

      <div class="forward-modal-list" id="forward-contacts-container"></div>

      <div style="display:flex;align-items:center;justify-content:space-between;padding:0.75rem 1rem;border-top:1px solid var(--widget-border);background:var(--widget-bg);">
        <span id="forward-selected-count" style="font-size:0.78rem;color:var(--text-muted);">0 chats seleccionados</span>
        <div style="display:flex;align-items:center;gap:0.5rem;">
          <button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-forward">Cancelar</button>
          <button type="button" class="btn btn-primary btn-sm" id="btn-confirm-forward" disabled style="display:inline-flex;align-items:center;gap:0.4rem;">
            ${c("cornerUpRight",14)}
            <span id="forward-confirm-text">Reenviar</span>
          </button>
        </div>
      </div>
    </div>
  `,document.body.appendChild($);let R=$.querySelector("#forward-contacts-container"),D=$.querySelector("#forward-search-input"),a=$.querySelector("#btn-confirm-forward"),q=$.querySelector("#forward-confirm-text"),L=$.querySelector("#forward-selected-count"),G=()=>{let A=x.toLowerCase().trim(),se=u.conversations.filter(ne=>A?ne.contact_name.toLowerCase().includes(A)||ne.contact_handle.toLowerCase().includes(A):!0);if(se.length===0){R.innerHTML=`
        <div style="padding:2rem 1rem;text-align:center;color:var(--text-muted);font-size:0.85rem;">
          No se encontraron contactos para reenviar.
        </div>
      `;return}R.innerHTML=se.map(ne=>{let Y=v.has(ne.id),me=ne.contact_name?ne.contact_name.slice(0,2).toUpperCase():"WA";return`
          <div class="forward-contact-item ${Y?"is-selected":""}" data-conv-id="${ne.id}">
            <input type="checkbox" class="forward-contact-checkbox" ${Y?"checked":""} tabindex="-1" />
            <div class="avatar-circle-sm" style="width:34px;height:34px;font-size:0.75rem;flex-shrink:0;">
              ${me}
            </div>
            <div style="flex:1;min-width:0;">
              <strong style="font-size:0.85rem;color:var(--text-primary);display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${j(ne.contact_name)}
              </strong>
              <span style="font-size:0.72rem;color:var(--text-muted);display:block;">
                ${j(ne.contact_handle)}
              </span>
            </div>
            <span class="tag-pill-minimal" style="font-size:0.68rem;text-transform:capitalize;">
              ${ne.channel}
            </span>
          </div>
        `}).join(""),R.querySelectorAll(".forward-contact-item").forEach(ne=>{ne.addEventListener("click",()=>{let Y=Number(ne.getAttribute("data-conv-id"));Y&&(v.has(Y)?v.delete(Y):v.add(Y),z(),G())})})},z=()=>{let A=v.size;L.textContent=`${A} chat${A===1?"":"s"} seleccionado${A===1?"":"s"}`,A===0?(a.disabled=!0,q.textContent="Reenviar"):A===1?(a.disabled=!1,q.textContent="Reenviar a 1 chat"):(a.disabled=!1,q.textContent=`Reenviar a ${A} chats`)};D?.addEventListener("input",()=>{x=D.value,G()});let N=()=>$.remove();$.querySelector("#btn-close-forward-modal")?.addEventListener("click",N),$.querySelector("#btn-cancel-forward")?.addEventListener("click",N),$.addEventListener("click",A=>{A.target===$&&N()}),a.addEventListener("click",async()=>{if(v.size!==0){a.disabled=!0,a.innerHTML='<div class="wa-media-loading-spinner" style="width:14px;height:14px;border-width:2px;"></div> <span>Reenviando...</span>';try{await m(`/api/inbox/messages/${e}/forward`,{method:"POST",body:JSON.stringify({target_conversation_ids:Array.from(v)})}),E("Mensaje reenviado",`El mensaje fue reenviado a ${v.size} chat(s) con \xE9xito.`,"success"),N(),await h()}catch(A){E("Error al reenviar",A.message||"No se pudo reenviar el mensaje","danger"),a.disabled=!1,z()}}}),G(),setTimeout(()=>D?.focus(),80)}function rn(t){let{sub:e,apiFetch:n,refreshInbox:o}=t;document.getElementById("inbox-new-contact-modal")?.remove();let s=document.createElement("div");s.id="inbox-new-contact-modal",s.className="system-confirm-overlay",s.innerHTML=`
    <div class="system-confirm-card" style="max-width:440px;text-align:left;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
        <h3 style="margin:0;font-size:1.1rem;font-weight:700;display:flex;align-items:center;gap:0.5rem;color:var(--text-primary);">
          <span style="color:#10b981;display:inline-flex;">${c("messageSquare",20)}</span>
          <span>Iniciar Nueva Conversaci\xF3n</span>
        </h3>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-close-new-contact-modal" style="padding:0.25rem 0.5rem;" title="Cerrar">
          ${c("close",15)}
        </button>
      </div>

      <form id="form-new-contact" style="display:flex;flex-direction:column;gap:0.95rem;">
        <div class="form-group" style="display:flex;flex-direction:column;gap:0.35rem;">
          <label class="form-label" for="new-contact-name" style="font-weight:600;font-size:0.86rem;color:var(--text-primary);">Nombre del Contacto o Cliente *</label>
          <input type="text" id="new-contact-name" class="form-control" placeholder="Ej. Juan P\xE9rez" required autocomplete="off" />
        </div>

        <div class="form-group" style="display:flex;flex-direction:column;gap:0.35rem;">
          <label class="form-label" for="new-contact-phone" style="font-weight:600;font-size:0.86rem;color:var(--text-primary);">N\xFAmero de WhatsApp / Tel\xE9fono *</label>
          <input type="tel" id="new-contact-phone" class="form-control" placeholder="Ej. +51 987 654 321" required autocomplete="off" />
          <span class="form-hint" style="font-size:0.75rem;color:var(--text-muted);margin-top:0.2rem;">Escriba el n\xFAmero con c\xF3digo de pa\xEDs (ej. +51 para Per\xFA o +54 para Argentina).</span>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:0.6rem;margin-top:0.6rem;">
          <button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-new-contact">Cancelar</button>
          <button type="submit" class="btn btn-primary btn-sm" id="btn-submit-new-contact">
            ${c("send",14)}
            <span>Comenzar Chat</span>
          </button>
        </div>
      </form>
    </div>
  `,document.body.appendChild(s);let r=h=>{h.key==="Escape"&&(h.stopPropagation(),u())};window.addEventListener("keydown",r);let u=()=>{window.removeEventListener("keydown",r),s.remove()};s.querySelector("#btn-close-new-contact-modal")?.addEventListener("click",u),s.querySelector("#btn-cancel-new-contact")?.addEventListener("click",u),s.addEventListener("click",h=>{h.target===s&&u()}),s.querySelector("#form-new-contact")?.addEventListener("submit",async h=>{h.preventDefault();let v=s.querySelector("#new-contact-name"),x=s.querySelector("#new-contact-phone"),$=s.querySelector("#btn-submit-new-contact"),k=v.value.trim(),R=x.value.trim();if(!(!k||!R))try{$.disabled=!0,$.textContent="Iniciando chat...";let D=await n("/api/inbox/conversations",{method:"POST",body:JSON.stringify({contact_name:k,contact_handle:R,channel:"whatsapp"})});u(),e.selectedConversationId=D.id,await o(),E("Chat Abierto",`Conversaci\xF3n lista con ${k}.`,"success")}catch(D){$.disabled=!1,$.textContent="Comenzar Chat",E("Error al iniciar chat",D.message,"danger")}}),setTimeout(()=>{s.querySelector("#new-contact-name")?.focus()},50)}var I=window.__nexusGlobalAudio=window.__nexusGlobalAudio||{audio:new Audio,currentSrc:null,currentMessageId:null,conversationId:null,senderName:"",playbackRate:1};function We(t){if(isNaN(t)||!isFinite(t))return"0:00";let e=Math.floor(t/60),n=Math.floor(t%60);return`${e}:${n<10?"0":""}${n}`}function Dt(){if(window.__nexusGlobalAudioInitialized)return;window.__nexusGlobalAudioInitialized=!0;let t=()=>{let n=I.audio,o=!n.paused&&!n.ended,s=n.duration||0,r=n.currentTime||0,u=s>0?r/s*100:0;if(I.currentMessageId){let h=document.querySelector(`.chat-msg-row[data-id="${I.currentMessageId}"] .wa-audio-bubble`);if(h){let v=h.querySelector(".js-wa-audio-toggle"),x=h.querySelector(".js-wa-audio-fill"),$=h.querySelector(".js-wa-audio-time"),k=h.querySelector(".js-wa-audio-speed");v&&(v.innerHTML=o?c("pause",16):c("play",16)),x&&(x.style.width=`${u}%`),$&&($.textContent=o||r>0?We(r):We(s)),k&&(k.textContent=`${I.playbackRate}x`),o?h.classList.add("playing"):h.classList.remove("playing")}}let m=document.getElementById("nexus-floating-audio-bar");if(m){let v=window.__nexusCurrentSubState?.selectedConversationId!==I.conversationId,x=I.currentMessageId?!!document.querySelector(`.chat-msg-row[data-id="${I.currentMessageId}"]`):!1;if(!!I.currentSrc&&(v||!x)){m.style.display="flex";let k=m.querySelector(".js-floating-audio-toggle"),R=m.querySelector(".js-floating-audio-sender"),D=m.querySelector(".js-floating-audio-fill"),a=m.querySelector(".js-floating-audio-time"),q=m.querySelector(".js-floating-audio-speed");k&&(k.innerHTML=o?c("pause",18):c("play",18)),R&&(R.innerHTML=`${c("mic",13)} <span>${j(I.senderName||"Nota de voz")}</span>`),D&&(D.style.width=`${u}%`),a&&(a.textContent=`${We(r)} / ${We(s)}`),q&&(q.textContent=`${I.playbackRate}x`)}else m.style.display="none"}},e=I.audio;e.addEventListener("timeupdate",t),e.addEventListener("play",t),e.addEventListener("pause",t),e.addEventListener("ended",()=>{t();let n=document.getElementById("nexus-floating-audio-bar");n&&(n.style.display="none"),I.currentSrc=null,I.currentMessageId=null}),e.addEventListener("loadedmetadata",t)}function ln(t){window.__nexusCurrentSubState=t.sub,window.__nexusCurrentRerender=t.rerender,Dt();let e=document.getElementById("nexus-floating-audio-bar");e||(e=document.createElement("div"),e.id="nexus-floating-audio-bar",e.className="nexus-floating-audio-bar",e.style.display="none",e.innerHTML=`
      <button type="button" class="nexus-floating-audio-play-btn js-floating-audio-toggle" title="Reproducir / Pausar">
        ${c("play",18)}
      </button>
      <div class="nexus-floating-audio-info">
        <div class="nexus-floating-audio-sender js-floating-audio-sender" style="cursor:pointer;" title="Haga clic para ir a esta conversaci\xF3n">
          ${c("mic",13)} <span>Nota de voz</span>
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
        ${c("close",16)}
      </button>
    `,document.body.appendChild(e),e.querySelector(".js-floating-audio-toggle")?.addEventListener("click",n=>{n.stopPropagation();let o=I.audio;o.paused?o.play().catch(()=>{}):o.pause()}),e.querySelector(".js-floating-audio-track")?.addEventListener("click",n=>{n.stopPropagation();let o=e?.querySelector(".js-floating-audio-track");if(!o)return;let s=o.getBoundingClientRect(),r=n.clientX-s.left,u=Math.max(0,Math.min(1,r/s.width));I.audio.duration&&(I.audio.currentTime=u*I.audio.duration)}),e.querySelector(".js-floating-audio-speed")?.addEventListener("click",n=>{n.stopPropagation(),I.playbackRate===1?I.playbackRate=1.5:I.playbackRate===1.5?I.playbackRate=2:I.playbackRate=1,I.audio.playbackRate=I.playbackRate;let o=e?.querySelector(".js-floating-audio-speed");o&&(o.textContent=`${I.playbackRate}x`)}),e.querySelector(".js-floating-audio-close")?.addEventListener("click",n=>{n.stopPropagation(),I.audio.pause(),I.currentSrc=null,I.currentMessageId=null,e&&(e.style.display="none")}),e.querySelector(".js-floating-audio-sender")?.addEventListener("click",n=>{n.stopPropagation();let o=window.__nexusCurrentSubState,s=window.__nexusCurrentRerender;I.conversationId&&o&&s&&o.selectedConversationId!==I.conversationId&&(o.selectedConversationId=I.conversationId,s())}))}function cn(t=document,e){Dt(),t.querySelectorAll(".wa-audio-bubble").forEach(o=>{let s=o.closest(".chat-msg-row"),r=s?Number(s.getAttribute("data-id")):0,u=s?.getAttribute("data-sender")||"Nota de voz",m=o.getAttribute("data-audio-src")||s?.getAttribute("data-media-url")||"",h=o.querySelector(".js-wa-audio-toggle"),v=o.querySelector(".js-wa-audio-fill"),x=o.querySelector(".js-wa-audio-track"),$=o.querySelector(".js-wa-audio-time"),k=o.querySelector(".js-wa-audio-speed");if(!(!h||!m)){if(I.currentMessageId===r&&I.currentSrc===m){let R=I.audio,D=!R.paused&&!R.ended;h.innerHTML=D?c("pause",16):c("play",16),D&&o.classList.add("playing");let a=R.duration||0,q=R.currentTime||0,L=a>0?q/a*100:0;v&&(v.style.width=`${L}%`),$&&($.textContent=D||q>0?We(q):We(a)),k&&(k.textContent=`${I.playbackRate}x`)}h.addEventListener("click",R=>{R.stopPropagation();let D=I.audio;I.currentSrc===m?D.paused?D.play().catch(()=>{}):D.pause():(D.pause(),I.currentSrc=m,I.currentMessageId=r,I.conversationId=e?.selectedConversationId||null,I.senderName=u,D.src=m,D.playbackRate=I.playbackRate,D.play().catch(()=>{}))}),x?.addEventListener("click",R=>{R.stopPropagation();let D=I.audio;I.currentSrc!==m&&(D.pause(),I.currentSrc=m,I.currentMessageId=r,I.conversationId=e?.selectedConversationId||null,I.senderName=u,D.src=m,D.playbackRate=I.playbackRate);let a=x.getBoundingClientRect(),q=R.clientX-a.left,L=Math.max(0,Math.min(1,q/a.width));D.duration&&(D.currentTime=L*D.duration),D.paused&&D.play().catch(()=>{})}),k?.addEventListener("click",R=>{R.stopPropagation(),I.playbackRate===1?I.playbackRate=1.5:I.playbackRate===1.5?I.playbackRate=2:I.playbackRate=1,I.audio.playbackRate=I.playbackRate,k.textContent=`${I.playbackRate}x`})}})}function dn(t){let{messageId:e,currentBody:n,apiFetch:o,refreshInbox:s}=t;document.getElementById("inbox-edit-msg-modal")?.remove();let r=document.createElement("div");r.id="inbox-edit-msg-modal",r.className="system-confirm-overlay",r.innerHTML=`
    <div class="system-confirm-card" style="max-width:480px;text-align:left;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
        <h3 style="margin:0;font-size:1.1rem;font-weight:700;display:flex;align-items:center;gap:0.5rem;color:var(--text-primary);">
          <span style="color:#10b981;display:inline-flex;">${c("edit",18)}</span>
          <span>Editar Mensaje</span>
        </h3>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-close-edit-modal" style="padding:0.25rem 0.5rem;" title="Cerrar">
          ${c("close",15)}
        </button>
      </div>

      <form id="form-edit-message" style="display:flex;flex-direction:column;gap:0.95rem;">
        <div class="form-group" style="display:flex;flex-direction:column;gap:0.35rem;">
          <label class="form-label" for="edit-message-text" style="font-weight:600;font-size:0.86rem;color:var(--text-primary);">Contenido del Mensaje</label>
          <textarea id="edit-message-text" class="form-control" rows="4" style="resize:vertical;font-size:0.92rem;line-height:1.45;" required>${j(n)}</textarea>
          <span class="form-hint" style="font-size:0.75rem;color:var(--text-muted);">Al guardar, el mensaje mostrar\xE1 el distintivo "(editado)" junto a la hora.</span>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:0.6rem;margin-top:0.4rem;">
          <button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-edit">Cancelar</button>
          <button type="submit" class="btn btn-primary btn-sm" id="btn-submit-edit">
            ${c("check",14)}
            <span>Guardar Cambios</span>
          </button>
        </div>
      </form>
    </div>
  `,document.body.appendChild(r);let u=r.querySelector("#edit-message-text");setTimeout(()=>{u&&(u.focus(),u.setSelectionRange(u.value.length,u.value.length))},60);let m=()=>r.remove();r.querySelector("#btn-close-edit-modal")?.addEventListener("click",m),r.querySelector("#btn-cancel-edit")?.addEventListener("click",m),r.addEventListener("click",v=>{v.target===r&&m()}),r.querySelector("#form-edit-message")?.addEventListener("submit",async v=>{v.preventDefault();let x=u.value.trim();if(!x)return;let $=r.querySelector("#btn-submit-edit");$.disabled=!0,$.textContent="Guardando...";try{await o(`/api/inbox/messages/${e}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({body:x})}),m(),await s(),E("Mensaje editado","El mensaje fue actualizado correctamente.","success")}catch(k){$.disabled=!1,$.textContent="Guardar Cambios",E("Error al editar",k.message||"No se pudo editar el mensaje","danger")}})}function pn(t){document.getElementById("upload-progress-toast")?.remove();let e=document.createElement("div");return e.id="upload-progress-toast",e.className="upload-progress-toast",e.setAttribute("role","status"),e.innerHTML=`
    <div class="upload-progress-title"><span>Enviando ${j(t)}</span><strong id="upload-progress-pct">0%</strong></div>
    <div class="upload-progress-track"><div class="upload-progress-fill" id="upload-progress-fill" style="width:0%"></div></div>
  `,document.body.appendChild(e),{update:n=>{let o=Math.max(0,Math.min(100,Math.round(n))),s=document.getElementById("upload-progress-fill"),r=document.getElementById("upload-progress-pct");s&&(s.style.width=`${o}%`),r&&(r.textContent=`${o}%`)},done:()=>window.setTimeout(()=>e.remove(),250)}}function mn(t,e,n){return new Promise((o,s)=>{let r=new XMLHttpRequest;r.open("POST",t),r.withCredentials=!0,r.setRequestHeader("Content-Type","application/json");try{let u=localStorage.getItem("turbonetwork_session"),m=u?JSON.parse(u)?.token:"";m&&r.setRequestHeader("Authorization",`Bearer ${m}`);let h=localStorage.getItem("turbonetwork_active_tenant")||"";h&&r.setRequestHeader("x-tenant-id",h)}catch{}r.upload.onprogress=u=>{u.lengthComputable&&n(u.loaded/u.total*100)},r.onload=()=>{let u={};try{u=r.responseText?JSON.parse(r.responseText):{}}catch{u={error:r.responseText||"Error de respuesta del servidor"}}r.status>=200&&r.status<300?o(u):s(new Error(u.error||u.message||`Error HTTP ${r.status}`))},r.onerror=()=>s(new Error("Error de red al subir el archivo.")),r.send(JSON.stringify(e))})}var ge=null,Ct=!1,It=new WeakMap,gt=!1,Re="",He=null,Le=0,At=null;function un(){try{let t=window.AudioContext||window.webkitAudioContext;if(!t)return;let e=new t,n=e.createOscillator(),o=e.createGain();n.type="sine",n.frequency.value=660,o.gain.setValueAtTime(1e-4,e.currentTime),o.gain.exponentialRampToValueAtTime(.18,e.currentTime+.02),o.gain.exponentialRampToValueAtTime(1e-4,e.currentTime+.45),n.connect(o),o.connect(e.destination),n.start(),n.stop(e.currentTime+.5),n.onended=()=>{e.close()}}catch{}}function Nt(){document.getElementById("wa-conn-banner")?.remove()}function gn(t){let e=document.getElementById("wa-conn-banner");e||(e=document.createElement("div"),e.id="wa-conn-banner",e.className="wa-conn-banner",e.setAttribute("role","alert"),document.body.appendChild(e));let n=t==="awaiting_scan"||t==="disconnected";e.classList.toggle("is-danger",n),e.innerHTML=`
    <span class="wa-conn-banner-icon" aria-hidden="true">${c("alertTriangle",18)}</span>
    <div class="wa-conn-banner-text">
      <strong>${n?"WhatsApp desconectado":"Reconectando WhatsApp\u2026"}</strong>
      <span>${n?"Vuelve a escanear el c\xF3digo QR para seguir recibiendo y enviando mensajes.":"Los mensajes que env\xEDes quedar\xE1n en cola y saldr\xE1n al reconectar."}</span>
    </div>
    ${n?'<button type="button" class="wa-conn-banner-btn js-wa-banner-connect">Escanear QR</button>':""}
    <button type="button" class="wa-conn-banner-close js-wa-banner-close" aria-label="Cerrar aviso">${c("close",14)}</button>
  `}function qt(t){if(!t)return;if(t==="connected"){He!==null&&(window.clearTimeout(He),He=null);let o=gt&&Re!==""&&Re!=="connected";gt=!0,Re=t,Nt(),o&&E("WhatsApp reconectado","La conexi\xF3n se restableci\xF3. Los mensajes en cola se est\xE1n enviando.","success");return}let e=Re==="connected"||gt;if(Re=t,!e)return;gn(t),He!==null&&window.clearTimeout(He);let n=t==="awaiting_scan"||t==="disconnected";He=window.setTimeout(()=>{if(He=null,Re!=="connected"){un();try{typeof Notification<"u"&&Notification.permission==="granted"&&document.hidden&&new Notification("WhatsApp desconectado",{body:n?"Escanea el QR de nuevo para no perder mensajes de clientes.":"No se pudo reconectar. Revisa la conexi\xF3n del servidor.",icon:"/icons/icon-192.png",tag:"wa-disconnected"})}catch{}}},n?1500:8e3)}function bt(){let t=document.getElementById("chat-jump-bottom"),e=document.getElementById("chat-messages-scroller");if(!t||!e)return;let n=e.scrollHeight-e.scrollTop-e.clientHeight;n<160&&(Le=0);let o=n>=260||Le>0;t.style.display=o?"inline-flex":"none";let s=t.querySelector(".chat-jump-bottom-count");s&&(s.textContent=Le>0?String(Le):"",s.style.display=Le>0?"inline-flex":"none")}function yn(){Ct||(Ct=!0,document.addEventListener("click",async t=>{let e=t.target;if(!e)return;let n=e.closest(".js-retry-send");if(n&&ge){t.stopPropagation();let m=n.getAttribute("data-id");if(!m)return;n.disabled=!0;try{await ge.apiFetch(`/api/inbox/messages/${m}/retry`,{method:"POST"}),await ge.refreshInbox()}catch(h){n.disabled=!1,E("No se pudo reintentar",h.message,"danger")}return}let o=e.closest(".js-retry-media");if(o){t.stopPropagation();let m=o.closest(".wa-media-failed"),h=m?It.get(m):void 0;if(m&&h){let v=`r=${Date.now()}`;m.innerHTML=h.replace(/(src=")([^"]+)(")/g,(x,$,k,R)=>`${$}${k}${k.includes("?")?"&":"?"}${v}${R}`),m.classList.remove("wa-media-failed"),m.classList.add("js-open-media-lightbox")}return}if(e.closest(".js-wa-banner-connect")&&ge){t.stopPropagation(),ge.goToConnectionsTab();return}if(e.closest(".js-wa-banner-close")){Nt();return}let s=e.closest(".js-react-msg");if(s){t.stopPropagation();let m=document.getElementById("msg-reaction-popover"),h=m?.getAttribute("data-for");m?.remove();let v=s.getAttribute("data-id")||"";if(h===v)return;let x=document.createElement("div");x.id="msg-reaction-popover",x.className="msg-reaction-popover",x.setAttribute("data-for",v),x.setAttribute("role","menu"),x.innerHTML=["\u{1F44D}","\u2764\uFE0F","\u{1F602}","\u{1F62E}","\u{1F622}","\u{1F64F}"].map(R=>`<button type="button" class="msg-reaction-pick js-pick-reaction" role="menuitem" data-emoji="${R}" aria-label="Reaccionar con ${R}">${R}</button>`).join("")+`<button type="button" class="msg-reaction-pick js-pick-reaction" role="menuitem" data-emoji="" aria-label="Quitar reacci\xF3n">${c("close",13)}</button>`,document.body.appendChild(x);let $=s.getBoundingClientRect(),k=x.offsetWidth||260;x.style.top=`${Math.max(8,$.top-48)}px`,x.style.left=`${Math.min(window.innerWidth-k-8,Math.max(8,$.left-k/2))}px`;return}let r=e.closest(".js-pick-reaction");if(r&&ge){t.stopPropagation();let m=document.getElementById("msg-reaction-popover"),h=m?.getAttribute("data-for"),v=r.getAttribute("data-emoji")||"";if(m?.remove(),!h)return;try{await ge.apiFetch(`/api/inbox/messages/${h}/reaction`,{method:"POST",body:JSON.stringify({emoji:v})}),await ge.refreshInbox()}catch(x){E("No se pudo reaccionar",x.message,"danger")}return}document.getElementById("msg-reaction-popover")?.remove();let u=e.closest(".js-load-older");if(u&&ge){t.stopPropagation();let m=document.getElementById("chat-messages-scroller"),h=m?.scrollHeight??0,v=m?.scrollTop??0;u.disabled=!0,ge.sub.messageLimit=(ge.sub.messageLimit||250)+250;try{await ge.refreshInbox();let x=document.getElementById("chat-messages-scroller");x&&(x.scrollTop=x.scrollHeight-h+v)}catch(x){E("No se pudieron cargar mensajes anteriores",x.message,"danger")}return}if(e.closest("#chat-jump-bottom")){let m=document.getElementById("chat-messages-scroller");m&&m.scrollTo({top:m.scrollHeight,behavior:"smooth"}),Le=0,bt()}}),document.addEventListener("error",t=>{let e=t.target;if(!e||!(e instanceof HTMLImageElement||e instanceof HTMLVideoElement)||!/wa-sticker-img|wa-standalone-image-el|wa-standalone-video-el/.test(e.className))return;let n=e.closest(".wa-sticker-media-wrapper, .wa-image-media-wrapper, .wa-video-media-wrapper");!n||n.classList.contains("wa-media-failed")||(It.set(n,n.innerHTML),n.classList.remove("js-open-media-lightbox"),n.classList.add("wa-media-failed"),n.innerHTML=yt(!0))},!0))}function Ot(t){let{sub:e,apiFetch:n,refreshInbox:o,goToConnectionsTab:s,rerender:r}=t;if(ge={sub:e,apiFetch:n,refreshInbox:o,goToConnectionsTab:s},yn(),e.connections?.wa_active_mode==="qr"&&e.connections?.wa_qr_status){let i=String(e.connections.wa_qr_status);i!==Re&&qt(i)}At!==e.selectedConversationId&&(Le=0,At=e.selectedConversationId),document.getElementById("chat-messages-scroller")?.addEventListener("scroll",bt,{passive:!0}),window.setTimeout(bt,60);let m=[],h=-1,v=document.getElementById("chat-search-input"),x=document.getElementById("chat-search-count"),$=i=>{m.forEach(d=>d.classList.remove("chat-search-current"));let l=m[h];l&&(l.classList.add("chat-search-current"),i&&l.scrollIntoView({block:"center",behavior:"smooth"})),x&&(x.textContent=m.length>0?`${h+1} de ${m.length}`:v?.value.trim()?"Sin resultados":"")},k=i=>{document.querySelectorAll(".chat-search-hit").forEach(d=>d.classList.remove("chat-search-hit","chat-search-current")),m=[];let l=(e.messageSearch?.query||"").trim().toLowerCase();l&&document.querySelectorAll("#chat-messages-scroller .chat-msg-row").forEach(d=>{(d.textContent||"").toLowerCase().includes(l)&&(d.classList.add("chat-search-hit"),m.push(d))}),h=m.length>0?m.length-1:-1,$(i)},R=i=>{m.length!==0&&(h=(h+i+m.length)%m.length,$(!0))};document.getElementById("btn-toggle-chat-search")?.addEventListener("click",()=>{let i=!e.messageSearch?.open;e.messageSearch={open:i,query:i&&e.messageSearch?.query||""},r(),i&&document.getElementById("chat-search-input")?.focus()}),document.getElementById("btn-chat-search-close")?.addEventListener("click",()=>{e.messageSearch={open:!1,query:""},r()}),document.getElementById("btn-chat-search-next")?.addEventListener("click",()=>R(1)),document.getElementById("btn-chat-search-prev")?.addEventListener("click",()=>R(-1));let D=null;v?.addEventListener("input",()=>{e.messageSearch={open:!0,query:v.value},D!==null&&window.clearTimeout(D),D=window.setTimeout(()=>k(!0),180)}),v?.addEventListener("keydown",i=>{i.key==="Enter"?(i.preventDefault(),R(i.shiftKey?-1:1)):i.key==="Escape"&&(e.messageSearch={open:!1,query:""},r())}),e.messageSearch?.open&&e.messageSearch.query&&k(!1),st(),nn(),ln({sub:e,rerender:r}),cn(document,e),e.selectedConversationId&&e.messages&&e.messages.length>0&&Oe.set(e.selectedConversationId,e.messages),document.querySelectorAll(".js-chat-back-to-list").forEach(i=>{i.addEventListener("click",()=>{e.selectedConversationId=null,r()})});let a=i=>{let l=document.getElementById("chat-composer-input"),d=document.getElementById("slash-command-popover");if(d&&(d.style.display="none"),i.media_type&&i.media_type!=="none"&&i.media_url){e.pendingAttachment={media_type:i.media_type,media_url:i.media_url,media_filename:i.media_filename||`${i.shortcut}`,media_mimetype:i.media_mimetype||"application/octet-stream"},r();let y=document.getElementById("chat-composer-input");y&&(y.value=i.body,y.focus())}else l&&(l.value=i.body,l.focus())},q=0,L=!1,G=null,z=async(i=!1)=>{if(L)return;if(!document.querySelector(".inbox-workspace-100vh")){st();return}L=!0;let l=document.activeElement,d=l&&(l.id==="inbox-search-input"||l.id==="chat-composer-input"||l.id==="new-conv-note-input");try{let y=!1;try{let Q=await n("/api/inbox/sync-status"),B=!!e.waSync?.active;if(e.waSync=Q,Q.active){if(!document.getElementById("wa-sync-banner"))r();else{let{pct:we,detail:$e,title:le}=Bt(Q),ye=document.getElementById("wa-sync-title"),be=document.getElementById("wa-sync-detail"),Se=document.getElementById("wa-sync-bar-fill");ye&&(ye.textContent=le),be&&(be.textContent=$e),Se&&(Se.style.width=`${we}%`)}if(!i&&Date.now()-q<2e3)return}else if(B){y=!0;let K=document.getElementById("wa-sync-banner");K&&K.remove()}}catch{}q=Date.now();let g=e.selectedConversationId?`/api/inbox?active_conv_id=${e.selectedConversationId}&msg_limit=${e.messageLimit||250}`:"/api/inbox",b=await n(g);if(Fe===0)Fe=b.messages.reduce((Q,B)=>Math.max(Q,B.id),0);else{let Q=b.messages.filter(B=>B.id>Fe&&B.sender_type==="contact");if(Q.length>0){let B=Q[Q.length-1];Fe=b.messages.reduce((K,we)=>Math.max(K,we.id),0),an(B.sender_name,B.body),E(`Mensaje de ${B.sender_name}`,B.body||"Nuevo archivo o nota de voz recibido.","info")}else Fe=Math.max(Fe,b.messages.reduce((B,K)=>Math.max(B,K.id),0))}let C=b.messages.length!==e.messages.length,W=(b.messages[b.messages.length-1]?.id??0)!==(e.messages[e.messages.length-1]?.id??0),F=b.messages.some(Q=>{let B=e.messages.find(K=>K.id===Q.id);return B&&(B.delivery_status!==Q.delivery_status||JSON.stringify(B.reactions_json||[])!==JSON.stringify(Q.reactions_json||[]))}),U=b.conversations.some(Q=>{let B=e.conversations.find(K=>K.id===Q.id);return B&&B.unread_count!==Q.unread_count});if(C||W||F||U||y||b.conversations.length!==e.conversations.length){let Q=document.activeElement?.id==="chat-composer-input",B=document.getElementById("chat-composer-input")?.value||"",K=document.getElementById("chat-composer-input")?.selectionStart??B.length,we=document.getElementById("chat-composer-input")?.selectionEnd??B.length,le=document.querySelector(".inbox-conversations-list")?.scrollTop??0,ye=document.getElementById("chat-messages-scroller"),be=ye?.scrollTop??0,Se=ye?ye.scrollHeight-ye.scrollTop-ye.clientHeight<90:!0,Ke=document.getElementById("inbox-pc-dropdown-menu")?.style.display==="flex",he=document.getElementById("chat-emoji-picker-popover")?.style.display==="flex",ct=document.activeElement?.id==="chat-search-input",wt=document.querySelector("#chat-emoji-picker-popover .chat-emoji-tab.active")?.getAttribute("data-emoji-cat")||"freq";if(!Se&&e.selectedConversationId){let pe=new Set(e.messages.map(Be=>Be.id));Le+=b.messages.filter(Be=>!pe.has(Be.id)&&Be.sender_type==="contact").length}e.conversations=b.conversations,e.messages=b.messages,e.selectedConversationId&&Oe.set(e.selectedConversationId,b.messages),e.connections=b.connections,e.quickReplies=b.quickReplies||e.quickReplies,e.tags=b.tags||e.tags,e.notes=b.notes||e.notes,r();let xt=document.querySelector(".inbox-conversations-list");xt&&le>0&&(xt.scrollTop=le);let Ye=document.getElementById("chat-messages-scroller");if(Ye&&(Se?Ye.scrollTop=Ye.scrollHeight:Ye.scrollTop=be),Ke){let pe=document.getElementById("inbox-pc-dropdown-menu");pe&&(pe.style.display="flex")}if(ct){let pe=document.getElementById("chat-search-input");if(pe){pe.focus();try{pe.setSelectionRange(pe.value.length,pe.value.length)}catch{}}}if(he){let pe=document.getElementById("chat-emoji-picker-popover"),Be=document.getElementById("btn-toggle-emoji-picker");if(pe){pe.style.display="flex",Be&&Be.setAttribute("aria-expanded","true");let Et=pe.querySelector(`.chat-emoji-tab[data-emoji-cat="${wt}"]`);Et&&wt!=="freq"&&Et.click()}}let Ze=document.getElementById("chat-composer-input");if(Ze&&(B&&(Ze.value=B),Q||d)){Ze.focus();try{Ze.setSelectionRange(K,we)}catch{}}}}catch{}finally{L=!1}};if(typeof EventSource<"u")try{Ge=new EventSource("/api/inbox/events"),Ge.addEventListener("inbox",i=>{try{let l=i.data?JSON.parse(i.data):null;if(l?.type==="connection_status"){qt(String(l.status||""));let d=document.getElementById("inbox-wa-live-pill"),y=document.getElementById("inbox-wa-live-label");if(d&&y){let g=l.status==="connected"?"#10b981":"#f59e0b";d.style.setProperty("--tag-color",g),y.textContent=l.status==="connected"?"WhatsApp en vivo":l.status==="reconnecting"?"Reconectando...":"QR pendiente"}}}catch{}G!==null&&window.clearTimeout(G),G=window.setTimeout(()=>{z(!0)},120)})}catch{}ot=window.setInterval(()=>{z(!1)},2500);let N=document.getElementById("inbox-pc-dropdown-menu");document.getElementById("btn-inbox-pc-menu")?.addEventListener("click",i=>{i.stopPropagation(),N&&(N.style.display=N.style.display==="flex"?"none":"flex")}),document.addEventListener("click",()=>{N&&(N.style.display="none")});let A=document.getElementById("inbox-mobile-sheet-overlay");document.getElementById("btn-inbox-mobile-fab")?.addEventListener("click",()=>{A&&(A.style.display="flex")}),document.getElementById("btn-close-mobile-sheet")?.addEventListener("click",()=>{A&&(A.style.display="none")}),A?.addEventListener("click",i=>{i.target===A&&(A.style.display="none")}),document.querySelectorAll(".js-opt-sync-wa").forEach(i=>{i.addEventListener("click",async()=>{N&&(N.style.display="none"),A&&(A.style.display="none");try{let l=await n("/api/inbox/sync-whatsapp",{method:"POST"});await o(),E(l.synced?"Chats Sincronizados":"Estado de Sincronizaci\xF3n",l.message||`${l.totalConversations??0} conversaci\xF3n(es) de WhatsApp en bandeja.`,l.synced?"success":"info")}catch(l){E("Error al sincronizar WhatsApp",l.message,"danger")}})}),document.querySelectorAll(".js-opt-sync-ig").forEach(i=>{i.addEventListener("click",async()=>{N&&(N.style.display="none"),A&&(A.style.display="none");try{let l=await n("/api/inbox/sync-instagram",{method:"POST"});await o(),E(l.synced?"Instagram Sincronizado":"Aviso de Instagram Direct",l.message||(l.synced?`Se sincronizaron ${l.syncedConversations} chats de Instagram.`:"No se recibieron mensajes."),l.synced?"success":"info")}catch(l){E("Error al sincronizar Instagram",l.message,"danger")}})}),document.querySelectorAll(".js-opt-sync-all").forEach(i=>{i.addEventListener("click",async()=>{N&&(N.style.display="none"),A&&(A.style.display="none");try{await n("/api/inbox/sync-all",{method:"POST"}),await o(),E("Redes Sincronizadas","Se sincronizaron todas las redes conectadas (WhatsApp, Instagram, Facebook).","success")}catch(l){E("Error al sincronizar redes",l.message,"danger")}})}),document.querySelectorAll(".js-opt-sync-fb").forEach(i=>{i.addEventListener("click",async()=>{N&&(N.style.display="none"),A&&(A.style.display="none");try{let l=await n("/api/inbox/sync-facebook",{method:"POST"});await o(),E("Facebook Sincronizado",`Se descargaron ${l.syncedConversations} chats y ${l.syncedMessages} mensajes de tu p\xE1gina de Facebook.`,"success")}catch(l){E("Error al sincronizar Facebook",l.message,"danger")}})}),document.querySelectorAll(".js-goto-connections").forEach(i=>{i.addEventListener("click",()=>{s()})}),document.querySelectorAll(".js-opt-quick-replies").forEach(i=>{i.addEventListener("click",()=>{N&&(N.style.display="none"),A&&(A.style.display="none"),Pe({sub:e,apiFetch:n,refreshInbox:o,onSelect:a})})}),document.querySelectorAll(".js-opt-tags").forEach(i=>{i.addEventListener("click",()=>{N&&(N.style.display="none"),A&&(A.style.display="none"),Qe({sub:e,apiFetch:n,refreshInbox:o})})});let se=async()=>{if((e.connections||{})?.wa_active_mode!=="api"){await et({title:"Mensajes Masivos requiere WhatsApp Cloud API",description:'Actualmente WhatsApp est\xE1 configurado en modo "Servidor QR Interno". \xBFDesea ir a la pesta\xF1a Conexiones para activar el modo WhatsApp Cloud API oficial?',confirmLabel:"Ir a Conexiones",cancelLabel:"Cancelar"})&&s();return}let l=document.getElementById("global-form-dialog");if(!l)return;l.innerHTML=`
      <form id="broadcast-modal-form" class="crm-form-modal-surface">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
          <div>
            <h3 id="form-dialog-title" style="font-size:1.18rem;display:flex;align-items:center;gap:0.5rem;">
              ${c("megaphone",18)}
              <span>Campa\xF1a de Mensajes Masivos (WhatsApp Cloud API)</span>
            </h3>
            <p style="font-size:0.8rem;color:var(--text-muted);">
              Se enviar\xE1 simult\xE1neamente a todos los contactos de WhatsApp mediante su conexi\xF3n oficial Cloud API.
            </p>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" id="close-broadcast-modal">
            ${c("close",16)}
          </button>
        </div>

        <div class="form-group" style="margin-bottom:1.25rem;">
          <label class="form-label" for="broadcast-message-text">Contenido de la Plantilla / Mensaje Masivo *</label>
          <textarea id="broadcast-message-text" class="form-control" rows="4" required>Hola, le saludamos desde nuestro canal oficial. Tenemos una promoci\xF3n corporativa especial disponible esta semana para su empresa.</textarea>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:0.65rem;">
          <button type="button" class="btn btn-secondary" id="cancel-broadcast-modal">Cancelar</button>
          <button type="submit" class="btn btn-primary">
            ${c("send",15)}
            <span>Disparar Env\xEDo Masivo Ahora</span>
          </button>
        </div>
      </form>
    `;let d=()=>l.close();l.querySelector("#close-broadcast-modal")?.addEventListener("click",d),l.querySelector("#cancel-broadcast-modal")?.addEventListener("click",d),l.querySelector("#broadcast-modal-form")?.addEventListener("submit",async y=>{y.preventDefault();let g=l.querySelector("#broadcast-message-text").value.trim();try{let b=await n("/api/inbox/whatsapp-broadcast",{method:"POST",body:JSON.stringify({messageText:g})});d(),await o(),E("Difusi\xF3n enviada",`Mensaje masivo enviado a ${b.sentCount} contactos por WhatsApp Cloud API.`,"success")}catch(b){E("Error en difusi\xF3n masiva",b.message,"danger")}}),l.showModal()};document.querySelectorAll(".js-opt-broadcast").forEach(i=>{i.addEventListener("click",async()=>{N&&(N.style.display="none"),A&&(A.style.display="none"),await se()})}),document.querySelectorAll(".js-filter-channel").forEach(i=>{i.addEventListener("click",()=>{e.channelFilter=i.getAttribute("data-channel")||"all",r()})}),document.querySelectorAll(".js-filter-tag").forEach(i=>{i.addEventListener("click",()=>{let l=i.getAttribute("data-tag")||"";e.tagFilter=e.tagFilter===l?"":l,r()})});let ne=document.getElementById("inbox-search-input");ne?.addEventListener("input",()=>{e.searchQuery=ne.value,r();let i=document.getElementById("inbox-search-input");i&&(i.focus(),i.setSelectionRange(i.value.length,i.value.length))}),document.querySelectorAll(".js-select-conv").forEach(i=>{i.addEventListener("click",()=>{let l=Number(i.getAttribute("data-conv-id"));if(e.selectedConversationId===l)return;e.selectedConversationId=l,e.messageLimit=250,e.messageSearch={open:!1,query:""};let d=e.conversations.find(y=>y.id===l);d&&(d.unread_count=0),Oe.has(l)?(e.messages=Oe.get(l),r()):(e.messages=[],r()),n(`/api/inbox/conversations/${l}/messages?limit=250`).then(y=>{let g=Oe.get(l)?.length??-1;Oe.set(l,y),e.selectedConversationId===l&&(y.length!==g||e.messages.length!==y.length)&&(e.messages=y,r())}).catch(()=>{}),n(`/api/inbox/conversations/${l}/read`,{method:"POST"}).catch(()=>{})})}),document.getElementById("btn-toggle-side-drawer-notes")?.addEventListener("click",()=>{e.sideDrawerTab=e.sideDrawerTab==="notes"?"none":"notes",r()}),document.getElementById("btn-toggle-side-drawer-tags")?.addEventListener("click",()=>{e.sideDrawerTab=e.sideDrawerTab==="tags"?"none":"tags",r()}),document.getElementById("btn-close-side-drawer")?.addEventListener("click",()=>{e.sideDrawerTab="none",r()}),document.getElementById("chat-side-drawer-backdrop")?.addEventListener("click",()=>{e.sideDrawerTab="none",r()}),document.getElementById("btn-drawer-open-tag-crud")?.addEventListener("click",()=>{Qe({sub:e,apiFetch:n,refreshInbox:o})});let Y=e.conversations.find(i=>i.id===e.selectedConversationId)||e.conversations[0];document.querySelectorAll(".js-toggle-conv-tag").forEach(i=>{i.addEventListener("click",async()=>{if(!Y)return;let l=i.getAttribute("data-tag-name")||"";if(!l)return;let d=Me(Y.tags_json),g=d.some(b=>b.toLowerCase()===l.toLowerCase())?d.filter(b=>b.toLowerCase()!==l.toLowerCase()):[...d,l];try{await n(`/api/inbox/conversations/${Y.id}/tags`,{method:"PUT",body:JSON.stringify({tags:g,assigned_user_id:Y.assigned_user_id})}),await o()}catch(b){E("Error actualizando etiquetas",b.message,"danger")}})});let me=document.getElementById("conv-assigned-user-select");me?.addEventListener("change",async()=>{if(!Y)return;let i=me.value?Number(me.value):null;try{await n(`/api/inbox/conversations/${Y.id}/tags`,{method:"PUT",body:JSON.stringify({tags:Me(Y.tags_json),assigned_user_id:i})}),await o(),E("Responsable actualizado","Se actualiz\xF3 la asignaci\xF3n del chat.","success")}catch(l){E("Error asignando usuario",l.message,"danger")}}),document.querySelectorAll(".js-manage-user-tags").forEach(i=>{i.addEventListener("click",()=>{let l=Number(i.getAttribute("data-user-id")),d=e.users.find(C=>C.id===l);if(!d)return;let y=document.getElementById("global-form-dialog");if(!y)return;let g=Me(d.tags_json),b=()=>{y.innerHTML=`
          <div class="crm-form-modal-surface" style="max-width:480px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.85rem;">
              <div>
                <h3 style="font-size:1.05rem;">Etiquetas de ${d.full_name}</h3>
                <p style="font-size:0.78rem;color:var(--text-muted);">Toque las etiquetas para asignarlas o quitarlas de este usuario.</p>
              </div>
              <button type="button" class="btn btn-secondary btn-sm" id="close-user-tags-modal">
                ${c("close",15)}
              </button>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:0.45rem;padding:0.85rem;border-radius:0.75rem;background:var(--surface-subtle);border:1px solid var(--widget-border);margin-bottom:1rem;">
              ${e.tags.map(C=>{let W=g.some(F=>F.toLowerCase()===C.name.toLowerCase());return ze(C.name,e.tags,`interactive ${W?"active-filter":""} js-pick-user-tag`,`data-tag-name="${C.name}"`)}).join("")}
            </div>
            <div style="display:flex;justify-content:flex-end;gap:0.5rem;">
              <button type="button" class="btn btn-secondary btn-sm" id="cancel-user-tags-modal">Cerrar</button>
              <button type="button" class="btn btn-primary btn-sm" id="save-user-tags-modal">
                ${c("save",14)}
                <span>Guardar Etiquetas de Usuario</span>
              </button>
            </div>
          </div>
        `,y.querySelector("#close-user-tags-modal")?.addEventListener("click",()=>y.close()),y.querySelector("#cancel-user-tags-modal")?.addEventListener("click",()=>y.close()),y.querySelectorAll(".js-pick-user-tag").forEach(C=>{C.addEventListener("click",()=>{let W=C.getAttribute("data-tag-name")||"";g=g.some(U=>U.toLowerCase()===W.toLowerCase())?g.filter(U=>U.toLowerCase()!==W.toLowerCase()):[...g,W],b()})}),y.querySelector("#save-user-tags-modal")?.addEventListener("click",async()=>{try{await n(`/api/users/${d.id}/tags`,{method:"PUT",body:JSON.stringify({tags:g})}),y.close(),await o(),E("Etiquetas de Usuario Guardadas",`Se actualizaron las etiquetas de ${d.full_name}.`,"success")}catch(C){E("Error guardando etiquetas",C.message,"danger")}})};b(),y.showModal()})}),document.getElementById("form-add-conv-note")?.addEventListener("submit",async i=>{if(i.preventDefault(),!Y)return;let l=document.getElementById("new-conv-note-input");if(!(!l||!l.value.trim()))try{await n(`/api/inbox/conversations/${Y.id}/notes`,{method:"POST",body:JSON.stringify({content:l.value.trim()})}),l.value="",await o(),E("Nota guardada","La nota interna fue a\xF1adida a este cliente.","success")}catch(d){E("Error guardando nota",d.message,"danger")}}),document.querySelectorAll(".js-edit-conv-note").forEach(i=>{i.addEventListener("click",async()=>{let l=Number(i.getAttribute("data-note-id")),d=e.notes.find(g=>g.id===l);if(!d)return;let y=document.getElementById("global-form-dialog");y&&(y.innerHTML=`
        <form id="edit-note-modal-form" class="crm-form-modal-surface" style="max-width:460px;">
          <h3 style="font-size:1.05rem;margin-bottom:0.75rem;">Editar Nota Interna</h3>
          <textarea id="edit-note-textarea" class="form-control" rows="4" required>${d.content}</textarea>
          <div style="display:flex;justify-content:flex-end;gap:0.5rem;margin-top:0.85rem;">
            <button type="button" class="btn btn-secondary btn-sm" id="cancel-edit-note">Cancelar</button>
            <button type="submit" class="btn btn-primary btn-sm">Guardar Cambios</button>
          </div>
        </form>
      `,y.querySelector("#cancel-edit-note")?.addEventListener("click",()=>y.close()),y.querySelector("#edit-note-modal-form")?.addEventListener("submit",async g=>{g.preventDefault();let b=y.querySelector("#edit-note-textarea").value.trim();await n(`/api/inbox/notes/${d.id}`,{method:"PUT",body:JSON.stringify({content:b})}),y.close(),await o()}),y.showModal())})}),document.querySelectorAll(".js-delete-conv-note").forEach(i=>{i.addEventListener("click",async()=>{let l=Number(i.getAttribute("data-note-id"));try{await n(`/api/inbox/notes/${l}`,{method:"DELETE"}),await o()}catch(d){E("Error eliminando nota",d.message,"danger")}})});let V=document.getElementById("chat-composer-input"),ue=document.getElementById("chat-composer-form"),Z=document.getElementById("slash-command-popover"),xe=document.getElementById("slash-command-list"),ce=document.getElementById("chat-direct-file-input"),ie=document.getElementById("chat-emoji-picker-popover"),P=document.getElementById("chat-emoji-grid"),p=document.getElementById("chat-sticker-panel"),de=document.getElementById("chat-sticker-file-input"),fe=document.getElementById("btn-toggle-emoji-picker"),J={freq:["\u{1F44D}","\u{1F64F}","\u{1F60A}","\u{1F602}","\u2764\uFE0F","\u{1F525}","\u2705","\u{1F44B}","\u{1F389}","\u{1F4AF}","\u{1F44C}","\u{1F91D}","\u{1F64C}","\u{1F609}","\u{1F60D}","\u{1F914}","\u{1F605}","\u{1F680}","\u26A1","\u{1F4CC}","\u{1F4DE}","\u{1F4E1}","\u{1F527}","\u{1F4C4}"],faces:["\u{1F600}","\u{1F603}","\u{1F604}","\u{1F601}","\u{1F606}","\u{1F605}","\u{1F923}","\u{1F602}","\u{1F642}","\u{1F609}","\u{1F60A}","\u{1F607}","\u{1F970}","\u{1F60D}","\u{1F929}","\u{1F618}","\u{1F60B}","\u{1F61B}","\u{1F61C}","\u{1F92A}","\u{1F928}","\u{1F9D0}","\u{1F913}","\u{1F60E}","\u{1F973}","\u{1F60F}","\u{1F612}","\u{1F61E}","\u{1F614}","\u{1F61F}","\u{1F615}","\u{1F641}","\u{1F623}","\u{1F616}","\u{1F62B}","\u{1F629}","\u{1F97A}","\u{1F622}","\u{1F62D}","\u{1F624}","\u{1F620}","\u{1F621}","\u{1F92F}","\u{1F633}","\u{1F631}","\u{1F917}","\u{1F914}","\u{1F92B}","\u{1F636}","\u{1F610}","\u{1F644}","\u{1F634}"],hands:["\u{1F44B}","\u{1F91A}","\u{1F590}\uFE0F","\u270B","\u{1F44C}","\u{1F90C}","\u{1F90F}","\u270C\uFE0F","\u{1F91E}","\u{1F91F}","\u{1F918}","\u{1F919}","\u{1F448}","\u{1F449}","\u{1F446}","\u{1F447}","\u261D\uFE0F","\u{1F44D}","\u{1F44E}","\u270A","\u{1F44A}","\u{1F91B}","\u{1F91C}","\u{1F44F}","\u{1F64C}","\u{1F450}","\u{1F932}","\u{1F91D}","\u{1F64F}","\u{1F4AA}"],work:["\u{1F4E1}","\u{1F310}","\u{1F4BB}","\u{1F4F1}","\u260E\uFE0F","\u{1F527}","\u{1F6E0}\uFE0F","\u{1F4E6}","\u{1F4CB}","\u{1F4C4}","\u{1F4CD}","\u{1F3E0}","\u{1F3E2}","\u{1F697}","\u26A1","\u{1F50C}","\u{1F50B}","\u{1F4A1}","\u{1F514}","\u23F0","\u{1F4C5}","\u{1F4B0}","\u{1F4B3}","\u{1F9FE}","\u{1F4C8}","\u{1F4CA}","\u{1F512}","\u{1F511}"],symbols:["\u2705","\u274C","\u26A0\uFE0F","\u2757","\u2753","\u{1F4AC}","\u{1F4AD}","\u2764\uFE0F","\u{1F9E1}","\u{1F49B}","\u{1F49A}","\u{1F499}","\u{1F49C}","\u{1F5A4}","\u{1F90D}","\u{1F4AF}","\u{1F525}","\u2728","\u2B50","\u{1F31F}","\u{1F3AF}","\u{1F3C6}","\u{1F389}","\u{1F38A}","\u27A1\uFE0F","\u2B05\uFE0F","\u2B06\uFE0F","\u2B07\uFE0F","\u{1F504}"]},ee=[{id:"ok",emoji:"\u{1F44D}",label:"\xA1Listo!",accent:"#2563eb"},{id:"thanks",emoji:"\u{1F64F}",label:"Gracias",accent:"#10b981"},{id:"hello",emoji:"\u{1F44B}",label:"\xA1Hola!",accent:"#0ea5e9"},{id:"tech",emoji:"\u{1F527}",label:"En camino",accent:"#f59e0b"},{id:"approved",emoji:"\u2705",label:"Aprobado",accent:"#16a34a"},{id:"online",emoji:"\u{1F4E1}",label:"Conectado",accent:"#6366f1"},{id:"great",emoji:"\u2764\uFE0F",label:"Genial",accent:"#e11d48"},{id:"party",emoji:"\u{1F389}",label:"\xA1\xC9xito!",accent:"#9333ea"}],Xe=(i,l,d)=>{let y=document.createElement("canvas");y.width=512,y.height=512;let g=y.getContext("2d");return g?(g.clearRect(0,0,512,512),g.save(),g.beginPath(),g.roundRect(36,36,440,440,96),g.fillStyle=d,g.fill(),g.lineWidth=18,g.strokeStyle="#ffffff",g.stroke(),g.restore(),g.textAlign="center",g.textBaseline="middle",g.font='210px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif',g.fillText(i,256,215),g.font='bold 64px "Plus Jakarta Sans", system-ui, sans-serif',g.fillStyle="#ffffff",g.fillText(l,256,395),y.toDataURL("image/webp",.92)):""},rt=i=>new Promise((l,d)=>{if(i.type==="image/webp"&&i.size<=512*1024){let b=new FileReader;b.onload=()=>l(String(b.result||"")),b.onerror=()=>d(new Error("No se pudo leer el archivo WebP.")),b.readAsDataURL(i);return}let y=URL.createObjectURL(i),g=new Image;g.onload=()=>{try{let b=document.createElement("canvas");b.width=512,b.height=512;let C=b.getContext("2d");if(!C){URL.revokeObjectURL(y),d(new Error("Canvas no disponible."));return}C.clearRect(0,0,512,512);let W=Math.min(480/g.width,480/g.height),F=Math.round(g.width*W),U=Math.round(g.height*W),Q=Math.round((512-F)/2),B=Math.round((512-U)/2);C.drawImage(g,Q,B,F,U);let K=b.toDataURL("image/webp",.92);URL.revokeObjectURL(y),l(K)}catch(b){URL.revokeObjectURL(y),d(b)}},g.onerror=()=>{URL.revokeObjectURL(y),d(new Error("Imagen no v\xE1lida para sticker."))},g.src=y}),Ee=async(i,l="sticker.webp")=>{let d=e.conversations.find(F=>F.id===e.selectedConversationId);if(!d||!i)return;ie&&(ie.style.display="none",fe?.setAttribute("aria-expanded","false"));let y=e.replyingTo?.id||null,g=e.replyingTo?.sender||"",b=e.replyingTo?.body||"",C=e.replyingTo?.media_url||"",W=e.replyingTo?.media_type||"none";e.replyingTo=null;try{let F=await n(`/api/inbox/conversations/${d.id}/messages`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({body:"",sender:"agent",media_type:"sticker",media_url:i,media_filename:l,media_mimetype:"image/webp",reply_to_id:y,reply_to_sender:g,reply_to_body:b,reply_to_media_url:C,reply_to_media_type:W})});if(F?.message?.id&&(e.lastSentMessageId=F.message.id),await o(),e.lastSentMessageId){let U=document.querySelector(`.chat-msg-row[data-id="${e.lastSentMessageId}"]`);U&&U.scrollIntoView({behavior:"smooth",block:"end"})}}catch(F){E("Error al enviar sticker",F.message,"danger")}},Te=null,lt=async()=>{if(!P||!p)return;if(P.style.display="none",p.style.display="flex",!Te)try{Te=(await n("/api/inbox/stickers")).stickers||[]}catch{Te=[]}let i=Te.length>0?`
          <div class="chat-sticker-section-title">Stickers recientes de WhatsApp</div>
          <div class="chat-sticker-grid">
            ${Te.map(d=>`
                  <button type="button" class="chat-sticker-item js-send-existing-sticker" data-sticker-url="${j(d.media_url)}" data-sticker-name="${j(d.media_filename||"sticker.webp")}" title="Enviar sticker">
                    <img src="${j(d.media_url)}" alt="Sticker" class="chat-sticker-thumb" loading="lazy" />
                  </button>
                `).join("")}
          </div>
        `:"",l=`
      <div class="chat-sticker-section-title">Stickers r\xE1pidos</div>
      <div class="chat-sticker-grid">
        ${ee.map(d=>{let y=Xe(d.emoji,d.label,d.accent);return`
            <button type="button" class="chat-sticker-item js-send-quick-sticker" data-sticker-url="${y}" data-sticker-name="sticker_${d.id}.webp" title="Enviar sticker ${j(d.label)}">
              <img src="${y}" alt="${j(d.label)}" class="chat-sticker-thumb" />
            </button>
          `}).join("")}
      </div>
    `;p.innerHTML=`
      <div class="chat-sticker-toolbar">
        <button type="button" class="chat-sticker-upload-btn" id="btn-upload-custom-sticker">
          ${c("plus",14)}
          <span>Crear sticker desde imagen</span>
        </button>
      </div>
      <div class="chat-sticker-scroll">
        ${i}
        ${l}
      </div>
    `,p.querySelector("#btn-upload-custom-sticker")?.addEventListener("click",d=>{d.stopPropagation(),de?.click()}),p.querySelectorAll(".js-send-existing-sticker, .js-send-quick-sticker").forEach(d=>{d.addEventListener("click",y=>{y.stopPropagation();let g=d.getAttribute("data-sticker-url")||"",b=d.getAttribute("data-sticker-name")||"sticker.webp";Ee(g,b)})})},_e=i=>{if(i==="stickers"){lt();return}if(!P)return;p&&(p.style.display="none"),P.style.display="grid";let l=J[i]||J.freq;P.innerHTML=l.map(d=>`<button type="button" class="chat-emoji-item" data-emoji="${d}">${d}</button>`).join(""),P.querySelectorAll(".chat-emoji-item").forEach(d=>{d.addEventListener("click",y=>{y.stopPropagation();let g=d.getAttribute("data-emoji")||"",b=document.getElementById("chat-composer-input");if(!b||!g)return;let C=b.selectionStart??b.value.length,W=b.selectionEnd??b.value.length;b.value=b.value.slice(0,C)+g+b.value.slice(W);let F=C+g.length;b.focus();try{b.setSelectionRange(F,F)}catch{}b.dispatchEvent(new Event("input",{bubbles:!0}))})})};if(de&&de.addEventListener("change",async()=>{let i=de.files?.[0];if(de.value="",!!i)try{let l=await rt(i);Te=null,await Ee(l,`sticker_${Date.now()}.webp`)}catch(l){E("Error al crear sticker",l.message,"danger")}}),ie&&fe){_e("freq"),fe.addEventListener("click",l=>{l.stopPropagation();let d=ie.style.display==="flex";ie.style.display=d?"none":"flex",fe.setAttribute("aria-expanded",d?"false":"true")}),ie.addEventListener("click",l=>{l.stopPropagation()}),ie.querySelectorAll(".chat-emoji-tab").forEach(l=>{l.addEventListener("click",d=>{d.stopPropagation();let y=l.getAttribute("data-emoji-cat")||"freq";ie.querySelectorAll(".chat-emoji-tab").forEach(g=>{g.classList.remove("active"),g.setAttribute("aria-selected","false")}),l.classList.add("active"),l.setAttribute("aria-selected","true"),_e(y)})});let i=window;i.__turboEmojiDocListenersBound||(i.__turboEmojiDocListenersBound=!0,document.addEventListener("click",()=>{let l=document.getElementById("chat-emoji-picker-popover"),d=document.getElementById("btn-toggle-emoji-picker");l&&l.style.display==="flex"&&(l.style.display="none",d?.setAttribute("aria-expanded","false"))}),document.addEventListener("keydown",l=>{if(l.key==="Escape"){let d=document.getElementById("chat-emoji-picker-popover"),y=document.getElementById("btn-toggle-emoji-picker");d&&d.style.display==="flex"&&(d.style.display="none",y?.setAttribute("aria-expanded","false"),y?.focus())}}))}document.getElementById("btn-attach-media-file")?.addEventListener("click",()=>{ce?.click()}),ce?.addEventListener("change",async()=>{let i=ce.files?.[0];if(i){if(i.type.startsWith("image/")){let l=e.conversations.find(d=>d.id===e.selectedConversationId);dt({imageFile:i,onSend:async d=>{if(!l)return;let y=e.replyingTo?.id||null,g=e.replyingTo?.sender||"",b=e.replyingTo?.body||"",C=e.replyingTo?.media_url||"",W=e.replyingTo?.media_type||"none";e.replyingTo=null;try{let F=await n(`/api/inbox/conversations/${l.id}/messages`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({body:d.caption||"",sender:"agent",media_type:"image",media_url:d.dataUrl,media_filename:d.filename,media_mimetype:"image/jpeg",reply_to_id:y,reply_to_sender:g,reply_to_body:b,reply_to_media_url:C,reply_to_media_type:W})});if(F?.message?.id&&(e.lastSentMessageId=F.message.id),await o(),e.lastSentMessageId){let U=document.querySelector(`.chat-msg-row[data-id="${e.lastSentMessageId}"]`);U&&(U.scrollIntoView({behavior:"smooth",block:"end"}),U.classList.add("chat-msg-highlight-pulse"),setTimeout(()=>{U.classList.remove("chat-msg-highlight-pulse"),e.lastSentMessageId===F?.message?.id&&(e.lastSentMessageId=null)},2600))}}catch(F){E("Error enviando imagen",F.message,"danger")}finally{document.getElementById("chat-composer-input")?.focus()}}}),ce.value="";return}try{let l=await nt(i);e.pendingAttachment={media_type:Lt(i.type),media_url:l,media_filename:i.name,media_mimetype:i.type||"application/octet-stream"},r(),document.getElementById("chat-composer-input")?.focus()}catch(l){E("Error adjuntando archivo",l.message,"danger")}}}),document.getElementById("btn-clear-pending-media")?.addEventListener("click",()=>{e.pendingAttachment=null,r()}),document.getElementById("btn-popover-manage-qr")?.addEventListener("click",()=>{Pe({sub:e,apiFetch:n,refreshInbox:o,onSelect:a})});let re=0,je=()=>{if(!V||!Z||!xe)return;let l=V.value.trim();if(!l.startsWith("/")){Z.style.display="none";return}let d=l.slice(1).trim().toLowerCase(),y=e.quickReplies.filter(g=>g.shortcut.toLowerCase().includes(d)||g.title.toLowerCase().includes(d)||g.body.toLowerCase().includes(d));if(y.length===0){xe.innerHTML=`
        <div style="padding:0.85rem 1rem;font-size:0.8rem;color:var(--text-muted);display:flex;align-items:center;justify-content:space-between;gap:0.5rem;">
          <span>No hay respuestas autom\xE1ticas con "<strong>/${d}</strong>".</span>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-quick-create-qr" style="padding:0.2rem 0.5rem;font-size:0.72rem;">
            ${c("plus",11)}
            <span>Crear nueva</span>
          </button>
        </div>
      `,xe.querySelector("#btn-quick-create-qr")?.addEventListener("click",()=>{Pe({sub:e,apiFetch:n,refreshInbox:o,onSelect:a})}),Z.style.display="flex";return}re=0,xe.innerHTML=y.map((g,b)=>`
        <button type="button" class="slash-command-item ${b===0?"active":""} js-pick-slash-qr" data-qr-id="${g.id}" data-index="${b}">
          <div style="min-width:0;flex:1;">
            <div style="display:flex;align-items:center;gap:0.45rem;">
              <span class="slash-shortcut-code">/${g.shortcut}</span>
              <strong style="font-size:0.82rem;">${g.title}</strong>
              ${g.media_type&&g.media_type!=="none"?`<span class="tag-pill-minimal" style="--tag-color:var(--widget-accent);">
                      ${c(ht(g.media_type),10)}
                      <span>${Ve(g.media_type)}</span>
                    </span>`:""}
            </div>
            <div style="font-size:0.75rem;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:0.15rem;">
              ${g.body}
            </div>
          </div>
          <span style="font-size:0.7rem;color:var(--text-muted);flex:none;">Usar \u21B5</span>
        </button>
      `).join(""),Z.style.display="flex",xe.querySelectorAll(".js-pick-slash-qr").forEach(g=>{g.addEventListener("click",b=>{b.stopPropagation();let C=Number(g.getAttribute("data-qr-id")),W=e.quickReplies.find(F=>F.id===C);W&&a(W)})})};document.getElementById("btn-trigger-slash-menu")?.addEventListener("click",i=>{if(i.stopPropagation(),!!V){if(Z&&Z.style.display==="flex"){Z.style.display="none";return}V.value.trim().startsWith("/")||(V.value="/"),V.focus(),je()}});let oe=()=>{let i=document.getElementById("btn-chat-action"),l=i?.querySelector(".chat-action-icon-send"),d=i?.querySelector(".chat-action-icon-mic"),y=!!V?.value.trim(),g=!!e.pendingAttachment;i&&l&&d&&(y||g?(i.classList.remove("is-mic"),i.classList.add("is-send"),i.title="Enviar mensaje",l.style.display="inline-flex",d.style.display="none"):(i.classList.remove("is-send"),i.classList.add("is-mic"),i.title="Grabar nota de voz",l.style.display="none",d.style.display="inline-flex"))},ve=null,X=[],Ce=!1,Ie=null,De=0,Ne=async()=>{let i=document.getElementById("btn-chat-action");if(i){if(Ce){ve&&ve.state!=="inactive"&&ve.stop();return}if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){E("Audio no soportado","Su navegador no soporta grabaci\xF3n directa de audio.","info");return}try{let l=await navigator.mediaDevices.getUserMedia({audio:!0});ve=new MediaRecorder(l),X=[],De=0,Ce=!0,i.classList.add("is-recording"),i.title="Detener y enviar nota de voz";let d=document.createElement("div");d.id="live-recording-indicator",d.className="live-voice-recording-bar",d.innerHTML=`
        <div style="display:flex;align-items:center;gap:0.6rem;color:#ef4444;font-size:0.85rem;font-weight:600;">
          <span class="recording-pulse-dot"></span>
          <span>Grabando nota de voz... <strong id="recording-timer-text">0:00</strong></span>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-recording" style="padding:0.2rem 0.5rem;font-size:0.75rem;">
          ${c("close",12)}
          <span>Cancelar</span>
        </button>
      `,document.querySelector(".chat-composer-area")?.prepend(d),Ie=window.setInterval(()=>{De++;let g=Math.floor(De/60),b=De%60,C=document.getElementById("recording-timer-text");C&&(C.textContent=`${g}:${b<10?"0":""}${b}`)},1e3),d.querySelector("#btn-cancel-recording")?.addEventListener("click",g=>{g.stopPropagation(),Ae(!0),l.getTracks().forEach(b=>b.stop())}),ve.ondataavailable=g=>{g.data.size>0&&X.push(g.data)},ve.onstop=async()=>{if(l.getTracks().forEach(g=>g.stop()),Ae(!1),X.length>0){let g=new Blob(X,{type:"audio/ogg; codecs=opus"}),b=new FileReader;b.onload=async()=>{let C=String(b.result);e.pendingAttachment={media_type:"audio",media_url:C,media_filename:`nota_voz_${Date.now()}.ogg`,media_mimetype:"audio/ogg"},r()},b.readAsDataURL(g)}},ve.start()}catch{Ce=!1,i.classList.remove("is-recording"),E("Permiso de Micr\xF3fono","Se requiere acceso al micr\xF3fono para grabar notas de voz.","info")}}},Ae=i=>{Ce=!1,Ie!==null&&(window.clearInterval(Ie),Ie=null),document.getElementById("live-recording-indicator")?.remove(),document.getElementById("btn-chat-action")?.classList.remove("is-recording"),i&&(X=[])},te=document.getElementById("composer-link-preview-box"),ke="",qe="",w=null,T=(i,l,d)=>{if(!te)return;let y=i.title||l,g=i.description||"",b=i.image||"",C=i.favicon||`https://www.google.com/s2/favicons?domain=${encodeURIComponent(l)}&sz=128`;te.style.display="block",te.innerHTML=`
      <div class="composer-link-preview-bar">
        ${b?`
          <div class="composer-link-preview-thumb-box">
            <img src="${b}" alt="" class="composer-link-preview-thumb" onerror="this.src='${C}'; this.style.objectFit='contain'; this.style.padding='8px';" />
          </div>
        `:`
          <div class="composer-link-preview-favicon-box">
            <img src="${C}" alt="" class="composer-link-preview-favicon" />
          </div>
        `}
        <div class="composer-link-preview-content">
          <div class="composer-link-preview-header">
            <span class="composer-link-preview-badge">${c("externalLink",11)} ${j(i.domain||l)}</span>
          </div>
          <strong class="composer-link-preview-title">${j(y)}</strong>
          ${g?`<p class="composer-link-preview-desc">${j(g)}</p>`:""}
        </div>
        <button type="button" class="composer-link-preview-close js-dismiss-link-preview" title="Quitar vista previa">
          ${c("close",14)}
        </button>
      </div>
    `,te.querySelector(".js-dismiss-link-preview")?.addEventListener("click",W=>{W.stopPropagation(),qe=d,ke="",te.style.display="none",te.innerHTML="",V?.focus()})},S=()=>{if(!te||!V)return;let i=V.value||"",l=Ht(i);if(l.length===0){ke="",te.style.display="none",te.innerHTML="";return}let d=l[0];if(d===qe){te.style.display="none";return}if(d===ke&&te.innerHTML){te.style.display="block";return}ke=d;let y=d;try{y=new URL(d).hostname.replace(/^www\./,"")}catch{}let g=Je.get(d);if(g){T(g,y,d);return}te.style.display="block",te.innerHTML=`
      <div class="composer-link-preview-bar is-loading">
        <div class="composer-link-preview-spinner-box">
          <div class="wa-media-loading-spinner" style="width:18px;height:18px;border-width:2px;"></div>
        </div>
        <div class="composer-link-preview-content">
          <div class="composer-link-preview-header">
            <span class="composer-link-preview-badge">${c("externalLink",11)} ${j(y)}</span>
          </div>
          <div class="composer-link-preview-loading-text">Obteniendo informaci\xF3n del enlace...</div>
        </div>
        <button type="button" class="composer-link-preview-close js-dismiss-link-preview" title="Quitar vista previa">
          ${c("close",14)}
        </button>
      </div>
    `,te.querySelector(".js-dismiss-link-preview")?.addEventListener("click",b=>{b.stopPropagation(),qe=d,ke="",te.style.display="none",te.innerHTML="",V?.focus()}),fetch(`/api/link-preview?url=${encodeURIComponent(d)}`).then(b=>b.json()).then(b=>{ke===d&&b&&!b.error&&(Je.set(d,b),T(b,y,d))}).catch(()=>{})};V?.addEventListener("input",()=>{je(),oe(),V&&(V.style.height="auto",V.style.height=`${Math.min(V.scrollHeight,120)}px`),clearTimeout(w),w=setTimeout(S,320)}),V?.value.trim()&&S(),document.addEventListener("click",i=>{if(!Z||Z.style.display==="none")return;let l=i.target;!Z.contains(l)&&l.id!=="btn-trigger-slash-menu"&&l!==V&&(Z.style.display="none")}),V?.addEventListener("keydown",i=>{if(Z&&Z.style.display!=="none"){let l=Array.from(xe?.querySelectorAll(".slash-command-item")||[]);if(i.key==="Escape"){Z.style.display="none";return}if(i.key==="ArrowDown"){i.preventDefault(),l.length>0&&(l[re]?.classList.remove("active"),re=(re+1)%l.length,l[re]?.classList.add("active"),l[re]?.scrollIntoView({block:"nearest"}));return}if(i.key==="ArrowUp"){i.preventDefault(),l.length>0&&(l[re]?.classList.remove("active"),re=(re-1+l.length)%l.length,l[re]?.classList.add("active"),l[re]?.scrollIntoView({block:"nearest"}));return}if(i.key==="Tab"||i.key==="Enter"&&!i.shiftKey){i.preventDefault();let d=l[re]||l[0];if(d){let y=Number(d.getAttribute("data-qr-id")),g=e.quickReplies.find(b=>b.id===y);if(g){a(g);return}}}}if(i.key==="Enter"&&!i.shiftKey){if(i.preventDefault(),i.isComposing||i.keyCode===229)return;ue?.requestSubmit()}});let f=async i=>{let l=i.clipboardData?.items;if(!(!l||l.length===0)){for(let d=0;d<l.length;d++){let y=l[d];if(y.type.indexOf("image")!==-1||y.kind==="file"&&y.type.startsWith("image/")){let g=y.getAsFile();if(g){i.preventDefault();try{let b=await nt(g);e.pendingAttachment={media_type:"image",media_url:b,media_filename:g.name||`captura_${Date.now()}.png`,media_mimetype:g.type||"image/png"},r(),document.getElementById("chat-composer-input")?.focus(),E("Imagen pegada (Ctrl + V)","Captura adjuntada lista para enviar.","info")}catch(b){E("Error al procesar imagen pegada",b.message,"danger")}return}}}setTimeout(S,80)}};V?.addEventListener("paste",f),ue?.addEventListener("submit",async i=>{if(i.preventDefault(),!Y)return;if(ke="",qe="",te&&(te.style.display="none",te.innerHTML=""),document.getElementById("btn-chat-action")?.classList.contains("is-mic")&&!e.pendingAttachment&&!V?.value.trim()){Ne();return}let y=V?.value.trim()||"",g=e.pendingAttachment;if(!y&&!g){V?.focus();return}V&&(V.value="",V.style.height="auto",V.focus()),e.pendingAttachment=null,Z&&(Z.style.display="none"),oe();let b=e.replyingTo?.id||null,C=e.replyingTo?.sender||"",W=e.replyingTo?.body||"",F=e.replyingTo?.media_url||"",U=e.replyingTo?.media_type||"none";e.replyingTo=null;try{let Q=`/api/inbox/conversations/${Y.id}/messages`,B={body:y,media_type:g?.media_type||"none",media_url:g?.media_url||"",media_filename:g?.media_filename||"",media_mimetype:g?.media_mimetype||"",reply_to_id:b,reply_to_sender:C,reply_to_body:W,reply_to_media_url:F,reply_to_media_type:U},K=!!(g&&g.media_url.length>7e5),we=K?pn(g?.media_filename||"archivo"):null,$e;try{$e=K?await mn(Q,B,le=>we?.update(le)):await n(Q,{method:"POST",body:JSON.stringify(B)})}finally{we?.done()}if($e?.message?.id&&(e.lastSentMessageId=$e.message.id),await o(),e.lastSentMessageId){let le=document.querySelector(`.chat-msg-row[data-id="${e.lastSentMessageId}"]`);le&&(le.scrollIntoView({behavior:"smooth",block:"end"}),le.classList.add("chat-msg-highlight-pulse"),setTimeout(()=>{le.classList.remove("chat-msg-highlight-pulse"),e.lastSentMessageId===$e?.message?.id&&(e.lastSentMessageId=null)},2600))}}catch(Q){E("Error al enviar mensaje",Q.message,"danger")}finally{document.getElementById("chat-composer-input")?.focus()}}),document.querySelectorAll(".js-reply-msg").forEach(i=>{i.addEventListener("click",l=>{l.stopPropagation();let d=Number(i.getAttribute("data-id")),y=i.getAttribute("data-sender")||"Contacto",g=i.getAttribute("data-body")||"",b=i.getAttribute("data-media-type")||"none",C=i.getAttribute("data-media-url")||"";if(!d)return;e.replyingTo={id:d,sender:y,body:g,media_type:b,media_url:C},r(),document.getElementById("chat-composer-input")?.focus()})}),document.querySelectorAll(".chat-msg-row").forEach(i=>{i.addEventListener("dblclick",l=>{l.stopPropagation();let d=Number(i.getAttribute("data-id")),y=i.getAttribute("data-sender")||"Contacto",g=i.getAttribute("data-body")||"",b=i.getAttribute("data-media-type")||"none",C=i.getAttribute("data-media-url")||"";if(!d)return;e.replyingTo={id:d,sender:y,body:g,media_type:b,media_url:C},r(),document.getElementById("chat-composer-input")?.focus()})}),document.querySelectorAll(".js-jump-to-reply").forEach(i=>{i.addEventListener("click",l=>{l.stopPropagation();let d=i.getAttribute("data-target-id");if(!d)return;let y=document.querySelector(`.chat-msg-row[data-id="${d}"]`);y?(y.scrollIntoView({behavior:"smooth",block:"center"}),y.classList.remove("chat-msg-highlight-pulse"),y.offsetWidth,y.classList.add("chat-msg-highlight-pulse"),setTimeout(()=>{y.classList.remove("chat-msg-highlight-pulse")},2600)):E("Mensaje citado","El mensaje original se encuentra en el historial anterior.","info")})}),document.querySelectorAll(".js-forward-msg").forEach(i=>{i.addEventListener("click",l=>{l.stopPropagation();let d=Number(i.getAttribute("data-id")),y=i.getAttribute("data-sender")||"",g=i.getAttribute("data-body")||"",b=i.getAttribute("data-media-type")||"none",C=i.getAttribute("data-media-url")||"",W=i.getAttribute("data-media-filename")||"";d&&jt({messageId:d,sender:y,body:g,mediaType:b,mediaUrl:C,mediaFilename:W,sub:e,apiFetch:n,refreshInbox:o})})});let H=document.getElementById("chat-messages-scroller");H&&H.addEventListener("contextmenu",i=>{let d=i.target?.closest(".chat-msg-row");if(!d)return;i.preventDefault(),i.stopPropagation(),document.querySelectorAll(".chat-msg-context-menu").forEach(he=>he.remove());let y=Number(d.getAttribute("data-id")),g=d.getAttribute("data-sender")||"",b=d.getAttribute("data-body")||"",C=d.getAttribute("data-media-type")||"none",W=d.getAttribute("data-media-url")||"",F=d.getAttribute("data-media-filename")||"",U=d.getAttribute("data-is-incoming")==="true",Q=d.getAttribute("data-is-deleted")==="true";if(!y||Q)return;let B=document.createElement("div");B.className="chat-msg-context-menu";let K=!U&&!Q&&(C==="none"||!!b);B.innerHTML=`
        <button type="button" class="chat-context-menu-item js-ctx-copy">
          ${c("copy",14)}
          <span>Copiar mensaje</span>
        </button>
        <button type="button" class="chat-context-menu-item js-ctx-reply">
          ${c("cornerUpLeft",14)}
          <span>Responder</span>
        </button>
        <button type="button" class="chat-context-menu-item js-ctx-forward">
          ${c("forward",14)}
          <span>Reenviar</span>
        </button>
        ${K?`
          <button type="button" class="chat-context-menu-item js-ctx-edit">
            ${c("edit",14)}
            <span>Editar mensaje</span>
          </button>
        `:""}
        <div class="chat-context-menu-divider"></div>
        <button type="button" class="chat-context-menu-item danger js-ctx-delete">
          ${c("trash",14)}
          <span>Eliminar mensaje</span>
        </button>
      `,document.body.appendChild(B);let we=195,$e=K?210:170,le=i.clientX,ye=i.clientY;le+we>window.innerWidth&&(le=window.innerWidth-we-12),ye+$e>window.innerHeight&&(ye=window.innerHeight-$e-12),B.style.left=`${Math.max(10,le)}px`,B.style.top=`${Math.max(10,ye)}px`;let be=()=>{B.remove(),document.removeEventListener("click",Se),document.removeEventListener("keydown",Ke)},Se=he=>{B.contains(he.target)||be()},Ke=he=>{he.key==="Escape"&&be()};setTimeout(()=>{document.addEventListener("click",Se),document.addEventListener("keydown",Ke)},10),B.querySelector(".js-ctx-copy")?.addEventListener("click",async()=>{be();let he=b||W;if(he)try{await navigator.clipboard.writeText(he),E("Copiado","Contenido copiado al portapapeles.","info")}catch{E("Error","No se pudo copiar al portapapeles.","danger")}}),B.querySelector(".js-ctx-reply")?.addEventListener("click",()=>{be(),e.replyingTo={id:y,sender:g,body:b,media_type:C,media_url:W},r(),document.getElementById("chat-composer-input")?.focus()}),B.querySelector(".js-ctx-forward")?.addEventListener("click",()=>{be(),jt({messageId:y,sender:g,body:b,mediaType:C,mediaUrl:W,mediaFilename:F,sub:e,apiFetch:n,refreshInbox:o})}),B.querySelector(".js-ctx-edit")?.addEventListener("click",()=>{be(),dn({messageId:y,currentBody:b,sub:e,apiFetch:n,refreshInbox:o})}),B.querySelector(".js-ctx-delete")?.addEventListener("click",async()=>{if(be(),await et({title:"\xBFEliminar este mensaje?",description:"El mensaje se marcar\xE1 como eliminado para todos los participantes.",confirmLabel:"Eliminar Mensaje",cancelLabel:"Cancelar",danger:!0}))try{await n(`/api/inbox/messages/${y}`,{method:"DELETE"}),E("Mensaje eliminado","El mensaje ha sido eliminado correctamente.","info"),await o()}catch(ct){E("Error al eliminar",ct.message||"No se pudo eliminar el mensaje.","danger")}})}),document.querySelector(".js-cancel-reply")?.addEventListener("click",i=>{i.stopPropagation(),e.replyingTo=null,r(),document.getElementById("chat-composer-input")?.focus()});let M=document.getElementById("chat-main-column"),_=document.getElementById("chat-dropzone-overlay");if(M&&_){let i=0;M.addEventListener("dragenter",l=>{l.preventDefault(),l.stopPropagation(),i++,_.style.display="flex"}),M.addEventListener("dragover",l=>{l.preventDefault(),l.stopPropagation()}),M.addEventListener("dragleave",l=>{l.preventDefault(),l.stopPropagation(),i--,i<=0&&(i=0,_.style.display="none")}),M.addEventListener("drop",async l=>{l.preventDefault(),l.stopPropagation(),i=0,_.style.display="none";let d=l.dataTransfer?.files;if(!d||d.length===0)return;let y=d[0];if(y.type.startsWith("image/")){let g=e.conversations.find(b=>b.id===e.selectedConversationId);dt({imageFile:y,onSend:async b=>{if(!g)return;let C=e.replyingTo?.id||null,W=e.replyingTo?.sender||"",F=e.replyingTo?.body||"",U=e.replyingTo?.media_url||"",Q=e.replyingTo?.media_type||"none";e.replyingTo=null;try{let B=await n(`/api/inbox/conversations/${g.id}/messages`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({body:b.caption||"",sender:"agent",media_type:"image",media_url:b.dataUrl,media_filename:b.filename,media_mimetype:"image/jpeg",reply_to_id:C,reply_to_sender:W,reply_to_body:F,reply_to_media_url:U,reply_to_media_type:Q})});if(B?.message?.id&&(e.lastSentMessageId=B.message.id),await o(),e.lastSentMessageId){let K=document.querySelector(`.chat-msg-row[data-id="${e.lastSentMessageId}"]`);K&&(K.scrollIntoView({behavior:"smooth",block:"end"}),K.classList.add("chat-msg-highlight-pulse"),setTimeout(()=>{K.classList.remove("chat-msg-highlight-pulse"),e.lastSentMessageId===B?.message?.id&&(e.lastSentMessageId=null)},2600))}}catch(B){E("Error enviando imagen",B.message,"danger")}finally{document.getElementById("chat-composer-input")?.focus()}}});return}try{let g=await nt(y);e.pendingAttachment={media_type:Lt(y.type),media_url:g,media_filename:y.name,media_mimetype:y.type||"application/octet-stream"},r(),document.getElementById("chat-composer-input")?.focus()}catch(g){E("Error adjuntando archivo",g.message,"danger")}})}document.getElementById("btn-open-broadcast-modal")?.addEventListener("click",se),document.querySelectorAll(".js-open-media-lightbox").forEach(i=>{i.addEventListener("click",l=>{l.preventDefault(),l.stopPropagation();let d=i.getAttribute("data-media-type")||"image",y=i.getAttribute("data-media-url")||"",g=i.getAttribute("data-media-title")||"Archivo adjunto";y&&on({mediaType:d,mediaUrl:y,mediaTitle:g})})});let O=document.getElementById("chat-messages-scroller");O&&sn(O,i=>{e.replyingTo=i,r(),document.getElementById("chat-composer-input")?.focus()}),document.getElementById("btn-request-notif-permission")?.addEventListener("click",async()=>{if(typeof Notification<"u")try{await Notification.requestPermission()==="granted"&&(E("Notificaciones activadas","Recibir\xE1s alertas en tiempo real de nuevos mensajes.","success"),Pt()),r()}catch{}}),document.getElementById("btn-dismiss-notif-banner")?.addEventListener("click",()=>{sessionStorage.setItem("nexus_dismiss_notif_banner","1");let i=document.getElementById("inbox-notification-banner");i&&(i.style.display="none")}),document.querySelectorAll(".js-opt-new-contact").forEach(i=>{i.addEventListener("click",()=>{N&&(N.style.display="none"),A&&(A.style.display="none"),rn({sub:e,apiFetch:n,refreshInbox:o,rerender:r})})}),Zt().catch(()=>{})}function Ft(t){let{sub:e,apiFetch:n,rerender:o}=t,s=e.connections||{};s&&(st(),s.wa_active_mode==="qr"&&(at=window.setInterval(async()=>{if(!document.getElementById("wa-qr-live-panel")){st();return}try{let u=(await n("/api/connections")).connections,m=e.connections?.wa_qr_status,h=e.connections?.wa_qr_session_code;if(m!=="connected"&&u.wa_qr_status==="connected"){e.connections=u,E("\xA1WhatsApp Vinculado en Tiempo Real!",`Su dispositivo ${u.wa_qr_phone} se ha sincronizado exitosamente con el Servidor QR Interno.`,"success"),o();return}if(u.wa_qr_status!==m||u.wa_qr_session_code!==h){e.connections=u;let v=document.getElementById("wa-real-qr-img");v&&u.wa_qr_status==="awaiting_scan"&&u.wa_qr_session_code?.startsWith("data:image/")?v.src=u.wa_qr_session_code:o()}}catch{}},2200)),document.querySelectorAll(".js-select-wa-mode").forEach(r=>{r.addEventListener("click",async()=>{let u=r.getAttribute("data-mode");if(!(!u||s.wa_active_mode===u))try{let m=await n("/api/connections",{method:"PUT",body:JSON.stringify({wa_active_mode:u})});e.connections=m.connections,E(u==="qr"?"Modo Servidor QR Activado":"Modo WhatsApp Cloud API Activado",u==="qr"?"WhatsApp operar\xE1 mediante c\xF3digo QR interno (compatible con WhatsApp Normal y Business).":"WhatsApp operar\xE1 mediante Cloud API oficial con soporte de Mensajes Masivos y Chatbot.","info"),o()}catch(m){E("Error cambiando modalidad",m.message,"danger")}})}),document.getElementById("btn-wa-qr-generate")?.addEventListener("click",async r=>{let u=r.currentTarget;u.disabled=!0;try{let m=document.getElementById("conn-wa-qr-phone")?.value,h=await n("/api/connections/whatsapp-qr/action",{method:"POST",body:JSON.stringify({action:"generate_qr",phone:m})});e.connections=h.connections,E("Nuevo C\xF3digo QR Oficial Generado","Abra WhatsApp o WhatsApp Business -> Dispositivos vinculados -> Vincular un dispositivo y escanee el c\xF3digo.","info"),o()}catch(m){E("Error generando QR",m.message,"danger"),u.disabled=!1}}),document.getElementById("btn-wa-qr-disconnect")?.addEventListener("click",async()=>{if(await et({title:"\xBFDesvincular sesi\xF3n QR de WhatsApp?",description:"El servidor interno dejar\xE1 de recibir mensajes hasta que vuelva a escanear un c\xF3digo QR.",confirmLabel:"S\xED, desvincular QR",danger:!0}))try{let u=await n("/api/connections/whatsapp-qr/action",{method:"POST",body:JSON.stringify({action:"disconnect"})});e.connections=u.connections,E("Sesi\xF3n QR cerrada","El dispositivo fue desvinculado.","warning"),o()}catch(u){E("Error al desconectar",u.message,"danger")}}),document.getElementById("btn-copy-webhook")?.addEventListener("click",r=>{let u=r.currentTarget.getAttribute("data-url")||"";navigator.clipboard?.writeText(u).catch(()=>{}),E("Webhook Copiado",`URL copiada al portapapeles: ${u}`,"info")}),document.querySelector(".js-verify-fb-conn")?.addEventListener("click",async r=>{let u=r.currentTarget;u.disabled=!0;let m=document.getElementById("conn-fb-token")?.value?.trim(),h=document.getElementById("conn-fb-page-id")?.value?.trim(),v=document.getElementById("conn-fb-page-name")?.value?.trim();try{let x=await n("/api/connections/facebook/verify",{method:"POST",body:JSON.stringify({token:m,page_id:h,page_name:v})});e.connections=x.connections,E("Facebook Conectado y Verificado",`P\xE1gina "${x.pageName}" vinculada exitosamente. Se sincronizaron ${x.syncedConversations} chats y ${x.syncedMessages} mensajes.`,"success"),o()}catch(x){E("Error al verificar Facebook",x.message,"danger"),u.disabled=!1}}),document.querySelector(".js-disconnect-fb-conn")?.addEventListener("click",async()=>{try{let r=await n("/api/connections/facebook/disconnect",{method:"POST"});e.connections=r.connections,E("Facebook Desconectado","La Fan Page fue desvinculada de la bandeja.","info"),o()}catch(r){E("Error al desconectar",r.message,"danger")}}),document.querySelector(".js-verify-ig-conn")?.addEventListener("click",async r=>{let u=r.currentTarget;u.disabled=!0;let m=document.getElementById("conn-ig-username")?.value?.trim(),h=document.getElementById("conn-ig-id")?.value?.trim(),v=document.getElementById("conn-ig-token")?.value?.trim();try{let x=await n("/api/connections/instagram/verify",{method:"POST",body:JSON.stringify({username:m,account_id:h,token:v})});e.connections=x.connections,E("Instagram Conectado","Cuenta profesional de Instagram vinculada con \xE9xito.","success"),o()}catch(x){E("Error al verificar Instagram",x.message,"danger"),u.disabled=!1}}),document.querySelector(".js-disconnect-ig-conn")?.addEventListener("click",async()=>{try{let r=await n("/api/connections/instagram/disconnect",{method:"POST"});e.connections=r.connections,E("Instagram Desconectado","La cuenta de Instagram fue desvinculada.","info"),o()}catch(r){E("Error al desconectar",r.message,"danger")}}),document.querySelector(".js-verify-tt-conn")?.addEventListener("click",async r=>{let u=r.currentTarget;u.disabled=!0;let m=document.getElementById("conn-tt-handle")?.value?.trim(),h=document.getElementById("conn-tt-key")?.value?.trim(),v=document.getElementById("conn-tt-token")?.value?.trim();try{let x=await n("/api/connections/tiktok/verify",{method:"POST",body:JSON.stringify({handle:m,client_key:h,token:v})});e.connections=x.connections,E("TikTok Conectado","Perfil comercial de TikTok vinculado con \xE9xito.","success"),o()}catch(x){E("Error al verificar TikTok",x.message,"danger"),u.disabled=!1}}),document.querySelector(".js-disconnect-tt-conn")?.addEventListener("click",async()=>{try{let r=await n("/api/connections/tiktok/disconnect",{method:"POST"});e.connections=r.connections,E("TikTok Desconectado","El perfil comercial de TikTok fue desvinculado.","info"),o()}catch(r){E("Error al desconectar",r.message,"danger")}}),document.getElementById("btn-save-all-connections")?.addEventListener("click",async()=>{let r=h=>document.getElementById(h)?.value?.trim(),u=h=>document.getElementById(h)?.checked,m={wa_qr_phone:r("conn-wa-qr-phone")??s.wa_qr_phone,wa_qr_device:r("conn-wa-qr-device")??s.wa_qr_device,wa_phone_number_id:r("conn-wa-phone-id")??s.wa_phone_number_id,wa_business_account_id:r("conn-wa-waba-id")??s.wa_business_account_id,wa_verify_token:r("conn-wa-verify-token")??s.wa_verify_token,wa_access_token:r("conn-wa-access-token")??s.wa_access_token,wa_mass_messaging_enabled:u("conn-wa-mass-enabled")??s.wa_mass_messaging_enabled,wa_chatbot_enabled:u("conn-wa-chatbot-enabled")??s.wa_chatbot_enabled,wa_chatbot_prompt:document.getElementById("conn-wa-chatbot-prompt")?.value?.trim()??s.wa_chatbot_prompt,fb_page_name:r("conn-fb-page-name")??s.fb_page_name,fb_page_id:r("conn-fb-page-id")??s.fb_page_id,fb_access_token:r("conn-fb-token")??s.fb_access_token,fb_auto_sync:u("conn-fb-sync")??s.fb_auto_sync,ig_username:r("conn-ig-username")??s.ig_username,ig_account_id:r("conn-ig-id")??s.ig_account_id,ig_access_token:r("conn-ig-token")??s.ig_access_token,ig_sync_stories:u("conn-ig-stories")??s.ig_sync_stories,tt_account_handle:r("conn-tt-handle")??s.tt_account_handle,tt_client_key:r("conn-tt-key")??s.tt_client_key,tt_access_token:r("conn-tt-token")??s.tt_access_token,tt_sync_leads:u("conn-tt-leads")??s.tt_sync_leads};try{let h=await n("/api/connections",{method:"PUT",body:JSON.stringify(m)});e.connections=h.connections,E("Conexiones Omnicanal Guardadas","Los par\xE1metros de WhatsApp (QR / API), Facebook, Instagram y TikTok se han actualizado.","success"),o()}catch(h){E("Error guardando conexiones",h.message,"danger")}}))}var ae={connections:null,conversations:[],messages:[],quickReplies:[],tags:[],notes:[],users:[],selectedConversationId:null,channelFilter:"all",tagFilter:"",searchQuery:"",sideDrawerTab:"none",pendingAttachment:null,replyingTo:null,lastSentMessageId:null};function bn(){try{let t=localStorage.getItem("turbonetwork_session");if(t){let e=JSON.parse(t);if(e&&e.token)return String(e.token)}}catch{}return""}async function it(t,e={}){let n=bn(),o=localStorage.getItem("turbonetwork_active_tenant")||"",s={"Content-Type":"application/json",...e.headers||{}};n&&(s.Authorization=`Bearer ${n}`),o&&(s["x-tenant-id"]=o);let r=await fetch(t,{...e,headers:s,credentials:"include"}),u=await r.text(),m={};try{m=u?JSON.parse(u):{}}catch{m={error:u||"Error de respuesta del servidor"}}if(!r.ok)throw new Error(m.error||m.message||`Error HTTP ${r.status}`);return m}async function Ut(){let t=ae.selectedConversationId,e=t?`/api/inbox?active_conv_id=${t}&msg_limit=${ae.messageLimit||250}`:"/api/inbox",n=await it(e);ae.conversations=n.conversations||[],ae.messages=n.messages||[],ae.connections=n.connections||null,ae.quickReplies=n.quickReplies||[],ae.tags=n.tags||[],ae.notes=n.notes||[],ae.users=n.users||[],!ae.selectedConversationId&&ae.conversations.length>0&&window.innerWidth>768&&(ae.selectedConversationId=ae.conversations[0].id)}function hn(){let t=document.getElementById("nav-messages-badge");if(!t)return;let e=ae.conversations.reduce((n,o)=>n+Number(o.unread_count||0),0);e>0?(t.textContent=String(e),t.classList.remove("hidden")):(t.textContent="0",t.classList.add("hidden"))}function Vt(t){t.classList.add("app-shell");let n=window.innerWidth<=768&&ae.selectedConversationId!==null;t.classList.toggle("mobile-in-chat",n),document.body.classList.toggle("mobile-chat-open",n)}var Wt=null;function vt(){let t=document.getElementById("omnichannel-inbox-root");if(!t)return;Vt(t);let e=document.getElementById("chat-messages-scroller"),n=!!e&&Wt===ae.selectedConversationId,o=e?.scrollTop??0,s=e?e.scrollHeight-e.scrollTop-e.clientHeight<120:!0,r=document.querySelector(".inbox-conversations-list")?.scrollTop??0,u=window.systemCurrencyCode||"PEN";t.innerHTML=Rt(ae,u,!0),hn(),Ot({sub:ae,apiFetch:it,refreshInbox:async()=>{await Ut(),vt()},goToConnectionsTab:()=>{let v=window;typeof v.switchTab=="function"&&v.switchTab("settings"),typeof v.switchConfigSubTab=="function"&&v.switchConfigSubTab("connections"),setTimeout(()=>{Gt()},60)},rerender:()=>vt()});let m=document.getElementById("chat-messages-scroller");if(m)if(!n||s){m.scrollTop=m.scrollHeight;let x=Date.now()+4e3,$=!0,k=()=>{$&&Date.now()<x&&(m.scrollTop=m.scrollHeight)};m.addEventListener("load",k,!0),m.addEventListener("loadedmetadata",k,!0);let R=()=>{$=!1};m.addEventListener("wheel",R,{passive:!0,once:!0}),m.addEventListener("touchmove",R,{passive:!0,once:!0})}else m.scrollTop=o;let h=document.querySelector(".inbox-conversations-list");h&&r>0&&(h.scrollTop=r),Wt=ae.selectedConversationId}function Qt(){let t=document.getElementById("omnichannel-connections-root");t&&(t.innerHTML=zt(ae.connections,!0),Ft({sub:ae,apiFetch:it,rerender:()=>Qt()}))}var ft=!1;async function fn(t=!0){let e=document.getElementById("omnichannel-inbox-root");if(e){ft||(e.innerHTML=`
      <div style="display:flex;align-items:center;justify-content:center;height:100%;min-height:320px;color:var(--text-muted,#94a3b8);font-size:13px;gap:10px;">
        <span>Cargando bandeja omnicanal...</span>
      </div>
    `);try{(t||!ft)&&(await Ut(),ft=!0),vt()}catch(n){e.innerHTML=`
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;min-height:320px;padding:24px;text-align:center;">
        <div class="pro-card" style="max-width:420px;width:100%;padding:24px;border-radius:16px;display:flex;flex-direction:column;align-items:center;gap:12px;">
          <p style="color:#ef4444;font-weight:600;font-size:15px;margin:0;">No se pudo cargar la bandeja de mensajes</p>
          <p style="color:var(--text-muted,#cbd5e1);font-size:12px;margin:0;line-height:1.5;">${n.message}</p>
          <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:4px;">
            <button type="button" class="btn btn-primary" onclick="window.TurboOmnichannel?.mountInbox(true)">Reintentar</button>
            <button type="button" class="btn btn-secondary" onclick="window.location.reload()">Recargar</button>
            <button type="button" class="btn btn-secondary" onclick="window.switchTab?.('dashboard')">Ir al Dashboard</button>
          </div>
        </div>
      </div>
    `}}}async function Gt(t=!0){let e=document.getElementById("omnichannel-connections-root");if(e)try{if(t||!ae.connections){let n=await it("/api/connections");ae.connections=n.connections}Qt()}catch(n){e.innerHTML=`
      <div class="pro-card" style="padding:18px;border-radius:14px;border:1px solid rgba(239,68,68,0.35);display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;">
        <div style="color:#ef4444;font-size:13px;">Error cargando conexiones omnicanal: ${n.message}</div>
        <button type="button" class="btn btn-primary btn-sm" onclick="window.TurboOmnichannel?.mountConnections(true)">Reintentar</button>
      </div>
    `}}window.addEventListener("resize",()=>{let t=document.getElementById("omnichannel-inbox-root");t&&!document.getElementById("tab-messages")?.classList.contains("hidden")?Vt(t):document.body.classList.remove("mobile-chat-open")});window.TurboOmnichannel={mountInbox:fn,mountConnections:Gt,getState:()=>ae};})();
