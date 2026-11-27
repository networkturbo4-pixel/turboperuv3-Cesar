/**
 * TurboNetwork SaaS — Seguridad 2FA para Precios & Módulo Pro de Compras (OC + Inventario + OCR)
 * 1. PricePrivacyShield: Oculta cards de precios con **** + botón de ojo + Google Authenticator (revelado temporal 30s)
 * 2. PurchasesTabGate: Bloqueo con Google Authenticator para la pestaña "4. Compras" (duración 24 horas / 1 día)
 * 3. ComprasPro: Órdenes de Compra (formato imprimible A4), conexión con Inventario e Historial por Producto, y OCR de facturas
 */
(function () {
  "use strict";

  const REVEAL_DURATION_SECONDS = 30;
  const PURCHASES_UNLOCK_DURATION_MS = 24 * 60 * 60 * 1000; // 1 día (24 horas)

  const PROTECTED_PRICE_IDS = [
    // RRHH - Planilla (Nómina)
    "kpi-pay-base",
    "kpi-pay-overtime",
    "kpi-pay-essalud",
    "kpi-pay-pension",
    "kpi-pay-quincena",
    "kpi-pay-net",
    // RRHH - Comisiones
    "kpi-comm-sales",
    "kpi-comm-cost",
    "kpi-comm-margin",
    "kpi-comm-total",
    // Facturación & Recibos
    "stat-billing-total",
    "stat-billing-collected",
    "stat-billing-pending",
    "stat-billing-overdue",
    // Liquidación & Caja
    "settlement-cash-total",
    "settlement-transfer-total",
    "settlement-yape-total",
    "settlement-pos-total",
    "settlement-grand-total",
    // Facturación Masiva
    "batch-stat-projected-amount",
    // Compras
    "stat-purchases-total",
    "stat-purchases-net-balance",
  ];

  function getActiveTenant() {
    if (typeof window.activeTenantId === "string" && window.activeTenantId) {
      return window.activeTenantId;
    }
    return localStorage.getItem("turbonetwork_active_tenant") || "turbonetwork";
  }

  function getCurrentUserId() {
    try {
      const raw = localStorage.getItem("turbonetwork_session");
      if (raw) {
        const u = JSON.parse(raw);
        return String(u.id || u.sub || u.email || "user");
      }
    } catch (_) {}
    return "user";
  }

  function getCurrencySymbol() {
    if (typeof window.getSystemCurrencySymbol === "function") {
      return window.getSystemCurrencySymbol();
    }
    return "S/";
  }

  function escHtml(str) {
    if (typeof window.escapeHtml === "function") return window.escapeHtml(String(str ?? ""));
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function notify(msg, type) {
    if (typeof window.showToast === "function") {
      window.showToast(msg, type === "error");
    } else {
      console.log("[FinanceSecurity]", msg);
    }
  }

  // =========================================================================
  // 1. MODAL UNIFICADO DE VERIFICACIÓN GOOGLE AUTHENTICATOR (TOTP)
  // =========================================================================
  let totpGateModal = null;
  let totpGateCallback = null;
  let totpGateCancelCallback = null;

  function ensureTotpGateModal() {
    if (totpGateModal) return totpGateModal;
    const wrapper = document.createElement("div");
    wrapper.id = "totp-security-gate-modal";
    wrapper.className =
      "fixed inset-0 z-[420] hidden flex items-center justify-center bg-black/80 backdrop-blur-md px-4 py-6";
    wrapper.innerHTML = `
      <div class="pro-card max-w-sm w-full p-6 rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-900 shadow-2xl space-y-4 text-center relative">
        <button type="button" id="totp-gate-close-btn" class="absolute top-3.5 right-3.5 w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center transition cursor-pointer">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>

        <div class="w-12 h-12 mx-auto rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
          </svg>
        </div>

        <div>
          <h3 id="totp-gate-title" class="text-base font-bold text-slate-900 dark:text-white">Verificación Google Authenticator</h3>
          <p id="totp-gate-subtitle" class="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            Ingresa el código de 6 dígitos de Google Authenticator para continuar.
          </p>
        </div>

        <div class="space-y-2">
          <input
            type="text"
            id="totp-gate-input"
            maxlength="6"
            inputmode="numeric"
            autocomplete="one-time-code"
            placeholder="000000"
            class="w-full bg-slate-50 dark:bg-black/40 border border-slate-300 dark:border-white/15 rounded-xl px-4 py-3 text-center font-mono text-2xl tracking-[0.35em] font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
          />
          <div id="totp-gate-error" class="text-xs font-semibold text-rose-500 min-h-[18px]"></div>
        </div>

        <div class="flex items-center gap-2 pt-1">
          <button type="button" id="totp-gate-cancel-btn" class="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-semibold transition cursor-pointer">
            Cancelar
          </button>
          <button type="button" id="totp-gate-submit-btn" class="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-md cursor-pointer">
            Verificar Código
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(wrapper);
    totpGateModal = wrapper;

    const inputEl = wrapper.querySelector("#totp-gate-input");
    const submitBtn = wrapper.querySelector("#totp-gate-submit-btn");
    const cancelBtn = wrapper.querySelector("#totp-gate-cancel-btn");
    const closeBtn = wrapper.querySelector("#totp-gate-close-btn");

    const closeCancel = () => {
      wrapper.classList.add("hidden");
      const cb = totpGateCancelCallback;
      totpGateCallback = null;
      totpGateCancelCallback = null;
      if (typeof cb === "function") cb();
    };

    cancelBtn.addEventListener("click", closeCancel);
    closeBtn.addEventListener("click", closeCancel);
    wrapper.addEventListener("click", (e) => {
      if (e.target === wrapper) closeCancel();
    });

    inputEl.addEventListener("input", () => {
      inputEl.value = inputEl.value.replace(/\D/g, "").slice(0, 6);
      if (inputEl.value.length === 6) {
        submitTotpGateCode();
      }
    });
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submitTotpGateCode();
      } else if (e.key === "Escape") {
        closeCancel();
      }
    });
    submitBtn.addEventListener("click", submitTotpGateCode);

    return wrapper;
  }

  async function submitTotpGateCode() {
    const modal = ensureTotpGateModal();
    const inputEl = modal.querySelector("#totp-gate-input");
    const errEl = modal.querySelector("#totp-gate-error");
    const submitBtn = modal.querySelector("#totp-gate-submit-btn");
    const code = (inputEl.value || "").trim();

    if (!/^\d{6}$/.test(code)) {
      errEl.textContent = "Ingresa los 6 dígitos numéricos de Google Authenticator.";
      inputEl.focus();
      return;
    }

    errEl.textContent = "";
    submitBtn.disabled = true;
    const origText = submitBtn.textContent;
    submitBtn.textContent = "Verificando...";

    try {
      const tenantId = getActiveTenant();
      const res = await fetch("/api/settings/connections/master-totp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
        body: JSON.stringify({ code, tenantId }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        modal.classList.add("hidden");
        const cb = totpGateCallback;
        totpGateCallback = null;
        totpGateCancelCallback = null;
        if (typeof cb === "function") cb();
      } else {
        errEl.textContent = data.message || "Código incorrecto o expirado.";
        inputEl.value = "";
        inputEl.focus();
      }
    } catch (err) {
      errEl.textContent = "Error de conexión al validar código.";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = origText;
    }
  }

  window.openTotpSecurityGate = function ({ title, subtitle, onSuccess, onCancel }) {
    const modal = ensureTotpGateModal();
    modal.querySelector("#totp-gate-title").textContent = title || "Verificación Google Authenticator";
    modal.querySelector("#totp-gate-subtitle").textContent =
      subtitle || "Ingresa el código de 6 dígitos de Google Authenticator para continuar.";
    const inputEl = modal.querySelector("#totp-gate-input");
    modal.querySelector("#totp-gate-error").textContent = "";
    inputEl.value = "";
    totpGateCallback = onSuccess || null;
    totpGateCancelCallback = onCancel || null;
    modal.classList.remove("hidden");
    setTimeout(() => inputEl.focus(), 50);
  };

  // =========================================================================
  // 2. ESCUDO DE PRIVACIDAD PARA CARDS DE PRECIO (**** + OJO + REVELADO 30s)
  // =========================================================================
  let pricesUnlockedUntil = 0;
  let pricesCountdownTimer = null;
  let isApplyingMask = false;

  const EYE_OFF_SVG =
    '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>';
  const EYE_ON_SVG =
    '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>';

  function isPriceRevealed() {
    return Date.now() < pricesUnlockedUntil;
  }

  function formatMaskedPrice() {
    return `${getCurrencySymbol()} ****`;
  }

  function applyMaskToElement(el) {
    if (!el) return;
    isApplyingMask = true;
    try {
      const realVal = el.dataset.realValue || el.textContent || `${getCurrencySymbol()} 0.00`;
      if (!el.dataset.realValue && !realVal.includes("****")) {
        el.dataset.realValue = realVal;
      }
      if (isPriceRevealed()) {
        el.textContent = el.dataset.realValue || realVal;
      } else {
        el.textContent = formatMaskedPrice();
      }
    } finally {
      isApplyingMask = false;
    }
  }

  function updateAllEyeButtons() {
    const revealed = isPriceRevealed();
    const secsLeft = revealed ? Math.max(0, Math.ceil((pricesUnlockedUntil - Date.now()) / 1000)) : 0;

    document.querySelectorAll(".tn-price-eye-btn").forEach((btn) => {
      if (revealed) {
        btn.innerHTML = `${EYE_ON_SVG}<span class="text-[9px] font-mono font-bold ml-0.5">${secsLeft}s</span>`;
        btn.title = `Ocultar precios (se ocultará automáticamente en ${secsLeft}s)`;
        btn.className =
          "tn-price-eye-btn inline-flex items-center justify-center px-1.5 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition cursor-pointer ml-1.5 align-middle";
      } else {
        btn.innerHTML = EYE_OFF_SVG;
        btn.title = "Ver precio (requiere Google Authenticator)";
        btn.className =
          "tn-price-eye-btn inline-flex items-center justify-center w-6 h-6 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-300 hover:bg-indigo-500/15 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-white/10 transition cursor-pointer ml-1.5 align-middle";
      }
    });

    PROTECTED_PRICE_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) applyMaskToElement(el);
    });
  }

  function hidePricesNow() {
    pricesUnlockedUntil = 0;
    if (pricesCountdownTimer) {
      clearInterval(pricesCountdownTimer);
      pricesCountdownTimer = null;
    }
    updateAllEyeButtons();
  }

  function revealPricesTemporarily() {
    pricesUnlockedUntil = Date.now() + REVEAL_DURATION_SECONDS * 1000;
    if (pricesCountdownTimer) clearInterval(pricesCountdownTimer);
    updateAllEyeButtons();
    notify(`Montos visibles durante ${REVEAL_DURATION_SECONDS} segundos.`, "success");

    pricesCountdownTimer = setInterval(() => {
      if (!isPriceRevealed()) {
        hidePricesNow();
      } else {
        updateAllEyeButtons();
      }
    }, 1000);
  }

  function handleEyeButtonClick(e) {
    e.preventDefault();
    e.stopPropagation();
    if (isPriceRevealed()) {
      hidePricesNow();
      return;
    }
    window.openTotpSecurityGate({
      title: "Ver Montos Protegidos",
      subtitle: `Ingresa el código de 6 dígitos de Google Authenticator para mostrar los montos durante ${REVEAL_DURATION_SECONDS} segundos.`,
      onSuccess: () => {
        revealPricesTemporarily();
      },
    });
  }

  function attachShieldToElement(id) {
    const el = document.getElementById(id);
    if (!el || el.dataset.priceShieldAttached === "true") return;
    el.dataset.priceShieldAttached = "true";

    const currentText = (el.textContent || "").trim();
    if (currentText && !currentText.includes("****")) {
      el.dataset.realValue = currentText;
    } else {
      el.dataset.realValue = `${getCurrencySymbol()} 0.00`;
    }

    // Crear fila flex para mantener el número y el botón de ojo perfectamente alineados
    const wrapper = document.createElement("div");
    wrapper.className = "inline-flex items-center gap-1 flex-wrap";
    el.parentNode.insertBefore(wrapper, el);
    wrapper.appendChild(el);

    const eyeBtn = document.createElement("button");
    eyeBtn.type = "button";
    eyeBtn.className = "tn-price-eye-btn";
    eyeBtn.setAttribute("aria-label", "Mostrar u ocultar monto");
    eyeBtn.addEventListener("click", handleEyeButtonClick);
    wrapper.appendChild(eyeBtn);

    // Observer para capturar cualquier actualización dinámica de textContent en el card
    const observer = new MutationObserver(() => {
      if (isApplyingMask) return;
      const latest = (el.textContent || "").trim();
      if (latest && !latest.includes("****")) {
        el.dataset.realValue = latest;
        if (!isPriceRevealed()) {
          applyMaskToElement(el);
        }
      }
    });
    observer.observe(el, { childList: true, characterData: true, subtree: true });

    applyMaskToElement(el);
  }

  function initPricePrivacyShield() {
    PROTECTED_PRICE_IDS.forEach(attachShieldToElement);
    updateAllEyeButtons();
  }

  window.PricePrivacyShield = {
    init: initPricePrivacyShield,
    hideNow: hidePricesNow,
    isRevealed: isPriceRevealed,
    setProtectedValue: function (id, formattedText) {
      const el = document.getElementById(id);
      if (!el) return;
      el.dataset.realValue = formattedText;
      applyMaskToElement(el);
    },
  };

  // =========================================================================
  // 3. PUERTA 2FA DE 1 DÍA (24 HORAS) PARA LA PESTAÑA "4. COMPRAS"
  // =========================================================================
  function getPurchasesUnlockKey(tenantId) {
    return `tn_purchases_tab_unlock_${getCurrentUserId()}_${tenantId || getActiveTenant()}`;
  }

  function getPurchasesUnlockExpiry(tenantId) {
    try {
      const raw = localStorage.getItem(getPurchasesUnlockKey(tenantId));
      if (!raw) return 0;
      const parsed = JSON.parse(raw);
      return Number(parsed?.unlockedUntil || 0);
    } catch (_) {
      return 0;
    }
  }

  function isPurchasesTabUnlocked(tenantId) {
    return Date.now() < getPurchasesUnlockExpiry(tenantId);
  }

  function grantPurchasesTabUnlock(tenantId) {
    const unlockedUntil = Date.now() + PURCHASES_UNLOCK_DURATION_MS;
    try {
      localStorage.setItem(getPurchasesUnlockKey(tenantId), JSON.stringify({ unlockedUntil }));
    } catch (_) {}
    updatePurchasesGateBadge();
  }

  function lockPurchasesTabNow(tenantId) {
    try {
      localStorage.removeItem(getPurchasesUnlockKey(tenantId));
    } catch (_) {}
    updatePurchasesGateBadge();
    if (typeof window.switchBillingSubTab === "function") {
      window.switchBillingSubTab("invoices");
    }
    notify("Pestaña de Compras bloqueada. Se solicitará Google Authenticator al volver a entrar.", "info");
  }

  function updatePurchasesGateBadge() {
    const badge = document.getElementById("purchases-2fa-status-badge");
    if (!badge) return;
    const exp = getPurchasesUnlockExpiry(getActiveTenant());
    if (Date.now() < exp) {
      const hoursLeft = Math.max(1, Math.ceil((exp - Date.now()) / (60 * 60 * 1000)));
      badge.innerHTML = `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 text-[10px] font-bold">
          <span>🔐 Acceso 2FA activo (${hoursLeft}h restantes)</span>
          <button type="button" onclick="window.PurchasesTabGate.lockNow()" class="underline hover:text-rose-500 ml-1 cursor-pointer">Bloquear</button>
        </span>
      `;
    } else {
      badge.innerHTML = "";
    }
  }

  window.PurchasesTabGate = {
    isUnlocked: isPurchasesTabUnlocked,
    lockNow: () => lockPurchasesTabNow(getActiveTenant()),
    updateBadge: updatePurchasesGateBadge,
    requireAccess: function (onSuccess, onCancel) {
      const tenantId = getActiveTenant();
      if (isPurchasesTabUnlocked(tenantId)) {
        updatePurchasesGateBadge();
        if (typeof onSuccess === "function") onSuccess();
        return;
      }
      window.openTotpSecurityGate({
        title: "Acceso Protegido — Compras",
        subtitle:
          "Para ingresar a la pestaña de Compras ingresa el código de 6 dígitos de Google Authenticator. El acceso durará 1 día (24 horas).",
        onSuccess: () => {
          grantPurchasesTabUnlock(tenantId);
          notify("Acceso a Compras desbloqueado por 24 horas (1 día).", "success");
          if (typeof onSuccess === "function") onSuccess();
        },
        onCancel: () => {
          if (typeof onCancel === "function") onCancel();
        },
      });
    },
  };

  // =========================================================================
  // 4. MÓDULO PRO DE COMPRAS: ÓRDENES DE COMPRA + INVENTARIO + OCR FACTURAS
  // =========================================================================
  let currentPurchaseOrders = [];
  let cachedInventoryProducts = [];
  let activeComprasInnerTab = "purchases"; // "purchases" | "orders"
  let activePurchaseOrderForInvoice = null; // OC seleccionada al registrar factura
  let purchaseModalMultiItems = []; // Items múltiples (desde OC o factura OCR/XML)

  async function fetchTenantInventoryProducts(force) {
    const tenantId = getActiveTenant();
    if (!force && cachedInventoryProducts.length > 0 && cachedInventoryProducts._tenantId === tenantId) {
      return cachedInventoryProducts;
    }
    try {
      const res = await fetch("/api/inventory/products?compact=true", {
        headers: { "x-tenant-id": tenantId },
      });
      const data = await res.json();
      const list = Array.isArray(data?.data) ? data.data : [];
      list._tenantId = tenantId;
      cachedInventoryProducts = list;
      return list;
    } catch (err) {
      console.error("[ComprasPro] Error cargando productos de inventario:", err);
      return [];
    }
  }

  async function loadPurchaseOrders() {
    const tenantId = getActiveTenant();
    try {
      const res = await fetch("/api/purchase-orders", {
        headers: { "x-tenant-id": tenantId },
      });
      const data = await res.json();
      currentPurchaseOrders = Array.isArray(data?.data) ? data.data : [];
      renderPurchaseOrdersTable();
      updatePurchaseOrdersCountBadge();
    } catch (err) {
      console.error("[ComprasPro] Error cargando órdenes de compra:", err);
    }
  }

  function updatePurchaseOrdersCountBadge() {
    const badge = document.getElementById("purchases-oc-count-badge");
    if (badge) {
      const pending = currentPurchaseOrders.filter((o) => o.status === "pendiente" || o.status === "aprobada").length;
      badge.textContent = String(currentPurchaseOrders.length);
      badge.title = `${pending} pendientes/aprobadas`;
    }
  }

  function switchComprasInnerTab(tab) {
    activeComprasInnerTab = tab === "orders" ? "orders" : "purchases";
    const btnP = document.getElementById("btn-compras-inner-purchases");
    const btnO = document.getElementById("btn-compras-inner-orders");
    const viewP = document.getElementById("compras-inner-view-purchases");
    const viewO = document.getElementById("compras-inner-view-orders");

    if (btnP && btnO) {
      if (activeComprasInnerTab === "purchases") {
        btnP.className = "px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold shadow-xs transition cursor-pointer";
        btnO.className = "px-3.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-white/10 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5";
      } else {
        btnO.className = "px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold shadow-xs transition cursor-pointer flex items-center gap-1.5";
        btnP.className = "px-3.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-white/10 text-xs font-semibold transition cursor-pointer";
      }
    }
    if (viewP) viewP.classList.toggle("hidden", activeComprasInnerTab !== "purchases");
    if (viewO) viewO.classList.toggle("hidden", activeComprasInnerTab !== "orders");

    if (activeComprasInnerTab === "orders") {
      loadPurchaseOrders();
    }
  }

  function renderPurchaseOrdersTable() {
    const tbody = document.getElementById("purchase-orders-table-body");
    if (!tbody) return;
    const sym = getCurrencySymbol();

    if (!currentPurchaseOrders || currentPurchaseOrders.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="px-5 py-10 text-center text-slate-400">
            <div class="text-xs font-medium">No hay Órdenes de Compra registradas en esta empresa.</div>
            <button type="button" onclick="window.ComprasPro.openOrderModal()" class="mt-2 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition cursor-pointer">
              + Crear Primera Orden de Compra
            </button>
          </td>
        </tr>
      `;
      return;
    }

    const statusBadge = (st) => {
      if (st === "recibida")
        return '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">✓ Recibida</span>';
      if (st === "aprobada")
        return '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25">Aprobada</span>';
      if (st === "cancelada")
        return '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-500 border border-rose-500/25">Cancelada</span>';
      return '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">Pendiente</span>';
    };

    tbody.innerHTML = currentPurchaseOrders
      .map((o) => {
        const itemsSummary = (o.items || [])
          .slice(0, 2)
          .map((it) => `${it.quantity}× ${escHtml(it.productName)}`)
          .join(", ");
        const extraItems = (o.items || []).length > 2 ? ` (+${o.items.length - 2} más)` : "";
        const linkedInvHtml = o.linkedInvoiceNumber
          ? `<div class="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">Fac: ${escHtml(o.linkedInvoiceNumber)}</div>`
          : "";

        return `
          <tr class="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition">
            <td class="px-4 py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
              ${escHtml(o.orderNumber)}
              ${linkedInvHtml}
            </td>
            <td class="px-4 py-3">
              <div class="font-bold text-slate-900 dark:text-white">${escHtml(o.supplier)}</div>
              ${o.supplierRuc ? `<div class="text-[10px] font-mono text-slate-400">RUC: ${escHtml(o.supplierRuc)}</div>` : ""}
            </td>
            <td class="px-4 py-3">
              <div class="text-slate-700 dark:text-slate-200 font-medium">${itemsSummary}${extraItems}</div>
              <div class="text-[10px] text-slate-400">${(o.items || []).length} ítem(s) • ${escHtml(o.paymentTerms || "Transferencia")}</div>
            </td>
            <td class="px-4 py-3 font-mono text-slate-500">
              <div>${escHtml(o.date || "-")}</div>
              ${o.expectedDate ? `<div class="text-[10px] text-slate-400">Entrega: ${escHtml(o.expectedDate)}</div>` : ""}
            </td>
            <td class="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">
              ${sym} ${Number(o.estimatedTotal || 0).toFixed(2)}
            </td>
            <td class="px-4 py-3">${statusBadge(o.status)}</td>
            <td class="px-4 py-3 text-right">
              <div class="inline-flex items-center gap-1.5">
                <button type="button" onclick="window.DocumentShareUI.openFormat('purchase_order', '${escHtml(o.id)}')" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-[11px] font-semibold transition cursor-pointer" title="Ver / Imprimir Formato Moderno A4">
                  🖨️ Formato
                </button>
                <button type="button" onclick="window.DocumentShareUI.openShareModal('purchase_order', '${escHtml(o.id)}', '${escHtml(o.orderNumber)}')" class="px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-600 dark:text-indigo-300 border border-indigo-500/25 text-[11px] font-bold transition cursor-pointer" title="Compartir vista pública con enlace y contraseña">
                  🔗 Compartir
                </button>
                ${
                  o.status !== "recibida" && o.status !== "cancelada"
                    ? `<button type="button" onclick="window.ComprasPro.receiveOrderWithInvoice('${escHtml(o.id)}')" class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition cursor-pointer shadow-xs" title="Registrar Factura (OCR) e Ingresar a Inventario">
                        📄 Facturar / Recibir
                      </button>`
                    : ""
                }
                <button type="button" onclick="window.ComprasPro.deleteOrder('${escHtml(o.id)}')" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer" title="Eliminar OC">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  // ---- Modal de Nueva Orden de Compra ----
  let ocDraftItems = [];

  async function openOrderModal() {
    await fetchTenantInventoryProducts(true);
    ocDraftItems = [
      { productId: null, sku: "", productName: "", category: "Equipos de Red", quantity: 1, estimatedUnitCost: 0 },
    ];
    const modal = document.getElementById("purchase-order-modal");
    if (!modal) return;

    document.getElementById("oc-supplier").value = "";
    document.getElementById("oc-supplier-ruc").value = "";
    document.getElementById("oc-supplier-contact").value = "";
    document.getElementById("oc-date").value = new Date().toISOString().split("T")[0];
    document.getElementById("oc-expected-date").value = "";
    document.getElementById("oc-payment-terms").value = "Transferencia Bancaria";
    document.getElementById("oc-notes").value = "";

    renderOcDraftItems();
    modal.classList.remove("hidden");
  }

  function closeOrderModal() {
    const modal = document.getElementById("purchase-order-modal");
    if (modal) modal.classList.add("hidden");
  }

  function addOcDraftItem() {
    ocDraftItems.push({
      productId: null,
      sku: "",
      productName: "",
      category: "Equipos de Red",
      quantity: 1,
      estimatedUnitCost: 0,
    });
    renderOcDraftItems();
  }

  function removeOcDraftItem(index) {
    if (ocDraftItems.length <= 1) return;
    ocDraftItems.splice(index, 1);
    renderOcDraftItems();
  }

  function onOcProductSelect(index, productIdStr) {
    const item = ocDraftItems[index];
    if (!item) return;
    if (!productIdStr) {
      item.productId = null;
      item.sku = "";
      return;
    }
    const prod = cachedInventoryProducts.find((p) => String(p.id) === String(productIdStr));
    if (prod) {
      item.productId = Number(prod.id);
      item.sku = prod.sku || "";
      item.productName = prod.name || "";
      item.estimatedUnitCost = Number(prod.baseCost || 0);
      renderOcDraftItems();
    }
  }

  function updateOcItemField(index, field, value) {
    const item = ocDraftItems[index];
    if (!item) return;
    if (field === "quantity" || field === "estimatedUnitCost") {
      item[field] = parseFloat(value) || 0;
    } else {
      item[field] = value;
    }
    updateOcTotalDisplay();
  }

  function updateOcTotalDisplay() {
    const sym = getCurrencySymbol();
    const total = ocDraftItems.reduce((acc, it) => acc + (Number(it.quantity) || 0) * (Number(it.estimatedUnitCost) || 0), 0);
    const totalEl = document.getElementById("oc-estimated-total");
    if (totalEl) totalEl.textContent = `${sym} ${total.toFixed(2)}`;
    ocDraftItems.forEach((it, i) => {
      const subEl = document.getElementById(`oc-item-sub-${i}`);
      if (subEl) subEl.textContent = `${sym} ${((Number(it.quantity) || 0) * (Number(it.estimatedUnitCost) || 0)).toFixed(2)}`;
    });
  }

  function renderOcDraftItems() {
    const container = document.getElementById("oc-items-container");
    if (!container) return;
    const sym = getCurrencySymbol();
    const productOptions = cachedInventoryProducts
      .map(
        (p) =>
          `<option value="${p.id}">${escHtml(p.name)} ${p.sku ? `[${escHtml(p.sku)}]` : ""} (Stock: ${p.stock ?? 0})</option>`
      )
      .join("");

    container.innerHTML = ocDraftItems
      .map(
        (it, idx) => `
      <div class="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 space-y-2">
        <div class="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
          <div class="sm:col-span-5">
            <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1">Producto de Inventario (Opcional)</label>
            <select onchange="window.ComprasPro.onOcProductSelect(${idx}, this.value)" class="w-full bg-white dark:bg-black/40 border border-slate-300 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100">
              <option value="">-- Seleccionar del Inventario o escribir abajo --</option>
              ${productOptions.replace(`value="${it.productId}"`, `value="${it.productId}" selected`)}
            </select>
          </div>
          <div class="sm:col-span-4">
            <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1">Descripción / Producto *</label>
            <input type="text" value="${escHtml(it.productName)}" oninput="window.ComprasPro.updateOcItemField(${idx}, 'productName', this.value)" placeholder="Nombre del material o equipo..." class="w-full bg-white dark:bg-black/40 border border-slate-300 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100" />
          </div>
          <div class="sm:col-span-1">
            <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1">Cant.</label>
            <input type="number" min="1" step="1" value="${it.quantity}" oninput="window.ComprasPro.updateOcItemField(${idx}, 'quantity', this.value)" class="w-full bg-white dark:bg-black/40 border border-slate-300 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-100" />
          </div>
          <div class="sm:col-span-2 flex items-center gap-1">
            <div class="flex-1">
              <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1">Unit. (${sym})</label>
              <input type="number" min="0" step="0.01" value="${it.estimatedUnitCost}" oninput="window.ComprasPro.updateOcItemField(${idx}, 'estimatedUnitCost', this.value)" class="w-full bg-white dark:bg-black/40 border border-slate-300 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-100" />
            </div>
            ${
              ocDraftItems.length > 1
                ? `<button type="button" onclick="window.ComprasPro.removeOcDraftItem(${idx})" class="mt-4 p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer" title="Quitar ítem">✕</button>`
                : ""
            }
          </div>
        </div>
        <div class="flex items-center justify-between text-[10px] text-slate-400">
          <span>${it.productId ? `✓ Vinculado a Inventario (ID #${it.productId})` : "Ítem libre (se puede vincular al facturar)"}</span>
          <span class="font-mono font-bold text-indigo-600 dark:text-indigo-400">Subtotal: <span id="oc-item-sub-${idx}">${sym} ${(
            (Number(it.quantity) || 0) * (Number(it.estimatedUnitCost) || 0)
          ).toFixed(2)}</span></span>
        </div>
      </div>
    `
      )
      .join("");
    updateOcTotalDisplay();
  }

  async function submitPurchaseOrder() {
    const supplier = (document.getElementById("oc-supplier")?.value || "").trim();
    const supplierRuc = (document.getElementById("oc-supplier-ruc")?.value || "").trim();
    const supplierContact = (document.getElementById("oc-supplier-contact")?.value || "").trim();
    const date = document.getElementById("oc-date")?.value || new Date().toISOString().split("T")[0];
    const expectedDate = document.getElementById("oc-expected-date")?.value || "";
    const paymentTerms = document.getElementById("oc-payment-terms")?.value || "Transferencia Bancaria";
    const notes = (document.getElementById("oc-notes")?.value || "").trim();

    const validItems = ocDraftItems.filter((it) => (it.productName || "").trim() && Number(it.quantity) > 0);
    if (!supplier || validItems.length === 0) {
      notify("Ingresa el proveedor y al menos un producto con cantidad válida.", "error");
      return;
    }

    try {
      const res = await fetch("/api/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-id": getActiveTenant() },
        body: JSON.stringify({
          supplier,
          supplierRuc,
          supplierContact,
          date,
          expectedDate,
          paymentTerms,
          notes,
          items: validItems,
        }),
      });
      const data = await res.json();
      if (data.success) {
        notify(data.message || "Orden de Compra creada exitosamente", "success");
        closeOrderModal();
        switchComprasInnerTab("orders");
        await loadPurchaseOrders();
      } else {
        notify(data.message || "Error al crear Orden de Compra", "error");
      }
    } catch (err) {
      notify("Error de conexión al guardar Orden de Compra", "error");
    }
  }

  async function deleteOrder(orderId) {
    if (!confirm("¿Eliminar esta Orden de Compra?")) return;
    try {
      const res = await fetch(`/api/purchase-orders/${encodeURIComponent(orderId)}`, {
        method: "DELETE",
        headers: { "x-tenant-id": getActiveTenant() },
      });
      const data = await res.json();
      if (data.success) {
        notify("Orden de Compra eliminada", "success");
        await loadPurchaseOrders();
      }
    } catch (_) {
      notify("Error al eliminar la Orden de Compra", "error");
    }
  }

  // ---- Formato Imprimible A4 Moderno (con Logo del Tenant) ----
  function printOrder(orderId) {
    if (window.DocumentShareUI) {
      window.DocumentShareUI.openFormat("purchase_order", orderId);
    }
  }

  // =========================================================================
  // 5. FORMATO MODERNO A4 + MODAL DE COMPARTIR PÚBLICO CON CONTRASEÑA
  // =========================================================================
  let shareDocModalEl = null;
  let shareDocCtx = { docType: "purchase_order", docId: "", docLabel: "", currentShare: null };

  function ensureShareDocModal() {
    if (shareDocModalEl) return shareDocModalEl;
    const wrapper = document.createElement("div");
    wrapper.id = "share-document-modal";
    wrapper.className =
      "fixed inset-0 z-[430] hidden flex items-center justify-center bg-black/80 backdrop-blur-md px-4 py-6";
    wrapper.innerHTML = `
      <div class="pro-card max-w-md w-full p-6 rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-900 shadow-2xl space-y-4 relative">
        <div class="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
            </div>
            <div>
              <h3 class="text-sm font-bold text-slate-900 dark:text-white">Compartir Vista Pública</h3>
              <p id="share-doc-subtitle" class="text-[11px] font-mono text-slate-400">Documento</p>
            </div>
          </div>
          <button type="button" id="share-doc-close-btn" class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition cursor-pointer">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <!-- Estado y Enlace Público -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label class="text-xs font-bold text-slate-700 dark:text-slate-200">Enlace Público para Compartir</label>
            <span id="share-doc-views-badge" class="text-[10px] font-mono text-slate-400">👁️ 0 visitas</span>
          </div>
          <div class="flex items-center gap-1.5">
            <input type="text" id="share-doc-url-input" readonly class="flex-1 bg-slate-50 dark:bg-black/40 border border-slate-300 dark:border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-100 select-all" value="Generando enlace..." />
            <button type="button" id="share-doc-copy-btn" class="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition whitespace-nowrap cursor-pointer shadow-xs">
              📋 Copiar
            </button>
          </div>
          <div class="flex items-center justify-between pt-1">
            <span id="share-doc-lock-badge" class="text-[11px] font-semibold text-slate-500">🔓 Acceso libre con enlace</span>
            <a id="share-doc-open-link" href="#" target="_blank" rel="noopener noreferrer" class="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
              Abrir Vista Pública ↗
            </a>
          </div>
        </div>

        <!-- Protección con Contraseña -->
        <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 space-y-2.5">
          <div class="flex items-center justify-between">
            <label class="text-xs font-bold text-slate-700 dark:text-slate-200">🔒 Contraseña de Acceso (Opcional)</label>
            <label class="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 cursor-pointer">
              <input type="checkbox" id="share-doc-enabled-chk" checked class="rounded border-slate-300 text-emerald-600" />
              <span>Enlace activo</span>
            </label>
          </div>
          <input type="password" id="share-doc-password-input" placeholder="Escribe una contraseña para proteger el enlace..." autocomplete="new-password" class="w-full bg-white dark:bg-black/40 border border-slate-300 dark:border-white/15 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40" />
          <div class="flex items-center gap-2">
            <button type="button" id="share-doc-save-pwd-btn" class="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer shadow-xs">
              ✓ Guardar Configuración
            </button>
            <button type="button" id="share-doc-remove-pwd-btn" class="hidden px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/25 text-xs font-bold transition cursor-pointer">
              Quitar Clave
            </button>
          </div>
        </div>

        <div class="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-white/10">
          <button type="button" id="share-doc-preview-a4-btn" class="px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer">
            🖨️ Ver Formato A4
          </button>
          <button type="button" id="share-doc-done-btn" class="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold transition cursor-pointer">
            Listo
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(wrapper);
    shareDocModalEl = wrapper;

    const closeModal = () => wrapper.classList.add("hidden");
    wrapper.querySelector("#share-doc-close-btn").addEventListener("click", closeModal);
    wrapper.querySelector("#share-doc-done-btn").addEventListener("click", closeModal);
    wrapper.addEventListener("click", (e) => {
      if (e.target === wrapper) closeModal();
    });

    wrapper.querySelector("#share-doc-copy-btn").addEventListener("click", async () => {
      const inp = wrapper.querySelector("#share-doc-url-input");
      const url = inp.value;
      if (!url || !url.startsWith("http")) return;
      try {
        await navigator.clipboard.writeText(url);
      } catch (_) {
        inp.select();
        document.execCommand("copy");
      }
      const btn = wrapper.querySelector("#share-doc-copy-btn");
      btn.textContent = "✓ Copiado";
      notify("Enlace público copiado al portapapeles", "success");
      setTimeout(() => (btn.textContent = "📋 Copiar"), 2000);
    });

    wrapper.querySelector("#share-doc-save-pwd-btn").addEventListener("click", async () => {
      const pwd = (wrapper.querySelector("#share-doc-password-input").value || "").trim();
      const enabled = wrapper.querySelector("#share-doc-enabled-chk").checked;
      await saveShareSettings({ password: pwd || undefined, enabled });
    });

    wrapper.querySelector("#share-doc-remove-pwd-btn").addEventListener("click", async () => {
      const enabled = wrapper.querySelector("#share-doc-enabled-chk").checked;
      await saveShareSettings({ removePassword: true, enabled });
    });

    wrapper.querySelector("#share-doc-preview-a4-btn").addEventListener("click", () => {
      window.DocumentShareUI.openFormat(shareDocCtx.docType, shareDocCtx.docId);
    });

    return wrapper;
  }

  function paintShareModalData(data) {
    const modal = ensureShareDocModal();
    const urlInp = modal.querySelector("#share-doc-url-input");
    const openLink = modal.querySelector("#share-doc-open-link");
    const lockBadge = modal.querySelector("#share-doc-lock-badge");
    const viewsBadge = modal.querySelector("#share-doc-views-badge");
    const removePwdBtn = modal.querySelector("#share-doc-remove-pwd-btn");
    const enabledChk = modal.querySelector("#share-doc-enabled-chk");
    const pwdInp = modal.querySelector("#share-doc-password-input");

    const fullUrl = data.publicUrl || `${window.location.origin}${data.publicPath}`;
    urlInp.value = fullUrl;
    openLink.href = fullUrl;
    viewsBadge.textContent = `👁️ ${data.viewsCount || 0} visitas`;
    enabledChk.checked = data.enabled !== false;
    pwdInp.value = "";

    if (data.hasPassword) {
      lockBadge.textContent = "🔒 Protegido con contraseña";
      lockBadge.className = "text-[11px] font-bold text-emerald-600 dark:text-emerald-400";
      removePwdBtn.classList.remove("hidden");
      pwdInp.placeholder = "Escribe una nueva contraseña para cambiarla...";
    } else {
      lockBadge.textContent = "🔓 Acceso libre con enlace";
      lockBadge.className = "text-[11px] font-semibold text-slate-500";
      removePwdBtn.classList.add("hidden");
      pwdInp.placeholder = "Escribe una contraseña para proteger el enlace...";
    }
  }

  async function saveShareSettings({ password, removePassword, enabled }) {
    try {
      const res = await fetch("/api/documents/share", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-id": getActiveTenant() },
        body: JSON.stringify({
          docType: shareDocCtx.docType,
          docId: shareDocCtx.docId,
          password,
          removePassword,
          enabled,
        }),
      });
      const result = await res.json();
      if (result.success && result.data) {
        shareDocCtx.currentShare = result.data;
        paintShareModalData(result.data);
        notify(result.message || "Configuración guardada", "success");
      } else {
        notify(result.message || "Error al guardar enlace", "error");
      }
    } catch (_) {
      notify("Error de conexión al guardar enlace público", "error");
    }
  }

  async function openShareModal(docType, docId, docLabel) {
    const modal = ensureShareDocModal();
    shareDocCtx = { docType, docId: String(docId), docLabel: docLabel || String(docId), currentShare: null };
    const typeLabel =
      docType === "purchase_order" ? "Orden de Compra" : docType === "purchase" ? "Comprobante de Compra" : "Factura / Recibo";
    modal.querySelector("#share-doc-subtitle").textContent = `${typeLabel} • ${shareDocCtx.docLabel}`;
    modal.querySelector("#share-doc-url-input").value = "Generando enlace público...";
    modal.classList.remove("hidden");

    try {
      const res = await fetch("/api/documents/share", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-id": getActiveTenant() },
        body: JSON.stringify({ docType, docId: String(docId) }),
      });
      const result = await res.json();
      if (result.success && result.data) {
        shareDocCtx.currentShare = result.data;
        paintShareModalData(result.data);
      } else {
        notify(result.message || "No se pudo generar el enlace público", "error");
      }
    } catch (_) {
      notify("Error de conexión al generar enlace público", "error");
    }
  }

  async function openFormat(docType, docId) {
    try {
      const res = await fetch(
        `/api/documents/render/${encodeURIComponent(docType)}/${encodeURIComponent(String(docId))}`,
        { headers: { "x-tenant-id": getActiveTenant() } }
      );
      if (!res.ok) {
        notify("No se pudo generar el formato A4 del documento.", "error");
        return;
      }
      const html = await res.text();
      const win = window.open("", "_blank", "width=960,height=800");
      if (!win) {
        notify("Permite ventanas emergentes para abrir el formato imprimible.", "error");
        return;
      }
      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch (_) {
      notify("Error al abrir formato A4", "error");
    }
  }

  window.DocumentShareUI = {
    openFormat,
    openShareModal,
  };

  // ---- Convertir Orden de Compra a Registro de Compra con Factura & OCR ----
  async function receiveOrderWithInvoice(orderId) {
    const order = currentPurchaseOrders.find((o) => o.id === orderId);
    if (!order) return;
    activePurchaseOrderForInvoice = order;
    purchaseModalMultiItems = (order.items || []).map((it) => ({
      productId: it.productId || null,
      productName: it.productName,
      category: it.category || "Equipos de Red",
      quantity: Number(it.quantity) || 1,
      unitCost: Number(it.estimatedUnitCost) || 0,
      totalCost: Number(it.subtotal) || 0,
    }));

    if (typeof window.openRegisterPurchaseModal === "function") {
      await window.openRegisterPurchaseModal({ fromOrder: order });
    }
  }

  // ---- Poblar Selector de Inventario dentro de #register-purchase-modal ----
  async function populatePurchaseInventorySelect(selectedProductId) {
    const sel = document.getElementById("pch-inventory-product");
    if (!sel) return;
    const products = await fetchTenantInventoryProducts(true);
    let html = '<option value="">-- Sin vincular (gasto general o producto nuevo) --</option>';
    products.forEach((p) => {
      const selected = selectedProductId && Number(selectedProductId) === Number(p.id) ? "selected" : "";
      html += `<option value="${p.id}" ${selected}>${escHtml(p.name)} ${p.sku ? `[${escHtml(p.sku)}]` : ""} • Stock actual: ${p.stock ?? 0}</option>`;
    });
    sel.innerHTML = html;
  }

  function onPurchaseInventoryProductChange(val) {
    if (!val) return;
    const prod = cachedInventoryProducts.find((p) => String(p.id) === String(val));
    if (!prod) return;
    const nameInp = document.getElementById("pch-product-name");
    const unitInp = document.getElementById("pch-unit-cost");
    if (nameInp) nameInp.value = prod.name || "";
    if (unitInp && (!unitInp.value || Number(unitInp.value) === 0) && prod.baseCost) {
      unitInp.value = Number(prod.baseCost).toFixed(2);
      if (typeof window.recalcPurchaseTotal === "function") window.recalcPurchaseTotal();
    }
  }

  // ---- Parser Heurístico Cliente para Tesseract.js ----
  function parseClientOcrInvoiceText(rawText) {
    const text = String(rawText || "").replace(/\r/g, "\n");
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

    const invMatch =
      text.match(/\b([FBE][A-Z0-9]{3}\s*[-–]\s*\d{1,8})\b/i) ||
      text.match(/(?:FACTURA|BOLETA|N[°º])[^\n]{0,18}?([A-Z0-9]{2,5}[-–]\d{3,10})/i);
    const invoiceNumber = invMatch ? invMatch[1].replace(/\s+/g, "").toUpperCase() : "";

    const rucMatches = text.match(/\b((?:10|20)\d{9})\b/g) || [];
    const supplierRuc = rucMatches[0] || "";

    let date = "";
    const isoDate = text.match(/\b(20\d{2}[-/]\d{2}[-/]\d{2})\b/);
    const dmyDate = text.match(/\b(\d{2})[-/](\d{2})[-/](20\d{2})\b/);
    if (isoDate) date = isoDate[1].replace(/\//g, "-");
    else if (dmyDate) date = `${dmyDate[3]}-${dmyDate[2]}-${dmyDate[1]}`;

    let supplier = "";
    const compLine = lines.find(
      (l) =>
        /\b(S\.?A\.?C\.?|S\.?R\.?L\.?|E\.?I\.?R\.?L\.?|S\.?A\.?|PERU|TELECOM|NETWORK|TECH|LATAM|ELECTRIC)\b/i.test(l) &&
        l.length >= 4 &&
        l.length <= 90 &&
        !/FACTURA|BOLETA|RUC|CLIENTE|DIRECCION/i.test(l)
    );
    supplier = compLine || lines.find((l) => l.length >= 4 && l.length <= 70 && !/^\d+$/.test(l)) || "";

    let totalCost = 0;
    const totMatch =
      text.match(/(?:IMPORTE\s*TOTAL|TOTAL\s*A\s*PAGAR|TOTAL\s*VENTA|TOTAL\s*GENERAL|TOTAL)[^\d\n]{0,16}(?:S\/\.?|PEN|USD|\$)?\s*([\d,]+\.\d{2})/i);
    if (totMatch && totMatch[1]) {
      totalCost = parseFloat(totMatch[1].replace(/,/g, "")) || 0;
    } else {
      const amounts = Array.from(text.matchAll(/([\d,]+\.\d{2})/g))
        .map((m) => parseFloat(m[1].replace(/,/g, "")) || 0)
        .filter((n) => n > 0 && n < 10_000_000);
      if (amounts.length > 0) totalCost = Math.max(...amounts);
    }

    // Buscar coincidencia en el inventario del tenant
    const lower = text.toLowerCase();
    const matchedProd = cachedInventoryProducts.find(
      (p) =>
        (p.sku && p.sku.length >= 4 && lower.includes(p.sku.toLowerCase())) ||
        (p.name && p.name.length >= 5 && lower.includes(p.name.toLowerCase()))
    );

    return {
      supplier,
      supplierRuc,
      invoiceNumber,
      date,
      productId: matchedProd ? Number(matchedProd.id) : null,
      productName: matchedProd ? matchedProd.name : "",
      quantity: 1,
      unitCost: totalCost,
      totalCost,
      paymentMethod: /EFECTIVO|CONTADO/i.test(text) ? "cash" : /CREDITO|CRÉDITO/i.test(text) ? "credit" : "bank_transfer",
      notes: supplierRuc ? `Leído con OCR • RUC ${supplierRuc}` : "Leído automáticamente con OCR",
    };
  }

  function applyOcrDataToPurchaseForm(d) {
    if (!d) return;
    const setIf = (id, val) => {
      const el = document.getElementById(id);
      if (el && val !== undefined && val !== null && String(val).trim() !== "") {
        el.value = String(val).trim();
      }
    };

    setIf("pch-supplier", d.supplier);
    setIf("pch-supplier-ruc", d.supplierRuc);
    setIf("pch-invoice-num", d.invoiceNumber);
    if (d.date && /^\d{4}-\d{2}-\d{2}$/.test(d.date)) setIf("pch-date", d.date);
    if (d.productId) {
      const sel = document.getElementById("pch-inventory-product");
      if (sel) sel.value = String(d.productId);
    }
    setIf("pch-product-name", d.productName);
    if (Number(d.quantity) > 0) setIf("pch-quantity", d.quantity);
    if (Number(d.unitCost) > 0) setIf("pch-unit-cost", Number(d.unitCost).toFixed(2));
    else if (Number(d.totalCost) > 0 && Number(d.quantity || 1) > 0) {
      setIf("pch-unit-cost", (Number(d.totalCost) / Number(d.quantity || 1)).toFixed(2));
    }
    if (d.paymentMethod) setIf("pch-payment-method", d.paymentMethod);
    if (d.notes) setIf("pch-notes", d.notes);
    if (Array.isArray(d.items) && d.items.length > 1) {
      purchaseModalMultiItems = d.items;
      renderPurchaseMultiItemsBanner();
    }
    if (typeof window.recalcPurchaseTotal === "function") window.recalcPurchaseTotal();
  }

  function renderPurchaseMultiItemsBanner() {
    const banner = document.getElementById("pch-multi-items-banner");
    if (!banner) return;
    if (!purchaseModalMultiItems || purchaseModalMultiItems.length <= 1) {
      banner.classList.add("hidden");
      banner.innerHTML = "";
      return;
    }
    const sym = getCurrencySymbol();
    banner.classList.remove("hidden");
    banner.innerHTML = `
      <div class="flex items-center justify-between mb-1.5">
        <span class="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">📦 ${purchaseModalMultiItems.length} productos vinculados (se registrarán e ingresarán al inventario)</span>
        <button type="button" onclick="window.ComprasPro.clearMultiItems()" class="text-[10px] text-rose-500 hover:underline cursor-pointer">Limpiar lista</button>
      </div>
      <div class="space-y-1 max-h-28 overflow-y-auto text-[11px]">
        ${purchaseModalMultiItems
          .map(
            (it) =>
              `<div class="flex justify-between font-mono text-slate-700 dark:text-slate-200">
                <span class="truncate pr-2">${it.quantity}× ${escHtml(it.productName)} ${it.productId ? "(Inv #" + it.productId + ")" : ""}</span>
                <span class="font-bold">${sym} ${((Number(it.quantity) || 1) * (Number(it.unitCost) || 0)).toFixed(2)}</span>
              </div>`
          )
          .join("")}
      </div>
    `;
  }

  async function runInvoiceOcr(fileObj) {
    if (!fileObj || !fileObj.dataUrl) {
      notify("Primero adjunta una factura (PDF, imagen o XML).", "error");
      return;
    }
    const statusEl = document.getElementById("pch-ocr-status");
    const setStatus = (msg, tone) => {
      if (!statusEl) return;
      statusEl.classList.remove("hidden");
      const cls =
        tone === "success"
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25"
          : tone === "error"
          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25"
          : "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/25";
      statusEl.className = `p-2.5 rounded-xl border text-[11px] font-semibold flex items-center gap-2 ${cls}`;
      statusEl.innerHTML = msg;
    };

    setStatus("<span>🔍 Analizando factura con OCR...</span>", "info");

    try {
      await fetchTenantInventoryProducts(false);
      const res = await fetch("/api/purchases/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-id": getActiveTenant() },
        body: JSON.stringify({
          documentData: fileObj.dataUrl,
          documentName: fileObj.name,
          mimeType: fileObj.type,
        }),
      });
      const result = await res.json();

      if (result.success && result.data && !result.fallbackToClientOcr) {
        applyOcrDataToPurchaseForm(result.data);
        setStatus(`<span>✅ ${escHtml(result.message || "Campos completados automáticamente con OCR.")}</span>`, "success");
        notify("Factura procesada con OCR y campos autocompletados.", "success");
        return;
      }

      // Fallback local con Tesseract.js para imágenes cuando no hay GEMINI_API_KEY
      if (result.fallbackToClientOcr && typeof window.Tesseract !== "undefined") {
        setStatus("<span>⏳ Ejecutando OCR óptico en la imagen (Tesseract)...</span>", "info");
        const ocrRes = await window.Tesseract.recognize(fileObj.dataUrl, "spa", {
          logger: (m) => {
            if (m.status === "recognizing text" && typeof m.progress === "number") {
              setStatus(`<span>⏳ Leyendo factura con OCR... ${Math.round(m.progress * 100)}%</span>`, "info");
            }
          },
        });
        const extractedText = ocrRes?.data?.text || "";
        const parsed = parseClientOcrInvoiceText(extractedText);
        applyOcrDataToPurchaseForm(parsed);
        setStatus("<span>✅ Factura leída con OCR local y campos autorellenados. Revisa y confirma.</span>", "success");
        notify("OCR completado. Revisa los campos autorellenados.", "success");
        return;
      }

      setStatus("<span>⚠️ No se pudo extraer texto automáticamente. Completa los campos manualmente.</span>", "error");
    } catch (err) {
      console.error("[ComprasPro OCR] Error:", err);
      setStatus("<span>⚠️ Error al procesar OCR. Puedes completar los campos manualmente.</span>", "error");
    }
  }

  window.ComprasPro = {
    loadPurchaseOrders,
    switchComprasInnerTab,
    openOrderModal,
    closeOrderModal,
    addOcDraftItem,
    removeOcDraftItem,
    onOcProductSelect,
    updateOcItemField,
    submitPurchaseOrder,
    deleteOrder,
    printOrder,
    receiveOrderWithInvoice,
    populatePurchaseInventorySelect,
    onPurchaseInventoryProductChange,
    runInvoiceOcr,
    getActiveOrder: () => activePurchaseOrderForInvoice,
    clearActiveOrder: () => {
      activePurchaseOrderForInvoice = null;
      const badge = document.getElementById("pch-linked-oc-banner");
      if (badge) badge.classList.add("hidden");
    },
    getMultiItems: () => purchaseModalMultiItems,
    clearMultiItems: () => {
      purchaseModalMultiItems = [];
      renderPurchaseMultiItemsBanner();
    },
    renderMultiItemsBanner: renderPurchaseMultiItemsBanner,
    resetOnTenantSwitch: () => {
      currentPurchaseOrders = [];
      cachedInventoryProducts = [];
      activePurchaseOrderForInvoice = null;
      purchaseModalMultiItems = [];
      hidePricesNow();
      updatePurchasesGateBadge();
      renderPurchaseOrdersTable();
    },
  };

  // Inicializar al cargar el DOM
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initPricePrivacyShield();
      updatePurchasesGateBadge();
    });
  } else {
    initPricePrivacyShield();
    updatePurchasesGateBadge();
  }
})();
