/* =========================================================================
 * TurboAlmacén POS • Terminal Rápida de Almacén (PC, Laptop y Móvil)
 * Estilo Caja Plaza Vea / Metro: Pistola láser, Cámara QR/Barras, Tickets 58/80mm
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

  // Canastas POS
  let dispatchCart = []; // [{ key, productId, name, sku, type, unitOfMeasure, quantity, maxStock, itemUnitId, unitSku, variantName, image }]
  let purchaseCart = []; // [{ productId, name, sku, quantity, unitCost }]

  // Preferencias locales
  let beepEnabled = localStorage.getItem("turboalmacen_beep") !== "off";
  let paperWidth = localStorage.getItem("turboalmacen_paper") || "80"; // "80" | "58"

  // PIN Login
  let almPinBuffer = "";
  let almPinSubmitting = false;

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
        // Beep agudo estilo caja de supermercado
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
    const colors = {
      success: "bg-emerald-600 text-white border-emerald-400/40",
      error: "bg-rose-600 text-white border-rose-400/40",
      warn: "bg-amber-500 text-slate-950 border-amber-300/60",
      info: "bg-slate-900 text-white border-white/15",
    };
    const el = document.createElement("div");
    el.className = `pointer-events-auto px-4 py-2.5 rounded-2xl border shadow-xl text-xs font-bold flex items-center gap-2 transition-all duration-200 ${colors[type || "info"]}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translateY(-6px)";
      setTimeout(() => el.remove(), 220);
    }, 3000);
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
  // CONTROLES DE HEADER (PAPEL, SONIDO, TEMA)
  // =========================================================================
  function syncHeaderControls() {
    const btnPaper = document.getElementById("btn-paper-width");
    if (btnPaper) btnPaper.textContent = `🖨️ ${paperWidth}mm`;
    const btnBeep = document.getElementById("btn-beep-toggle");
    if (btnBeep) {
      btnBeep.textContent = beepEnabled ? "🔊" : "🔇";
      btnBeep.classList.toggle("text-emerald-500", beepEnabled);
      btnBeep.classList.toggle("text-slate-400", !beepEnabled);
    }
  }

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
  // LOGIN PIN (MISMO FLUJO QUE TURBOTECH)
  // =========================================================================
  function updateAlmPinDots() {
    for (let i = 0; i < 8; i++) {
      const d = document.getElementById("adot-" + i);
      if (d) d.classList.toggle("active", i < almPinBuffer.length);
    }
  }

  window.almPressPin = function (digit) {
    if (almPinBuffer.length >= 8) return;
    almPinBuffer += digit;
    updateAlmPinDots();
    if (almPinBuffer.length === 8) submitAlmPinLogin();
  };

  window.almBackspacePin = function () {
    almPinBuffer = almPinBuffer.slice(0, -1);
    updateAlmPinDots();
  };

  window.almClearPin = function () {
    almPinBuffer = "";
    updateAlmPinDots();
    const fb = document.getElementById("alm-login-feedback");
    if (fb) fb.textContent = "";
  };

  async function submitAlmPinLogin() {
    if (almPinSubmitting) return;
    almPinSubmitting = true;
    const fb = document.getElementById("alm-login-feedback");
    if (fb) {
      fb.textContent = "Verificando acceso de almacén...";
      fb.className = "text-xs font-mono min-h-[20px] text-emerald-400 mb-4";
    }
    try {
      const res = await fetch("/api/auth/pin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: almPinBuffer }),
      });
      const data = await res.json().catch(() => ({ success: false, message: `Error (${res.status})` }));
      if (data.success && data.data?.user) {
        if (data.data.token) {
          const now = Date.now();
          localStorage.setItem(
            "turbonetwork_auth_meta",
            JSON.stringify({
              token: data.data.token,
              expiresAt: data.data.expiresAt || now + 8 * 3600 * 1000,
              lastActivityAt: now,
              idleTimeoutMs: data.data.idleTimeoutMs || 15 * 60 * 1000,
            })
          );
        }
        almUser = data.data.user;
        localStorage.setItem("turbonetwork_session", JSON.stringify(almUser));
        const tenant =
          almUser.assignedTenantId && almUser.assignedTenantId !== "*"
            ? almUser.assignedTenantId
            : Array.isArray(almUser.allowedTenants) && almUser.allowedTenants[0] && almUser.allowedTenants[0] !== "*"
            ? almUser.allowedTenants[0]
            : "turbonetwork";
        localStorage.setItem("turbonetwork_active_tenant", tenant);
        document.getElementById("alm-login-overlay").classList.add("hidden");
        almPinBuffer = "";
        updateAlmPinDots();
        await bootstrapAlmacen();
      } else {
        if (fb) {
          fb.textContent = data.message || "PIN inválido";
          fb.className = "text-xs font-mono min-h-[20px] text-rose-400 mb-4";
        }
        almPinBuffer = "";
        updateAlmPinDots();
      }
    } catch (_) {
      if (fb) {
        fb.textContent = "Error de conexión con el servidor";
        fb.className = "text-xs font-mono min-h-[20px] text-rose-400 mb-4";
      }
      almPinBuffer = "";
      updateAlmPinDots();
    } finally {
      almPinSubmitting = false;
    }
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
    almPinBuffer = "";
    updateAlmPinDots();
    document.getElementById("alm-login-overlay").classList.remove("hidden");
  };

  // =========================================================================
  // INICIALIZACIÓN Y CARGA DE DATOS
  // =========================================================================
  async function bootstrapAlmacen() {
    syncHeaderControls();
    const dateInput = document.getElementById("purch-date");
    if (dateInput && !dateInput.value) {
      dateInput.value = new Date().toISOString().split("T")[0];
    }

    try {
      const saved = localStorage.getItem("turbonetwork_session");
      if (saved) almUser = JSON.parse(saved);
    } catch (_) {}

    if (!almUser) {
      document.getElementById("alm-login-overlay").classList.remove("hidden");
      return;
    }

    const userLabel = document.getElementById("alm-user-label");
    if (userLabel) {
      userLabel.textContent = `${almUser.name || "Almacenero"} • ${localStorage.getItem("turbonetwork_active_tenant") || "turbonetwork"}`;
    }

    // Consultar configuración del Apartado Almacén
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
    // Categorías
    const catSel = document.getElementById("dispatch-category-select");
    if (catSel) {
      const prev = catSel.value;
      catSel.innerHTML =
        `<option value="">Todas las categorías (${almCategories.length})</option>` +
        almCategories.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");
      catSel.value = prev;
    }

    // Empleados / Técnicos
    const empOptions = almEmployees
      .map((e) => `<option value="${esc(e.id)}" data-name="${esc(getEmployeeDisplayName(e))}">${esc(getEmployeeDisplayName(e))}${e.position ? " • " + esc(e.position) : ""}</option>`)
      .join("");

    const dispEmp = document.getElementById("dispatch-employee-select");
    if (dispEmp) {
      const prev = dispEmp.value;
      dispEmp.innerHTML = `<option value="">— Seleccionar técnico / personal —</option>${empOptions}`;
      dispEmp.value = prev;
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

    // Nodos POP
    const nodeSel = document.getElementById("tr-node-select");
    if (nodeSel) {
      const prev = nodeSel.value;
      nodeSel.innerHTML =
        almNodes.length === 0
          ? `<option value="">No hay nodos POP registrados</option>`
          : almNodes.map((n) => `<option value="${esc(n.id)}">${esc(n.name || n.code || "Nodo #" + n.id)}</option>`).join("");
      if (prev) nodeSel.value = prev;
    }

    // Productos para nodos y etiquetas
    const prodOpts = almProducts
      .map((p) => `<option value="${esc(p.id)}">${esc(p.name)} [${esc(p.sku)}] — Stock: ${p.stock}</option>`)
      .join("");
    const nodeProd = document.getElementById("tr-node-product");
    if (nodeProd) nodeProd.innerHTML = prodOpts || `<option value="">Sin productos</option>`;

    const labelProd = document.getElementById("label-product-select");
    if (labelProd) labelProd.innerHTML = prodOpts || `<option value="">Sin productos</option>`;
  }

  // =========================================================================
  // NAVEGACIÓN ENTRE PESTAÑAS POS
  // =========================================================================
  window.switchAlmacenTab = function (tab) {
    activeTab = tab;
    document.querySelectorAll(".alm-panel").forEach((el) => el.classList.add("hidden"));
    const target = document.getElementById("panel-" + tab);
    if (target) target.classList.remove("hidden");

    // Desktop tabs styling
    document.querySelectorAll(".alm-tab-btn").forEach((btn) => {
      const isAct = btn.getAttribute("data-tab") === tab;
      btn.className = `alm-tab-btn px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition whitespace-nowrap ${
        isAct
          ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
          : "text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-white/10"
      }`;
    });

    // Mobile tabs styling
    document.querySelectorAll(".alm-mtab-btn").forEach((btn) => {
      const isAct = btn.getAttribute("data-mtab") === tab;
      btn.className = `alm-mtab-btn flex flex-col items-center py-1 rounded-xl text-[10px] font-bold transition ${
        isAct ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"
      }`;
    });

    // Botón flotante de canasta en móvil solo en Despacho
    const fab = document.getElementById("mobile-cart-fab");
    if (fab) fab.classList.toggle("hidden", tab !== "dispatch");

    if (tab === "transfers" && almNodes.length > 0) {
      loadSelectedNodeStock();
    }
  };

  window.scrollToMobileCart = function () {
    const cart = document.getElementById("dispatch-cart-panel");
    if (cart) cart.scrollIntoView({ behavior: "smooth", block: "start" });
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

    // 1. Buscar primero coincidencia exacta en unidades individuales (SKU, barcode o serial)
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

    // 2. Coincidencia exacta en producto (SKU o barcode)
    const exactProd = almProducts.find(
      (p) => (p.sku && p.sku.toLowerCase() === q) || (p.barcode && p.barcode.toLowerCase() === q)
    );
    if (exactProd) return { product: exactProd, unit: null };

    // 3. Coincidencia parcial única por nombre/SKU
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

    // Por defecto: abrir verificador
    playBeep("ok");
    switchAlmacenTab("verify");
    await runVerifierLookup(q);
  }

  // Captura global de pistola láser incluso si el foco no está en el input
  let wedgeBuffer = "";
  let wedgeTimer = null;
  document.addEventListener("keydown", function (e) {
    const loginOverlay = document.getElementById("alm-login-overlay");
    if (loginOverlay && !loginOverlay.classList.contains("hidden")) {
      if (/^[0-9]$/.test(e.key)) almPressPin(e.key);
      else if (e.key === "Backspace") almBackspacePin();
      return;
    }

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
          <button type="button" onclick="loadRequestIntoCart('${esc(r.id)}')" class="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold">Atender</button>
          <button type="button" onclick="resolveMaterialRequest('${esc(r.id)}', 'rechazado')" class="px-2 py-1.5 rounded-lg bg-rose-500/15 text-rose-500 text-[11px] font-bold">✕</button>
        </div>
      </div>`
      )
      .join("");
  }

  window.loadRequestIntoCart = async function (reqId) {
    const req = almRequests.find((r) => r.id === reqId);
    if (!req) return;

    // Seleccionar técnico si existe
    const dispEmp = document.getElementById("dispatch-employee-select");
    if (dispEmp && req.techId) {
      dispEmp.value = String(req.techId);
    }

    // Buscar producto
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
      b.className = act
        ? "dfilter-btn px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white shadow-sm"
        : "dfilter-btn px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300";
    });
    renderDispatchCatalog();
  };

  window.renderDispatchCatalog = function () {
    const grid = document.getElementById("dispatch-products-grid");
    if (!grid) return;

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

    if (filtered.length === 0) {
      grid.innerHTML = `<div class="col-span-full rounded-2xl bg-white dark:bg-[#0f182b] border border-dashed border-slate-300 dark:border-white/15 p-10 text-center text-xs text-slate-400">No hay productos que coincidan con el filtro actual.</div>`;
      return;
    }

    grid.innerHTML = filtered
      .map((p) => {
        const stock = Number(p.stock || 0);
        const isCritical = stock <= Number(p.stockCritical || 2);
        const isLow = stock <= Number(p.stockMin || 5);
        const stockBadge = isCritical
          ? "bg-rose-500/15 text-rose-500 border-rose-500/30"
          : isLow
          ? "bg-amber-500/15 text-amber-500 border-amber-500/30"
          : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
        const img = Array.isArray(p.images) && p.images[0] ? p.images[0] : "";
        const unitLabel = p.type === "bulk" ? p.unitOfMeasure || "m" : "und";

        const quickBulkBtns =
          p.type === "bulk"
            ? `<div class="grid grid-cols-3 gap-1 mt-2">
                <button type="button" onclick="event.stopPropagation(); addToDispatchCart(${p.id}, 10)" class="py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white text-[10px] font-mono font-bold transition">+10</button>
                <button type="button" onclick="event.stopPropagation(); addToDispatchCart(${p.id}, 50)" class="py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white text-[10px] font-mono font-bold transition">+50</button>
                <button type="button" onclick="event.stopPropagation(); addToDispatchCart(${p.id}, 100)" class="py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white text-[10px] font-mono font-bold transition">+100</button>
              </div>`
            : "";

        return `
        <div onclick="addToDispatchCart(${p.id}, 1)" class="pos-card cursor-pointer rounded-2xl bg-white dark:bg-[#0f182b] border border-slate-200 dark:border-white/10 hover:border-emerald-500/60 p-3 flex flex-col justify-between shadow-sm">
          <div>
            <div class="flex items-start justify-between gap-1.5 mb-2">
              <span class="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold border ${stockBadge}">${stock} ${esc(unitLabel)}</span>
              <span class="text-[10px] font-mono text-slate-400 truncate">${esc(p.location || p.type.toUpperCase())}</span>
            </div>
            ${
              img
                ? `<div class="w-full h-20 rounded-xl bg-slate-100 dark:bg-slate-900 mb-2 overflow-hidden flex items-center justify-center"><img src="${esc(img)}" class="w-full h-full object-cover" loading="lazy"></div>`
                : `<div class="w-full h-14 rounded-xl bg-slate-100 dark:bg-slate-900/80 mb-2 flex items-center justify-center text-2xl">${p.type === "bulk" ? "🧵" : p.type === "epp" ? "🦺" : "📦"}</div>`
            }
            <div class="text-xs font-extrabold text-slate-900 dark:text-white line-clamp-2 leading-snug">${esc(p.name)}</div>
            <div class="text-[10px] font-mono text-slate-400 mt-0.5 truncate">${esc(p.sku)}</div>
          </div>
          ${quickBulkBtns}
        </div>`;
      })
      .join("");
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
      // Si es producto con unidades individuales y no se escaneó una específica, ofrecer/asignar disponible
      const availableUnits = Array.isArray(prod.itemUnits) ? prod.itemUnits.filter((u) => u.status === "disponible") : [];
      const firstVariant = Array.isArray(prod.variants) && prod.variants.length > 0 ? prod.variants[0].name : "";
      dispatchCart.push({
        key: unitKey,
        productId: prod.id,
        name: prod.name,
        sku: prod.sku,
        type: prod.type,
        unitOfMeasure: prod.unitOfMeasure || "und",
        quantity,
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
      showToast(`Stock disponible: ${it.maxStock}`, "warn");
    }
    renderDispatchCart();
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
  };

  window.clearDispatchCart = function () {
    dispatchCart = [];
    renderDispatchCart();
  };

  function renderDispatchCart() {
    const box = document.getElementById("dispatch-cart-items");
    const totalBadge = document.getElementById("cart-total-badge");
    const mobileCount = document.getElementById("mobile-cart-count");
    const sub = document.getElementById("cart-summary-sub");
    const btnConfirm = document.getElementById("btn-confirm-dispatch");

    const totalItems = dispatchCart.reduce((acc, i) => acc + Number(i.quantity || 0), 0);
    if (totalBadge) totalBadge.textContent = `${dispatchCart.length} ítems`;
    if (mobileCount) mobileCount.textContent = dispatchCart.length;
    if (sub) sub.textContent = dispatchCart.length ? `${dispatchCart.length} líneas • ${totalItems} uds totales` : "Escanea o toca productos para agregar";
    if (btnConfirm) btnConfirm.disabled = dispatchCart.length === 0;

    if (!box) return;
    if (dispatchCart.length === 0) {
      box.innerHTML = `<div class="h-full flex flex-col items-center justify-center text-center py-10 text-slate-400 text-xs">
        <div class="text-3xl mb-2">🛒</div>
        <div class="font-bold">Canasta vacía</div>
        <div class="text-[11px] mt-0.5">Pasa la pistola láser o toca un producto</div>
      </div>`;
      return;
    }

    box.innerHTML = dispatchCart
      .map(
        (it, idx) => `
      <div class="rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 p-2.5 space-y-2">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="text-xs font-extrabold text-slate-900 dark:text-white truncate">${esc(it.name)}</div>
            <div class="text-[10px] font-mono text-slate-400">${esc(it.unitSku || it.sku)}</div>
          </div>
          <button type="button" onclick="removeCartItem(${idx})" class="text-rose-500 hover:bg-rose-500/10 rounded-lg px-1.5 py-0.5 text-xs font-bold">✕</button>
        </div>
        <div class="flex items-center justify-between gap-2">
          <div class="inline-flex items-center gap-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-white/10 p-0.5">
            <button type="button" onclick="updateCartQty(${idx}, -1)" class="w-7 h-7 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-sm">−</button>
            <span class="px-2 font-mono text-xs font-extrabold">${it.quantity}</span>
            <button type="button" onclick="updateCartQty(${idx}, 1)" class="w-7 h-7 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-sm">+</button>
          </div>
          ${
            it.variants && it.variants.length > 0
              ? `<select onchange="setCartItemVariant(${idx}, this.value)" class="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-[11px] font-semibold">
                  ${it.variants.map((v) => `<option value="${esc(v.name)}" ${v.name === it.variantName ? "selected" : ""}>${esc(v.name)}</option>`).join("")}
                </select>`
              : it.availableUnits && it.availableUnits.length > 0
              ? `<select onchange="setCartItemUnit(${idx}, this.value)" class="max-w-[155px] px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-[10px] font-mono">
                  <option value="">Unidad genérica</option>
                  ${it.availableUnits.slice(0, 40).map((u) => `<option value="${esc(u.id)}" ${u.id === it.itemUnitId ? "selected" : ""}>${esc(u.sku)}${u.serialNumber ? " / " + esc(u.serialNumber) : ""}</option>`).join("")}
                </select>`
              : `<span class="text-[10px] font-mono text-slate-400">Disp: ${it.maxStock}</span>`
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
      container.innerHTML = `<div class="col-span-full rounded-2xl bg-white dark:bg-[#0f182b] border border-dashed border-slate-300 dark:border-white/15 p-10 text-center text-xs text-slate-400">No hay asignaciones activas pendientes de devolución con este filtro.</div>`;
      return;
    }

    container.innerHTML = active
      .map(
        (a) => `
      <div class="rounded-2xl bg-white dark:bg-[#0f182b] border border-slate-200 dark:border-white/10 p-4 space-y-3 shadow-sm">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="text-xs font-extrabold text-slate-900 dark:text-white truncate">${esc(a.productName || "Material")}</div>
            <div class="text-[11px] font-mono text-emerald-500 mt-0.5">${esc(a.unitSku || a.productSku || "")} • Cant: ${a.quantity}</div>
            <div class="text-[11px] text-slate-500 mt-0.5">👷 ${esc(a.employeeName || a.personnelName || "Técnico")}</div>
          </div>
          <span class="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-blue-500/15 text-blue-500">${esc(a.status)}</span>
        </div>
        <div class="flex items-center gap-1.5">
          <select id="ret-cond-${esc(a.id)}" class="flex-1 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-[11px] font-semibold">
            <option value="buen_estado">✅ Buen estado (reingresa)</option>
            <option value="observacion">⚠️ Con observación</option>
            <option value="danado">❌ Dañado / Baja</option>
          </select>
          <button type="button" onclick="processReturnAssignment('${esc(a.id)}')" class="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs">
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
      <div onclick="addProductToPurchaseCart(${p.id})" class="pos-card cursor-pointer rounded-2xl bg-white dark:bg-[#0f182b] border border-slate-200 dark:border-white/10 hover:border-blue-500/60 p-3 flex items-center justify-between gap-2">
        <div class="min-w-0">
          <div class="text-xs font-extrabold text-slate-900 dark:text-white truncate">${esc(p.name)}</div>
          <div class="text-[10px] font-mono text-slate-400">${esc(p.sku)} • Stock actual: ${p.stock}</div>
        </div>
        <span class="px-2.5 py-1 rounded-xl bg-blue-500/15 text-blue-500 font-bold text-xs flex-shrink-0">+ Agregar</span>
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

  function updatePurchaseTotalUI() {
    const total = purchaseCart.reduce((acc, i) => acc + i.quantity * i.unitCost, 0);
    const el = document.getElementById("purchase-total-amount");
    if (el) el.textContent = `S/ ${total.toFixed(2)}`;
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
      <div class="rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 p-2.5 space-y-2">
        <div class="flex items-center justify-between gap-2">
          <div class="text-xs font-bold truncate">${esc(it.name)}</div>
          <button type="button" onclick="removePurchaseLine(${idx})" class="text-rose-500 text-xs font-bold">✕</button>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-[10px] text-slate-400">Cantidad</label>
            <input type="number" min="1" value="${it.quantity}" oninput="updatePurchaseLine(${idx}, 'quantity', this.value)" class="w-full px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs font-mono font-bold" />
          </div>
          <div>
            <label class="text-[10px] text-slate-400">Costo Unit. (S/)</label>
            <input type="number" min="0" step="0.01" value="${it.unitCost}" oninput="updatePurchaseLine(${idx}, 'unitCost', this.value)" class="w-full px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs font-mono font-bold" />
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
    if (bTech) bTech.className = mode === "tech" ? "px-3.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white" : "px-3.5 py-1.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300";
    if (bNode) bNode.className = mode === "node" ? "px-3.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white" : "px-3.5 py-1.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300";
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
      box.innerHTML = `<div class="col-span-full rounded-2xl bg-white dark:bg-[#0f182b] border border-dashed border-slate-300 dark:border-white/15 p-8 text-center text-xs text-slate-400">No hay materiales asignados para transferir.</div>`;
      return;
    }

    box.innerHTML = list
      .map(
        (a) => `
      <div class="rounded-2xl bg-white dark:bg-[#0f182b] border border-slate-200 dark:border-white/10 p-3.5 flex items-center justify-between gap-2">
        <div class="min-w-0">
          <div class="text-xs font-extrabold truncate">${esc(a.productName)}</div>
          <div class="text-[11px] font-mono text-indigo-500">${esc(a.unitSku || a.productSku || "")} • Cant: ${a.quantity}</div>
          <div class="text-[11px] text-slate-500 truncate">Actual: ${esc(a.employeeName || a.personnelName)}</div>
        </div>
        <button type="button" onclick="executeTechTransfer('${esc(a.id)}')" class="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex-shrink-0">
          Transferir ➜
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
        <div class="rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 p-3 flex items-center justify-between gap-2">
          <div class="min-w-0">
            <div class="text-xs font-bold truncate">${esc(item.productName || "Equipo")} <span class="font-mono text-indigo-500">x${item.quantity}</span></div>
            <div class="text-[10px] font-mono text-slate-400">${esc(item.rackLocation || "Sin rack")} ${item.serialNumber ? "• SN: " + esc(item.serialNumber) : ""}</div>
          </div>
          ${
            item.status !== "retornado"
              ? `<button type="button" onclick="returnFromSelectedNode('${esc(item.id)}')" class="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500 hover:text-slate-950 text-amber-500 text-[11px] font-bold transition">Retornar</button>`
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
        ? "eppfilter-btn px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-600 text-white"
        : "eppfilter-btn px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300";
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
      box.innerHTML = `<div class="col-span-full rounded-2xl bg-white dark:bg-[#0f182b] border border-dashed border-slate-300 dark:border-white/15 p-10 text-center text-xs text-slate-400">No hay registros de EPP en esta vista.</div>`;
      return;
    }

    box.innerHTML = cards
      .slice(0, 60)
      .map(
        ({ product, unit, status }) => `
      <div class="rounded-2xl bg-white dark:bg-[#0f182b] border border-slate-200 dark:border-white/10 p-4 space-y-2.5 shadow-sm">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="text-xs font-extrabold text-slate-900 dark:text-white truncate">🦺 ${esc(product.name)}</div>
            <div class="text-[11px] font-mono text-slate-400">${esc(unit ? unit.sku : product.sku)} • Stock: ${product.stock}</div>
            ${unit?.assignedTo ? `<div class="text-[11px] text-blue-500 mt-0.5">👷 Asignado a: ${esc(unit.assignedTo)}</div>` : ""}
          </div>
          <span class="px-2 py-0.5 rounded-lg text-[10px] font-bold flex-shrink-0 ${status.badge}">${esc(status.label)}</span>
        </div>
        <div class="flex items-center gap-2 pt-1">
          <button type="button" onclick="addToDispatchCart(${product.id}, 1); switchAlmacenTab('dispatch');" class="flex-1 py-1.5 rounded-xl bg-emerald-600/15 hover:bg-emerald-600 hover:text-white text-emerald-600 dark:text-emerald-400 text-[11px] font-bold transition">
            🛒 Despachar
          </button>
          ${
            unit
              ? `<button type="button" onclick="openEppInspectModal(${product.id}, '${esc(unit.id)}')" class="flex-1 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-600 hover:text-white text-slate-700 dark:text-slate-200 text-[11px] font-bold transition">
                  🔎 Inspeccionar
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
        <select id="epp-cond-sel" class="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs font-bold">
          <option value="optimo" ${unit.conditionStatus === "optimo" ? "selected" : ""}>🟢 Óptimo</option>
          <option value="bueno" ${unit.conditionStatus === "bueno" ? "selected" : ""}>🟢 Bueno</option>
          <option value="regular" ${unit.conditionStatus === "regular" ? "selected" : ""}>🟡 Regular</option>
          <option value="requiere_cambio" ${unit.conditionStatus === "requiere_cambio" ? "selected" : ""}>🔴 Requiere Cambio</option>
          <option value="baja" ${unit.conditionStatus === "baja" ? "selected" : ""}>⛔ Dar de Baja</option>
        </select>
      </div>
      <div>
        <label class="block text-[10px] font-bold uppercase text-slate-500 mb-1">Fecha de Vencimiento</label>
        <input id="epp-exp-input" type="date" value="${esc((unit.expirationDate || "").split("T")[0])}" class="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs font-mono" />
      </div>
      <div>
        <label class="block text-[10px] font-bold uppercase text-slate-500 mb-1">Observación de Inspección</label>
        <input id="epp-note-input" type="text" value="${esc(unit.notes || "")}" placeholder="Ej: Revisado sin fisuras / correas OK" class="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs" />
      </div>
      <div class="flex gap-2 pt-2">
        <button type="button" onclick="closeEppModal()" class="flex-1 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-bold">Cancelar</button>
        <button type="button" onclick="saveEppInspection(${productId}, '${esc(unitId)}')" class="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-extrabold">Guardar Inspección</button>
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

    box.className = "rounded-2xl bg-slate-50 dark:bg-slate-900/90 border-2 border-cyan-500/40 p-5 text-left space-y-4";
    box.innerHTML = `
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span class="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-cyan-500/15 text-cyan-500">${esc(prod.sku)}</span>
          <h3 class="text-lg font-extrabold text-slate-900 dark:text-white mt-1">${esc(prod.name)}</h3>
          <div class="text-xs text-slate-500 mt-0.5">📍 Estante / Ubicación: <strong class="text-slate-800 dark:text-slate-200">${esc(prod.location || "Almacén Central")}</strong></div>
        </div>
        <div class="text-right">
          <div class="text-[10px] uppercase font-bold text-slate-400">Stock Disponible</div>
          <div class="text-3xl font-extrabold font-mono text-emerald-500">${prod.stock} <span class="text-xs">${esc(prod.type === "bulk" ? prod.unitOfMeasure || "m" : "und")}</span></div>
        </div>
      </div>
      ${
        unit
          ? `<div class="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-xs font-mono">
              Unidad escaneada: <b>${esc(unit.sku)}</b> • Estado: <b>${esc(unit.status)}</b> ${unit.assignedTo ? `• Asignado a: <b>${esc(unit.assignedTo)}</b>` : ""}
            </div>`
          : ""
      }
      <div class="flex flex-wrap gap-2">
        <button type="button" onclick="addToDispatchCart(${prod.id}, 1); switchAlmacenTab('dispatch');" class="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-extrabold">🛒 Enviar a Despacho</button>
        <button type="button" onclick="document.getElementById('label-product-select').value='${prod.id}'; printThermalLabels();" class="px-4 py-2 rounded-xl bg-cyan-600 text-white text-xs font-extrabold">🏷️ Imprimir Etiquetas</button>
      </div>
      ${
        activeAsg.length > 0
          ? `<div class="pt-2 border-t border-slate-200 dark:border-white/10">
              <div class="text-[11px] font-bold text-slate-400 uppercase mb-1.5">En manos de técnicos (${activeAsg.length})</div>
              <div class="space-y-1">
                ${activeAsg.slice(0, 6).map((a) => `<div class="text-xs flex justify-between"><span>👷 ${esc(a.employeeName)}</span><span class="font-mono text-slate-400">${esc(a.unitSku || "x" + a.quantity)}</span></div>`).join("")}
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

    // Generar QR en ambos contenedores si QRCode está disponible
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

    // Marcar etiquetas como impresas en backend
    fetch("/api/inventory/products/mark-barcodes-printed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productIds: [prod.id] }),
    }).catch(() => {});

    document.getElementById("ticket-preview-modal")?.classList.remove("hidden");
  };

  // Arrancar al cargar DOM
  document.addEventListener("DOMContentLoaded", bootstrapAlmacen);
})();
