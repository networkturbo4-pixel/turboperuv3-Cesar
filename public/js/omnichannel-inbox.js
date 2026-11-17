"use strict";(()=>{function $(t,e,n="info"){let s=n==="danger"?"error":n==="warning"?"warning":n==="success"?"success":"info",r=window;if(typeof r.showToast=="function"){r.showToast(`${t}: ${e}`,s);return}console.log(`[Toast ${s}] ${t}: ${e}`)}function ot(t){return new Promise(e=>{let n=document.getElementById("omnichannel-confirm-dialog");n&&n.remove();let s=document.createElement("dialog");s.id="omnichannel-confirm-dialog",s.className="crm-modal-surface",s.setAttribute("data-style","modern-clean"),s.style.cssText="padding:0;border:none;border-radius:18px;max-width:420px;width:92%;box-shadow:0 24px 60px rgba(0,0,0,0.45);background:var(--widget-bg,#ffffff);color:var(--text-primary,#0f172a);";let r=t.variant==="danger"?"#ef4444":t.variant==="warning"?"#f59e0b":"#4f46e5";s.innerHTML=`
      <div style="padding:20px 22px;">
        <h3 style="margin:0 0 8px 0;font-size:16px;font-weight:700;">${t.title}</h3>
        <p style="margin:0 0 18px 0;font-size:13px;line-height:1.5;opacity:0.85;">${t.message}</p>
        <div style="display:flex;justify-content:flex-end;gap:10px;">
          <button type="button" id="omni-confirm-cancel" style="padding:8px 14px;border-radius:10px;border:1px solid rgba(148,163,184,0.35);background:transparent;color:inherit;font-size:12.5px;font-weight:600;cursor:pointer;">
            ${t.cancelText||"Cancelar"}
          </button>
          <button type="button" id="omni-confirm-ok" style="padding:8px 16px;border-radius:10px;border:none;background:${r};color:#fff;font-size:12.5px;font-weight:600;cursor:pointer;">
            ${t.confirmText||"Confirmar"}
          </button>
        </div>
      </div>
    `,document.body.appendChild(s);let i=m=>{try{s.close()}catch{}s.remove(),e(m)};s.querySelector("#omni-confirm-cancel")?.addEventListener("click",()=>i(!1)),s.querySelector("#omni-confirm-ok")?.addEventListener("click",()=>i(!0)),s.addEventListener("cancel",m=>{m.preventDefault(),i(!1)}),typeof s.showModal=="function"?s.showModal():i(window.confirm(`${t.title}

${t.message}`))})}var Mt={sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',moon:'<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',building:'<rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>',palette:'<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',save:'<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',smartphone:'<rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>',externalLink:'<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',type:'<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>',bell:'<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',zap:'<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',sliders:'<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',table:'<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="9" x2="9" y2="21"/><line x1="15" y1="9" x2="15" y2="21"/>',eye:'<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',eyeOff:'<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>',plus:'<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',edit:'<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',trash:'<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',users:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',lock:'<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',sparkles:'<path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z"/>',logOut:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',menu:'<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>',close:'<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',chevronUp:'<polyline points="18 15 12 9 6 15"/>',chevronDown:'<polyline points="6 9 12 15 18 9"/>',checkCircle:'<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',info:'<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',alertTriangle:'<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',xCircle:'<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',layout:'<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>',check:'<polyline points="20 6 9 17 4 12"/>',messageSquare:'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',link:'<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',whatsapp:'<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/><path d="M9.5 9.5c.3 1.8 1.7 3.2 3.5 3.5l1.2-1.2c.2-.2.5-.2.7-.1.7.3 1.4.5 2.1.6.3 0 .5.3.5.6v2c0 .3-.2.6-.6.6C10.9 15.5 8.5 13.1 8.5 7.1c0-.4.3-.6.6-.6h2c.3 0 .6.2.6.5.1.7.3 1.4.6 2.1.1.2.1.5-.1.7L9.5 9.5z"/>',facebook:'<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>',instagram:'<rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>',tiktok:'<path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/>',qrCode:'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M7 7h.01M17 7h.01M7 17h.01"/>',bot:'<rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4M8 16h.01M16 16h.01"/>',megaphone:'<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',send:'<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',refresh:'<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',copy:'<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',tag:'<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',stickyNote:'<path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z"/><path d="M15 3v6h6"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>',image:'<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',video:'<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>',music:'<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',fileText:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',paperclip:'<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',slash:'<line x1="16" y1="3" x2="8" y2="21"/>',arrowLeft:'<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',arrowRight:'<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',play:'<polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/>',pause:'<rect x="6" y="4" width="4" height="16" fill="currentColor"/><rect x="14" y="4" width="4" height="16" fill="currentColor"/>',square:'<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>',circle:'<circle cx="12" cy="12" r="10"/>',clock:'<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',mapPin:'<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',smile:'<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>',undo:'<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',rotateCw:'<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',mic:'<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>',cornerUpLeft:'<polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>',cornerUpRight:'<polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/>',forward:'<polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/>',uploadCloud:'<polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>',chevronRight:'<polyline points="9 18 15 12 9 6"/>',volume2:'<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>',volumeX:'<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>',maximize:'<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>',minus:'<line x1="5" y1="12" x2="19" y2="12"/>',search:'<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'};function l(t,e=16,n=""){let s=Mt[t]||Mt.info;return`<svg class="crm-svg-icon ${n}" width="${e}" height="${e}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${s}</svg>`}var Lt={all:"ri-message-3-fill",whatsapp:"ri-whatsapp-fill",facebook:"ri-facebook-circle-fill",instagram:"ri-instagram-fill",tiktok:"ri-tiktok-fill"};function _t(t,e=18,n=""){return`<i class="${Lt[t]||Lt.all} crm-brand-filled-icon ${n}" style="font-size:${e}px;line-height:1;display:inline-flex;align-items:center;justify-content:center;" aria-hidden="true"></i>`}function en(t,e){if(!e.points||e.points.length===0)return;if(t.save(),t.shadowColor="transparent",t.shadowBlur=0,t.shadowOffsetX=0,t.shadowOffsetY=0,t.globalAlpha=1,t.globalCompositeOperation="source-over",t.strokeStyle=e.color,t.lineWidth=e.width,t.lineCap="round",t.lineJoin="round",t.fillStyle="transparent",e.points.length===1){t.beginPath(),t.arc(e.points[0].x,e.points[0].y,Math.max(.5,e.width/2),0,Math.PI*2),t.fillStyle=e.color,t.fill(),t.restore();return}if(t.beginPath(),e.points.length===2){t.moveTo(e.points[0].x,e.points[0].y),t.lineTo(e.points[1].x,e.points[1].y),t.stroke(),t.restore();return}t.moveTo(e.points[0].x,e.points[0].y);for(let r=1;r<e.points.length-1;r++){let i=e.points[r],m=e.points[r+1],u=(i.x+m.x)/2,h=(i.y+m.y)/2;t.quadraticCurveTo(i.x,i.y,u,h)}let n=e.points[e.points.length-1],s=e.points[e.points.length-2];t.quadraticCurveTo(s.x,s.y,n.x,n.y),t.stroke(),t.restore()}function st(t,e,n,s,r,i){if(typeof t.roundRect=="function"){t.roundRect(e,n,s,r,Math.min(i,Math.min(Math.abs(s),Math.abs(r))/2));return}let m=Math.min(Math.abs(s),Math.abs(r)),u=Math.min(i,m/2);t.beginPath(),t.moveTo(e+u,n),t.lineTo(e+s-u,n),t.quadraticCurveTo(e+s,n,e+s,n+u),t.lineTo(e+s,n+r-u),t.quadraticCurveTo(e+s,n+r,e+s-u,n+r),t.lineTo(e+u,n+r),t.quadraticCurveTo(e,n+r,e,n+r-u),t.lineTo(e,n+u),t.quadraticCurveTo(e,n,e+u,n),t.closePath()}function mt(t){let{imageFile:e,onSend:n,onCancel:s}=t,r=document.createElement("div");r.className="wa-photo-editor-overlay",document.body.appendChild(r);let i=new FileReader;i.onload=()=>{let u=new Image;u.onload=()=>{m(u)},u.src=String(i.result)},i.readAsDataURL(e);function m(u){let h=0,f="#10b981",w=7,T="none",S=[],P=[],N=[],a=null,_=!1,L=!1,G=null,R=0,j=0,k=0,E=0,D=0,Y=0,B=36,re=0,J=null,ce=0,te=0,ue=0,xe=0;r.innerHTML=`
      <div class="wa-photo-editor-container">
        <!-- Barra Superior WhatsApp Tools (Dise\xF1o Responsivo en 2 filas compactas) -->
        <header class="wa-editor-topbar">
          <div class="wa-editor-topbar-row1">
            <div class="wa-editor-actions-left">
              <button type="button" class="wa-editor-btn" id="wa-btn-cancel" title="Cancelar">
                ${l("close",18)}
              </button>
              <button type="button" class="wa-editor-btn" id="wa-btn-rotate" title="Girar 90\xB0">
                ${l("rotateCw",16)}
              </button>
              <button type="button" class="wa-editor-btn" id="wa-btn-undo" title="Deshacer acci\xF3n">
                ${l("undo",16)}
              </button>
              <button type="button" class="wa-editor-btn" id="wa-btn-delete-selected" title="Eliminar elemento seleccionado" style="color:#ef4444;display:none;">
                ${l("trash",16)}
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
                ${["#10b981","#3b82f6","#ef4444","#f59e0b","#8b5cf6","#ffffff","#000000"].map((x,M)=>`
                    <button type="button" class="wa-color-swatch ${M===0?"active":""}" style="background-color:${x};" data-color="${x}"></button>
                  `).join("")}
              </div>
            </div>
          </div>

          <!-- Selector de Herramientas Desplazable Horizontalmente para M\xF3vil y PC -->
          <div class="wa-editor-tools-scroller">
            <button type="button" class="wa-tool-pill" data-tool="pencil" title="Dibujar trazo libre">
              ${l("edit",16)}
              <span class="wa-tool-name">L\xE1piz</span>
            </button>
            <button type="button" class="wa-tool-pill" data-tool="arrow" title="Insertar Flecha">
              ${l("arrowRight",16)}
              <span class="wa-tool-name">Flecha</span>
            </button>
            <button type="button" class="wa-tool-pill" data-tool="rect" title="Insertar Rect\xE1ngulo / Cuadrado">
              ${l("square",16)}
              <span class="wa-tool-name">Cuadrado</span>
            </button>
            <button type="button" class="wa-tool-pill" data-tool="circle" title="Insertar C\xEDrculo">
              ${l("circle",16)}
              <span class="wa-tool-name">C\xEDrculo</span>
            </button>
            <button type="button" class="wa-tool-pill" data-tool="text" title="Escribir Texto">
              ${l("type",16)}
              <span class="wa-tool-name">Texto</span>
            </button>
            <button type="button" class="wa-tool-pill" data-tool="emoji" title="Stickers y Emoticones">
              ${l("smile",16)}
              <span class="wa-tool-name">Sticker</span>
            </button>
            <button type="button" class="wa-tool-pill" id="wa-tool-location" title="A\xF1adir Sticker de Ubicaci\xF3n">
              ${l("mapPin",16)}
              <span class="wa-tool-name">Ubicaci\xF3n</span>
            </button>
            <button type="button" class="wa-tool-pill" id="wa-tool-clock" title="A\xF1adir Sticker de Hora / Reloj">
              ${l("clock",16)}
              <span class="wa-tool-name">Reloj</span>
            </button>
          </div>
        </header>

        <!-- Submen\xFA Popover de Emojis / Stickers -->
        <div class="wa-stickers-popover" id="wa-stickers-popover" style="display:none;">
          <div class="wa-stickers-grid">
            ${["\u{1F525}","\u2B50","\u2764\uFE0F","\u2705","\u{1F4CD}","\u{1F552}","\u{1F3AF}","\u{1F680}","\u{1F4AF}","\u{1F44D}","\u{1F4BC}","\u{1F4E6}","\u26A0\uFE0F","\u{1F4A1}","\u{1F389}","\u{1F44F}","\u{1F91D}","\u26A1","\u{1F31F}","\u{1F4CC}"].map(x=>`
                <button type="button" class="wa-emoji-item" data-emoji="${x}">${x}</button>
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
              ${l("smile",18)}
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
            ${l("send",19)}
          </button>
        </footer>
      </div>
    `;let O=r.querySelector("#wa-photo-canvas"),p=O.getContext("2d"),me=r.querySelector("#wa-editor-viewport"),he=r.querySelector("#wa-stickers-popover"),K=r.querySelector("#wa-caption-input"),ne=r.querySelector("#wa-btn-delete-selected"),Ze=r.querySelector("#wa-input-modal"),pt=r.querySelector("#wa-input-modal-title"),Te=r.querySelector("#wa-input-modal-text"),et=r.querySelector("#wa-input-modal-cancel"),Me=r.querySelector("#wa-input-modal-confirm"),Ne=null;function Qe(x,M){return new Promise(I=>{pt.textContent=x,Te.value=M,Ze.style.display="flex",Te.focus(),Te.select(),Ne=I})}let de=x=>{Ze.style.display="none",Ne&&(Ne(x),Ne=null)};et.addEventListener("click",()=>de(null)),Me.addEventListener("click",()=>de(Te.value.trim()||null)),Te.addEventListener("keydown",x=>{x.key==="Enter"?(x.preventDefault(),de(Te.value.trim()||null)):x.key==="Escape"&&de(null)});function pe(){N.push({objects:JSON.parse(JSON.stringify(S)),strokes:JSON.parse(JSON.stringify(P))}),N.length>25&&N.shift()}function De(){let x=h===90||h===270,M=x?u.naturalHeight:u.naturalWidth,I=x?u.naturalWidth:u.naturalHeight,v=Math.min(me.clientWidth-20,960),F=Math.min(me.clientHeight-20,680),A=Math.min(v/M,F/I,1);O.width=M,O.height=I,O.style.width=`${Math.round(M*A)}px`,O.style.height=`${Math.round(I*A)}px`,Z()}function Z(){p.clearRect(0,0,O.width,O.height),p.save(),p.translate(O.width/2,O.height/2),p.rotate(h*Math.PI/180);let x=h===90||h===270,M=x?O.height:O.width,I=x?O.width:O.height;p.drawImage(u,-M/2,-I/2,M,I),p.restore();for(let v of P)en(p,v);for(let v of S){p.save(),p.translate(v.x+v.width/2,v.y+v.height/2),p.rotate(v.rotation);let F=v.width/2,A=v.height/2;if(v.type==="rect")p.lineWidth=v.strokeWidth||6,p.strokeStyle=v.color,p.strokeRect(-F,-A,v.width,v.height);else if(v.type==="circle")p.beginPath(),p.lineWidth=v.strokeWidth||6,p.strokeStyle=v.color,p.ellipse(0,0,Math.abs(F),Math.abs(A),0,0,Math.PI*2),p.stroke();else if(v.type==="arrow"){let C=v.strokeWidth||7;p.beginPath(),p.lineWidth=C,p.strokeStyle=v.color,p.fillStyle=v.color,p.moveTo(-F,0),p.lineTo(F-C*2.5,0),p.stroke(),p.beginPath(),p.moveTo(F,0),p.lineTo(F-C*3.5,-C*2),p.lineTo(F-C*3.5,C*2),p.closePath(),p.fill()}else if(v.type==="text")p.font=`bold ${v.fontSize||36}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`,p.fillStyle=v.color,p.textAlign="center",p.textBaseline="middle",p.shadowColor="rgba(0,0,0,0.85)",p.shadowBlur=Math.round((v.fontSize||36)*.2),p.fillText(v.text||"",0,0);else if(v.type==="emoji")p.font=`${v.fontSize||64}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`,p.textAlign="center",p.textBaseline="middle",p.fillText(v.text||"\u2B50",0,0);else if(v.type==="location"){let C=v.width,V=v.height,le=V/2,o=V/50;p.save(),p.shadowColor="rgba(0, 0, 0, 0.28)",p.shadowBlur=Math.round(14*o),p.shadowOffsetX=0,p.shadowOffsetY=Math.round(4*o);let c=v.cardStyle==="dark";c?p.fillStyle="rgba(15, 23, 42, 0.9)":p.fillStyle="#ffffff",st(p,-F,-A,C,V,le),p.fill(),p.restore(),p.strokeStyle=c?"rgba(255, 255, 255, 0.22)":"rgba(0, 0, 0, 0.08)",p.lineWidth=c?1.5:1,st(p,-F,-A,C,V,le),p.stroke();let d=o,y=-F+20*d+6*d,g=-2*d;p.save(),p.translate(y,g),p.scale(d,d),p.beginPath(),p.ellipse(0,11,4.5,2,0,0,Math.PI*2),p.fillStyle="rgba(0, 0, 0, 0.22)",p.fill(),p.beginPath(),p.arc(0,-3,7.8,Math.PI*.8,Math.PI*.2,!0),p.lineTo(0,9.5),p.closePath(),p.fillStyle=v.color&&v.color!=="#ffffff"&&v.color!=="#000000"?v.color:"#ef4444",p.fill(),p.beginPath(),p.arc(0,-3,3,0,Math.PI*2),p.fillStyle="#ffffff",p.fill(),p.restore();let b=y+17*d;p.font=`bold ${v.fontSize||Math.round(20*d)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`,p.textAlign="left",p.textBaseline="middle",p.fillStyle=c?"#ffffff":"#0f172a",p.fillText(v.text||"Lima, Per\xFA",b,0)}else if(v.type==="clock"){let C=v.width,V=v.height,le=V/2,o=V/50;p.save(),p.shadowColor="rgba(0, 0, 0, 0.32)",p.shadowBlur=Math.round(14*o),p.shadowOffsetX=0,p.shadowOffsetY=Math.round(4*o);let c=v.cardStyle!=="white";c?p.fillStyle="rgba(15, 23, 42, 0.9)":p.fillStyle="#ffffff",st(p,-F,-A,C,V,le),p.fill(),p.restore(),p.strokeStyle=c?"rgba(255, 255, 255, 0.22)":"rgba(0, 0, 0, 0.08)",p.lineWidth=c?1.5:1,st(p,-F,-A,C,V,le),p.stroke();let d=-F+20*o+6*o,y=0,g=9.8*o;p.beginPath(),p.arc(d,y,g,0,Math.PI*2),p.fillStyle=c?"rgba(56, 189, 248, 0.25)":"rgba(37, 99, 235, 0.12)",p.fill(),p.strokeStyle=v.color&&v.color!=="#ffffff"&&v.color!=="#000000"?v.color:c?"#38bdf8":"#2563eb",p.lineWidth=2*o,p.stroke(),p.beginPath(),p.arc(d,y,1.8*o,0,Math.PI*2),p.fillStyle=c?"#38bdf8":"#2563eb",p.fill();let b=(v.text||"12:00").split(":"),z=parseInt(b[0],10)||12,Q=parseInt(b[1],10)||0,U=(z%12+Q/60)*(Math.PI/6)-Math.PI/2,ee=Q*(Math.PI/30)-Math.PI/2;p.beginPath(),p.moveTo(d,y),p.lineTo(d+Math.cos(U)*(g*.54),y+Math.sin(U)*(g*.54)),p.strokeStyle=c?"#ffffff":"#0f172a",p.lineWidth=2.2*o,p.lineCap="round",p.stroke(),p.beginPath(),p.moveTo(d,y),p.lineTo(d+Math.cos(ee)*(g*.78),y+Math.sin(ee)*(g*.78)),p.strokeStyle=c?"#38bdf8":"#2563eb",p.lineWidth=1.6*o,p.lineCap="round",p.stroke();let X=d+17*o;p.font=`bold ${v.fontSize||Math.round(24*o)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace`,p.textAlign="left",p.textBaseline="middle",p.fillStyle=c?"#ffffff":"#0f172a",p.fillText(v.text||"12:00",X,0)}if(a===v.id){let C=Le(),V=10*C,le=Math.max(8*C,8),o=26*C;p.strokeStyle="#ffffff",p.lineWidth=Math.max(2*C,2),p.setLineDash([6*C,6*C]),p.strokeRect(-F-V,-A-V,v.width+V*2,v.height+V*2),p.setLineDash([]);let c=[{x:-F-V,y:-A-V},{x:F+V,y:-A-V},{x:-F-V,y:A+V},{x:F+V,y:A+V}];for(let d of c)p.beginPath(),p.arc(d.x,d.y,le,0,Math.PI*2),p.fillStyle="#10b981",p.fill(),p.strokeStyle="#ffffff",p.lineWidth=Math.max(2*C,2),p.stroke();p.beginPath(),p.moveTo(0,-A-V),p.lineTo(0,-A-V-o),p.strokeStyle="#3b82f6",p.lineWidth=Math.max(2*C,2),p.stroke(),p.beginPath(),p.arc(0,-A-V-o,le,0,Math.PI*2),p.fillStyle="#3b82f6",p.fill(),p.strokeStyle="#ffffff",p.lineWidth=Math.max(2*C,2),p.stroke()}p.restore()}ne&&(ne.style.display=a?"inline-flex":"none")}function Le(){let x=O.getBoundingClientRect();return x.width?O.width/x.width:1}function Ae(x){let M=O.getBoundingClientRect(),I="touches"in x&&x.touches.length>0?x.touches[0].clientX:x.clientX,v="touches"in x&&x.touches.length>0?x.touches[0].clientY:x.clientY,F=O.width/M.width,A=O.height/M.height;return{x:(I-M.left)*F,y:(v-M.top)*A}}function Oe(x,M){let I=Le(),v=Math.max(30*I,30),F=26*I;for(let A=S.length-1;A>=0;A--){let C=S[A],V=C.x+C.width/2,le=C.y+C.height/2,o=x-V,c=M-le,d=Math.cos(-C.rotation),y=Math.sin(-C.rotation),g=o*d-c*y,b=o*y+c*d,z=C.width/2,Q=C.height/2,U=10*I;if(a===C.id){if(Math.hypot(g,b-(-Q-U-F))<=v)return{hitObject:C,handle:"rotate"};let ee=[{x:-z-U,y:-Q-U},{x:z+U,y:-Q-U},{x:-z-U,y:Q+U},{x:z+U,y:Q+U}];for(let X of ee)if(Math.hypot(g-X.x,b-X.y)<=v)return{hitObject:C,handle:"scale"}}if(Math.abs(g)<=z+U+15*I&&Math.abs(b)<=Q+U+15*I)return{hitObject:C,handle:null}}return{hitObject:null,handle:null}}let Se=x=>{let{x:M,y:I}=Ae(x);if(ce=M,te=I,ue=M,xe=I,T==="pencil"){pe();let A=Math.max(1,Math.sqrt(Math.max(O.width,O.height)/720));J={color:f,width:Math.round(w*A),points:[{x:M,y:I}]},P.push(J),Z(),x.cancelable&&x.preventDefault();return}let{hitObject:v,handle:F}=Oe(M,I);v?(a=v.id,R=M,j=I,k=v.x,E=v.y,D=v.width,Y=v.height,B=v.fontSize||36,re=v.rotation||0,F==="scale"||F==="rotate"?(L=!0,G=F):_=!0,Z(),x.cancelable&&x.preventDefault()):(a=null,Z())},Fe=x=>{let{x:M,y:I}=Ae(x);if(ue=M,xe=I,T==="pencil"&&J){let v=J.points[J.points.length-1];(!v||Math.hypot(M-v.x,I-v.y)>=2)&&(J.points.push({x:M,y:I}),Z()),x.cancelable&&x.preventDefault();return}if(_&&a){let v=S.find(F=>F.id===a);v&&(v.x=k+(M-R),v.y=E+(I-j),Z()),x.cancelable&&x.preventDefault();return}if(L&&a&&G){let v=S.find(F=>F.id===a);if(v){let F=k+D/2,A=E+Y/2;if(G==="scale"){let C=Math.hypot(M-F,I-A),V=Math.max(20,Math.hypot(R-F,j-A)),le=C/V,o=Math.max(28,Math.round(D*le)),c=Math.max(28,Math.round(Y*le));v.x=F-o/2,v.y=A-c/2,v.width=o,v.height=c,B&&(v.fontSize=Math.max(14,Math.round(B*le)))}else if(G==="rotate"){let C=Math.atan2(I-A,M-F),V=Math.atan2(j-A,R-F);v.rotation=re+(C-V)}Z()}x.cancelable&&x.preventDefault()}},qe=()=>{let x=Math.hypot(ce-ue,te-xe);if(a&&!L&&!J&&x<8){let M=S.find(I=>I.id===a);M&&(M.type==="location"||M.type==="clock")&&(pe(),M.cardStyle=M.cardStyle==="white"?"dark":"white",Z())}T==="pencil"&&J&&(J=null),(_||L)&&pe(),_=!1,L=!1,G=null};O.addEventListener("mousedown",Se),window.addEventListener("mousemove",Fe),window.addEventListener("mouseup",qe),O.addEventListener("touchstart",Se,{passive:!1}),window.addEventListener("touchmove",Fe,{passive:!1}),window.addEventListener("touchend",qe,{passive:!1}),r.querySelectorAll(".wa-color-swatch").forEach(x=>{x.addEventListener("click",()=>{if(r.querySelectorAll(".wa-color-swatch").forEach(M=>M.classList.remove("active")),x.classList.add("active"),f=x.getAttribute("data-color")||"#10b981",a){let M=S.find(I=>I.id===a);M&&(pe(),M.color=f,Z())}})}),r.querySelectorAll(".wa-stroke-btn").forEach(x=>{x.addEventListener("click",()=>{if(r.querySelectorAll(".wa-stroke-btn").forEach(M=>M.classList.remove("active")),x.classList.add("active"),w=Number(x.getAttribute("data-width"))||7,a){let M=S.find(I=>I.id===a);if(M){pe();let I=Math.max(1,Math.sqrt(Math.max(O.width,O.height)/720));M.strokeWidth=Math.round(w*I),Z()}}})}),ne.addEventListener("click",()=>{if(a){pe();let x=S.findIndex(M=>M.id===a);x!==-1&&S.splice(x,1),a=null,Z()}}),window.addEventListener("keydown",x=>{if((x.key==="Delete"||x.key==="Backspace")&&a){let M=document.activeElement;if(M===K||M===Te)return;pe();let I=S.findIndex(v=>v.id===a);I!==-1&&S.splice(I,1),a=null,Z()}}),r.querySelectorAll(".wa-tool-pill[data-tool]").forEach(x=>{x.addEventListener("click",async()=>{let M=x.getAttribute("data-tool");if(M==="emoji"){he.style.display=he.style.display==="none"?"block":"none";return}if(he.style.display="none",M==="pencil"){T=T==="pencil"?"none":"pencil",r.querySelectorAll(".wa-tool-pill").forEach(A=>A.classList.remove("active")),T==="pencil"&&x.classList.add("active");return}T="none",r.querySelectorAll(".wa-tool-pill").forEach(A=>A.classList.remove("active"));let I=Math.max(1,Math.max(O.width,O.height)/750),v=O.width/2,F=O.height/2;if(M==="arrow"){pe();let A=Math.round(180*I),C=Math.round(50*I),V={id:`arrow_${Date.now()}`,type:"arrow",x:v-A/2,y:F-C/2,width:A,height:C,rotation:0,color:f,strokeWidth:Math.round(w*I)};S.push(V),a=V.id,Z()}else if(M==="rect"){pe();let A=Math.round(180*I),C={id:`rect_${Date.now()}`,type:"rect",x:v-A/2,y:F-A/2,width:A,height:A,rotation:0,color:f,strokeWidth:Math.round(w*I)};S.push(C),a=C.id,Z()}else if(M==="circle"){pe();let A=Math.round(180*I),C={id:`circle_${Date.now()}`,type:"circle",x:v-A/2,y:F-A/2,width:A,height:A,rotation:0,color:f,strokeWidth:Math.round(w*I)};S.push(C),a=C.id,Z()}else if(M==="text"){let A=await Qe("Escriba el texto para la foto:","Texto corporativo");if(A){pe();let C=Math.round(38*I),V=Math.round(Math.max(200,A.length*24)*I),le=Math.round(60*I),o={id:`text_${Date.now()}`,type:"text",text:A,x:v-V/2,y:F-le/2,width:V,height:le,rotation:0,color:f,fontSize:C};S.push(o),a=o.id,Z()}}})}),r.querySelectorAll(".wa-emoji-item").forEach(x=>{x.addEventListener("click",()=>{let M=x.getAttribute("data-emoji")||"\u2B50";he.style.display="none",pe();let I=Math.max(1,Math.max(O.width,O.height)/750),v=Math.round(100*I),F={id:`emoji_${Date.now()}`,type:"emoji",text:M,x:O.width/2-v/2,y:O.height/2-v/2,width:v,height:v,rotation:0,color:f,fontSize:Math.round(64*I)};S.push(F),a=F.id,Z()})}),r.querySelector("#wa-tool-location")?.addEventListener("click",async()=>{let x=await Qe("Nombre de la ubicaci\xF3n para la foto:","Lima, Per\xFA")||"Ubicaci\xF3n Actual";pe();let M=Math.max(1,Math.sqrt(Math.max(O.width,O.height)/720)),I=Math.round(18*M);p.font=`bold ${I}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;let v=p.measureText(x),F=Math.round(v.width+68*M),A=Math.round(48*M),C={id:`loc_${Date.now()}`,type:"location",text:x,x:O.width/2-F/2,y:O.height/2-A/2,width:F,height:A,rotation:0,color:f==="#ffffff"?"#ef4444":f,fontSize:I,cardStyle:"white"};S.push(C),a=C.id,Z()}),r.querySelector("#wa-tool-clock")?.addEventListener("click",()=>{let x=new Date,M=`${String(x.getHours()).padStart(2,"0")}:${String(x.getMinutes()).padStart(2,"0")}`;pe();let I=Math.max(1,Math.sqrt(Math.max(O.width,O.height)/720)),v=Math.round(22*I);p.font=`bold ${v}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace`;let F=p.measureText(M),A=Math.round(F.width+68*I),C=Math.round(48*I),V={id:`clock_${Date.now()}`,type:"clock",text:M,x:O.width/2-A/2,y:O.height/2-C/2,width:A,height:C,rotation:0,color:f==="#ffffff"?"#38bdf8":f,fontSize:v,cardStyle:"dark"};S.push(V),a=V.id,Z()}),r.querySelector("#wa-btn-rotate")?.addEventListener("click",()=>{h=(h+90)%360,De()}),r.querySelector("#wa-btn-undo")?.addEventListener("click",()=>{if(N.length>0){let x=N.pop();S.length=0,S.push(...x.objects),P.length=0,P.push(...x.strokes),a=null,Z()}}),r.querySelector("#wa-btn-cancel")?.addEventListener("click",()=>{Ee(),s&&s()});let ie=()=>{a=null,Z();let x=O.toDataURL("image/jpeg",.9),M=K.value.trim(),I=e.name.replace(/\.[^/.]+$/,"")+"-editada.jpg";Ee(),n({dataUrl:x,filename:I,caption:M})};r.querySelector("#wa-btn-send")?.addEventListener("click",ie),K.addEventListener("keydown",x=>{x.key==="Enter"&&(x.preventDefault(),ie())});function Ee(){O.removeEventListener("mousedown",Se),window.removeEventListener("mousemove",Fe),window.removeEventListener("mouseup",qe),O.removeEventListener("touchstart",Se),window.removeEventListener("touchmove",Fe),window.removeEventListener("touchend",qe),r.remove()}De(),window.addEventListener("resize",De,{once:!0}),K.focus()}}function oe(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}var tn=[{id:1,label:"Lun"},{id:2,label:"Mar"},{id:3,label:"Mi\xE9"},{id:4,label:"Jue"},{id:5,label:"Vie"},{id:6,label:"S\xE1b"},{id:0,label:"Dom"}];async function jt(t){let e=document.getElementById("bot-studio-backdrop");e&&e.remove();let n=document.createElement("div");n.id="bot-studio-backdrop",n.className="bot-studio-backdrop",n.setAttribute("role","dialog"),n.setAttribute("aria-modal","true"),n.setAttribute("aria-label","Automatizaci\xF3n y Bot de Mensajes"),n.innerHTML=`
    <div class="bot-studio-dialog">
      <div class="bot-studio-header">
        <div style="display:flex;align-items:center;gap:0.75rem;min-width:0;flex:1 1 220px;">
          <span style="flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:12px;background:var(--btn-bg,#4f46e5);color:var(--btn-text,#fff);box-shadow:0 6px 16px rgba(79,70,229,0.28);">${l("bot",20)}</span>
          <div style="min-width:0;">
            <div style="font-weight:700;font-size:0.98rem;letter-spacing:-0.01em;line-height:1.25;">Bot de Mensajes &amp; Base de Conocimientos</div>
            <div id="bot-studio-subtitle" class="bot-studio-subtitle">Cargando configuraci\xF3n del tenant...</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;justify-content:flex-end;">
          <div id="bot-studio-badges" style="display:flex;gap:0.4rem;flex-wrap:wrap;"></div>
          <button type="button" id="btn-close-bot-studio" class="bot-studio-close-btn" aria-label="Cerrar">\u2715</button>
        </div>
      </div>

      <div class="bot-studio-tabs" role="tablist">
        <button type="button" class="bot-tab-btn" data-tab="config">Configuraci\xF3n y Horario</button>
        <button type="button" class="bot-tab-btn" data-tab="kb">Base de Conocimientos</button>
        <button type="button" class="bot-tab-btn" data-tab="ops">Tickets y Pagos</button>
        <button type="button" class="bot-tab-btn" data-tab="sim">Simulador</button>
        <button type="button" class="bot-tab-btn" data-tab="runs">Auditor\xEDa</button>
      </div>

      <div id="bot-studio-body" class="bot-studio-body">
        <p class="bot-studio-subtitle">Cargando...</p>
      </div>
    </div>
  `,document.body.appendChild(n);let s=()=>n.remove();n.querySelector("#btn-close-bot-studio")?.addEventListener("click",s),n.addEventListener("click",j=>{j.target===n&&s()});let r="config",i=null,m=!1,u=0,h=[],f=[],w="",T=null,S=()=>{n.querySelectorAll(".bot-tab-btn").forEach(j=>{j.classList.toggle("active",j.dataset.tab===r)})},P=async()=>{let j=await t("/api/bot/settings");i=j.settings,m=!!j.aiConfigured,u=Number(j.tokensUsedToday||0);let k=n.querySelector("#bot-studio-subtitle");k&&(k.textContent=`Tenant: ${i.tenantId} \xB7 Tokens hoy: ${u.toLocaleString()}`);let E=n.querySelector("#bot-studio-badges");E&&(E.innerHTML=`
        <span class="bot-studio-badge ${i.enabled?"is-ok":""}">${i.enabled?"\u25CF Bot Activo":"\u25CB Bot Pausado"}</span>
        <span class="bot-studio-badge ${m?"is-ok":""}">${m?"Gemini IA":"Reglas / KB"}</span>
      `)},N=async()=>{i||await P();let j=i,k=j.businessHours||{timezone:"America/Lima",days:[1,2,3,4,5,6],start:"08:00",end:"20:00",holidays:[]},E=n.querySelector("#bot-studio-body");E.innerHTML=`
      <form id="bot-config-form" style="display:grid;gap:1rem;">
        <div class="bot-studio-card" style="display:flex;flex-wrap:wrap;gap:1rem;align-items:center;justify-content:space-between;">
          <label class="bot-switch" style="font-weight:700;">
            <input type="checkbox" id="bot-enabled" ${j.enabled?"checked":""} />
            <span>Activar Bot Autom\xE1tico para mensajes entrantes</span>
          </label>
          <label class="bot-switch" style="font-size:0.86rem;font-weight:600;">
            <input type="checkbox" id="bot-ai-enabled" ${j.aiEnabled?"checked":""} />
            <span>Usar IA (Gemini) cuando no aplique una regla fija</span>
          </label>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:0.85rem;">
          <label style="display:grid;gap:0.35rem;font-size:0.84rem;font-weight:600;">
            Nombre del Bot
            <input type="text" id="bot-name" value="${oe(j.botName)}" style="padding:0.5rem 0.65rem;" />
          </label>
          <label style="display:grid;gap:0.35rem;font-size:0.84rem;font-weight:600;">
            Pausa tras respuesta de agente (min)
            <input type="number" id="bot-pause-min" min="1" max="1440" value="${Number(j.humanPauseMinutes||30)}" style="padding:0.5rem 0.65rem;" />
          </label>
          <label style="display:grid;gap:0.35rem;font-size:0.84rem;font-weight:600;">
            Agrupar mensajes / Debounce (ms)
            <input type="number" id="bot-debounce" min="0" max="15000" step="500" value="${Number(j.debounceMs??4e3)}" style="padding:0.5rem 0.65rem;" />
          </label>
          <label style="display:grid;gap:0.35rem;font-size:0.84rem;font-weight:600;">
            M\xE1x. respuestas / hora por chat
            <input type="number" id="bot-rate-limit" min="1" max="200" value="${Number(j.maxRepliesPerHour||20)}" style="padding:0.5rem 0.65rem;" />
          </label>
        </div>

        <div style="display:grid;gap:0.4rem;font-size:0.84rem;font-weight:600;">
          Canales activos
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
            ${["whatsapp","facebook","instagram"].map(D=>`<label class="bot-day-chip">
                  <input type="checkbox" name="bot-channels" value="${D}" ${(j.channels||[]).includes(D)?"checked":""} /> ${D.toUpperCase()}
                </label>`).join("")}
          </div>
        </div>

        <label style="display:grid;gap:0.35rem;font-size:0.84rem;font-weight:600;">
          Personalidad e instrucciones del Bot
          <textarea id="bot-persona" rows="3" style="padding:0.55rem 0.7rem;resize:vertical;">${oe(j.personaPrompt)}</textarea>
        </label>

        <div class="bot-studio-card" style="display:grid;gap:0.75rem;">
          <div style="font-weight:700;font-size:0.9rem;">Horario de Atenci\xF3n Humana</div>
          <div style="display:flex;gap:0.45rem;flex-wrap:wrap;">
            ${tn.map(D=>`<label class="bot-day-chip">
                <input type="checkbox" name="bot-days" value="${D.id}" ${(k.days||[]).includes(D.id)?"checked":""} /> ${D.label}
              </label>`).join("")}
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:0.75rem;">
            <label style="display:grid;gap:0.25rem;font-size:0.82rem;font-weight:600;">
              Hora inicio
              <input type="time" id="bot-bh-start" value="${oe(k.start)}" style="padding:0.45rem 0.6rem;" />
            </label>
            <label style="display:grid;gap:0.25rem;font-size:0.82rem;font-weight:600;">
              Hora fin
              <input type="time" id="bot-bh-end" value="${oe(k.end)}" style="padding:0.45rem 0.6rem;" />
            </label>
            <label style="display:grid;gap:0.25rem;font-size:0.82rem;font-weight:600;">
              Zona horaria
              <input type="text" id="bot-bh-tz" value="${oe(k.timezone)}" style="padding:0.45rem 0.6rem;" />
            </label>
          </div>
          <label style="display:grid;gap:0.25rem;font-size:0.82rem;font-weight:600;">
            Mensaje fuera de horario
            <textarea id="bot-ooh-msg" rows="2" style="padding:0.5rem 0.65rem;">${oe(j.outOfHoursMessage)}</textarea>
          </label>
        </div>

        <div class="bot-studio-grid-submit">
          <label style="display:grid;gap:0.35rem;font-size:0.84rem;font-weight:600;">
            Palabras de traspaso a humano (separadas por coma)
            <input type="text" id="bot-handoff-kw" value="${oe((j.handoffKeywords||[]).join(", "))}" style="padding:0.5rem 0.65rem;" />
          </label>
          <button type="submit" class="bot-studio-btn-primary">Guardar Configuraci\xF3n</button>
        </div>
        <div id="bot-config-msg" style="font-size:0.82rem;"></div>
      </form>
    `,E.querySelector("#bot-config-form")?.addEventListener("submit",async D=>{D.preventDefault();let Y=Array.from(E.querySelectorAll('input[name="bot-channels"]:checked')).map(te=>te.value),B=Array.from(E.querySelectorAll('input[name="bot-days"]:checked')).map(te=>Number(te.value)),re={enabled:E.querySelector("#bot-enabled").checked,aiEnabled:E.querySelector("#bot-ai-enabled").checked,botName:E.querySelector("#bot-name").value.trim()||"Turbo",humanPauseMinutes:Number(E.querySelector("#bot-pause-min").value||30),debounceMs:Number(E.querySelector("#bot-debounce").value||4e3),maxRepliesPerHour:Number(E.querySelector("#bot-rate-limit").value||20),channels:Y,personaPrompt:E.querySelector("#bot-persona").value,outOfHoursMessage:E.querySelector("#bot-ooh-msg").value,handoffKeywords:E.querySelector("#bot-handoff-kw").value.split(",").map(te=>te.trim()).filter(Boolean),businessHours:{days:B,start:E.querySelector("#bot-bh-start").value||"08:00",end:E.querySelector("#bot-bh-end").value||"20:00",timezone:E.querySelector("#bot-bh-tz").value.trim()||"America/Lima",holidays:k.holidays||[]}};i=(await t("/api/bot/settings",{method:"PUT",body:JSON.stringify(re)})).settings;let ce=E.querySelector("#bot-config-msg");ce&&(ce.innerHTML='<span style="color:#10b981;font-weight:600;">Configuraci\xF3n guardada correctamente.</span>')})},a=async()=>{h=(await t("/api/bot/kb/articles")).articles||[];let k=n.querySelector("#bot-studio-body");k.innerHTML=`
      <div style="display:grid;gap:1rem;">
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;justify-content:space-between;">
          <div style="display:flex;gap:0.5rem;flex:1;min-width:220px;">
            <input type="text" id="kb-search-input" placeholder="Probar b\xFAsqueda sem\xE1ntica / palabras clave..." style="flex:1;padding:0.45rem 0.65rem;" />
            <button type="button" id="btn-kb-search" class="bot-studio-btn-secondary">Probar</button>
          </div>
          <button type="button" id="btn-kb-reindex" class="bot-studio-btn-secondary">Reindexar</button>
        </div>
        <div id="kb-search-results" class="bot-studio-card" style="display:none;border-style:dashed;font-size:0.82rem;"></div>

        <form id="kb-new-form" class="bot-studio-card" style="display:grid;gap:0.65rem;">
          <div style="font-weight:700;font-size:0.88rem;">Nuevo Art\xEDculo</div>
          <div class="bot-studio-grid-2-1">
            <input type="text" id="kb-new-title" placeholder="T\xEDtulo (ej. Cobertura en San Juan)" required style="padding:0.45rem 0.65rem;" />
            <input type="text" id="kb-new-category" placeholder="Categor\xEDa (planes, pagos...)" value="general" style="padding:0.45rem 0.65rem;" />
          </div>
          <textarea id="kb-new-content" rows="2" placeholder="Contenido detallado que el bot usar\xE1 para responder..." required style="padding:0.45rem 0.65rem;"></textarea>
          <div style="display:flex;gap:0.65rem;align-items:center;flex-wrap:wrap;">
            <input type="text" id="kb-new-keywords" placeholder="Palabras clave separadas por coma" style="flex:1;min-width:180px;padding:0.45rem 0.65rem;" />
            <button type="submit" class="bot-studio-btn-primary">Agregar</button>
          </div>
        </form>

        <div style="display:grid;gap:0.6rem;">
          ${h.map(E=>`<div class="bot-studio-card" style="display:grid;gap:0.35rem;">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;">
                  <div><strong>${oe(E.title)}</strong> <span style="font-size:0.75rem;padding:2px 8px;border-radius:999px;background:rgba(99,102,241,0.18);color:var(--widget-accent,#6366f1);">${oe(E.category)}</span></div>
                  <button type="button" class="btn-kb-del" data-id="${E.id}" style="padding:0.25rem 0.6rem;border-radius:6px;border:1px solid #ef4444;color:#ef4444;background:transparent;cursor:pointer;font-size:0.76rem;">Eliminar</button>
                </div>
                <div style="font-size:0.83rem;color:var(--text-secondary);white-space:pre-wrap;">${oe(E.content)}</div>
              </div>`).join("")}
        </div>
      </div>
    `,k.querySelector("#kb-new-form")?.addEventListener("submit",async E=>{E.preventDefault(),await t("/api/bot/kb/articles",{method:"POST",body:JSON.stringify({title:k.querySelector("#kb-new-title").value,category:k.querySelector("#kb-new-category").value,content:k.querySelector("#kb-new-content").value,keywords:k.querySelector("#kb-new-keywords").value})}),await a()}),k.querySelector("#btn-kb-reindex")?.addEventListener("click",async()=>{let E=await t("/api/bot/kb/reindex",{method:"POST",body:"{}"});alert(`Reindexaci\xF3n completa: ${E.articles} art\xEDculos, ${E.chunks} fragmentos.`)}),k.querySelector("#btn-kb-search")?.addEventListener("click",async()=>{let E=k.querySelector("#kb-search-input").value.trim();if(!E)return;let D=await t("/api/bot/kb/search",{method:"POST",body:JSON.stringify({query:E})}),Y=k.querySelector("#kb-search-results");Y.style.display="block",Y.innerHTML=(D.hits||[]).length?D.hits.map(B=>`<div style="margin-bottom:0.4rem;"><strong>${oe(B.title)}</strong> (${B.score}): ${oe(B.chunkText.slice(0,180))}...</div>`).join(""):"Sin coincidencias relevantes."}),k.querySelectorAll(".btn-kb-del").forEach(E=>{E.addEventListener("click",async()=>{await t(`/api/bot/kb/articles/${E.dataset.id}`,{method:"DELETE"}),await a()})})},_=async()=>{let[j,k]=await Promise.all([t("/api/bot/payment-claims"),t("/api/bot/tickets")]),E=j.claims||[],D=k.tickets||[],Y=n.querySelector("#bot-studio-body");Y.innerHTML=`
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr));gap:1.1rem;align-items:start;">
        <div>
          <h4 style="margin:0 0 0.65rem 0;font-size:0.95rem;">Comprobantes de Pago Recibidos (${E.length})</h4>
          ${E.length===0?`<div class="bot-empty-state">${l("receipt",28)}<strong>Sin comprobantes</strong><span style="font-size:0.82rem;">Cuando un cliente env\xEDe una captura de Yape, Plin o transferencia, aparecer\xE1 aqu\xED para validaci\xF3n.</span></div>`:`<div style="display:grid;gap:0.55rem;">${E.map(B=>`<div class="bot-studio-card" style="display:flex;justify-content:space-between;align-items:center;gap:0.75rem;flex-wrap:wrap;">
                      <div>
                        <strong>#${B.id} \xB7 ${oe(B.customer_name)}</strong> (${oe(String(B.method||"").toUpperCase())}) \u2014 <strong>${Number(B.amount||0).toFixed(2)}</strong>
                        <div class="bot-studio-subtitle">Op: ${oe(B.operation_code||"-")} \xB7 Estado: <strong>${oe(B.status)}</strong></div>
                      </div>
                      ${B.status==="pending_validation"?`<div style="display:flex;gap:0.45rem;">
                              <button type="button" class="btn-claim-act bot-studio-btn-primary" data-id="${B.id}" data-status="approved" style="padding:0.35rem 0.7rem;font-size:0.78rem;background:#10b981;">Aprobar</button>
                              <button type="button" class="btn-claim-act bot-studio-btn-secondary" data-id="${B.id}" data-status="rejected" style="padding:0.35rem 0.7rem;font-size:0.78rem;color:#ef4444;border-color:#ef4444;">Rechazar</button>
                            </div>`:`<span class="bot-studio-subtitle">Revisado por ${oe(B.reviewed_by||"-")}</span>`}
                    </div>`).join("")}</div>`}
        </div>

        <div>
          <h4 style="margin:0 0 0.65rem 0;font-size:0.95rem;">Tickets de Soporte Creados por el Bot (${D.length})</h4>
          ${D.length===0?`<div class="bot-empty-state">${l("wrench",28)}<strong>Sin tickets pendientes</strong><span style="font-size:0.82rem;">Los reportes t\xE9cnicos generados autom\xE1ticamente desde el chat aparecer\xE1n aqu\xED.</span></div>`:`<div style="display:grid;gap:0.55rem;">${D.map(B=>`<div class="bot-studio-card" style="display:flex;justify-content:space-between;align-items:center;gap:0.75rem;flex-wrap:wrap;">
                      <div>
                        <strong>#${B.id} \xB7 ${oe(B.subject)}</strong> (${oe(B.customer_name)})
                        <div class="bot-studio-subtitle">${oe(B.category)} \xB7 Estado: <strong>${oe(B.status)}</strong></div>
                      </div>
                      ${B.status!=="resolved"?`<button type="button" class="btn-ticket-resolve bot-studio-btn-secondary" data-id="${B.id}" style="padding:0.35rem 0.7rem;font-size:0.78rem;">Marcar resuelto</button>`:'<span style="color:#10b981;font-size:0.78rem;font-weight:600;">Resuelto</span>'}
                    </div>`).join("")}</div>`}
        </div>
      </div>
    `,Y.querySelectorAll(".btn-claim-act").forEach(B=>{B.addEventListener("click",async()=>{await t(`/api/bot/payment-claims/${B.dataset.id}`,{method:"PUT",body:JSON.stringify({status:B.dataset.status})}),await _()})}),Y.querySelectorAll(".btn-ticket-resolve").forEach(B=>{B.addEventListener("click",async()=>{await t(`/api/bot/tickets/${B.dataset.id}`,{method:"PUT",body:JSON.stringify({status:"resolved"})}),await _()})})},L=()=>{let j=n.querySelector("#bot-studio-body");j.innerHTML=`
      <div style="display:grid;gap:0.85rem;">
        <div style="display:flex;gap:0.65rem;flex-wrap:wrap;align-items:center;">
          <input type="text" id="sim-phone" placeholder="Tel\xE9fono opcional (ej. +51987654321)" style="flex:1;min-width:200px;padding:0.45rem 0.65rem;" />
          <button type="button" id="btn-sim-reset" class="bot-studio-btn-secondary">Reiniciar chat</button>
        </div>
        <div id="sim-chat-log" class="bot-studio-card" style="min-height:220px;max-height:320px;overflow-y:auto;display:grid;gap:0.55rem;align-content:start;">
          ${f.length===0?'<div class="bot-studio-subtitle">Escriba un mensaje abajo (ej. "hola", "cu\xE1nto debo", "planes", "asesor") para probar la l\xF3gica sin enviar nada real.</div>':f.map(k=>`<div style="padding:0.55rem 0.8rem;border-radius:8px;max-width:85%;${k.senderType==="contact"?"justify-self:end;background:var(--btn-bg,#4f46e5);color:var(--btn-text,#fff);":"justify-self:start;background:var(--widget-bg);border:1px solid var(--widget-border);color:var(--text-primary);"}white-space:pre-wrap;font-size:0.85rem;">${oe(k.body)}</div>`).join("")}
        </div>
        <form id="sim-form" style="display:flex;gap:0.5rem;">
          <input type="text" id="sim-input" placeholder="Escriba como si fuera un cliente..." required style="flex:1;padding:0.55rem 0.75rem;" />
          <button type="submit" class="bot-studio-btn-primary">Simular</button>
        </form>
        <div id="sim-trace" class="bot-studio-subtitle"></div>
      </div>
    `,j.querySelector("#btn-sim-reset")?.addEventListener("click",()=>{f=[],w="",T=null,L()}),j.querySelector("#sim-form")?.addEventListener("submit",async k=>{k.preventDefault();let E=j.querySelector("#sim-input"),D=j.querySelector("#sim-phone").value.trim(),Y=E.value.trim();if(!Y)return;E.value="";let B=await t("/api/bot/simulate",{method:"POST",body:JSON.stringify({text:Y,phone:D,customerId:T,pendingFlow:w,history:f})});f.push({senderType:"contact",body:Y});let re=B.decision||{},J=re.handoff?`[Traspaso a humano: ${re.reason||""}]`:re.text||"(sin respuesta)";f.push({senderType:"bot",body:J}),w=B.nextPendingFlow||"",T=B.nextCustomerId??T,L();let ce=n.querySelector("#sim-trace");ce&&(ce.textContent=`Ruta: ${re.path} \xB7 Intenci\xF3n: ${re.intent} \xB7 Herramientas: ${(re.toolsUsed||[]).join(", ")||"ninguna"} \xB7 Tokens: ${re.tokens||0} \xB7 Latencia: ${B.latencyMs}ms`)})},G=async()=>{let k=(await t("/api/bot/runs?limit=30")).runs||[],E=n.querySelector("#bot-studio-body");E.innerHTML=k.length?`<div style="display:grid;gap:0.5rem;">${k.map(D=>`<div class="bot-studio-card" style="font-size:0.8rem;">
              <div style="display:flex;justify-content:space-between;gap:0.5rem;">
                <strong>Chat #${D.conversation_id??"-"} \xB7 ${oe(D.path)} (${oe(D.intent)})</strong>
                <span class="bot-studio-subtitle">${D.tokens||0} tok \xB7 ${D.latency_ms||0}ms</span>
              </div>
              ${D.reply_text?`<div style="color:var(--text-secondary);margin-top:0.25rem;">${oe(D.reply_text.slice(0,180))}</div>`:""}
              ${D.error?`<div style="color:#ef4444;margin-top:0.25rem;">${oe(D.error)}</div>`:""}
            </div>`).join("")}</div>`:`<div class="bot-empty-state">${l("bot",28)}<strong>Sin ejecuciones registradas</strong><span style="font-size:0.82rem;">Aqu\xED ver\xE1 el historial de decisiones, herramientas usadas, tokens y latencia de cada respuesta autom\xE1tica.</span></div>`},R=async j=>{r=j,S(),j==="config"?await N():j==="kb"?await a():j==="ops"?await _():j==="sim"?L():await G()};n.querySelectorAll(".bot-tab-btn").forEach(j=>{j.addEventListener("click",()=>{R(j.dataset.tab)})}),await P(),await R("config")}function gt(t,e="WA"){let n=String(t||"").trim();if(!n)return e;let s=n.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/g);if(s&&s.length>=2)return(s[0][0]+s[1][0]).toUpperCase();if(s&&s.length===1)return s[0].slice(0,2).toUpperCase();let r=n.replace(/\D/g,"");return r.length>=2?r.slice(-2):e}function It(t,e=new Date){let n=i=>new Date(i.getFullYear(),i.getMonth(),i.getDate()).getTime(),r=Math.round((n(e)-n(t))/864e5);if(r===0)return"Hoy";if(r===1)return"Ayer";if(r>1&&r<7){let i=t.toLocaleDateString("es-PE",{weekday:"long"});return i.charAt(0).toUpperCase()+i.slice(1)}return t.toLocaleDateString("es-PE",{day:"2-digit",month:"long",year:"numeric"})}function Ct(t){return`${t.getFullYear()}-${t.getMonth()+1}-${t.getDate()}`}var je=new Map;function yt(t){let e=t==="bot",n=document.getElementById("btn-toggle-conv-bot-mode"),s=document.getElementById("conv-bot-mode-label"),r=n?n.dataset.canCreate!=="0":!0;n&&s&&(n.dataset.mode=t,n.classList.toggle("active",e),s.textContent=t==="human"?"Humano":t==="paused"?"Pausado":"Bot");let i=document.getElementById("chat-composer-form"),m=document.getElementById("chat-composer-input"),u=document.getElementById("btn-toggle-emoji-picker"),h=document.getElementById("btn-attach-media-file"),f=document.getElementById("btn-chat-action");i&&i.classList.toggle("is-bot-locked",e);let w=e||!r;m&&(m.disabled=w,m.placeholder=e?"Bot activo en este chat \u2014 cambie a Humano para escribir...":"Mensaje..."),u&&(u.disabled=w),h&&(h.disabled=w),f&&(f.disabled=w)}function q(t){return t?t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"):""}function Je(t,e){let n=t||"read";return n==="queued"?`
      <span class="msg-checks check-queued" title="Enviando\u2026 se reintentar\xE1 autom\xE1ticamente al reconectar" role="img" aria-label="Enviando">
        ${l("clock",13)}
      </span>
    `:n==="failed"?`
      <span class="msg-checks check-failed" role="img" aria-label="No se pudo enviar" title="No se pudo enviar a WhatsApp">
        ${l("alertTriangle",13)}
      </span>
      <button type="button" class="msg-retry-btn js-retry-send" data-id="${e??""}" aria-label="Reintentar env\xEDo">
        ${l("refresh",11)}<span>Reintentar</span>
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
  `}function vt(t){return`
    <div class="wa-media-failed-box" role="group" aria-label="Multimedia no disponible">
      <span class="wa-media-failed-icon" aria-hidden="true">${l("image",20)}</span>
      <span class="wa-media-failed-text">No se pudo descargar</span>
      ${t?`<button type="button" class="wa-media-retry-btn js-retry-media">${l("refresh",12)}<span>Reintentar</span></button>`:""}
    </div>
  `}function Ie(t){if(!t)return[];try{let e=JSON.parse(t);return Array.isArray(e)?e.map(n=>String(n).trim()).filter(Boolean):[]}catch{return[]}}function nn(t,e){return e.find(s=>s.name.toLowerCase()===t.toLowerCase())?.color||"#6366f1"}function Re(t,e,n="",s=""){let r=nn(t,e);return`<span class="tag-pill-minimal ${n}" style="--tag-color:${r};" ${s}><span class="tag-dot"></span><span>${t}</span></span>`}function it(t){return new Promise((e,n)=>{let s=new FileReader;s.onload=()=>e(String(s.result)),s.onerror=()=>n(new Error("No se pudo leer el archivo seleccionado")),s.readAsDataURL(t)})}function At(t){let e=(t||"").toLowerCase();return e.startsWith("image/")?"image":e.startsWith("video/")?"video":e.startsWith("audio/")?"audio":"document"}function xt(t){switch(t){case"image":return"image";case"video":return"video";case"audio":return"music";case"document":return"fileText";default:return"messageSquare"}}function Ge(t){switch(t){case"image":return"Foto";case"video":return"Video";case"audio":return"Audio";case"document":return"Documento";default:return"Texto"}}function qt(t){switch(t){case"whatsapp":return"whatsapp";case"facebook":return"facebook";case"instagram":return"instagram";case"tiktok":return"tiktok"}}function an(t){switch(t){case"whatsapp":return"WhatsApp";case"facebook":return"Facebook";case"instagram":return"Instagram";case"tiktok":return"TikTok"}}function Nt(t){let e=t.totalMessages||0,n=e>0?Math.min(99,Math.round(t.processedMessages/e*100)):25,s=typeof t.pct=="number"&&t.pct>0?t.pct:n,r="Sincronizando mensajes",i="Descargando conversaciones y mensajes en tiempo real...";t.channel==="whatsapp"?(r="Sincronizando chats de WhatsApp",i=e>0?`${t.processedMessages.toLocaleString("es-PE")} de ${e.toLocaleString("es-PE")} mensajes \xB7 ${t.chats.toLocaleString("es-PE")} chats`:"Conectando con WhatsApp y recibiendo chats..."):t.channel==="instagram"?(r="Sincronizando Instagram Direct",i="Descargando conversaciones y respuestas de Instagram..."):t.channel==="facebook"?(r="Sincronizando Facebook Messenger",i="Descargando conversaciones de la Fan Page comercial..."):t.channel==="all"&&(r="Sincronizando todas las redes",i="Descargando mensajes de WhatsApp, Instagram y Facebook...");let m=t.title||r,u=t.detail||i;return{pct:s,detail:u,title:m}}function on(t){if(!t||!t.active)return"";let{pct:e,detail:n,title:s}=Nt(t);return`
    <div class="wa-sync-banner" id="wa-sync-banner" role="status" aria-live="polite">
      <span class="wa-sync-spinner" aria-hidden="true"></span>
      <div class="wa-sync-text">
        <strong id="wa-sync-title">${s}</strong>
        <span id="wa-sync-detail">${n}</span>
      </div>
      <div class="wa-sync-bar"><i id="wa-sync-bar-fill" style="width:${e}%"></i></div>
    </div>
  `}var Ye=new Map;function Dt(t){if(!t)return[];let e=/(https?:\/\/[^\s<>"']+)|(www\.[^\s<>"']+)/gi;return(t.match(e)||[]).map(s=>s.startsWith("http")?s:`https://${s}`)}function bt(t){return t?q(t).replace(/(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi,n=>`<a href="${n.startsWith("http")?n:`https://${n}`}" target="_blank" rel="noopener noreferrer" class="chat-inline-link" onclick="event.stopPropagation();">${n}</a>`):""}function ht(t){let e=Dt(t);if(e.length===0)return"";let n=e[0],s=n;try{s=new URL(n).hostname.replace(/^www\./,"")}catch{}let r=`https://www.google.com/s2/favicons?domain=${encodeURIComponent(s)}&sz=128`,i=Ye.get(n);if(i){let m=i.title||s,u=i.description||"",h=i.image||"";return`
      <a href="${n}" target="_blank" rel="noopener noreferrer" class="wa-link-preview-card" onclick="event.stopPropagation();">
        ${h?`<div class="wa-link-preview-img-box"><img src="${h}" alt="" class="wa-link-preview-img" loading="lazy" onerror="this.src='${r}'; this.className='wa-link-preview-fallback-favicon';" /></div>`:`<div class="wa-link-preview-img-box" style="background:rgba(0,0,0,0.04);display:flex;align-items:center;justify-content:center;height:60px;"><img src="${r}" alt="" class="wa-link-preview-fallback-favicon" style="width:32px;height:32px;" /></div>`}
        <div class="wa-link-preview-info">
          <strong class="wa-link-preview-title">${q(m)}</strong>
          ${u?`<p class="wa-link-preview-desc">${q(u)}</p>`:""}
          <span class="wa-link-preview-domain">${l("link",11)} ${q(i.domain||s)}</span>
        </div>
      </a>
    `}return`
    <a href="${n}" target="_blank" rel="noopener noreferrer" class="wa-link-preview-card js-link-preview-target" data-url="${n}" onclick="event.stopPropagation();">
      <div class="wa-link-preview-info">
        <strong class="wa-link-preview-title">${q(s)}</strong>
        <span class="wa-link-preview-domain">${l("link",11)} ${q(s)}</span>
      </div>
    </a>
  `}async function sn(){document.querySelectorAll(".js-link-preview-target:not([data-hydrated])").forEach(async e=>{e.setAttribute("data-hydrated","true");let n=e.getAttribute("data-url");if(n)try{let s=Ye.get(n);if(s||(s=await fetch(`/api/link-preview?url=${encodeURIComponent(n)}`).then(f=>f.json()),s&&!s.error&&Ye.set(n,s)),!s||s.error)return;let r=s.domain||"";try{r||(r=new URL(n).hostname.replace(/^www\./,""))}catch{}let i=s.title||r,m=s.description||"",u=s.image||"",h=s.favicon||`https://www.google.com/s2/favicons?domain=${encodeURIComponent(r)}&sz=128`;e.innerHTML=`
        ${u?`<div class="wa-link-preview-img-box"><img src="${u}" alt="" class="wa-link-preview-img" loading="lazy" onerror="this.src='${h}'; this.className='wa-link-preview-fallback-favicon';" /></div>`:`<div class="wa-link-preview-img-box" style="background:rgba(0,0,0,0.04);display:flex;align-items:center;justify-content:center;height:60px;"><img src="${h}" alt="" class="wa-link-preview-fallback-favicon" style="width:32px;height:32px;" /></div>`}
        <div class="wa-link-preview-info">
          <strong class="wa-link-preview-title">${q(i)}</strong>
          ${m?`<p class="wa-link-preview-desc">${q(m)}</p>`:""}
          <span class="wa-link-preview-domain">${l("link",11)} ${q(s.domain||r)}</span>
        </div>
      `}catch{}})}function rn(t){switch(t){case"wa-qr":return"WhatsApp";case"wa-api":return"WhatsApp API";case"wa-chatbot":return"Chatbot IA";case"wa-broadcast":return"Masivo API";case"tiktok":return"TikTok";default:return"Meta Inbox"}}function ln(t){let e=t.media_type||"none",n=t.media_url||"";if(e==="none"||!n)return"";let s=t.media_filename||"archivo_adjunto";return e==="image"?`
      <div class="chat-media-attachment js-open-media-lightbox" data-media-type="image" data-media-url="${n}" data-media-title="${q(s)}" style="cursor:pointer;">
        <img src="${n}" alt="${q(s)}" loading="lazy" />
      </div>
    `:e==="video"?`
      <div class="chat-media-attachment js-open-media-lightbox" data-media-type="video" data-media-url="${n}" data-media-title="${q(s)}" style="cursor:pointer;position:relative;border-radius:10px;overflow:hidden;background:#000;">
        <video src="${n}" preload="metadata" style="max-height:240px;width:100%;object-fit:cover;pointer-events:none;"></video>
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.35);">
          <span style="width:44px;height:44px;border-radius:50%;background:rgba(0,0,0,0.65);color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,0.4);">
            ${l("play",20)}
          </span>
        </div>
      </div>
    `:e==="audio"?`
      <div class="chat-media-attachment wa-audio-bubble" data-audio-src="${n}">
        <button type="button" class="wa-audio-play-btn js-wa-audio-toggle" aria-label="Reproducir nota de voz">
          ${l("play",16)}
        </button>
        <div class="wa-audio-content">
          <div class="wa-audio-track-wrapper js-wa-audio-track">
            <div class="wa-audio-waveform-bars">
              ${[40,65,30,85,55,95,45,75,60,90,35,70,80,50,65,85,45,95,70,40].map(r=>`<span class="wa-wave-bar" style="height:${r}%;"></span>`).join("")}
            </div>
            <div class="wa-audio-scrubber-track">
              <div class="wa-audio-scrubber-fill js-wa-audio-fill" style="width: 0%;"></div>
            </div>
          </div>
          <div class="wa-audio-meta-row">
            <span class="wa-audio-time-label js-wa-audio-time">0:00</span>
            <div style="display:flex;align-items:center;gap:0.4rem;">
              <button type="button" class="wa-audio-speed-btn js-wa-audio-speed" title="Velocidad de reproducci\xF3n (1x, 1.5x, 2x)">1x</button>
              <span class="wa-audio-mic-indicator" title="Nota de voz">${l("mic",12)}</span>
            </div>
          </div>
        </div>
        <audio class="wa-audio-native-tag" src="${n}" preload="metadata"></audio>
      </div>
    `:`
    <div class="chat-media-attachment">
      <div class="chat-media-doc-card js-open-media-lightbox" data-media-type="document" data-media-url="${n}" data-media-title="${q(s)}" style="cursor:pointer;display:flex;align-items:center;gap:0.6rem;">
        ${l("fileText",20)}
        <div style="overflow:hidden;flex:1;">
          <strong style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${q(s)}</strong>
          <span style="font-size:0.7rem;opacity:0.8;">Clic para visualizar o descargar</span>
        </div>
        <a href="${n}" download="${q(s)}" title="Descargar documento" style="color:inherit;padding:0.25rem;display:inline-flex;" onclick="event.stopPropagation();">
          ${l("download",15)}
        </a>
      </div>
    </div>
  `}function Ot(t,e,n){let s=t.connections||{},r=t.conversations.filter(a=>{if(t.channelFilter!=="all"&&a.channel!==t.channelFilter)return!1;if(t.tagFilter&&t.tagFilter!=="all"){let _=Ie(a.tags_json),L=a.tag&&a.tag.toLowerCase()===t.tagFilter.toLowerCase();if(!_.some(G=>G.toLowerCase()===t.tagFilter.toLowerCase())&&!L)return!1}if(t.searchQuery.trim()){let _=t.searchQuery.toLowerCase(),L=Ie(a.tags_json).join(" ").toLowerCase();return a.contact_name.toLowerCase().includes(_)||a.contact_handle.toLowerCase().includes(_)||a.last_message_text.toLowerCase().includes(_)||L.includes(_)}return!0}),i=t.selectedConversationId!==null&&r.find(a=>a.id===t.selectedConversationId)||null,m=i?t.messages.filter(a=>a.conversation_id===i.id):[],u=i?t.notes.filter(a=>a.conversation_id===i.id):[],h=i?Ie(i.tags_json):[],f=i?.assigned_user_id&&t.users.find(a=>a.id===i.assigned_user_id)||null,w=r.map(a=>{let _=i?.id===a.id,L=gt(a.contact_name,"WA"),G=Ie(a.tags_json),R=G.slice(0,2),j=Math.max(0,G.length-2),k=a.assigned_user_id?t.users.find(E=>E.id===a.assigned_user_id):null;return`
        <button type="button" class="conv-item ${_?"active":""} js-select-conv" data-conv-id="${a.id}">
          <div class="conv-avatar" style="background:${a.avatar_color};">
            <span>${L||"WA"}</span>
            <span class="conv-channel-badge ch-${a.channel}" title="${an(a.channel)}">
              ${l(qt(a.channel),11)}
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
                ${R.length>0?R.map(E=>Re(E,t.tags)).join(""):`<span style="font-size:0.67rem;color:var(--text-muted);">${a.contact_handle}</span>`}
                ${j>0?`<span class="tag-pill-minimal" style="--tag-color:var(--text-muted);">+${j}</span>`:""}
                ${k?`<span style="font-size:0.65rem;color:var(--text-muted);" title="Asignado a ${k.full_name}">\u2022 ${k.full_name.split(" ")[0]}</span>`:""}
              </div>
              ${a.unread_count>0?`<span style="background:var(--btn-bg);color:var(--btn-text);font-size:0.66rem;font-weight:700;padding:0.06rem 0.42rem;border-radius:99px;flex:none;">
                      ${a.unread_count}
                    </span>`:""}
            </div>
          </div>
        </button>
      `}).join(""),T=(a,_)=>{let L=a.sender_type==="contact",G=a.sender_type==="chatbot"||a.sender_type==="bot",R=_===m.length-1,j=a.media_type==="audio",k=a.media_type==="sticker"||!!a.media_url?.includes("sticker"),E=a.media_type==="image"&&!k,D=a.media_type==="video",Y=!!(a.reply_to_body||a.reply_to_media_url),B=a.reply_to_media_type==="image"||!!a.reply_to_media_url,re=Y?`
          <div class="chat-quoted-box js-jump-to-reply" data-target-id="${a.reply_to_id||""}" title="Clic para ir al mensaje citado">
            <div class="chat-quoted-inner">
              <div class="chat-quoted-sender">${q(a.reply_to_sender||"Mensaje")}</div>
              <div class="chat-quoted-body">
                ${B?`<span style="display:inline-flex;align-items:center;gap:0.25rem;font-weight:600;">${l("image",12)} Foto</span> `:""}
                ${q(a.reply_to_body||(B?"Foto":""))}
              </div>
            </div>
            ${a.reply_to_media_url&&B?`
              <div class="chat-quoted-thumb-box">
                <img src="${a.reply_to_media_url}" class="chat-quoted-thumb" alt="" />
              </div>
            `:""}
          </div>
        `:"",ce=a.id===t.lastSentMessageId?"chat-msg-highlight-pulse":"",ue=!!a.is_forwarded?`<div class="chat-msg-forwarded-label">${l("cornerUpRight",11)} <span>Reenviado</span></div>`:"",xe=Array.isArray(a.reactions_json)?a.reactions_json:[],p=`
        ${xe.length>0?`<div class="msg-reactions" aria-label="Reacciones">${Object.entries(xe.reduce((K,ne)=>(K[ne.emoji]=(K[ne.emoji]||0)+1,K),{})).map(([K,ne])=>`<span class="msg-reaction-chip">${q(K)}${ne>1?`<small>${ne}</small>`:""}</span>`).join("")}</div>`:""}
        <div class="chat-msg-actions-group">
          <button
            type="button"
            class="chat-msg-action-btn js-react-msg"
            data-id="${a.id}"
            title="Reaccionar"
            aria-label="Reaccionar con emoji"
          >
            ${l("smile",13)}
          </button>
          <button
            type="button"
            class="chat-msg-action-btn js-reply-msg"
            data-id="${a.id}"
            data-sender="${q(a.sender_name)}"
            data-body="${q(a.body||(a.media_type==="image"?"Foto":a.media_type?`[${a.media_type}]`:""))}"
            data-media-type="${a.media_type||"none"}"
            data-media-url="${a.media_url||""}"
            title="Responder"
          >
            ${l("cornerUpLeft",13)}
          </button>
          <button
            type="button"
            class="chat-msg-action-btn js-forward-msg"
            data-id="${a.id}"
            data-sender="${q(a.sender_name)}"
            data-body="${q(a.body||"")}"
            data-media-type="${a.media_type||"none"}"
            data-media-url="${a.media_url||""}"
            data-media-filename="${q(a.media_filename||"")}"
            title="Reenviar mensaje"
          >
            ${l("cornerUpRight",13)}
          </button>
        </div>
      `;if(j){let K=a.media_url||"";return`
          <div class="chat-msg-row ${L?"incoming":"outgoing"} chat-audio-msg-row ${ce}" data-id="${a.id}" data-sender="${q(a.sender_name)}" data-body="[Nota de voz]" data-media-type="audio" data-media-url="${K}" data-is-incoming="${L}" data-is-deleted="${!!a.is_deleted}" data-is-edited="${!!a.is_edited}">
            <div class="chat-swipe-indicator-reply">${l("cornerUpLeft",16)}</div>
            <div class="wa-standalone-audio-card wa-audio-bubble ${R?"latest-target":""} ${L?"incoming":"outgoing"}" data-audio-src="${K}">
              ${ue}
              ${re}
              <div class="wa-standalone-audio-main">
                <button type="button" class="wa-audio-play-btn js-wa-audio-toggle" aria-label="Reproducir nota de voz">
                  ${l("play",16)}
                </button>
                <div class="wa-audio-content">
                  <div class="wa-audio-track-wrapper js-wa-audio-track">
                    <div class="wa-audio-waveform-bars">
                      ${[40,65,30,85,55,95,45,75,60,90,35,70,80,50,65,85,45,95,70,40].map(ne=>`<span class="wa-wave-bar" style="height:${ne}%;"></span>`).join("")}
                    </div>
                    <div class="wa-audio-scrubber-track">
                      <div class="wa-audio-scrubber-fill js-wa-audio-fill" style="width: 0%;"></div>
                    </div>
                  </div>
                  <div class="wa-audio-meta-row">
                    <span class="wa-audio-time-label js-wa-audio-time">0:00</span>
                    <div class="wa-audio-sub-meta">
                      <button type="button" class="wa-audio-speed-btn js-wa-audio-speed" title="Velocidad (1x, 1.5x, 2x)">1x</button>
                      <span class="wa-audio-mic-indicator" title="Nota de voz">${l("mic",12)}</span>
                      <span class="wa-audio-time-stamp">${a.time_label}</span>
                      ${a.is_edited?'<span class="chat-msg-edited-badge">editado</span>':""}
                      ${L?"":Je(a.delivery_status,a.id)}
                    </div>
                  </div>
                </div>
              </div>
              ${p}
            </div>
          </div>
        `}if(k){let K=a.media_url||"";return`
          <div class="chat-msg-row ${L?"incoming":"outgoing"} chat-sticker-msg-row ${ce}" data-id="${a.id}" data-sender="${q(a.sender_name)}" data-body="[Sticker]" data-media-type="sticker" data-media-url="${K}" data-is-incoming="${L}" data-is-deleted="${!!a.is_deleted}" data-is-edited="${!!a.is_edited}">
            <div class="chat-swipe-indicator-reply">${l("cornerUpLeft",16)}</div>
            <div class="wa-standalone-sticker-card ${R?"latest-target":""} ${L?"incoming":"outgoing"}">
              ${ue}
              ${re}
              <div class="wa-sticker-media-wrapper ${K?"js-open-media-lightbox":"wa-media-failed"}" data-media-type="image" data-media-url="${K}" data-media-title="Sticker de ${q(a.sender_name)}">
                ${K?`<img src="${K}" class="wa-sticker-img" alt="Sticker" loading="lazy" />`:vt(!1)}
              </div>
              <div class="wa-sticker-meta-row">
                <span class="wa-sticker-time-badge">
                  <span>${a.time_label}</span>
                  ${a.is_edited?'<span class="chat-msg-edited-badge">editado</span>':""}
                  ${L?"":Je(a.delivery_status,a.id)}
                </span>
              </div>
              ${p}
            </div>
          </div>
        `}if(E){let K=a.media_url||"",ne=a.body&&!a.body.startsWith("[Foto")&&a.body!=="[Foto enviada]"&&a.body!=="null"?a.body:"";return`
          <div class="chat-msg-row ${L?"incoming":"outgoing"} chat-image-msg-row ${ce}" data-id="${a.id}" data-sender="${q(a.sender_name)}" data-body="${q(ne||"Foto")}" data-media-type="image" data-media-url="${K}" data-is-incoming="${L}" data-is-deleted="${!!a.is_deleted}" data-is-edited="${!!a.is_edited}">
            <div class="chat-swipe-indicator-reply">${l("cornerUpLeft",16)}</div>
            <div class="wa-standalone-image-card ${R?"latest-target":""} ${L?"incoming":"outgoing"}">
              ${ue}
              ${re}
              <div class="wa-image-media-wrapper ${K?"js-open-media-lightbox":"wa-media-failed"}" data-media-type="image" data-media-url="${K}" data-media-title="${q(a.media_filename||"Foto de WhatsApp")}">
                ${K?`<img src="${K}" alt="${q(a.media_filename||"Foto")}" class="wa-standalone-image-el" loading="lazy" />`:vt(!1)}
                <div class="wa-image-gradient-overlay">
                  <span class="wa-image-time-stamp">${a.time_label}</span>
                  ${a.is_edited?'<span class="chat-msg-edited-badge">editado</span>':""}
                  ${L?"":Je(a.delivery_status,a.id)}
                </div>
              </div>
              ${ne?`<div class="wa-image-caption-text">${bt(ne)}</div>`:""}
              ${ne?ht(ne):""}
              ${p}
            </div>
          </div>
        `}if(D){let K=a.media_url||"",ne=a.body&&!a.body.startsWith("[Video")&&a.body!=="[Video enviado]"&&a.body!=="null"?a.body:"";return`
          <div class="chat-msg-row ${L?"incoming":"outgoing"} chat-video-msg-row ${ce}" data-id="${a.id}" data-sender="${q(a.sender_name)}" data-body="${q(ne||"Video")}" data-media-type="video" data-media-url="${K}" data-is-incoming="${L}" data-is-deleted="${!!a.is_deleted}" data-is-edited="${!!a.is_edited}">
            <div class="chat-swipe-indicator-reply">${l("cornerUpLeft",16)}</div>
            <div class="wa-standalone-video-card ${R?"latest-target":""} ${L?"incoming":"outgoing"}">
              ${ue}
              ${re}
              <div class="wa-video-media-wrapper ${K?"js-open-media-lightbox":"wa-media-failed"}" data-media-type="video" data-media-url="${K}" data-media-title="${q(a.media_filename||"Video de WhatsApp")}">
                <video src="${K}" preload="metadata" playsinline class="wa-standalone-video-el" style="max-height:260px;width:100%;object-fit:cover;border-radius:10px;background:#000;display:block;"></video>
                <div class="wa-video-play-overlay">
                  <span class="wa-video-center-btn" title="Reproducir en Visor Moderno">
                    ${l("play",26)}
                  </span>
                </div>
                <div class="wa-video-gradient-overlay">
                  <span class="wa-video-time-stamp">${a.time_label}</span>
                  ${a.is_edited?'<span class="chat-msg-edited-badge">editado</span>':""}
                  ${L?"":Je(a.delivery_status,a.id)}
                </div>
              </div>
              ${ne?`<div class="wa-video-caption-text">${bt(ne)}</div>`:""}
              ${ne?ht(ne):""}
              ${p}
            </div>
          </div>
        `}let me=a.body&&a.body!=="[Audio enviado]"?a.body:"",he=me?ht(me):"";return`
        <div class="chat-msg-row ${L?"incoming":"outgoing"} ${G?"is-chatbot":""} ${ce}" data-id="${a.id}" data-sender="${q(a.sender_name)}" data-body="${q(me)}" data-media-type="${a.media_type||"none"}" data-media-url="${a.media_url||""}" data-is-incoming="${L}" data-is-deleted="${!!a.is_deleted}" data-is-edited="${!!a.is_edited}">
          <div class="chat-swipe-indicator-reply">${l("cornerUpLeft",16)}</div>
          <div class="chat-msg-bubble ${R?"latest-target":""}">
            ${ue}
            <div style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;margin-bottom:0.25rem;font-size:0.7rem;opacity:0.82;">
              <strong style="display:inline-flex;align-items:center;gap:0.3rem;">
                ${G?l("bot",12):a.sender_type==="broadcast"?l("megaphone",12):""}
                <span>${a.sender_name}</span>
              </strong>
              <span>${rn(a.delivery_via)}</span>
            </div>
            ${re}
            ${ln(a)}
            ${a.is_deleted?'<div style="font-style:italic;opacity:0.72;display:flex;align-items:center;gap:0.35rem;">\u{1F6AB} Este mensaje fue eliminado</div>':me?`<div style="white-space:pre-wrap;word-break:break-word;">${bt(me)}</div>`:""}
            ${a.is_deleted?"":he}
            <div class="chat-msg-footer-row">
              <span class="chat-msg-time">${a.time_label}</span>
              ${a.is_edited?'<span class="chat-msg-edited-badge">editado</span>':""}
              ${L?"":Je(a.delivery_status,a.id)}
            </div>
            ${p}
          </div>
        </div>
      `},S="",P=m.map((a,_)=>{let L="",G=a.created_at?new Date(a.created_at):null;if(G&&!Number.isNaN(G.getTime())){let R=Ct(G);R!==S&&(S=R,L=`<div class="chat-date-separator" role="separator"><span>${It(G)}</span></div>`)}return L+T(a,_)}).join(""),N=typeof Notification<"u"&&Notification.permission==="default"&&!sessionStorage.getItem("nexus_dismiss_notif_banner");return`
    <div class="inbox-workspace-100vh">
      <header class="inbox-compact-header">
        <div class="inbox-header-title-box" style="display:flex;align-items:center;gap:0.65rem;flex-wrap:wrap;">
          <h1 style="font-size:1.2rem;font-weight:700;margin:0;color:var(--text-primary);">Bandeja de mensajes</h1>
          ${s.wa_active_mode==="qr"?`<span id="inbox-wa-live-pill" class="tag-pill-minimal" style="--tag-color:${s.wa_qr_status==="connected"?"#10b981":"#f59e0b"};">
                  <span class="tag-dot" id="inbox-wa-live-dot"></span>
                  <span id="inbox-wa-live-label">${s.wa_qr_status==="connected"?"WhatsApp en vivo":s.wa_qr_status==="reconnecting"?"Reconectando...":"QR pendiente"}</span>
                </span>`:""}
        </div>

        <!-- Men\xFA Desplegable para PC con las Opciones de Bandeja -->
        <div class="inbox-pc-dropdown-wrapper">
          <button type="button" class="btn btn-secondary btn-sm" id="btn-inbox-pc-menu" style="gap:0.45rem;">
            ${l("sliders",14)}
            <span>Opciones</span>
            ${l("chevronDown",11)}
          </button>
          <div class="inbox-pc-dropdown-menu" id="inbox-pc-dropdown-menu" style="display:none;">
            <button type="button" class="inbox-dropdown-item js-opt-new-contact">
              ${l("plus",14)}
              <span>A\xF1adir contacto / Iniciar chat</span>
            </button>
            <button type="button" class="inbox-dropdown-item js-opt-sync-all">
              ${l("refresh",14)}
              <span>Sincronizar Todas las Redes</span>
            </button>
            <button type="button" class="inbox-dropdown-item js-opt-sync-wa">
              ${l("whatsapp",14)}
              <span>Sincronizar WhatsApp</span>
            </button>
            <button type="button" class="inbox-dropdown-item js-opt-sync-ig">
              ${l("instagram",14)}
              <span>Sincronizar Instagram Direct</span>
            </button>
            <button type="button" class="inbox-dropdown-item js-opt-sync-fb">
              ${l("facebook",14)}
              <span>Sincronizar Facebook</span>
            </button>
            <button type="button" class="inbox-dropdown-item js-opt-quick-replies">
              ${l("zap",14)}
              <span>Respuestas R\xE1pidas (/)</span>
            </button>
            <button type="button" class="inbox-dropdown-item js-opt-tags">
              ${l("tag",14)}
              <span>Etiquetas</span>
            </button>
            <div class="inbox-dropdown-divider"></div>
            <button type="button" class="inbox-dropdown-item js-opt-broadcast" style="color:var(--btn-bg);">
              ${l("megaphone",14)}
              <strong>Mensaje Masivo</strong>
            </button>
          </div>
        </div>
      </header>

      ${N?`
        <div class="inbox-notification-permission-banner" id="inbox-notification-banner">
          <div style="display:flex;align-items:center;gap:0.6rem;">
            <span class="inbox-notif-bell-icon">${l("bell",16)}</span>
            <div style="font-size:0.8rem;line-height:1.3;">
              <strong>Activa las notificaciones en tiempo real</strong>
              <span style="opacity:0.85;display:block;">Recibe alertas sonoras y emergentes en tu navegador o celular APK cuando lleguen nuevos mensajes.</span>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:0.4rem;">
            <button type="button" class="btn btn-primary btn-sm" id="btn-request-notif-permission">Activar</button>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-dismiss-notif-banner" title="Ocultar">${l("close",13)}</button>
          </div>
        </div>
      `:""}

      ${on(t.waSync)}

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
                    ${_t(a.id,18)}
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
              ${t.tags.map(a=>Re(a.name,t.tags,`interactive ${t.tagFilter.toLowerCase()===a.name.toLowerCase()?"active-filter":""} js-filter-tag`,`data-tag="${a.name}" role="button" tabindex="0"`)).join("")}
            </div>
          </div>

          <div class="inbox-conversations-list">
            ${w||(t.channelFilter==="facebook"?s.fb_connected?`
                    <div class="inbox-empty-channel-box">
                      <span class="empty-icon-circle fb">${l("facebook",30)}</span>
                      <strong>Sin chats descargados</strong>
                      <p>P\xE1gina "${s.fb_page_name||"Facebook"}" vinculada. Haz clic en sincronizar para descargar las conversaciones activas.</p>
                      <button type="button" class="btn btn-primary btn-sm js-opt-sync-fb" style="margin-top:0.35rem;">
                        ${l("refresh",14)} <span>Sincronizar Facebook</span>
                      </button>
                    </div>
                  `:`
                      <div class="inbox-empty-channel-box">
                        <span class="empty-icon-circle fb">${l("facebook",30)}</span>
                        <strong>Facebook no conectado</strong>
                        <p>Para recibir y responder mensajes de tu Fan Page comercial, con\xE9ctala en la pesta\xF1a de Conexiones.</p>
                        <button type="button" class="btn btn-primary btn-sm js-goto-connections" style="margin-top:0.35rem;">
                          ${l("settings",14)} <span>Configurar Facebook</span>
                        </button>
                      </div>
                    `:t.channelFilter==="instagram"?`
                    <div class="inbox-empty-channel-box">
                      <span class="empty-icon-circle ig">${l("instagram",30)}</span>
                      <strong>${s.ig_connected?"Sin mensajes de Instagram":"Instagram sin activar"}</strong>
                      <p>${s.ig_connected?"No hay mensajes directos nuevos registrados a\xFAn.":"Conecta tu cuenta profesional de Instagram en Configuraci\xF3n para atender DMs e historias."}</p>
                      ${s.ig_connected?`<button type="button" class="btn btn-primary btn-sm js-opt-sync-ig" style="margin-top:0.35rem;">
                              ${l("refresh",14)} <span>Sincronizar Instagram</span>
                            </button>`:`<button type="button" class="btn btn-primary btn-sm js-goto-connections" style="margin-top:0.35rem;">
                              ${l("settings",14)} <span>Configurar Instagram</span>
                            </button>`}
                    </div>
                  `:t.channelFilter==="tiktok"?`
                    <div class="inbox-empty-channel-box">
                      <span class="empty-icon-circle tt">${l("tiktok",30)}</span>
                      <strong>${s.tt_connected?"Sin mensajes de TikTok":"TikTok Business sin activar"}</strong>
                      <p>${s.tt_connected?"No hay mensajes o leads nuevos registrados a\xFAn.":"Conecta tu perfil comercial de TikTok en Configuraci\xF3n para atender mensajes y leads."}</p>
                      ${s.tt_connected?"":`<button type="button" class="btn btn-primary btn-sm js-goto-connections" style="margin-top:0.35rem;">
                              ${l("settings",14)} <span>Configurar TikTok</span>
                            </button>`}
                    </div>
                  `:t.channelFilter==="whatsapp"?s.wa_qr_status!=="connected"?`
                      <div class="inbox-empty-channel-box">
                        <span class="empty-icon-circle wa">${l("whatsapp",30)}</span>
                        <strong>WhatsApp no vinculado</strong>
                        <p>Escanea el c\xF3digo QR en Conexiones para vincular tu WhatsApp Normal o Business.</p>
                        <button type="button" class="btn btn-primary btn-sm js-goto-connections" style="margin-top:0.35rem;">
                          ${l("settings",14)} <span>Vincular WhatsApp</span>
                        </button>
                      </div>
                    `:`
                    <div class="inbox-empty-channel-box">
                      <span class="empty-icon-circle wa">${l("whatsapp",30)}</span>
                      <strong>WhatsApp Vinculado y Activo</strong>
                      <p>N\xFAmero vinculado: ${s.wa_qr_phone||"WhatsApp"}. Los mensajes entrantes o salientes se mostrar\xE1n aqu\xED en vivo.</p>
                      <div style="display:flex;gap:0.4rem;flex-wrap:wrap;justify-content:center;margin-top:0.35rem;">
                        <button type="button" class="btn btn-secondary btn-sm js-opt-sync-wa">
                          ${l("refresh",14)} <span>Sincronizar</span>
                        </button>
                        <button type="button" class="btn btn-primary btn-sm js-opt-new-contact">
                          ${l("plus",14)} <span>Iniciar Chat</span>
                        </button>
                      </div>
                    </div>
                  `:`
                  <div class="inbox-empty-sidebar" style="padding:2.5rem 1.25rem;text-align:center;color:var(--text-muted);font-size:0.84rem;display:flex;flex-direction:column;align-items:center;gap:0.75rem;">
                    <span style="opacity:0.55;color:var(--widget-accent);">${l("messageSquare",34)}</span>
                    <strong style="color:var(--text-primary);font-size:0.95rem;">Bandeja vac\xEDa</strong>
                    <span style="line-height:1.45;max-width:240px;">No hay conversaciones activas en este filtro.</span>
                    <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:0.5rem;margin-top:0.35rem;">
                      <button type="button" class="btn btn-primary btn-sm js-opt-new-contact">
                        ${l("plus",14)} <span>Iniciar Chat</span>
                      </button>
                      <button type="button" class="btn btn-secondary btn-sm js-opt-sync-all">
                        ${l("refresh",14)} <span>Sincronizar</span>
                      </button>
                    </div>
                  </div>
                `)}
          </div>
        </aside>

        <!-- Columna Derecha: Hilo de Mensajes, Compositor con Comandos / y Panel Lateral de Notas y Etiquetas -->
        <section class="chat-pane">
          ${i?`
            <div class="chat-contact-bar">
              <div style="display:flex;align-items:center;gap:0.55rem;min-width:0;">
                <button type="button" class="chat-mobile-back-btn js-chat-back-to-list" title="Regresar a la lista de chats">
                  ${l("arrowLeft",18)}
                </button>
                <div class="conv-avatar" style="background:${i.avatar_color};width:36px;height:36px;font-size:0.82rem;">
                  <span>${gt(i.contact_name,"WA")}</span>
                  <span class="conv-channel-badge ch-${i.channel}">
                    ${l(qt(i.channel),10)}
                  </span>
                </div>
                <div style="min-width:0;">
                  <div style="display:flex;align-items:center;gap:0.45rem;flex-wrap:wrap;">
                    <strong style="font-size:0.92rem;">${i.contact_name}</strong>
                    <span style="font-size:0.74rem;color:var(--text-muted);">(${i.contact_handle})</span>
                    ${f?`<span class="tag-pill-minimal" style="--tag-color:#10b981;" title="Agente responsable asignado">
                            <span class="tag-dot"></span>
                            <span>Agente: ${f.full_name.split(" ")[0]}</span>
                          </span>`:""}
                  </div>
                  <div style="display:flex;align-items:center;gap:0.3rem;flex-wrap:wrap;margin-top:0.2rem;">
                    ${h.length>0?h.map(a=>Re(a,t.tags)).join(""):'<span style="font-size:0.71rem;color:var(--text-muted);">Sin etiquetas asignadas</span>'}
                  </div>
                </div>
              </div>

              <div class="chat-contact-actions">
                <button
                  type="button"
                  class="chat-header-action-btn ${(je.get(i.id)||"bot")==="bot"?"active":""}"
                  id="btn-toggle-conv-bot-mode"
                  data-conv-id="${i.id}"
                  data-can-create="${n?"1":"0"}"
                  data-mode="${je.get(i.id)||"bot"}"
                  title="Cambiar modo Bot / Humano en esta conversaci\xF3n"
                >
                  ${l("bot",15)}
                  <span class="chat-btn-label-desktop" id="conv-bot-mode-label">${je.get(i.id)==="human"?"Humano":je.get(i.id)==="paused"?"Pausado":"Bot"}</span>
                </button>
                <button
                  type="button"
                  class="chat-header-action-btn"
                  id="btn-open-bot-studio"
                  title="Configurar Bot y Base de Conocimientos"
                >
                  ${l("sparkles",15)}
                  <span class="chat-btn-label-desktop">Bot & KB</span>
                </button>
                <button
                  type="button"
                  class="chat-header-action-btn ${t.messageSearch?.open?"active":""}"
                  id="btn-toggle-chat-search"
                  title="Buscar en la conversaci\xF3n"
                  aria-label="Buscar en la conversaci\xF3n"
                  aria-expanded="${t.messageSearch?.open?"true":"false"}"
                >
                  ${l("search",15)}
                  <span class="chat-btn-label-desktop">Buscar</span>
                </button>
                <button
                  type="button"
                  class="chat-header-action-btn ${t.sideDrawerTab==="tags"?"active":""}"
                  id="btn-toggle-side-drawer-tags"
                  title="Etiquetas (${h.length})"
                  aria-label="Etiquetas de la conversaci\xF3n"
                >
                  ${l("tag",15)}
                  <span class="chat-btn-label-desktop">Etiquetas (${h.length})</span>
                  ${h.length>0?`<span class="chat-btn-badge-mobile">${h.length}</span>`:""}
                </button>
                <button
                  type="button"
                  class="chat-header-action-btn ${t.sideDrawerTab==="notes"?"active":""}"
                  id="btn-toggle-side-drawer-notes"
                  title="Notas Aparte (${u.length})"
                  aria-label="Notas internas del cliente"
                >
                  ${l("stickyNote",15)}
                  <span class="chat-btn-label-desktop">Notas Aparte (${u.length})</span>
                  ${u.length>0?`<span class="chat-btn-badge-mobile">${u.length}</span>`:""}
                </button>
              </div>
            </div>

            <!-- Cuerpo dividido: Mensajes + Drawer Lateral (Notas Aparte / Etiquetas) -->
            <div class="chat-body-split">
              <div class="chat-main-column" id="chat-main-column">
                <!-- Dropzone Overlay para Arrastrar y Soltar Archivos (Fotos, Videos, Audios, Docs) -->
                <div class="chat-dropzone-overlay" id="chat-dropzone-overlay" style="display:none;">
                  <div class="chat-dropzone-inner">
                    ${l("uploadCloud",42)}
                    <h4>Suelte aqu\xED sus archivos</h4>
                    <p>Arrastre im\xE1genes, notas de audio, videos o documentos para enviar a este chat</p>
                  </div>
                </div>

                ${t.messageSearch?.open?`<div class="chat-search-bar" role="search">
                        <label for="chat-search-input" class="visually-hidden-label">Buscar en la conversaci\xF3n</label>
                        ${l("search",14)}
                        <input type="search" id="chat-search-input" class="chat-search-input" placeholder="Buscar en los mensajes cargados\u2026" value="${q(t.messageSearch.query||"")}" autocomplete="off" />
                        <span class="chat-search-count" id="chat-search-count" aria-live="polite"></span>
                        <button type="button" class="chat-search-nav" id="btn-chat-search-prev" aria-label="Resultado anterior">${l("chevronUp",15)}</button>
                        <button type="button" class="chat-search-nav" id="btn-chat-search-next" aria-label="Resultado siguiente">${l("chevronDown",15)}</button>
                        <button type="button" class="chat-search-nav" id="btn-chat-search-close" aria-label="Cerrar b\xFAsqueda">${l("close",15)}</button>
                      </div>`:""}
                <div class="chat-messages-scroller" id="chat-messages-scroller">
                  ${m.length>=(t.messageLimit||250)?`<div class="chat-load-older-row"><button type="button" class="chat-load-older-btn js-load-older">${l("clock",13)}<span>Cargar mensajes anteriores</span></button></div>`:""}
                  ${P}
                </div>

                <!-- Contenedor del Compositor y Popover Flotante Slash (/) -->
                <div class="chat-composer-area">
                  <button type="button" class="chat-jump-bottom" id="chat-jump-bottom" style="display:none;" aria-label="Ir al \xFAltimo mensaje">
                    ${l("chevronDown",16)}
                    <span class="chat-jump-bottom-count" style="display:none;"></span>
                  </button>
                  <!-- Men\xFA flotante de Respuestas R\xE1pidas al escribir / -->
                  <div class="slash-command-popover" id="slash-command-popover" style="display:none;">
                    <div class="slash-command-header">
                      <span><strong>Respuestas Autom\xE1ticas / R\xE1pidas</strong> \u2014 Clic o Enter para usar</span>
                      <button type="button" class="btn btn-secondary btn-sm" id="btn-popover-manage-qr" style="padding:0.15rem 0.5rem;font-size:0.7rem;">
                        ${l("plus",11)}
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
                          ${l("cornerUpLeft",13)}
                          <span>Respondiendo a <strong>${q(t.replyingTo.sender)}</strong></span>
                        </div>
                        <div class="chat-reply-preview-text">
                          ${t.replyingTo.media_type==="image"||t.replyingTo.media_url&&!t.replyingTo.body?`<span style="display:inline-flex;align-items:center;gap:0.25rem;font-weight:600;">${l("image",12)} Foto:</span> `:""}${q(t.replyingTo.body||(t.replyingTo.media_type==="image"?"Foto":""))}
                        </div>
                      </div>
                      <button type="button" class="chat-reply-cancel-btn js-cancel-reply" title="Cancelar respuesta">
                        ${l("close",15)}
                      </button>
                    </div>
                  `:""}

                  ${t.pendingAttachment?`
                    <div class="composer-media-preview-bar">
                      ${t.pendingAttachment.media_type==="audio"?`<audio class="composer-attach-audio" controls preload="metadata" src="${t.pendingAttachment.media_url}"></audio>`:t.pendingAttachment.media_type==="video"?`<video class="composer-attach-thumb" muted playsinline preload="metadata" src="${t.pendingAttachment.media_url}"></video>`:t.pendingAttachment.media_type==="image"||t.pendingAttachment.media_type==="sticker"?`<img class="composer-attach-thumb" alt="" src="${t.pendingAttachment.media_url}" />`:""}
                      <div style="display:flex;align-items:center;gap:0.5rem;overflow:hidden;">
                        <span class="tag-pill-minimal" style="--tag-color:var(--widget-accent);">
                          ${l(xt(t.pendingAttachment.media_type),12)}
                          <span>${Ge(t.pendingAttachment.media_type)} listo para enviar</span>
                        </span>
                        <strong style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                          ${t.pendingAttachment.media_filename}
                        </strong>
                      </div>
                      <button type="button" class="btn btn-secondary btn-sm" id="btn-clear-pending-media" style="padding:0.15rem 0.45rem;">
                        ${l("close",13)}
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

                  ${(()=>{let _=(i?je.get(i.id)||"bot":"human")==="bot",L=!n||_?"disabled":"",G=_?"Bot activo en este chat \u2014 cambie a Humano para escribir...":"Mensaje...";return`
                  <form id="chat-composer-form" class="chat-composer-form ${_?"is-bot-locked":""}">
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
                      ${L}
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
                      ${L}
                    >
                      ${l("paperclip",18)}
                    </button>

                    <label for="chat-composer-input" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);">
                      Escribir mensaje para ${i.contact_name}
                    </label>
                    <textarea
                      id="chat-composer-input"
                      class="chat-composer-textarea"
                      rows="1"
                      placeholder="${G}"
                      ${L}
                    ></textarea>

                    <!-- Bot\xF3n de Acci\xF3n estilo WhatsApp: Micr\xF3fono cuando est\xE1 vac\xEDo / Enviar con \xEDcono cuando tiene texto -->
                    <button
                      type="submit"
                      class="chat-action-btn ${t.pendingAttachment?"is-send":"is-mic"}"
                      id="btn-chat-action"
                      title="${t.pendingAttachment?"Enviar mensaje":"Grabar nota de voz"}"
                      ${L}
                    >
                      <span class="chat-action-icon-send" style="display:${t.pendingAttachment?"inline-flex":"none"};">
                        ${l("send",17)}
                      </span>
                      <span class="chat-action-icon-mic" style="display:${t.pendingAttachment?"none":"inline-flex"};">
                        ${l("mic",18)}
                      </span>
                    </button>
                  </form>`})()}
                </div>
              </div>

              ${t.sideDrawerTab==="notes"?`
                <!-- BACKDROP T\xC1CTIL M\xD3VIL Y PANEL BOTTOM SHEET: NOTAS APARTE -->
                <div class="chat-side-drawer-backdrop" id="chat-side-drawer-backdrop" title="Tocar para cerrar"></div>
                <aside class="chat-side-drawer open" aria-label="Notas internas de la conversaci\xF3n">
                  <div class="chat-side-drawer-handle"></div>
                  <div class="chat-side-drawer-header">
                    <strong style="font-size:0.88rem;display:inline-flex;align-items:center;gap:0.4rem;">
                      ${l("stickyNote",15)}
                      <span>Notas Aparte del Cliente</span>
                    </strong>
                    <button type="button" class="btn btn-secondary btn-sm" id="btn-close-side-drawer" style="padding:0.25rem 0.5rem;" title="Cerrar">
                      ${l("close",13)}
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
                        ${l("plus",13)}
                        <span>Guardar Nota</span>
                      </button>
                    </form>

                    <div style="display:flex;flex-direction:column;gap:0.6rem;margin-top:0.25rem;">
                      ${u.length>0?u.map(a=>`
                              <div class="note-card-item">
                                <div style="display:flex;align-items:center;justify-content:space-between;gap:0.4rem;font-size:0.69rem;color:var(--text-muted);">
                                  <strong>${a.author_name}</strong>
                                  <div style="display:inline-flex;align-items:center;gap:0.25rem;">
                                    <button type="button" class="btn btn-secondary btn-sm js-edit-conv-note" data-note-id="${a.id}" style="padding:0.1rem 0.3rem;" title="Editar nota">
                                      ${l("edit",11)}
                                    </button>
                                    <button type="button" class="btn btn-danger btn-sm js-delete-conv-note" data-note-id="${a.id}" style="padding:0.1rem 0.3rem;" title="Eliminar nota">
                                      ${l("trash",11)}
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
                      ${l("tag",15)}
                      <span>Etiquetas y Asignaci\xF3n</span>
                    </strong>
                    <button type="button" class="btn btn-secondary btn-sm" id="btn-close-side-drawer" style="padding:0.25rem 0.5rem;" title="Cerrar">
                      ${l("close",13)}
                    </button>
                  </div>
                  <div class="chat-side-drawer-body">
                    <div>
                      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.45rem;">
                        <span style="font-size:0.74rem;font-weight:700;text-transform:uppercase;color:var(--text-muted);">
                          Etiquetas de este Chat
                        </span>
                        <button type="button" class="btn btn-secondary btn-sm" id="btn-drawer-open-tag-crud" style="padding:0.15rem 0.45rem;font-size:0.7rem;">
                          ${l("plus",11)}
                          <span>Crear / Editar</span>
                        </button>
                      </div>
                      <p style="font-size:0.74rem;color:var(--text-muted);margin-bottom:0.55rem;">
                        Toque una etiqueta para asignarla o quitarla de <strong>${i.contact_name}</strong>:
                      </p>
                      <div style="display:flex;flex-wrap:wrap;gap:0.38rem;">
                        ${t.tags.map(a=>{let _=h.some(L=>L.toLowerCase()===a.name.toLowerCase());return Re(a.name,t.tags,`interactive ${_?"active-filter":""} js-toggle-conv-tag`,`data-tag-name="${a.name}" role="button" tabindex="0"`)}).join("")}
                      </div>
                    </div>

                    <div style="padding-top:0.75rem;border-top:1px dashed var(--widget-border);">
                      <label class="form-label" for="conv-assigned-user-select" style="font-size:0.74rem;text-transform:uppercase;color:var(--text-muted);">
                        Usuario / Agente Responsable del Chat
                      </label>
                      <select id="conv-assigned-user-select" class="form-select" style="margin-top:0.35rem;font-size:0.8rem;padding:0.4rem 0.6rem;">
                        <option value="">\u2014 Sin agente asignado \u2014</option>
                        ${t.users.map(a=>`<option value="${a.id}" ${i.assigned_user_id===a.id?"selected":""}>${a.full_name} (${a.role_name||"Agente"})</option>`).join("")}
                      </select>
                    </div>

                    <div style="padding-top:0.75rem;border-top:1px dashed var(--widget-border);">
                      <span style="font-size:0.74rem;font-weight:700;text-transform:uppercase;color:var(--text-muted);display:block;margin-bottom:0.45rem;">
                        Etiquetas por Usuario del Equipo
                      </span>
                      <div style="display:flex;flex-direction:column;gap:0.65rem;">
                        ${t.users.map(a=>{let _=Ie(a.tags_json);return`
                              <div style="padding:0.55rem 0.65rem;border-radius:0.65rem;background:var(--page-bg);border:1px solid var(--widget-border);">
                                <div style="display:flex;align-items:center;justify-content:space-between;gap:0.4rem;margin-bottom:0.35rem;">
                                  <strong style="font-size:0.78rem;">${a.full_name}</strong>
                                  <button type="button" class="btn btn-secondary btn-sm js-manage-user-tags" data-user-id="${a.id}" style="padding:0.1rem 0.4rem;font-size:0.68rem;">
                                    ${l("tag",10)}
                                    <span>Asignar</span>
                                  </button>
                                </div>
                                <div style="display:flex;flex-wrap:wrap;gap:0.25rem;">
                                  ${_.length>0?_.map(L=>Re(L,t.tags)).join(""):'<span style="font-size:0.7rem;color:var(--text-muted);">Sin etiquetas</span>'}
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
                    ${t.channelFilter==="facebook"?l("facebook",44):t.channelFilter==="instagram"?l("instagram",44):t.channelFilter==="tiktok"?l("tiktok",44):l("messageSquare",44)}
                  </div>
                  <div class="inbox-welcome-badge">
                    ${l("check",14)}
                  </div>
                </div>

                <h2 class="inbox-welcome-title">
                  ${t.channelFilter==="facebook"?"Bandeja de Facebook Messenger":t.channelFilter==="instagram"?"Bandeja de Instagram Direct":t.channelFilter==="tiktok"?"Bandeja de TikTok Business":t.channelFilter==="whatsapp"?"Bandeja de WhatsApp":"Empieza tu chat ahora"}
                </h2>
                <p class="inbox-welcome-subtitle">
                  ${t.channelFilter==="facebook"?`Atiende los mensajes y comentarios de ${s.fb_page_name||"tu Fan Page comercial"} en tiempo real.`:t.channelFilter==="instagram"?"Gestiona mensajes directos, menciones y respuestas de historias de Instagram.":t.channelFilter==="tiktok"?"Gestiona prospectos de TikTok Ads y mensajes directos comerciales.":"Env\xEDa y recibe mensajes omnicanal sin mantener tu tel\xE9fono conectado. Selecciona una conversaci\xF3n de la lista o inicia una nueva."}
                </p>

                <div class="inbox-welcome-actions">
                  <button type="button" class="btn btn-primary js-opt-new-contact" id="btn-welcome-new-chat">
                    ${l("plus",15)}
                    <span>A\xF1adir contacto / Iniciar chat</span>
                  </button>
                  ${t.channelFilter==="instagram"?`
                    <button type="button" class="btn btn-secondary js-opt-sync-ig">
                      ${l("instagram",15)}
                      <span>Sincronizar Instagram</span>
                    </button>
                    `:t.channelFilter==="facebook"?`
                    <button type="button" class="btn btn-secondary js-opt-sync-fb">
                      ${l("facebook",15)}
                      <span>Sincronizar Facebook</span>
                    </button>
                    `:t.channelFilter==="whatsapp"?`
                    <button type="button" class="btn btn-secondary js-opt-sync-wa">
                      ${l("whatsapp",15)}
                      <span>Sincronizar WhatsApp</span>
                    </button>
                    `:`
                    <button type="button" class="btn btn-secondary js-opt-sync-all">
                      ${l("refresh",15)}
                      <span>Sincronizar Todas las Redes</span>
                    </button>
                    `}
                  <button type="button" class="btn btn-secondary js-opt-broadcast">
                    ${l("megaphone",15)}
                    <span>Enviar Mensaje Masivo</span>
                  </button>
                </div>

                <div class="inbox-welcome-security-note">
                  ${l("lock",13)}
                  <span>Tus mensajes personales y de clientes est\xE1n protegidos con cifrado y trazabilidad oficial.</span>
                </div>
              </div>
            `}
        </section>
      </div>

      <!-- Bot\xF3n Flotante para M\xF3vil (FAB de Opciones de Bandeja) -->
      <button type="button" class="inbox-mobile-fab" id="btn-inbox-mobile-fab" aria-label="Opciones de Bandeja" title="Opciones de Bandeja">
        ${l("sliders",22)}
      </button>

      <!-- Bottom Sheet de Opciones para M\xF3vil -->
      <div class="inbox-mobile-sheet-overlay" id="inbox-mobile-sheet-overlay" style="display:none;">
        <div class="inbox-mobile-sheet">
          <div class="inbox-mobile-sheet-handle"></div>
          <div class="inbox-mobile-sheet-title">
            <strong style="font-size:0.95rem;">Opciones de Bandeja</strong>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-close-mobile-sheet" style="padding:0.2rem 0.45rem;">
              ${l("close",14)}
            </button>
          </div>
          <div class="inbox-mobile-sheet-items">
            <button type="button" class="inbox-sheet-btn js-opt-new-contact">
              <span class="inbox-sheet-icon" style="background:rgba(16,185,129,0.15);color:#10b981;">${l("plus",18)}</span>
              <div style="text-align:left;">
                <strong>A\xF1adir contacto / Iniciar chat</strong>
                <p>Comenzar conversaci\xF3n con un nuevo n\xFAmero o cliente</p>
              </div>
            </button>
            <button type="button" class="inbox-sheet-btn js-opt-sync-all">
              <span class="inbox-sheet-icon" style="background:rgba(99,102,241,0.15);color:#6366f1;">${l("refresh",18)}</span>
              <div style="text-align:left;">
                <strong>Sincronizar Todas las Redes</strong>
                <p>Descargar chats de WhatsApp, Instagram y Facebook</p>
              </div>
            </button>
            <button type="button" class="inbox-sheet-btn js-opt-sync-wa">
              <span class="inbox-sheet-icon" style="background:rgba(59,130,246,0.15);color:#3b82f6;">${l("whatsapp",18)}</span>
              <div style="text-align:left;">
                <strong>Sincronizar WhatsApp</strong>
                <p>Descargar \xFAltimos chats de WhatsApp Normal y Business</p>
              </div>
            </button>
            <button type="button" class="inbox-sheet-btn js-opt-sync-ig">
              <span class="inbox-sheet-icon" style="background:rgba(225,48,108,0.15);color:#e1306c;">${l("instagram",18)}</span>
              <div style="text-align:left;">
                <strong>Sincronizar Instagram Direct</strong>
                <p>Descargar DMs de tu cuenta comercial @romaagenciape</p>
              </div>
            </button>
            <button type="button" class="inbox-sheet-btn js-opt-sync-fb">
              <span class="inbox-sheet-icon" style="background:rgba(37,99,235,0.15);color:#2563eb;">${l("facebook",18)}</span>
              <div style="text-align:left;">
                <strong>Sincronizar Facebook</strong>
                <p>Descargar chats de tu Fan Page comercial</p>
              </div>
            </button>
            <button type="button" class="inbox-sheet-btn js-opt-quick-replies">
              <span class="inbox-sheet-icon" style="background:rgba(245,158,11,0.15);color:#f59e0b;">${l("zap",18)}</span>
              <div style="text-align:left;">
                <strong>Respuestas R\xE1pidas (/)</strong>
                <p>Crear, editar o usar plantillas con multimedia</p>
              </div>
            </button>
            <button type="button" class="inbox-sheet-btn js-opt-tags">
              <span class="inbox-sheet-icon" style="background:rgba(16,185,129,0.15);color:#10b981;">${l("tag",18)}</span>
              <div style="text-align:left;">
                <strong>Gestor de Etiquetas</strong>
                <p>Organizar chats de clientes y agentes</p>
              </div>
            </button>
            <button type="button" class="inbox-sheet-btn js-opt-broadcast">
              <span class="inbox-sheet-icon" style="background:rgba(99,102,241,0.15);color:#6366f1;">${l("megaphone",18)}</span>
              <div style="text-align:left;">
                <strong>Mensaje Masivo</strong>
                <p>Difusi\xF3n a listas de contactos y etiquetas</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  `}function Pe(t){let{sub:e,apiFetch:n,refreshInbox:s,editingItem:r,onSelect:i}=t,m=document.getElementById("global-form-dialog");if(!m)return;let u=r?.media_url||"",h=r?.media_filename||"",f=r?.media_mimetype||"";(()=>{let T=m.querySelector("#qr-media-type")?.value||r?.media_type||"none";m.innerHTML=`
      <div class="crm-form-modal-surface" style="max-width:740px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
          <div>
            <h3 id="form-dialog-title" style="font-size:1.15rem;display:flex;align-items:center;gap:0.5rem;">
              ${l("zap",18)}
              <span>Respuestas Autom\xE1ticas / R\xE1pidas con Comando <code>/</code></span>
            </h3>
            <p style="font-size:0.8rem;color:var(--text-muted);">
              Cree respuestas con texto, audio, video, documento o foto. Al escribir <code>/</code> en el chat podr\xE1 enviarlas directo al WhatsApp del cliente.
            </p>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" id="close-qr-manager">
            ${l("close",16)}
          </button>
        </div>

        <!-- Formulario para Crear o Editar Respuesta R\xE1pida -->
        <form id="quick-reply-crud-form" style="padding:1rem;border-radius:0.85rem;background:var(--surface-subtle);border:1px solid var(--widget-border);margin-bottom:1.15rem;display:flex;flex-direction:column;gap:0.85rem;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <strong style="font-size:0.88rem;">
              ${r?`Editando comando /${r.shortcut}`:"Nueva Respuesta Autom\xE1tica (/)"}
            </strong>
            ${r?'<button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-edit-qr">Cancelar edici\xF3n</button>':""}
          </div>

          <div class="config-grid-3">
            <div class="form-group">
              <label class="form-label" for="qr-shortcut">Comando (sin /) *</label>
              <input type="text" id="qr-shortcut" class="form-control" placeholder="ej. catalogo" value="${r?.shortcut||""}" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="qr-title">T\xEDtulo descriptivo *</label>
              <input type="text" id="qr-title" class="form-control" placeholder="ej. Cat\xE1logo PDF 2026" value="${r?.title||""}" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="qr-media-type">Tipo de Adjunto a Enviar</label>
              <select id="qr-media-type" class="form-select">
                <option value="none" ${T==="none"?"selected":""}>Solo Texto</option>
                <option value="image" ${T==="image"?"selected":""}>Foto / Imagen</option>
                <option value="video" ${T==="video"?"selected":""}>Video (MP4)</option>
                <option value="audio" ${T==="audio"?"selected":""}>Audio / Nota de Voz</option>
                <option value="document" ${T==="document"?"selected":""}>Documento (PDF / Office)</option>
              </select>
            </div>
          </div>

          <div class="form-group" id="qr-media-upload-row" style="display:${T==="none"?"none":"flex"};flex-direction:column;gap:0.45rem;">
            <label class="form-label" for="qr-media-file">Subir archivo de ${Ge(T)} (se enviar\xE1 por WhatsApp)</label>
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
            <textarea id="qr-body" class="form-control" rows="2" placeholder="Escriba el texto que acompa\xF1ar\xE1 a esta respuesta r\xE1pida..." required>${r?.body||""}</textarea>
          </div>

          <div style="display:flex;justify-content:flex-end;">
            <button type="submit" class="btn btn-primary btn-sm">
              ${l("save",14)}
              <span>${r?"Actualizar Respuesta (/)":"Guardar Nueva Respuesta (/)"}</span>
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
                            ${l(xt(a.media_type),11)}
                            <span>${Ge(a.media_type)}: ${a.media_filename||"Adjunto"}</span>
                          </span>`:""}
                  </div>
                  <p style="font-size:0.78rem;color:var(--text-secondary);margin-top:0.2rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                    ${a.body}
                  </p>
                </div>
                <div style="display:flex;align-items:center;gap:0.35rem;flex:none;">
                  ${i?`
                    <button type="button" class="btn btn-primary btn-sm js-modal-use-qr" data-id="${a.id}" style="padding:0.25rem 0.65rem;" title="Insertar esta respuesta en el chat activo">
                      ${l("send",12)}
                      <span>Usar</span>
                    </button>
                  `:""}
                  <button type="button" class="btn btn-secondary btn-sm js-modal-edit-qr" data-id="${a.id}">
                    ${l("edit",13)}
                  </button>
                  <button type="button" class="btn btn-danger btn-sm js-modal-delete-qr" data-id="${a.id}" data-shortcut="${a.shortcut}">
                    ${l("trash",13)}
                  </button>
                </div>
              </div>
            `).join("")}
        </div>
      </div>
    `,m.querySelectorAll(".js-modal-use-qr").forEach(a=>{a.addEventListener("click",()=>{let _=Number(a.getAttribute("data-id")),L=e.quickReplies.find(G=>G.id===_);L&&i&&(i(L),m.close())})}),m.querySelector("#close-qr-manager")?.addEventListener("click",()=>m.close()),m.querySelector("#btn-cancel-edit-qr")?.addEventListener("click",()=>{Pe({sub:e,apiFetch:n,refreshInbox:s,onSelect:i})});let S=m.querySelector("#qr-media-type"),P=m.querySelector("#qr-media-upload-row");S?.addEventListener("change",()=>{P&&(P.style.display=S.value==="none"?"none":"flex")});let N=m.querySelector("#qr-media-file");N?.addEventListener("change",async()=>{let a=N.files?.[0];if(!a)return;u=await it(a),h=a.name,f=a.type||"application/octet-stream";let _=m.querySelector("#qr-media-status-badge");_&&(_.innerHTML=`<span class="tag-dot"></span><span>Cargado: ${h}</span>`)}),m.querySelector("#quick-reply-crud-form")?.addEventListener("submit",async a=>{a.preventDefault();let _=m.querySelector("#qr-shortcut").value.trim(),L=m.querySelector("#qr-title").value.trim(),G=m.querySelector("#qr-body").value.trim(),R=m.querySelector("#qr-media-type").value;if(R!=="none"&&!u){$("Suba un archivo multimedia",`Seleccione un archivo de ${Ge(R)} o cambie el tipo a "Solo Texto".`,"warning");return}try{let j={shortcut:_,title:L,body:G,media_type:R,media_url:R==="none"?"":u,media_filename:R==="none"?"":h,media_mimetype:R==="none"?"":f};r?(await n(`/api/inbox/quick-replies/${r.id}`,{method:"PUT",body:JSON.stringify(j)}),$("Respuesta actualizada",`El comando /${_} fue actualizado.`,"success")):(await n("/api/inbox/quick-replies",{method:"POST",body:JSON.stringify(j)}),$("Respuesta creada",`El comando /${_} ya est\xE1 disponible con /.`,"success")),await s(),Pe({sub:e,apiFetch:n,refreshInbox:s})}catch(j){$("Error guardando respuesta",j.message,"danger")}}),m.querySelectorAll(".js-modal-edit-qr").forEach(a=>{a.addEventListener("click",()=>{let _=Number(a.getAttribute("data-id")),L=e.quickReplies.find(G=>G.id===_);L&&Pe({sub:e,apiFetch:n,refreshInbox:s,editingItem:L})})}),m.querySelectorAll(".js-modal-delete-qr").forEach(a=>{a.addEventListener("click",async()=>{let _=Number(a.getAttribute("data-id")),L=a.getAttribute("data-shortcut")||"";try{await n(`/api/inbox/quick-replies/${_}`,{method:"DELETE"}),$("Respuesta eliminada",`Se elimin\xF3 /${L}.`,"info"),await s(),Pe({sub:e,apiFetch:n,refreshInbox:s})}catch(G){$("Error al eliminar",G.message,"danger")}})})})(),m.open||m.showModal()}function Xe(t){let{sub:e,apiFetch:n,refreshInbox:s,editingTag:r}=t,i=document.getElementById("global-form-dialog");if(!i)return;i.innerHTML=`
    <div class="crm-form-modal-surface" style="max-width:620px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
        <div>
          <h3 id="form-dialog-title" style="font-size:1.15rem;display:flex;align-items:center;gap:0.5rem;">
            ${l("tag",18)}
            <span>Gestor de Etiquetas Modernas Minimalistas</span>
          </h3>
          <p style="font-size:0.8rem;color:var(--text-muted);">
            Dise\xF1adas con borde sutil y punto de color para no saturar visualmente los chats ni las tablas de usuarios.
          </p>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" id="close-tags-manager">
          ${l("close",16)}
        </button>
      </div>

      <form id="tag-crud-form" style="padding:0.95rem;border-radius:0.85rem;background:var(--surface-subtle);border:1px solid var(--widget-border);margin-bottom:1.1rem;display:flex;flex-wrap:wrap;align-items:flex-end;gap:0.75rem;">
        <div class="form-group" style="flex:1;min-width:180px;">
          <label class="form-label" for="tag-crud-name">Nombre de la Etiqueta *</label>
          <input type="text" id="tag-crud-name" class="form-control" placeholder="Ej. Cliente Mayorista" value="${r?.name||""}" required />
        </div>
        <div class="form-group" style="width:130px;">
          <label class="form-label" for="tag-crud-color">Color del Punto</label>
          <div class="color-picker-row" style="padding:0.25rem 0.5rem;">
            <input type="color" id="tag-crud-color" value="${r?.color||"#10b981"}" style="width:28px;height:28px;" />
            <input type="text" id="tag-crud-color-txt" value="${r?.color||"#10b981"}" readonly style="font-size:0.78rem;" />
          </div>
        </div>
        <div class="form-group" style="width:140px;">
          <label class="form-label" for="tag-crud-scope">\xC1mbito</label>
          <select id="tag-crud-scope" class="form-select">
            <option value="both" ${r?.scope==="both"?"selected":""}>Chats y Usuarios</option>
            <option value="chat" ${r?.scope==="chat"?"selected":""}>Solo Chats</option>
            <option value="user" ${r?.scope==="user"?"selected":""}>Solo Usuarios</option>
          </select>
        </div>
        <button type="submit" class="btn btn-primary btn-sm" style="height:38px;">
          ${l("save",14)}
          <span>${r?"Actualizar":"Crear Etiqueta"}</span>
        </button>
      </form>

      <div style="display:flex;flex-direction:column;gap:0.45rem;max-height:280px;overflow-y:auto;">
        ${e.tags.map(h=>`
            <div style="display:flex;align-items:center;justify-content:space-between;padding:0.55rem 0.8rem;border-radius:0.7rem;background:var(--page-bg);border:1px solid var(--widget-border);">
              <div style="display:flex;align-items:center;gap:0.65rem;">
                ${Re(h.name,e.tags)}
                <span style="font-size:0.72rem;color:var(--text-muted);">
                  ${h.scope==="chat"?"Chats":h.scope==="user"?"Usuarios":"Chats y Usuarios"}
                </span>
              </div>
              <div style="display:flex;align-items:center;gap:0.35rem;">
                <button type="button" class="btn btn-secondary btn-sm js-edit-tag-item" data-id="${h.id}">
                  ${l("edit",12)}
                </button>
                <button type="button" class="btn btn-danger btn-sm js-delete-tag-item" data-id="${h.id}" data-name="${h.name}">
                  ${l("trash",12)}
                </button>
              </div>
            </div>
          `).join("")}
      </div>
    </div>
  `,i.querySelector("#close-tags-manager")?.addEventListener("click",()=>i.close());let m=i.querySelector("#tag-crud-color"),u=i.querySelector("#tag-crud-color-txt");m?.addEventListener("input",()=>{u&&(u.value=m.value)}),i.querySelector("#tag-crud-form")?.addEventListener("submit",async h=>{h.preventDefault();let f=i.querySelector("#tag-crud-name").value.trim(),w=m?.value||"#6366f1",T=i.querySelector("#tag-crud-scope").value;try{r?(await n(`/api/inbox/tags/${r.id}`,{method:"PUT",body:JSON.stringify({name:f,color:w,scope:T})}),$("Etiqueta actualizada",`Se actualiz\xF3 "${f}".`,"success")):(await n("/api/inbox/tags",{method:"POST",body:JSON.stringify({name:f,color:w,scope:T})}),$("Etiqueta creada",`La etiqueta "${f}" est\xE1 lista para usarse.`,"success")),await s(),Xe({sub:e,apiFetch:n,refreshInbox:s})}catch(S){$("Error guardando etiqueta",S.message,"danger")}}),i.querySelectorAll(".js-edit-tag-item").forEach(h=>{h.addEventListener("click",()=>{let f=Number(h.getAttribute("data-id")),w=e.tags.find(T=>T.id===f);w&&Xe({sub:e,apiFetch:n,refreshInbox:s,editingTag:w})})}),i.querySelectorAll(".js-delete-tag-item").forEach(h=>{h.addEventListener("click",async()=>{let f=Number(h.getAttribute("data-id"));try{await n(`/api/inbox/tags/${f}`,{method:"DELETE"}),await s(),Xe({sub:e,apiFetch:n,refreshInbox:s})}catch(w){$("Error al eliminar etiqueta",w.message,"danger")}})}),i.open||i.showModal()}function Ft(t,e){if(!t)return'<div class="crm-widget">Cargando configuraci\xF3n de conexiones...</div>';let n=e?"":"disabled",s=t.wa_active_mode==="qr",r=`${window.location.origin}/api/webhooks/omnichannel`;return`
    <div style="display:flex;flex-direction:column;gap:1.5rem;">
      <!-- 1. ARQUITECTURA DUAL DE WHATSAPP: SERVIDOR QR (WHATSAPP NORMAL O BUSINESS) VS WHATSAPP CLOUD API -->
      <div class="crm-widget crm-widget-accent-top">
        <div style="display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:1.15rem;">
          <div>
            <h3 style="font-size:1.15rem;display:flex;align-items:center;gap:0.5rem;">
              ${l("whatsapp",20)}
              <span>Conexi\xF3n de WhatsApp (Normal y Business) \u2014 Selector de Modalidad</span>
            </h3>
            <p style="font-size:0.84rem;color:var(--text-muted);margin-top:0.2rem;">
              Compatible con <strong>WhatsApp Business</strong> y <strong>WhatsApp Normal</strong>. Sincroniza autom\xE1ticamente todos sus chats existentes y mensajes entrantes/salientes.
            </p>
          </div>
          <span class="badge">
            Modalidad Activa: ${s?"Servidor QR Interno (WhatsApp Normal / Business)":"WhatsApp Cloud API (Masivos y Chatbot)"}
          </span>
        </div>

        <!-- Selector de las 2 modalidades de WhatsApp -->
        <div class="wa-mode-selector-grid">
          <button type="button" class="wa-mode-card ${s?"active":""} js-select-wa-mode" data-mode="qr" ${n}>
            <div style="display:flex;align-items:center;justify-content:space-between;width:100%;">
              <strong style="font-size:0.98rem;display:inline-flex;align-items:center;gap:0.5rem;color:var(--text-primary);">
                ${l("qrCode",18)}
                <span>Opci\xF3n 1: Servidor QR Interno (WhatsApp Normal o Business)</span>
              </strong>
              ${s?`<span class="micro-perm-pill on">${l("check",12)} <span>Activo</span></span>`:""}
            </div>
            <p style="font-size:0.8rem;color:var(--text-secondary);line-height:1.45;">
              Ideal para sincronizar todos sus chats de <strong>WhatsApp Business o WhatsApp Normal</strong> escaneando el c\xF3digo QR oficial, con env\xEDo de texto, fotos, videos, audios y documentos.
            </p>
          </button>

          <button type="button" class="wa-mode-card ${s?"":"active"} js-select-wa-mode" data-mode="api" ${n}>
            <div style="display:flex;align-items:center;justify-content:space-between;width:100%;">
              <strong style="font-size:0.98rem;display:inline-flex;align-items:center;gap:0.5rem;color:var(--text-primary);">
                ${l("bot",18)}
                <span>Opci\xF3n 2: WhatsApp Cloud API (Masivos + Chatbot)</span>
              </strong>
              ${s?"":`<span class="micro-perm-pill on">${l("check",12)} <span>Activo</span></span>`}
            </div>
            <p style="font-size:0.8rem;color:var(--text-secondary);line-height:1.45;">
              Ideal para <strong>mensajes masivos (Broadcast)</strong>, <strong>chatbots inteligentes</strong>, flujos automatizados y multi-agente de alto volumen mediante la API oficial de Meta.
            </p>
          </button>
        </div>

        <!-- Panel Din\xE1mico seg\xFAn la modalidad de WhatsApp elegida -->
        ${s?`
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
                    ${l("refresh",14)}
                    <span>Generar Nuevo C\xF3digo QR</span>
                  </button>
                  ${t.wa_qr_status==="connected"?`<button type="button" class="btn btn-danger btn-sm" id="btn-wa-qr-disconnect" ${n}>
                          ${l("xCircle",14)}
                          <span>Cerrar Sesi\xF3n QR / Desvincular</span>
                        </button>`:""}
                </div>
              </div>

              <!-- Visor del C\xF3digo QR Oficial de WhatsApp Web -->
              <div style="text-align:center;">
                <div class="qr-scanner-box" id="wa-qr-box-container">
                  ${t.wa_qr_status==="connected"?`
                        <div style="padding:1.2rem 0.5rem;display:flex;flex-direction:column;align-items:center;gap:0.65rem;color:#059669;">
                          ${l("checkCircle",62)}
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
                          ${l("qrCode",48)}
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
                ${l("checkCircle",13)}
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
                  <input type="text" class="form-control" value="${r}" readonly />
                  <button type="button" class="btn btn-secondary btn-sm" id="btn-copy-webhook" data-url="${r}">
                    ${l("copy",14)}
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
                  ${l("facebook",18)}
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
              ${l("facebook",14)}
              <span>${t.fb_connected?"Reconectar / Sincronizar Facebook":"Conectar Facebook Messenger"}</span>
            </button>
            ${t.fb_connected?`<button type="button" class="btn btn-outline-danger btn-sm js-disconnect-fb-conn" title="Desconectar p\xE1gina" ${n}>
                    ${l("close",14)}
                  </button>`:""}
          </div>
        </div>

        <!-- INSTAGRAM DIRECT -->
        <div class="crm-widget" style="border-top:3px solid #ec4899;display:flex;flex-direction:column;justify-content:space-between;gap:1rem;">
          <div style="display:flex;flex-direction:column;gap:0.85rem;">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div style="display:flex;align-items:center;gap:0.55rem;">
                <span style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#f59e0b,#ec4899,#8b5cf6);color:#fff;display:inline-flex;align-items:center;justify-content:center;">
                  ${l("instagram",18)}
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
              ${l("instagram",14)}
              <span>${t.ig_connected?"Reconectar / Verificar Instagram":"Conectar Instagram Direct"}</span>
            </button>
            ${t.ig_connected?`<button type="button" class="btn btn-outline-danger btn-sm js-disconnect-ig-conn" title="Desconectar Instagram" ${n}>
                    ${l("close",14)}
                  </button>`:""}
          </div>
        </div>

        <!-- TIKTOK BUSINESS MESSAGING -->
        <div class="crm-widget" style="border-top:3px solid #14b8a6;display:flex;flex-direction:column;justify-content:space-between;gap:1rem;">
          <div style="display:flex;flex-direction:column;gap:0.85rem;">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div style="display:flex;align-items:center;gap:0.55rem;">
                <span style="width:36px;height:36px;border-radius:10px;background:#0f172a;color:#fff;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--widget-border);">
                  ${l("tiktok",18)}
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
              ${l("tiktok",14)}
              <span>${t.tt_connected?"Reconectar / Verificar TikTok":"Conectar TikTok Business"}</span>
            </button>
            ${t.tt_connected?`<button type="button" class="btn btn-outline-danger btn-sm js-disconnect-tt-conn" title="Desconectar TikTok" ${n}>
                    ${l("close",14)}
                  </button>`:""}
          </div>
        </div>
      </div>

      <div style="display:flex;justify-content:flex-end;">
        <button type="button" class="btn btn-primary crm-mobile-btn-full" id="btn-save-all-connections" ${n}>
          ${l("save",16)}
          <span>Guardar Configuraci\xF3n de Conexiones Omnicanal</span>
        </button>
      </div>
    </div>
  `}function cn(){if(CSS.supports("scroll-initial-target","nearest")){let t=document.getElementById("chat-messages-scroller");t&&(t.scrollTop=t.scrollHeight)}else{let t=document.querySelector(".chat-msg-bubble.latest-target");t&&t.scrollIntoView({behavior:"instant",block:"end"})}}var rt=null,lt=null,Ke=null;function ct(){rt!==null&&(window.clearInterval(rt),rt=null),lt!==null&&(window.clearInterval(lt),lt=null),Ke!==null&&(Ke.close(),Ke=null)}var We=new Map,Ue=0;function Wt(){try{let t=window.AudioContext||window.webkitAudioContext;if(!t)return;let e=new t,n=e.currentTime,s=e.createOscillator(),r=e.createGain();s.type="sine",s.frequency.setValueAtTime(880,n),r.gain.setValueAtTime(.2,n),r.gain.exponentialRampToValueAtTime(.001,n+.14),s.connect(r),r.connect(e.destination),s.start(n),s.stop(n+.14);let i=e.createOscillator(),m=e.createGain();i.type="sine",i.frequency.setValueAtTime(1174.66,n+.1),m.gain.setValueAtTime(.25,n+.1),m.gain.exponentialRampToValueAtTime(.001,n+.35),i.connect(m),m.connect(e.destination),i.start(n+.1),i.stop(n+.35)}catch{}}function dn(t,e){if(Wt(),typeof Notification<"u"&&Notification.permission==="granted")try{new Notification(`Mensaje de ${t}`,{body:e||"Archivo multimedia o nota de voz recibida.",icon:"/favicon.ico",badge:"/favicon.ico",tag:"crm-whatsapp-msg"})}catch{}}function pn(t){document.getElementById("chat-media-viewer-modal")?.remove();let e=document.createElement("div");e.id="chat-media-viewer-modal",e.className="chat-media-lightbox-overlay";let n="";t.mediaType==="image"?n=`
      <img src="${t.mediaUrl}" alt="${q(t.mediaTitle)}" id="lightbox-main-img" class="lightbox-main-img" />
    `:t.mediaType==="video"?n=`
      <div class="modern-video-theater-wrapper">
        <video src="${t.mediaUrl}" autoplay playsinline class="lightbox-main-video js-theater-video" id="theater-video-element"></video>
        <div class="theater-video-controls" id="theater-video-controls">
          <button type="button" class="theater-ctrl-btn js-theater-play-pause" title="Play / Pausa (Espacio)">
            ${l("pause",18)}
          </button>
          <div class="theater-progress-wrapper js-theater-scrub" title="Avanzar / Retroceder">
            <div class="theater-progress-bar">
              <div class="theater-progress-fill js-theater-progress-fill" style="width: 0%;"></div>
            </div>
          </div>
          <span class="theater-time-display js-theater-time">0:00 / 0:00</span>
          <button type="button" class="theater-speed-btn js-theater-speed" title="Velocidad (1x, 1.25x, 1.5x, 2x)">1x</button>
          <button type="button" class="theater-ctrl-btn js-theater-mute" title="Silenciar / Activar sonido (M)">
            ${l("volume2",17)}
          </button>
          <button type="button" class="theater-ctrl-btn js-theater-fullscreen" title="Pantalla Completa (F)">
            ${l("maximize",17)}
          </button>
        </div>
      </div>
    `:n=`
      <iframe src="${t.mediaUrl}" class="lightbox-main-iframe" title="${q(t.mediaTitle)}"></iframe>
    `,e.innerHTML=`
    <header class="lightbox-header">
      <div class="lightbox-title-box">
        <strong class="lightbox-filename">${q(t.mediaTitle||"Archivo Adjunto")}</strong>
        <span class="lightbox-filetype">${t.mediaType.toUpperCase()}</span>
      </div>
      <div class="lightbox-actions-box">
        ${t.mediaType==="image"?`
          <button type="button" class="lightbox-btn" id="lightbox-zoom-in" title="Acercar (+)">
            ${l("plus",16)}
          </button>
          <button type="button" class="lightbox-btn" id="lightbox-zoom-out" title="Alejar (-)">
            ${l("minus",16)}
          </button>
          <button type="button" class="lightbox-btn" id="lightbox-zoom-reset" title="Restablecer (100%)">
            1x
          </button>
        `:""}
        <a href="${t.mediaUrl}" download="${q(t.mediaTitle||"archivo")}" class="lightbox-btn" title="Descargar archivo" target="_blank" rel="noopener">
          ${l("download",16)}
        </a>
        <button type="button" class="lightbox-btn lightbox-btn-close" id="lightbox-btn-close" title="Cerrar visor (Esc)">
          ${l("close",18)}
        </button>
      </div>
    </header>
    <div class="lightbox-content-body">
      ${n}
    </div>
  `,document.body.appendChild(e);let s=()=>e.remove();if(e.querySelector("#lightbox-btn-close")?.addEventListener("click",s),e.addEventListener("click",r=>{(r.target===e||r.target.classList.contains("lightbox-content-body"))&&s()}),t.mediaType==="image"){let r=1,i=e.querySelector("#lightbox-main-img");e.querySelector("#lightbox-zoom-in")?.addEventListener("click",()=>{r=Math.min(3,r+.3),i&&(i.style.transform=`scale(${r})`)}),e.querySelector("#lightbox-zoom-out")?.addEventListener("click",()=>{r=Math.max(.4,r-.3),i&&(i.style.transform=`scale(${r})`)}),e.querySelector("#lightbox-zoom-reset")?.addEventListener("click",()=>{r=1,i&&(i.style.transform="scale(1)")})}if(t.mediaType==="video"){let r=e.querySelector(".js-theater-video"),i=e.querySelector(".js-theater-play-pause"),m=e.querySelector(".js-theater-progress-fill"),u=e.querySelector(".js-theater-scrub"),h=e.querySelector(".js-theater-time"),f=e.querySelector(".js-theater-speed"),w=e.querySelector(".js-theater-mute"),T=e.querySelector(".js-theater-fullscreen");if(r){let S=R=>{if(isNaN(R)||!isFinite(R))return"0:00";let j=Math.floor(R/60),k=Math.floor(R%60);return`${j}:${k<10?"0":""}${k}`},P=()=>{if(h&&(h.textContent=`${S(r.currentTime)} / ${S(r.duration||0)}`),m&&r.duration){let R=Math.min(100,r.currentTime/r.duration*100);m.style.width=`${R}%`}};r.addEventListener("timeupdate",P),r.addEventListener("loadedmetadata",P);let N=()=>{r.paused?(r.play().catch(()=>{}),i&&(i.innerHTML=l("pause",18))):(r.pause(),i&&(i.innerHTML=l("play",18)))};if(i?.addEventListener("click",N),r.addEventListener("click",N),r.addEventListener("ended",()=>{i&&(i.innerHTML=l("play",18))}),u){let R=j=>{let k=u.getBoundingClientRect(),D=Math.max(0,Math.min(k.width,j.clientX-k.left))/k.width;r.duration&&(r.currentTime=D*r.duration,P())};u.addEventListener("click",R)}let a=[1,1.25,1.5,2],_=0;f?.addEventListener("click",()=>{_=(_+1)%a.length;let R=a[_];r.playbackRate=R,f&&(f.textContent=`${R}x`)}),w?.addEventListener("click",()=>{r.muted=!r.muted,w&&(w.innerHTML=r.muted?l("volumeX",17):l("volume2",17))}),T?.addEventListener("click",()=>{document.fullscreenElement?document.exitFullscreen().catch(()=>{}):e.querySelector(".modern-video-theater-wrapper")?.requestFullscreen().catch(()=>{})});let L=R=>{R.key===" "||R.code==="Space"?(R.preventDefault(),N()):R.key==="ArrowRight"?r.currentTime=Math.min(r.duration||0,r.currentTime+5):R.key==="ArrowLeft"?r.currentTime=Math.max(0,r.currentTime-5):R.key==="m"||R.key==="M"?(r.muted=!r.muted,w&&(w.innerHTML=r.muted?l("volumeX",17):l("volume2",17))):(R.key==="f"||R.key==="F")&&T?.click()};window.addEventListener("keydown",L),e.querySelector("#lightbox-btn-close")?.addEventListener("click",()=>{window.removeEventListener("keydown",L)})}}}function un(t,e){t.querySelectorAll(".chat-msg-row").forEach(s=>{let r=0,i=0,m=!1,u=0,h=s.querySelector(".chat-msg-bubble, .wa-standalone-audio-card, .wa-standalone-image-card, .wa-standalone-video-card");h&&(s.addEventListener("touchstart",f=>{f.touches.length===1&&(r=f.touches[0].clientX,i=f.touches[0].clientY,m=!1,u=0,h.style.transition="none")},{passive:!0}),s.addEventListener("touchmove",f=>{if(f.touches.length!==1)return;let w=f.touches[0].clientX-r,T=f.touches[0].clientY-i;if(!m&&Math.abs(w)>10&&Math.abs(w)>Math.abs(T)*1.2&&(m=!0),m){let S=Math.sign(w)*Math.min(80,Math.pow(Math.abs(w),.85)*2.2);u=w,h.style.transform=`translateX(${S}px)`,s.classList.toggle("swipe-active",Math.abs(S)>35)}},{passive:!0}),s.addEventListener("touchend",()=>{if(m&&(h.style.transition="transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1)",h.style.transform="translateX(0)",s.classList.remove("swipe-active"),Math.abs(u)>55)){let f=Number(s.getAttribute("data-id")||0),w=s.getAttribute("data-sender")||"Mensaje",T=s.getAttribute("data-body")||"",S=s.getAttribute("data-media-type")||"none",P=s.getAttribute("data-media-url")||"";f&&(navigator.vibrate&&navigator.vibrate(35),e({id:f,sender:w,body:T,media_type:S,media_url:P}))}},{passive:!0}))})}function Bt(t){let{messageId:e,body:n,mediaType:s,mediaUrl:r,mediaFilename:i,sub:m,apiFetch:u,refreshInbox:h}=t;document.getElementById("crm-forward-modal-overlay")?.remove();let f=new Set,w="",T=document.createElement("div");T.id="crm-forward-modal-overlay",T.className="system-confirm-overlay";let S="";s==="image"&&r?S=`
      <img src="${r}" style="width:42px;height:42px;border-radius:6px;object-fit:cover;flex-shrink:0;box-shadow:0 1px 4px rgba(0,0,0,0.15);" alt="" />
      <div style="flex:1;min-width:0;font-size:0.8rem;color:var(--text-primary);">
        <strong style="display:flex;align-items:center;gap:0.3rem;color:var(--widget-accent);">${l("image",12)} Foto</strong>
        <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;opacity:0.85;">${q(n||"Foto de WhatsApp")}</span>
      </div>
    `:s==="video"?S=`
      <div style="width:42px;height:42px;border-radius:6px;background:#000;display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0;">
        ${l("play",18)}
      </div>
      <div style="flex:1;min-width:0;font-size:0.8rem;color:var(--text-primary);">
        <strong style="display:flex;align-items:center;gap:0.3rem;color:var(--widget-accent);">${l("video",12)} Video</strong>
        <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;opacity:0.85;">${q(n||"Video")}</span>
      </div>
    `:s==="audio"?S=`
      <div style="width:42px;height:42px;border-radius:6px;background:rgba(16,185,129,0.15);color:#10b981;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        ${l("mic",18)}
      </div>
      <div style="flex:1;min-width:0;font-size:0.8rem;color:var(--text-primary);">
        <strong style="display:block;color:#10b981;">Nota de voz</strong>
        <span style="opacity:0.85;">Audio de WhatsApp</span>
      </div>
    `:s==="document"?S=`
      <div style="width:42px;height:42px;border-radius:6px;background:rgba(59,130,246,0.15);color:#3b82f6;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        ${l("fileText",18)}
      </div>
      <div style="flex:1;min-width:0;font-size:0.8rem;color:var(--text-primary);">
        <strong style="display:block;color:#3b82f6;">Documento</strong>
        <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;opacity:0.85;">${q(i||"Archivo adjunto")}</span>
      </div>
    `:S=`
      <div style="flex:1;min-width:0;font-size:0.82rem;color:var(--text-primary);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.35;">
        ${q(n)}
      </div>
    `,T.innerHTML=`
    <div class="forward-modal-card">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:0.85rem 1rem;border-bottom:1px solid var(--widget-border);">
        <div style="display:flex;align-items:center;gap:0.5rem;">
          <span style="color:var(--widget-accent);display:inline-flex;">${l("cornerUpRight",18)}</span>
          <h3 style="margin:0;font-size:1.05rem;font-weight:700;color:var(--text-primary);">Reenviar mensaje</h3>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-close-forward-modal" style="padding:0.25rem 0.5rem;" title="Cerrar">
          ${l("close",15)}
        </button>
      </div>

      <div class="forward-modal-preview">
        ${S}
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
            ${l("search",14)}
          </span>
        </div>
      </div>

      <div class="forward-modal-list" id="forward-contacts-container"></div>

      <div style="display:flex;align-items:center;justify-content:space-between;padding:0.75rem 1rem;border-top:1px solid var(--widget-border);background:var(--widget-bg);">
        <span id="forward-selected-count" style="font-size:0.78rem;color:var(--text-muted);">0 chats seleccionados</span>
        <div style="display:flex;align-items:center;gap:0.5rem;">
          <button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-forward">Cancelar</button>
          <button type="button" class="btn btn-primary btn-sm" id="btn-confirm-forward" disabled style="display:inline-flex;align-items:center;gap:0.4rem;">
            ${l("cornerUpRight",14)}
            <span id="forward-confirm-text">Reenviar</span>
          </button>
        </div>
      </div>
    </div>
  `,document.body.appendChild(T);let P=T.querySelector("#forward-contacts-container"),N=T.querySelector("#forward-search-input"),a=T.querySelector("#btn-confirm-forward"),_=T.querySelector("#forward-confirm-text"),L=T.querySelector("#forward-selected-count"),G=()=>{let k=w.toLowerCase().trim(),E=m.conversations.filter(D=>k?D.contact_name.toLowerCase().includes(k)||D.contact_handle.toLowerCase().includes(k):!0);if(E.length===0){P.innerHTML=`
        <div style="padding:2rem 1rem;text-align:center;color:var(--text-muted);font-size:0.85rem;">
          No se encontraron contactos para reenviar.
        </div>
      `;return}P.innerHTML=E.map(D=>{let Y=f.has(D.id),B=D.contact_name?D.contact_name.slice(0,2).toUpperCase():"WA";return`
          <div class="forward-contact-item ${Y?"is-selected":""}" data-conv-id="${D.id}">
            <input type="checkbox" class="forward-contact-checkbox" ${Y?"checked":""} tabindex="-1" />
            <div class="avatar-circle-sm" style="width:34px;height:34px;font-size:0.75rem;flex-shrink:0;">
              ${B}
            </div>
            <div style="flex:1;min-width:0;">
              <strong style="font-size:0.85rem;color:var(--text-primary);display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${q(D.contact_name)}
              </strong>
              <span style="font-size:0.72rem;color:var(--text-muted);display:block;">
                ${q(D.contact_handle)}
              </span>
            </div>
            <span class="tag-pill-minimal" style="font-size:0.68rem;text-transform:capitalize;">
              ${D.channel}
            </span>
          </div>
        `}).join(""),P.querySelectorAll(".forward-contact-item").forEach(D=>{D.addEventListener("click",()=>{let Y=Number(D.getAttribute("data-conv-id"));Y&&(f.has(Y)?f.delete(Y):f.add(Y),R(),G())})})},R=()=>{let k=f.size;L.textContent=`${k} chat${k===1?"":"s"} seleccionado${k===1?"":"s"}`,k===0?(a.disabled=!0,_.textContent="Reenviar"):k===1?(a.disabled=!1,_.textContent="Reenviar a 1 chat"):(a.disabled=!1,_.textContent=`Reenviar a ${k} chats`)};N?.addEventListener("input",()=>{w=N.value,G()});let j=()=>T.remove();T.querySelector("#btn-close-forward-modal")?.addEventListener("click",j),T.querySelector("#btn-cancel-forward")?.addEventListener("click",j),T.addEventListener("click",k=>{k.target===T&&j()}),a.addEventListener("click",async()=>{if(f.size!==0){a.disabled=!0,a.innerHTML='<div class="wa-media-loading-spinner" style="width:14px;height:14px;border-width:2px;"></div> <span>Reenviando...</span>';try{await u(`/api/inbox/messages/${e}/forward`,{method:"POST",body:JSON.stringify({target_conversation_ids:Array.from(f)})}),$("Mensaje reenviado",`El mensaje fue reenviado a ${f.size} chat(s) con \xE9xito.`,"success"),j(),await h()}catch(k){$("Error al reenviar",k.message||"No se pudo reenviar el mensaje","danger"),a.disabled=!1,R()}}}),G(),setTimeout(()=>N?.focus(),80)}function mn(t){let{sub:e,apiFetch:n,refreshInbox:s}=t;document.getElementById("inbox-new-contact-modal")?.remove();let r=document.createElement("div");r.id="inbox-new-contact-modal",r.className="system-confirm-overlay",r.innerHTML=`
    <div class="system-confirm-card" style="max-width:440px;text-align:left;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
        <h3 style="margin:0;font-size:1.1rem;font-weight:700;display:flex;align-items:center;gap:0.5rem;color:var(--text-primary);">
          <span style="color:#10b981;display:inline-flex;">${l("messageSquare",20)}</span>
          <span>Iniciar Nueva Conversaci\xF3n</span>
        </h3>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-close-new-contact-modal" style="padding:0.25rem 0.5rem;" title="Cerrar">
          ${l("close",15)}
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
            ${l("send",14)}
            <span>Comenzar Chat</span>
          </button>
        </div>
      </form>
    </div>
  `,document.body.appendChild(r);let i=h=>{h.key==="Escape"&&(h.stopPropagation(),m())};window.addEventListener("keydown",i);let m=()=>{window.removeEventListener("keydown",i),r.remove()};r.querySelector("#btn-close-new-contact-modal")?.addEventListener("click",m),r.querySelector("#btn-cancel-new-contact")?.addEventListener("click",m),r.addEventListener("click",h=>{h.target===r&&m()}),r.querySelector("#form-new-contact")?.addEventListener("submit",async h=>{h.preventDefault();let f=r.querySelector("#new-contact-name"),w=r.querySelector("#new-contact-phone"),T=r.querySelector("#btn-submit-new-contact"),S=f.value.trim(),P=w.value.trim();if(!(!S||!P))try{T.disabled=!0,T.textContent="Iniciando chat...";let N=await n("/api/inbox/conversations",{method:"POST",body:JSON.stringify({contact_name:S,contact_handle:P,channel:"whatsapp"})});m(),e.selectedConversationId=N.id,await s(),$("Chat Abierto",`Conversaci\xF3n lista con ${S}.`,"success")}catch(N){T.disabled=!1,T.textContent="Comenzar Chat",$("Error al iniciar chat",N.message,"danger")}}),setTimeout(()=>{r.querySelector("#new-contact-name")?.focus()},50)}var H=window.__nexusGlobalAudio=window.__nexusGlobalAudio||{audio:new Audio,currentSrc:null,currentMessageId:null,conversationId:null,senderName:"",playbackRate:1};function Ve(t){if(isNaN(t)||!isFinite(t))return"0:00";let e=Math.floor(t/60),n=Math.floor(t%60);return`${e}:${n<10?"0":""}${n}`}function Ut(){if(window.__nexusGlobalAudioInitialized)return;window.__nexusGlobalAudioInitialized=!0;let t=()=>{let n=H.audio,s=!n.paused&&!n.ended,r=n.duration||0,i=n.currentTime||0,m=r>0?i/r*100:0;if(H.currentMessageId){let h=document.querySelector(`.chat-msg-row[data-id="${H.currentMessageId}"] .wa-audio-bubble`);if(h){let f=h.querySelector(".js-wa-audio-toggle"),w=h.querySelector(".js-wa-audio-fill"),T=h.querySelector(".js-wa-audio-time"),S=h.querySelector(".js-wa-audio-speed");f&&(f.innerHTML=s?l("pause",16):l("play",16)),w&&(w.style.width=`${m}%`),T&&(T.textContent=s||i>0?Ve(i):Ve(r)),S&&(S.textContent=`${H.playbackRate}x`),s?h.classList.add("playing"):h.classList.remove("playing")}}let u=document.getElementById("nexus-floating-audio-bar");if(u){let f=window.__nexusCurrentSubState?.selectedConversationId!==H.conversationId,w=H.currentMessageId?!!document.querySelector(`.chat-msg-row[data-id="${H.currentMessageId}"]`):!1;if(!!H.currentSrc&&(f||!w)){u.style.display="flex";let S=u.querySelector(".js-floating-audio-toggle"),P=u.querySelector(".js-floating-audio-sender"),N=u.querySelector(".js-floating-audio-fill"),a=u.querySelector(".js-floating-audio-time"),_=u.querySelector(".js-floating-audio-speed");S&&(S.innerHTML=s?l("pause",18):l("play",18)),P&&(P.innerHTML=`${l("mic",13)} <span>${q(H.senderName||"Nota de voz")}</span>`),N&&(N.style.width=`${m}%`),a&&(a.textContent=`${Ve(i)} / ${Ve(r)}`),_&&(_.textContent=`${H.playbackRate}x`)}else u.style.display="none"}},e=H.audio;e.addEventListener("timeupdate",t),e.addEventListener("play",t),e.addEventListener("pause",t),e.addEventListener("ended",()=>{t();let n=document.getElementById("nexus-floating-audio-bar");n&&(n.style.display="none"),H.currentSrc=null,H.currentMessageId=null}),e.addEventListener("loadedmetadata",t)}function gn(t){window.__nexusCurrentSubState=t.sub,window.__nexusCurrentRerender=t.rerender,Ut();let e=document.getElementById("nexus-floating-audio-bar");e||(e=document.createElement("div"),e.id="nexus-floating-audio-bar",e.className="nexus-floating-audio-bar",e.style.display="none",e.innerHTML=`
      <button type="button" class="nexus-floating-audio-play-btn js-floating-audio-toggle" title="Reproducir / Pausar">
        ${l("play",18)}
      </button>
      <div class="nexus-floating-audio-info">
        <div class="nexus-floating-audio-sender js-floating-audio-sender" style="cursor:pointer;" title="Haga clic para ir a esta conversaci\xF3n">
          ${l("mic",13)} <span>Nota de voz</span>
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
        ${l("close",16)}
      </button>
    `,document.body.appendChild(e),e.querySelector(".js-floating-audio-toggle")?.addEventListener("click",n=>{n.stopPropagation();let s=H.audio;s.paused?s.play().catch(()=>{}):s.pause()}),e.querySelector(".js-floating-audio-track")?.addEventListener("click",n=>{n.stopPropagation();let s=e?.querySelector(".js-floating-audio-track");if(!s)return;let r=s.getBoundingClientRect(),i=n.clientX-r.left,m=Math.max(0,Math.min(1,i/r.width));H.audio.duration&&(H.audio.currentTime=m*H.audio.duration)}),e.querySelector(".js-floating-audio-speed")?.addEventListener("click",n=>{n.stopPropagation(),H.playbackRate===1?H.playbackRate=1.5:H.playbackRate===1.5?H.playbackRate=2:H.playbackRate=1,H.audio.playbackRate=H.playbackRate;let s=e?.querySelector(".js-floating-audio-speed");s&&(s.textContent=`${H.playbackRate}x`)}),e.querySelector(".js-floating-audio-close")?.addEventListener("click",n=>{n.stopPropagation(),H.audio.pause(),H.currentSrc=null,H.currentMessageId=null,e&&(e.style.display="none")}),e.querySelector(".js-floating-audio-sender")?.addEventListener("click",n=>{n.stopPropagation();let s=window.__nexusCurrentSubState,r=window.__nexusCurrentRerender;H.conversationId&&s&&r&&s.selectedConversationId!==H.conversationId&&(s.selectedConversationId=H.conversationId,r())}))}function yn(t=document,e){Ut(),t.querySelectorAll(".wa-audio-bubble").forEach(s=>{let r=s.closest(".chat-msg-row"),i=r?Number(r.getAttribute("data-id")):0,m=r?.getAttribute("data-sender")||"Nota de voz",u=s.getAttribute("data-audio-src")||r?.getAttribute("data-media-url")||"",h=s.querySelector(".js-wa-audio-toggle"),f=s.querySelector(".js-wa-audio-fill"),w=s.querySelector(".js-wa-audio-track"),T=s.querySelector(".js-wa-audio-time"),S=s.querySelector(".js-wa-audio-speed");if(!(!h||!u)){if(H.currentMessageId===i&&H.currentSrc===u){let P=H.audio,N=!P.paused&&!P.ended;h.innerHTML=N?l("pause",16):l("play",16),N&&s.classList.add("playing");let a=P.duration||0,_=P.currentTime||0,L=a>0?_/a*100:0;f&&(f.style.width=`${L}%`),T&&(T.textContent=N||_>0?Ve(_):Ve(a)),S&&(S.textContent=`${H.playbackRate}x`)}h.addEventListener("click",P=>{P.stopPropagation();let N=H.audio;H.currentSrc===u?N.paused?N.play().catch(()=>{}):N.pause():(N.pause(),H.currentSrc=u,H.currentMessageId=i,H.conversationId=e?.selectedConversationId||null,H.senderName=m,N.src=u,N.playbackRate=H.playbackRate,N.play().catch(()=>{}))}),w?.addEventListener("click",P=>{P.stopPropagation();let N=H.audio;H.currentSrc!==u&&(N.pause(),H.currentSrc=u,H.currentMessageId=i,H.conversationId=e?.selectedConversationId||null,H.senderName=m,N.src=u,N.playbackRate=H.playbackRate);let a=w.getBoundingClientRect(),_=P.clientX-a.left,L=Math.max(0,Math.min(1,_/a.width));N.duration&&(N.currentTime=L*N.duration),N.paused&&N.play().catch(()=>{})}),S?.addEventListener("click",P=>{P.stopPropagation(),H.playbackRate===1?H.playbackRate=1.5:H.playbackRate===1.5?H.playbackRate=2:H.playbackRate=1,H.audio.playbackRate=H.playbackRate,S.textContent=`${H.playbackRate}x`})}})}function bn(t){let{messageId:e,currentBody:n,apiFetch:s,refreshInbox:r}=t;document.getElementById("inbox-edit-msg-modal")?.remove();let i=document.createElement("div");i.id="inbox-edit-msg-modal",i.className="system-confirm-overlay",i.innerHTML=`
    <div class="system-confirm-card" style="max-width:480px;text-align:left;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
        <h3 style="margin:0;font-size:1.1rem;font-weight:700;display:flex;align-items:center;gap:0.5rem;color:var(--text-primary);">
          <span style="color:#10b981;display:inline-flex;">${l("edit",18)}</span>
          <span>Editar Mensaje</span>
        </h3>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-close-edit-modal" style="padding:0.25rem 0.5rem;" title="Cerrar">
          ${l("close",15)}
        </button>
      </div>

      <form id="form-edit-message" style="display:flex;flex-direction:column;gap:0.95rem;">
        <div class="form-group" style="display:flex;flex-direction:column;gap:0.35rem;">
          <label class="form-label" for="edit-message-text" style="font-weight:600;font-size:0.86rem;color:var(--text-primary);">Contenido del Mensaje</label>
          <textarea id="edit-message-text" class="form-control" rows="4" style="resize:vertical;font-size:0.92rem;line-height:1.45;" required>${q(n)}</textarea>
          <span class="form-hint" style="font-size:0.75rem;color:var(--text-muted);">Al guardar, el mensaje mostrar\xE1 el distintivo "(editado)" junto a la hora.</span>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:0.6rem;margin-top:0.4rem;">
          <button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-edit">Cancelar</button>
          <button type="submit" class="btn btn-primary btn-sm" id="btn-submit-edit">
            ${l("check",14)}
            <span>Guardar Cambios</span>
          </button>
        </div>
      </form>
    </div>
  `,document.body.appendChild(i);let m=i.querySelector("#edit-message-text");setTimeout(()=>{m&&(m.focus(),m.setSelectionRange(m.value.length,m.value.length))},60);let u=()=>i.remove();i.querySelector("#btn-close-edit-modal")?.addEventListener("click",u),i.querySelector("#btn-cancel-edit")?.addEventListener("click",u),i.addEventListener("click",f=>{f.target===i&&u()}),i.querySelector("#form-edit-message")?.addEventListener("submit",async f=>{f.preventDefault();let w=m.value.trim();if(!w)return;let T=i.querySelector("#btn-submit-edit");T.disabled=!0,T.textContent="Guardando...";try{await s(`/api/inbox/messages/${e}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({body:w})}),u(),await r(),$("Mensaje editado","El mensaje fue actualizado correctamente.","success")}catch(S){T.disabled=!1,T.textContent="Guardar Cambios",$("Error al editar",S.message||"No se pudo editar el mensaje","danger")}})}function hn(t){document.getElementById("upload-progress-toast")?.remove();let e=document.createElement("div");return e.id="upload-progress-toast",e.className="upload-progress-toast",e.setAttribute("role","status"),e.innerHTML=`
    <div class="upload-progress-title"><span>Enviando ${q(t)}</span><strong id="upload-progress-pct">0%</strong></div>
    <div class="upload-progress-track"><div class="upload-progress-fill" id="upload-progress-fill" style="width:0%"></div></div>
  `,document.body.appendChild(e),{update:n=>{let s=Math.max(0,Math.min(100,Math.round(n))),r=document.getElementById("upload-progress-fill"),i=document.getElementById("upload-progress-pct");r&&(r.style.width=`${s}%`),i&&(i.textContent=`${s}%`)},done:()=>window.setTimeout(()=>e.remove(),250)}}function fn(t,e,n){return new Promise((s,r)=>{let i=new XMLHttpRequest;i.open("POST",t),i.withCredentials=!0,i.setRequestHeader("Content-Type","application/json");try{let m=localStorage.getItem("turbonetwork_session"),u=m?JSON.parse(m)?.token:"";u&&i.setRequestHeader("Authorization",`Bearer ${u}`);let h=localStorage.getItem("turbonetwork_active_tenant")||"";h&&i.setRequestHeader("x-tenant-id",h)}catch{}i.upload.onprogress=m=>{m.lengthComputable&&n(m.loaded/m.total*100)},i.onload=()=>{let m={};try{m=i.responseText?JSON.parse(i.responseText):{}}catch{m={error:i.responseText||"Error de respuesta del servidor"}}i.status>=200&&i.status<300?s(m):r(new Error(m.error||m.message||`Error HTTP ${i.status}`))},i.onerror=()=>r(new Error("Error de red al subir el archivo.")),i.send(JSON.stringify(e))})}var be=null,Ht=!1,zt=new WeakMap,ft=!1,ze="",He=null,Ce=0,Rt=null;function vn(){try{let t=window.AudioContext||window.webkitAudioContext;if(!t)return;let e=new t,n=e.createOscillator(),s=e.createGain();n.type="sine",n.frequency.value=660,s.gain.setValueAtTime(1e-4,e.currentTime),s.gain.exponentialRampToValueAtTime(.18,e.currentTime+.02),s.gain.exponentialRampToValueAtTime(1e-4,e.currentTime+.45),n.connect(s),s.connect(e.destination),n.start(),n.stop(e.currentTime+.5),n.onended=()=>{e.close()}}catch{}}function Vt(){document.getElementById("wa-conn-banner")?.remove()}function wn(t){let e=document.getElementById("wa-conn-banner");e||(e=document.createElement("div"),e.id="wa-conn-banner",e.className="wa-conn-banner",e.setAttribute("role","alert"),document.body.appendChild(e));let n=t==="awaiting_scan"||t==="disconnected";e.classList.toggle("is-danger",n),e.innerHTML=`
    <span class="wa-conn-banner-icon" aria-hidden="true">${l("alertTriangle",18)}</span>
    <div class="wa-conn-banner-text">
      <strong>${n?"WhatsApp desconectado":"Reconectando WhatsApp\u2026"}</strong>
      <span>${n?"Vuelve a escanear el c\xF3digo QR para seguir recibiendo y enviando mensajes.":"Los mensajes que env\xEDes quedar\xE1n en cola y saldr\xE1n al reconectar."}</span>
    </div>
    ${n?'<button type="button" class="wa-conn-banner-btn js-wa-banner-connect">Escanear QR</button>':""}
    <button type="button" class="wa-conn-banner-close js-wa-banner-close" aria-label="Cerrar aviso">${l("close",14)}</button>
  `}function Pt(t){if(!t)return;if(t==="connected"){He!==null&&(window.clearTimeout(He),He=null);let s=ft&&ze!==""&&ze!=="connected";ft=!0,ze=t,Vt(),s&&$("WhatsApp reconectado","La conexi\xF3n se restableci\xF3. Los mensajes en cola se est\xE1n enviando.","success");return}let e=ze==="connected"||ft;if(ze=t,!e)return;wn(t),He!==null&&window.clearTimeout(He);let n=t==="awaiting_scan"||t==="disconnected";He=window.setTimeout(()=>{if(He=null,ze!=="connected"){vn();try{typeof Notification<"u"&&Notification.permission==="granted"&&document.hidden&&new Notification("WhatsApp desconectado",{body:n?"Escanea el QR de nuevo para no perder mensajes de clientes.":"No se pudo reconectar. Revisa la conexi\xF3n del servidor.",icon:"/icons/icon-192.png",tag:"wa-disconnected"})}catch{}}},n?1500:8e3)}function wt(){let t=document.getElementById("chat-jump-bottom"),e=document.getElementById("chat-messages-scroller");if(!t||!e)return;let n=e.scrollHeight-e.scrollTop-e.clientHeight;n<160&&(Ce=0);let s=n>=260||Ce>0;t.style.display=s?"inline-flex":"none";let r=t.querySelector(".chat-jump-bottom-count");r&&(r.textContent=Ce>0?String(Ce):"",r.style.display=Ce>0?"inline-flex":"none")}function xn(){Ht||(Ht=!0,document.addEventListener("click",async t=>{let e=t.target;if(!e)return;let n=e.closest(".js-retry-send");if(n&&be){t.stopPropagation();let u=n.getAttribute("data-id");if(!u)return;n.disabled=!0;try{await be.apiFetch(`/api/inbox/messages/${u}/retry`,{method:"POST"}),await be.refreshInbox()}catch(h){n.disabled=!1,$("No se pudo reintentar",h.message,"danger")}return}let s=e.closest(".js-retry-media");if(s){t.stopPropagation();let u=s.closest(".wa-media-failed"),h=u?zt.get(u):void 0;if(u&&h){let f=`r=${Date.now()}`;u.innerHTML=h.replace(/(src=")([^"]+)(")/g,(w,T,S,P)=>`${T}${S}${S.includes("?")?"&":"?"}${f}${P}`),u.classList.remove("wa-media-failed"),u.classList.add("js-open-media-lightbox")}return}if(e.closest(".js-wa-banner-connect")&&be){t.stopPropagation(),be.goToConnectionsTab();return}if(e.closest(".js-wa-banner-close")){Vt();return}let r=e.closest(".js-react-msg");if(r){t.stopPropagation();let u=document.getElementById("msg-reaction-popover"),h=u?.getAttribute("data-for");u?.remove();let f=r.getAttribute("data-id")||"";if(h===f)return;let w=document.createElement("div");w.id="msg-reaction-popover",w.className="msg-reaction-popover",w.setAttribute("data-for",f),w.setAttribute("role","menu"),w.innerHTML=["\u{1F44D}","\u2764\uFE0F","\u{1F602}","\u{1F62E}","\u{1F622}","\u{1F64F}"].map(P=>`<button type="button" class="msg-reaction-pick js-pick-reaction" role="menuitem" data-emoji="${P}" aria-label="Reaccionar con ${P}">${P}</button>`).join("")+`<button type="button" class="msg-reaction-pick js-pick-reaction" role="menuitem" data-emoji="" aria-label="Quitar reacci\xF3n">${l("close",13)}</button>`,document.body.appendChild(w);let T=r.getBoundingClientRect(),S=w.offsetWidth||260;w.style.top=`${Math.max(8,T.top-48)}px`,w.style.left=`${Math.min(window.innerWidth-S-8,Math.max(8,T.left-S/2))}px`;return}let i=e.closest(".js-pick-reaction");if(i&&be){t.stopPropagation();let u=document.getElementById("msg-reaction-popover"),h=u?.getAttribute("data-for"),f=i.getAttribute("data-emoji")||"";if(u?.remove(),!h)return;try{await be.apiFetch(`/api/inbox/messages/${h}/reaction`,{method:"POST",body:JSON.stringify({emoji:f})}),await be.refreshInbox()}catch(w){$("No se pudo reaccionar",w.message,"danger")}return}document.getElementById("msg-reaction-popover")?.remove();let m=e.closest(".js-load-older");if(m&&be){t.stopPropagation();let u=document.getElementById("chat-messages-scroller"),h=u?.scrollHeight??0,f=u?.scrollTop??0;m.disabled=!0,be.sub.messageLimit=(be.sub.messageLimit||250)+250;try{await be.refreshInbox();let w=document.getElementById("chat-messages-scroller");w&&(w.scrollTop=w.scrollHeight-h+f)}catch(w){$("No se pudieron cargar mensajes anteriores",w.message,"danger")}return}if(e.closest("#chat-jump-bottom")){let u=document.getElementById("chat-messages-scroller");u&&u.scrollTo({top:u.scrollHeight,behavior:"smooth"}),Ce=0,wt()}}),document.addEventListener("error",t=>{let e=t.target;if(!e||!(e instanceof HTMLImageElement||e instanceof HTMLVideoElement)||!/wa-sticker-img|wa-standalone-image-el|wa-standalone-video-el/.test(e.className))return;let n=e.closest(".wa-sticker-media-wrapper, .wa-image-media-wrapper, .wa-video-media-wrapper");!n||n.classList.contains("wa-media-failed")||(zt.set(n,n.innerHTML),n.classList.remove("js-open-media-lightbox"),n.classList.add("wa-media-failed"),n.innerHTML=vt(!0))},!0))}function Qt(t){let{sub:e,apiFetch:n,refreshInbox:s,goToConnectionsTab:r,rerender:i}=t;if(be={sub:e,apiFetch:n,refreshInbox:s,goToConnectionsTab:r},xn(),e.connections?.wa_active_mode==="qr"&&e.connections?.wa_qr_status){let o=String(e.connections.wa_qr_status);o!==ze&&Pt(o)}Rt!==e.selectedConversationId&&(Ce=0,Rt=e.selectedConversationId),document.getElementById("chat-messages-scroller")?.addEventListener("scroll",wt,{passive:!0}),window.setTimeout(wt,60);let u=[],h=-1,f=document.getElementById("chat-search-input"),w=document.getElementById("chat-search-count"),T=o=>{u.forEach(d=>d.classList.remove("chat-search-current"));let c=u[h];c&&(c.classList.add("chat-search-current"),o&&c.scrollIntoView({block:"center",behavior:"smooth"})),w&&(w.textContent=u.length>0?`${h+1} de ${u.length}`:f?.value.trim()?"Sin resultados":"")},S=o=>{document.querySelectorAll(".chat-search-hit").forEach(d=>d.classList.remove("chat-search-hit","chat-search-current")),u=[];let c=(e.messageSearch?.query||"").trim().toLowerCase();c&&document.querySelectorAll("#chat-messages-scroller .chat-msg-row").forEach(d=>{(d.textContent||"").toLowerCase().includes(c)&&(d.classList.add("chat-search-hit"),u.push(d))}),h=u.length>0?u.length-1:-1,T(o)},P=o=>{u.length!==0&&(h=(h+o+u.length)%u.length,T(!0))},N=document.getElementById("btn-toggle-conv-bot-mode");if(N){let o=Number(N.dataset.convId||0),c=o>0?je.get(o):void 0;yt(c||"bot"),o>0&&n(`/api/bot/conversations/${o}/state`).then(d=>{let y=d?.state?.mode||"bot";je.set(o,y),yt(y)}).catch(()=>{}),N.addEventListener("click",async()=>{if(!o)return;let y=(N.dataset.mode||"bot")==="bot"?"human":"bot";try{let b=(await n(`/api/bot/conversations/${o}/mode`,{method:"PUT",body:JSON.stringify({mode:y})}))?.state?.mode||y;je.set(o,b),yt(b),$(b==="human"?"Atenci\xF3n Humana":"Bot Activo",b==="human"?"Bot desactivado en este chat. Ya puede escribir manualmente.":"Bot activado en este chat. La casilla de mensajes qued\xF3 bloqueada.","success")}catch(g){$("Error",g.message,"danger")}})}document.getElementById("btn-open-bot-studio")?.addEventListener("click",()=>{jt(n)}),document.getElementById("btn-toggle-chat-search")?.addEventListener("click",()=>{let o=!e.messageSearch?.open;e.messageSearch={open:o,query:o&&e.messageSearch?.query||""},i(),o&&document.getElementById("chat-search-input")?.focus()}),document.getElementById("btn-chat-search-close")?.addEventListener("click",()=>{e.messageSearch={open:!1,query:""},i()}),document.getElementById("btn-chat-search-next")?.addEventListener("click",()=>P(1)),document.getElementById("btn-chat-search-prev")?.addEventListener("click",()=>P(-1));let a=null;f?.addEventListener("input",()=>{e.messageSearch={open:!0,query:f.value},a!==null&&window.clearTimeout(a),a=window.setTimeout(()=>S(!0),180)}),f?.addEventListener("keydown",o=>{o.key==="Enter"?(o.preventDefault(),P(o.shiftKey?-1:1)):o.key==="Escape"&&(e.messageSearch={open:!1,query:""},i())}),e.messageSearch?.open&&e.messageSearch.query&&S(!1),ct(),cn(),gn({sub:e,rerender:i}),yn(document,e),e.selectedConversationId&&e.messages&&e.messages.length>0&&We.set(e.selectedConversationId,e.messages),document.querySelectorAll(".js-chat-back-to-list").forEach(o=>{o.addEventListener("click",()=>{e.selectedConversationId=null,i()})});let _=o=>{let c=document.getElementById("chat-composer-input"),d=document.getElementById("slash-command-popover");if(d&&(d.style.display="none"),o.media_type&&o.media_type!=="none"&&o.media_url){e.pendingAttachment={media_type:o.media_type,media_url:o.media_url,media_filename:o.media_filename||`${o.shortcut}`,media_mimetype:o.media_mimetype||"application/octet-stream"},i();let y=document.getElementById("chat-composer-input");y&&(y.value=o.body,y.focus())}else c&&(c.value=o.body,c.focus())},L=0,G=!1,R=null,j=async(o=!1)=>{if(G)return;if(!document.querySelector(".inbox-workspace-100vh")){ct();return}G=!0;let c=document.activeElement,d=c&&(c.id==="inbox-search-input"||c.id==="chat-composer-input"||c.id==="new-conv-note-input");try{let y=!1;try{let X=await n("/api/inbox/sync-status"),W=!!e.waSync?.active;if(e.waSync=X,X.active){if(!document.getElementById("wa-sync-banner"))i();else{let{pct:ke,detail:$e,title:ge}=Nt(X),fe=document.getElementById("wa-sync-title"),ve=document.getElementById("wa-sync-detail"),_e=document.getElementById("wa-sync-bar-fill");fe&&(fe.textContent=ge),ve&&(ve.textContent=$e),_e&&(_e.style.width=`${ke}%`)}if(!o&&Date.now()-L<2e3)return}else if(W){y=!0;let ae=document.getElementById("wa-sync-banner");ae&&ae.remove()}}catch{}L=Date.now();let g=e.selectedConversationId?`/api/inbox?active_conv_id=${e.selectedConversationId}&msg_limit=${e.messageLimit||250}`:"/api/inbox",b=await n(g);if(Ue===0)Ue=b.messages.reduce((X,W)=>Math.max(X,W.id),0);else{let X=b.messages.filter(W=>W.id>Ue&&W.sender_type==="contact");if(X.length>0){let W=X[X.length-1];Ue=b.messages.reduce((ae,ke)=>Math.max(ae,ke.id),0),dn(W.sender_name,W.body),$(`Mensaje de ${W.sender_name}`,W.body||"Nuevo archivo o nota de voz recibido.","info")}else Ue=Math.max(Ue,b.messages.reduce((W,ae)=>Math.max(W,ae.id),0))}let z=b.messages.length!==e.messages.length,Q=(b.messages[b.messages.length-1]?.id??0)!==(e.messages[e.messages.length-1]?.id??0),U=b.messages.some(X=>{let W=e.messages.find(ae=>ae.id===X.id);return W&&(W.delivery_status!==X.delivery_status||JSON.stringify(W.reactions_json||[])!==JSON.stringify(X.reactions_json||[]))}),ee=b.conversations.some(X=>{let W=e.conversations.find(ae=>ae.id===X.id);return W&&W.unread_count!==X.unread_count});if(z||Q||U||ee||y||b.conversations.length!==e.conversations.length){let X=document.activeElement?.id==="chat-composer-input",W=document.getElementById("chat-composer-input")?.value||"",ae=document.getElementById("chat-composer-input")?.selectionStart??W.length,ke=document.getElementById("chat-composer-input")?.selectionEnd??W.length,ge=document.querySelector(".inbox-conversations-list")?.scrollTop??0,fe=document.getElementById("chat-messages-scroller"),ve=fe?.scrollTop??0,_e=fe?fe.scrollHeight-fe.scrollTop-fe.clientHeight<90:!0,tt=document.getElementById("inbox-pc-dropdown-menu")?.style.display==="flex",we=document.getElementById("chat-emoji-picker-popover")?.style.display==="flex",ut=document.activeElement?.id==="chat-search-input",$t=document.querySelector("#chat-emoji-picker-popover .chat-emoji-tab.active")?.getAttribute("data-emoji-cat")||"freq";if(!_e&&e.selectedConversationId){let ye=new Set(e.messages.map(Be=>Be.id));Ce+=b.messages.filter(Be=>!ye.has(Be.id)&&Be.sender_type==="contact").length}e.conversations=b.conversations,e.messages=b.messages,e.selectedConversationId&&We.set(e.selectedConversationId,b.messages),e.connections=b.connections,e.quickReplies=b.quickReplies||e.quickReplies,e.tags=b.tags||e.tags,e.notes=b.notes||e.notes,i();let Tt=document.querySelector(".inbox-conversations-list");Tt&&ge>0&&(Tt.scrollTop=ge);let nt=document.getElementById("chat-messages-scroller");if(nt&&(_e?nt.scrollTop=nt.scrollHeight:nt.scrollTop=ve),tt){let ye=document.getElementById("inbox-pc-dropdown-menu");ye&&(ye.style.display="flex")}if(ut){let ye=document.getElementById("chat-search-input");if(ye){ye.focus();try{ye.setSelectionRange(ye.value.length,ye.value.length)}catch{}}}if(we){let ye=document.getElementById("chat-emoji-picker-popover"),Be=document.getElementById("btn-toggle-emoji-picker");if(ye){ye.style.display="flex",Be&&Be.setAttribute("aria-expanded","true");let St=ye.querySelector(`.chat-emoji-tab[data-emoji-cat="${$t}"]`);St&&$t!=="freq"&&St.click()}}let at=document.getElementById("chat-composer-input");if(at&&(W&&(at.value=W),X||d)){at.focus();try{at.setSelectionRange(ae,ke)}catch{}}}}catch{}finally{G=!1}};if(typeof EventSource<"u")try{Ke=new EventSource("/api/inbox/events"),Ke.addEventListener("inbox",o=>{try{let c=o.data?JSON.parse(o.data):null;if(c?.type==="connection_status"){Pt(String(c.status||""));let d=document.getElementById("inbox-wa-live-pill"),y=document.getElementById("inbox-wa-live-label");if(d&&y){let g=c.status==="connected"?"#10b981":"#f59e0b";d.style.setProperty("--tag-color",g),y.textContent=c.status==="connected"?"WhatsApp en vivo":c.status==="reconnecting"?"Reconectando...":"QR pendiente"}}}catch{}R!==null&&window.clearTimeout(R),R=window.setTimeout(()=>{j(!0)},120)})}catch{}lt=window.setInterval(()=>{j(!1)},2500);let k=document.getElementById("inbox-pc-dropdown-menu");document.getElementById("btn-inbox-pc-menu")?.addEventListener("click",o=>{o.stopPropagation(),k&&(k.style.display=k.style.display==="flex"?"none":"flex")}),document.addEventListener("click",()=>{k&&(k.style.display="none")});let E=document.getElementById("inbox-mobile-sheet-overlay");document.getElementById("btn-inbox-mobile-fab")?.addEventListener("click",()=>{E&&(E.style.display="flex")}),document.getElementById("btn-close-mobile-sheet")?.addEventListener("click",()=>{E&&(E.style.display="none")}),E?.addEventListener("click",o=>{o.target===E&&(E.style.display="none")}),document.querySelectorAll(".js-opt-sync-wa").forEach(o=>{o.addEventListener("click",async()=>{k&&(k.style.display="none"),E&&(E.style.display="none");try{let c=await n("/api/inbox/sync-whatsapp",{method:"POST"});await s(),$(c.synced?"Chats Sincronizados":"Estado de Sincronizaci\xF3n",c.message||`${c.totalConversations??0} conversaci\xF3n(es) de WhatsApp en bandeja.`,c.synced?"success":"info")}catch(c){$("Error al sincronizar WhatsApp",c.message,"danger")}})}),document.querySelectorAll(".js-opt-sync-ig").forEach(o=>{o.addEventListener("click",async()=>{k&&(k.style.display="none"),E&&(E.style.display="none");try{let c=await n("/api/inbox/sync-instagram",{method:"POST"});await s(),$(c.synced?"Instagram Sincronizado":"Aviso de Instagram Direct",c.message||(c.synced?`Se sincronizaron ${c.syncedConversations} chats de Instagram.`:"No se recibieron mensajes."),c.synced?"success":"info")}catch(c){$("Error al sincronizar Instagram",c.message,"danger")}})}),document.querySelectorAll(".js-opt-sync-all").forEach(o=>{o.addEventListener("click",async()=>{k&&(k.style.display="none"),E&&(E.style.display="none");try{await n("/api/inbox/sync-all",{method:"POST"}),await s(),$("Redes Sincronizadas","Se sincronizaron todas las redes conectadas (WhatsApp, Instagram, Facebook).","success")}catch(c){$("Error al sincronizar redes",c.message,"danger")}})}),document.querySelectorAll(".js-opt-sync-fb").forEach(o=>{o.addEventListener("click",async()=>{k&&(k.style.display="none"),E&&(E.style.display="none");try{let c=await n("/api/inbox/sync-facebook",{method:"POST"});await s(),$("Facebook Sincronizado",`Se descargaron ${c.syncedConversations} chats y ${c.syncedMessages} mensajes de tu p\xE1gina de Facebook.`,"success")}catch(c){$("Error al sincronizar Facebook",c.message,"danger")}})}),document.querySelectorAll(".js-goto-connections").forEach(o=>{o.addEventListener("click",()=>{r()})}),document.querySelectorAll(".js-opt-quick-replies").forEach(o=>{o.addEventListener("click",()=>{k&&(k.style.display="none"),E&&(E.style.display="none"),Pe({sub:e,apiFetch:n,refreshInbox:s,onSelect:_})})}),document.querySelectorAll(".js-opt-tags").forEach(o=>{o.addEventListener("click",()=>{k&&(k.style.display="none"),E&&(E.style.display="none"),Xe({sub:e,apiFetch:n,refreshInbox:s})})});let D=async()=>{if((e.connections||{})?.wa_active_mode!=="api"){await ot({title:"Mensajes Masivos requiere WhatsApp Cloud API",description:'Actualmente WhatsApp est\xE1 configurado en modo "Servidor QR Interno". \xBFDesea ir a la pesta\xF1a Conexiones para activar el modo WhatsApp Cloud API oficial?',confirmLabel:"Ir a Conexiones",cancelLabel:"Cancelar"})&&r();return}let c=document.getElementById("global-form-dialog");if(!c)return;c.innerHTML=`
      <form id="broadcast-modal-form" class="crm-form-modal-surface">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
          <div>
            <h3 id="form-dialog-title" style="font-size:1.18rem;display:flex;align-items:center;gap:0.5rem;">
              ${l("megaphone",18)}
              <span>Campa\xF1a de Mensajes Masivos (WhatsApp Cloud API)</span>
            </h3>
            <p style="font-size:0.8rem;color:var(--text-muted);">
              Se enviar\xE1 simult\xE1neamente a todos los contactos de WhatsApp mediante su conexi\xF3n oficial Cloud API.
            </p>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" id="close-broadcast-modal">
            ${l("close",16)}
          </button>
        </div>

        <div class="form-group" style="margin-bottom:1.25rem;">
          <label class="form-label" for="broadcast-message-text">Contenido de la Plantilla / Mensaje Masivo *</label>
          <textarea id="broadcast-message-text" class="form-control" rows="4" required>Hola, le saludamos desde nuestro canal oficial. Tenemos una promoci\xF3n corporativa especial disponible esta semana para su empresa.</textarea>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:0.65rem;">
          <button type="button" class="btn btn-secondary" id="cancel-broadcast-modal">Cancelar</button>
          <button type="submit" class="btn btn-primary">
            ${l("send",15)}
            <span>Disparar Env\xEDo Masivo Ahora</span>
          </button>
        </div>
      </form>
    `;let d=()=>c.close();c.querySelector("#close-broadcast-modal")?.addEventListener("click",d),c.querySelector("#cancel-broadcast-modal")?.addEventListener("click",d),c.querySelector("#broadcast-modal-form")?.addEventListener("submit",async y=>{y.preventDefault();let g=c.querySelector("#broadcast-message-text").value.trim();try{let b=await n("/api/inbox/whatsapp-broadcast",{method:"POST",body:JSON.stringify({messageText:g})});d(),await s(),$("Difusi\xF3n enviada",`Mensaje masivo enviado a ${b.sentCount} contactos por WhatsApp Cloud API.`,"success")}catch(b){$("Error en difusi\xF3n masiva",b.message,"danger")}}),c.showModal()};document.querySelectorAll(".js-opt-broadcast").forEach(o=>{o.addEventListener("click",async()=>{k&&(k.style.display="none"),E&&(E.style.display="none"),await D()})}),document.querySelectorAll(".js-filter-channel").forEach(o=>{o.addEventListener("click",()=>{e.channelFilter=o.getAttribute("data-channel")||"all",i()})}),document.querySelectorAll(".js-filter-tag").forEach(o=>{o.addEventListener("click",()=>{let c=o.getAttribute("data-tag")||"";e.tagFilter=e.tagFilter===c?"":c,i()})});let Y=document.getElementById("inbox-search-input");Y?.addEventListener("input",()=>{e.searchQuery=Y.value,i();let o=document.getElementById("inbox-search-input");o&&(o.focus(),o.setSelectionRange(o.value.length,o.value.length))}),document.querySelectorAll(".js-select-conv").forEach(o=>{o.addEventListener("click",()=>{let c=Number(o.getAttribute("data-conv-id"));if(e.selectedConversationId===c)return;e.selectedConversationId=c,e.messageLimit=250,e.messageSearch={open:!1,query:""};let d=e.conversations.find(y=>y.id===c);d&&(d.unread_count=0),We.has(c)?(e.messages=We.get(c),i()):(e.messages=[],i()),n(`/api/inbox/conversations/${c}/messages?limit=250`).then(y=>{let g=We.get(c)?.length??-1;We.set(c,y),e.selectedConversationId===c&&(y.length!==g||e.messages.length!==y.length)&&(e.messages=y,i())}).catch(()=>{}),n(`/api/inbox/conversations/${c}/read`,{method:"POST"}).catch(()=>{})})}),document.getElementById("btn-toggle-side-drawer-notes")?.addEventListener("click",()=>{e.sideDrawerTab=e.sideDrawerTab==="notes"?"none":"notes",i()}),document.getElementById("btn-toggle-side-drawer-tags")?.addEventListener("click",()=>{e.sideDrawerTab=e.sideDrawerTab==="tags"?"none":"tags",i()}),document.getElementById("btn-close-side-drawer")?.addEventListener("click",()=>{e.sideDrawerTab="none",i()}),document.getElementById("chat-side-drawer-backdrop")?.addEventListener("click",()=>{e.sideDrawerTab="none",i()}),document.getElementById("btn-drawer-open-tag-crud")?.addEventListener("click",()=>{Xe({sub:e,apiFetch:n,refreshInbox:s})});let B=e.conversations.find(o=>o.id===e.selectedConversationId)||e.conversations[0];document.querySelectorAll(".js-toggle-conv-tag").forEach(o=>{o.addEventListener("click",async()=>{if(!B)return;let c=o.getAttribute("data-tag-name")||"";if(!c)return;let d=Ie(B.tags_json),g=d.some(b=>b.toLowerCase()===c.toLowerCase())?d.filter(b=>b.toLowerCase()!==c.toLowerCase()):[...d,c];try{await n(`/api/inbox/conversations/${B.id}/tags`,{method:"PUT",body:JSON.stringify({tags:g,assigned_user_id:B.assigned_user_id})}),await s()}catch(b){$("Error actualizando etiquetas",b.message,"danger")}})});let re=document.getElementById("conv-assigned-user-select");re?.addEventListener("change",async()=>{if(!B)return;let o=re.value?Number(re.value):null;try{await n(`/api/inbox/conversations/${B.id}/tags`,{method:"PUT",body:JSON.stringify({tags:Ie(B.tags_json),assigned_user_id:o})}),await s(),$("Responsable actualizado","Se actualiz\xF3 la asignaci\xF3n del chat.","success")}catch(c){$("Error asignando usuario",c.message,"danger")}}),document.querySelectorAll(".js-manage-user-tags").forEach(o=>{o.addEventListener("click",()=>{let c=Number(o.getAttribute("data-user-id")),d=e.users.find(z=>z.id===c);if(!d)return;let y=document.getElementById("global-form-dialog");if(!y)return;let g=Ie(d.tags_json),b=()=>{y.innerHTML=`
          <div class="crm-form-modal-surface" style="max-width:480px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.85rem;">
              <div>
                <h3 style="font-size:1.05rem;">Etiquetas de ${d.full_name}</h3>
                <p style="font-size:0.78rem;color:var(--text-muted);">Toque las etiquetas para asignarlas o quitarlas de este usuario.</p>
              </div>
              <button type="button" class="btn btn-secondary btn-sm" id="close-user-tags-modal">
                ${l("close",15)}
              </button>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:0.45rem;padding:0.85rem;border-radius:0.75rem;background:var(--surface-subtle);border:1px solid var(--widget-border);margin-bottom:1rem;">
              ${e.tags.map(z=>{let Q=g.some(U=>U.toLowerCase()===z.name.toLowerCase());return Re(z.name,e.tags,`interactive ${Q?"active-filter":""} js-pick-user-tag`,`data-tag-name="${z.name}"`)}).join("")}
            </div>
            <div style="display:flex;justify-content:flex-end;gap:0.5rem;">
              <button type="button" class="btn btn-secondary btn-sm" id="cancel-user-tags-modal">Cerrar</button>
              <button type="button" class="btn btn-primary btn-sm" id="save-user-tags-modal">
                ${l("save",14)}
                <span>Guardar Etiquetas de Usuario</span>
              </button>
            </div>
          </div>
        `,y.querySelector("#close-user-tags-modal")?.addEventListener("click",()=>y.close()),y.querySelector("#cancel-user-tags-modal")?.addEventListener("click",()=>y.close()),y.querySelectorAll(".js-pick-user-tag").forEach(z=>{z.addEventListener("click",()=>{let Q=z.getAttribute("data-tag-name")||"";g=g.some(ee=>ee.toLowerCase()===Q.toLowerCase())?g.filter(ee=>ee.toLowerCase()!==Q.toLowerCase()):[...g,Q],b()})}),y.querySelector("#save-user-tags-modal")?.addEventListener("click",async()=>{try{await n(`/api/users/${d.id}/tags`,{method:"PUT",body:JSON.stringify({tags:g})}),y.close(),await s(),$("Etiquetas de Usuario Guardadas",`Se actualizaron las etiquetas de ${d.full_name}.`,"success")}catch(z){$("Error guardando etiquetas",z.message,"danger")}})};b(),y.showModal()})}),document.getElementById("form-add-conv-note")?.addEventListener("submit",async o=>{if(o.preventDefault(),!B)return;let c=document.getElementById("new-conv-note-input");if(!(!c||!c.value.trim()))try{await n(`/api/inbox/conversations/${B.id}/notes`,{method:"POST",body:JSON.stringify({content:c.value.trim()})}),c.value="",await s(),$("Nota guardada","La nota interna fue a\xF1adida a este cliente.","success")}catch(d){$("Error guardando nota",d.message,"danger")}}),document.querySelectorAll(".js-edit-conv-note").forEach(o=>{o.addEventListener("click",async()=>{let c=Number(o.getAttribute("data-note-id")),d=e.notes.find(g=>g.id===c);if(!d)return;let y=document.getElementById("global-form-dialog");y&&(y.innerHTML=`
        <form id="edit-note-modal-form" class="crm-form-modal-surface" style="max-width:460px;">
          <h3 style="font-size:1.05rem;margin-bottom:0.75rem;">Editar Nota Interna</h3>
          <textarea id="edit-note-textarea" class="form-control" rows="4" required>${d.content}</textarea>
          <div style="display:flex;justify-content:flex-end;gap:0.5rem;margin-top:0.85rem;">
            <button type="button" class="btn btn-secondary btn-sm" id="cancel-edit-note">Cancelar</button>
            <button type="submit" class="btn btn-primary btn-sm">Guardar Cambios</button>
          </div>
        </form>
      `,y.querySelector("#cancel-edit-note")?.addEventListener("click",()=>y.close()),y.querySelector("#edit-note-modal-form")?.addEventListener("submit",async g=>{g.preventDefault();let b=y.querySelector("#edit-note-textarea").value.trim();await n(`/api/inbox/notes/${d.id}`,{method:"PUT",body:JSON.stringify({content:b})}),y.close(),await s()}),y.showModal())})}),document.querySelectorAll(".js-delete-conv-note").forEach(o=>{o.addEventListener("click",async()=>{let c=Number(o.getAttribute("data-note-id"));try{await n(`/api/inbox/notes/${c}`,{method:"DELETE"}),await s()}catch(d){$("Error eliminando nota",d.message,"danger")}})});let J=document.getElementById("chat-composer-input"),ce=document.getElementById("chat-composer-form"),te=document.getElementById("slash-command-popover"),ue=document.getElementById("slash-command-list"),xe=document.getElementById("chat-direct-file-input"),O=document.getElementById("chat-emoji-picker-popover"),p=document.getElementById("chat-emoji-grid"),me=document.getElementById("chat-sticker-panel"),he=document.getElementById("chat-sticker-file-input"),K=document.getElementById("btn-toggle-emoji-picker"),ne={freq:["\u{1F44D}","\u{1F64F}","\u{1F60A}","\u{1F602}","\u2764\uFE0F","\u{1F525}","\u2705","\u{1F44B}","\u{1F389}","\u{1F4AF}","\u{1F44C}","\u{1F91D}","\u{1F64C}","\u{1F609}","\u{1F60D}","\u{1F914}","\u{1F605}","\u{1F680}","\u26A1","\u{1F4CC}","\u{1F4DE}","\u{1F4E1}","\u{1F527}","\u{1F4C4}"],faces:["\u{1F600}","\u{1F603}","\u{1F604}","\u{1F601}","\u{1F606}","\u{1F605}","\u{1F923}","\u{1F602}","\u{1F642}","\u{1F609}","\u{1F60A}","\u{1F607}","\u{1F970}","\u{1F60D}","\u{1F929}","\u{1F618}","\u{1F60B}","\u{1F61B}","\u{1F61C}","\u{1F92A}","\u{1F928}","\u{1F9D0}","\u{1F913}","\u{1F60E}","\u{1F973}","\u{1F60F}","\u{1F612}","\u{1F61E}","\u{1F614}","\u{1F61F}","\u{1F615}","\u{1F641}","\u{1F623}","\u{1F616}","\u{1F62B}","\u{1F629}","\u{1F97A}","\u{1F622}","\u{1F62D}","\u{1F624}","\u{1F620}","\u{1F621}","\u{1F92F}","\u{1F633}","\u{1F631}","\u{1F917}","\u{1F914}","\u{1F92B}","\u{1F636}","\u{1F610}","\u{1F644}","\u{1F634}"],hands:["\u{1F44B}","\u{1F91A}","\u{1F590}\uFE0F","\u270B","\u{1F44C}","\u{1F90C}","\u{1F90F}","\u270C\uFE0F","\u{1F91E}","\u{1F91F}","\u{1F918}","\u{1F919}","\u{1F448}","\u{1F449}","\u{1F446}","\u{1F447}","\u261D\uFE0F","\u{1F44D}","\u{1F44E}","\u270A","\u{1F44A}","\u{1F91B}","\u{1F91C}","\u{1F44F}","\u{1F64C}","\u{1F450}","\u{1F932}","\u{1F91D}","\u{1F64F}","\u{1F4AA}"],work:["\u{1F4E1}","\u{1F310}","\u{1F4BB}","\u{1F4F1}","\u260E\uFE0F","\u{1F527}","\u{1F6E0}\uFE0F","\u{1F4E6}","\u{1F4CB}","\u{1F4C4}","\u{1F4CD}","\u{1F3E0}","\u{1F3E2}","\u{1F697}","\u26A1","\u{1F50C}","\u{1F50B}","\u{1F4A1}","\u{1F514}","\u23F0","\u{1F4C5}","\u{1F4B0}","\u{1F4B3}","\u{1F9FE}","\u{1F4C8}","\u{1F4CA}","\u{1F512}","\u{1F511}"],symbols:["\u2705","\u274C","\u26A0\uFE0F","\u2757","\u2753","\u{1F4AC}","\u{1F4AD}","\u2764\uFE0F","\u{1F9E1}","\u{1F49B}","\u{1F49A}","\u{1F499}","\u{1F49C}","\u{1F5A4}","\u{1F90D}","\u{1F4AF}","\u{1F525}","\u2728","\u2B50","\u{1F31F}","\u{1F3AF}","\u{1F3C6}","\u{1F389}","\u{1F38A}","\u27A1\uFE0F","\u2B05\uFE0F","\u2B06\uFE0F","\u2B07\uFE0F","\u{1F504}"]},Ze=[{id:"ok",emoji:"\u{1F44D}",label:"\xA1Listo!",accent:"#2563eb"},{id:"thanks",emoji:"\u{1F64F}",label:"Gracias",accent:"#10b981"},{id:"hello",emoji:"\u{1F44B}",label:"\xA1Hola!",accent:"#0ea5e9"},{id:"tech",emoji:"\u{1F527}",label:"En camino",accent:"#f59e0b"},{id:"approved",emoji:"\u2705",label:"Aprobado",accent:"#16a34a"},{id:"online",emoji:"\u{1F4E1}",label:"Conectado",accent:"#6366f1"},{id:"great",emoji:"\u2764\uFE0F",label:"Genial",accent:"#e11d48"},{id:"party",emoji:"\u{1F389}",label:"\xA1\xC9xito!",accent:"#9333ea"}],pt=(o,c,d)=>{let y=document.createElement("canvas");y.width=512,y.height=512;let g=y.getContext("2d");return g?(g.clearRect(0,0,512,512),g.save(),g.beginPath(),g.roundRect(36,36,440,440,96),g.fillStyle=d,g.fill(),g.lineWidth=18,g.strokeStyle="#ffffff",g.stroke(),g.restore(),g.textAlign="center",g.textBaseline="middle",g.font='210px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif',g.fillText(o,256,215),g.font='bold 64px "Plus Jakarta Sans", system-ui, sans-serif',g.fillStyle="#ffffff",g.fillText(c,256,395),y.toDataURL("image/webp",.92)):""},Te=o=>new Promise((c,d)=>{if(o.type==="image/webp"&&o.size<=512*1024){let b=new FileReader;b.onload=()=>c(String(b.result||"")),b.onerror=()=>d(new Error("No se pudo leer el archivo WebP.")),b.readAsDataURL(o);return}let y=URL.createObjectURL(o),g=new Image;g.onload=()=>{try{let b=document.createElement("canvas");b.width=512,b.height=512;let z=b.getContext("2d");if(!z){URL.revokeObjectURL(y),d(new Error("Canvas no disponible."));return}z.clearRect(0,0,512,512);let Q=Math.min(480/g.width,480/g.height),U=Math.round(g.width*Q),ee=Math.round(g.height*Q),X=Math.round((512-U)/2),W=Math.round((512-ee)/2);z.drawImage(g,X,W,U,ee);let ae=b.toDataURL("image/webp",.92);URL.revokeObjectURL(y),c(ae)}catch(b){URL.revokeObjectURL(y),d(b)}},g.onerror=()=>{URL.revokeObjectURL(y),d(new Error("Imagen no v\xE1lida para sticker."))},g.src=y}),et=async(o,c="sticker.webp")=>{let d=e.conversations.find(U=>U.id===e.selectedConversationId);if(!d||!o)return;O&&(O.style.display="none",K?.setAttribute("aria-expanded","false"));let y=e.replyingTo?.id||null,g=e.replyingTo?.sender||"",b=e.replyingTo?.body||"",z=e.replyingTo?.media_url||"",Q=e.replyingTo?.media_type||"none";e.replyingTo=null;try{let U=await n(`/api/inbox/conversations/${d.id}/messages`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({body:"",sender:"agent",media_type:"sticker",media_url:o,media_filename:c,media_mimetype:"image/webp",reply_to_id:y,reply_to_sender:g,reply_to_body:b,reply_to_media_url:z,reply_to_media_type:Q})});if(U?.message?.id&&(e.lastSentMessageId=U.message.id),await s(),e.lastSentMessageId){let ee=document.querySelector(`.chat-msg-row[data-id="${e.lastSentMessageId}"]`);ee&&ee.scrollIntoView({behavior:"smooth",block:"end"})}}catch(U){$("Error al enviar sticker",U.message,"danger")}},Me=null,Ne=async()=>{if(!p||!me)return;if(p.style.display="none",me.style.display="flex",!Me)try{Me=(await n("/api/inbox/stickers")).stickers||[]}catch{Me=[]}let o=Me.length>0?`
          <div class="chat-sticker-section-title">Stickers recientes de WhatsApp</div>
          <div class="chat-sticker-grid">
            ${Me.map(d=>`
                  <button type="button" class="chat-sticker-item js-send-existing-sticker" data-sticker-url="${q(d.media_url)}" data-sticker-name="${q(d.media_filename||"sticker.webp")}" title="Enviar sticker">
                    <img src="${q(d.media_url)}" alt="Sticker" class="chat-sticker-thumb" loading="lazy" />
                  </button>
                `).join("")}
          </div>
        `:"",c=`
      <div class="chat-sticker-section-title">Stickers r\xE1pidos</div>
      <div class="chat-sticker-grid">
        ${Ze.map(d=>{let y=pt(d.emoji,d.label,d.accent);return`
            <button type="button" class="chat-sticker-item js-send-quick-sticker" data-sticker-url="${y}" data-sticker-name="sticker_${d.id}.webp" title="Enviar sticker ${q(d.label)}">
              <img src="${y}" alt="${q(d.label)}" class="chat-sticker-thumb" />
            </button>
          `}).join("")}
      </div>
    `;me.innerHTML=`
      <div class="chat-sticker-toolbar">
        <button type="button" class="chat-sticker-upload-btn" id="btn-upload-custom-sticker">
          ${l("plus",14)}
          <span>Crear sticker desde imagen</span>
        </button>
      </div>
      <div class="chat-sticker-scroll">
        ${o}
        ${c}
      </div>
    `,me.querySelector("#btn-upload-custom-sticker")?.addEventListener("click",d=>{d.stopPropagation(),he?.click()}),me.querySelectorAll(".js-send-existing-sticker, .js-send-quick-sticker").forEach(d=>{d.addEventListener("click",y=>{y.stopPropagation();let g=d.getAttribute("data-sticker-url")||"",b=d.getAttribute("data-sticker-name")||"sticker.webp";et(g,b)})})},Qe=o=>{if(o==="stickers"){Ne();return}if(!p)return;me&&(me.style.display="none"),p.style.display="grid";let c=ne[o]||ne.freq;p.innerHTML=c.map(d=>`<button type="button" class="chat-emoji-item" data-emoji="${d}">${d}</button>`).join(""),p.querySelectorAll(".chat-emoji-item").forEach(d=>{d.addEventListener("click",y=>{y.stopPropagation();let g=d.getAttribute("data-emoji")||"",b=document.getElementById("chat-composer-input");if(!b||!g)return;let z=b.selectionStart??b.value.length,Q=b.selectionEnd??b.value.length;b.value=b.value.slice(0,z)+g+b.value.slice(Q);let U=z+g.length;b.focus();try{b.setSelectionRange(U,U)}catch{}b.dispatchEvent(new Event("input",{bubbles:!0}))})})};if(he&&he.addEventListener("change",async()=>{let o=he.files?.[0];if(he.value="",!!o)try{let c=await Te(o);Me=null,await et(c,`sticker_${Date.now()}.webp`)}catch(c){$("Error al crear sticker",c.message,"danger")}}),O&&K){Qe("freq"),K.addEventListener("click",c=>{c.stopPropagation();let d=O.style.display==="flex";O.style.display=d?"none":"flex",K.setAttribute("aria-expanded",d?"false":"true")}),O.addEventListener("click",c=>{c.stopPropagation()}),O.querySelectorAll(".chat-emoji-tab").forEach(c=>{c.addEventListener("click",d=>{d.stopPropagation();let y=c.getAttribute("data-emoji-cat")||"freq";O.querySelectorAll(".chat-emoji-tab").forEach(g=>{g.classList.remove("active"),g.setAttribute("aria-selected","false")}),c.classList.add("active"),c.setAttribute("aria-selected","true"),Qe(y)})});let o=window;o.__turboEmojiDocListenersBound||(o.__turboEmojiDocListenersBound=!0,document.addEventListener("click",()=>{let c=document.getElementById("chat-emoji-picker-popover"),d=document.getElementById("btn-toggle-emoji-picker");c&&c.style.display==="flex"&&(c.style.display="none",d?.setAttribute("aria-expanded","false"))}),document.addEventListener("keydown",c=>{if(c.key==="Escape"){let d=document.getElementById("chat-emoji-picker-popover"),y=document.getElementById("btn-toggle-emoji-picker");d&&d.style.display==="flex"&&(d.style.display="none",y?.setAttribute("aria-expanded","false"),y?.focus())}}))}document.getElementById("btn-attach-media-file")?.addEventListener("click",()=>{xe?.click()}),xe?.addEventListener("change",async()=>{let o=xe.files?.[0];if(o){if(o.type.startsWith("image/")){let c=e.conversations.find(d=>d.id===e.selectedConversationId);mt({imageFile:o,onSend:async d=>{if(!c)return;let y=e.replyingTo?.id||null,g=e.replyingTo?.sender||"",b=e.replyingTo?.body||"",z=e.replyingTo?.media_url||"",Q=e.replyingTo?.media_type||"none";e.replyingTo=null;try{let U=await n(`/api/inbox/conversations/${c.id}/messages`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({body:d.caption||"",sender:"agent",media_type:"image",media_url:d.dataUrl,media_filename:d.filename,media_mimetype:"image/jpeg",reply_to_id:y,reply_to_sender:g,reply_to_body:b,reply_to_media_url:z,reply_to_media_type:Q})});if(U?.message?.id&&(e.lastSentMessageId=U.message.id),await s(),e.lastSentMessageId){let ee=document.querySelector(`.chat-msg-row[data-id="${e.lastSentMessageId}"]`);ee&&(ee.scrollIntoView({behavior:"smooth",block:"end"}),ee.classList.add("chat-msg-highlight-pulse"),setTimeout(()=>{ee.classList.remove("chat-msg-highlight-pulse"),e.lastSentMessageId===U?.message?.id&&(e.lastSentMessageId=null)},2600))}}catch(U){$("Error enviando imagen",U.message,"danger")}finally{document.getElementById("chat-composer-input")?.focus()}}}),xe.value="";return}try{let c=await it(o);e.pendingAttachment={media_type:At(o.type),media_url:c,media_filename:o.name,media_mimetype:o.type||"application/octet-stream"},i(),document.getElementById("chat-composer-input")?.focus()}catch(c){$("Error adjuntando archivo",c.message,"danger")}}}),document.getElementById("btn-clear-pending-media")?.addEventListener("click",()=>{e.pendingAttachment=null,i()}),document.getElementById("btn-popover-manage-qr")?.addEventListener("click",()=>{Pe({sub:e,apiFetch:n,refreshInbox:s,onSelect:_})});let de=0,pe=()=>{if(!J||!te||!ue)return;let c=J.value.trim();if(!c.startsWith("/")){te.style.display="none";return}let d=c.slice(1).trim().toLowerCase(),y=e.quickReplies.filter(g=>g.shortcut.toLowerCase().includes(d)||g.title.toLowerCase().includes(d)||g.body.toLowerCase().includes(d));if(y.length===0){ue.innerHTML=`
        <div style="padding:0.85rem 1rem;font-size:0.8rem;color:var(--text-muted);display:flex;align-items:center;justify-content:space-between;gap:0.5rem;">
          <span>No hay respuestas autom\xE1ticas con "<strong>/${d}</strong>".</span>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-quick-create-qr" style="padding:0.2rem 0.5rem;font-size:0.72rem;">
            ${l("plus",11)}
            <span>Crear nueva</span>
          </button>
        </div>
      `,ue.querySelector("#btn-quick-create-qr")?.addEventListener("click",()=>{Pe({sub:e,apiFetch:n,refreshInbox:s,onSelect:_})}),te.style.display="flex";return}de=0,ue.innerHTML=y.map((g,b)=>`
        <button type="button" class="slash-command-item ${b===0?"active":""} js-pick-slash-qr" data-qr-id="${g.id}" data-index="${b}">
          <div style="min-width:0;flex:1;">
            <div style="display:flex;align-items:center;gap:0.45rem;">
              <span class="slash-shortcut-code">/${g.shortcut}</span>
              <strong style="font-size:0.82rem;">${g.title}</strong>
              ${g.media_type&&g.media_type!=="none"?`<span class="tag-pill-minimal" style="--tag-color:var(--widget-accent);">
                      ${l(xt(g.media_type),10)}
                      <span>${Ge(g.media_type)}</span>
                    </span>`:""}
            </div>
            <div style="font-size:0.75rem;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:0.15rem;">
              ${g.body}
            </div>
          </div>
          <span style="font-size:0.7rem;color:var(--text-muted);flex:none;">Usar \u21B5</span>
        </button>
      `).join(""),te.style.display="flex",ue.querySelectorAll(".js-pick-slash-qr").forEach(g=>{g.addEventListener("click",b=>{b.stopPropagation();let z=Number(g.getAttribute("data-qr-id")),Q=e.quickReplies.find(U=>U.id===z);Q&&_(Q)})})};document.getElementById("btn-trigger-slash-menu")?.addEventListener("click",o=>{if(o.stopPropagation(),!!J){if(te&&te.style.display==="flex"){te.style.display="none";return}J.value.trim().startsWith("/")||(J.value="/"),J.focus(),pe()}});let De=()=>{let o=document.getElementById("btn-chat-action"),c=o?.querySelector(".chat-action-icon-send"),d=o?.querySelector(".chat-action-icon-mic"),y=!!J?.value.trim(),g=!!e.pendingAttachment;o&&c&&d&&(y||g?(o.classList.remove("is-mic"),o.classList.add("is-send"),o.title="Enviar mensaje",c.style.display="inline-flex",d.style.display="none"):(o.classList.remove("is-send"),o.classList.add("is-mic"),o.title="Grabar nota de voz",c.style.display="none",d.style.display="inline-flex"))},Z=null,Le=[],Ae=!1,Oe=null,Se=0,Fe=async()=>{let o=document.getElementById("btn-chat-action");if(o){if(Ae){Z&&Z.state!=="inactive"&&Z.stop();return}if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){$("Audio no soportado","Su navegador no soporta grabaci\xF3n directa de audio.","info");return}try{let c=await navigator.mediaDevices.getUserMedia({audio:!0});Z=new MediaRecorder(c),Le=[],Se=0,Ae=!0,o.classList.add("is-recording"),o.title="Detener y enviar nota de voz";let d=document.createElement("div");d.id="live-recording-indicator",d.className="live-voice-recording-bar",d.innerHTML=`
        <div style="display:flex;align-items:center;gap:0.6rem;color:#ef4444;font-size:0.85rem;font-weight:600;">
          <span class="recording-pulse-dot"></span>
          <span>Grabando nota de voz... <strong id="recording-timer-text">0:00</strong></span>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-recording" style="padding:0.2rem 0.5rem;font-size:0.75rem;">
          ${l("close",12)}
          <span>Cancelar</span>
        </button>
      `,document.querySelector(".chat-composer-area")?.prepend(d),Oe=window.setInterval(()=>{Se++;let g=Math.floor(Se/60),b=Se%60,z=document.getElementById("recording-timer-text");z&&(z.textContent=`${g}:${b<10?"0":""}${b}`)},1e3),d.querySelector("#btn-cancel-recording")?.addEventListener("click",g=>{g.stopPropagation(),qe(!0),c.getTracks().forEach(b=>b.stop())}),Z.ondataavailable=g=>{g.data.size>0&&Le.push(g.data)},Z.onstop=async()=>{if(c.getTracks().forEach(g=>g.stop()),qe(!1),Le.length>0){let g=new Blob(Le,{type:"audio/ogg; codecs=opus"}),b=new FileReader;b.onload=async()=>{let z=String(b.result);e.pendingAttachment={media_type:"audio",media_url:z,media_filename:`nota_voz_${Date.now()}.ogg`,media_mimetype:"audio/ogg"},i()},b.readAsDataURL(g)}},Z.start()}catch{Ae=!1,o.classList.remove("is-recording"),$("Permiso de Micr\xF3fono","Se requiere acceso al micr\xF3fono para grabar notas de voz.","info")}}},qe=o=>{Ae=!1,Oe!==null&&(window.clearInterval(Oe),Oe=null),document.getElementById("live-recording-indicator")?.remove(),document.getElementById("btn-chat-action")?.classList.remove("is-recording"),o&&(Le=[])},ie=document.getElementById("composer-link-preview-box"),Ee="",x="",M=null,I=(o,c,d)=>{if(!ie)return;let y=o.title||c,g=o.description||"",b=o.image||"",z=o.favicon||`https://www.google.com/s2/favicons?domain=${encodeURIComponent(c)}&sz=128`;ie.style.display="block",ie.innerHTML=`
      <div class="composer-link-preview-bar">
        ${b?`
          <div class="composer-link-preview-thumb-box">
            <img src="${b}" alt="" class="composer-link-preview-thumb" onerror="this.src='${z}'; this.style.objectFit='contain'; this.style.padding='8px';" />
          </div>
        `:`
          <div class="composer-link-preview-favicon-box">
            <img src="${z}" alt="" class="composer-link-preview-favicon" />
          </div>
        `}
        <div class="composer-link-preview-content">
          <div class="composer-link-preview-header">
            <span class="composer-link-preview-badge">${l("externalLink",11)} ${q(o.domain||c)}</span>
          </div>
          <strong class="composer-link-preview-title">${q(y)}</strong>
          ${g?`<p class="composer-link-preview-desc">${q(g)}</p>`:""}
        </div>
        <button type="button" class="composer-link-preview-close js-dismiss-link-preview" title="Quitar vista previa">
          ${l("close",14)}
        </button>
      </div>
    `,ie.querySelector(".js-dismiss-link-preview")?.addEventListener("click",Q=>{Q.stopPropagation(),x=d,Ee="",ie.style.display="none",ie.innerHTML="",J?.focus()})},v=()=>{if(!ie||!J)return;let o=J.value||"",c=Dt(o);if(c.length===0){Ee="",ie.style.display="none",ie.innerHTML="";return}let d=c[0];if(d===x){ie.style.display="none";return}if(d===Ee&&ie.innerHTML){ie.style.display="block";return}Ee=d;let y=d;try{y=new URL(d).hostname.replace(/^www\./,"")}catch{}let g=Ye.get(d);if(g){I(g,y,d);return}ie.style.display="block",ie.innerHTML=`
      <div class="composer-link-preview-bar is-loading">
        <div class="composer-link-preview-spinner-box">
          <div class="wa-media-loading-spinner" style="width:18px;height:18px;border-width:2px;"></div>
        </div>
        <div class="composer-link-preview-content">
          <div class="composer-link-preview-header">
            <span class="composer-link-preview-badge">${l("externalLink",11)} ${q(y)}</span>
          </div>
          <div class="composer-link-preview-loading-text">Obteniendo informaci\xF3n del enlace...</div>
        </div>
        <button type="button" class="composer-link-preview-close js-dismiss-link-preview" title="Quitar vista previa">
          ${l("close",14)}
        </button>
      </div>
    `,ie.querySelector(".js-dismiss-link-preview")?.addEventListener("click",b=>{b.stopPropagation(),x=d,Ee="",ie.style.display="none",ie.innerHTML="",J?.focus()}),fetch(`/api/link-preview?url=${encodeURIComponent(d)}`).then(b=>b.json()).then(b=>{Ee===d&&b&&!b.error&&(Ye.set(d,b),I(b,y,d))}).catch(()=>{})};J?.addEventListener("input",()=>{pe(),De(),J&&(J.style.height="auto",J.style.height=`${Math.min(J.scrollHeight,120)}px`),clearTimeout(M),M=setTimeout(v,320)}),J?.value.trim()&&v(),document.addEventListener("click",o=>{if(!te||te.style.display==="none")return;let c=o.target;!te.contains(c)&&c.id!=="btn-trigger-slash-menu"&&c!==J&&(te.style.display="none")}),J?.addEventListener("keydown",o=>{if(te&&te.style.display!=="none"){let c=Array.from(ue?.querySelectorAll(".slash-command-item")||[]);if(o.key==="Escape"){te.style.display="none";return}if(o.key==="ArrowDown"){o.preventDefault(),c.length>0&&(c[de]?.classList.remove("active"),de=(de+1)%c.length,c[de]?.classList.add("active"),c[de]?.scrollIntoView({block:"nearest"}));return}if(o.key==="ArrowUp"){o.preventDefault(),c.length>0&&(c[de]?.classList.remove("active"),de=(de-1+c.length)%c.length,c[de]?.classList.add("active"),c[de]?.scrollIntoView({block:"nearest"}));return}if(o.key==="Tab"||o.key==="Enter"&&!o.shiftKey){o.preventDefault();let d=c[de]||c[0];if(d){let y=Number(d.getAttribute("data-qr-id")),g=e.quickReplies.find(b=>b.id===y);if(g){_(g);return}}}}if(o.key==="Enter"&&!o.shiftKey){if(o.preventDefault(),o.isComposing||o.keyCode===229)return;ce?.requestSubmit()}});let F=async o=>{let c=o.clipboardData?.items;if(!(!c||c.length===0)){for(let d=0;d<c.length;d++){let y=c[d];if(y.type.indexOf("image")!==-1||y.kind==="file"&&y.type.startsWith("image/")){let g=y.getAsFile();if(g){o.preventDefault();try{let b=await it(g);e.pendingAttachment={media_type:"image",media_url:b,media_filename:g.name||`captura_${Date.now()}.png`,media_mimetype:g.type||"image/png"},i(),document.getElementById("chat-composer-input")?.focus(),$("Imagen pegada (Ctrl + V)","Captura adjuntada lista para enviar.","info")}catch(b){$("Error al procesar imagen pegada",b.message,"danger")}return}}}setTimeout(v,80)}};J?.addEventListener("paste",F),ce?.addEventListener("submit",async o=>{if(o.preventDefault(),!B)return;if(Ee="",x="",ie&&(ie.style.display="none",ie.innerHTML=""),document.getElementById("btn-chat-action")?.classList.contains("is-mic")&&!e.pendingAttachment&&!J?.value.trim()){Fe();return}let y=J?.value.trim()||"",g=e.pendingAttachment;if(!y&&!g){J?.focus();return}J&&(J.value="",J.style.height="auto",J.focus()),e.pendingAttachment=null,te&&(te.style.display="none"),De();let b=e.replyingTo?.id||null,z=e.replyingTo?.sender||"",Q=e.replyingTo?.body||"",U=e.replyingTo?.media_url||"",ee=e.replyingTo?.media_type||"none";e.replyingTo=null;try{let X=`/api/inbox/conversations/${B.id}/messages`,W={body:y,media_type:g?.media_type||"none",media_url:g?.media_url||"",media_filename:g?.media_filename||"",media_mimetype:g?.media_mimetype||"",reply_to_id:b,reply_to_sender:z,reply_to_body:Q,reply_to_media_url:U,reply_to_media_type:ee},ae=!!(g&&g.media_url.length>7e5),ke=ae?hn(g?.media_filename||"archivo"):null,$e;try{$e=ae?await fn(X,W,ge=>ke?.update(ge)):await n(X,{method:"POST",body:JSON.stringify(W)})}finally{ke?.done()}if($e?.message?.id&&(e.lastSentMessageId=$e.message.id),await s(),e.lastSentMessageId){let ge=document.querySelector(`.chat-msg-row[data-id="${e.lastSentMessageId}"]`);ge&&(ge.scrollIntoView({behavior:"smooth",block:"end"}),ge.classList.add("chat-msg-highlight-pulse"),setTimeout(()=>{ge.classList.remove("chat-msg-highlight-pulse"),e.lastSentMessageId===$e?.message?.id&&(e.lastSentMessageId=null)},2600))}}catch(X){$("Error al enviar mensaje",X.message,"danger")}finally{document.getElementById("chat-composer-input")?.focus()}}),document.querySelectorAll(".js-reply-msg").forEach(o=>{o.addEventListener("click",c=>{c.stopPropagation();let d=Number(o.getAttribute("data-id")),y=o.getAttribute("data-sender")||"Contacto",g=o.getAttribute("data-body")||"",b=o.getAttribute("data-media-type")||"none",z=o.getAttribute("data-media-url")||"";if(!d)return;e.replyingTo={id:d,sender:y,body:g,media_type:b,media_url:z},i(),document.getElementById("chat-composer-input")?.focus()})}),document.querySelectorAll(".chat-msg-row").forEach(o=>{o.addEventListener("dblclick",c=>{c.stopPropagation();let d=Number(o.getAttribute("data-id")),y=o.getAttribute("data-sender")||"Contacto",g=o.getAttribute("data-body")||"",b=o.getAttribute("data-media-type")||"none",z=o.getAttribute("data-media-url")||"";if(!d)return;e.replyingTo={id:d,sender:y,body:g,media_type:b,media_url:z},i(),document.getElementById("chat-composer-input")?.focus()})}),document.querySelectorAll(".js-jump-to-reply").forEach(o=>{o.addEventListener("click",c=>{c.stopPropagation();let d=o.getAttribute("data-target-id");if(!d)return;let y=document.querySelector(`.chat-msg-row[data-id="${d}"]`);y?(y.scrollIntoView({behavior:"smooth",block:"center"}),y.classList.remove("chat-msg-highlight-pulse"),y.offsetWidth,y.classList.add("chat-msg-highlight-pulse"),setTimeout(()=>{y.classList.remove("chat-msg-highlight-pulse")},2600)):$("Mensaje citado","El mensaje original se encuentra en el historial anterior.","info")})}),document.querySelectorAll(".js-forward-msg").forEach(o=>{o.addEventListener("click",c=>{c.stopPropagation();let d=Number(o.getAttribute("data-id")),y=o.getAttribute("data-sender")||"",g=o.getAttribute("data-body")||"",b=o.getAttribute("data-media-type")||"none",z=o.getAttribute("data-media-url")||"",Q=o.getAttribute("data-media-filename")||"";d&&Bt({messageId:d,sender:y,body:g,mediaType:b,mediaUrl:z,mediaFilename:Q,sub:e,apiFetch:n,refreshInbox:s})})});let A=document.getElementById("chat-messages-scroller");A&&A.addEventListener("contextmenu",o=>{let d=o.target?.closest(".chat-msg-row");if(!d)return;o.preventDefault(),o.stopPropagation(),document.querySelectorAll(".chat-msg-context-menu").forEach(we=>we.remove());let y=Number(d.getAttribute("data-id")),g=d.getAttribute("data-sender")||"",b=d.getAttribute("data-body")||"",z=d.getAttribute("data-media-type")||"none",Q=d.getAttribute("data-media-url")||"",U=d.getAttribute("data-media-filename")||"",ee=d.getAttribute("data-is-incoming")==="true",X=d.getAttribute("data-is-deleted")==="true";if(!y||X)return;let W=document.createElement("div");W.className="chat-msg-context-menu";let ae=!ee&&!X&&(z==="none"||!!b);W.innerHTML=`
        <button type="button" class="chat-context-menu-item js-ctx-copy">
          ${l("copy",14)}
          <span>Copiar mensaje</span>
        </button>
        <button type="button" class="chat-context-menu-item js-ctx-reply">
          ${l("cornerUpLeft",14)}
          <span>Responder</span>
        </button>
        <button type="button" class="chat-context-menu-item js-ctx-forward">
          ${l("forward",14)}
          <span>Reenviar</span>
        </button>
        ${ae?`
          <button type="button" class="chat-context-menu-item js-ctx-edit">
            ${l("edit",14)}
            <span>Editar mensaje</span>
          </button>
        `:""}
        <div class="chat-context-menu-divider"></div>
        <button type="button" class="chat-context-menu-item danger js-ctx-delete">
          ${l("trash",14)}
          <span>Eliminar mensaje</span>
        </button>
      `,document.body.appendChild(W);let ke=195,$e=ae?210:170,ge=o.clientX,fe=o.clientY;ge+ke>window.innerWidth&&(ge=window.innerWidth-ke-12),fe+$e>window.innerHeight&&(fe=window.innerHeight-$e-12),W.style.left=`${Math.max(10,ge)}px`,W.style.top=`${Math.max(10,fe)}px`;let ve=()=>{W.remove(),document.removeEventListener("click",_e),document.removeEventListener("keydown",tt)},_e=we=>{W.contains(we.target)||ve()},tt=we=>{we.key==="Escape"&&ve()};setTimeout(()=>{document.addEventListener("click",_e),document.addEventListener("keydown",tt)},10),W.querySelector(".js-ctx-copy")?.addEventListener("click",async()=>{ve();let we=b||Q;if(we)try{await navigator.clipboard.writeText(we),$("Copiado","Contenido copiado al portapapeles.","info")}catch{$("Error","No se pudo copiar al portapapeles.","danger")}}),W.querySelector(".js-ctx-reply")?.addEventListener("click",()=>{ve(),e.replyingTo={id:y,sender:g,body:b,media_type:z,media_url:Q},i(),document.getElementById("chat-composer-input")?.focus()}),W.querySelector(".js-ctx-forward")?.addEventListener("click",()=>{ve(),Bt({messageId:y,sender:g,body:b,mediaType:z,mediaUrl:Q,mediaFilename:U,sub:e,apiFetch:n,refreshInbox:s})}),W.querySelector(".js-ctx-edit")?.addEventListener("click",()=>{ve(),bn({messageId:y,currentBody:b,sub:e,apiFetch:n,refreshInbox:s})}),W.querySelector(".js-ctx-delete")?.addEventListener("click",async()=>{if(ve(),await ot({title:"\xBFEliminar este mensaje?",description:"El mensaje se marcar\xE1 como eliminado para todos los participantes.",confirmLabel:"Eliminar Mensaje",cancelLabel:"Cancelar",danger:!0}))try{await n(`/api/inbox/messages/${y}`,{method:"DELETE"}),$("Mensaje eliminado","El mensaje ha sido eliminado correctamente.","info"),await s()}catch(ut){$("Error al eliminar",ut.message||"No se pudo eliminar el mensaje.","danger")}})}),document.querySelector(".js-cancel-reply")?.addEventListener("click",o=>{o.stopPropagation(),e.replyingTo=null,i(),document.getElementById("chat-composer-input")?.focus()});let C=document.getElementById("chat-main-column"),V=document.getElementById("chat-dropzone-overlay");if(C&&V){let o=0;C.addEventListener("dragenter",c=>{c.preventDefault(),c.stopPropagation(),o++,V.style.display="flex"}),C.addEventListener("dragover",c=>{c.preventDefault(),c.stopPropagation()}),C.addEventListener("dragleave",c=>{c.preventDefault(),c.stopPropagation(),o--,o<=0&&(o=0,V.style.display="none")}),C.addEventListener("drop",async c=>{c.preventDefault(),c.stopPropagation(),o=0,V.style.display="none";let d=c.dataTransfer?.files;if(!d||d.length===0)return;let y=d[0];if(y.type.startsWith("image/")){let g=e.conversations.find(b=>b.id===e.selectedConversationId);mt({imageFile:y,onSend:async b=>{if(!g)return;let z=e.replyingTo?.id||null,Q=e.replyingTo?.sender||"",U=e.replyingTo?.body||"",ee=e.replyingTo?.media_url||"",X=e.replyingTo?.media_type||"none";e.replyingTo=null;try{let W=await n(`/api/inbox/conversations/${g.id}/messages`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({body:b.caption||"",sender:"agent",media_type:"image",media_url:b.dataUrl,media_filename:b.filename,media_mimetype:"image/jpeg",reply_to_id:z,reply_to_sender:Q,reply_to_body:U,reply_to_media_url:ee,reply_to_media_type:X})});if(W?.message?.id&&(e.lastSentMessageId=W.message.id),await s(),e.lastSentMessageId){let ae=document.querySelector(`.chat-msg-row[data-id="${e.lastSentMessageId}"]`);ae&&(ae.scrollIntoView({behavior:"smooth",block:"end"}),ae.classList.add("chat-msg-highlight-pulse"),setTimeout(()=>{ae.classList.remove("chat-msg-highlight-pulse"),e.lastSentMessageId===W?.message?.id&&(e.lastSentMessageId=null)},2600))}}catch(W){$("Error enviando imagen",W.message,"danger")}finally{document.getElementById("chat-composer-input")?.focus()}}});return}try{let g=await it(y);e.pendingAttachment={media_type:At(y.type),media_url:g,media_filename:y.name,media_mimetype:y.type||"application/octet-stream"},i(),document.getElementById("chat-composer-input")?.focus()}catch(g){$("Error adjuntando archivo",g.message,"danger")}})}document.getElementById("btn-open-broadcast-modal")?.addEventListener("click",D),document.querySelectorAll(".js-open-media-lightbox").forEach(o=>{o.addEventListener("click",c=>{c.preventDefault(),c.stopPropagation();let d=o.getAttribute("data-media-type")||"image",y=o.getAttribute("data-media-url")||"",g=o.getAttribute("data-media-title")||"Archivo adjunto";y&&pn({mediaType:d,mediaUrl:y,mediaTitle:g})})});let le=document.getElementById("chat-messages-scroller");le&&un(le,o=>{e.replyingTo=o,i(),document.getElementById("chat-composer-input")?.focus()}),document.getElementById("btn-request-notif-permission")?.addEventListener("click",async()=>{if(typeof Notification<"u")try{await Notification.requestPermission()==="granted"&&($("Notificaciones activadas","Recibir\xE1s alertas en tiempo real de nuevos mensajes.","success"),Wt()),i()}catch{}}),document.getElementById("btn-dismiss-notif-banner")?.addEventListener("click",()=>{sessionStorage.setItem("nexus_dismiss_notif_banner","1");let o=document.getElementById("inbox-notification-banner");o&&(o.style.display="none")}),document.querySelectorAll(".js-opt-new-contact").forEach(o=>{o.addEventListener("click",()=>{k&&(k.style.display="none"),E&&(E.style.display="none"),mn({sub:e,apiFetch:n,refreshInbox:s,rerender:i})})}),sn().catch(()=>{})}function Jt(t){let{sub:e,apiFetch:n,rerender:s}=t,r=e.connections||{};r&&(ct(),r.wa_active_mode==="qr"&&(rt=window.setInterval(async()=>{if(!document.getElementById("wa-qr-live-panel")){ct();return}try{let m=(await n("/api/connections")).connections,u=e.connections?.wa_qr_status,h=e.connections?.wa_qr_session_code;if(u!=="connected"&&m.wa_qr_status==="connected"){e.connections=m,$("\xA1WhatsApp Vinculado en Tiempo Real!",`Su dispositivo ${m.wa_qr_phone} se ha sincronizado exitosamente con el Servidor QR Interno.`,"success"),s();return}if(m.wa_qr_status!==u||m.wa_qr_session_code!==h){e.connections=m;let f=document.getElementById("wa-real-qr-img");f&&m.wa_qr_status==="awaiting_scan"&&m.wa_qr_session_code?.startsWith("data:image/")?f.src=m.wa_qr_session_code:s()}}catch{}},2200)),document.querySelectorAll(".js-select-wa-mode").forEach(i=>{i.addEventListener("click",async()=>{let m=i.getAttribute("data-mode");if(!(!m||r.wa_active_mode===m))try{let u=await n("/api/connections",{method:"PUT",body:JSON.stringify({wa_active_mode:m})});e.connections=u.connections,$(m==="qr"?"Modo Servidor QR Activado":"Modo WhatsApp Cloud API Activado",m==="qr"?"WhatsApp operar\xE1 mediante c\xF3digo QR interno (compatible con WhatsApp Normal y Business).":"WhatsApp operar\xE1 mediante Cloud API oficial con soporte de Mensajes Masivos y Chatbot.","info"),s()}catch(u){$("Error cambiando modalidad",u.message,"danger")}})}),document.getElementById("btn-wa-qr-generate")?.addEventListener("click",async i=>{let m=i.currentTarget;m.disabled=!0;try{let u=document.getElementById("conn-wa-qr-phone")?.value,h=await n("/api/connections/whatsapp-qr/action",{method:"POST",body:JSON.stringify({action:"generate_qr",phone:u})});e.connections=h.connections,$("Nuevo C\xF3digo QR Oficial Generado","Abra WhatsApp o WhatsApp Business -> Dispositivos vinculados -> Vincular un dispositivo y escanee el c\xF3digo.","info"),s()}catch(u){$("Error generando QR",u.message,"danger"),m.disabled=!1}}),document.getElementById("btn-wa-qr-disconnect")?.addEventListener("click",async()=>{if(await ot({title:"\xBFDesvincular sesi\xF3n QR de WhatsApp?",description:"El servidor interno dejar\xE1 de recibir mensajes hasta que vuelva a escanear un c\xF3digo QR.",confirmLabel:"S\xED, desvincular QR",danger:!0}))try{let m=await n("/api/connections/whatsapp-qr/action",{method:"POST",body:JSON.stringify({action:"disconnect"})});e.connections=m.connections,$("Sesi\xF3n QR cerrada","El dispositivo fue desvinculado.","warning"),s()}catch(m){$("Error al desconectar",m.message,"danger")}}),document.getElementById("btn-copy-webhook")?.addEventListener("click",i=>{let m=i.currentTarget.getAttribute("data-url")||"";navigator.clipboard?.writeText(m).catch(()=>{}),$("Webhook Copiado",`URL copiada al portapapeles: ${m}`,"info")}),document.querySelector(".js-verify-fb-conn")?.addEventListener("click",async i=>{let m=i.currentTarget;m.disabled=!0;let u=document.getElementById("conn-fb-token")?.value?.trim(),h=document.getElementById("conn-fb-page-id")?.value?.trim(),f=document.getElementById("conn-fb-page-name")?.value?.trim();try{let w=await n("/api/connections/facebook/verify",{method:"POST",body:JSON.stringify({token:u,page_id:h,page_name:f})});e.connections=w.connections,$("Facebook Conectado y Verificado",`P\xE1gina "${w.pageName}" vinculada exitosamente. Se sincronizaron ${w.syncedConversations} chats y ${w.syncedMessages} mensajes.`,"success"),s()}catch(w){$("Error al verificar Facebook",w.message,"danger"),m.disabled=!1}}),document.querySelector(".js-disconnect-fb-conn")?.addEventListener("click",async()=>{try{let i=await n("/api/connections/facebook/disconnect",{method:"POST"});e.connections=i.connections,$("Facebook Desconectado","La Fan Page fue desvinculada de la bandeja.","info"),s()}catch(i){$("Error al desconectar",i.message,"danger")}}),document.querySelector(".js-verify-ig-conn")?.addEventListener("click",async i=>{let m=i.currentTarget;m.disabled=!0;let u=document.getElementById("conn-ig-username")?.value?.trim(),h=document.getElementById("conn-ig-id")?.value?.trim(),f=document.getElementById("conn-ig-token")?.value?.trim();try{let w=await n("/api/connections/instagram/verify",{method:"POST",body:JSON.stringify({username:u,account_id:h,token:f})});e.connections=w.connections,$("Instagram Conectado","Cuenta profesional de Instagram vinculada con \xE9xito.","success"),s()}catch(w){$("Error al verificar Instagram",w.message,"danger"),m.disabled=!1}}),document.querySelector(".js-disconnect-ig-conn")?.addEventListener("click",async()=>{try{let i=await n("/api/connections/instagram/disconnect",{method:"POST"});e.connections=i.connections,$("Instagram Desconectado","La cuenta de Instagram fue desvinculada.","info"),s()}catch(i){$("Error al desconectar",i.message,"danger")}}),document.querySelector(".js-verify-tt-conn")?.addEventListener("click",async i=>{let m=i.currentTarget;m.disabled=!0;let u=document.getElementById("conn-tt-handle")?.value?.trim(),h=document.getElementById("conn-tt-key")?.value?.trim(),f=document.getElementById("conn-tt-token")?.value?.trim();try{let w=await n("/api/connections/tiktok/verify",{method:"POST",body:JSON.stringify({handle:u,client_key:h,token:f})});e.connections=w.connections,$("TikTok Conectado","Perfil comercial de TikTok vinculado con \xE9xito.","success"),s()}catch(w){$("Error al verificar TikTok",w.message,"danger"),m.disabled=!1}}),document.querySelector(".js-disconnect-tt-conn")?.addEventListener("click",async()=>{try{let i=await n("/api/connections/tiktok/disconnect",{method:"POST"});e.connections=i.connections,$("TikTok Desconectado","El perfil comercial de TikTok fue desvinculado.","info"),s()}catch(i){$("Error al desconectar",i.message,"danger")}}),document.getElementById("btn-save-all-connections")?.addEventListener("click",async()=>{let i=h=>document.getElementById(h)?.value?.trim(),m=h=>document.getElementById(h)?.checked,u={wa_qr_phone:i("conn-wa-qr-phone")??r.wa_qr_phone,wa_qr_device:i("conn-wa-qr-device")??r.wa_qr_device,wa_phone_number_id:i("conn-wa-phone-id")??r.wa_phone_number_id,wa_business_account_id:i("conn-wa-waba-id")??r.wa_business_account_id,wa_verify_token:i("conn-wa-verify-token")??r.wa_verify_token,wa_access_token:i("conn-wa-access-token")??r.wa_access_token,wa_mass_messaging_enabled:m("conn-wa-mass-enabled")??r.wa_mass_messaging_enabled,wa_chatbot_enabled:m("conn-wa-chatbot-enabled")??r.wa_chatbot_enabled,wa_chatbot_prompt:document.getElementById("conn-wa-chatbot-prompt")?.value?.trim()??r.wa_chatbot_prompt,fb_page_name:i("conn-fb-page-name")??r.fb_page_name,fb_page_id:i("conn-fb-page-id")??r.fb_page_id,fb_access_token:i("conn-fb-token")??r.fb_access_token,fb_auto_sync:m("conn-fb-sync")??r.fb_auto_sync,ig_username:i("conn-ig-username")??r.ig_username,ig_account_id:i("conn-ig-id")??r.ig_account_id,ig_access_token:i("conn-ig-token")??r.ig_access_token,ig_sync_stories:m("conn-ig-stories")??r.ig_sync_stories,tt_account_handle:i("conn-tt-handle")??r.tt_account_handle,tt_client_key:i("conn-tt-key")??r.tt_client_key,tt_access_token:i("conn-tt-token")??r.tt_access_token,tt_sync_leads:m("conn-tt-leads")??r.tt_sync_leads};try{let h=await n("/api/connections",{method:"PUT",body:JSON.stringify(u)});e.connections=h.connections,$("Conexiones Omnicanal Guardadas","Los par\xE1metros de WhatsApp (QR / API), Facebook, Instagram y TikTok se han actualizado.","success"),s()}catch(h){$("Error guardando conexiones",h.message,"danger")}}))}var se={connections:null,conversations:[],messages:[],quickReplies:[],tags:[],notes:[],users:[],selectedConversationId:null,channelFilter:"all",tagFilter:"",searchQuery:"",sideDrawerTab:"none",pendingAttachment:null,replyingTo:null,lastSentMessageId:null};function kn(){try{let t=localStorage.getItem("turbonetwork_session");if(t){let e=JSON.parse(t);if(e&&e.token)return String(e.token)}}catch{}return""}async function dt(t,e={}){let n=kn(),s=localStorage.getItem("turbonetwork_active_tenant")||"",r={"Content-Type":"application/json",...e.headers||{}};n&&(r.Authorization=`Bearer ${n}`),s&&(r["x-tenant-id"]=s);let i=await fetch(t,{...e,headers:r,credentials:"include"}),m=await i.text(),u={};try{u=m?JSON.parse(m):{}}catch{u={error:m||"Error de respuesta del servidor"}}if(!i.ok)throw new Error(u.error||u.message||`Error HTTP ${i.status}`);return u}async function Xt(){let t=se.selectedConversationId,e=t?`/api/inbox?active_conv_id=${t}&msg_limit=${se.messageLimit||250}`:"/api/inbox",n=await dt(e);se.conversations=n.conversations||[],se.messages=n.messages||[],se.connections=n.connections||null,se.quickReplies=n.quickReplies||[],se.tags=n.tags||[],se.notes=n.notes||[],se.users=n.users||[],!se.selectedConversationId&&se.conversations.length>0&&window.innerWidth>768&&(se.selectedConversationId=se.conversations[0].id)}function En(){let t=document.getElementById("nav-messages-badge");if(!t)return;let e=se.conversations.reduce((n,s)=>n+Number(s.unread_count||0),0);e>0?(t.textContent=String(e),t.classList.remove("hidden")):(t.textContent="0",t.classList.add("hidden"))}function Kt(t){t.classList.add("app-shell");let n=window.innerWidth<=768&&se.selectedConversationId!==null;t.classList.toggle("mobile-in-chat",n),document.body.classList.toggle("mobile-chat-open",n)}var Gt=null;function Et(){let t=document.getElementById("omnichannel-inbox-root");if(!t)return;Kt(t);let e=document.getElementById("chat-messages-scroller"),n=!!e&&Gt===se.selectedConversationId,s=e?.scrollTop??0,r=e?e.scrollHeight-e.scrollTop-e.clientHeight<120:!0,i=document.querySelector(".inbox-conversations-list")?.scrollTop??0,m=window.systemCurrencyCode||"PEN";t.innerHTML=Ot(se,m,!0),En(),Qt({sub:se,apiFetch:dt,refreshInbox:async()=>{await Xt(),Et()},goToConnectionsTab:()=>{let f=window;typeof f.switchTab=="function"&&f.switchTab("settings"),typeof f.switchConfigSubTab=="function"&&f.switchConfigSubTab("connections"),setTimeout(()=>{Zt()},60)},rerender:()=>Et()});let u=document.getElementById("chat-messages-scroller");if(u)if(!n||r){u.scrollTop=u.scrollHeight;let w=Date.now()+4e3,T=!0,S=()=>{T&&Date.now()<w&&(u.scrollTop=u.scrollHeight)};u.addEventListener("load",S,!0),u.addEventListener("loadedmetadata",S,!0);let P=()=>{T=!1};u.addEventListener("wheel",P,{passive:!0,once:!0}),u.addEventListener("touchmove",P,{passive:!0,once:!0})}else u.scrollTop=s;let h=document.querySelector(".inbox-conversations-list");h&&i>0&&(h.scrollTop=i),Gt=se.selectedConversationId}function Yt(){let t=document.getElementById("omnichannel-connections-root");t&&(t.innerHTML=Ft(se.connections,!0),Jt({sub:se,apiFetch:dt,rerender:()=>Yt()}))}var kt=!1;async function $n(t=!0){let e=document.getElementById("omnichannel-inbox-root");if(e){kt||(e.innerHTML=`
      <div style="display:flex;align-items:center;justify-content:center;height:100%;min-height:320px;color:var(--text-muted,#94a3b8);font-size:13px;gap:10px;">
        <span>Cargando bandeja omnicanal...</span>
      </div>
    `);try{(t||!kt)&&(await Xt(),kt=!0),Et()}catch(n){e.innerHTML=`
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
    `}}}async function Zt(t=!0){let e=document.getElementById("omnichannel-connections-root");if(e)try{if(t||!se.connections){let n=await dt("/api/connections");se.connections=n.connections}Yt()}catch(n){e.innerHTML=`
      <div class="pro-card" style="padding:18px;border-radius:14px;border:1px solid rgba(239,68,68,0.35);display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;">
        <div style="color:#ef4444;font-size:13px;">Error cargando conexiones omnicanal: ${n.message}</div>
        <button type="button" class="btn btn-primary btn-sm" onclick="window.TurboOmnichannel?.mountConnections(true)">Reintentar</button>
      </div>
    `}}window.addEventListener("resize",()=>{let t=document.getElementById("omnichannel-inbox-root");t&&!document.getElementById("tab-messages")?.classList.contains("hidden")?Kt(t):document.body.classList.remove("mobile-chat-open")});window.TurboOmnichannel={mountInbox:$n,mountConnections:Zt,getState:()=>se};})();
