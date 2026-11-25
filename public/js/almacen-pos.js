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
  let almProducts = [];
  let almCategories = [];
  let almEmployees = [];
  let almAssignments = [];
  let almRequests = [];
  let almNodes = [];
  let almSelectedNodeStock = [];

  let activeTab = "dispatch";
  let dispatchFilter = "all";
  let eppFilter = "all";
  let liveSearchTerm = "";
  let requestsExpanded = true;
  let mobileCartOpen = false;

  // Canastas POS
  let dispatchCart = []; // [{ key, productId, name, sku, type, unitOfMeasure, quantity, maxStock, itemUnitId, unitSku, variantName, image }]
  let purchaseCart = []; // [{ productId, name, sku, quantity, unitCost }]

  // Preferencias locales
  let beepEnabled = localStorage.getItem("turboalmacen_beep") !== "off";
  let paperWidth = localStorage.getItem("turboalmacen_paper") || "80"; // "80" | "58"
  let catalogViewMode = localStorage.getItem("turboalmacen_view_mode") || "grid"; // "grid" | "list"

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
    syncCatalogViewButtons();
  }

  function syncCatalogViewButtons() {
    const btnGrid = document.getElementById("btn-view-grid");
    const btnList = document.getElementById("btn-view-list");
    const isGrid = catalogViewMode === "grid";
    if (btnGrid) {
      btnGrid.className = isGrid
        ? "pos-press px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600 text-white flex items-center gap-1"
        : "pos-press px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1";
    }
    if (btnList) {
      btnList.className = !isGrid
        ? "pos-press px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600 text-white flex items-center gap-1"
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
  // INICIALIZACIÓN Y CARGA DE DATOS
  // =========================================================================
  async function bootstrapAlmacen() {
    syncHeaderControls();
    initCartSheetGestures();

    const dateInput = document.getElementById("purch-date");
    if (dateInput && !dateInput.value) {
      dateInput.value = new Date().toISOString().split("T")[0];
    }

    try {
      const saved = localStorage.getItem("turbonetwork_session");
      if (saved) almUser = JSON.parse(saved);
    } catch (_) {}

    if (!almUser) {
      redirectToUnifiedLogin(false);
      return;
    }

    const userLabel = document.getElementById("alm-user-label");
    if (userLabel) {
      userLabel.textContent = `${almUser.name || "Almacenero"} • ${localStorage.getItem("turbonetwork_active_tenant") || "turbonetwork"}`;
    }

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
    switchAlmacenTab(activeTab);
    focusGlobalScanner();
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

  window.refreshAllWarehouseData = async function (showFeedback) {
    const icon = document.getElementById("alm-refresh-icon");
    if (icon) icon.classList.add("animate-spin");
    try {
      const [prodRes, catRes, empRes, asgRes, reqRes, assetRes] = await Promise.all([
        fetch("/api/inventory/products").then((r) => r.json()).catch(() => ({ data: [] })),
        fetch("/api/inventory/categories").then((r) => r.json()).catch(() => ({ data: [] })),
        fetch("/api/rrhh/employees").then((r) => r.json()).catch(() => ({ data: [] })),
        fetch("/api/inventory/personnel-assignments").then((r) => r.json()).catch(() => ({ data: [] })),
        fetch("/api/apartados/material-requests").then((r) => r.json()).catch(() => ({ data: [] })),
        fetch("/api/inventory/assets").then((r) => r.json()).catch(() => ({ data: [] })),
      ]);

      almProducts = Array.isArray(prodRes.data) ? prodRes.data : [];
      almCategories = Array.isArray(catRes.data) ? catRes.data : [];
      almEmployees = Array.isArray(empRes.data) ? empRes.data : [];
      almAssignments = Array.isArray(asgRes.data) ? asgRes.data : [];
      almRequests = Array.isArray(reqRes.data) ? reqRes.data : [];
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
      renderReturnsList();
      renderPurchaseProductPicker();
      renderPurchaseCart();
      renderTechTransferList();
      renderEppModule();

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
    const nodeProd = document.getElementById("tr-node-product");
    if (nodeProd) nodeProd.innerHTML = prodOpts || `<option value="">Sin productos</option>`;

    const labelProd = document.getElementById("label-product-select");
    if (labelProd) labelProd.innerHTML = prodOpts || `<option value="">Sin productos</option>`;
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
      btn.classList.toggle("bg-emerald-500/15", isAct);
      btn.classList.toggle("text-emerald-600", isAct);
      btn.classList.toggle("dark:text-emerald-400", isAct);
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
    const q = code.trim();
    if (!q) return;

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
          ((a.unitSku && a.unitSku.toLowerCase() === qLow) ||
            (a.productSku && a.productSku.toLowerCase() === qLow) ||
            (a.itemUnitId && a.itemUnitId.toLowerCase() === qLow))
      );
      if (activeAsg) {
        playBeep("ok");
        const rInp = document.getElementById("returns-search-input");
        if (rInp) rInp.value = q;
        renderReturnsList();
        showToast(`Encontrado para devolución: ${activeAsg.productName} (${activeAsg.employeeName})`, "success");
      } else {
        playBeep("error");
        showToast(`No se halló asignación activa con código "${q}"`, "warn");
      }
      return;
    }

    const match = findProductOrUnitByCode(q);
    if (!match) {
      playBeep("error");
      showToast(`Código "${q}" no encontrado en catálogo`, "error");
      return;
    }

    if (activeTab === "purchases") {
      playBeep("ok");
      addProductToPurchaseCart(match.product.id);
      return;
    }

    if (activeTab === "dispatch" || activeTab === "epp") {
      if (match.unit && match.unit.status !== "disponible") {
        playBeep("error");
        showToast(`Unidad ${match.unit.sku} ya figura como "${match.unit.status}"`, "warn");
        return;
      }
      if (activeTab === "epp") switchAlmacenTab("dispatch");
      addToDispatchCart(match.product.id, 1, match.unit || null);
      playBeep("ok");
      return;
    }

    playBeep("ok");
    switchAlmacenTab("verify");
    await runVerifierLookup(q);
  }

  let wedgeBuffer = "";
  let wedgeTimer = null;
  document.addEventListener("keydown", function (e) {
    const tag = (document.activeElement?.tagName || "").toUpperCase();
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;

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
    if (dispEmp && req.techId) {
      dispEmp.value = String(req.techId);
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
      b.classList.toggle("bg-emerald-600", act);
      b.classList.toggle("text-white", act);
      b.classList.toggle("shadow-sm", act);
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
      const pid = Number(item.productId);
      cartQtyByProd.set(pid, (cartQtyByProd.get(pid) || 0) + Number(item.quantity || 0));
    }

    grid.innerHTML = filtered
      .map((p) => {
        const stock = Number(p.stock || 0);
        const isCritical = stock <= Number(p.stockCritical || 2);
        const isLow = stock <= Number(p.stockMin || 5);
        const stockBadge = isCritical
          ? "alm-badge-crit"
          : isLow
          ? "alm-badge-warn"
          : "alm-badge-ok";
        const img = Array.isArray(p.images) && p.images[0] ? p.images[0] : "";
        const unitLabel = p.type === "bulk" ? p.unitOfMeasure || "m" : "und";
        const inCartQty = cartQtyByProd.get(Number(p.id)) || 0;
        const typeTag = p.type === "bulk" ? "GRANEL" : p.type === "epp" ? "EPP" : "EQUIPO";

        const quickBulkBtns =
          p.type === "bulk"
            ? `<div class="grid grid-cols-3 gap-1 mt-2">
                <button type="button" onclick="event.stopPropagation(); addToDispatchCart(${p.id}, 10)" class="pos-press alm-bulk-btn py-1 rounded-lg text-[10px] font-mono font-bold">+10</button>
                <button type="button" onclick="event.stopPropagation(); addToDispatchCart(${p.id}, 50)" class="pos-press alm-bulk-btn py-1 rounded-lg text-[10px] font-mono font-bold">+50</button>
                <button type="button" onclick="event.stopPropagation(); addToDispatchCart(${p.id}, 100)" class="pos-press alm-bulk-btn py-1 rounded-lg text-[10px] font-mono font-bold">+100</button>
              </div>`
            : "";

        // Control táctil directo en la tarjeta (Stepper si ya está en canasta, o botón + Agregar siempre visible)
        const actionControl =
          inCartQty > 0
            ? `<div onclick="event.stopPropagation()" class="inline-flex items-center rounded-xl bg-emerald-600 text-white p-0.5 shadow-sm">
                <button type="button" onclick="adjustProductCartQty(${p.id}, -1)" aria-label="Restar" class="pos-press w-6 h-6 rounded-lg hover:bg-black/15 font-extrabold text-xs flex items-center justify-center">−</button>
                <span class="px-2 font-mono text-[11px] font-extrabold tabular-nums">${inCartQty}</span>
                <button type="button" onclick="adjustProductCartQty(${p.id}, 1)" aria-label="Sumar" class="pos-press w-6 h-6 rounded-lg hover:bg-black/15 font-extrabold text-xs flex items-center justify-center">+</button>
              </div>`
            : `<button type="button" onclick="event.stopPropagation(); addToDispatchCart(${p.id}, 1)" class="pos-press px-2.5 py-1 rounded-xl bg-emerald-500/12 hover:bg-emerald-600 text-emerald-600 dark:text-emerald-400 hover:text-white border border-emerald-500/25 text-[11px] font-bold flex items-center gap-1 flex-shrink-0">
                <span>+ Agregar</span>
              </button>`;

        if (isList) {
          return `
          <div onclick="addToDispatchCart(${p.id}, 1)" class="pos-card ${inCartQty > 0 ? "in-cart" : ""} cursor-pointer rounded-2xl p-3 flex items-center justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0 flex-1">
              ${
                img
                  ? `<div class="w-12 h-12 rounded-xl bg-slate-100 dark:bg-black/30 overflow-hidden flex-shrink-0 flex items-center justify-center"><img src="${esc(img)}" alt="${esc(p.name)}" class="w-full h-full object-cover" loading="lazy"></div>`
                  : `<div class="alm-icon-chip w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center">${getProductTypeIcon(p.type)}</div>`
              }
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${stockBadge}">${stock} ${esc(unitLabel)}</span>
                  <span class="text-[10px] font-mono text-slate-400">${esc(p.sku)}</span>
                  <span class="text-[10px] font-mono text-slate-400 uppercase">• ${esc(p.location || typeTag)}</span>
                </div>
                <div class="text-xs font-bold text-slate-900 dark:text-slate-100 leading-snug mt-1 line-clamp-2">${esc(p.name)}</div>
              </div>
            </div>
            <div class="flex flex-col items-end gap-1.5 flex-shrink-0">
              ${actionControl}
              ${
                p.type === "bulk"
                  ? `<div class="flex items-center gap-1">
                      <button type="button" onclick="event.stopPropagation(); addToDispatchCart(${p.id}, 10)" class="pos-press alm-bulk-btn px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold">+10</button>
                      <button type="button" onclick="event.stopPropagation(); addToDispatchCart(${p.id}, 50)" class="pos-press alm-bulk-btn px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold">+50</button>
                      <button type="button" onclick="event.stopPropagation(); addToDispatchCart(${p.id}, 100)" class="pos-press alm-bulk-btn px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold">+100</button>
                    </div>`
                  : ""
              }
            </div>
          </div>`;
        }

        return `
        <div onclick="addToDispatchCart(${p.id}, 1)" class="pos-card ${inCartQty > 0 ? "in-cart" : ""} cursor-pointer rounded-2xl p-3 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between gap-1.5 mb-2">
              <span class="px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-mono font-bold ${stockBadge}">${stock} ${esc(unitLabel)}</span>
              <span class="text-[10px] font-mono font-medium text-slate-400 uppercase tracking-wide truncate">${esc(p.location || typeTag)}</span>
            </div>
            ${
              img
                ? `<div class="w-full h-20 sm:h-24 rounded-xl bg-slate-100 dark:bg-black/30 mb-2.5 overflow-hidden flex items-center justify-center"><img src="${esc(img)}" alt="${esc(p.name)}" class="pos-card-img w-full h-full object-cover" loading="lazy"></div>`
                : `<div class="alm-icon-chip w-9 h-9 rounded-xl mb-2.5 flex items-center justify-center">${getProductTypeIcon(p.type)}</div>`
            }
            <div class="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug tracking-tight">${esc(p.name)}</div>
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
    const idx = dispatchCart.findIndex((it) => Number(it.productId) === Number(productId));
    if (idx === -1) {
      if (delta > 0) window.addToDispatchCart(productId, delta);
      return;
    }
    window.updateCartQty(idx, delta);
  };

  window.addToDispatchCart = function (productId, qty, specificUnit) {
    const prod = almProducts.find((p) => Number(p.id) === Number(productId));
    if (!prod) return;
    if (Number(prod.stock || 0) <= 0) {
      playBeep("error");
      showToast(`Sin stock disponible para ${prod.name}`, "error");
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
      if (existing.quantity + quantity > Number(prod.stock || 0)) {
        playBeep("error");
        showToast(`Stock máximo alcanzado (${prod.stock})`, "warn");
        return;
      }
      existing.quantity += quantity;
    } else {
      const cappedQty = Math.min(quantity, Number(prod.stock || 0));
      const availableUnits = Array.isArray(prod.itemUnits) ? prod.itemUnits.filter((u) => u.status === "disponible") : [];
      const firstVariant = Array.isArray(prod.variants) && prod.variants.length > 0 ? prod.variants[0].name : "";
      dispatchCart.push({
        key: unitKey,
        productId: prod.id,
        name: prod.name,
        sku: prod.sku,
        type: prod.type,
        unitOfMeasure: prod.unitOfMeasure || "und",
        quantity: cappedQty,
        maxStock: Number(prod.stock || 0),
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
    renderDispatchCart();
    renderDispatchCatalog();
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
      if (iconPill) iconPill.className = "w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center flex-shrink-0";
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
        subEl.className = "text-[11px] text-emerald-100 truncate";
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
    const notes = document.getElementById("dispatch-notes-input")?.value?.trim() || "Despacho rápido desde TurboAlmacén POS";
    const autoPrint = document.getElementById("dispatch-auto-print")?.checked;

    const btn = document.getElementById("btn-confirm-dispatch");
    if (btn) btn.disabled = true;

    try {
      const payload = {
        employeeId,
        employeeName,
        personnelName: employeeName,
        assignedAt: new Date().toISOString(),
        items: dispatchCart.map((it) => ({
          productId: Number(it.productId),
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
      showToast(`✅ Despacho confirmado para ${employeeName}`, "success");

      const ticketItems = dispatchCart.map((it) => ({
        name: it.name,
        code: it.unitSku || it.sku,
        qty: `${it.quantity} ${it.type === "bulk" ? it.unitOfMeasure : "und"}`,
        extra: it.variantName ? `Talla/Var: ${it.variantName}` : "",
      }));

      dispatchCart = [];
      if (document.getElementById("dispatch-notes-input")) document.getElementById("dispatch-notes-input").value = "";
      if (mobileCartOpen) window.closeMobileCart();
      await refreshAllWarehouseData(false);

      if (autoPrint) {
        openThermalTicket({
          title: "VALE DE DESPACHO DE ALMACÉN",
          code: `DESP-${Date.now().toString().slice(-6)}`,
          targetLabel: "ENTREGADO A",
          targetName: employeeName,
          notes,
          items: ticketItems,
        });
      }
    } catch (err) {
      playBeep("error");
      showToast(err.message || "Error en despacho", "error");
    } finally {
      if (btn) btn.disabled = dispatchCart.length === 0;
    }
  };

  // =========================================================================
  // MÓDULO 2: DEVOLUCIONES EXPRESS
  // =========================================================================
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

    container.innerHTML = active
      .map(
        (a) => `
      <div class="alm-surface rounded-2xl p-4 space-y-3">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="text-xs font-bold text-slate-900 dark:text-white truncate">${esc(a.productName || "Material")}</div>
            <div class="text-[11px] font-mono text-emerald-500 mt-0.5">${esc(a.unitSku || a.productSku || "")} • Cant: ${a.quantity}</div>
            <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">${esc(a.employeeName || a.personnelName || "Técnico")}</div>
          </div>
          <span class="alm-badge-sky px-2 py-0.5 rounded-md text-[10px] font-mono font-bold">${esc(a.status)}</span>
        </div>
        <div class="flex items-center gap-1.5">
          <select id="ret-cond-${esc(a.id)}" class="alm-input flex-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold">
            <option value="buen_estado">Buen estado (reingresa)</option>
            <option value="observacion">Con observación</option>
            <option value="danado">Dañado / Baja</option>
          </select>
          <button type="button" onclick="processReturnAssignment('${esc(a.id)}')" class="pos-press px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs">
            Devolver
          </button>
        </div>
      </div>`
      )
      .join("");
  };

  window.processReturnAssignment = async function (assignmentId) {
    const asg = almAssignments.find((a) => String(a.id) === String(assignmentId));
    if (!asg) return;
    const condition = document.getElementById(`ret-cond-${assignmentId}`)?.value || "buen_estado";
    try {
      const res = await fetch(`/api/inventory/personnel-assignments/${encodeURIComponent(assignmentId)}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          condition,
          notes: `Devolución POS (${condition}) recibida por ${almUser?.name || "Almacén"}`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Error al devolver");

      playBeep("ok");
      showToast(`↩️ Devuelto: ${asg.productName}`, "success");
      await refreshAllWarehouseData(false);

      openThermalTicket({
        title: "CONSTANCIA DE DEVOLUCIÓN",
        code: `DEV-${Date.now().toString().slice(-6)}`,
        targetLabel: "DEVUELTO POR",
        targetName: asg.employeeName || asg.personnelName || "Técnico",
        notes: `Condición: ${condition.replace("_", " ").toUpperCase()}`,
        items: [{ name: asg.productName, code: asg.unitSku || asg.productSku || "", qty: `${asg.quantity} und` }],
      });
    } catch (err) {
      playBeep("error");
      showToast(err.message || "Error registrando devolución", "error");
    }
  };

  // =========================================================================
  // MÓDULO 3: INGRESO DE COMPRAS
  // =========================================================================
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
      <div onclick="addProductToPurchaseCart(${p.id})" class="pos-card cursor-pointer rounded-xl p-3 flex items-center justify-between gap-2">
        <div class="min-w-0">
          <div class="text-xs font-bold text-slate-900 dark:text-white truncate">${esc(p.name)}</div>
          <div class="text-[10px] font-mono text-slate-400 mt-0.5">${esc(p.sku)} • Stock: ${p.stock}</div>
        </div>
        <span class="alm-badge-sky px-2.5 py-1 rounded-lg font-semibold text-xs flex-shrink-0">+ Agregar</span>
      </div>`
      )
      .join("");
  };

  window.addProductToPurchaseCart = function (productId) {
    const prod = almProducts.find((p) => Number(p.id) === Number(productId));
    if (!prod) return;
    const existing = purchaseCart.find((i) => Number(i.productId) === Number(productId));
    if (existing) {
      existing.quantity += 1;
    } else {
      purchaseCart.push({
        productId: prod.id,
        name: prod.name,
        sku: prod.sku,
        quantity: 1,
        unitCost: Number(prod.baseCost || 0),
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
    const total = purchaseCart.reduce((acc, i) => acc + i.quantity * i.unitCost, 0);
    const el = document.getElementById("purchase-total-amount");
    if (el) el.textContent = `S/ ${total.toFixed(2)}`;
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
      .map(
        (it, idx) => `
      <div class="alm-surface-inset rounded-xl p-2.5 space-y-2">
        <div class="flex items-center justify-between gap-2">
          <div class="text-xs font-bold truncate">${esc(it.name)}</div>
          <button type="button" onclick="removePurchaseLine(${idx})" class="text-rose-500 text-xs font-bold px-1">✕</button>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-[10px] text-slate-400">Cantidad</label>
            <input type="number" min="1" value="${it.quantity}" oninput="updatePurchaseLine(${idx}, 'quantity', this.value)" class="alm-input w-full px-2.5 py-1 rounded-lg text-xs font-mono font-bold" />
          </div>
          <div>
            <label class="text-[10px] text-slate-400">Costo Unit. (S/)</label>
            <input type="number" min="0" step="0.01" value="${it.unitCost}" oninput="updatePurchaseLine(${idx}, 'unitCost', this.value)" class="alm-input w-full px-2.5 py-1 rounded-lg text-xs font-mono font-bold" />
          </div>
        </div>
      </div>`
      )
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
    const notes = document.getElementById("purch-notes")?.value?.trim() || "Ingreso desde TurboAlmacén POS";
    const autoPrint = document.getElementById("purchase-auto-print")?.checked;

    if (!supplier || !invoiceNumber) {
      playBeep("error");
      showToast("Ingresa el Proveedor y el N° de Factura / Guía", "warn");
      return;
    }

    try {
      for (const line of purchaseCart) {
        if (line.quantity <= 0) continue;
        const res = await fetch("/api/inventory/purchases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: Number(line.productId),
            supplier,
            invoiceNumber,
            purchaseDate,
            quantity: Number(line.quantity),
            unitCost: Number(line.unitCost),
            notes,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || `Error ingresando ${line.name}`);
      }

      const ticketItems = purchaseCart.map((i) => ({
        name: i.name,
        code: i.sku,
        qty: `${i.quantity} x S/${i.unitCost.toFixed(2)}`,
      }));
      const total = purchaseCart.reduce((acc, i) => acc + i.quantity * i.unitCost, 0);

      playBeep("ok");
      showToast(`📥 Compra ${invoiceNumber} ingresada al Kardex`, "success");
      purchaseCart = [];
      await refreshAllWarehouseData(false);

      if (autoPrint) {
        openThermalTicket({
          title: "CONSTANCIA DE INGRESO / COMPRA",
          code: invoiceNumber,
          targetLabel: "PROVEEDOR",
          targetName: supplier,
          notes: `Total: S/ ${total.toFixed(2)} • ${notes}`,
          items: ticketItems,
        });
      }
    } catch (err) {
      playBeep("error");
      showToast(err.message || "Error registrando compra", "error");
    }
  };

  // =========================================================================
  // MÓDULO 4: TRANSFERENCIAS (TÉCNICO ↔ TÉCNICO Y ALMACÉN ↔ NODOS)
  // =========================================================================
  window.switchTransferSubMode = function (mode) {
    document.getElementById("transfer-sub-tech")?.classList.toggle("hidden", mode !== "tech");
    document.getElementById("transfer-sub-node")?.classList.toggle("hidden", mode !== "node");
    const bTech = document.getElementById("btn-tr-tech");
    const bNode = document.getElementById("btn-tr-node");
    if (bTech) bTech.className = mode === "tech" ? "pos-press px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white" : "pos-press px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 dark:text-slate-300";
    if (bNode) bNode.className = mode === "node" ? "pos-press px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white" : "pos-press px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 dark:text-slate-300";
    if (mode === "node") loadSelectedNodeStock();
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
          <div class="text-[11px] font-mono text-emerald-500 mt-0.5">${esc(a.unitSku || a.productSku || "")} • Cant: ${a.quantity}</div>
          <div class="text-[11px] text-slate-500 dark:text-slate-400 truncate">Actual: ${esc(a.employeeName || a.personnelName)}</div>
        </div>
        <button type="button" onclick="executeTechTransfer('${esc(a.id)}')" class="pos-press px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex-shrink-0">
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
  // MÓDULO 5: CONTROL DE EPP (SEMÁFORO DE VIGENCIAS E INSPECCIÓN)
  // =========================================================================
  window.setEppFilter = function (f) {
    eppFilter = f;
    document.querySelectorAll(".eppfilter-btn").forEach((b) => {
      const act = b.getAttribute("data-eppfilter") === f;
      b.className = act
        ? "eppfilter-btn px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 text-white"
        : "eppfilter-btn alm-surface px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300";
    });
    renderEppModule();
  };

  function getEppTrafficLight(product, unit) {
    const exp = unit?.expirationDate || product.expirationDate;
    const cond = unit?.conditionStatus || "optimo";
    if (cond === "requiere_cambio" || cond === "baja") return { level: "expired", label: "Requiere Cambio", badge: "bg-rose-500/15 text-rose-500" };
    if (exp) {
      const diffDays = Math.ceil((new Date(exp).getTime() - Date.now()) / 86400000);
      if (diffDays <= 0) return { level: "expired", label: `Vencido (${Math.abs(diffDays)}d)`, badge: "bg-rose-500/15 text-rose-500" };
      if (diffDays <= (product.alertBeforeDays || 30)) return { level: "soon", label: `Vence en ${diffDays}d`, badge: "bg-amber-500/15 text-amber-500" };
    }
    return { level: "ok", label: "Óptimo / Vigente", badge: "bg-emerald-500/15 text-emerald-500" };
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
            ${unit?.assignedTo ? `<div class="text-[11px] text-sky-500 mt-0.5">Asignado a: ${esc(unit.assignedTo)}</div>` : ""}
          </div>
          <span class="px-2 py-0.5 rounded-md text-[10px] font-bold flex-shrink-0 ${status.badge}">${esc(status.label)}</span>
        </div>
        <div class="flex items-center gap-2 pt-1">
          <button type="button" onclick="addToDispatchCart(${product.id}, 1); switchAlmacenTab('dispatch');" class="pos-press alm-badge-ok flex-1 py-1.5 rounded-lg text-[11px] font-semibold">
            Despachar
          </button>
          ${
            unit
              ? `<button type="button" onclick="openEppInspectModal(${product.id}, '${esc(unit.id)}')" class="pos-press alm-bulk-btn flex-1 py-1.5 rounded-lg text-[11px] font-semibold">
                  Inspeccionar
                </button>`
              : ""
          }
        </div>
      </div>`
      )
      .join("");
  }

  window.openEppInspectModal = function (productId, unitId) {
    const prod = almProducts.find((p) => Number(p.id) === Number(productId));
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
      <div class="flex gap-2 pt-2">
        <button type="button" onclick="closeEppModal()" class="pos-press flex-1 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-bold">Cancelar</button>
        <button type="button" onclick="saveEppInspection(${productId}, '${esc(unitId)}')" class="pos-press flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-extrabold">Guardar Inspección</button>
      </div>
    `;
    document.getElementById("epp-inspect-modal").classList.remove("hidden");
  };

  window.closeEppModal = function () {
    document.getElementById("epp-inspect-modal")?.classList.add("hidden");
  };

  window.saveEppInspection = async function (productId, unitId) {
    const prod = almProducts.find((p) => Number(p.id) === Number(productId));
    if (!prod || !Array.isArray(prod.itemUnits)) return;

    const conditionStatus = document.getElementById("epp-cond-sel")?.value || "optimo";
    const expirationDate = document.getElementById("epp-exp-input")?.value || null;
    const notes = document.getElementById("epp-note-input")?.value?.trim() || "";
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
        body: JSON.stringify({ itemUnits: updatedUnits }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Error actualizando EPP");

      closeEppModal();
      playBeep("ok");
      showToast("Inspección de EPP guardada", "success");
      await refreshAllWarehouseData(false);
    } catch (err) {
      showToast(err.message || "Error guardando inspección", "error");
    }
  };

  // =========================================================================
  // MÓDULO 6: VERIFICADOR TIPO METRO & ETIQUETAS TÉRMICAS
  // =========================================================================
  async function runVerifierLookup(query) {
    const box = document.getElementById("verify-result-box");
    if (!box) return;
    box.innerHTML = `<div class="py-8 text-xs font-mono text-cyan-500">Consultando trazabilidad para "${esc(query)}"...</div>`;

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
      box.innerHTML = `<div class="py-8 text-rose-500 font-bold text-sm">❌ No se encontró ningún producto ni unidad con "${esc(query)}"</div>`;
      return;
    }

    const unit = localMatch?.unit;
    const activeAsg = almAssignments.filter(
      (a) => Number(a.productId) === Number(prod.id) && (a.status === "en_uso" || a.status === "entregado")
    );

    box.className = "alm-surface-inset rounded-xl border border-emerald-500/35 p-5 text-left space-y-4";
    box.innerHTML = `
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span class="alm-badge-ok px-2 py-0.5 rounded-md text-[10px] font-mono font-bold">${esc(prod.sku)}</span>
          <h3 class="text-base font-bold text-slate-900 dark:text-white mt-1.5">${esc(prod.name)}</h3>
          <div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Ubicación: <strong class="text-slate-800 dark:text-slate-200">${esc(prod.location || "Almacén Central")}</strong></div>
        </div>
        <div class="text-right">
          <div class="text-[10px] uppercase font-bold tracking-wider text-slate-400">Stock Disponible</div>
          <div class="text-3xl font-extrabold font-mono text-emerald-500">${prod.stock} <span class="text-xs font-semibold">${esc(prod.type === "bulk" ? prod.unitOfMeasure || "m" : "und")}</span></div>
        </div>
      </div>
      ${
        unit
          ? `<div class="p-3 rounded-xl bg-sky-500/10 border border-sky-500/25 text-xs font-mono">
              Unidad escaneada: <b>${esc(unit.sku)}</b> • Estado: <b>${esc(unit.status)}</b> ${unit.assignedTo ? `• Asignado a: <b>${esc(unit.assignedTo)}</b>` : ""}
            </div>`
          : ""
      }
      <div class="flex flex-wrap gap-2">
        <button type="button" onclick="addToDispatchCart(${prod.id}, 1); switchAlmacenTab('dispatch');" class="pos-press px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">Enviar a Despacho</button>
        <button type="button" onclick="document.getElementById('label-product-select').value='${prod.id}'; printThermalLabels();" class="pos-press px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold">Imprimir Etiquetas</button>
      </div>
      ${
        activeAsg.length > 0
          ? `<div class="pt-3 border-t border-slate-200/70 dark:border-white/10">
              <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">En manos de técnicos (${activeAsg.length})</div>
              <div class="space-y-1">
                ${activeAsg.slice(0, 6).map((a) => `<div class="text-xs flex justify-between"><span>${esc(a.employeeName)}</span><span class="font-mono text-slate-400">${esc(a.unitSku || "x" + a.quantity)}</span></div>`).join("")}
              </div>
            </div>`
          : ""
      }
    `;
  }

  // =========================================================================
  // MOTOR DE IMPRESIÓN TÉRMICA (58mm / 80mm): TICKETS Y ETIQUETAS
  // =========================================================================
  function openThermalTicket(opts) {
    const nowStr = new Date().toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
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

    const ticketHtml = `
      <div style="text-align:center;margin-bottom:6px;">
        <img src="/logo_thermal_turbo.png" alt="Logo" style="max-height:36px;margin:0 auto 4px;display:block;" onerror="this.style.display='none'" />
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
    const prodId = Number(document.getElementById("label-product-select")?.value || 0);
    const copies = Math.min(50, Math.max(1, Number(document.getElementById("label-copies-input")?.value || 4)));
    const useUnits = document.getElementById("label-use-units")?.checked;
    const prod = almProducts.find((p) => Number(p.id) === prodId);
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
      body: JSON.stringify({ productIds: [prod.id] }),
    }).catch(() => {});

    document.getElementById("ticket-preview-modal")?.classList.remove("hidden");
  };

  document.addEventListener("DOMContentLoaded", bootstrapAlmacen);
})();
