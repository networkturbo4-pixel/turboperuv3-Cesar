/* =========================================================================
 * TurboAlmacén POS • Terminal Rápida de Almacén (PC, Laptop y Móvil)
 * Diseño fluido estilo Apple HIG: Bottom Sheet 1:1 en móvil, Spotlight Scan,
 * Steppers directos en catálogo/canasta, Vista Cuadrícula/Lista y Tickets 58/80mm
 * ========================================================================= */
(function () {
  "use strict";

  // Estado global
  let almUser = null;
  let almApartado = null;
  let almEnabledApps = [];
  let almTenants = [];
  let activeTenantId = localStorage.getItem("turbonetwork_active_tenant") || "turbonetwork";
  let almProducts = [];
  let almCategories = [];
  let almEmployees = [];
  let almAssignments = [];
  let almRequests = [];
  let almNodes = [];
  let almSelectedNodeStock = [];
  let almMovements = [];
  let almPurchases = [];
  let almInstallations = [];
  let almInterTenantTransfers = [];

  let activeTab = "dispatch";
  let dispatchFilter = "all";
  let eppFilter = "all";
  let returnsSubMode = "active";
  let purchasesSubMode = "entry";
  let verifySubMode = "lookup";
  let liveSearchTerm = "";
  let requestsExpanded = true;
  let mobileCartOpen = false;

  // Canastas POS + Canastas en espera (Hold / Pausa)
  let dispatchCart = []; // [{ key, productId, name, sku, type, unitOfMeasure, quantity, maxStock, itemUnitId, unitSku, variantName, image }]
  let activeHoldSlot = 0;
  let cartHoldSlots = [
    { id: 0, label: "#1", items: [], employeeId: "", notes: "" },
    { id: 1, label: "#2", items: [], employeeId: "", notes: "" },
    { id: 2, label: "#3", items: [], employeeId: "", notes: "" },
  ];
  let purchaseCart = []; // [{ productId, name, sku, quantity, orderedQty, unitCost, serials }]
  let selectedReturnIds = new Set();

  // Preferencias locales
  let beepEnabled = localStorage.getItem("turboalmacen_beep") !== "off";
  let voiceEnabled = localStorage.getItem("turboalmacen_voice") === "on";
  let paperWidth = localStorage.getItem("turboalmacen_paper") || "80"; // "80" | "58"
  let catalogViewMode = localStorage.getItem("turboalmacen_view_mode") || "grid"; // "grid" | "list"

  // Estado auxiliar (Firma, Préstamo, Ráfaga, Conteo Ciego, Mapa 2D, Escáner Remoto)
  let sigCanvasDrawing = false;
  let sigHasStrokes = false;
  let loanPhotoName = "";
  let purchaseAttachmentName = "";
  let burstCapturedItems = []; // [{ sn, mac }]
  let pendingBurstSn = "";
  let blindCountRevealed = false;
  let blindCountsMap = {}; // { [productId]: physicalNumber }
  let activeWarehouseZone = "ALL";
  let remoteScannerEvtSource = null;

  // Cámara
  let camStream = null;
  let camAnimId = null;
  let lastScannedCode = "";
  let lastScannedAt = 0;
  let barcodeDetector = null;

  // =========================================================================
  // UTILIDADES: ESCAPE HTML, SONIDO BEEP, TOASTS
  // =========================================================================
  function esc(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  let audioCtx = null;
  function playBeep(type) {
    if (!beepEnabled) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtx) audioCtx = new Ctx();
      if (audioCtx.state === "suspended") audioCtx.resume();

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === "error") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(240, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.14, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.22);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.22);
      } else {
        osc.type = "sine";
        osc.frequency.setValueAtTime(1760, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
      }
    } catch (_) {}
  }

  function showToast(msg, type) {
    const container = document.getElementById("alm-toast-container");
    if (!container) return;
    const dotColors = {
      success: "bg-emerald-400",
      error: "bg-rose-400",
      warn: "bg-amber-400",
      info: "bg-sky-400",
    };
    const borders = {
      success: "border-emerald-500/35",
      error: "border-rose-500/35",
      warn: "border-amber-500/35",
      info: "border-white/10",
    };
    const t = type || "info";
    const el = document.createElement("div");
    el.className = `alm-toast alm-toast-surface pointer-events-auto px-3.5 py-2.5 rounded-xl border ${borders[t]} text-slate-100 shadow-xl text-xs font-semibold flex items-center gap-2.5`;
    el.innerHTML = `<span class="w-2 h-2 rounded-full flex-shrink-0 ${dotColors[t]}"></span><span class="leading-snug">${esc(msg)}</span>`;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translateY(-6px) scale(0.97)";
      setTimeout(() => el.remove(), 220);
    }, 2800);
  }

  function flashScannerBar() {
    const wrap = document.getElementById("global-scanner-wrap");
    if (!wrap) return;
    wrap.classList.remove("scanner-flash");
    void wrap.offsetWidth;
    wrap.classList.add("scanner-flash");
  }

  function getEmployeeDisplayName(emp) {
    if (!emp) return "Técnico";
    return emp.fullName || emp.name || `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || `Personal #${emp.id}`;
  }

  // =========================================================================
  // CONTROLES DE HEADER (PAPEL, SONIDO, TEMA, VISTA CATÁLOGO)
  // =========================================================================
  function syncHeaderControls() {
    const lblPaper = document.getElementById("paper-width-label");
    if (lblPaper) lblPaper.textContent = `${paperWidth}mm`;
    const btnBeep = document.getElementById("btn-beep-toggle");
    const iconOn = document.getElementById("beep-icon-on");
    const iconOff = document.getElementById("beep-icon-off");
    if (iconOn) iconOn.classList.toggle("hidden", !beepEnabled);
    if (iconOff) iconOff.classList.toggle("hidden", beepEnabled);
    if (btnBeep) {
      btnBeep.classList.toggle("text-emerald-500", beepEnabled);
      btnBeep.classList.toggle("text-slate-400", !beepEnabled);
    }
    const btnVoice = document.getElementById("btn-voice-toggle");
    if (btnVoice) {
      btnVoice.classList.toggle("text-emerald-500", voiceEnabled);
      btnVoice.classList.toggle("text-slate-400", !voiceEnabled);
    }
    syncCatalogViewButtons();
    syncOfflineQueueBadge();
  }

  function speakFeedback(text) {
    if (!voiceEnabled || !("speechSynthesis" in window) || !text) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "es-PE";
      u.rate = 1.12;
      window.speechSynthesis.speak(u);
    } catch (_) {}
  }

  window.toggleVoiceFeedback = function () {
    voiceEnabled = !voiceEnabled;
    localStorage.setItem("turboalmacen_voice", voiceEnabled ? "on" : "off");
    syncHeaderControls();
    if (voiceEnabled) {
      speakFeedback("Asistente de voz de almacén activado");
      showToast("Feedback por voz activado", "success");
    } else {
      showToast("Feedback por voz desactivado", "info");
    }
  };

  function syncCatalogViewButtons() {
    const btnGrid = document.getElementById("btn-view-grid");
    const btnList = document.getElementById("btn-view-list");
    const isGrid = catalogViewMode === "grid";
    if (btnGrid) {
      btnGrid.className = isGrid
        ? "pos-press alm-btn-primary px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1"
        : "pos-press px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1";
    }
    if (btnList) {
      btnList.className = !isGrid
        ? "pos-press alm-btn-primary px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1"
        : "pos-press px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1";
    }
  }

  window.setCatalogViewMode = function (mode) {
    catalogViewMode = mode === "list" ? "list" : "grid";
    try {
      localStorage.setItem("turboalmacen_view_mode", catalogViewMode);
    } catch (_) {}
    syncCatalogViewButtons();
    renderDispatchCatalog();
  };

  window.togglePaperWidth = function () {
    paperWidth = paperWidth === "80" ? "58" : "80";
    localStorage.setItem("turboalmacen_paper", paperWidth);
    syncHeaderControls();
    showToast(`Impresora térmica configurada en ${paperWidth}mm`, "info");
  };

  window.toggleBeepSound = function () {
    beepEnabled = !beepEnabled;
    localStorage.setItem("turboalmacen_beep", beepEnabled ? "on" : "off");
    syncHeaderControls();
    if (beepEnabled) playBeep("ok");
  };

  window.toggleAlmacenTheme = function () {
    const isDark = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem("turbonetwork_theme", isDark ? "dark" : "light");
    } catch (_) {}
  };

  // =========================================================================
  // SESIÓN UNIFICADA (LOGIN ÚNICO EN /)
  // =========================================================================
  function redirectToUnifiedLogin(expired) {
    if (window.TurboSessionGuard && typeof window.TurboSessionGuard.redirectToUnifiedLogin === "function") {
      window.TurboSessionGuard.redirectToUnifiedLogin(expired);
      return;
    }
    const target = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(`/?redirect=${target}${expired ? "&expired=1" : ""}`);
  }

  window.almLogout = function (fromGuard) {
    if (!fromGuard && window.TurboSessionGuard && typeof window.TurboSessionGuard.logout === "function") {
      window.TurboSessionGuard.logout();
      return;
    }
    try {
      localStorage.removeItem("turbonetwork_session");
      localStorage.removeItem("turbonetwork_auth_meta");
    } catch (_) {}
    almUser = null;
    redirectToUnifiedLogin(Boolean(fromGuard));
  };

  // =========================================================================
  // APPLE FLUID BOTTOM SHEET (CANASTA RESPONSIVE < 1024px CON GESTOS 1:1)
  // =========================================================================
  function isMobileSheetViewport() {
    return window.innerWidth < 1024;
  }

  function syncMobileFabVisibility() {
    const fabWrap = document.getElementById("mobile-cart-fab-wrap");
    if (!fabWrap) return;
    const shouldShow = activeTab === "dispatch" && !mobileCartOpen;
    fabWrap.classList.toggle("hidden", !shouldShow);
  }

  window.openMobileCart = function () {
    if (!isMobileSheetViewport()) {
      const panel = document.getElementById("dispatch-cart-panel");
      if (panel) panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }
    mobileCartOpen = true;
    const sheet = document.getElementById("dispatch-cart-panel");
    const backdrop = document.getElementById("dispatch-cart-backdrop");
    if (sheet) {
      sheet.classList.remove("is-dragging");
      sheet.style.transform = "";
      sheet.classList.add("is-open");
    }
    if (backdrop) {
      backdrop.style.opacity = "";
      backdrop.classList.add("is-open");
    }
    document.body.style.overflow = "hidden";
    syncMobileFabVisibility();
  };

  window.closeMobileCart = function () {
    mobileCartOpen = false;
    const sheet = document.getElementById("dispatch-cart-panel");
    const backdrop = document.getElementById("dispatch-cart-backdrop");
    if (sheet) {
      sheet.classList.remove("is-dragging");
      sheet.style.transform = "";
      sheet.classList.remove("is-open");
    }
    if (backdrop) {
      backdrop.style.opacity = "";
      backdrop.classList.remove("is-open");
    }
    document.body.style.overflow = "";
    syncMobileFabVisibility();
  };

  window.toggleMobileCart = function () {
    if (mobileCartOpen) window.closeMobileCart();
    else window.openMobileCart();
  };

  // Alias retrocompatible
  window.scrollToMobileCart = function () {
    window.openMobileCart();
  };

  // Apple WWDC 2018 rubber-band & momentum projection
  function rubberband(overshoot, dimension, constant) {
    const c = constant || 0.35;
    return (overshoot * dimension * c) / (dimension + c * Math.abs(overshoot));
  }

  function projectMomentum(initialVelocityPxPerSec, decelerationRate) {
    const d = decelerationRate || 0.998;
    return ((initialVelocityPxPerSec / 1000) * d) / (1 - d);
  }

  function initCartSheetGestures() {
    const sheet = document.getElementById("dispatch-cart-panel");
    const backdrop = document.getElementById("dispatch-cart-backdrop");
    const handle = document.getElementById("dispatch-cart-drag-handle");
    const header = document.getElementById("dispatch-cart-header");
    if (!sheet) return;

    let dragging = false;
    let pointerId = null;
    let startY = 0;
    let currentDeltaY = 0;
    let sheetHeight = 400;
    let samples = [];

    function onPointerDown(e) {
      if (!isMobileSheetViewport() || !mobileCartOpen) return;
      if (e.target && e.target.closest("button, input, select, a, label")) return;

      dragging = true;
      pointerId = e.pointerId;
      startY = e.clientY;
      currentDeltaY = 0;
      sheetHeight = Math.max(240, sheet.getBoundingClientRect().height);
      samples = [{ y: e.clientY, t: performance.now() }];

      sheet.classList.add("is-dragging");
      try {
        e.currentTarget.setPointerCapture(pointerId);
      } catch (_) {}
    }

    function onPointerMove(e) {
      if (!dragging || e.pointerId !== pointerId) return;
      const rawDelta = e.clientY - startY;
      const now = performance.now();
      samples.push({ y: e.clientY, t: now });
      if (samples.length > 6) samples.shift();

      // 1:1 tracking hacia abajo; rubber-band suave si arrastra hacia arriba
      if (rawDelta >= 0) {
        currentDeltaY = rawDelta;
      } else {
        currentDeltaY = -rubberband(Math.abs(rawDelta), sheetHeight, 0.25);
      }

      sheet.style.transform = `translate3d(0, ${currentDeltaY}px, 0)`;
      if (backdrop) {
        const progress = Math.min(1, Math.max(0, currentDeltaY / sheetHeight));
        backdrop.style.opacity = String(1 - progress * 0.85);
      }
    }

    function onPointerEnd(e) {
      if (!dragging || (pointerId !== null && e.pointerId !== pointerId)) return;
      dragging = false;
      pointerId = null;
      sheet.classList.remove("is-dragging");

      // Calcular velocidad de salida (px/s) desde las últimas muestras
      let velocityY = 0;
      if (samples.length >= 2) {
        const first = samples[0];
        const last = samples[samples.length - 1];
        const dt = Math.max(1, last.t - first.t);
        velocityY = ((last.y - first.y) / dt) * 1000;
      }

      const projectedY = currentDeltaY + projectMomentum(velocityY, 0.996);
      const shouldDismiss = currentDeltaY > sheetHeight * 0.38 || projectedY > sheetHeight * 0.45 || velocityY > 520;

      if (shouldDismiss) {
        window.closeMobileCart();
      } else {
        sheet.style.transform = "";
        if (backdrop) backdrop.style.opacity = "";
      }
    }

    [handle, header].forEach((zone) => {
      if (!zone) return;
      zone.addEventListener("pointerdown", onPointerDown);
      zone.addEventListener("pointermove", onPointerMove);
      zone.addEventListener("pointerup", onPointerEnd);
      zone.addEventListener("pointercancel", onPointerEnd);
    });

    window.addEventListener("resize", () => {
      if (!isMobileSheetViewport() && mobileCartOpen) {
        window.closeMobileCart();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && mobileCartOpen) {
        window.closeMobileCart();
      }
    });
  }

  // =========================================================================
  // TENANTS, LOGO Y COLORES DEL SISTEMA
  // =========================================================================
  function hexToRgbTuple(hex) {
    const clean = String(hex || "").replace("#", "");
    const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
    const num = parseInt(full, 16);
    if (Number.isNaN(num)) return "37, 99, 235";
    return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
  }

  function applyTenantBrandingUI() {
    const tenant = almTenants.find((t) => t.id === activeTenantId) || almTenants[0] || null;
    let userPrefs = {};
    let savedBrand = {};
    try {
      if (almUser && almUser.preferences) userPrefs = almUser.preferences;
      const rawBrand = localStorage.getItem("turbonetwork_branding");
      if (rawBrand) savedBrand = JSON.parse(rawBrand) || {};
    } catch (_) {}

    const primaryColor =
      userPrefs.primaryColor ||
      (tenant && tenant.primaryColor) ||
      savedBrand.primaryColor ||
      "#2563eb";
    const accentColor =
      userPrefs.accentColor ||
      (tenant && tenant.accentColor) ||
      savedBrand.accentColor ||
      "#059669";

    document.documentElement.style.setProperty("--brand-primary", primaryColor);
    document.documentElement.style.setProperty("--brand-primary-rgb", hexToRgbTuple(primaryColor));
    document.documentElement.style.setProperty("--brand-accent", accentColor);
    document.documentElement.style.setProperty("--brand-accent-rgb", hexToRgbTuple(accentColor));

    const metaTheme = document.getElementById("alm-theme-color");
    if (metaTheme) metaTheme.setAttribute("content", primaryColor);

    const logoBox = document.getElementById("alm-brand-logo-box");
    const logoImg = document.getElementById("alm-brand-logo-img");
    const logoFallback = document.getElementById("alm-brand-logo-fallback");
    const tenantLogo = (tenant && (tenant.faviconUrl || tenant.logoUrl)) || "";

    if (logoBox) logoBox.style.backgroundColor = primaryColor;
    if (logoImg && logoFallback) {
      if (tenantLogo) {
        logoImg.src = tenantLogo;
        logoImg.classList.remove("hidden");
        logoFallback.classList.add("hidden");
      } else {
        logoImg.src = "";
        logoImg.classList.add("hidden");
        logoFallback.classList.remove("hidden");
      }
    }

    const favEl = document.getElementById("alm-favicon");
    if (favEl && tenantLogo) favEl.href = tenantLogo;

    const brandTitle = document.getElementById("alm-brand-title");
    if (brandTitle) {
      brandTitle.textContent = (tenant && tenant.name) || "TurboAlmacén";
    }

    const userLabel = document.getElementById("alm-user-label");
    if (userLabel) {
      const uName = (almUser && almUser.name) || "Almacenero";
      const tLabel = (tenant && tenant.name) || activeTenantId;
      userLabel.textContent = `${uName} • ${tLabel}`;
    }

    if (tenant && tenant.name) {
      document.title = `${tenant.name} • Almacén POS`;
    }
  }

  function renderTenantDropdown() {
    const listEl = document.getElementById("alm-tenant-list");
    const chev = document.getElementById("alm-tenant-chevron");
    const accessible = almTenants.filter((t) => t.hasAccess !== false);
    if (chev) chev.classList.toggle("hidden", accessible.length <= 1);
    if (!listEl) return;

    if (accessible.length === 0) {
      listEl.innerHTML = `<div class="px-3 py-2 text-xs text-slate-400">Sin empresas disponibles</div>`;
      return;
    }

    listEl.innerHTML = accessible
      .map((t) => {
        const isCurrent = t.id === activeTenantId;
        const tLogo = t.faviconUrl || t.logoUrl || "";
        const tColor = t.primaryColor || "#2563eb";
        const initials = (t.name || t.id || "TN").slice(0, 2).toUpperCase();
        return `
        <button type="button" onclick="switchAlmacenTenant('${esc(t.id)}')" class="pos-press w-full px-2.5 py-2 rounded-xl flex items-center justify-between gap-2.5 text-left ${isCurrent ? "alm-brand-badge" : "hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200"}">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-extrabold flex-shrink-0 overflow-hidden" style="background-color:${esc(tColor)}">
              ${tLogo ? `<img src="${esc(tLogo)}" alt="${esc(t.name)}" class="w-full h-full object-contain bg-white/95 p-0.5">` : esc(initials)}
            </div>
            <div class="min-w-0">
              <div class="text-xs font-bold truncate">${esc(t.name)}</div>
              <div class="text-[10px] opacity-70 truncate">${esc(t.tagline || t.id)}</div>
            </div>
          </div>
          ${isCurrent ? `<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>` : ""}
        </button>`;
      })
      .join("");
  }

  window.toggleTenantDropdown = function (e) {
    if (e) e.stopPropagation();
    const dd = document.getElementById("alm-tenant-dropdown");
    const chev = document.getElementById("alm-tenant-chevron");
    const accessible = almTenants.filter((t) => t.hasAccess !== false);
    if (!dd || accessible.length <= 1) return;
    const isHidden = dd.classList.toggle("hidden");
    if (chev) chev.classList.toggle("rotate-180", !isHidden);
  };

  window.switchAlmacenTenant = async function (tenantId) {
    const dd = document.getElementById("alm-tenant-dropdown");
    const chev = document.getElementById("alm-tenant-chevron");
    if (dd) dd.classList.add("hidden");
    if (chev) chev.classList.remove("rotate-180");

    if (!tenantId || tenantId === activeTenantId) return;
    activeTenantId = tenantId;
    try {
      localStorage.setItem("turbonetwork_active_tenant", tenantId);
    } catch (_) {}

    dispatchCart = [];
    purchaseCart = [];
    if (mobileCartOpen) window.closeMobileCart();

    applyTenantBrandingUI();
    renderTenantDropdown();
    await refreshAllWarehouseData(true);
  };

  async function loadTenantsAndBranding() {
    try {
      const res = await fetch("/api/tenants");
      const data = await res.json();
      if (data && data.success && Array.isArray(data.data)) {
        almTenants = data.data;
        const accessible = almTenants.filter((t) => t.hasAccess !== false);
        if (accessible.length > 0 && !accessible.some((t) => t.id === activeTenantId)) {
          activeTenantId = accessible[0].id;
          try {
            localStorage.setItem("turbonetwork_active_tenant", activeTenantId);
          } catch (_) {}
        }
      }
    } catch (_) {}
    applyTenantBrandingUI();
    renderTenantDropdown();
  }

  // =========================================================================
  // INICIALIZACIÓN Y CARGA DE DATOS
  // =========================================================================
  async function bootstrapAlmacen() {
    syncHeaderControls();
    initCartSheetGestures();

    document.addEventListener("click", (e) => {
      const dd = document.getElementById("alm-tenant-dropdown");
      const btn = document.getElementById("alm-tenant-switcher-btn");
      if (dd && !dd.classList.contains("hidden") && !dd.contains(e.target) && (!btn || !btn.contains(e.target))) {
        dd.classList.add("hidden");
        document.getElementById("alm-tenant-chevron")?.classList.remove("rotate-180");
      }
    });

    const dateInput = document.getElementById("purch-date");
    if (dateInput && !dateInput.value) {
      dateInput.value = new Date().toISOString().split("T")[0];
    }

    try {
      const saved = localStorage.getItem("turbonetwork_session");
      if (saved) almUser = JSON.parse(saved);
      activeTenantId = localStorage.getItem("turbonetwork_active_tenant") || activeTenantId;
    } catch (_) {}

    if (!almUser) {
      redirectToUnifiedLogin(false);
      return;
    }

    await loadTenantsAndBranding();

    try {
      const accessRes = await fetch(
        `/api/apartados/my-access?userId=${encodeURIComponent(almUser.id || 0)}&roleId=${encodeURIComponent(almUser.roleId || 0)}&apartadoId=apt-almacen&slug=almacen`
      );
      const accessData = await accessRes.json();
      if (accessData.success) {
        almApartado = accessData.apartado;
        almEnabledApps = (accessData.apps || []).map((a) => a.id);
        applyApartadoTabVisibility();
      }
    } catch (_) {}

    await refreshAllWarehouseData(false);
    initSignatureCanvas();
    renderCartHoldTabs();
    switchAlmacenTab(activeTab);
    focusGlobalScanner();

    window.addEventListener("online", () => {
      syncOfflineQueueBadge();
      window.syncOfflineDispatchQueue();
    });
    window.addEventListener("offline", () => {
      syncOfflineQueueBadge();
      showToast("Modo Offline activo: los despachos se guardarán en cola local", "warn");
    });
  }

  function applyApartadoTabVisibility() {
    if (!almEnabledApps.length) return;
    const map = {
      dispatch: "almacen_dispatch",
      returns: "almacen_returns",
      purchases: "almacen_purchases",
      transfers: "almacen_transfers",
      epp: "almacen_epp",
      verify: "almacen_verify_labels",
    };
    Object.keys(map).forEach((tab) => {
      const allowed = almEnabledApps.includes(map[tab]);
      document.querySelectorAll(`[data-tab="${tab}"], [data-mtab="${tab}"]`).forEach((btn) => {
        btn.classList.toggle("hidden", !allowed);
      });
    });
  }

  function mergeWarehousePersonnel(employees, users) {
    const baseEmps = Array.isArray(employees) ? employees : [];
    const baseUsers = Array.isArray(users) ? users : [];
    const merged = baseEmps.map((e) => ({ ...e }));

    baseUsers.forEach((u) => {
      if (!u || u.isActive === false) return;
      const roleLow = String(u.roleName || u.role || "").toLowerCase();
      if (roleLow.includes("cliente")) return;

      const uName = String(u.name || u.fullName || "").trim().toLowerCase();
      const uEmail = String(u.email || "").trim().toLowerCase();
      const uDni = String(u.dni || u.document || "").trim();

      const matched = merged.find((e) => {
        if (Number(e.id) === Number(u.id) || Number(e.operatorId) === Number(u.id)) return true;
        if (uDni && e.dni && String(e.dni).trim() === uDni) return true;
        if (uEmail && e.email && String(e.email).trim().toLowerCase() === uEmail) return true;
        return uName && getEmployeeDisplayName(e).trim().toLowerCase() === uName;
      });

      const resolvedRole = u.roleName || (u.isSuperAdmin ? "Superadministrador" : "Operador");
      if (matched) {
        if (!matched.position) matched.position = resolvedRole;
        if (!matched.roleName) matched.roleName = resolvedRole;
        if (u.isSuperAdmin) matched.isSuperAdmin = true;
      } else {
        merged.push({
          id: u.id,
          operatorId: u.id,
          name: u.name || u.fullName || `Usuario #${u.id}`,
          fullName: u.name || u.fullName || `Usuario #${u.id}`,
          position: resolvedRole,
          roleName: resolvedRole,
          email: u.email || "",
          dni: uDni,
          isSuperAdmin: Boolean(u.isSuperAdmin),
          source: "user",
        });
      }
    });

    return merged;
  }

  window.refreshAllWarehouseData = async function (showFeedback) {
    const icon = document.getElementById("alm-refresh-icon");
    if (icon) icon.classList.add("animate-spin");
    try {
      const [prodRes, catRes, empRes, usersRes, asgRes, reqRes, assetRes, movRes, purchRes, instRes, trSedeRes] = await Promise.all([
        fetch("/api/inventory/products").then((r) => r.json()).catch(() => ({ data: [] })),
        fetch("/api/inventory/categories").then((r) => r.json()).catch(() => ({ data: [] })),
        fetch("/api/rrhh/employees").then((r) => r.json()).catch(() => ({ data: [] })),
        fetch("/api/users").then((r) => r.json()).catch(() => ({ data: [] })),
        fetch("/api/inventory/personnel-assignments").then((r) => r.json()).catch(() => ({ data: [] })),
        fetch("/api/apartados/material-requests").then((r) => r.json()).catch(() => ({ data: [] })),
        fetch("/api/inventory/assets").then((r) => r.json()).catch(() => ({ data: [] })),
        fetch("/api/inventory/movements").then((r) => r.json()).catch(() => ({ data: [] })),
        fetch("/api/inventory/purchases").then((r) => r.json()).catch(() => ({ data: [] })),
        fetch("/api/inventory/client-installations").then((r) => r.json()).catch(() => ({ data: [] })),
        fetch("/api/inventory/inter-tenant-transfers").then((r) => r.json()).catch(() => ({ data: [] })),
      ]);

      almProducts = Array.isArray(prodRes.data) ? prodRes.data : [];
      almCategories = Array.isArray(catRes.data) ? catRes.data : [];
      almEmployees = mergeWarehousePersonnel(empRes.data, usersRes.data);
      almAssignments = Array.isArray(asgRes.data) ? asgRes.data : [];
      almRequests = Array.isArray(reqRes.data) ? reqRes.data : [];
      almMovements = Array.isArray(movRes.data) ? movRes.data : [];
      almPurchases = Array.isArray(purchRes.data) ? purchRes.data : [];
      almInstallations = Array.isArray(instRes.data) ? instRes.data : [];
      almInterTenantTransfers = Array.isArray(trSedeRes.data) ? trSedeRes.data : [];
      const allAssets = Array.isArray(assetRes.data) ? assetRes.data : [];
      almNodes = allAssets.filter(
        (a) =>
          String(a.category || "").toLowerCase().includes("nodo") ||
          String(a.category || "").toLowerCase().includes("infraestructura") ||
          String(a.category || "").toLowerCase().includes("pop") ||
          String(a.type || "").toLowerCase().includes("nodo")
      );
      if (almNodes.length === 0) almNodes = allAssets;

      populateSelects();
      renderTechRequestsBanner();
      renderDispatchCatalog();
      renderDispatchCart();
      renderCartHoldTabs();
      renderReturnsList();
      renderReturnsArqueo();
      renderRecoveredUnitsList();
      renderReturnsHistory();
      renderPurchaseProductPicker();
      renderPurchaseCart();
      renderKardexQuickView();
      renderRmaModule();
      renderTechTransferList();
      renderInterTenantTransfersList();
      renderEppModule();
      renderBlindCountModule();
      renderWarehouse2DMap();
      renderSmartReorderAndAudit();

      if (showFeedback) showToast("Inventario sincronizado al instante", "success");
    } catch (err) {
      showToast("Error cargando datos de almacén", "error");
    } finally {
      if (icon) icon.classList.remove("animate-spin");
    }
  };

  function populateSelects() {
    const catSel = document.getElementById("dispatch-category-select");
    if (catSel) {
      const prev = catSel.value;
      catSel.innerHTML =
        `<option value="">Todas las categorías (${almCategories.length})</option>` +
        almCategories.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");
      catSel.value = prev;
    }

    const empOptions = almEmployees
      .map((e) => `<option value="${esc(e.id)}" data-name="${esc(getEmployeeDisplayName(e))}">${esc(getEmployeeDisplayName(e))}${e.position ? " • " + esc(e.position) : ""}</option>`)
      .join("");

    const dispEmp = document.getElementById("dispatch-employee-select");
    if (dispEmp) {
      const prev = dispEmp.value;
      dispEmp.innerHTML = `<option value="">— Seleccionar técnico / personal —</option>${empOptions}`;
      dispEmp.value = prev;
      handleDispatchTechChange();
    }

    const retEmp = document.getElementById("returns-employee-filter");
    if (retEmp) {
      const prev = retEmp.value;
      retEmp.innerHTML = `<option value="">Todos los técnicos</option>${empOptions}`;
      retEmp.value = prev;
    }

    const recTech = document.getElementById("rec-tech-select");
    if (recTech) {
      const prev = recTech.value;
      recTech.innerHTML = `<option value="">— Técnico que retiró —</option>${empOptions}`;
      recTech.value = prev;
    }

    const trSrc = document.getElementById("tr-source-employee");
    if (trSrc) {
      const prev = trSrc.value;
      trSrc.innerHTML = `<option value="">Origen: Todos los técnicos</option>${empOptions}`;
      trSrc.value = prev;
    }

    const trTgt = document.getElementById("tr-target-employee");
    if (trTgt) {
      const prev = trTgt.value;
      trTgt.innerHTML = `<option value="">Destino: Seleccionar técnico receptor *</option>${empOptions}`;
      trTgt.value = prev;
    }

    const nodeSel = document.getElementById("tr-node-select");
    if (nodeSel) {
      const prev = nodeSel.value;
      nodeSel.innerHTML =
        almNodes.length === 0
          ? `<option value="">No hay nodos POP registrados</option>`
          : almNodes.map((n) => `<option value="${esc(n.id)}">${esc(n.name || n.code || "Nodo #" + n.id)}</option>`).join("");
      if (prev) nodeSel.value = prev;
    }

    const prodOpts = almProducts
      .map((p) => `<option value="${esc(p.id)}">${esc(p.name)} [${esc(p.sku)}] — Stock: ${p.stock}</option>`)
      .join("");
    ["tr-node-product", "tr-sede-product", "label-product-select", "rec-product-select", "burst-product-select"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        const prev = el.value;
        el.innerHTML = prodOpts || `<option value="">Sin productos</option>`;
        if (prev) el.value = prev;
      }
    });

    // Sedes destino para traslados multi-tenant
    const sedeTgt = document.getElementById("tr-sede-target");
    if (sedeTgt) {
      const otherTenants = almTenants.filter((t) => t.id !== activeTenantId);
      sedeTgt.innerHTML =
        otherTenants.length === 0
          ? `<option value="">No hay otras sedes registradas</option>`
          : otherTenants.map((t) => `<option value="${esc(t.id)}" data-name="${esc(t.name)}">${esc(t.name)} (${esc(t.id)})</option>`).join("");
    }

    // Directorio autocompletable de proveedores
    const supList = document.getElementById("suppliers-datalist");
    if (supList) {
      const defaultSuppliers = [
        "RUC 20512345678 • FiberHome Perú S.A.C.",
        "RUC 20601122334 • TP-Link Technologies Perú",
        "RUC 20498877665 • Furukawa Electric LatAm",
        "RUC 20554433221 • Dixon / Comsatel Perú",
        "RUC 20509988771 • Huawei del Perú S.A.C.",
        "RUC 20605544112 • ZTE Corporation Perú",
        "RUC 20536677889 • MikroTik / Landatel Perú",
      ];
      const fromHist = almPurchases.map((p) => p.supplier).filter(Boolean);
      const uniqueSups = Array.from(new Set([...fromHist, ...defaultSuppliers]));
      supList.innerHTML = uniqueSups.map((s) => `<option value="${esc(s)}"></option>`).join("");
    }

    syncSearchableSelects();
  }

  function applySelectSearchFilter(selectEl, query) {
    if (!selectEl) return;
    if (!Array.isArray(selectEl._allOptions)) {
      selectEl._allOptions = Array.from(selectEl.options).map((opt) => ({
        value: opt.value,
        text: opt.textContent || "",
        dataName: opt.getAttribute("data-name") || "",
      }));
    }

    const q = String(query || "").trim().toLowerCase();
    const prevValue = selectEl.value;
    const filtered = selectEl._allOptions.filter((opt) => {
      if (opt.value === "") return true;
      if (!q) return true;
      return opt.text.toLowerCase().includes(q) || opt.dataName.toLowerCase().includes(q);
    });

    const hasMatches = filtered.some((opt) => opt.value !== "");
    let html = filtered
      .map(
        (opt) =>
          `<option value="${esc(opt.value)}"${opt.dataName ? ` data-name="${esc(opt.dataName)}"` : ""}>${esc(opt.text)}</option>`
      )
      .join("");

    if (q && !hasMatches) {
      html += `<option value="" disabled>Sin coincidencias para "${esc(query.trim())}"</option>`;
    }

    selectEl.innerHTML = html;
    if (prevValue && filtered.some((opt) => opt.value === prevValue)) {
      selectEl.value = prevValue;
    }
  }

  function syncSearchableSelects() {
    document.querySelectorAll("input[data-select-search]").forEach((input) => {
      const targetId = input.getAttribute("data-select-search");
      const selectEl = targetId ? document.getElementById(targetId) : null;
      if (!selectEl) return;

      selectEl._allOptions = Array.from(selectEl.options).map((opt) => ({
        value: opt.value,
        text: opt.textContent || "",
        dataName: opt.getAttribute("data-name") || "",
      }));

      if (!input.dataset.searchBound) {
        input.dataset.searchBound = "1";
        input.addEventListener("input", () => {
          applySelectSearchFilter(selectEl, input.value);
        });
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const firstMatch = Array.from(selectEl.options).find((o) => o.value !== "" && !o.disabled);
            if (firstMatch) {
              selectEl.value = firstMatch.value;
              selectEl.dispatchEvent(new Event("change", { bubbles: true }));
            }
          }
        });
      }

      if (input.value && input.value.trim()) {
        applySelectSearchFilter(selectEl, input.value);
      }
    });
  }

  function getEmployeeSizesMap() {
    try {
      return JSON.parse(localStorage.getItem("turboalmacen_emp_sizes") || "{}") || {};
    } catch (_) {
      return {};
    }
  }

  function updateCartTechWarnings() {
    const dispEmp = document.getElementById("dispatch-employee-select");
    const dupEl = document.getElementById("cart-duplicate-alert");
    const eppRiskEl = document.getElementById("cart-epp-risk-alert");
    const empId = dispEmp?.value || "";
    if (!empId) {
      dupEl?.classList.add("hidden");
      eppRiskEl?.classList.add("hidden");
      return;
    }

    const activeTechAsg = almAssignments.filter(
      (a) => String(a.employeeId) === String(empId) && (a.status === "en_uso" || a.status === "entregado")
    );

    // 1. Alerta de stock duplicado en mochila del técnico
    if (dupEl) {
      const cartPids = new Set(dispatchCart.map((i) => String(i.productId)));
      const overlaps = activeTechAsg.filter((a) => cartPids.has(String(a.productId)));
      const totalInBag = activeTechAsg.reduce((acc, a) => acc + Number(a.quantity || 0), 0);
      if (overlaps.length > 0) {
        const names = Array.from(new Set(overlaps.map((o) => `${o.productName} (x${o.quantity})`))).slice(0, 2).join(", ");
        dupEl.textContent = `⚠️ Mochila: Este técnico ya tiene asignado sin liquidar: ${names} (${activeTechAsg.length} entregas activas).`;
        dupEl.classList.remove("hidden");
      } else if (totalInBag >= 15) {
        dupEl.textContent = `⚠️ Atención: El técnico acumula ${totalInBag} unidades activas en su mochila sin liquidar.`;
        dupEl.classList.remove("hidden");
      } else {
        dupEl.classList.add("hidden");
      }
    }

    // 2. Bloqueo / Alerta preventiva si el técnico tiene EPP crítico vencido
    if (eppRiskEl) {
      const empName = (dispEmp.options[dispEmp.selectedIndex]?.getAttribute("data-name") || "").toLowerCase();
      let expiredEppName = "";
      for (const p of almProducts) {
        if (p.type !== "epp" && !p.hasLifespanControl) continue;
        for (const u of p.itemUnits || []) {
          if ((u.assignedTo || "").toLowerCase().includes(empName) && empName) {
            const st = getEppTrafficLight(p, u);
            if (st.level === "expired") {
              expiredEppName = `${p.name} (${u.sku})`;
              break;
            }
          }
        }
      }
      if (expiredEppName) {
        eppRiskEl.textContent = `⛔ Alerta SST: El técnico tiene EPP vencido o para cambio: ${expiredEppName}. Renueva su EPP antes de trabajos de riesgo.`;
        eppRiskEl.classList.remove("hidden");
      } else {
        eppRiskEl.classList.add("hidden");
      }
    }

    // 3. Auto-sugerir talla de EPP si hay productos EPP en la canasta
    const sizesMap = getEmployeeSizesMap()[String(empId)];
    if (sizesMap && dispatchCart.length > 0) {
      dispatchCart.forEach((it) => {
        if (it.variants && it.variants.length > 0) {
          const nLow = (it.name || "").toLowerCase();
          const preferred =
            /bota|zapato|calzado/i.test(nLow)
              ? sizesMap.shoe
              : /pantal/i.test(nLow)
              ? sizesMap.pants
              : sizesMap.shirt;
          if (preferred) {
            const matchVar = it.variants.find((v) => v.name.toLowerCase().includes(String(preferred).toLowerCase()));
            if (matchVar) it.variantName = matchVar.name;
          }
        }
      });
    }
  }

  window.handleDispatchTechChange = function () {
    const dispEmp = document.getElementById("dispatch-employee-select");
    const statusEl = document.getElementById("dispatch-tech-status");
    const hasTech = Boolean(dispEmp && dispEmp.value);
    if (statusEl) {
      statusEl.textContent = hasTech ? "✓ Listo" : "Requerido";
      statusEl.className = hasTech
        ? "text-[10px] font-bold text-emerald-500"
        : "text-[10px] font-semibold text-amber-500";
    }
    updateCartTechWarnings();
    syncMobileCartBarUI();
  };

  // =========================================================================
  // NAVEGACIÓN ENTRE PESTAÑAS POS
  // =========================================================================
  window.switchAlmacenTab = function (tab) {
    activeTab = tab;
    if (mobileCartOpen && tab !== "dispatch") {
      window.closeMobileCart();
    }

    document.querySelectorAll(".alm-panel").forEach((el) => el.classList.add("hidden"));
    const target = document.getElementById("panel-" + tab);
    if (target) target.classList.remove("hidden");

    document.querySelectorAll(".alm-tab-btn").forEach((btn) => {
      const isAct = btn.getAttribute("data-tab") === tab;
      btn.classList.toggle("is-active", isAct);
    });

    document.querySelectorAll(".alm-mtab-btn").forEach((btn) => {
      const isAct = btn.getAttribute("data-mtab") === tab;
      btn.classList.toggle("alm-mtab-active", isAct);
      btn.classList.toggle("text-slate-500", !isAct);
      btn.classList.toggle("dark:text-slate-400", !isAct);
    });

    syncMobileFabVisibility();

    if (tab === "transfers" && almNodes.length > 0) {
      loadSelectedNodeStock();
    }
  };

  // =========================================================================
  // ESCÁNER LÁSER GLOBAL (PISTOLA USB/BT) + BÚSQUEDA EN VIVO
  // =========================================================================
  function focusGlobalScanner() {
    if (window.innerWidth >= 768) {
      const inp = document.getElementById("global-scan-input");
      if (inp) inp.focus();
    }
  }

  window.handleLiveSearchInput = function (val) {
    liveSearchTerm = (val || "").trim();
    const clearBtn = document.getElementById("btn-clear-scan");
    if (clearBtn) clearBtn.classList.toggle("hidden", !liveSearchTerm);
    if (activeTab === "dispatch") renderDispatchCatalog();
    else if (activeTab === "returns") {
      const rInp = document.getElementById("returns-search-input");
      if (rInp) rInp.value = liveSearchTerm;
      renderReturnsList();
    } else if (activeTab === "purchases") {
      const pInp = document.getElementById("purchase-product-search");
      if (pInp) pInp.value = liveSearchTerm;
      renderPurchaseProductPicker();
    }
  };

  window.clearGlobalSearch = function () {
    const inp = document.getElementById("global-scan-input");
    if (inp) inp.value = "";
    handleLiveSearchInput("");
    focusGlobalScanner();
  };

  function findProductOrUnitByCode(code) {
    const q = (code || "").trim().toLowerCase();
    if (!q) return null;

    // 1. Coincidencia exacta de unidad (SKU, barcode o serial)
    for (const p of almProducts) {
      if (Array.isArray(p.itemUnits)) {
        const u = p.itemUnits.find(
          (unit) =>
            (unit.sku && unit.sku.toLowerCase() === q) ||
            (unit.barcode && unit.barcode.toLowerCase() === q) ||
            (unit.serialNumber && unit.serialNumber.toLowerCase() === q)
        );
        if (u) return { product: p, unit: u };
      }
    }

    // 2. Búsqueda por últimos 4+ caracteres de Serie GPON o MAC Address
    if (q.length >= 4) {
      const cleanQ = q.replace(/[:\-.\s]/g, "");
      for (const p of almProducts) {
        if (Array.isArray(p.itemUnits)) {
          const u = p.itemUnits.find((unit) => {
            const s = (unit.serialNumber || "").toLowerCase().replace(/[:\-.\s]/g, "");
            const k = (unit.sku || "").toLowerCase().replace(/[:\-.\s]/g, "");
            return (s && s.endsWith(cleanQ)) || (k && k.endsWith(cleanQ));
          });
          if (u) return { product: p, unit: u };
        }
      }
    }

    const exactProd = almProducts.find(
      (p) => (p.sku && p.sku.toLowerCase() === q) || (p.barcode && p.barcode.toLowerCase() === q)
    );
    if (exactProd) return { product: exactProd, unit: null };

    const partials = almProducts.filter(
      (p) =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))
    );
    if (partials.length === 1) return { product: partials[0], unit: null };
    return null;
  }

  window.handleGlobalScanSubmit = function (e) {
    if (e) e.preventDefault();
    const inp = document.getElementById("global-scan-input");
    const raw = (inp ? inp.value : "").trim();
    if (!raw) return;
    processScannedCode(raw);
    if (inp) {
      inp.value = "";
      liveSearchTerm = "";
      document.getElementById("btn-clear-scan")?.classList.add("hidden");
      if (activeTab === "dispatch") renderDispatchCatalog();
    }
  };

  async function processScannedCode(code) {
    flashScannerBar();
    const raw = (code || "").trim();
    if (!raw) return;

    // Multiplicador rápido en pistola láser o teclado: ej. "50*FBR-6AVXZN" o "15*SKU"
    let multQty = 1;
    let q = raw;
    const multMatch = raw.match(/^(\d+(?:\.\d+)?)\s*[*xX]\s*(.+)$/);
    if (multMatch) {
      multQty = Math.max(1, Number(multMatch[1]) || 1);
      q = multMatch[2].trim();
    }

    // Detector de Caja Master (Carton Box QR: "BOX:SKU|SN1,SN2,SN3" o múltiples códigos separados por ;)
    if ((q.includes(";") || q.toUpperCase().startsWith("BOX:")) && (activeTab === "dispatch" || activeTab === "purchases")) {
      handleCartonBoxMasterQr(q);
      return;
    }

    if (activeTab === "verify") {
      playBeep("ok");
      await runVerifierLookup(q);
      return;
    }

    if (activeTab === "returns") {
      const qLow = q.toLowerCase();
      const activeAsg = almAssignments.find(
        (a) =>
          (a.status === "en_uso" || a.status === "entregado") &&
          ((a.unitSku && a.unitSku.toLowerCase().includes(qLow)) ||
            (a.productSku && a.productSku.toLowerCase().includes(qLow)) ||
            (a.itemUnitId && a.itemUnitId.toLowerCase().includes(qLow)))
      );
      if (activeAsg) {
        playBeep("ok");
        const rInp = document.getElementById("returns-search-input");
        if (rInp) rInp.value = q;
        renderReturnsList();
        showToast(`Encontrado para devolución: ${activeAsg.productName} (${activeAsg.employeeName})`, "success");
        speakFeedback(`Devolución de ${activeAsg.productName}`);
      } else {
        playBeep("error");
        showToast(`No se halló asignación activa con código "${q}"`, "warn");
        speakFeedback("Código sin asignación activa");
      }
      return;
    }

    const match = findProductOrUnitByCode(q);
    if (!match) {
      playBeep("error");
      showToast(`Código "${q}" no encontrado en catálogo`, "error");
      speakFeedback("Código no encontrado");
      return;
    }

    if (activeTab === "purchases") {
      playBeep("ok");
      for (let i = 0; i < multQty; i++) addProductToPurchaseCart(match.product.id);
      speakFeedback(`${match.product.name} agregado a compra`);
      return;
    }

    if (activeTab === "dispatch" || activeTab === "epp") {
      if (match.unit && match.unit.status !== "disponible") {
        playBeep("error");
        showToast(`Unidad ${match.unit.sku} ya figura como "${match.unit.status}"`, "warn");
        speakFeedback("Error, unidad ya asignada");
        return;
      }
      if (activeTab === "epp") switchAlmacenTab("dispatch");
      addToDispatchCart(match.product.id, multQty, match.unit || null);
      return;
    }

    playBeep("ok");
    switchAlmacenTab("verify");
    await runVerifierLookup(q);
  }

  // Atajos de teclado tipo supermercado (F2, F4, F8, F9, +/-) + Pistola láser global
  let wedgeBuffer = "";
  let wedgeTimer = null;
  document.addEventListener("keydown", function (e) {
    if (e.key === "F2") {
      e.preventDefault();
      const inp = document.getElementById("global-scan-input");
      if (inp) {
        inp.focus();
        inp.select();
      }
      showToast("Escáner listo (F2)", "info");
      return;
    }
    if (e.key === "F4") {
      e.preventDefault();
      if (activeTab !== "dispatch") switchAlmacenTab("dispatch");
      if (isMobileSheetViewport() && !mobileCartOpen) window.openMobileCart();
      document.getElementById("dispatch-employee-select")?.focus();
      showToast("Selecciona técnico (F4)", "info");
      return;
    }
    if (e.key === "F8") {
      e.preventDefault();
      if (activeTab === "dispatch") {
        window.clearDispatchCart();
        showToast("Canasta vaciada (F8)", "info");
      }
      return;
    }
    if (e.key === "F9") {
      e.preventDefault();
      if (activeTab === "dispatch") {
        window.confirmDispatchCart();
      }
      return;
    }

    const tag = (document.activeElement?.tagName || "").toUpperCase();
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;

    if ((e.key === "+" || e.key === "-") && activeTab === "dispatch" && dispatchCart.length > 0 && wedgeBuffer.length === 0) {
      e.preventDefault();
      window.updateCartQty(dispatchCart.length - 1, e.key === "+" ? 1 : -1);
      return;
    }

    if (e.key === "Enter" && wedgeBuffer.length >= 3) {
      e.preventDefault();
      const captured = wedgeBuffer;
      wedgeBuffer = "";
      processScannedCode(captured);
      return;
    }
    if (e.key.length === 1) {
      wedgeBuffer += e.key;
      clearTimeout(wedgeTimer);
      wedgeTimer = setTimeout(() => {
        wedgeBuffer = "";
      }, 120);
    }
  });

  // =========================================================================
  // ESCÁNER POR CÁMARA (BarcodeDetector NATIVO + FALLBACK jsQR)
  // =========================================================================
  window.openCameraScanner = async function () {
    const modal = document.getElementById("camera-scanner-modal");
    const video = document.getElementById("camera-video");
    const status = document.getElementById("camera-status-text");
    if (!modal || !video) return;

    modal.classList.remove("hidden");
    status.textContent = "Iniciando cámara trasera...";

    if ("BarcodeDetector" in window && !barcodeDetector) {
      try {
        barcodeDetector = new window.BarcodeDetector({
          formats: ["qr_code", "code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e", "itf"],
        });
      } catch (_) {
        barcodeDetector = null;
      }
    }

    try {
      camStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      video.srcObject = camStream;
      await video.play();
      status.textContent = barcodeDetector
        ? "Lector 1D/QR activo • Apunta al código"
        : "Lector QR activo • Apunta al código";
      scanCameraFrame();
    } catch (err) {
      status.textContent = "No se pudo abrir la cámara. Verifica permisos del navegador.";
      showToast("Permiso de cámara denegado o no disponible", "error");
    }
  };

  async function scanCameraFrame() {
    const video = document.getElementById("camera-video");
    const canvas = document.getElementById("camera-canvas");
    if (!camStream || !video || video.readyState < 2) {
      camAnimId = requestAnimationFrame(scanCameraFrame);
      return;
    }

    let detected = null;
    if (barcodeDetector) {
      try {
        const codes = await barcodeDetector.detect(video);
        if (codes && codes.length > 0 && codes[0].rawValue) {
          detected = codes[0].rawValue;
        }
      } catch (_) {}
    }

    if (!detected && typeof window.jsQR === "function" && canvas) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const qr = window.jsQR(imgData.data, imgData.width, imgData.height, { inversionAttempts: "dontInvert" });
      if (qr && qr.data) detected = qr.data;
    }

    const now = Date.now();
    if (detected && (detected !== lastScannedCode || now - lastScannedAt > 1800)) {
      lastScannedCode = detected;
      lastScannedAt = now;
      processScannedCode(detected);
    }

    camAnimId = requestAnimationFrame(scanCameraFrame);
  }

  window.closeCameraScanner = function () {
    if (camAnimId) cancelAnimationFrame(camAnimId);
    camAnimId = null;
    if (camStream) {
      camStream.getTracks().forEach((t) => t.stop());
      camStream = null;
    }
    const modal = document.getElementById("camera-scanner-modal");
    if (modal) modal.classList.add("hidden");
  };

  // =========================================================================
  // MÓDULO 1: DESPACHO POS + PEDIDOS EN VIVO DE TURBOTECH
  // =========================================================================
  window.toggleRequestsExpanded = function () {
    requestsExpanded = !requestsExpanded;
    const list = document.getElementById("tech-requests-list");
    const btn = document.getElementById("btn-toggle-reqs");
    if (list) list.classList.toggle("hidden", !requestsExpanded);
    if (btn) btn.textContent = requestsExpanded ? "Ocultar" : "Mostrar";
  };

  function renderTechRequestsBanner() {
    const pending = almRequests.filter((r) => r.status === "pendiente");
    const banner = document.getElementById("tech-requests-banner");
    const badge = document.getElementById("badge-pending-requests");
    const list = document.getElementById("tech-requests-list");

    if (badge) {
      badge.textContent = pending.length;
      badge.classList.toggle("hidden", pending.length === 0);
    }
    if (!banner || !list) return;
    if (pending.length === 0) {
      banner.classList.add("hidden");
      return;
    }
    banner.classList.remove("hidden");
    list.innerHTML = pending
      .map(
        (r) => `
      <div class="rounded-xl bg-white dark:bg-slate-900/90 border border-amber-500/30 p-2.5 flex items-center justify-between gap-2">
        <div class="min-w-0">
          <div class="text-xs font-extrabold text-slate-900 dark:text-white truncate">
            ${r.type === "devolucion" ? "↩️ Devolución" : "📦 Pedido"}: ${esc(r.itemName)} <span class="font-mono text-amber-500">x${r.quantity} ${esc(r.unit || "")}</span>
          </div>
          <div class="text-[11px] text-slate-500 truncate">${esc(r.techName)} • ${esc(r.reason || "Sin nota")}</div>
        </div>
        <div class="flex items-center gap-1 flex-shrink-0">
          <button type="button" onclick="loadRequestIntoCart('${esc(r.id)}')" class="pos-press px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold">Atender</button>
          <button type="button" onclick="resolveMaterialRequest('${esc(r.id)}', 'rechazado')" class="pos-press px-2 py-1.5 rounded-lg bg-rose-500/15 text-rose-500 text-[11px] font-bold">✕</button>
        </div>
      </div>`
      )
      .join("");
  }

  window.loadRequestIntoCart = async function (reqId) {
    const req = almRequests.find((r) => r.id === reqId);
    if (!req) return;

    const dispEmp = document.getElementById("dispatch-employee-select");
    if (dispEmp) {
      if (req.techId) dispEmp.value = String(req.techId);
      if (!dispEmp.value && req.techName) {
        const matchEmp = almEmployees.find(
          (e) => getEmployeeDisplayName(e).trim().toLowerCase() === String(req.techName).trim().toLowerCase()
        );
        if (matchEmp) dispEmp.value = String(matchEmp.id);
      }
      handleDispatchTechChange();
    }

    const prod =
      almProducts.find((p) => String(p.id) === String(req.productId)) ||
      almProducts.find((p) => p.name.toLowerCase().includes((req.itemName || "").toLowerCase()));

    if (prod) {
      addToDispatchCart(prod.id, Number(req.quantity) || 1, null);
      playBeep("ok");
      await resolveMaterialRequest(reqId, "aprobado", true);
      showToast(`Pedido de ${req.techName} cargado a la canasta`, "success");
    } else {
      await resolveMaterialRequest(reqId, "aprobado", false);
      showToast(`Pedido aprobado. Selecciona manualmente "${req.itemName}" en el catálogo.`, "warn");
    }
  };

  window.resolveMaterialRequest = async function (reqId, status, silent) {
    try {
      await fetch(`/api/apartados/material-requests/${encodeURIComponent(reqId)}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminNote: `Atendido desde TurboAlmacén POS por ${almUser?.name || "Almacén"}` }),
      });
      almRequests = almRequests.map((r) => (r.id === reqId ? { ...r, status } : r));
      renderTechRequestsBanner();
      if (!silent) showToast(`Solicitud marcada como ${status}`, "info");
    } catch (_) {
      showToast("No se pudo actualizar la solicitud", "error");
    }
  };

  window.setDispatchFilter = function (f) {
    dispatchFilter = f;
    document.querySelectorAll(".dfilter-btn").forEach((b) => {
      const act = b.getAttribute("data-dfilter") === f;
      const isLow = b.getAttribute("data-dfilter") === "low";
      b.classList.toggle("alm-btn-primary", act);
      b.classList.toggle("alm-surface", !act);
      if (isLow) {
        b.classList.toggle("text-rose-500", !act);
      } else {
        b.classList.toggle("text-slate-600", !act);
        b.classList.toggle("dark:text-slate-300", !act);
      }
    });
    renderDispatchCatalog();
  };

  function getProductTypeIcon(type) {
    if (type === "bulk") {
      return `<svg class="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>`;
    }
    if (type === "epp") {
      return `<svg class="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>`;
    }
    return `<svg class="w-4 h-4 text-sky-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>`;
  }

  function getSpoolReservationsMap() {
    try {
      return JSON.parse(localStorage.getItem("turboalmacen_spool_reservations") || "{}") || {};
    } catch (_) {
      return {};
    }
  }

  function getCustomBulkQuickValues(p) {
    const hay = `${p.name || ""} ${p.categoryName || ""} ${p.unitOfMeasure || ""}`.toLowerCase();
    if (/drop|fibra|adss|asu|cable|bobina|utp/i.test(hay)) {
      return [50, 100, 150];
    }
    if (/cintillo|grapa|conector|templador|tarugo|tornillo/i.test(hay)) {
      return [25, 50, 100];
    }
    return [10, 50, 100];
  }

  window.renderDispatchCatalog = function () {
    const grid = document.getElementById("dispatch-products-grid");
    if (!grid) return;

    const countAll = document.getElementById("dcount-all");
    if (countAll) countAll.textContent = almProducts.length > 0 ? String(almProducts.length) : "";

    const catId = document.getElementById("dispatch-category-select")?.value || "";
    const q = liveSearchTerm.toLowerCase();

    const filtered = almProducts.filter((p) => {
      if (catId && String(p.categoryId) !== String(catId)) return false;
      if (dispatchFilter === "bulk" && p.type !== "bulk") return false;
      if (dispatchFilter === "simple" && p.type !== "simple") return false;
      if (dispatchFilter === "epp" && p.type !== "epp") return false;
      if (dispatchFilter === "low" && Number(p.stock) > Number(p.stockMin || 5)) return false;
      if (q) {
        const hay = `${p.name || ""} ${p.sku || ""} ${p.barcode || ""} ${p.location || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const isList = catalogViewMode === "list";
    grid.className = isList
      ? "grid grid-cols-1 md:grid-cols-2 gap-2.5"
      : "grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3";

    if (filtered.length === 0) {
      grid.innerHTML = `<div class="col-span-full alm-surface rounded-2xl border-dashed p-10 text-center text-xs text-slate-400">No hay productos que coincidan con el filtro actual.</div>`;
      return;
    }

    const cartQtyByProd = new Map();
    for (const item of dispatchCart) {
      const pid = String(item.productId);
      cartQtyByProd.set(pid, (cartQtyByProd.get(pid) || 0) + Number(item.quantity || 0));
    }

    const reservations = getSpoolReservationsMap();

    grid.innerHTML = filtered
      .map((p) => {
        const pidStr = String(p.id);
        const pidAttr = esc(pidStr);
        const stock = Number(p.stock || 0);
        const reservedQty = Number(reservations[pidStr]?.meters || 0);
        const isCritical = stock <= Number(p.stockCritical || 2);
        const isLow = stock <= Number(p.stockMin || 5);
        const stockBadge = isCritical
          ? "alm-badge-crit"
          : isLow
          ? "alm-badge-warn"
          : "alm-badge-ok";
        const img = Array.isArray(p.images) && p.images[0] ? p.images[0] : "";
        const unitLabel = p.type === "bulk" ? p.unitOfMeasure || "m" : "und";
        const inCartQty = cartQtyByProd.get(pidStr) || 0;
        const typeTag = p.type === "bulk" ? "GRANEL" : p.type === "epp" ? "EPP" : "EQUIPO";

        // Auto-clasificación de RETAZO (< 120m en bobinas) + Barra visual de vida de bobina
        const isMeterSpool = p.type === "bulk" && /m|metro|bobina|fibra|cable/i.test(`${unitLabel} ${p.name}`);
        const isRetazo = isMeterSpool && stock > 0 && stock <= 120;
        const nominalCapacity = isMeterSpool ? Math.max(stock, stock > 2000 ? 4000 : stock > 1000 ? 2000 : 1000) : Math.max(stock, 100);
        const lifePct = Math.min(100, Math.max(3, Math.round((stock / nominalCapacity) * 100)));

        const spoolBarHtml =
          p.type === "bulk"
            ? `<div class="mt-1.5 space-y-1">
                <div class="flex items-center justify-between text-[9px] font-mono text-slate-400">
                  <span>${stock}/${nominalCapacity}${esc(unitLabel)} (${lifePct}%)</span>
                  ${reservedQty > 0 ? `<span class="text-amber-500 font-bold">🔒 Res: ${reservedQty}${esc(unitLabel)}</span>` : ""}
                </div>
                <div class="w-full h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                  <div class="h-full rounded-full ${isRetazo ? "bg-amber-500" : "bg-emerald-500"}" style="width:${lifePct}%"></div>
                </div>
              </div>`
            : "";

        const qVals = getCustomBulkQuickValues(p);
        const quickBulkBtns =
          p.type === "bulk"
            ? `<div class="grid grid-cols-4 gap-1 mt-2">
                ${qVals.map((v) => `<button type="button" onclick="event.stopPropagation(); addToDispatchCart('${pidAttr}', ${v})" class="pos-press alm-bulk-btn py-1 rounded-lg text-[10px] font-mono font-bold">+${v}</button>`).join("")}
                <button type="button" onclick="event.stopPropagation(); openSpoolToolsModal('${pidAttr}')" title="Calculadora de Marcas, Balanza, Corte Sub-Bobina y Etiqueta Saldo" class="pos-press alm-brand-badge py-1 rounded-lg text-[10px] font-bold">⚙️ Bobina</button>
              </div>`
            : "";

        const actionControl =
          inCartQty > 0
            ? `<div onclick="event.stopPropagation()" class="alm-brand-bg inline-flex items-center rounded-xl p-0.5 shadow-sm">
                <button type="button" onclick="adjustProductCartQty('${pidAttr}', -1)" aria-label="Restar" class="pos-press w-6 h-6 rounded-lg hover:bg-black/15 font-extrabold text-xs flex items-center justify-center">−</button>
                <span class="px-2 font-mono text-[11px] font-extrabold tabular-nums">${inCartQty}</span>
                <button type="button" onclick="adjustProductCartQty('${pidAttr}', 1)" aria-label="Sumar" class="pos-press w-6 h-6 rounded-lg hover:bg-black/15 font-extrabold text-xs flex items-center justify-center">+</button>
              </div>`
            : `<button type="button" onclick="event.stopPropagation(); addToDispatchCart('${pidAttr}', 1)" class="alm-btn-soft pos-press px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 flex-shrink-0">
                <span>+ Agregar</span>
              </button>`;

        if (isList) {
          return `
          <div onclick="addToDispatchCart('${pidAttr}', 1)" class="pos-card ${inCartQty > 0 ? "in-cart" : ""} cursor-pointer rounded-2xl p-3 flex items-center justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0 flex-1">
              ${
                img
                  ? `<div class="w-12 h-12 rounded-xl bg-slate-100 dark:bg-black/30 overflow-hidden flex-shrink-0 flex items-center justify-center"><img src="${esc(img)}" alt="${esc(p.name)}" class="w-full h-full object-cover" loading="lazy"></div>`
                  : `<div class="alm-icon-chip w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center">${getProductTypeIcon(p.type)}</div>`
              }
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${stockBadge}">${stock} ${esc(unitLabel)}</span>
                  ${isRetazo ? `<span class="px-1.5 py-0.5 rounded-md text-[9px] font-mono font-extrabold bg-amber-500/20 text-amber-500 border border-amber-500/30">RETAZO</span>` : ""}
                  <span class="text-[10px] font-mono text-slate-400">${esc(p.sku)}</span>
                  <span class="text-[10px] font-mono text-slate-400 uppercase">• ${esc(p.location || typeTag)}</span>
                </div>
                <div class="text-xs font-bold text-slate-900 dark:text-slate-100 leading-snug mt-1 line-clamp-2">${esc(p.name)}</div>
                ${spoolBarHtml}
              </div>
            </div>
            <div class="flex flex-col items-end gap-1.5 flex-shrink-0">
              ${actionControl}
              ${
                p.type === "bulk"
                  ? `<div class="flex items-center gap-1">
                      ${qVals.map((v) => `<button type="button" onclick="event.stopPropagation(); addToDispatchCart('${pidAttr}', ${v})" class="pos-press alm-bulk-btn px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold">+${v}</button>`).join("")}
                      <button type="button" onclick="event.stopPropagation(); openSpoolToolsModal('${pidAttr}')" class="pos-press alm-brand-badge px-1.5 py-0.5 rounded-md text-[10px] font-bold">⚙️</button>
                    </div>`
                  : ""
              }
            </div>
          </div>`;
        }

        return `
        <div onclick="addToDispatchCart('${pidAttr}', 1)" class="pos-card ${inCartQty > 0 ? "in-cart" : ""} cursor-pointer rounded-2xl p-3 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between gap-1.5 mb-2">
              <div class="flex items-center gap-1">
                <span class="px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-mono font-bold ${stockBadge}">${stock} ${esc(unitLabel)}</span>
                ${isRetazo ? `<span class="px-1.5 py-0.5 rounded-md text-[9px] font-mono font-extrabold bg-amber-500/20 text-amber-500 border border-amber-500/30">RETAZO</span>` : ""}
              </div>
              <span class="text-[10px] font-mono font-medium text-slate-400 uppercase tracking-wide truncate">${esc(p.location || typeTag)}</span>
            </div>
            ${
              img
                ? `<div class="w-full h-20 sm:h-24 rounded-xl bg-slate-100 dark:bg-black/30 mb-2 overflow-hidden flex items-center justify-center"><img src="${esc(img)}" alt="${esc(p.name)}" class="pos-card-img w-full h-full object-cover" loading="lazy"></div>`
                : `<div class="alm-icon-chip w-9 h-9 rounded-xl mb-2 flex items-center justify-center">${getProductTypeIcon(p.type)}</div>`
            }
            <div class="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug tracking-tight">${esc(p.name)}</div>
            ${spoolBarHtml}
          </div>
          <div class="mt-2.5">
            <div class="alm-divider-t flex items-center justify-between gap-1.5 pt-2">
              <span class="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">${esc(p.sku)}</span>
              ${actionControl}
            </div>
            ${quickBulkBtns}
          </div>
        </div>`;
      })
      .join("");
  };

  window.adjustProductCartQty = function (productId, delta) {
    const pid = String(productId);
    const idx = dispatchCart.findIndex((it) => String(it.productId) === pid);
    if (idx === -1) {
      if (delta > 0) window.addToDispatchCart(productId, delta);
      return;
    }
    window.updateCartQty(idx, delta);
  };

  window.addToDispatchCart = function (productId, qty, specificUnit) {
    const pid = String(productId);
    const prod = almProducts.find((p) => String(p.id) === pid);
    if (!prod) return;

    // Bloqueo de despacho de equipos recuperados sin testear (En Laboratorio)
    if (specificUnit && (specificUnit.conditionStatus === "regular" || (specificUnit.notes || "").includes("[LAB_PENDIENTE]"))) {
      playBeep("error");
      showToast(`⛔ Unidad ${specificUnit.sku} bloqueada: proviene de retiro y requiere aprobar Test/Reset en Laboratorio`, "error");
      speakFeedback("Equipo bloqueado, pendiente de test en laboratorio");
      return;
    }

    const reservations = getSpoolReservationsMap();
    const reservedMeters = Number(reservations[pid]?.meters || 0);
    const effectiveMaxStock = Math.max(0, Number(prod.stock || 0) - reservedMeters);

    if (effectiveMaxStock <= 0) {
      playBeep("error");
      showToast(
        reservedMeters > 0
          ? `Stock bloqueado por Reserva de Proyecto (${reservedMeters} reservados)`
          : `Sin stock disponible para ${prod.name}`,
        "error"
      );
      speakFeedback("Sin stock disponible");
      return;
    }

    const quantity = Number(qty) || 1;
    const unitKey = specificUnit ? `unit:${specificUnit.id}` : `prod:${prod.id}`;
    const existing = dispatchCart.find((it) => it.key === unitKey);

    if (existing) {
      if (specificUnit) {
        showToast(`La unidad ${specificUnit.sku} ya está en la canasta`, "warn");
        return;
      }
      if (existing.quantity + quantity > effectiveMaxStock) {
        playBeep("error");
        showToast(`Stock disponible máximo alcanzado (${effectiveMaxStock})`, "warn");
        return;
      }
      existing.quantity += quantity;
    } else {
      const cappedQty = Math.min(quantity, effectiveMaxStock);
      const availableUnits = Array.isArray(prod.itemUnits)
        ? prod.itemUnits.filter((u) => u.status === "disponible" && !(u.notes || "").includes("[LAB_PENDIENTE]"))
        : [];
      let firstVariant = Array.isArray(prod.variants) && prod.variants.length > 0 ? prod.variants[0].name : "";

      // Sugerir talla guardada del técnico si aplica
      const empId = document.getElementById("dispatch-employee-select")?.value;
      const empSizes = empId ? getEmployeeSizesMap()[String(empId)] : null;
      if (empSizes && Array.isArray(prod.variants) && prod.variants.length > 0) {
        const nLow = (prod.name || "").toLowerCase();
        const pref = /bota|zapato|calzado/i.test(nLow) ? empSizes.shoe : /pantal/i.test(nLow) ? empSizes.pants : empSizes.shirt;
        const foundV = pref && prod.variants.find((v) => v.name.toLowerCase().includes(String(pref).toLowerCase()));
        if (foundV) firstVariant = foundV.name;
      }

      dispatchCart.push({
        key: unitKey,
        productId: prod.id,
        name: prod.name,
        sku: prod.sku,
        type: prod.type,
        unitOfMeasure: prod.unitOfMeasure || "und",
        quantity: cappedQty,
        maxStock: effectiveMaxStock,
        itemUnitId: specificUnit ? specificUnit.id : "",
        unitSku: specificUnit ? specificUnit.sku : "",
        unitNumber: specificUnit ? specificUnit.itemNumber : undefined,
        variantName: firstVariant,
        availableUnits,
        variants: Array.isArray(prod.variants) ? prod.variants : [],
        image: Array.isArray(prod.images) && prod.images[0] ? prod.images[0] : "",
      });
    }

    playBeep("ok");
    speakFeedback(`${prod.name}, quedan ${Math.max(0, effectiveMaxStock - quantity)}`);
    updateCartTechWarnings();
    renderDispatchCart();
    renderDispatchCatalog();
    renderCartHoldTabs();
  };

  // =========================================================================
  // CANASTAS EN ESPERA (HOLD / PAUSA MULTI-SLOT) + CLONAR ÚLTIMO DESPACHO
  // =========================================================================
  function renderCartHoldTabs() {
    const box = document.getElementById("cart-hold-tabs");
    if (!box) return;
    cartHoldSlots[activeHoldSlot].items = dispatchCart;
    cartHoldSlots[activeHoldSlot].employeeId = document.getElementById("dispatch-employee-select")?.value || "";
    cartHoldSlots[activeHoldSlot].notes = document.getElementById("dispatch-notes-input")?.value || "";

    box.innerHTML = cartHoldSlots
      .map((slot, idx) => {
        const isAct = idx === activeHoldSlot;
        const count = (idx === activeHoldSlot ? dispatchCart : slot.items).length;
        return `<button type="button" onclick="switchCartHoldSlot(${idx})" class="pos-press px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold ${isAct ? "alm-btn-primary" : "alm-surface text-slate-500"}">
          Canasta ${slot.label} ${count > 0 ? `(${count})` : ""}
        </button>`;
      })
      .join("");
  }

  window.switchCartHoldSlot = function (slotIdx) {
    if (slotIdx === activeHoldSlot || !cartHoldSlots[slotIdx]) return;
    cartHoldSlots[activeHoldSlot] = {
      ...cartHoldSlots[activeHoldSlot],
      items: [...dispatchCart],
      employeeId: document.getElementById("dispatch-employee-select")?.value || "",
      notes: document.getElementById("dispatch-notes-input")?.value || "",
    };
    activeHoldSlot = slotIdx;
    const next = cartHoldSlots[slotIdx];
    dispatchCart = [...(next.items || [])];
    const empSel = document.getElementById("dispatch-employee-select");
    if (empSel) empSel.value = next.employeeId || "";
    const notesInp = document.getElementById("dispatch-notes-input");
    if (notesInp) notesInp.value = next.notes || "";
    handleDispatchTechChange();
    renderDispatchCart();
    renderDispatchCatalog();
    renderCartHoldTabs();
    showToast(`Cambiado a Canasta ${next.label}`, "info");
  };

  window.repeatLastTechDispatch = function () {
    const empId = document.getElementById("dispatch-employee-select")?.value;
    if (!empId) {
      showToast("Selecciona primero un técnico para clonar su último despacho", "warn");
      return;
    }
    const techAsgs = almAssignments.filter((a) => String(a.employeeId) === String(empId));
    if (techAsgs.length === 0) {
      showToast("Este técnico no tiene despachos previos registrados", "warn");
      return;
    }
    const latestDate = (techAsgs[0].assignedAt || "").slice(0, 16);
    const lastBatch = techAsgs.filter((a) => (a.assignedAt || "").slice(0, 16) === latestDate).slice(0, 12);
    let added = 0;
    lastBatch.forEach((a) => {
      const prod = almProducts.find((p) => String(p.id) === String(a.productId));
      if (prod && prod.stock > 0) {
        addToDispatchCart(prod.id, Math.min(a.quantity || 1, prod.stock), null);
        added++;
      }
    });
    if (added > 0) {
      showToast(`↺ Se clonaron ${added} productos del último despacho del técnico`, "success");
    } else {
      showToast("Los productos del último despacho no tienen stock disponible", "warn");
    }
  };

  // =========================================================================
  // PRÉSTAMO DE HERRAMIENTAS + FIRMA TÁCTIL EN PANTALLA + COLA OFFLINE
  // =========================================================================
  window.toggleCartExtras = function (which) {
    const id = which === "loan" ? "cart-tool-loan-box" : "cart-signature-box";
    document.getElementById(id)?.classList.toggle("hidden");
  };

  window.handleLoanPhotoInput = function (input) {
    const file = input?.files?.[0];
    const prev = document.getElementById("dispatch-loan-photo-preview");
    if (file && prev) {
      loanPhotoName = file.name;
      prev.textContent = `✓ Foto adjunta: ${file.name}`;
      prev.classList.remove("hidden");
    }
  };

  function initSignatureCanvas() {
    const canvas = document.getElementById("dispatch-signature-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";

    function getPos(e) {
      const r = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) * canvas.width) / r.width,
        y: ((e.clientY - r.top) * canvas.height) / r.height,
      };
    }

    canvas.addEventListener("pointerdown", (e) => {
      sigCanvasDrawing = true;
      sigHasStrokes = true;
      const p = getPos(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (_) {}
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!sigCanvasDrawing) return;
      const p = getPos(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    });
    const stop = () => {
      sigCanvasDrawing = false;
    };
    canvas.addEventListener("pointerup", stop);
    canvas.addEventListener("pointercancel", stop);
  }

  window.clearDispatchSignature = function () {
    const canvas = document.getElementById("dispatch-signature-canvas");
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    sigHasStrokes = false;
    const pinInp = document.getElementById("dispatch-tech-pin");
    if (pinInp) pinInp.value = "";
  };

  function getOfflineDispatchQueue() {
    try {
      return JSON.parse(localStorage.getItem("turboalmacen_offline_queue") || "[]") || [];
    } catch (_) {
      return [];
    }
  }

  function saveOfflineDispatchQueue(q) {
    try {
      localStorage.setItem("turboalmacen_offline_queue", JSON.stringify(q));
    } catch (_) {}
    syncOfflineQueueBadge();
  }

  function syncOfflineQueueBadge() {
    const badge = document.getElementById("alm-offline-badge");
    const countEl = document.getElementById("alm-offline-count");
    const q = getOfflineDispatchQueue();
    if (!badge) return;
    if (q.length > 0 || !navigator.onLine) {
      badge.classList.remove("hidden");
      badge.classList.add("inline-flex");
      if (countEl) countEl.textContent = q.length > 0 ? `${q.length} Cola Offline` : "Modo Offline";
    } else {
      badge.classList.add("hidden");
      badge.classList.remove("inline-flex");
    }
  }

  window.syncOfflineDispatchQueue = async function () {
    const q = getOfflineDispatchQueue();
    if (q.length === 0) return;
    let synced = 0;
    const remaining = [];
    for (const item of q) {
      try {
        const res = await fetch("/api/inventory/personnel-assignments/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.payload),
        });
        if (res.ok) synced++;
        else remaining.push(item);
      } catch (_) {
        remaining.push(item);
      }
    }
    saveOfflineDispatchQueue(remaining);
    if (synced > 0) {
      showToast(`☁️ ${synced} despacho(s) offline sincronizados con el servidor`, "success");
      await refreshAllWarehouseData(false);
    }
  };

  window.updateCartQty = function (idx, delta) {
    const it = dispatchCart[idx];
    if (!it) return;
    const next = it.quantity + delta;
    if (next <= 0) {
      dispatchCart.splice(idx, 1);
    } else if (next <= it.maxStock) {
      it.quantity = next;
    } else {
      it.quantity = it.maxStock;
      showToast(`Stock máximo disponible: ${it.maxStock}`, "warn");
    }
    renderDispatchCart();
    renderDispatchCatalog();
  };

  window.setCartQtyDirect = function (idx, rawValue) {
    const it = dispatchCart[idx];
    if (!it) return;
    const parsed = Math.floor(Number(rawValue));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      dispatchCart.splice(idx, 1);
    } else if (parsed > it.maxStock) {
      it.quantity = it.maxStock;
      showToast(`Ajustado al stock máximo disponible (${it.maxStock})`, "warn");
    } else {
      it.quantity = parsed;
    }
    renderDispatchCart();
    renderDispatchCatalog();
  };

  window.setCartItemVariant = function (idx, variantName) {
    if (dispatchCart[idx]) dispatchCart[idx].variantName = variantName;
  };

  window.setCartItemUnit = function (idx, unitId) {
    const it = dispatchCart[idx];
    if (!it) return;
    const u = (it.availableUnits || []).find((x) => x.id === unitId);
    it.itemUnitId = u ? u.id : "";
    it.unitSku = u ? u.sku : "";
    it.unitNumber = u ? u.itemNumber : undefined;
    if (u) it.quantity = 1;
    renderDispatchCart();
  };

  window.removeCartItem = function (idx) {
    dispatchCart.splice(idx, 1);
    renderDispatchCart();
    renderDispatchCatalog();
  };

  window.clearDispatchCart = function () {
    dispatchCart = [];
    renderDispatchCart();
    renderDispatchCatalog();
  };

  function syncMobileCartBarUI() {
    const fab = document.getElementById("mobile-cart-fab");
    const iconPill = document.getElementById("mobile-cart-icon-pill");
    const titleEl = document.getElementById("mobile-cart-title");
    const subEl = document.getElementById("mobile-cart-subtitle");
    const countEl = document.getElementById("mobile-cart-count");
    const chevEl = document.getElementById("mobile-cart-chevron");
    if (!fab) return;

    const lineCount = dispatchCart.length;
    const totalUnits = dispatchCart.reduce((acc, i) => acc + Number(i.quantity || 0), 0);
    const empSel = document.getElementById("dispatch-employee-select");
    const techName =
      empSel && empSel.value
        ? empSel.options[empSel.selectedIndex]?.getAttribute("data-name") || "Técnico seleccionado"
        : "";

    if (lineCount === 0) {
      fab.classList.add("is-empty");
      if (iconPill) iconPill.className = "alm-brand-badge w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0";
      if (titleEl) {
        titleEl.textContent = "Canasta de Despacho";
        titleEl.className = "text-xs font-extrabold text-slate-900 dark:text-white truncate";
      }
      if (subEl) {
        subEl.textContent = techName ? `Para: ${techName}` : "Toca un producto para agregar";
        subEl.className = "text-[11px] text-slate-500 dark:text-slate-400 truncate";
      }
      if (countEl) {
        countEl.textContent = "0";
        countEl.className = "px-2.5 py-1 rounded-xl bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-200 font-mono text-xs font-extrabold";
      }
      if (chevEl) chevEl.setAttribute("class", "w-4 h-4 text-slate-400");
    } else {
      fab.classList.remove("is-empty");
      if (iconPill) iconPill.className = "w-8 h-8 rounded-xl bg-white/20 text-white flex items-center justify-center flex-shrink-0";
      if (titleEl) {
        titleEl.textContent = `Ver Canasta • ${lineCount} ${lineCount === 1 ? "producto" : "productos"}`;
        titleEl.className = "text-xs font-extrabold text-white truncate";
      }
      if (subEl) {
        subEl.textContent = techName ? `Entregar a ${techName} (${totalUnits} uds)` : `${totalUnits} uds • Toca para despachar`;
        subEl.className = "text-[11px] text-white/85 truncate";
      }
      if (countEl) {
        countEl.textContent = String(lineCount);
        countEl.className = "px-2.5 py-1 rounded-xl bg-black/25 text-white font-mono text-xs font-extrabold";
      }
      if (chevEl) chevEl.setAttribute("class", "w-4 h-4 text-white");
    }
  }

  function renderDispatchCart() {
    const box = document.getElementById("dispatch-cart-items");
    const totalBadge = document.getElementById("cart-total-badge");
    const sub = document.getElementById("cart-summary-sub");
    const btnConfirm = document.getElementById("btn-confirm-dispatch");

    const totalItems = dispatchCart.reduce((acc, i) => acc + Number(i.quantity || 0), 0);
    if (totalBadge) totalBadge.textContent = `${dispatchCart.length} ítems`;
    if (sub) sub.textContent = dispatchCart.length ? `${dispatchCart.length} líneas • ${totalItems} uds totales` : "Escanea o toca productos para agregar";
    if (btnConfirm) btnConfirm.disabled = dispatchCart.length === 0;

    syncMobileCartBarUI();

    if (!box) return;
    if (dispatchCart.length === 0) {
      box.innerHTML = `<div class="h-full flex flex-col items-center justify-center text-center py-8 px-4">
        <div class="alm-icon-chip w-11 h-11 rounded-2xl border-dashed flex items-center justify-center text-slate-400 mb-2.5">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
          </svg>
        </div>
        <div class="text-xs font-bold text-slate-600 dark:text-slate-300">Canasta vacía</div>
        <div class="text-[11px] text-slate-400 mt-0.5">Pasa la pistola láser o toca un producto</div>
      </div>`;
      return;
    }

    box.innerHTML = dispatchCart
      .map(
        (it, idx) => `
      <div class="alm-cart-row alm-surface-inset rounded-xl p-2.5 space-y-2">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="text-xs font-bold text-slate-900 dark:text-white leading-snug line-clamp-2">${esc(it.name)}</div>
            <div class="text-[10px] font-mono text-slate-400 mt-0.5">${esc(it.unitSku || it.sku)} • Máx: ${it.maxStock} ${esc(it.type === "bulk" ? it.unitOfMeasure : "und")}</div>
          </div>
          <button type="button" onclick="removeCartItem(${idx})" aria-label="Quitar" class="pos-press p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 flex-shrink-0">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div class="flex items-center gap-1.5">
            <div class="alm-input inline-flex items-center gap-0.5 rounded-xl p-0.5">
              <button type="button" onclick="updateCartQty(${idx}, -1)" class="pos-press w-7 h-7 rounded-lg hover:bg-slate-200/60 dark:hover:bg-white/10 font-bold text-sm">−</button>
              <input
                type="number"
                min="1"
                max="${it.maxStock}"
                value="${it.quantity}"
                onchange="setCartQtyDirect(${idx}, this.value)"
                aria-label="Cantidad"
                class="w-12 text-center bg-transparent border-0 focus:outline-none font-mono text-xs font-extrabold tabular-nums text-slate-900 dark:text-white"
              />
              <button type="button" onclick="updateCartQty(${idx}, 1)" class="pos-press w-7 h-7 rounded-lg hover:bg-slate-200/60 dark:hover:bg-white/10 font-bold text-sm">+</button>
            </div>
            ${
              it.type === "bulk"
                ? `<div class="inline-flex items-center gap-1">
                    <button type="button" onclick="updateCartQty(${idx}, 10)" class="pos-press alm-bulk-btn px-1.5 py-1 rounded-lg text-[10px] font-mono font-bold">+10</button>
                    <button type="button" onclick="updateCartQty(${idx}, 50)" class="pos-press alm-bulk-btn px-1.5 py-1 rounded-lg text-[10px] font-mono font-bold">+50</button>
                  </div>`
                : ""
            }
          </div>
          ${
            it.variants && it.variants.length > 0
              ? `<select onchange="setCartItemVariant(${idx}, this.value)" class="alm-input px-2 py-1 rounded-lg text-[11px] font-semibold">
                  ${it.variants.map((v) => `<option value="${esc(v.name)}" ${v.name === it.variantName ? "selected" : ""}>${esc(v.name)}</option>`).join("")}
                </select>`
              : it.availableUnits && it.availableUnits.length > 0
              ? `<select onchange="setCartItemUnit(${idx}, this.value)" class="alm-input max-w-[155px] px-2 py-1 rounded-lg text-[10px] font-mono">
                  <option value="">Unidad genérica</option>
                  ${it.availableUnits.slice(0, 40).map((u) => `<option value="${esc(u.id)}" ${u.id === it.itemUnitId ? "selected" : ""}>${esc(u.sku)}${u.serialNumber ? " / " + esc(u.serialNumber) : ""}</option>`).join("")}
                </select>`
              : `<span class="text-[10px] font-mono text-slate-400">${esc(it.type === "bulk" ? it.unitOfMeasure : "und")}</span>`
          }
        </div>
      </div>`
      )
      .join("");
  }

  window.confirmDispatchCart = async function () {
    if (dispatchCart.length === 0) return;
    const empSel = document.getElementById("dispatch-employee-select");
    const employeeId = empSel?.value || "";
    if (!employeeId) {
      playBeep("error");
      showToast("Selecciona el técnico/personal que recibe el material", "warn");
      if (isMobileSheetViewport() && !mobileCartOpen) {
        window.openMobileCart();
      }
      empSel?.focus();
      return;
    }

    const employeeName = empSel.options[empSel.selectedIndex]?.getAttribute("data-name") || empSel.options[empSel.selectedIndex]?.text || "Técnico";
    const baseNotes = document.getElementById("dispatch-notes-input")?.value?.trim() || "Despacho desde TurboAlmacén POS";
    const isLoan = document.getElementById("dispatch-is-loan")?.checked;
    const loanTime = document.getElementById("dispatch-loan-time")?.value || "18:00";
    const techPin = document.getElementById("dispatch-tech-pin")?.value?.trim() || "";
    const autoPrint = document.getElementById("dispatch-auto-print")?.checked;
    const notifyChat = document.getElementById("dispatch-notify-chat")?.checked;

    const extraParts = [baseNotes];
    if (isLoan) extraParts.push(`⏱️ PRÉSTAMO (Devolver hoy ${loanTime})`);
    if (loanPhotoName) extraParts.push(`📷 Foto Checklist: ${loanPhotoName}`);
    if (techPin) extraParts.push(`🔐 Conformidad PIN/QR: ***${techPin.slice(-2)}`);
    if (sigHasStrokes) extraParts.push(`✍️ Firmado digitalmente en pantalla`);
    const notes = extraParts.join(" • ");

    const sigCanvas = document.getElementById("dispatch-signature-canvas");
    const signatureDataUrl = sigHasStrokes && sigCanvas ? sigCanvas.toDataURL("image/png") : "";

    const btn = document.getElementById("btn-confirm-dispatch");
    if (btn) btn.disabled = true;

    const payload = {
      employeeId,
      employeeName,
      personnelName: employeeName,
      assignedAt: new Date().toISOString(),
      items: dispatchCart.map((it) => ({
        productId: Number.isFinite(Number(it.productId)) ? Number(it.productId) : it.productId,
        productName: it.name,
        productSku: it.sku,
        productImage: it.image || undefined,
        quantity: Number(it.quantity),
        status: "en_uso",
        variantName: it.variantName || undefined,
        unitSku: it.unitSku || undefined,
        itemUnitId: it.itemUnitId || undefined,
        unitNumber: it.unitNumber,
        notes,
      })),
    };

    const ticketItems = dispatchCart.map((it) => ({
      name: it.name,
      code: it.unitSku || it.sku,
      qty: `${it.quantity} ${it.type === "bulk" ? it.unitOfMeasure : "und"}`,
      extra: it.variantName ? `Talla/Var: ${it.variantName}` : "",
    }));

    try {
      const res = await fetch("/api/inventory/personnel-assignments/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Error registrando despacho");
      }

      playBeep("ok");
      speakFeedback(`Despacho confirmado para ${employeeName}`);
      showToast(`✅ Despacho confirmado para ${employeeName}`, "success");
    } catch (err) {
      if (!navigator.onLine || /fetch|network|offline/i.test(String(err.message))) {
        const q = getOfflineDispatchQueue();
        q.push({ id: `off-${Date.now()}`, payload, createdAt: new Date().toISOString() });
        saveOfflineDispatchQueue(q);
        playBeep("ok");
        showToast(`📦 Guardado en Cola Offline (${q.length}). Se sincronizará al volver la red.`, "warn");
      } else {
        playBeep("error");
        showToast(err.message || "Error en despacho", "error");
        if (btn) btn.disabled = dispatchCart.length === 0;
        return;
      }
    }

    const opCode = `DESP-${Date.now().toString().slice(-6)}`;
    if (notifyChat) {
      sendTechDispatchNotification(employeeName, opCode, ticketItems, notes);
    }

    dispatchCart = [];
    cartHoldSlots[activeHoldSlot].items = [];
    loanPhotoName = "";
    document.getElementById("dispatch-loan-photo-preview")?.classList.add("hidden");
    window.clearDispatchSignature();
    if (document.getElementById("dispatch-notes-input")) document.getElementById("dispatch-notes-input").value = "";
    if (mobileCartOpen) window.closeMobileCart();
    await refreshAllWarehouseData(false);

    if (autoPrint) {
      openThermalTicket({
        title: isLoan ? "VALE DE PRÉSTAMO DE HERRAMIENTA" : "VALE DE DESPACHO DE ALMACÉN",
        code: opCode,
        targetLabel: "ENTREGADO A",
        targetName: employeeName,
        notes,
        signatureDataUrl,
        items: ticketItems,
      });
    }
    if (btn) btn.disabled = dispatchCart.length === 0;
  };

  // =========================================================================
  // BITÁCORA DE AUDITORÍA ANTI-FRAUDE + NOTIFICACIONES WHATSAPP / TURBOCHAT
  // =========================================================================
  function getAntifraudAuditLog() {
    try {
      return JSON.parse(localStorage.getItem("turboalmacen_audit_log") || "[]") || [];
    } catch (_) {
      return [];
    }
  }

  function logAntifraudAudit(action, detail, reason) {
    const list = getAntifraudAuditLog();
    list.unshift({
      id: `AUD-${Date.now().toString().slice(-6)}`,
      action,
      detail,
      reason: reason || "Operación registrada en POS",
      operator: almUser?.name || "Almacén",
      tenantId: activeTenantId,
      timestamp: new Date().toISOString(),
    });
    try {
      localStorage.setItem("turboalmacen_audit_log", JSON.stringify(list.slice(0, 150)));
    } catch (_) {}
  }

  function sendTechDispatchNotification(techName, opCode, items, notes) {
    const summaryText = `📦 *${opCode}* • Entregado a *${techName}*: ${items.map((i) => `${i.name} (${i.qty})`).join(", ")}. ${notes || ""}`;
    fetch("/api/apartados/material-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        techName,
        itemName: `Vale ${opCode} (${items.length} ítems)`,
        quantity: items.length,
        unit: "lote",
        type: "notificacion_despacho",
        status: "aprobado",
        reason: summaryText,
      }),
    }).catch(() => {});
  }

  window.shareReceiptToWhatsApp = function (techName, title, code, itemsSummary) {
    const emp = almEmployees.find((e) => getEmployeeDisplayName(e).toLowerCase() === (techName || "").toLowerCase());
    const phone = String(emp?.phone || emp?.mobile || "").replace(/\D/g, "");
    const text = encodeURIComponent(`*TurboAlmacén POS*\n📄 *${title}* (${code})\n👷 Técnico: ${techName}\n📦 Detalle: ${itemsSummary}\n🕒 ${new Date().toLocaleString("es-PE")}`);
    const url = phone ? `https://wa.me/${phone.startsWith("51") ? phone : "51" + phone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, "_blank", "noopener");
  };

  // =========================================================================
  // HERRAMIENTAS AVANZADAS DE BOBINA (MARCAS, BALANZA, SUB-BOBINA, MERMA)
  // =========================================================================
  window.openSpoolToolsModal = function (productId) {
    const prod = almProducts.find((p) => String(p.id) === String(productId));
    if (!prod) return;
    const pid = String(prod.id);
    const unit = prod.unitOfMeasure || "m";
    const reservations = getSpoolReservationsMap();
    const currentRes = reservations[pid] || { meters: 0, project: "" };

    document.getElementById("spool-modal-title").textContent = `⚙️ Herramientas de Bobina • ${prod.name}`;
    document.getElementById("spool-modal-sub").textContent = `SKU: ${prod.sku} • Stock actual: ${prod.stock} ${unit} • Ubicación: ${prod.location || "Zona Bobinas"}`;

    const cutsHistory = almMovements
      .filter((m) => String(m.productId) === pid && m.type === "out")
      .slice(0, 8);

    document.getElementById("spool-modal-body").innerHTML = `
      <!-- 1. Calculadora por Marcas de Chaqueta -->
      <div class="alm-surface-inset rounded-xl p-3.5 space-y-2">
        <div class="text-xs font-bold text-slate-900 dark:text-white">1. 📏 Calculadora de Metraje por Marcas de Chaqueta</div>
        <div class="grid grid-cols-3 gap-2 items-end">
          <div>
            <label class="block text-[10px] text-slate-400 mb-0.5">Marca Inicial (m)</label>
            <input id="spool-mark-a" type="number" min="0" placeholder="1420" oninput="calcSpoolJacketMarks()" class="alm-input w-full px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold" />
          </div>
          <div>
            <label class="block text-[10px] text-slate-400 mb-0.5">Marca Final (m)</label>
            <input id="spool-mark-b" type="number" min="0" placeholder="1650" oninput="calcSpoolJacketMarks()" class="alm-input w-full px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold" />
          </div>
          <button type="button" onclick="applyJacketMarksToCart('${esc(pid)}')" class="alm-btn-primary pos-press py-1.5 px-2.5 rounded-lg text-xs font-bold">
            + <span id="spool-mark-diff">0</span> ${esc(unit)} a Canasta
          </button>
        </div>
      </div>

      <!-- 2. Calculadora de Metraje por Peso en Balanza -->
      <div class="alm-surface-inset rounded-xl p-3.5 space-y-2">
        <div class="text-xs font-bold text-slate-900 dark:text-white">2. ⚖️ Estimador de Metros por Peso en Balanza</div>
        <div class="grid grid-cols-3 gap-2">
          <div>
            <label class="block text-[10px] text-slate-400 mb-0.5">Peso Actual (g)</label>
            <input id="spool-weight-total" type="number" min="0" placeholder="18500" oninput="calcSpoolWeightMeters()" class="alm-input w-full px-2.5 py-1.5 rounded-lg text-xs font-mono" />
          </div>
          <div>
            <label class="block text-[10px] text-slate-400 mb-0.5">Carrete Vacío (g)</label>
            <input id="spool-weight-tare" type="number" min="0" value="1500" oninput="calcSpoolWeightMeters()" class="alm-input w-full px-2.5 py-1.5 rounded-lg text-xs font-mono" />
          </div>
          <div>
            <label class="block text-[10px] text-slate-400 mb-0.5">Gramos / metro</label>
            <input id="spool-weight-gpm" type="number" min="0.1" step="0.1" value="20" oninput="calcSpoolWeightMeters()" class="alm-input w-full px-2.5 py-1.5 rounded-lg text-xs font-mono" />
          </div>
        </div>
        <div class="flex items-center justify-between text-xs pt-1">
          <span class="text-slate-400">Metraje estimado en carrete: <b id="spool-weight-result" class="font-mono text-emerald-500">0</b> ${esc(unit)}</span>
          <button type="button" onclick="printSpoolRemainingLabel('${esc(pid)}')" class="alm-btn-soft pos-press px-2.5 py-1 rounded-lg text-[11px] font-bold">🏷️ Etiqueta Saldo Bobina</button>
        </div>
      </div>

      <!-- 3. Corte y División de Bobina Madre a Sub-Bobina con QR propio -->
      <div class="alm-surface-inset rounded-xl p-3.5 space-y-2">
        <div class="text-xs font-bold text-slate-900 dark:text-white">3. ✂️ Dividir Bobina Madre → Crear Sub-Bobina con QR Propio</div>
        <div class="grid grid-cols-3 gap-2 items-end">
          <div>
            <label class="block text-[10px] text-slate-400 mb-0.5">Metros a cortar</label>
            <input id="spool-split-meters" type="number" min="1" max="${prod.stock - 1}" placeholder="500" class="alm-input w-full px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold" />
          </div>
          <div>
            <label class="block text-[10px] text-slate-400 mb-0.5">Destino / Cuadrilla</label>
            <input id="spool-split-loc" type="text" placeholder="Móvil Norte / Carrete #2" class="alm-input w-full px-2.5 py-1.5 rounded-lg text-xs" />
          </div>
          <button type="button" onclick="executeSplitChildSpool('${esc(pid)}')" class="pos-press py-1.5 px-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold">
            Crear Sub-Bobina
          </button>
        </div>
      </div>

      <!-- 4. Reserva para Proyecto de Planta Externa & Registro de Merma -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div class="alm-surface-inset rounded-xl p-3 space-y-2">
          <div class="text-xs font-bold">4. 🔒 Reserva Planta Externa</div>
          <input id="spool-res-meters" type="number" min="0" max="${prod.stock}" value="${currentRes.meters || 0}" placeholder="Metros reservados" class="alm-input w-full px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold" />
          <input id="spool-res-project" type="text" value="${esc(currentRes.project || "")}" placeholder="Proyecto (ej: Troncal Sur)" class="alm-input w-full px-2.5 py-1.5 rounded-lg text-xs" />
          <button type="button" onclick="saveSpoolReservation('${esc(pid)}')" class="alm-btn-soft pos-press w-full py-1.5 rounded-lg text-xs font-bold">Guardar Reserva</button>
        </div>
        <div class="alm-surface-inset rounded-xl p-3 space-y-2">
          <div class="text-xs font-bold text-rose-500">5. ⚠️ Registrar Merma / Punta Dañada</div>
          <input id="spool-scrap-meters" type="number" min="1" max="${prod.stock}" placeholder="Metros dañados (ej: 15)" class="alm-input w-full px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold" />
          <input id="spool-scrap-reason" type="text" placeholder="Motivo (ej: Punta aplastada)" class="alm-input w-full px-2.5 py-1.5 rounded-lg text-xs" />
          <button type="button" onclick="registerSpoolScrapMerma('${esc(pid)}')" class="pos-press w-full py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500 text-rose-500 hover:text-white text-xs font-bold">Descontar Merma</button>
        </div>
      </div>

      <!-- 6. Historial de Cortes de esta Bobina -->
      <div class="alm-surface-inset rounded-xl p-3 space-y-1.5">
        <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Historial de Cortes de esta Bobina (${cutsHistory.length})</div>
        ${
          cutsHistory.length === 0
            ? `<div class="text-xs text-slate-400 py-2">Sin cortes registrados aún.</div>`
            : cutsHistory
                .map(
                  (m) => `<div class="flex items-center justify-between text-xs py-1 alm-divider-b">
                    <span class="truncate pr-2">${esc(m.reason)}</span>
                    <span class="font-mono font-bold text-amber-500 flex-shrink-0">-${m.quantity}${esc(unit)} • ${new Date(m.timestamp).toLocaleDateString("es-PE")}</span>
                  </div>`
                )
                .join("")
        }
      </div>
    `;

    document.getElementById("spool-tools-modal")?.classList.remove("hidden");
  };

  window.closeSpoolToolsModal = function () {
    document.getElementById("spool-tools-modal")?.classList.add("hidden");
  };

  window.calcSpoolJacketMarks = function () {
    const a = Number(document.getElementById("spool-mark-a")?.value || 0);
    const b = Number(document.getElementById("spool-mark-b")?.value || 0);
    const diff = Math.abs(b - a);
    const el = document.getElementById("spool-mark-diff");
    if (el) el.textContent = String(diff);
    return diff;
  };

  window.applyJacketMarksToCart = function (productId) {
    const diff = window.calcSpoolJacketMarks();
    if (diff <= 0) {
      showToast("Ingresa Marca Inicial y Marca Final distintas para calcular los metros", "warn");
      return;
    }
    window.addToDispatchCart(productId, diff, null);
    window.closeSpoolToolsModal();
    showToast(`📏 ${diff}m calculados por marcas de chaqueta agregados a la canasta`, "success");
  };

  window.calcSpoolWeightMeters = function () {
    const tot = Number(document.getElementById("spool-weight-total")?.value || 0);
    const tare = Number(document.getElementById("spool-weight-tare")?.value || 0);
    const gpm = Math.max(0.1, Number(document.getElementById("spool-weight-gpm")?.value || 20));
    const meters = Math.max(0, Math.round((tot - tare) / gpm));
    const el = document.getElementById("spool-weight-result");
    if (el) el.textContent = String(meters);
    return meters;
  };

  window.printSpoolRemainingLabel = function (productId) {
    const prod = almProducts.find((p) => String(p.id) === String(productId));
    if (!prod) return;
    const unit = prod.unitOfMeasure || "m";
    openThermalTicket({
      title: "ETIQUETA DE SALDO DE BOBINA",
      code: prod.sku,
      targetLabel: "SALDO RESTANTE EN CARRETE",
      targetName: `${prod.stock} ${unit}`,
      notes: `Ubicación: ${prod.location || "Zona Bobinas"}`,
      items: [{ name: prod.name, code: prod.sku, qty: `${prod.stock} ${unit}` }],
    });
  };

  window.executeSplitChildSpool = async function (productId) {
    const cutMeters = Number(document.getElementById("spool-split-meters")?.value || 0);
    const location = document.getElementById("spool-split-loc")?.value?.trim() || "Sub-Bobina Cuadrilla";
    if (cutMeters <= 0) {
      showToast("Ingresa los metros a cortar para la sub-bobina", "warn");
      return;
    }
    try {
      const res = await fetch(`/api/inventory/products/${encodeURIComponent(productId)}/split-spool`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cutMeters,
          location,
          operatorName: almUser?.name || "Almacén POS",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Error dividiendo bobina");

      const child = data.data?.childProduct;
      logAntifraudAudit("CORTE_SUB_BOBINA", `Sub-bobina ${child?.sku} (${cutMeters}m)`, location);
      playBeep("ok");
      showToast(`✂️ Sub-bobina ${child?.sku} creada con éxito`, "success");
      window.closeSpoolToolsModal();
      await refreshAllWarehouseData(false);

      if (child) {
        openThermalTicket({
          title: "ETIQUETA QR DE SUB-BOBINA",
          code: child.sku,
          targetLabel: "METRAJE INICIAL",
          targetName: `${child.stock} ${child.unitOfMeasure || "m"}`,
          notes: `Derivada a: ${location}`,
          items: [{ name: child.name, code: child.sku, qty: `${child.stock} m` }],
        });
      }
    } catch (err) {
      playBeep("error");
      showToast(err.message || "Error al crear sub-bobina", "error");
    }
  };

  window.saveSpoolReservation = function (productId) {
    const meters = Math.max(0, Number(document.getElementById("spool-res-meters")?.value || 0));
    const project = document.getElementById("spool-res-project")?.value?.trim() || "Proyecto Planta Externa";
    const map = getSpoolReservationsMap();
    if (meters === 0) delete map[String(productId)];
    else map[String(productId)] = { meters, project, updatedAt: new Date().toISOString() };
    localStorage.setItem("turboalmacen_spool_reservations", JSON.stringify(map));
    logAntifraudAudit("RESERVA_BOBINA", `Bobina #${productId}: ${meters}m reservados`, project);
    showToast(meters > 0 ? `🔒 ${meters}m reservados para ${project}` : "Reserva liberada", "success");
    window.closeSpoolToolsModal();
    renderDispatchCatalog();
  };

  window.registerSpoolScrapMerma = async function (productId) {
    const meters = Number(document.getElementById("spool-scrap-meters")?.value || 0);
    const reason = document.getElementById("spool-scrap-reason")?.value?.trim() || "Merma / punta de bobina dañada";
    if (meters <= 0) {
      showToast("Ingresa los metros de merma a descontar", "warn");
      return;
    }
    try {
      const res = await fetch(`/api/inventory/products/${encodeURIComponent(productId)}/adjust-stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "out",
          quantity: meters,
          reason: `Merma de bobina: ${reason}`,
          operatorName: almUser?.name || "Almacén POS",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Error registrando merma");
      logAntifraudAudit("MERMA_BOBINA", `-${meters}m en producto #${productId}`, reason);
      playBeep("ok");
      showToast(`⚠️ Merma de ${meters}m descontada del Kardex`, "info");
      window.closeSpoolToolsModal();
      await refreshAllWarehouseData(false);
    } catch (err) {
      showToast(err.message || "Error registrando merma", "error");
    }
  };

  // =========================================================================
  // MODO RÁFAGA DE SERIES / MACS + DETECTOR CARTON BOX + ANTI-DUPLICADO
  // =========================================================================
  function isMacAddressFormat(code) {
    const s = String(code || "").trim();
    return /^([0-9A-Fa-f]{2}[:\-]){5}([0-9A-Fa-f]{2})$/.test(s) || (/^[0-9A-Fa-f]{12}$/.test(s) && !/^(ZTEG|HWTC|FHTT|ALCL)/i.test(s));
  }

  function isDuplicateSerialInInventory(snOrMac) {
    const needle = String(snOrMac || "").trim().toLowerCase();
    if (!needle) return false;
    for (const p of almProducts) {
      for (const u of p.itemUnits || []) {
        if (u.status === "baja") continue;
        if ((u.serialNumber && u.serialNumber.toLowerCase().includes(needle)) || (u.sku && u.sku.toLowerCase() === needle)) {
          return `${p.name} (${u.sku})`;
        }
      }
    }
    return false;
  }

  window.openBurstSerialModal = function (preselectedProdId) {
    const sel = document.getElementById("burst-product-select");
    if (sel && preselectedProdId) sel.value = String(preselectedProdId);
    burstCapturedItems = [];
    pendingBurstSn = "";
    renderBurstCapturedList();
    document.getElementById("burst-serial-modal")?.classList.remove("hidden");
    setTimeout(() => document.getElementById("burst-scan-input")?.focus(), 80);
  };

  window.closeBurstSerialModal = function () {
    document.getElementById("burst-serial-modal")?.classList.add("hidden");
  };

  function handleCartonBoxMasterQr(rawQr) {
    const clean = rawQr.replace(/^BOX:/i, "").trim();
    const parts = clean.split(/[;|,\r\n]+/).map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) return;
    window.openBurstSerialModal();
    parts.forEach((code) => processBurstSingleToken(code));
    showToast(`📦 Caja Master detectada: ${burstCapturedItems.length} series cargadas`, "success");
  }

  function processBurstSingleToken(token) {
    const t = String(token || "").trim();
    if (!t) return;
    if (t.includes(",")) {
      const [sn, mac] = t.split(",").map((x) => x.trim());
      if (sn) {
        burstCapturedItems.push({ sn, mac: mac || "", dup: isDuplicateSerialInInventory(sn) });
      }
      return;
    }
    if (isMacAddressFormat(t)) {
      if (pendingBurstSn) {
        burstCapturedItems.push({ sn: pendingBurstSn, mac: t, dup: isDuplicateSerialInInventory(pendingBurstSn) });
        pendingBurstSn = "";
      } else if (burstCapturedItems.length > 0 && !burstCapturedItems[burstCapturedItems.length - 1].mac) {
        burstCapturedItems[burstCapturedItems.length - 1].mac = t;
      } else {
        burstCapturedItems.push({ sn: t, mac: t, dup: isDuplicateSerialInInventory(t) });
      }
    } else {
      if (pendingBurstSn) {
        burstCapturedItems.push({ sn: pendingBurstSn, mac: "", dup: isDuplicateSerialInInventory(pendingBurstSn) });
      }
      pendingBurstSn = t;
    }
  }

  window.handleBurstScanSubmit = function (e) {
    if (e) e.preventDefault();
    const inp = document.getElementById("burst-scan-input");
    const val = (inp?.value || "").trim();
    if (!val) return;
    processBurstSingleToken(val);
    inp.value = "";
    playBeep("ok");
    renderBurstCapturedList();
  };

  window.parseBurstTextarea = function () {
    const area = document.getElementById("burst-bulk-textarea");
    const lines = (area?.value || "").split(/[\r\n;]+/).map((l) => l.trim()).filter(Boolean);
    lines.forEach((line) => processBurstSingleToken(line));
    if (pendingBurstSn) {
      burstCapturedItems.push({ sn: pendingBurstSn, mac: "", dup: isDuplicateSerialInInventory(pendingBurstSn) });
      pendingBurstSn = "";
    }
    if (area) area.value = "";
    playBeep("ok");
    renderBurstCapturedList();
  };

  window.handleBurstCsvUpload = function (input) {
    const file = input?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (ev) {
      const area = document.getElementById("burst-bulk-textarea");
      if (area) {
        area.value = String(ev.target?.result || "");
        window.parseBurstTextarea();
      }
    };
    reader.readAsText(file);
  };

  window.removeBurstCapturedItem = function (idx) {
    burstCapturedItems.splice(idx, 1);
    renderBurstCapturedList();
  };

  function renderBurstCapturedList() {
    const box = document.getElementById("burst-captured-list");
    if (!box) return;
    const all = [...burstCapturedItems];
    if (pendingBurstSn) {
      all.push({ sn: pendingBurstSn, mac: "Esperando escaneo MAC...", pending: true, dup: isDuplicateSerialInInventory(pendingBurstSn) });
    }
    if (all.length === 0) {
      box.innerHTML = `<div class="text-xs text-slate-400 text-center py-4">Ninguna serie capturada aún. Escanea S/N y luego MAC.</div>`;
      return;
    }
    box.innerHTML = all
      .map(
        (it, i) => `
      <div class="alm-surface-inset rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2 text-xs font-mono">
        <div class="truncate">
          <span class="font-bold text-slate-900 dark:text-white">#${i + 1} SN: ${esc(it.sn)}</span>
          ${it.mac ? `<span class="text-sky-500 ml-2">MAC: ${esc(it.mac)}</span>` : ""}
          ${it.dup ? `<span class="text-rose-500 font-bold ml-1.5">⚠️ Duplicado (${esc(it.dup)})</span>` : ""}
        </div>
        ${!it.pending ? `<button type="button" onclick="removeBurstCapturedItem(${i})" class="text-rose-500 font-bold">✕</button>` : ""}
      </div>`
      )
      .join("");
  }

  window.applyBurstToDispatchCart = function () {
    if (pendingBurstSn) {
      burstCapturedItems.push({ sn: pendingBurstSn, mac: "", dup: isDuplicateSerialInInventory(pendingBurstSn) });
      pendingBurstSn = "";
    }
    const prodId = document.getElementById("burst-product-select")?.value;
    const prod = almProducts.find((p) => String(p.id) === String(prodId));
    if (!prod || burstCapturedItems.length === 0) {
      showToast("Selecciona un producto y captura al menos una serie", "warn");
      return;
    }
    burstCapturedItems.forEach((item) => {
      const unitObj = {
        id: `sn-${item.sn}`,
        sku: item.mac ? `${item.sn} / ${item.mac}` : item.sn,
        serialNumber: item.sn,
        status: "disponible",
      };
      window.addToDispatchCart(prod.id, 1, unitObj);
    });
    window.closeBurstSerialModal();
    showToast(`⚡ ${burstCapturedItems.length} equipos seriados cargados a la canasta`, "success");
  };

  window.applyBurstToInventoryStock = async function () {
    if (pendingBurstSn) {
      burstCapturedItems.push({ sn: pendingBurstSn, mac: "", dup: isDuplicateSerialInInventory(pendingBurstSn) });
      pendingBurstSn = "";
    }
    const prodId = document.getElementById("burst-product-select")?.value;
    const prod = almProducts.find((p) => String(p.id) === String(prodId));
    if (!prod || burstCapturedItems.length === 0) return;

    const nonDups = burstCapturedItems.filter((i) => !i.dup);
    if (nonDups.length === 0) {
      playBeep("error");
      showToast("Todas las series capturadas ya existen como duplicadas en el inventario", "error");
      return;
    }

    const existingUnits = Array.isArray(prod.itemUnits) ? [...prod.itemUnits] : [];
    const now = new Date().toISOString();
    nonDups.forEach((item, idx) => {
      const num = existingUnits.length + idx + 1;
      existingUnits.push({
        id: `unit_${prod.id}_${Date.now()}_${idx}`,
        itemNumber: num,
        sku: item.sn,
        barcode: item.sn,
        serialNumber: item.mac ? `${item.sn} | MAC:${item.mac}` : item.sn,
        status: "disponible",
        conditionStatus: "optimo",
        notes: "Ingresado por Modo Ráfaga / CSV",
        createdAt: now,
      });
    });

    try {
      const res = await fetch(`/api/inventory/products/${encodeURIComponent(prod.id)}/units`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ units: existingUnits }),
      });
      if (!res.ok) throw new Error("Error guardando series");
      playBeep("ok");
      showToast(`✅ ${nonDups.length} series registradas en ${prod.name}`, "success");
      window.closeBurstSerialModal();
      await refreshAllWarehouseData(false);
    } catch (err) {
      showToast(err.message || "Error registrando series", "error");
    }
  };

  // =========================================================================
  // MÓDULO 2: DEVOLUCIONES, ARQUEO DE MOCHILA, SWAP 1-A-1, RECUPERADOS
  // =========================================================================
  window.switchReturnsSubMode = function (mode) {
    returnsSubMode = mode;
    ["active", "arqueo", "recovered", "history"].forEach((m) => {
      document.getElementById(`returns-sub-${m}`)?.classList.toggle("hidden", m !== mode);
      const btn = document.getElementById(`btn-ret-sub-${m}`);
      if (btn) {
        btn.className =
          m === mode
            ? "alm-btn-primary pos-press px-3 py-1.5 rounded-lg text-xs font-semibold"
            : "pos-press px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 dark:text-slate-300";
      }
    });
    if (mode === "active") renderReturnsList();
    else if (mode === "arqueo") renderReturnsArqueo();
    else if (mode === "recovered") renderRecoveredUnitsList();
    else if (mode === "history") renderReturnsHistory();
  };

  window.toggleSelectReturnItem = function (asgId, checked) {
    if (checked) selectedReturnIds.add(String(asgId));
    else selectedReturnIds.delete(String(asgId));
    const btn = document.getElementById("btn-bulk-returns");
    const cnt = document.getElementById("bulk-returns-count");
    if (cnt) cnt.textContent = String(selectedReturnIds.size);
    if (btn) btn.classList.toggle("hidden", selectedReturnIds.size === 0);
  };

  window.renderReturnsList = function () {
    const container = document.getElementById("returns-list-container");
    if (!container) return;

    const empId = document.getElementById("returns-employee-filter")?.value || "";
    const q = (document.getElementById("returns-search-input")?.value || "").trim().toLowerCase();

    const active = almAssignments.filter((a) => {
      if (a.status !== "en_uso" && a.status !== "entregado") return false;
      if (empId && String(a.employeeId) !== String(empId)) return false;
      if (q) {
        const hay = `${a.productName || ""} ${a.productSku || ""} ${a.unitSku || ""} ${a.employeeName || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (active.length === 0) {
      container.innerHTML = `<div class="col-span-full alm-surface rounded-2xl border-dashed p-10 text-center text-xs text-slate-400">No hay asignaciones activas pendientes de devolución con este filtro.</div>`;
      return;
    }

    const nowMs = Date.now();
    container.innerHTML = active
      .map((a) => {
        const daysHeld = a.assignedAt ? Math.max(0, Math.floor((nowMs - new Date(a.assignedAt).getTime()) / 86400000)) : 0;
        const isOld = daysHeld >= 7;
        const ageBadge = isOld
          ? `<span class="alm-badge-crit px-2 py-0.5 rounded-md text-[10px] font-mono font-bold">⏰ ${daysHeld}d en mochila</span>`
          : `<span class="alm-badge-sky px-2 py-0.5 rounded-md text-[10px] font-mono font-bold">${daysHeld}d • ${esc(a.status)}</span>`;
        const isChecked = selectedReturnIds.has(String(a.id));

        return `
      <div class="alm-surface rounded-2xl p-4 space-y-2.5 ${isOld ? "border-rose-500/40" : ""}">
        <div class="flex items-start justify-between gap-2">
          <label class="flex items-start gap-2 min-w-0 cursor-pointer">
            <input type="checkbox" ${isChecked ? "checked" : ""} onchange="toggleSelectReturnItem('${esc(a.id)}', this.checked)" class="mt-0.5 w-4 h-4 rounded" />
            <div class="min-w-0">
              <div class="text-xs font-bold text-slate-900 dark:text-white leading-snug">${esc(a.productName || "Material")}</div>
              <div class="text-[11px] font-mono alm-brand-text mt-0.5">${esc(a.unitSku || a.productSku || "")} • Entregado: ${a.quantity}</div>
              <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">👷 ${esc(a.employeeName || a.personnelName || "Técnico")}</div>
            </div>
          </label>
          ${ageBadge}
        </div>

        <div class="grid grid-cols-12 gap-1.5 items-center">
          <div class="col-span-3">
            <label class="block text-[9px] text-slate-400">Cant. Devolver</label>
            <input id="ret-qty-${esc(a.id)}" type="number" min="1" max="${a.quantity}" value="${a.quantity}" class="alm-input w-full px-2 py-1 rounded-lg text-xs font-mono font-bold" />
          </div>
          <div class="col-span-5">
            <label class="block text-[9px] text-slate-400">Estado</label>
            <select id="ret-cond-${esc(a.id)}" class="alm-input w-full px-2 py-1 rounded-lg text-[11px] font-semibold">
              <option value="buen_estado">🟢 Buen estado (Stock)</option>
              <option value="observacion">🟡 Observación / Test</option>
              <option value="danado">🔴 Dañado / Baja</option>
              <option value="perdida_rrhh">💸 Pérdida (Cargo RRHH)</option>
            </select>
          </div>
          <div class="col-span-4">
            <label class="block text-[9px] text-slate-400">Motivo Baja/Falla</label>
            <select id="ret-reason-${esc(a.id)}" class="alm-input w-full px-2 py-1 rounded-lg text-[10px]">
              <option value="">Normal / Sobrante</option>
              <option value="Defecto de fábrica">Defecto fábrica</option>
              <option value="Daño en transporte">Daño transporte</option>
              <option value="Retiro cliente moroso">Retiro moroso</option>
              <option value="Corte vandálico">Corte vandálico</option>
              <option value="Extraviado en campo">Extraviado</option>
            </select>
          </div>
        </div>

        <div class="flex items-center justify-between gap-1.5 pt-1">
          <button type="button" onclick="processReturnAssignment('${esc(a.id)}')" class="pos-press flex-1 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs">
            ↩️ Devolver
          </button>
          <button type="button" onclick="executeHandToHandSwap('${esc(a.id)}')" title="Cambio Mano a Mano (Recibe defectuoso y entrega uno nuevo en 1 paso)" class="alm-btn-soft pos-press px-2.5 py-1.5 rounded-xl font-bold text-[11px]">
            🔄 Swap 1-a-1
          </button>
          <button type="button" onclick="shareReceiptToWhatsApp('${esc(a.employeeName)}', 'RECORDATORIO DEVOLUCIÓN', '${esc(a.id)}', '${esc(a.productName)} x${a.quantity}')" title="Enviar por WhatsApp al técnico" class="pos-icon-btn w-8 h-8">
            💬
          </button>
        </div>
      </div>`;
      })
      .join("");
  };

  window.processReturnAssignment = async function (assignmentId, silentBatch) {
    const asg = almAssignments.find((a) => String(a.id) === String(assignmentId));
    if (!asg) return null;
    const rawCond = document.getElementById(`ret-cond-${assignmentId}`)?.value || "buen_estado";
    const qty = Math.min(asg.quantity, Math.max(1, Number(document.getElementById(`ret-qty-${assignmentId}`)?.value || asg.quantity)));
    const failureReason = document.getElementById(`ret-reason-${assignmentId}`)?.value || "";
    const isRrhhLoss = rawCond === "perdida_rrhh";
    const apiCondition = isRrhhLoss ? "danado" : rawCond;

    try {
      const res = await fetch(`/api/inventory/personnel-assignments/${encodeURIComponent(assignmentId)}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          condition: apiCondition,
          quantity: qty,
          failureReason: isRrhhLoss ? `PÉRDIDA CON DESCUENTO RRHH ${failureReason}` : failureReason,
          notes: `Devolución POS (${rawCond}) recibida por ${almUser?.name || "Almacén"}`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Error al devolver");

      if (isRrhhLoss) {
        logAntifraudAudit("CARGO_PERDIDA_RRHH", `${asg.employeeName}: ${asg.productName} (x${qty})`, failureReason || "Extravío");
      }

      if (!silentBatch) {
        playBeep("ok");
        showToast(isRrhhLoss ? `💸 Acta de descuento RRHH generada para ${asg.employeeName}` : `↩️ Devuelto: ${asg.productName} (${qty})`, "success");
        await refreshAllWarehouseData(false);

        openThermalTicket({
          title: isRrhhLoss ? "ACTA DE DESCUENTO RRHH POR PÉRDIDA" : "CONSTANCIA DE DEVOLUCIÓN",
          code: `${isRrhhLoss ? "RRHH" : "DEV"}-${Date.now().toString().slice(-6)}`,
          targetLabel: isRrhhLoss ? "COLABORADOR RESPONSABLE" : "DEVUELTO POR",
          targetName: asg.employeeName || asg.personnelName || "Técnico",
          notes: `Condición: ${rawCond.toUpperCase()}${failureReason ? " • Motivo: " + failureReason : ""}`,
          items: [{ name: asg.productName, code: asg.unitSku || asg.productSku || "", qty: `${qty} und` }],
        });
      }
      return { asg, qty, rawCond, failureReason };
    } catch (err) {
      if (!silentBatch) {
        playBeep("error");
        showToast(err.message || "Error registrando devolución", "error");
      }
      return null;
    }
  };

  window.processBulkSelectedReturns = async function () {
    if (selectedReturnIds.size === 0) return;
    const ids = Array.from(selectedReturnIds);
    const processed = [];
    for (const id of ids) {
      const r = await window.processReturnAssignment(id, true);
      if (r) processed.push(r);
    }
    selectedReturnIds.clear();
    document.getElementById("btn-bulk-returns")?.classList.add("hidden");
    await refreshAllWarehouseData(false);

    if (processed.length > 0) {
      playBeep("ok");
      const techName = processed[0].asg.employeeName || "Varios Técnicos";
      showToast(`✅ ${processed.length} devoluciones procesadas en lote`, "success");
      openThermalTicket({
        title: "CONSTANCIA DE DEVOLUCIÓN MASIVA",
        code: `DEVM-${Date.now().toString().slice(-6)}`,
        targetLabel: "DEVUELTO POR",
        targetName: techName,
        notes: `${processed.length} líneas liquidadas`,
        items: processed.map((p) => ({
          name: p.asg.productName,
          code: p.asg.unitSku || p.asg.productSku || "",
          qty: `${p.qty} und`,
        })),
      });
    }
  };

  // Modo "Cambio Mano a Mano" (Swap 1-a-1)
  window.executeHandToHandSwap = async function (assignmentId) {
    const asg = almAssignments.find((a) => String(a.id) === String(assignmentId));
    if (!asg) return;
    const prod = almProducts.find((p) => String(p.id) === String(asg.productId));
    if (!prod || prod.stock <= 0) {
      playBeep("error");
      showToast(`No hay stock disponible de ${asg.productName} para realizar el Swap 1-a-1`, "error");
      return;
    }

    try {
      // 1. Recibir el defectuoso como dañado / garantía
      await fetch(`/api/inventory/personnel-assignments/${encodeURIComponent(assignmentId)}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          condition: "danado",
          quantity: 1,
          failureReason: "Swap 1-a-1 Mano a Mano por falla en campo",
          notes: `Recibido en Swap 1-a-1 por ${almUser?.name || "Almacén"}`,
        }),
      });

      // 2. Despachar reemplazo operativo al mismo técnico
      const availUnit = (prod.itemUnits || []).find((u) => u.status === "disponible");
      await fetch("/api/inventory/personnel-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: prod.id,
          productName: prod.name,
          productSku: prod.sku,
          employeeId: asg.employeeId,
          employeeName: asg.employeeName,
          quantity: 1,
          status: "en_uso",
          itemUnitId: availUnit?.id,
          unitSku: availUnit?.sku,
          notes: `Entregado en Swap 1-a-1 (Reemplaza a ${asg.unitSku || asg.productSku})`,
        }),
      });

      playBeep("ok");
      showToast(`🔄 Swap 1-a-1 completado para ${asg.employeeName}`, "success");
      await refreshAllWarehouseData(false);

      openThermalTicket({
        title: "CONSTANCIA DE CAMBIO MANO A MANO (SWAP)",
        code: `SWAP-${Date.now().toString().slice(-6)}`,
        targetLabel: "TÉCNICO",
        targetName: asg.employeeName,
        notes: "Cambio directo 1-a-1 por equipo defectuoso",
        items: [
          { name: `ENTRA (DAÑADO): ${asg.productName}`, code: asg.unitSku || asg.productSku, qty: "-1 und" },
          { name: `SALE (NUEVO): ${prod.name}`, code: availUnit?.sku || prod.sku, qty: "+1 und" },
        ],
      });
    } catch (err) {
      showToast(err.message || "Error en Swap 1-a-1", "error");
    }
  };

  // Arqueo de Mochila (Cierre de Jornada)
  function renderReturnsArqueo() {
    const box = document.getElementById("returns-arqueo-container");
    if (!box) return;

    const byTech = new Map();
    almAssignments
      .filter((a) => a.status === "en_uso" || a.status === "entregado")
      .forEach((a) => {
        const key = String(a.employeeName || "Técnico");
        if (!byTech.has(key)) byTech.set(key, { techName: key, assigned: [], installedCount: 0 });
        byTech.get(key).assigned.push(a);
      });

    almInstallations.forEach((inst) => {
      const tName = String(inst.technicianName || inst.technician || "");
      for (const [k, v] of byTech.entries()) {
        if (k.toLowerCase().includes(tName.toLowerCase()) && tName) {
          v.installedCount += Number(inst.quantity || 1);
        }
      }
    });

    const rows = Array.from(byTech.values());
    if (rows.length === 0) {
      box.innerHTML = `<div class="col-span-full alm-surface rounded-2xl p-8 text-center text-xs text-slate-400">Todas las mochilas de técnicos están en cero (liquidadas).</div>`;
      return;
    }

    box.innerHTML = rows
      .map((r) => {
        const totalAssigned = r.assigned.reduce((acc, a) => acc + Number(a.quantity || 0), 0);
        const balance = Math.max(0, totalAssigned - r.installedCount);
        return `
        <div class="alm-surface rounded-2xl p-4 space-y-2.5">
          <div class="flex items-center justify-between">
            <div class="text-sm font-extrabold text-slate-900 dark:text-white">👷 ${esc(r.techName)}</div>
            <span class="alm-brand-badge px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold">Saldo Mochila: ${balance} uds</span>
          </div>
          <div class="grid grid-cols-3 gap-2 text-center">
            <div class="alm-surface-inset rounded-xl p-2">
              <div class="text-[10px] text-slate-400">Entregado</div>
              <div class="text-sm font-mono font-extrabold text-sky-500">${totalAssigned}</div>
            </div>
            <div class="alm-surface-inset rounded-xl p-2">
              <div class="text-[10px] text-slate-400">Instalado Clientes</div>
              <div class="text-sm font-mono font-extrabold text-emerald-500">${r.installedCount}</div>
            </div>
            <div class="alm-surface-inset rounded-xl p-2">
              <div class="text-[10px] text-slate-400">Por Devolver</div>
              <div class="text-sm font-mono font-extrabold text-amber-500">${balance}</div>
            </div>
          </div>
          <div class="space-y-1 max-h-28 overflow-y-auto alm-scroll text-xs">
            ${r.assigned.map((a) => `<div class="flex justify-between"><span>${esc(a.productName)}</span><span class="font-mono text-slate-400">${esc(a.unitSku || "x" + a.quantity)}</span></div>`).join("")}
          </div>
        </div>`;
      })
      .join("");
  }

  window.printArqueoMochilaTicket = function () {
    const active = almAssignments.filter((a) => a.status === "en_uso" || a.status === "entregado");
    openThermalTicket({
      title: "ARQUEO DE MOCHILAS • CIERRE JORNADA",
      code: `ARQ-${Date.now().toString().slice(-6)}`,
      targetLabel: "TOTAL EN CAMPO",
      targetName: `${active.length} asignaciones activas`,
      notes: "Material pendiente en mochila de técnicos",
      items: active.slice(0, 25).map((a) => ({
        name: `${a.employeeName}: ${a.productName}`,
        code: a.unitSku || a.productSku,
        qty: `x${a.quantity}`,
      })),
    });
  };

  // Reingreso de ONUs Recuperadas de Ex-Clientes
  window.registerRecoveredClientEquipment = async function () {
    const prodId = document.getElementById("rec-product-select")?.value;
    const sn = document.getElementById("rec-serial-input")?.value?.trim();
    const mac = document.getElementById("rec-mac-input")?.value?.trim();
    const client = document.getElementById("rec-client-input")?.value?.trim() || "Ex-Cliente";
    const lifecycle = document.getElementById("rec-lifecycle-select")?.value || "laboratorio";
    const prod = almProducts.find((p) => String(p.id) === String(prodId));

    if (!prod || !sn) {
      playBeep("error");
      showToast("Selecciona el modelo de equipo e ingresa su Serie (S/N)", "warn");
      return;
    }

    const units = Array.isArray(prod.itemUnits) ? [...prod.itemUnits] : [];
    const statusMap = {
      laboratorio: "disponible",
      reacondicionado_ok: "disponible",
      rma: "en_garantia",
      baja: "baja",
    };
    const tagMap = {
      laboratorio: "[LAB_PENDIENTE]",
      reacondicionado_ok: "[REACONDICIONADO_OK]",
      rma: "[RMA_GARANTIA]",
      baja: "[BAJA_CAMPO]",
    };

    units.unshift({
      id: `rec_${prod.id}_${Date.now()}`,
      itemNumber: units.length + 1,
      sku: sn,
      barcode: sn,
      serialNumber: mac ? `${sn} | MAC:${mac}` : sn,
      status: statusMap[lifecycle] || "disponible",
      conditionStatus: lifecycle === "reacondicionado_ok" ? "bueno" : lifecycle === "baja" ? "baja" : "regular",
      notes: `${tagMap[lifecycle]} Retirado de ${client}`,
      createdAt: new Date().toISOString(),
    });

    try {
      const res = await fetch(`/api/inventory/products/${encodeURIComponent(prod.id)}/units`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ units }),
      });
      if (!res.ok) throw new Error("No se pudo registrar equipo recuperado");
      playBeep("ok");
      showToast(`♻️ Equipo ${sn} registrado como ${tagMap[lifecycle]}`, "success");
      document.getElementById("rec-serial-input").value = "";
      document.getElementById("rec-mac-input").value = "";
      await refreshAllWarehouseData(false);
    } catch (err) {
      showToast(err.message || "Error", "error");
    }
  };

  function renderRecoveredUnitsList() {
    const box = document.getElementById("recovered-units-list");
    if (!box) return;
    const items = [];
    for (const p of almProducts) {
      for (const u of p.itemUnits || []) {
        const n = u.notes || "";
        if (n.includes("[LAB_PENDIENTE]") || n.includes("[REACONDICIONADO_OK]") || n.includes("[RMA_GARANTIA]") || u.status === "en_garantia") {
          items.push({ product: p, unit: u });
        }
      }
    }
    if (items.length === 0) {
      box.innerHTML = `<div class="py-8 text-center text-xs text-slate-400">No hay equipos recuperados o en laboratorio pendientes.</div>`;
      return;
    }
    box.innerHTML = items
      .map(({ product, unit }) => {
        const isPendingLab = (unit.notes || "").includes("[LAB_PENDIENTE]");
        return `
        <div class="alm-surface-inset rounded-xl p-3 flex items-center justify-between gap-2">
          <div class="min-w-0">
            <div class="text-xs font-bold truncate">${esc(product.name)} • <span class="font-mono alm-brand-text">${esc(unit.sku)}</span></div>
            <div class="text-[11px] text-slate-400 truncate">${esc(unit.notes || "")}</div>
          </div>
          ${
            isPendingLab
              ? `<button type="button" onclick="approveRecoveredUnitTest('${esc(product.id)}', '${esc(unit.id)}')" class="pos-press px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold flex-shrink-0">✅ Aprobar Test OK</button>`
              : `<span class="alm-badge-ok px-2 py-0.5 rounded-md text-[10px] font-mono font-bold flex-shrink-0">Test OK</span>`
          }
        </div>`;
      })
      .join("");
  }

  window.approveRecoveredUnitTest = async function (productId, unitId) {
    const prod = almProducts.find((p) => String(p.id) === String(productId));
    if (!prod || !Array.isArray(prod.itemUnits)) return;
    const updated = prod.itemUnits.map((u) =>
      u.id === unitId
        ? {
            ...u,
            conditionStatus: "bueno",
            status: "disponible",
            notes: (u.notes || "").replace("[LAB_PENDIENTE]", "[REACONDICIONADO_OK] Test & Reset Aprobado"),
          }
        : u
    );
    await fetch(`/api/inventory/products/${encodeURIComponent(prod.id)}/units`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ units: updated }),
    });
    playBeep("ok");
    showToast("✅ Equipo liberado de Laboratorio y listo para despachar", "success");
    await refreshAllWarehouseData(false);
  };

  function renderReturnsHistory() {
    const box = document.getElementById("returns-history-container");
    if (!box) return;
    const returned = almAssignments.filter((a) => a.status === "devuelto").slice(0, 30);
    if (returned.length === 0) {
      box.innerHTML = `<div class="col-span-full alm-surface rounded-2xl p-8 text-center text-xs text-slate-400">Aún no hay devoluciones registradas.</div>`;
      return;
    }
    box.innerHTML = returned
      .map(
        (a) => `
      <div class="alm-surface rounded-2xl p-3.5 flex items-center justify-between gap-2">
        <div class="min-w-0">
          <div class="text-xs font-bold truncate">${esc(a.productName)} <span class="font-mono">x${a.quantity}</span></div>
          <div class="text-[11px] text-slate-400 truncate">${esc(a.employeeName)} • ${esc(a.returnCondition || "buen_estado")}</div>
        </div>
        <button type="button" onclick="reprintReturnTicket('${esc(a.id)}')" class="alm-btn-soft pos-press px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex-shrink-0">🖨️ Reimprimir</button>
      </div>`
      )
      .join("");
  }

  window.reprintReturnTicket = function (asgId) {
    const a = almAssignments.find((x) => String(x.id) === String(asgId));
    if (!a) return;
    openThermalTicket({
      title: "DUPLICADO CONSTANCIA DE DEVOLUCIÓN",
      code: a.id.toUpperCase(),
      targetLabel: "DEVUELTO POR",
      targetName: a.employeeName,
      notes: a.notes || "",
      items: [{ name: a.productName, code: a.unitSku || a.productSku, qty: `${a.quantity} und` }],
    });
  };

  // =========================================================================
  // MÓDULO 3: COMPRAS MULTIMONEDA, KARDEX RÁPIDO, NUEVO PRODUCTO & RMA
  // =========================================================================
  window.switchPurchasesSubMode = function (mode) {
    purchasesSubMode = mode;
    ["entry", "kardex", "rma"].forEach((m) => {
      document.getElementById(`purchases-sub-${m}`)?.classList.toggle("hidden", m !== mode);
      const btn = document.getElementById(`btn-purch-sub-${m}`);
      if (btn) {
        btn.className =
          m === mode
            ? "alm-btn-primary pos-press px-3 py-1.5 rounded-lg text-xs font-semibold"
            : "pos-press px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 dark:text-slate-300";
      }
    });
    if (mode === "kardex") renderKardexQuickView();
    else if (mode === "rma") renderRmaModule();
  };

  window.handlePurchaseAttachment = function (input) {
    const f = input?.files?.[0];
    const b = document.getElementById("purch-attachment-badge");
    if (f && b) {
      purchaseAttachmentName = f.name;
      b.textContent = `📎 Adjunto: ${f.name}`;
      b.classList.remove("hidden");
    }
  };

  window.openQuickNewProductModal = function () {
    document.getElementById("quick-product-modal")?.classList.remove("hidden");
  };

  window.closeQuickNewProductModal = function () {
    document.getElementById("quick-product-modal")?.classList.add("hidden");
  };

  window.saveQuickNewProduct = async function () {
    const name = document.getElementById("qp-name")?.value?.trim();
    const sku = document.getElementById("qp-sku")?.value?.trim();
    const type = document.getElementById("qp-type")?.value || "simple";
    const baseCost = Number(document.getElementById("qp-cost")?.value || 0);
    const location = document.getElementById("qp-location")?.value?.trim() || "Almacén Central";
    if (!name || !sku) {
      showToast("Completa el nombre y el SKU del nuevo producto", "warn");
      return;
    }
    const categoryId = almCategories[0]?.id || "cat-general";
    try {
      const res = await fetch("/api/inventory/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          name,
          sku,
          barcode: sku,
          categoryId,
          baseCost,
          stock: 0,
          stockMin: 5,
          stockCritical: 2,
          location,
          unitOfMeasure: type === "bulk" ? "m" : "und",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Error creando producto");
      playBeep("ok");
      showToast(`✨ Producto ${name} creado y agregado a la factura`, "success");
      window.closeQuickNewProductModal();
      await refreshAllWarehouseData(false);
      if (data.data?.id) window.addProductToPurchaseCart(data.data.id);
    } catch (err) {
      showToast(err.message || "Error creando producto", "error");
    }
  };

  window.renderPurchaseProductPicker = function () {
    const grid = document.getElementById("purchase-products-grid");
    if (!grid) return;
    const q = (document.getElementById("purchase-product-search")?.value || "").trim().toLowerCase();
    const list = almProducts
      .filter((p) => !q || `${p.name} ${p.sku} ${p.barcode || ""}`.toLowerCase().includes(q))
      .slice(0, 30);

    grid.innerHTML = list
      .map(
        (p) => `
      <div onclick="addProductToPurchaseCart('${esc(p.id)}')" class="pos-card cursor-pointer rounded-xl p-3 flex items-center justify-between gap-2">
        <div class="min-w-0">
          <div class="text-xs font-bold text-slate-900 dark:text-white truncate">${esc(p.name)}</div>
          <div class="text-[10px] font-mono text-slate-400 mt-0.5">${esc(p.sku)} • Stock: ${p.stock} • Últ. S/${Number(p.baseCost || 0).toFixed(2)}</div>
        </div>
        <span class="alm-badge-sky px-2.5 py-1 rounded-lg font-semibold text-xs flex-shrink-0">+ Agregar</span>
      </div>`
      )
      .join("");
  };

  window.addProductToPurchaseCart = function (productId) {
    const pid = String(productId);
    const prod = almProducts.find((p) => String(p.id) === pid);
    if (!prod) return;
    const existing = purchaseCart.find((i) => String(i.productId) === pid);
    if (existing) {
      existing.quantity += 1;
      existing.orderedQty = Math.max(existing.orderedQty || existing.quantity, existing.quantity);
    } else {
      const prevPurchases = almPurchases.filter((x) => String(x.productId) === pid);
      const lastCost = prevPurchases.length > 0 ? Number(prevPurchases[0].unitCost || prod.baseCost || 0) : Number(prod.baseCost || 0);
      purchaseCart.push({
        productId: prod.id,
        name: prod.name,
        sku: prod.sku,
        quantity: 1,
        orderedQty: 1,
        unitCost: lastCost,
        historicalCost: lastCost,
      });
    }
    playBeep("ok");
    renderPurchaseCart();
  };

  window.updatePurchaseLine = function (idx, field, val) {
    if (!purchaseCart[idx]) return;
    purchaseCart[idx][field] = Math.max(0, Number(val) || 0);
    updatePurchaseTotalUI();
  };

  window.removePurchaseLine = function (idx) {
    purchaseCart.splice(idx, 1);
    renderPurchaseCart();
  };

  window.clearPurchaseCart = function () {
    purchaseCart = [];
    renderPurchaseCart();
  };

  function updatePurchaseTotalUI() {
    const currency = document.getElementById("purch-currency")?.value || "PEN";
    const rate = Math.max(1, Number(document.getElementById("purch-exchange-rate")?.value || 3.75));
    const rawTotal = purchaseCart.reduce((acc, i) => acc + i.quantity * i.unitCost, 0);
    const el = document.getElementById("purchase-total-amount");
    const convEl = document.getElementById("purchase-total-converted");
    if (el) el.textContent = currency === "USD" ? `USD $ ${rawTotal.toFixed(2)}` : `S/ ${rawTotal.toFixed(2)}`;
    if (convEl) {
      convEl.textContent = currency === "USD" ? `Equiv. Kardex: S/ ${(rawTotal * rate).toFixed(2)} (T.C. ${rate})` : "";
    }
    const mobCount = document.getElementById("purchase-mobile-count");
    if (mobCount) mobCount.textContent = String(purchaseCart.length);
  }

  function renderPurchaseCart() {
    const box = document.getElementById("purchase-cart-items");
    if (!box) return;
    if (purchaseCart.length === 0) {
      box.innerHTML = `<div class="py-8 text-center text-xs text-slate-400">Escanea o elige productos de la izquierda para armar el ingreso de compra.</div>`;
      updatePurchaseTotalUI();
      return;
    }
    box.innerHTML = purchaseCart
      .map((it, idx) => {
        const diffCost = it.historicalCost > 0 ? ((it.unitCost - it.historicalCost) / it.historicalCost) * 100 : 0;
        const costCompareBadge =
          Math.abs(diffCost) >= 1
            ? diffCost > 0
              ? `<span class="text-[10px] font-mono text-rose-500 font-bold">▲ +${diffCost.toFixed(1)}% vs ant.</span>`
              : `<span class="text-[10px] font-mono text-emerald-500 font-bold">▼ ${diffCost.toFixed(1)}% vs ant.</span>`
            : `<span class="text-[10px] font-mono text-slate-400">= Costo estable</span>`;
        const pendingPo = Math.max(0, (it.orderedQty || it.quantity) - it.quantity);

        return `
      <div class="alm-surface-inset rounded-xl p-2.5 space-y-2">
        <div class="flex items-center justify-between gap-2">
          <div class="text-xs font-bold truncate">${esc(it.name)}</div>
          <div class="flex items-center gap-1.5">
            <button type="button" onclick="openBurstSerialModal('${esc(it.productId)}')" class="pos-press px-2 py-0.5 rounded bg-sky-500/15 text-sky-500 text-[10px] font-bold">⚡ Series CSV</button>
            <button type="button" onclick="removePurchaseLine(${idx})" class="text-rose-500 text-xs font-bold px-1">✕</button>
          </div>
        </div>
        <div class="grid grid-cols-3 gap-2">
          <div>
            <label class="text-[10px] text-slate-400">Recibido Hoy</label>
            <input type="number" min="1" value="${it.quantity}" oninput="updatePurchaseLine(${idx}, 'quantity', this.value); renderPurchaseCart();" class="alm-input w-full px-2 py-1 rounded-lg text-xs font-mono font-bold" />
          </div>
          <div>
            <label class="text-[10px] text-slate-400">Pedido O.C.</label>
            <input type="number" min="1" value="${it.orderedQty || it.quantity}" oninput="updatePurchaseLine(${idx}, 'orderedQty', this.value); renderPurchaseCart();" class="alm-input w-full px-2 py-1 rounded-lg text-xs font-mono" />
          </div>
          <div>
            <label class="text-[10px] text-slate-400">Costo Unit.</label>
            <input type="number" min="0" step="0.01" value="${it.unitCost}" onchange="updatePurchaseLine(${idx}, 'unitCost', this.value); renderPurchaseCart();" class="alm-input w-full px-2 py-1 rounded-lg text-xs font-mono font-bold" />
          </div>
        </div>
        <div class="flex items-center justify-between">
          ${costCompareBadge}
          ${pendingPo > 0 ? `<span class="text-[10px] font-mono text-amber-500 font-bold">⏳ Recepción parcial: faltan ${pendingPo}</span>` : `<span class="text-[10px] font-mono text-emerald-500">✓ O.C. Completa</span>`}
        </div>
      </div>`;
      })
      .join("");
    updatePurchaseTotalUI();
  }

  window.confirmPurchaseBatch = async function () {
    if (purchaseCart.length === 0) {
      showToast("Agrega al menos un producto a la compra", "warn");
      return;
    }
    const supplier = document.getElementById("purch-supplier")?.value?.trim();
    const invoiceNumber = document.getElementById("purch-invoice")?.value?.trim();
    const purchaseDate = document.getElementById("purch-date")?.value || new Date().toISOString().split("T")[0];
    const currency = document.getElementById("purch-currency")?.value || "PEN";
    const rate = Math.max(1, Number(document.getElementById("purch-exchange-rate")?.value || 3.75));
    const baseNotes = document.getElementById("purch-notes")?.value?.trim() || "Ingreso desde TurboAlmacén POS";
    const autoPrint = document.getElementById("purchase-auto-print")?.checked;
    const autoLabels = document.getElementById("purchase-auto-labels")?.checked;

    if (!supplier || !invoiceNumber) {
      playBeep("error");
      showToast("Ingresa el Proveedor y el N° de Factura / Guía", "warn");
      return;
    }

    try {
      for (const line of purchaseCart) {
        if (line.quantity <= 0) continue;
        const unitCostPen = currency === "USD" ? Number((line.unitCost * rate).toFixed(2)) : Number(line.unitCost);
        const partialNote =
          (line.orderedQty || line.quantity) > line.quantity
            ? ` [Recepción Parcial: ${line.quantity}/${line.orderedQty}, Pendiente: ${line.orderedQty - line.quantity}]`
            : "";
        const attachNote = purchaseAttachmentName ? ` [Adjunto: ${purchaseAttachmentName}]` : "";
        const currNote = currency === "USD" ? ` [Facturado USD $${line.unitCost} @ TC ${rate}]` : "";

        const res = await fetch("/api/inventory/purchases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: Number(line.productId),
            supplier,
            invoiceNumber,
            purchaseDate,
            quantity: Number(line.quantity),
            unitCost: unitCostPen,
            notes: `${baseNotes}${currNote}${partialNote}${attachNote}`,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || `Error ingresando ${line.name}`);
      }

      const firstProdId = purchaseCart[0]?.productId;
      const ticketItems = purchaseCart.map((i) => ({
        name: i.name,
        code: i.sku,
        qty: `${i.quantity} x ${currency === "USD" ? "$" : "S/"}${i.unitCost.toFixed(2)}`,
      }));
      const total = purchaseCart.reduce((acc, i) => acc + i.quantity * i.unitCost, 0);

      playBeep("ok");
      showToast(`📥 Compra ${invoiceNumber} ingresada al Kardex`, "success");
      purchaseCart = [];
      purchaseAttachmentName = "";
      document.getElementById("purch-attachment-badge")?.classList.add("hidden");
      await refreshAllWarehouseData(false);

      if (autoLabels && firstProdId) {
        const lblSel = document.getElementById("label-product-select");
        if (lblSel) lblSel.value = String(firstProdId);
        window.printThermalLabels();
      } else if (autoPrint) {
        openThermalTicket({
          title: "CONSTANCIA DE INGRESO / COMPRA",
          code: invoiceNumber,
          targetLabel: "PROVEEDOR",
          targetName: supplier,
          notes: `Total: ${currency} ${total.toFixed(2)} • ${baseNotes}`,
          items: ticketItems,
        });
      }
    } catch (err) {
      playBeep("error");
      showToast(err.message || "Error registrando compra", "error");
    }
  };

  // Vista de Kardex Rápido dentro del POS + Exportación CSV
  window.renderKardexQuickView = function () {
    const box = document.getElementById("kardex-movements-list");
    if (!box) return;
    const q = (document.getElementById("kardex-search-input")?.value || "").trim().toLowerCase();
    const typeFilter = document.getElementById("kardex-type-filter")?.value || "";

    const filtered = almMovements
      .filter((m) => {
        if (typeFilter && m.type !== typeFilter) return false;
        if (q) {
          const hay = `${m.productName || ""} ${m.reason || ""} ${m.operatorName || ""} ${m.technicianName || ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .slice(0, 60);

    if (filtered.length === 0) {
      box.innerHTML = `<div class="alm-surface rounded-2xl p-8 text-center text-xs text-slate-400">No hay movimientos de Kardex para este filtro.</div>`;
      return;
    }

    box.innerHTML = filtered
      .map((m) => {
        const badge =
          m.type === "in"
            ? `<span class="alm-badge-ok px-2 py-0.5 rounded-md text-[10px] font-mono font-bold">+${m.quantity} ENTRADA</span>`
            : m.type === "out"
            ? `<span class="alm-badge-warn px-2 py-0.5 rounded-md text-[10px] font-mono font-bold">-${m.quantity} SALIDA</span>`
            : `<span class="alm-badge-sky px-2 py-0.5 rounded-md text-[10px] font-mono font-bold">AJUSTE (${m.quantity})</span>`;
        return `
        <div class="alm-surface rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
          <div class="min-w-0">
            <div class="text-xs font-bold text-slate-900 dark:text-white">${esc(m.productName)}</div>
            <div class="text-[11px] text-slate-500">${esc(m.reason)}</div>
          </div>
          <div class="flex items-center gap-2">
            ${badge}
            <span class="text-[10px] font-mono text-slate-400">${new Date(m.timestamp).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" })}</span>
          </div>
        </div>`;
      })
      .join("");
  };

  window.exportKardexCsv = function () {
    const rows = [["Fecha", "Tipo", "Producto", "Cantidad", "Stock Anterior", "Stock Nuevo", "Motivo", "Operador"]];
    almMovements.slice(0, 500).forEach((m) => {
      rows.push([
        m.timestamp || "",
        m.type || "",
        `"${String(m.productName || "").replace(/"/g, '""')}"`,
        String(m.quantity || 0),
        String(m.previousStock ?? ""),
        String(m.newStock ?? ""),
        `"${String(m.reason || "").replace(/"/g, '""')}"`,
        `"${String(m.operatorName || "").replace(/"/g, '""')}"`,
      ]);
    });
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kardex_${activeTenantId}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Gestión de Garantías (RMA) con Proveedor
  function renderRmaModule() {
    const box = document.getElementById("rma-items-list");
    if (!box) return;
    const rmaList = [];
    for (const p of almProducts) {
      for (const u of p.itemUnits || []) {
        if (u.status === "en_garantia" || u.status === "baja" || u.conditionStatus === "baja" || (u.notes || "").includes("RMA")) {
          rmaList.push({ product: p, unit: u });
        }
      }
    }
    if (rmaList.length === 0) {
      box.innerHTML = `<div class="col-span-full alm-surface rounded-2xl p-8 text-center text-xs text-slate-400">No hay equipos marcados en Garantía RMA o Baja actualmente.</div>`;
      return;
    }
    box.innerHTML = rmaList
      .map(
        ({ product, unit }) => `
      <div class="alm-surface rounded-2xl p-3.5 space-y-1.5">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-slate-900 dark:text-white truncate">${esc(product.name)}</span>
          <span class="alm-badge-crit px-2 py-0.5 rounded text-[10px] font-mono font-bold">${esc(unit.status)}</span>
        </div>
        <div class="text-[11px] font-mono alm-brand-text">SN/SKU: ${esc(unit.sku)}</div>
        <div class="text-[11px] text-slate-400 truncate">${esc(unit.notes || "Para envío a garantía de proveedor")}</div>
      </div>`
      )
      .join("");
  }

  window.printRmaDispatchGuide = function () {
    const rmaItems = [];
    for (const p of almProducts) {
      for (const u of p.itemUnits || []) {
        if (u.status === "en_garantia" || u.status === "baja" || (u.notes || "").includes("RMA")) {
          rmaItems.push({ name: p.name, code: u.sku, qty: "1 RMA" });
        }
      }
    }
    openThermalTicket({
      title: "GUÍA DE ENVÍO A GARANTÍA (RMA)",
      code: `RMA-${Date.now().toString().slice(-6)}`,
      targetLabel: "DESTINO",
      targetName: "Laboratorio / Proveedor Garantías",
      notes: `${rmaItems.length} equipos seriados para revisión RMA`,
      items: rmaItems.length > 0 ? rmaItems : [{ name: "Sin equipos RMA pendientes", code: "-", qty: "0" }],
    });
  };

  // =========================================================================
  // MÓDULO 4: TRANSFERENCIAS (TÉCNICO ↔ TÉCNICO, NODOS POP Y SEDE ↔ SEDE)
  // =========================================================================
  window.switchTransferSubMode = function (mode) {
    ["tech", "node", "sede"].forEach((m) => {
      document.getElementById(`transfer-sub-${m}`)?.classList.toggle("hidden", m !== mode);
      const btn = document.getElementById(`btn-tr-${m}`);
      if (btn) {
        btn.className =
          m === mode
            ? "alm-btn-primary pos-press px-3 py-1.5 rounded-lg text-xs font-semibold"
            : "pos-press px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 dark:text-slate-300";
      }
    });
    if (mode === "node") loadSelectedNodeStock();
    if (mode === "sede") loadInterTenantTransfers();
  };

  window.loadInterTenantTransfers = async function () {
    try {
      const res = await fetch("/api/inventory/inter-tenant-transfers");
      const data = await res.json();
      almInterTenantTransfers = Array.isArray(data.data) ? data.data : [];
      renderInterTenantTransfersList();
    } catch (_) {}
  };

  function renderInterTenantTransfersList() {
    const box = document.getElementById("tr-sede-list");
    if (!box) return;
    if (almInterTenantTransfers.length === 0) {
      box.innerHTML = `<div class="py-8 text-center text-xs text-slate-400">No hay guías de traslado entre sedes registradas.</div>`;
      return;
    }
    box.innerHTML = almInterTenantTransfers
      .map((tr) => {
        const isTransit = tr.status === "en_transito";
        const canReceive = isTransit && tr.targetTenantId === activeTenantId;
        return `
        <div class="alm-surface-inset rounded-xl p-3 flex items-center justify-between gap-2">
          <div class="min-w-0">
            <div class="text-xs font-bold text-slate-900 dark:text-white truncate">${esc(tr.id)} • ${esc(tr.productName)} <span class="font-mono">x${tr.quantity}</span></div>
            <div class="text-[11px] text-slate-400">${esc(tr.sourceTenantName)} ➜ ${esc(tr.targetTenantName)} ${tr.serialNumber ? "• SN: " + esc(tr.serialNumber) : ""}</div>
          </div>
          <div class="flex items-center gap-1.5 flex-shrink-0">
            <span class="${isTransit ? "alm-badge-warn" : "alm-badge-ok"} px-2 py-0.5 rounded text-[10px] font-mono font-bold">${isTransit ? "🚚 EN TRÁNSITO" : "✓ RECIBIDO"}</span>
            ${
              canReceive
                ? `<button type="button" onclick="receiveInterTenantTransfer('${esc(tr.id)}')" class="alm-btn-primary pos-press px-2.5 py-1 rounded-lg text-[11px] font-bold">Confirmar Recepción</button>`
                : ""
            }
          </div>
        </div>`;
      })
      .join("");
  }

  window.createInterTenantTransfer = async function () {
    const tgtSel = document.getElementById("tr-sede-target");
    const targetTenantId = tgtSel?.value || "";
    const targetTenantName = tgtSel?.options[tgtSel.selectedIndex]?.getAttribute("data-name") || targetTenantId;
    const productId = Number(document.getElementById("tr-sede-product")?.value || 0);
    const quantity = Number(document.getElementById("tr-sede-qty")?.value || 1);
    const serialNumber = document.getElementById("tr-sede-serial")?.value?.trim() || "";
    const notes = document.getElementById("tr-sede-notes")?.value?.trim() || "";
    const curTenant = almTenants.find((t) => t.id === activeTenantId);

    if (!targetTenantId || !productId || quantity <= 0) {
      showToast("Selecciona la sede destino, el producto y la cantidad", "warn");
      return;
    }

    try {
      const res = await fetch("/api/inventory/inter-tenant-transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetTenantId,
          targetTenantName,
          sourceTenantName: curTenant?.name || activeTenantId,
          productId,
          quantity,
          serialNumber,
          notes,
          operatorName: almUser?.name || "Almacén POS",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Error creando traslado");
      playBeep("ok");
      showToast(`🚚 Guía ${data.data.id} enviada En Tránsito hacia ${targetTenantName}`, "success");
      await refreshAllWarehouseData(false);

      openThermalTicket({
        title: "GUÍA DE TRASLADO ENTRE SEDES (EN TRÁNSITO)",
        code: data.data.id,
        targetLabel: "SEDE DESTINO",
        targetName: targetTenantName,
        notes: `Origen: ${curTenant?.name || activeTenantId} • ${notes}`,
        items: [{ name: data.data.productName, code: data.data.productSku, qty: `${quantity} und` }],
      });
    } catch (err) {
      playBeep("error");
      showToast(err.message || "Error", "error");
    }
  };

  window.receiveInterTenantTransfer = async function (transferId) {
    try {
      const res = await fetch(`/api/inventory/inter-tenant-transfers/${encodeURIComponent(transferId)}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operatorName: almUser?.name || "Almacén Destino" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Error recibiendo traslado");
      playBeep("ok");
      showToast(`✅ Traslado ${transferId} recibido y sumado a esta sede`, "success");
      await refreshAllWarehouseData(false);
    } catch (err) {
      showToast(err.message || "Error", "error");
    }
  };

  window.renderTechTransferList = function () {
    const box = document.getElementById("transfer-tech-list");
    if (!box) return;
    const srcId = document.getElementById("tr-source-employee")?.value || "";
    const list = almAssignments.filter(
      (a) => (a.status === "en_uso" || a.status === "entregado") && (!srcId || String(a.employeeId) === String(srcId))
    );

    if (list.length === 0) {
      box.innerHTML = `<div class="col-span-full alm-surface rounded-2xl border-dashed p-8 text-center text-xs text-slate-400">No hay materiales asignados para transferir.</div>`;
      return;
    }

    box.innerHTML = list
      .map(
        (a) => `
      <div class="alm-surface rounded-2xl p-3.5 flex items-center justify-between gap-2">
        <div class="min-w-0">
          <div class="text-xs font-bold text-slate-900 dark:text-white truncate">${esc(a.productName)}</div>
          <div class="text-[11px] font-mono alm-brand-text mt-0.5">${esc(a.unitSku || a.productSku || "")} • Cant: ${a.quantity}</div>
          <div class="text-[11px] text-slate-500 dark:text-slate-400 truncate">Actual: ${esc(a.employeeName || a.personnelName)}</div>
        </div>
        <button type="button" onclick="executeTechTransfer('${esc(a.id)}')" class="alm-btn-primary pos-press px-3 py-2 rounded-xl text-xs font-semibold flex-shrink-0">
          Transferir
        </button>
      </div>`
      )
      .join("");
  };

  window.executeTechTransfer = async function (assignmentId) {
    const tgtSel = document.getElementById("tr-target-employee");
    const targetEmployeeId = tgtSel?.value || "";
    if (!targetEmployeeId) {
      playBeep("error");
      showToast("Selecciona primero el técnico receptor arriba", "warn");
      tgtSel?.focus();
      return;
    }
    const targetEmployeeName = tgtSel.options[tgtSel.selectedIndex]?.getAttribute("data-name") || tgtSel.options[tgtSel.selectedIndex]?.text || "Técnico";
    const asg = almAssignments.find((a) => String(a.id) === String(assignmentId));

    try {
      const res = await fetch(`/api/inventory/personnel-assignments/${encodeURIComponent(assignmentId)}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetEmployeeId,
          targetEmployeeName,
          notes: `Transferencia POS autorizada por ${almUser?.name || "Almacén"}`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Error transfiriendo");

      playBeep("ok");
      showToast(`🔁 Transferido a ${targetEmployeeName}`, "success");
      await refreshAllWarehouseData(false);

      if (asg) {
        openThermalTicket({
          title: "GUÍA DE TRANSFERENCIA INTERNA",
          code: `TRF-${Date.now().toString().slice(-6)}`,
          targetLabel: "TRASPASO DE / A",
          targetName: `${asg.employeeName || "Origen"} ➜ ${targetEmployeeName}`,
          notes: "Transferencia directa entre técnicos",
          items: [{ name: asg.productName, code: asg.unitSku || asg.productSku || "", qty: `${asg.quantity} und` }],
        });
      }
    } catch (err) {
      playBeep("error");
      showToast(err.message || "Error al transferir", "error");
    }
  };

  window.loadSelectedNodeStock = async function () {
    const nodeId = document.getElementById("tr-node-select")?.value;
    const listBox = document.getElementById("tr-node-stock-list");
    const countEl = document.getElementById("tr-node-stock-count");
    if (!nodeId || !listBox) return;

    try {
      const res = await fetch(`/api/inventory/assets/${encodeURIComponent(nodeId)}/node-stock`);
      const data = await res.json();
      almSelectedNodeStock = Array.isArray(data.data) ? data.data : [];
      if (countEl) countEl.textContent = `${almSelectedNodeStock.length} ítems`;

      if (almSelectedNodeStock.length === 0) {
        listBox.innerHTML = `<div class="py-8 text-center text-xs text-slate-400">Este nodo aún no tiene stock asignado desde almacén.</div>`;
        return;
      }

      listBox.innerHTML = almSelectedNodeStock
        .map(
          (item) => `
        <div class="alm-surface-inset rounded-xl p-3 flex items-center justify-between gap-2">
          <div class="min-w-0">
            <div class="text-xs font-bold truncate">${esc(item.productName || "Equipo")} <span class="font-mono text-indigo-500">x${item.quantity}</span></div>
            <div class="text-[10px] font-mono text-slate-400">${esc(item.rackLocation || "Sin rack")} ${item.serialNumber ? "• SN: " + esc(item.serialNumber) : ""}</div>
          </div>
          ${
            item.status !== "retornado"
              ? `<button type="button" onclick="returnFromSelectedNode('${esc(item.id)}')" class="pos-press px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500 hover:text-slate-950 text-amber-500 text-[11px] font-bold transition">Retornar</button>`
              : `<span class="text-[10px] font-mono text-slate-400">Retornado</span>`
          }
        </div>`
        )
        .join("");
    } catch (_) {}
  };

  window.assignToSelectedNode = async function () {
    const nodeId = document.getElementById("tr-node-select")?.value;
    const productId = Number(document.getElementById("tr-node-product")?.value || 0);
    const quantity = Number(document.getElementById("tr-node-qty")?.value || 1);
    const rackLocation = document.getElementById("tr-node-rack")?.value?.trim() || undefined;
    const serialNumber = document.getElementById("tr-node-serial")?.value?.trim() || undefined;
    const notes = document.getElementById("tr-node-notes")?.value?.trim() || "Traslado a Nodo desde TurboAlmacén POS";

    if (!nodeId || !productId) {
      showToast("Selecciona el Nodo POP y el producto", "warn");
      return;
    }

    try {
      const res = await fetch(`/api/inventory/assets/${encodeURIComponent(nodeId)}/node-stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          quantity,
          rackLocation,
          serialNumber,
          assignedBy: almUser?.name || "Almacén",
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "No se pudo asignar al nodo");

      playBeep("ok");
      showToast("📡 Stock enviado al Nodo POP", "success");
      await refreshAllWarehouseData(false);
      await loadSelectedNodeStock();
    } catch (err) {
      playBeep("error");
      showToast(err.message || "Error asignando al nodo", "error");
    }
  };

  window.returnFromSelectedNode = async function (stockId) {
    const nodeId = document.getElementById("tr-node-select")?.value;
    if (!nodeId) return;
    try {
      const res = await fetch(`/api/inventory/assets/${encodeURIComponent(nodeId)}/node-stock/${encodeURIComponent(stockId)}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnedBy: almUser?.name || "Almacén", notes: "Retorno desde Nodo POP en TurboAlmacén POS" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Error retornando stock");
      playBeep("ok");
      showToast("Stock retornado del Nodo al Almacén", "success");
      await refreshAllWarehouseData(false);
      await loadSelectedNodeStock();
    } catch (err) {
      playBeep("error");
      showToast(err.message || "Error", "error");
    }
  };

  // =========================================================================
  // MÓDULO 5: CONTROL DE EPP, RENOVACIÓN 1-A-1, MATRIZ TALLAS & ACTA SUNAFIL
  // =========================================================================
  window.setEppFilter = function (f) {
    eppFilter = f;
    document.querySelectorAll(".eppfilter-btn").forEach((b) => {
      const act = b.getAttribute("data-eppfilter") === f;
      b.className = act
        ? "eppfilter-btn alm-btn-primary px-3 py-1.5 rounded-xl text-xs font-semibold"
        : "eppfilter-btn alm-surface px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300";
    });
    const isMatrix = f === "matrix";
    const isCal = f === "calendar";
    document.getElementById("epp-list-container")?.classList.toggle("hidden", isMatrix || isCal);
    document.getElementById("epp-matrix-container")?.classList.toggle("hidden", !isMatrix);
    document.getElementById("epp-calendar-container")?.classList.toggle("hidden", !isCal);

    if (isMatrix) renderEppMatrixAndSizes();
    else if (isCal) renderEppCalendar();
    else renderEppModule();
  };

  function getEppTrafficLight(product, unit) {
    const exp = unit?.expirationDate || product.expirationDate;
    const cond = unit?.conditionStatus || "optimo";
    if (cond === "requiere_cambio" || cond === "baja") return { level: "expired", label: "Requiere Cambio", badge: "bg-rose-500/15 text-rose-500" };
    if (exp) {
      const diffDays = Math.ceil((new Date(exp).getTime() - Date.now()) / 86400000);
      if (diffDays <= 0) return { level: "expired", label: `Vencido (${Math.abs(diffDays)}d)`, badge: "bg-rose-500/15 text-rose-500", diffDays };
      if (diffDays <= (product.alertBeforeDays || 30)) return { level: "soon", label: `Vence en ${diffDays}d`, badge: "bg-amber-500/15 text-amber-500", diffDays };
      return { level: "ok", label: "Óptimo / Vigente", badge: "bg-emerald-500/15 text-emerald-500", diffDays };
    }
    return { level: "ok", label: "Óptimo / Vigente", badge: "bg-emerald-500/15 text-emerald-500", diffDays: 999 };
  }

  function renderEppModule() {
    const box = document.getElementById("epp-list-container");
    if (!box) return;

    const eppProducts = almProducts.filter((p) => p.type === "epp" || p.hasLifespanControl);
    let okCount = 0;
    let soonCount = 0;
    let expCount = 0;
    let assignedCount = 0;

    const cards = [];
    for (const p of eppProducts) {
      const units = Array.isArray(p.itemUnits) && p.itemUnits.length > 0 ? p.itemUnits : [null];
      for (const u of units) {
        const status = getEppTrafficLight(p, u);
        const isAssigned = u ? u.status === "asignado" || u.status === "en_uso" : false;
        if (status.level === "ok") okCount++;
        else if (status.level === "soon") soonCount++;
        else expCount++;
        if (isAssigned) assignedCount++;

        if (eppFilter === "alerts" && status.level === "ok") continue;
        if (eppFilter === "assigned" && !isAssigned) continue;

        cards.push({ product: p, unit: u, status, isAssigned });
      }
    }

    document.getElementById("epp-kpi-ok").textContent = okCount;
    document.getElementById("epp-kpi-soon").textContent = soonCount;
    document.getElementById("epp-kpi-expired").textContent = expCount;
    document.getElementById("epp-kpi-assigned").textContent = assignedCount;

    const alertTotal = soonCount + expCount;
    const badge = document.getElementById("badge-epp-alerts");
    if (badge) {
      badge.textContent = alertTotal;
      badge.classList.toggle("hidden", alertTotal === 0);
    }

    if (cards.length === 0) {
      box.innerHTML = `<div class="col-span-full alm-surface rounded-2xl border-dashed p-10 text-center text-xs text-slate-400">No hay registros de EPP en esta vista.</div>`;
      return;
    }

    box.innerHTML = cards
      .slice(0, 60)
      .map(
        ({ product, unit, status }) => `
      <div class="alm-surface rounded-2xl p-4 space-y-3">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="text-xs font-bold text-slate-900 dark:text-white truncate">${esc(product.name)}</div>
            <div class="text-[11px] font-mono text-slate-400 mt-0.5">${esc(unit ? unit.sku : product.sku)} • Stock: ${product.stock}</div>
            ${unit?.assignedTo ? `<div class="text-[11px] text-sky-500 mt-0.5">👷 Asignado a: ${esc(unit.assignedTo)}</div>` : ""}
          </div>
          <span class="px-2 py-0.5 rounded-md text-[10px] font-bold flex-shrink-0 ${status.badge}">${esc(status.label)}</span>
        </div>
        <div class="flex items-center gap-1.5 pt-1">
          <button type="button" onclick="addToDispatchCart('${esc(product.id)}', 1); switchAlmacenTab('dispatch');" class="pos-press alm-badge-ok flex-1 py-1.5 rounded-lg text-[11px] font-semibold">
            Despachar
          </button>
          ${
            status.level !== "ok" && unit
              ? `<button type="button" onclick="renewEppOneToOne('${esc(product.id)}', '${esc(unit.id)}')" class="pos-press px-2.5 py-1.5 rounded-lg bg-rose-500 text-white text-[11px] font-bold">🔄 Renovar 1-a-1</button>`
              : ""
          }
          ${
            unit
              ? `<button type="button" onclick="openEppInspectModal('${esc(product.id)}', '${esc(unit.id)}')" class="pos-press alm-bulk-btn flex-1 py-1.5 rounded-lg text-[11px] font-semibold">
                  Inspeccionar
                </button>`
              : ""
          }
        </div>
      </div>`
      )
      .join("");
  }

  window.renewEppOneToOne = async function (productId, oldUnitId) {
    const prod = almProducts.find((p) => String(p.id) === String(productId));
    const oldUnit = prod?.itemUnits?.find((u) => u.id === oldUnitId);
    if (!prod || !oldUnit) return;

    // 1. Dar de baja la unidad vencida
    const updatedUnits = prod.itemUnits.map((u) =>
      u.id === oldUnitId ? { ...u, status: "baja", conditionStatus: "baja", notes: "Dado de baja por Renovación 1-a-1 SST" } : u
    );
    await fetch(`/api/inventory/products/${encodeURIComponent(prod.id)}/units`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ units: updatedUnits }),
    });

    // 2. Cargar unidad nueva a la canasta de despacho para el mismo técnico
    if (oldUnit.assignedTo) {
      const emp = almEmployees.find((e) => getEmployeeDisplayName(e).toLowerCase().includes(oldUnit.assignedTo.toLowerCase()));
      const dispSel = document.getElementById("dispatch-employee-select");
      if (emp && dispSel) dispSel.value = String(emp.id);
    }
    window.addToDispatchCart(prod.id, 1, null);
    window.switchAlmacenTab("dispatch");
    showToast(`🔄 EPP viejo (${oldUnit.sku}) dado de baja y reemplazo cargado en canasta`, "success");
  };

  function renderEppMatrixAndSizes() {
    const box = document.getElementById("epp-matrix-container");
    if (!box) return;
    const sizesMap = getEmployeeSizesMap();
    const mandatoryKeys = [
      { key: "casco", label: "Casco" },
      { key: "arnes", label: "Arnés" },
      { key: "bota", label: "Botas" },
      { key: "guante", label: "Guantes" },
      { key: "lente", label: "Lentes" },
    ];

    box.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      ${almEmployees
        .map((emp) => {
          const eid = String(emp.id);
          const eName = getEmployeeDisplayName(emp);
          const sz = sizesMap[eid] || { shoe: "42", pants: "32", shirt: "L" };
          const empAsgs = almAssignments.filter(
            (a) => String(a.employeeId) === eid && (a.status === "en_uso" || a.status === "entregado")
          );
          const hay = empAsgs.map((a) => (a.productName || "").toLowerCase()).join(" ");

          return `
          <div class="alm-surface rounded-2xl p-4 space-y-2.5">
            <div class="flex items-center justify-between">
              <div>
                <div class="text-xs font-extrabold text-slate-900 dark:text-white">👷 ${esc(eName)}</div>
                <div class="text-[10px] text-slate-400">${esc(emp.position || "Técnico Planta Externa")}</div>
              </div>
              <div class="flex items-center gap-1">
                <input type="text" value="${esc(sz.shoe)}" onchange="saveEmployeeSize('${esc(eid)}', 'shoe', this.value)" title="Talla Calzado" placeholder="Calz" class="alm-input w-11 px-1.5 py-0.5 rounded text-[10px] font-mono text-center" />
                <input type="text" value="${esc(sz.pants)}" onchange="saveEmployeeSize('${esc(eid)}', 'pants', this.value)" title="Talla Pantalón" placeholder="Pant" class="alm-input w-11 px-1.5 py-0.5 rounded text-[10px] font-mono text-center" />
                <input type="text" value="${esc(sz.shirt)}" onchange="saveEmployeeSize('${esc(eid)}', 'shirt', this.value)" title="Talla Camisa/Chaleco" placeholder="Cam" class="alm-input w-10 px-1.5 py-0.5 rounded text-[10px] font-mono text-center" />
              </div>
            </div>
            <div class="flex flex-wrap gap-1.5">
              ${mandatoryKeys
                .map((m) => {
                  const hasIt = hay.includes(m.key);
                  return `<span class="${hasIt ? "alm-badge-ok" : "alm-badge-crit"} px-2 py-0.5 rounded-md text-[10px] font-bold">${hasIt ? "✓" : "✕"} ${m.label}</span>`;
                })
                .join("")}
            </div>
          </div>`;
        })
        .join("")}
    </div>`;
  }

  window.saveEmployeeSize = function (empId, field, val) {
    const map = getEmployeeSizesMap();
    if (!map[empId]) map[empId] = { shoe: "42", pants: "32", shirt: "L" };
    map[empId][field] = val.trim();
    localStorage.setItem("turboalmacen_emp_sizes", JSON.stringify(map));
    showToast("Talla del técnico actualizada", "success");
  };

  function renderEppCalendar() {
    const box = document.getElementById("epp-calendar-container");
    if (!box) return;
    const upcoming = [];
    for (const p of almProducts.filter((x) => x.type === "epp" || x.hasLifespanControl)) {
      for (const u of p.itemUnits || []) {
        const exp = u.expirationDate || p.expirationDate;
        if (exp) {
          const st = getEppTrafficLight(p, u);
          upcoming.push({ product: p, unit: u, exp, diffDays: st.diffDays ?? 999, badge: st.badge, label: st.label });
        }
      }
    }
    upcoming.sort((a, b) => a.diffDays - b.diffDays);
    if (upcoming.length === 0) {
      box.innerHTML = `<div class="alm-surface rounded-2xl p-8 text-center text-xs text-slate-400">No hay fechas de vencimiento programadas en unidades EPP.</div>`;
      return;
    }
    box.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      ${upcoming
        .map(
          (it) => `
        <div class="alm-surface rounded-2xl p-3.5 flex items-center justify-between gap-2">
          <div class="min-w-0">
            <div class="text-xs font-bold truncate">${esc(it.product.name)}</div>
            <div class="text-[11px] font-mono text-slate-400">${esc(it.unit.sku)} • 📅 ${esc(it.exp.split("T")[0])}</div>
            ${it.unit.assignedTo ? `<div class="text-[10px] text-sky-500">👷 ${esc(it.unit.assignedTo)}</div>` : ""}
          </div>
          <span class="px-2 py-0.5 rounded text-[10px] font-bold flex-shrink-0 ${it.badge}">${esc(it.label)}</span>
        </div>`
        )
        .join("")}
    </div>`;
  }

  window.printSunafilEppActa = function () {
    const empSel = document.getElementById("dispatch-employee-select");
    const techName =
      (empSel && empSel.value && empSel.options[empSel.selectedIndex]?.getAttribute("data-name")) ||
      (almEmployees[0] && getEmployeeDisplayName(almEmployees[0])) ||
      "Colaborador Técnico";
    const eppAsgs = almAssignments.filter(
      (a) =>
        (a.status === "en_uso" || a.status === "entregado") &&
        (!empSel?.value || String(a.employeeId) === String(empSel.value))
    );
    openThermalTicket({
      title: "ACTA ENTREGA EPP (LEY SST 29783 / SUNAFIL)",
      code: `SST-${Date.now().toString().slice(-6)}`,
      targetLabel: "TRABAJADOR RECEPTOR",
      targetName: techName,
      notes: "Declaro recibir los EPP en óptimas condiciones y comprometerme a su uso obligatorio en campo.",
      items:
        eppAsgs.length > 0
          ? eppAsgs.slice(0, 12).map((a) => ({ name: a.productName, code: a.unitSku || a.productSku, qty: `x${a.quantity}` }))
          : [{ name: "Casco, Arnés, Botas Dieléctricas, Guantes", code: "KIT-SST", qty: "1 Kit" }],
      requireFingerprintBox: true,
    });
  };

  window.openEppInspectModal = function (productId, unitId) {
    const prod = almProducts.find((p) => String(p.id) === String(productId));
    const unit = prod?.itemUnits?.find((u) => u.id === unitId);
    if (!prod || !unit) return;

    document.getElementById("epp-modal-title").textContent = `Inspección EPP • ${prod.name} (${unit.sku})`;
    document.getElementById("epp-modal-body").innerHTML = `
      <div>
        <label class="block text-[10px] font-bold uppercase text-slate-500 mb-1">Condición Física</label>
        <select id="epp-cond-sel" class="alm-input w-full px-3 py-2 rounded-xl text-xs font-bold">
          <option value="optimo" ${unit.conditionStatus === "optimo" ? "selected" : ""}>🟢 Óptimo</option>
          <option value="bueno" ${unit.conditionStatus === "bueno" ? "selected" : ""}>🟢 Bueno</option>
          <option value="regular" ${unit.conditionStatus === "regular" ? "selected" : ""}>🟡 Regular</option>
          <option value="requiere_cambio" ${unit.conditionStatus === "requiere_cambio" ? "selected" : ""}>🔴 Requiere Cambio</option>
          <option value="baja" ${unit.conditionStatus === "baja" ? "selected" : ""}>⛔ Dar de Baja</option>
        </select>
      </div>
      <div>
        <label class="block text-[10px] font-bold uppercase text-slate-500 mb-1">Fecha de Vencimiento</label>
        <input id="epp-exp-input" type="date" value="${esc((unit.expirationDate || "").split("T")[0])}" class="alm-input w-full px-3 py-2 rounded-xl text-xs font-mono" />
      </div>
      <div>
        <label class="block text-[10px] font-bold uppercase text-slate-500 mb-1">Observación de Inspección</label>
        <input id="epp-note-input" type="text" value="${esc(unit.notes || "")}" placeholder="Ej: Revisado sin fisuras / correas OK" class="alm-input w-full px-3 py-2 rounded-xl text-xs" />
      </div>
      <div class="flex items-center justify-between">
        <span class="text-[11px] text-slate-400">Evidencia Fotográfica SST:</span>
        <label class="pos-press px-3 py-1.5 rounded-xl alm-brand-badge text-xs font-bold cursor-pointer">
          <span>📷 Tomar / Subir Foto</span>
          <input type="file" id="epp-photo-input" accept="image/*" capture="environment" class="hidden" />
        </label>
      </div>
      <div class="flex gap-2 pt-2">
        <button type="button" onclick="closeEppModal()" class="pos-press flex-1 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-bold">Cancelar</button>
        <button type="button" onclick="saveEppInspection('${esc(productId)}', '${esc(unitId)}')" class="pos-press alm-btn-primary flex-1 py-2.5 rounded-xl text-xs font-extrabold">Guardar Inspección</button>
      </div>
    `;
    document.getElementById("epp-inspect-modal").classList.remove("hidden");
  };

  window.closeEppModal = function () {
    document.getElementById("epp-inspect-modal")?.classList.add("hidden");
  };

  window.saveEppInspection = async function (productId, unitId) {
    const prod = almProducts.find((p) => String(p.id) === String(productId));
    if (!prod || !Array.isArray(prod.itemUnits)) return;

    const conditionStatus = document.getElementById("epp-cond-sel")?.value || "optimo";
    const expirationDate = document.getElementById("epp-exp-input")?.value || null;
    const rawNote = document.getElementById("epp-note-input")?.value?.trim() || "";
    const photoFile = document.getElementById("epp-photo-input")?.files?.[0];
    const notes = photoFile ? `${rawNote} [📷 Foto: ${photoFile.name}]`.trim() : rawNote;
    const today = new Date().toISOString().split("T")[0];

    const updatedUnits = prod.itemUnits.map((u) =>
      u.id === unitId
        ? {
            ...u,
            conditionStatus,
            expirationDate,
            notes,
            lastInspectionDate: today,
            status: conditionStatus === "baja" ? "baja" : u.status,
          }
        : u
    );

    try {
      const res = await fetch(`/api/inventory/products/${productId}/units`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ units: updatedUnits }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Error actualizando EPP");

      closeEppModal();
      playBeep("ok");
      showToast("Inspección de EPP guardada con éxito", "success");
      await refreshAllWarehouseData(false);
    } catch (err) {
      showToast(err.message || "Error guardando inspección", "error");
    }
  };

  // =========================================================================
  // MÓDULO 6: VERIFICADOR 360°, CONTEO CIEGO, MAPA 2D, REORDEN & REPORTE Z
  // =========================================================================
  window.switchVerifySubMode = function (mode) {
    verifySubMode = mode;
    ["lookup", "blind", "map", "reorder"].forEach((m) => {
      document.getElementById(`verify-sub-${m}`)?.classList.toggle("hidden", m !== mode);
      const btn = document.getElementById(`btn-ver-sub-${m}`);
      if (btn) {
        btn.className =
          m === mode
            ? "alm-btn-primary pos-press px-3 py-1.5 rounded-lg text-xs font-semibold"
            : "pos-press px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 dark:text-slate-300";
      }
    });
    if (mode === "blind") renderBlindCountModule();
    else if (mode === "map") renderWarehouse2DMap();
    else if (mode === "reorder") renderSmartReorderAndAudit();
  };

  window.runVerifierFromInput = function () {
    const val = (document.getElementById("verify-manual-input")?.value || "").trim();
    if (val) runVerifierLookup(val);
  };

  async function runVerifierLookup(query) {
    const box = document.getElementById("verify-result-box");
    if (!box) return;
    box.innerHTML = `<div class="py-8 text-xs font-mono text-cyan-500">Consultando trazabilidad 360° para "${esc(query)}"...</div>`;

    const localMatch = findProductOrUnitByCode(query);
    let trace = null;
    try {
      const res = await fetch(`/api/inventory/traceability/${encodeURIComponent(query)}`);
      if (res.ok) {
        const d = await res.json();
        trace = d.data || null;
      }
    } catch (_) {}

    const prod = trace?.product || localMatch?.product;
    if (!prod) {
      box.innerHTML = `<div class="py-8 text-rose-500 font-bold text-sm">❌ No se encontró ningún producto ni serie con "${esc(query)}"</div>`;
      return;
    }

    const unit = trace?.matchedUnit || localMatch?.unit;
    const activeAsg = almAssignments.filter(
      (a) => String(a.productId) === String(prod.id) && (a.status === "en_uso" || a.status === "entregado")
    );
    const prodPurchases = almPurchases.filter((p) => String(p.productId) === String(prod.id)).slice(0, 3);
    const prodInstalls = almInstallations.filter((i) => String(i.productId) === String(prod.id)).slice(0, 3);

    // Calcular días de stock restante según velocidad de 30 días
    const thirtyDaysAgo = Date.now() - 30 * 86400000;
    const outLast30d = almMovements
      .filter((m) => String(m.productId) === String(prod.id) && m.type === "out" && new Date(m.timestamp).getTime() >= thirtyDaysAgo)
      .reduce((acc, m) => acc + Number(m.quantity || 0), 0);
    const dailyRate = outLast30d / 30;
    const daysLeft = dailyRate > 0 ? Math.round(prod.stock / dailyRate) : 999;

    box.className = "alm-surface-inset rounded-xl border border-emerald-500/35 p-5 text-left space-y-4";
    box.innerHTML = `
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div class="flex items-center gap-1.5">
            <span class="alm-badge-ok px-2 py-0.5 rounded-md text-[10px] font-mono font-bold">${esc(prod.sku)}</span>
            <span class="${daysLeft <= 7 ? "alm-badge-crit" : "alm-badge-sky"} px-2 py-0.5 rounded-md text-[10px] font-mono font-bold">
              ${daysLeft < 999 ? `⏳ Alcance: ~${daysLeft} días de stock` : "Stock estable"}
            </span>
          </div>
          <h3 class="text-base font-bold text-slate-900 dark:text-white mt-1.5">${esc(prod.name)}</h3>
          <div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">📍 Ubicación: <strong class="text-slate-800 dark:text-slate-200">${esc(prod.location || "Almacén Central")}</strong></div>
        </div>
        <div class="text-right">
          <div class="text-[10px] uppercase font-bold tracking-wider text-slate-400">Stock Disponible</div>
          <div class="text-3xl font-extrabold font-mono text-emerald-500">${prod.stock} <span class="text-xs font-semibold">${esc(prod.type === "bulk" ? prod.unitOfMeasure || "m" : "und")}</span></div>
        </div>
      </div>
      ${
        unit
          ? `<div class="p-3 rounded-xl bg-sky-500/10 border border-sky-500/25 text-xs font-mono space-y-1">
              <div>🔍 Unidad / Serie: <b>${esc(unit.sku)}</b> ${unit.serialNumber ? `(${esc(unit.serialNumber)})` : ""}</div>
              <div>Estado: <b>${esc(unit.status)}</b> • Condición: <b>${esc(unit.conditionStatus || "optimo")}</b> ${unit.assignedTo ? `• En poder de: <b>${esc(unit.assignedTo)}</b>` : ""}</div>
            </div>`
          : ""
      }

      <!-- Línea de Tiempo de Trazabilidad 360° -->
      <div class="alm-surface rounded-xl p-3 space-y-2">
        <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Línea de Tiempo 360° (Compra ➜ Almacén ➜ Técnico ➜ Cliente)</div>
        <div class="space-y-1.5 text-xs">
          ${prodPurchases.map((p) => `<div class="flex justify-between"><span>📥 Compra Factura <b>${esc(p.invoiceNumber)}</b> (${esc(p.supplier)})</span><span class="font-mono text-sky-500">+${p.quantity} • S/${p.unitCost}</span></div>`).join("")}
          ${activeAsg.slice(0, 4).map((a) => `<div class="flex justify-between"><span>👷 En Mochila de <b>${esc(a.employeeName)}</b></span><span class="font-mono text-amber-500">${esc(a.unitSku || "x" + a.quantity)}</span></div>`).join("")}
          ${prodInstalls.map((i) => `<div class="flex justify-between"><span>🏠 Instalado en Cliente <b>${esc(i.customerName || i.clientName)}</b> por ${esc(i.technicianName)}</span><span class="font-mono text-emerald-500">${esc(i.serialOrMac || "x" + i.quantity)}</span></div>`).join("")}
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        <button type="button" onclick="addToDispatchCart('${esc(prod.id)}', 1); switchAlmacenTab('dispatch');" class="alm-btn-primary pos-press px-4 py-2 rounded-xl text-xs font-bold">Enviar a Despacho</button>
        <button type="button" onclick="document.getElementById('label-product-select').value='${esc(prod.id)}'; printThermalLabels();" class="pos-press px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold">Imprimir Etiquetas</button>
      </div>
    `;
  }

  // Conteo Ciego / Inventario Físico Rápido
  window.toggleBlindCountReveal = function () {
    blindCountRevealed = !blindCountRevealed;
    const btn = document.getElementById("btn-blind-reveal");
    if (btn) btn.textContent = blindCountRevealed ? "🙈 Ocultar Stock Sistema" : "👁️ Revelar Diferencias";
    renderBlindCountModule();
  };

  window.updateBlindCountInput = function (productId, val) {
    if (val === "" || val === null) delete blindCountsMap[String(productId)];
    else blindCountsMap[String(productId)] = Math.max(0, Number(val) || 0);
    if (blindCountRevealed) renderBlindCountModule();
  };

  function renderBlindCountModule() {
    const box = document.getElementById("blind-count-list");
    if (!box) return;
    box.innerHTML = almProducts
      .slice(0, 36)
      .map((p) => {
        const pid = String(p.id);
        const counted = blindCountsMap[pid];
        const hasCount = counted !== undefined;
        const diff = hasCount ? counted - Number(p.stock || 0) : 0;
        return `
        <div class="alm-surface rounded-2xl p-3.5 space-y-2">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="text-xs font-bold text-slate-900 dark:text-white truncate">${esc(p.name)}</div>
              <div class="text-[10px] font-mono text-slate-400">${esc(p.sku)} • 📍 ${esc(p.location || "Almacén")}</div>
            </div>
            ${
              blindCountRevealed
                ? `<span class="text-xs font-mono font-bold text-slate-400">Sist: ${p.stock}</span>`
                : `<span class="text-[10px] font-mono text-slate-400">🔒 Ciego</span>`
            }
          </div>
          <div class="flex items-center justify-between gap-2">
            <input type="number" min="0" value="${hasCount ? counted : ""}" placeholder="Digitar conteo físico..." onchange="updateBlindCountInput('${esc(pid)}', this.value)" class="alm-input flex-1 px-2.5 py-1.5 rounded-xl text-xs font-mono font-bold" />
            ${
              blindCountRevealed && hasCount
                ? `<span class="px-2 py-1 rounded-lg text-xs font-mono font-extrabold ${diff === 0 ? "alm-badge-ok" : diff < 0 ? "alm-badge-crit" : "alm-badge-warn"}">
                    ${diff === 0 ? "✓ Cuadra" : diff > 0 ? `+${diff} Sobrante` : `${diff} Faltante`}
                  </span>`
                : ""
            }
          </div>
        </div>`;
      })
      .join("");
  }

  window.applyBlindCountAdjustments = async function () {
    const entries = Object.entries(blindCountsMap);
    if (entries.length === 0) {
      showToast("Ingresa el conteo físico en al menos un producto", "warn");
      return;
    }
    let adjusted = 0;
    for (const [pid, physicalQty] of entries) {
      const prod = almProducts.find((p) => String(p.id) === String(pid));
      if (!prod || Number(prod.stock) === Number(physicalQty)) continue;
      await fetch(`/api/inventory/products/${encodeURIComponent(prod.id)}/adjust-stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "adjustment",
          quantity: Number(physicalQty),
          reason: `Ajuste por Conteo Ciego (Sistema: ${prod.stock} ➜ Físico: ${physicalQty})`,
          operatorName: almUser?.name || "Auditor Almacén",
        }),
      });
      logAntifraudAudit("AJUSTE_CONTEO_CIEGO", `${prod.name}: Sistema ${prod.stock} ➜ Físico ${physicalQty}`, "Inventario Físico");
      adjusted++;
    }
    blindCountsMap = {};
    playBeep("ok");
    showToast(`⚖️ ${adjusted} producto(s) cuadrados en el Kardex y registrados en Bitácora`, "success");
    await refreshAllWarehouseData(false);
  };

  // Mapa Visual 2D de Estanterías del Almacén
  function renderWarehouse2DMap() {
    const mapGrid = document.getElementById("warehouse-2d-map-grid");
    const itemsBox = document.getElementById("warehouse-2d-zone-items");
    if (!mapGrid || !itemsBox) return;

    const zones = [
      { id: "ALL", title: "🏢 Todo el Almacén", match: () => true },
      { id: "BOBINAS", title: "🧵 Zona Bobinas / Patio", match: (p) => p.type === "bulk" || /bobina|patio|cable/i.test(p.location || "") },
      { id: "PASILLO_A", title: "🗄️ Pasillo A (Equipos/ONUs)", match: (p) => p.type === "simple" || /pasillo a|estante a|rack/i.test(p.location || "") },
      { id: "PASILLO_B", title: "🧰 Pasillo B (Ferretería/Herrajes)", match: (p) => /pasillo b|estante b|herraje|cintillo/i.test(`${p.location} ${p.name}`) },
      { id: "ZONA_EPP", title: "🦺 Zona EPP & Seguridad", match: (p) => p.type === "epp" || p.hasLifespanControl },
      { id: "LAB_RMA", title: "🔬 Laboratorio & RMA", match: (p) => (p.itemUnits || []).some((u) => u.status === "en_garantia" || (u.notes || "").includes("LAB")) },
    ];

    mapGrid.innerHTML = zones
      .map((z) => {
        const count = almProducts.filter(z.match).length;
        const isAct = activeWarehouseZone === z.id;
        return `
        <button type="button" onclick="selectWarehouseMapZone('${z.id}')" class="pos-press rounded-2xl p-3.5 text-left transition ${isAct ? "alm-btn-primary" : "alm-surface"}">
          <div class="text-xs font-extrabold truncate">${z.title}</div>
          <div class="text-lg font-mono font-extrabold mt-1">${count} <span class="text-[10px] font-normal opacity-80">SKUs</span></div>
        </button>`;
      })
      .join("");

    const activeZ = zones.find((z) => z.id === activeWarehouseZone) || zones[0];
    const zoneProds = almProducts.filter(activeZ.match);
    itemsBox.innerHTML = `
      <div class="flex items-center justify-between mb-3">
        <h4 class="text-xs font-extrabold uppercase tracking-wider text-slate-400">Productos en ${activeZ.title} (${zoneProds.length})</h4>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        ${zoneProds
          .map(
            (p) => `
          <div class="alm-surface-inset rounded-xl p-2.5 flex items-center justify-between gap-2">
            <div class="min-w-0">
              <div class="text-xs font-bold truncate">${esc(p.name)}</div>
              <div class="text-[10px] font-mono text-slate-400">📍 ${esc(p.location || "Almacén Central")} • ${esc(p.sku)}</div>
            </div>
            <span class="alm-badge-ok px-2 py-0.5 rounded font-mono text-xs font-bold flex-shrink-0">${p.stock}</span>
          </div>`
          )
          .join("")}
      </div>`;
  }

  window.selectWarehouseMapZone = function (zoneId) {
    activeWarehouseZone = zoneId;
    renderWarehouse2DMap();
  };

  // Semáforo de Punto de Reorden Inteligente & Bitácora Anti-Fraude
  function renderSmartReorderAndAudit() {
    const reorderBox = document.getElementById("smart-reorder-list");
    const auditBox = document.getElementById("antifraud-audit-list");

    if (reorderBox) {
      const thirtyDaysAgo = Date.now() - 30 * 86400000;
      const items = almProducts
        .map((p) => {
          const out30 = almMovements
            .filter((m) => String(m.productId) === String(p.id) && m.type === "out" && new Date(m.timestamp).getTime() >= thirtyDaysAgo)
            .reduce((acc, m) => acc + Number(m.quantity || 0), 0);
          const daily = out30 / 30;
          const daysLeft = daily > 0 ? Math.round(p.stock / daily) : p.stock <= p.stockMin ? 3 : 90;
          return { product: p, out30, daysLeft };
        })
        .sort((a, b) => a.daysLeft - b.daysLeft)
        .slice(0, 25);

      reorderBox.innerHTML = items
        .map(({ product, out30, daysLeft }) => {
          const badge = daysLeft <= 5 ? "alm-badge-crit" : daysLeft <= 14 ? "alm-badge-warn" : "alm-badge-ok";
          return `
          <div class="alm-surface-inset rounded-xl p-2.5 flex items-center justify-between gap-2">
            <div class="min-w-0">
              <div class="text-xs font-bold truncate">${esc(product.name)}</div>
              <div class="text-[10px] font-mono text-slate-400">Stock: ${product.stock} • Consumo 30d: ${out30}</div>
            </div>
            <span class="${badge} px-2.5 py-1 rounded-lg text-[10px] font-mono font-extrabold flex-shrink-0">
              Quedan ~${daysLeft} días
            </span>
          </div>`;
        })
        .join("");
    }

    if (auditBox) {
      const localLogs = getAntifraudAuditLog();
      const movAdjusts = almMovements
        .filter((m) => m.type === "adjustment" || /merma|baja|conteo/i.test(m.reason || ""))
        .slice(0, 20)
        .map((m) => ({
          id: m.id,
          action: "KARDEX_AUDITORÍA",
          detail: `${m.productName} (Cant: ${m.quantity})`,
          reason: m.reason,
          operator: m.operatorName || "Almacén",
          timestamp: m.timestamp,
        }));
      const combined = [...localLogs, ...movAdjusts].slice(0, 35);
      if (combined.length === 0) {
        auditBox.innerHTML = `<div class="py-8 text-center text-xs text-slate-400">Sin eventos críticos de ajuste o baja registrados aún.</div>`;
      } else {
        auditBox.innerHTML = combined
          .map(
            (log) => `
          <div class="alm-surface-inset rounded-xl p-2.5 space-y-0.5">
            <div class="flex items-center justify-between text-[11px] font-mono">
              <span class="font-extrabold text-amber-500">${esc(log.action)}</span>
              <span class="text-slate-400">${new Date(log.timestamp).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" })}</span>
            </div>
            <div class="text-xs font-bold text-slate-900 dark:text-white">${esc(log.detail)}</div>
            <div class="text-[10px] text-slate-400">Motivo: ${esc(log.reason)} • Op: ${esc(log.operator)}</div>
          </div>`
          )
          .join("");
      }
    }
  }

  // =========================================================================
  // ESCÁNER REMOTO DESDE EL CELULAR (EMPAREJAMIENTO QR + SSE EN VIVO)
  // =========================================================================
  window.openRemoteScannerModal = async function () {
    const modal = document.getElementById("remote-scanner-modal");
    const qrBox = document.getElementById("remote-scanner-qr-box");
    const statusEl = document.getElementById("remote-scanner-status");
    const urlEl = document.getElementById("remote-scanner-url");
    if (!modal || !qrBox) return;

    modal.classList.remove("hidden");
    qrBox.innerHTML = "";
    if (statusEl) statusEl.textContent = "Generando código de enlace en vivo...";

    try {
      const res = await fetch("/api/scanner/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "TurboAlmacén POS", targetField: "global-scan-input" }),
      });
      const data = await res.json();
      const session = data.data?.session;
      const pairUrl = data.data?.urls?.lanUrl || data.data?.urls?.primaryUrl || `${window.location.origin}/?scannerSession=${session?.sessionId}`;

      if (typeof window.QRCode === "function") {
        new window.QRCode(qrBox, { text: pairUrl, width: 168, height: 168 });
      }
      if (urlEl) urlEl.textContent = pairUrl;
      if (statusEl) statusEl.textContent = "🟢 Esperando escaneo desde el celular...";

      if (remoteScannerEvtSource) remoteScannerEvtSource.close();
      if (session?.sessionId) {
        let sseErrors = 0;
        remoteScannerEvtSource = new EventSource(`/api/scanner/session/${encodeURIComponent(session.sessionId)}/events`);
        remoteScannerEvtSource.onmessage = function (ev) {
          sseErrors = 0;
          try {
            const payload = JSON.parse(ev.data);
            if (payload.type === "connected" && statusEl) {
              statusEl.textContent = `📱 Conectado: ${payload.deviceInfo || "Celular en vivo"}`;
              playBeep("ok");
            } else if (payload.type === "scan" && payload.data?.code) {
              processScannedCode(payload.data.code);
            }
          } catch (_) {}
        };
        remoteScannerEvtSource.onerror = function () {
          sseErrors++;
          if (!remoteScannerEvtSource || remoteScannerEvtSource.readyState === EventSource.CLOSED || sseErrors >= 3) {
            try { remoteScannerEvtSource?.close(); } catch (_) {}
            remoteScannerEvtSource = null;
          }
        };
      }
    } catch (err) {
      if (statusEl) statusEl.textContent = "Error iniciando sesión remota";
    }
  };

  window.closeRemoteScannerModal = function () {
    document.getElementById("remote-scanner-modal")?.classList.add("hidden");
  };

  // =========================================================================
  // REPORTE Z DE CIERRE DIARIO DE ALMACÉN
  // =========================================================================
  window.printDailyZReport = function () {
    const todayStr = new Date().toISOString().split("T")[0];
    const dispatchesToday = almAssignments.filter((a) => (a.assignedAt || "").startsWith(todayStr));
    const returnsToday = almAssignments.filter((a) => a.status === "devuelto" && (a.returnedAt || "").startsWith(todayStr));
    const purchasesToday = almPurchases.filter((p) => (p.purchaseDate || p.date || "").startsWith(todayStr));
    const criticalProds = almProducts.filter((p) => Number(p.stock) <= Number(p.stockCritical || 2));
    const activeInField = almAssignments.filter((a) => a.status === "en_uso" || a.status === "entregado");

    openThermalTicket({
      title: "REPORTE Z • CIERRE DIARIO DE ALMACÉN",
      code: `REPZ-${todayStr.replace(/-/g, "")}`,
      targetLabel: "SEDE / FECHA",
      targetName: `${activeTenantId.toUpperCase()} • ${todayStr}`,
      notes: `Despachos hoy: ${dispatchesToday.length} | Devoluciones hoy: ${returnsToday.length} | Compras hoy: ${purchasesToday.length}`,
      items: [
        { name: "TOTAL DESPACHOS HOY", code: "Salidas a técnicos", qty: `${dispatchesToday.length} op` },
        { name: "TOTAL DEVOLUCIONES HOY", code: "Reingresos a stock", qty: `${returnsToday.length} op` },
        { name: "COMPRAS INGRESADAS HOY", code: "Facturas proveedor", qty: `${purchasesToday.length} fac` },
        { name: "PRODUCTOS EN STOCK CRÍTICO", code: "Requieren reposición", qty: `${criticalProds.length} SKUs` },
        { name: "MATERIAL ACTIVO EN MOCHILAS", code: "Pendiente en campo", qty: `${activeInField.length} asg` },
      ],
    });
  };

  // =========================================================================
  // MOTOR DE IMPRESIÓN TÉRMICA (58mm / 80mm): TICKETS, FIRMA Y ETIQUETAS
  // =========================================================================
  function openThermalTicket(opts) {
    const nowStr = new Date().toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
    const curTenant = almTenants.find((t) => t.id === activeTenantId);
    const tenantHeader = curTenant ? `${curTenant.name}${curTenant.ruc ? " • RUC " + curTenant.ruc : ""}` : "TurboAlmacén POS";

    const rowsHtml = (opts.items || [])
      .map(
        (it) => `
      <div style="display:flex;justify-content:space-between;gap:6px;margin:3px 0;">
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;">${esc(it.name)}</div>
          ${it.code ? `<div style="font-size:9px;opacity:0.8;">${esc(it.code)}${it.extra ? " • " + esc(it.extra) : ""}</div>` : ""}
        </div>
        <div style="font-weight:700;white-space:nowrap;">${esc(it.qty)}</div>
      </div>`
      )
      .join("");

    const sigImgHtml = opts.signatureDataUrl
      ? `<div style="text-align:center;margin:6px 0;">
          <div style="font-size:8px;opacity:0.75;">FIRMA DIGITAL DEL TÉCNICO:</div>
          <img src="${opts.signatureDataUrl}" alt="Firma" style="max-height:46px;margin:2px auto;display:block;border-bottom:1px solid #000;" />
        </div>`
      : "";

    const fingerprintHtml = opts.requireFingerprintBox
      ? `<div style="margin:8px auto 4px;width:54px;height:64px;border:1px solid #000;display:flex;align-items:flex-end;justify-content:center;font-size:7px;padding-bottom:2px;">HUELLA</div>`
      : "";

    const ticketHtml = `
      <div style="text-align:center;margin-bottom:6px;">
        <img src="/assets/logo_thermal_turbo.png" alt="Logo" style="max-height:36px;margin:0 auto 4px;display:block;" onerror="this.style.display='none'" />
        <div style="font-weight:700;font-size:9px;">${esc(tenantHeader)}</div>
        <div style="font-weight:800;font-size:12px;">${esc(opts.title)}</div>
        <div style="font-size:10px;">OP: ${esc(opts.code)} • ${esc(nowStr)}</div>
      </div>
      <div class="thermal-divider" style="border-top:1px dashed #000;margin:6px 0;"></div>
      <div style="font-size:10px;margin-bottom:4px;">
        <div><b>${esc(opts.targetLabel || "DESTINO")}:</b> ${esc(opts.targetName || "-")}</div>
        <div><b>ALMACENERO:</b> ${esc(almUser?.name || "Almacén")}</div>
        ${opts.notes ? `<div><b>NOTA:</b> ${esc(opts.notes)}</div>` : ""}
      </div>
      <div class="thermal-divider" style="border-top:1px dashed #000;margin:6px 0;"></div>
      <div>${rowsHtml}</div>
      <div class="thermal-divider" style="border-top:1px dashed #000;margin:8px 0;"></div>
      ${sigImgHtml}
      ${fingerprintHtml}
      <div id="thermal-qr-slot" style="display:flex;justify-content:center;margin:6px 0;"></div>
      <div style="margin-top:18px;display:flex;justify-content:space-between;gap:10px;text-align:center;font-size:9px;">
        <div style="flex:1;border-top:1px solid #000;padding-top:3px;">Almacén</div>
        <div style="flex:1;border-top:1px solid #000;padding-top:3px;">Recibí Conforme</div>
      </div>
    `;

    const printArea = document.getElementById("thermal-print-area");
    const previewPaper = document.getElementById("ticket-preview-paper");
    if (printArea) {
      printArea.className = paperWidth === "58" ? "paper-58" : "";
      printArea.innerHTML = ticketHtml;
    }
    if (previewPaper) {
      previewPaper.style.width = paperWidth === "58" ? "220px" : "290px";
      previewPaper.innerHTML = ticketHtml;
    }

    if (typeof window.QRCode === "function") {
      [printArea, previewPaper].forEach((root) => {
        const slot = root?.querySelector("#thermal-qr-slot");
        if (slot) {
          slot.innerHTML = "";
          try {
            new window.QRCode(slot, { text: opts.code || "TURBOALMACEN", width: 72, height: 72 });
          } catch (_) {}
        }
      });
    }

    document.getElementById("ticket-preview-modal")?.classList.remove("hidden");
  }

  window.closeTicketPreview = function () {
    document.getElementById("ticket-preview-modal")?.classList.add("hidden");
  };

  window.triggerThermalPrint = function () {
    window.print();
  };

  window.printThermalLabels = async function () {
    const prodId = String(document.getElementById("label-product-select")?.value || "");
    const copies = Math.min(50, Math.max(1, Number(document.getElementById("label-copies-input")?.value || 4)));
    const useUnits = document.getElementById("label-use-units")?.checked;
    const prod = almProducts.find((p) => String(p.id) === prodId);
    if (!prod) {
      showToast("Selecciona un producto para imprimir etiquetas", "warn");
      return;
    }

    const availUnits = Array.isArray(prod.itemUnits) ? prod.itemUnits.filter((u) => u.status === "disponible") : [];
    const labels = [];
    for (let i = 0; i < copies; i++) {
      const u = useUnits && availUnits[i] ? availUnits[i] : null;
      labels.push({
        title: prod.name,
        code: u ? u.sku : prod.barcode || prod.sku,
        loc: prod.location || "ALMACÉN",
      });
    }

    const html = labels
      .map(
        (lb, i) => `
      <div class="thermal-label-item" style="border:1px dashed #000;padding:5px;margin-bottom:6px;text-align:center;">
        <div style="font-weight:800;font-size:10px;line-height:1.2;">${esc(lb.title)}</div>
        <div class="lbl-qr-${i}" style="display:flex;justify-content:center;margin:4px 0;"></div>
        <div style="font-weight:700;font-size:11px;letter-spacing:0.5px;">${esc(lb.code)}</div>
        <div style="font-size:9px;">📍 ${esc(lb.loc)}</div>
      </div>`
      )
      .join("");

    const printArea = document.getElementById("thermal-print-area");
    const previewPaper = document.getElementById("ticket-preview-paper");
    if (printArea) {
      printArea.className = paperWidth === "58" ? "paper-58" : "";
      printArea.innerHTML = html;
    }
    if (previewPaper) {
      previewPaper.style.width = paperWidth === "58" ? "220px" : "290px";
      previewPaper.innerHTML = html;
    }

    if (typeof window.QRCode === "function") {
      labels.forEach((lb, i) => {
        [printArea, previewPaper].forEach((root) => {
          const slot = root?.querySelector(`.lbl-qr-${i}`);
          if (slot) {
            try {
              new window.QRCode(slot, { text: lb.code, width: 64, height: 64 });
            } catch (_) {}
          }
        });
      });
    }

    fetch("/api/inventory/products/mark-barcodes-printed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productIds: [Number(prod.id) || prod.id] }),
    }).catch(() => {});

    document.getElementById("ticket-preview-modal")?.classList.remove("hidden");
  };

  document.addEventListener("DOMContentLoaded", bootstrapAlmacen);
})();
