// ============================================================================
// MÓDULO: ACTAS DE INSTALACIÓN (TurboNetwork v3)
// ============================================================================
(function () {
  const DRAFT_KEY = "tn_acta_draft_v1";

  const state = {
    actas: [],
    customers: [],
    plans: [],
    employees: [],
    orders: [],
    mochilaEquipos: [],
    mochilaMateriales: [],
    editingId: null,
    currentPublicToken: null,
    equipos: [],
    materiales: [],
    evidencias: [],
    firmaCliente: null,
    firmaTecnico: null,
    cameraStream: null,
    qrStream: null,
    qrRafId: null,
    qrCallback: null,
    sigPads: {},
    fsSigRole: null,
    fsSigPad: null,
  };

  function safeEsc(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function toast(msg, type = "info") {
    if (typeof window.showToast === "function") {
      window.showToast(msg, type);
    } else {
      console.log(`[Actas][${type}] ${msg}`);
    }
  }

  async function api(url, opts = {}) {
    if (typeof window.apiFetch === "function") {
      return window.apiFetch(url, opts);
    }
    const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
    const res = await fetch(url, { ...opts, headers });
    return res.json();
  }

  function getStatusBadgeClass(status) {
    switch (status) {
      case "Finalizada (Éxito)":
        return "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30";
      case "En Proceso":
        return "bg-blue-500/15 text-blue-400 border border-blue-500/30";
      case "Pendiente":
        return "bg-amber-500/15 text-amber-400 border border-amber-500/30";
      case "Observada":
        return "bg-orange-500/15 text-orange-400 border border-orange-500/30";
      case "Anulada":
        return "bg-rose-500/15 text-rose-400 border border-rose-500/30";
      default:
        return "bg-slate-500/15 text-slate-300 border border-slate-500/30";
    }
  }

  // ==========================================================================
  // CARGA INICIAL DEL MÓDULO
  // ==========================================================================
  window.loadActasModule = async function () {
    showActasListView();
    await Promise.all([loadActasList(), loadCatalogsForActas()]);
    attachDraftAutoSaveListeners();
  };

  async function loadCatalogsForActas() {
    try {
      const [custRes, plansRes, empRes] = await Promise.all([
        api("/api/customers").catch(() => ({ data: [] })),
        api("/api/plans").catch(() => ({ data: [] })),
        api("/api/rrhh/employees").catch(() => ({ data: [] })),
      ]);
      state.customers = Array.isArray(custRes?.data) ? custRes.data : Array.isArray(custRes) ? custRes : [];
      state.plans = Array.isArray(plansRes?.data) ? plansRes.data : Array.isArray(plansRes) ? plansRes : [];
      state.employees = Array.isArray(empRes?.data) ? empRes.data : Array.isArray(empRes) ? empRes : [];

      populatePlanSelect();
      populateTechSelects();
      populateDatalists();
    } catch (err) {
      console.error("[Actas] Error cargando catálogos:", err);
    }
  }

  function populatePlanSelect() {
    const sel = document.getElementById("acta-plan-select");
    if (!sel) return;
    const currentVal = sel.value;
    sel.innerHTML = `<option value="">Sin plan</option>` +
      state.plans.map((p) =>
        `<option value="${safeEsc(p.id)}" data-name="${safeEsc(p.name)}" data-dl="${safeEsc(p.downloadSpeedMbps || "")}" data-ul="${safeEsc(p.uploadSpeedMbps || "")}">${safeEsc(p.name)}${p.price ? ` - ${safeEsc(p.currency || "S/")} ${p.price}` : ""}</option>`
      ).join("");
    if (currentVal) sel.value = currentVal;
  }

  window.onActaPlanChange = function () {
    const sel = document.getElementById("acta-plan-select");
    const opt = sel?.selectedOptions?.[0];
    if (!opt || !opt.value) return;
    const dl = opt.dataset.dl;
    const ul = opt.dataset.ul;
    if (dl) setVal("acta-speed-dl", dl);
    if (ul) setVal("acta-speed-ul", ul);
    if (dl || ul) toast(`Velocidades autocompletadas (${dl || "--"}/${ul || "--"} Mbps)`, "info");
  };

  function populateTechSelects() {
    const formSel = document.getElementById("acta-tecnico-select");
    const filterSel = document.getElementById("actas-filter-tecnico");
    const activeEmps = state.employees.filter((e) => e.status !== "cesado");

    if (formSel) {
      const prev = formSel.value;
      formSel.innerHTML = `<option value="">Seleccionar técnico...</option>` +
        activeEmps.map((e) => `<option value="${safeEsc(e.id)}" data-name="${safeEsc(e.fullName || e.name)}">${safeEsc(e.fullName || e.name)}</option>`).join("");
      if (prev) formSel.value = prev;
    }
    if (filterSel) {
      const prevF = filterSel.value;
      filterSel.innerHTML = `<option value="ALL">Todos los técnicos</option>` +
        activeEmps.map((e) => `<option value="${safeEsc(e.id)}">${safeEsc(e.fullName || e.name)}</option>`).join("");
      if (prevF) filterSel.value = prevF;
    }
  }

  function populateDatalists() {
    const distritos = new Set();
    const nodos = new Set();
    state.actas.forEach((a) => {
      if (a.cliente?.distrito) distritos.add(a.cliente.distrito);
      if (a.plantaExterna?.nodoCluster) nodos.add(a.plantaExterna.nodoCluster);
    });
    const dList = document.getElementById("acta-distrito-list");
    if (dList) dList.innerHTML = [...distritos].map((d) => `<option value="${safeEsc(d)}">`).join("");
    const nList = document.getElementById("acta-nodo-list");
    if (nList) nList.innerHTML = [...nodos].map((n) => `<option value="${safeEsc(n)}">`).join("");
  }

  window.loadActasList = async function () {
    const grid = document.getElementById("actas-cards-grid");
    if (grid) {
      grid.innerHTML = `<div class="col-span-full py-12 text-center text-slate-400 text-sm">Cargando actas de instalación...</div>`;
    }
    try {
      const search = document.getElementById("actas-search-input")?.value || "";
      const estado = document.getElementById("actas-filter-estado")?.value || "ALL";
      const tecnicoId = document.getElementById("actas-filter-tecnico")?.value || "ALL";

      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (estado && estado !== "ALL") params.set("estado", estado);
      if (tecnicoId && tecnicoId !== "ALL") params.set("tecnicoId", tecnicoId);

      const res = await api(`/api/actas?${params.toString()}`);
      state.actas = Array.isArray(res?.data) ? res.data : [];
      renderActasCards();
      updateActasKpis();
      populateDatalists();
    } catch (err) {
      toast("Error al cargar actas: " + err.message, "error");
    }
  };

  function updateActasKpis() {
    const total = state.actas.length;
    const fin = state.actas.filter((a) => a.detallesServicio?.estadoFinal === "Finalizada (Éxito)").length;
    const proc = state.actas.filter((a) => a.detallesServicio?.estadoFinal === "En Proceso").length;

    const elTotal = document.getElementById("actas-kpi-total");
    const elFin = document.getElementById("actas-kpi-finalizadas");
    const elProc = document.getElementById("actas-kpi-proceso");
    const navBadge = document.getElementById("nav-actas-badge");

    if (elTotal) elTotal.textContent = total;
    if (elFin) elFin.textContent = fin;
    if (elProc) elProc.textContent = proc;
    if (navBadge) navBadge.textContent = total;
  }

  function renderActasCards() {
    const grid = document.getElementById("actas-cards-grid");
    if (!grid) return;

    if (!state.actas.length) {
      grid.innerHTML = `
        <div class="col-span-full glass-panel rounded-2xl p-10 text-center border border-slate-200/60 dark:border-white/5">
          <div class="w-14 h-14 mx-auto mb-3 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <i class="ri-file-text-line text-2xl"></i>
          </div>
          <h3 class="text-base font-bold text-slate-900 dark:text-white">No hay actas de instalación registradas</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">Crea tu primera acta de instalación con equipos de mochila, evidencias y firma digital.</p>
          <button type="button" onclick="openNewActaForm()" class="btn-brand-primary px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5">
            <i class="ri-add-line text-sm"></i> Nueva Acta de Instalación
          </button>
        </div>`;
      return;
    }

    grid.innerHTML = state.actas.map((a) => {
      const estado = a.detallesServicio?.estadoFinal || "En Proceso";
      const badgeCls = getStatusBadgeClass(estado);
      const techName = a.detallesServicio?.tecnicoNombre || "Sin técnico";
      const distrito = a.cliente?.distrito || "Sin distrito";
      const fecha = a.detallesServicio?.fecha || (a.createdAt ? a.createdAt.slice(0, 10) : "--");
      const clientName = a.cliente?.nombreCompleto || "Sin nombre";

      return `
        <div class="glass-panel rounded-2xl p-5 border border-slate-200/70 dark:border-white/10 flex flex-col justify-between gap-4 hover:border-blue-500/30 transition shadow-sm">
          <div class="space-y-3">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  FOLIO #${safeEsc(a.folioCompleto)}
                </div>
                <h3 class="text-base font-extrabold text-slate-900 dark:text-white truncate mt-0.5" title="${safeEsc(clientName)}">
                  ${safeEsc(clientName)}
                </h3>
              </div>
              <span class="shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide text-center leading-tight ${badgeCls}">
                ${safeEsc(estado)}
              </span>
            </div>

            <div class="rounded-xl bg-slate-100/80 dark:bg-white/[0.04] border border-slate-200/70 dark:border-white/10 p-3 flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl bg-orange-500/15 text-orange-500 flex items-center justify-center shrink-0">
                <i class="ri-group-line text-lg"></i>
              </div>
              <div class="min-w-0">
                <div class="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">TÉCNICO</div>
                <div class="text-xs font-extrabold text-slate-900 dark:text-white uppercase truncate">${safeEsc(techName)}</div>
              </div>
            </div>

            <div class="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-0.5">
              <span class="inline-flex items-center gap-1.5 truncate">
                <i class="ri-map-pin-line text-slate-400"></i> ${safeEsc(distrito)}
              </span>
              <span class="inline-flex items-center gap-1.5 font-mono shrink-0">
                <i class="ri-calendar-line text-slate-400"></i> ${safeEsc(fecha)}
              </span>
            </div>
          </div>

          <div class="space-y-2 pt-1">
            <div class="grid grid-cols-2 gap-2">
              <button type="button" onclick="downloadActaPdf('${safeEsc(a.publicToken)}')"
                class="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/25 transition">
                <i class="ri-file-pdf-2-line text-sm"></i> PDF
              </button>
              <button type="button" onclick="viewPublicActa('${safeEsc(a.publicToken)}')"
                class="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/25 transition">
                <i class="ri-fullscreen-line text-sm"></i> VER
              </button>
              <button type="button" onclick="editActaById('${safeEsc(a.id)}')"
                class="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/25 transition">
                <i class="ri-pencil-line text-sm"></i> EDITAR
              </button>
              <button type="button" onclick="sendActaWhatsApp('${safeEsc(a.id)}')"
                class="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/25 transition">
                <i class="ri-whatsapp-line text-sm"></i> WHATSAPP
              </button>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <button type="button" onclick="copyActaPublicLink('${safeEsc(a.publicToken)}')"
                class="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold bg-slate-200/70 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 border border-slate-300/70 dark:border-white/10 transition">
                <i class="ri-link text-sm"></i> COPIAR ENLACE
              </button>
              <button type="button" onclick="cloneActaById('${safeEsc(a.id)}')"
                class="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/25 transition">
                <i class="ri-file-copy-line text-sm"></i> DUPLICAR
              </button>
            </div>

            <button type="button" onclick="deleteActaById('${safeEsc(a.id)}', '${safeEsc(a.folioCompleto)}')"
              class="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold border border-dashed border-slate-300 dark:border-white/15 text-slate-500 hover:text-rose-500 hover:border-rose-500/40 transition">
              <i class="ri-delete-bin-line text-sm"></i> ELIMINAR ACTA
            </button>
          </div>
        </div>
      `;
    }).join("");
  }

  // ==========================================================================
  // EXPORTAR A EXCEL (xlsx.full.min.js)
  // ==========================================================================
  window.exportActasToExcel = function () {
    if (typeof XLSX === "undefined") {
      return toast("Librería Excel no disponible", "error");
    }
    if (!state.actas.length) {
      return toast("No hay actas para exportar", "warning");
    }
    const rows = state.actas.map((a) => ({
      Folio: a.folioCompleto,
      Fecha: a.detallesServicio?.fecha || "",
      Estado: a.detallesServicio?.estadoFinal || "",
      Tipo: a.detallesServicio?.tipo || "",
      Cliente: a.cliente?.nombreCompleto || "",
      "DNI / RUC": a.cliente?.dniRuc || "",
      Distrito: a.cliente?.distrito || "",
      Dirección: a.cliente?.direccion || "",
      WhatsApp: a.cliente?.whatsappPrincipal || "",
      Técnico: a.detallesServicio?.tecnicoNombre || "",
      Plan: a.detallesServicio?.servicioContratadoNombre || "",
      "NAP / Caja": a.plantaExterna?.napCaja || "",
      Puerto: a.plantaExterna?.puerto || "",
      "Potencia dBm": a.plantaExterna?.potenciaDbm || "",
      Equipos: (a.equipos || []).map((e) => `${e.accion}: ${e.modeloMarca} (${e.serieMac || "S/N"})`).join(" | "),
      Materiales: (a.materiales || []).map((m) => `${m.descripcion} x${m.cantidad} ${m.unidad}`).join(" | "),
      "Enlace Público": `${window.location.origin}/acta/${a.publicToken}`,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Actas");
    XLSX.writeFile(wb, `Actas_Instalacion_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast("Reporte Excel descargado", "success");
  };

  // ==========================================================================
  // CONVERTIR ORDEN DE APARTADOS EN ACTA
  // ==========================================================================
  window.openActaFromOrderModal = async function () {
    const modal = document.getElementById("acta-orders-modal");
    const listEl = document.getElementById("acta-orders-list");
    if (!modal || !listEl) return;
    modal.classList.remove("hidden");
    listEl.innerHTML = `<div class="text-xs text-slate-400 text-center py-6">Cargando órdenes de instalación...</div>`;

    try {
      const res = await api("/api/apartados/installations");
      state.orders = Array.isArray(res?.data) ? res.data : [];
      if (!state.orders.length) {
        listEl.innerHTML = `<div class="text-xs text-slate-400 text-center py-6">No hay órdenes de instalación en Apartados.</div>`;
        return;
      }
      listEl.innerHTML = state.orders.map((o) => `
        <div class="p-3 rounded-xl bg-white/5 border border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div class="min-w-0">
            <div class="text-xs font-bold text-white">${safeEsc(o.customerName)} <span class="text-cyan-400 font-mono">(${safeEsc(o.code || o.id)})</span></div>
            <div class="text-[11px] text-slate-400 truncate">${safeEsc(o.address)} · NAP: ${safeEsc(o.napCode || "--")} / ${safeEsc(o.napPort || "--")} · Plan: ${safeEsc(o.planName || "--")}</div>
            <div class="text-[10px] text-slate-500">Técnico: ${safeEsc(o.assignedTechName || "Sin asignar")} · Estado: ${safeEsc(o.status)}</div>
          </div>
          <button type="button" onclick="convertOrderToActa('${safeEsc(o.id)}')" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shrink-0">
            Usar Orden
          </button>
        </div>`).join("");
    } catch (err) {
      listEl.innerHTML = `<div class="text-xs text-rose-400 text-center py-6">Error cargando órdenes: ${safeEsc(err.message)}</div>`;
    }
  };

  window.convertOrderToActa = async function (orderId) {
    const o = state.orders.find((x) => x.id === orderId);
    document.getElementById("acta-orders-modal")?.classList.add("hidden");
    if (!o) return;

    await openNewActaForm();
    setVal("acta-cliente-id", o.customerId || "");
    setVal("acta-cliente-nombre", o.customerName || "");
    setVal("acta-cliente-dni", o.customerDni || "");
    setVal("acta-cliente-direccion", o.address || "");
    setVal("acta-cliente-referencia", o.reference || "");
    setVal("acta-cliente-whatsapp", o.customerPhone || "");
    if (o.lat) setVal("acta-cliente-lat", o.lat);
    if (o.lng) setVal("acta-cliente-lng", o.lng);
    setVal("acta-pe-nap", o.napCode || "");
    setVal("acta-pe-puerto", o.napPort || "");
    setVal("acta-firma-cliente-nombre", o.customerName || "");

    if (o.planName) {
      const planMatch = state.plans.find((p) => p.name.toLowerCase() === o.planName.toLowerCase());
      if (planMatch) {
        setVal("acta-plan-select", planMatch.id);
        onActaPlanChange();
      }
    }
    if (o.assignedTechId) {
      setVal("acta-tecnico-select", o.assignedTechId);
      await loadTechnicianMochila(o.assignedTechId);
    }
    toast(`Orden ${o.code || o.id} cargada en nueva acta`, "success");
  };

  // ==========================================================================
  // ACCIONES DE CARD
  // ==========================================================================
  window.downloadActaPdf = function (publicToken) {
    window.open(`/acta/${encodeURIComponent(publicToken)}?print=1`, "_blank");
  };

  window.viewPublicActa = function (publicToken) {
    window.open(`/acta/${encodeURIComponent(publicToken)}`, "_blank");
  };

  window.copyActaPublicLink = function (publicToken) {
    const url = `${window.location.origin}/acta/${publicToken}`;
    navigator.clipboard.writeText(url).then(() => {
      toast("Enlace público copiado al portapapeles", "success");
    }).catch(() => {
      toast("No se pudo copiar el enlace", "error");
    });
  };

  window.sendActaWhatsApp = async function (id) {
    try {
      const res = await api(`/api/actas/${encodeURIComponent(id)}/send-whatsapp`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (res?.sentDirect) {
        toast("Acta enviada por WhatsApp directamente", "success");
      } else if (res?.waUrl) {
        window.open(res.waUrl, "_blank");
        toast("Abriendo WhatsApp con el enlace del acta", "info");
      } else {
        toast(res?.message || "No se pudo preparar envío por WhatsApp", "error");
      }
    } catch (err) {
      toast("Error al enviar por WhatsApp: " + err.message, "error");
    }
  };

  window.deleteActaById = async function (id, folio) {
    if (!confirm(`¿Eliminar el Acta #${folio}? Esta acción no se puede deshacer.`)) return;
    try {
      const res = await api(`/api/actas/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (res?.success) {
        toast(`Acta #${folio} eliminada`, "success");
        await loadActasList();
      } else {
        toast(res?.message || "No se pudo eliminar", "error");
      }
    } catch (err) {
      toast("Error al eliminar: " + err.message, "error");
    }
  };

  window.cloneActaById = async function (id) {
    const orig = state.actas.find((a) => a.id === id);
    if (!orig) return;
    await openNewActaForm();
    setVal("acta-cliente-id", orig.cliente?.customerId || "");
    setVal("acta-cliente-nombre", orig.cliente?.nombreCompleto || "");
    setVal("acta-cliente-dni", orig.cliente?.dniRuc || "");
    setVal("acta-cliente-direccion", orig.cliente?.direccion || "");
    setVal("acta-cliente-distrito", orig.cliente?.distrito || "");
    setVal("acta-cliente-referencia", orig.cliente?.referencia || "");
    setVal("acta-cliente-whatsapp", orig.cliente?.whatsappPrincipal || "");
    setVal("acta-cliente-celular", orig.cliente?.celularAlternativo || "");
    setVal("acta-cliente-lat", orig.cliente?.latitud || "");
    setVal("acta-cliente-lng", orig.cliente?.longitud || "");
    setVal("acta-pe-nodo", orig.plantaExterna?.nodoCluster || "");
    setVal("acta-pe-nap", orig.plantaExterna?.napCaja || "");
    setVal("acta-pe-puerto", orig.plantaExterna?.puerto || "");
    setVal("acta-plan-select", orig.detallesServicio?.servicioContratadoId || "");
    onActaPlanChange();
    setVal("acta-firma-cliente-nombre", orig.cliente?.nombreCompleto || "");
    toast(`Datos duplicados desde Acta #${orig.folioCompleto}`, "info");
  };

  // ==========================================================================
  // NAVEGACIÓN LISTA <-> FORMULARIO & BORRADOR OFFLINE
  // ==========================================================================
  window.showActasListView = function () {
    document.getElementById("actas-list-view")?.classList.remove("hidden");
    document.getElementById("actas-form-view")?.classList.add("hidden");
    stopCameraModal();
    stopActaQrScanner();
  };

  window.showActasFormView = function () {
    document.getElementById("actas-list-view")?.classList.add("hidden");
    document.getElementById("actas-form-view")?.classList.remove("hidden");
    setTimeout(() => {
      initSignaturePad("cliente");
      initSignaturePad("tecnico");
    }, 60);
  };

  function attachDraftAutoSaveListeners() {
    const form = document.getElementById("actas-form-view");
    if (!form || form.dataset.draftBound) return;
    form.dataset.draftBound = "1";
    form.addEventListener("input", () => {
      if (!state.editingId) saveActaDraftToLocal();
    });
    form.addEventListener("change", () => {
      if (!state.editingId) saveActaDraftToLocal();
    });
  }

  function saveActaDraftToLocal() {
    try {
      const draft = {
        savedAt: new Date().toISOString(),
        fields: {
          "acta-cliente-id": getVal("acta-cliente-id"),
          "acta-cliente-nombre": getVal("acta-cliente-nombre"),
          "acta-cliente-dni": getVal("acta-cliente-dni"),
          "acta-cliente-qr": getVal("acta-cliente-qr"),
          "acta-cliente-direccion": getVal("acta-cliente-direccion"),
          "acta-cliente-distrito": getVal("acta-cliente-distrito"),
          "acta-cliente-referencia": getVal("acta-cliente-referencia"),
          "acta-cliente-whatsapp": getVal("acta-cliente-whatsapp"),
          "acta-cliente-celular": getVal("acta-cliente-celular"),
          "acta-cliente-lat": getVal("acta-cliente-lat"),
          "acta-cliente-lng": getVal("acta-cliente-lng"),
          "acta-pe-nodo": getVal("acta-pe-nodo"),
          "acta-pe-nap": getVal("acta-pe-nap"),
          "acta-pe-puerto": getVal("acta-pe-puerto"),
          "acta-pe-potencia": getVal("acta-pe-potencia"),
          "acta-pe-atenuacion": getVal("acta-pe-atenuacion"),
          "acta-pe-drop": getVal("acta-pe-drop"),
          "acta-pe-precinto": getVal("acta-pe-precinto"),
          "acta-plan-select": getVal("acta-plan-select"),
          "acta-tecnico-select": getVal("acta-tecnico-select"),
          "acta-ssid": getVal("acta-ssid"),
          "acta-wifi-pass": getVal("acta-wifi-pass"),
          "acta-speed-dl": getVal("acta-speed-dl"),
          "acta-speed-ul": getVal("acta-speed-ul"),
          "acta-observaciones": getVal("acta-observaciones"),
        },
        equipos: state.equipos,
        materiales: state.materiales,
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {}
  }

  window.restoreActaDraft = async function () {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft.fields) {
        Object.entries(draft.fields).forEach(([id, v]) => setVal(id, v));
      }
      if (Array.isArray(draft.equipos)) state.equipos = draft.equipos;
      if (Array.isArray(draft.materiales)) state.materiales = draft.materiales;
      if (draft.fields?.["acta-tecnico-select"]) {
        await loadTechnicianMochila(draft.fields["acta-tecnico-select"]);
      }
      renderEquiposList();
      renderMaterialesList();
      document.getElementById("acta-draft-banner")?.classList.add("hidden");
      toast("Borrador restaurado", "success");
    } catch {}
  };

  window.discardActaDraft = function () {
    localStorage.removeItem(DRAFT_KEY);
    document.getElementById("acta-draft-banner")?.classList.add("hidden");
    toast("Borrador descartado", "info");
  };

  window.openNewActaForm = async function () {
    state.editingId = null;
    state.currentPublicToken = null;
    state.equipos = [];
    state.materiales = [];
    state.evidencias = [];
    state.firmaCliente = null;
    state.firmaTecnico = null;

    resetActaFormFields();
    document.getElementById("acta-history-box")?.classList.add("hidden");
    document.getElementById("acta-save-customer-wrap")?.classList.remove("hidden");

    const hasDraft = Boolean(localStorage.getItem(DRAFT_KEY));
    document.getElementById("acta-draft-banner")?.classList.toggle("hidden", !hasDraft);

    try {
      const res = await api("/api/actas/next-folio");
      if (res?.data) {
        document.getElementById("acta-prefijo-display").textContent = res.data.prefijo;
        document.getElementById("acta-folio-display").textContent = res.data.folioNumero;
        document.getElementById("acta-prefijo-input").value = res.data.prefijo;
        document.getElementById("acta-folio-input").value = res.data.folioNumero;
      }
    } catch {}

    const user = window.currentUser;
    const techSel = document.getElementById("acta-tecnico-select");
    if (user && techSel) {
      const matched = state.employees.find(
        (e) =>
          (e.dni && user.dni && e.dni === user.dni) ||
          (e.fullName && user.name && e.fullName.toLowerCase() === user.name.toLowerCase())
      );
      if (matched) {
        techSel.value = String(matched.id);
        await loadTechnicianMochila(matched.id);
      }
    }

    renderEquiposList();
    renderMaterialesList();
    renderEvidenciasGrid();
    showActasFormView();
  };

  window.editActaById = async function (id) {
    try {
      const res = await api(`/api/actas/${encodeURIComponent(id)}`);
      const acta = res?.data;
      if (!acta) return toast("Acta no encontrada", "error");

      state.editingId = acta.id;
      state.currentPublicToken = acta.publicToken;
      state.equipos = JSON.parse(JSON.stringify(acta.equipos || []));
      state.materiales = JSON.parse(JSON.stringify(acta.materiales || []));
      state.evidencias = JSON.parse(JSON.stringify(acta.evidencias || []));
      state.firmaCliente = acta.firmaCliente || null;
      state.firmaTecnico = acta.firmaTecnico || null;

      resetActaFormFields();
      document.getElementById("acta-draft-banner")?.classList.add("hidden");
      document.getElementById("acta-save-customer-wrap")?.classList.add("hidden");

      const histBox = document.getElementById("acta-history-box");
      const histSum = document.getElementById("acta-history-summary");
      if (histBox && histSum) {
        const lastEdit = acta.historialEdiciones?.[0];
        histSum.innerHTML = `<i class="ri-history-line text-blue-400"></i> Creado por <strong>${safeEsc(acta.createdBy || "Sistema")}</strong> (${safeEsc((acta.createdAt || "").slice(0, 16).replace("T", " "))})` +
          (lastEdit ? ` · Última edición: <strong>${safeEsc(lastEdit.user)}</strong> (${safeEsc(lastEdit.date.slice(0, 16).replace("T", " "))})` : "");
        histBox.classList.remove("hidden");
      }

      document.getElementById("acta-prefijo-display").textContent = acta.prefijo || "LIM-";
      document.getElementById("acta-folio-display").textContent = acta.folioNumero || "000001";
      document.getElementById("acta-prefijo-input").value = acta.prefijo || "LIM-";
      document.getElementById("acta-folio-input").value = acta.folioNumero || "000001";

      setVal("acta-cliente-id", acta.cliente?.customerId || "");
      setVal("acta-cliente-nombre", acta.cliente?.nombreCompleto || "");
      setVal("acta-cliente-dni", acta.cliente?.dniRuc || "");
      setVal("acta-cliente-qr", acta.cliente?.rotuladoQr || "");
      setVal("acta-cliente-direccion", acta.cliente?.direccion || "");
      setVal("acta-cliente-distrito", acta.cliente?.distrito || "");
      setVal("acta-cliente-referencia", acta.cliente?.referencia || "");
      setVal("acta-cliente-whatsapp", acta.cliente?.whatsappPrincipal || "");
      setVal("acta-cliente-celular", acta.cliente?.celularAlternativo || "");
      setVal("acta-cliente-lat", acta.cliente?.latitud || "");
      setVal("acta-cliente-lng", acta.cliente?.longitud || "");

      setVal("acta-pe-nodo", acta.plantaExterna?.nodoCluster || "");
      setVal("acta-pe-nap", acta.plantaExterna?.napCaja || "");
      setVal("acta-pe-puerto", acta.plantaExterna?.puerto || "");
      setVal("acta-pe-potencia", acta.plantaExterna?.potenciaDbm || "");
      setVal("acta-pe-atenuacion", acta.plantaExterna?.atenuacionEmpalme || "");
      setVal("acta-pe-drop", acta.plantaExterna?.dropMetros || "");
      setVal("acta-pe-precinto", acta.plantaExterna?.precinto || "");
      updatePotenciaIndicator();

      setVal("acta-fecha", acta.detallesServicio?.fecha || new Date().toISOString().slice(0, 10));
      setVal("acta-hora-inicio", acta.detallesServicio?.horaInicio || "");
      setVal("acta-hora-fin", acta.detallesServicio?.horaFin || "");
      setVal("acta-tipo", acta.detallesServicio?.tipo || "Instalación");
      setVal("acta-estado", acta.detallesServicio?.estadoFinal || "En Proceso");
      setVal("acta-plan-select", acta.detallesServicio?.servicioContratadoId || "");
      setVal("acta-tecnico-select", acta.detallesServicio?.tecnicoId || "");

      setVal("acta-ssid", acta.detallesServicio?.ssidWifi || "");
      setVal("acta-wifi-pass", acta.detallesServicio?.passwordWifi || "");
      setVal("acta-speed-dl", acta.detallesServicio?.speedDl || "");
      setVal("acta-speed-ul", acta.detallesServicio?.speedUl || "");
      setVal("acta-num-tvs", acta.detallesServicio?.numTvs || "");
      setVal("acta-splitters", acta.detallesServicio?.splitters || "");
      setVal("acta-senal-low", acta.detallesServicio?.senalLow || "");
      setVal("acta-vlan", acta.detallesServicio?.vlanPppoe || "");

      setVal("acta-observaciones", acta.observaciones || "");
      setVal("acta-firma-cliente-nombre", acta.firmaCliente?.firmanteNombre || acta.cliente?.nombreCompleto || "");

      if (acta.detallesServicio?.tecnicoId) {
        await loadTechnicianMochila(acta.detallesServicio.tecnicoId);
      }

      renderEquiposList();
      renderMaterialesList();
      renderEvidenciasGrid();
      showActasFormView();

      setTimeout(() => {
        loadSignaturePreview("cliente", acta.firmaCliente?.imageUrl);
        loadSignaturePreview("tecnico", acta.firmaTecnico?.imageUrl);
      }, 100);
    } catch (err) {
      toast("Error cargando acta: " + err.message, "error");
    }
  };

  function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val ?? "";
  }

  function getVal(id) {
    return document.getElementById(id)?.value?.trim() || "";
  }

  function resetActaFormFields() {
    const ids = [
      "acta-cliente-search", "acta-cliente-id", "acta-cliente-nombre", "acta-cliente-dni",
      "acta-cliente-qr", "acta-cliente-direccion", "acta-cliente-distrito", "acta-cliente-referencia",
      "acta-cliente-whatsapp", "acta-cliente-celular", "acta-cliente-lat", "acta-cliente-lng",
      "acta-pe-nodo", "acta-pe-nap", "acta-pe-puerto", "acta-pe-potencia", "acta-pe-atenuacion",
      "acta-pe-drop", "acta-pe-precinto", "acta-hora-inicio", "acta-hora-fin",
      "acta-plan-select", "acta-tecnico-select", "acta-ssid", "acta-wifi-pass",
      "acta-speed-dl", "acta-speed-ul", "acta-num-tvs", "acta-splitters",
      "acta-senal-low", "acta-vlan", "acta-observaciones", "acta-firma-cliente-nombre",
    ];
    ids.forEach((id) => setVal(id, ""));
    setVal("acta-fecha", new Date().toISOString().slice(0, 10));
    setVal("acta-tipo", "Instalación");
    setVal("acta-estado", "En Proceso");
    document.getElementById("acta-nap-suggestions")?.classList.add("hidden");
    const chkCust = document.getElementById("acta-save-customer-check");
    if (chkCust) chkCust.checked = false;
    state.mochilaEquipos = [];
    state.mochilaMateriales = [];
    renderMochilaPanels();
    clearSignaturePad("cliente");
    clearSignaturePad("tecnico");
  }

  // ==========================================================================
  // AUTOCOMPLETADO, RENIEC/SUNAT, GPS + MAPAS FTTH (NAP CERCANA), OCR
  // ==========================================================================
  window.searchCustomersForActa = function (query) {
    const box = document.getElementById("acta-cliente-autocomplete");
    if (!box) return;
    const q = (query || "").trim().toLowerCase();
    if (q.length < 2) {
      box.classList.add("hidden");
      return;
    }
    const matches = state.customers.filter((c) => {
      const hay = `${c.name || ""} ${c.fullName || ""} ${c.dni || ""} ${c.ruc || ""} ${c.identification || ""} ${c.customerCode || ""}`.toLowerCase();
      return hay.includes(q);
    }).slice(0, 8);

    if (!matches.length) {
      box.innerHTML = `<div class="p-3 text-xs text-slate-400">Sin clientes coincidentes</div>`;
      box.classList.remove("hidden");
      return;
    }

    box.innerHTML = matches.map((c) => `
      <button type="button" onclick="selectCustomerForActa('${safeEsc(c.id)}')"
        class="w-full text-left px-3 py-2.5 hover:bg-blue-500/10 border-b border-slate-200/50 dark:border-white/5 last:border-0 transition">
        <div class="text-xs font-bold text-slate-900 dark:text-white">${safeEsc(c.fullName || c.name)}</div>
        <div class="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
          ${c.identification || c.dni || c.ruc ? `Doc: ${safeEsc(c.identification || c.dni || c.ruc)}` : ""} ${c.phone ? `· Tel: ${safeEsc(c.phone)}` : ""} ${c.address ? `· ${safeEsc(c.address)}` : ""}
        </div>
      </button>`).join("");
    box.classList.remove("hidden");
  };

  window.selectCustomerForActa = function (customerId) {
    const c = state.customers.find((x) => String(x.id) === String(customerId));
    document.getElementById("acta-cliente-autocomplete")?.classList.add("hidden");
    if (!c) return;

    setVal("acta-cliente-id", c.id);
    setVal("acta-cliente-nombre", c.fullName || c.name || "");
    setVal("acta-cliente-dni", c.identification || c.dni || c.ruc || "");
    setVal("acta-cliente-direccion", c.address || "");
    setVal("acta-cliente-distrito", c.district || c.city || "");
    setVal("acta-cliente-referencia", c.reference || "");
    setVal("acta-cliente-whatsapp", c.phone || c.whatsapp || "");
    if (c.latitude || c.lat) setVal("acta-cliente-lat", c.latitude || c.lat);
    if (c.longitude || c.lng) setVal("acta-cliente-lng", c.longitude || c.lng);
    setVal("acta-firma-cliente-nombre", c.fullName || c.name || "");

    const pId = c.serviceId || c.planId;
    if (pId) {
      setVal("acta-plan-select", pId);
      onActaPlanChange();
    }
    toast("Datos del cliente autocompletados", "success");
  };

  window.lookupActaSunatReniec = async function () {
    const doc = getVal("acta-cliente-dni").replace(/\D/g, "");
    if (doc.length !== 8 && doc.length !== 11) {
      return toast("Ingresa un DNI (8 dígitos) o RUC (11 dígitos)", "error");
    }
    try {
      const endpoint = doc.length === 11
        ? `/api/settings/connections/jsonpe/ruc/${doc}`
        : `/api/settings/connections/jsonpe/dni/${doc}`;
      const res = await api(endpoint);
      if (res?.success && res?.data) {
        const d = res.data;
        if (doc.length === 11) {
          setVal("acta-cliente-nombre", d.razonSocial || "");
          if (d.direccion) setVal("acta-cliente-direccion", d.direccion);
        } else {
          const full = d.nombreCompleto || `${d.nombres || ""} ${d.apellidoPaterno || ""} ${d.apellidoMaterno || ""}`.trim();
          setVal("acta-cliente-nombre", full);
        }
        setVal("acta-firma-cliente-nombre", getVal("acta-cliente-nombre"));
        toast("Consulta RENIEC / SUNAT exitosa", "success");
      } else {
        toast(res?.message || "No se encontró el documento", "error");
      }
    } catch (err) {
      toast("Error consultando RENIEC/SUNAT: " + err.message, "error");
    }
  };

  window.captureActaGps = function () {
    if (!navigator.geolocation) {
      return toast("Tu navegador no soporta geolocalización GPS", "error");
    }
    toast("Obteniendo coordenadas GPS...", "info");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setVal("acta-cliente-lat", pos.coords.latitude.toFixed(6));
        setVal("acta-cliente-lng", pos.coords.longitude.toFixed(6));
        toast("Coordenadas GPS capturadas", "success");
        suggestNearestNapsFromMaps(true);
      },
      (err) => {
        toast("No se pudo obtener GPS: " + err.message, "error");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  function haversineMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  window.suggestNearestNapsFromMaps = async function (silentIfNoGps = false) {
    const lat = parseFloat(getVal("acta-cliente-lat"));
    const lng = parseFloat(getVal("acta-cliente-lng"));
    const box = document.getElementById("acta-nap-suggestions");
    if (isNaN(lat) || isNaN(lng)) {
      if (!silentIfNoGps) toast("Captura o ingresa primero Latitud y Longitud GPS", "warning");
      return;
    }
    try {
      const res = await api("/api/maps/data");
      const nodes = res?.data?.nodes || [];
      const naps = nodes
        .filter((n) => n.type === "nap" && typeof n.lat === "number" && typeof n.lng === "number")
        .map((n) => {
          const dist = haversineMeters(lat, lng, n.lat, n.lng);
          const slots = Array.isArray(n.napSlots) ? n.napSlots : [];
          const freePorts = slots.filter((s) => s.status === "empty").map((s) => s.port);
          return { id: n.id, name: n.name, dist, freePorts, threads: n.napThreads || slots.length || 8 };
        })
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 3);

      if (!box) return;
      if (!naps.length) {
        box.innerHTML = `<div class="text-xs text-slate-400">No se encontraron NAPs registradas en Mapas FTTH.</div>`;
        box.classList.remove("hidden");
        return;
      }

      box.innerHTML = `<div class="text-[11px] font-bold uppercase text-purple-400">NAPs más cercanas al GPS del cliente:</div>` +
        `<div class="flex flex-wrap gap-2">` +
        naps.map((n) => {
          const nextPort = n.freePorts[0] ? `Puerto ${n.freePorts[0]}` : "Puerto 1";
          return `
            <button type="button" onclick="applyNapSuggestion('${safeEsc(n.name)}', '${safeEsc(nextPort)}')"
              class="px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-500/15 hover:bg-purple-500/25 text-purple-200 border border-purple-500/30 inline-flex items-center gap-2">
              <i class="ri-map-pin-2-line text-purple-400"></i>
              <span>${safeEsc(n.name)}</span>
              <span class="font-mono text-[10px] text-slate-300">${n.dist}m</span>
              <span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px]">${n.freePorts.length} libres</span>
            </button>`;
        }).join("") + `</div>`;
      box.classList.remove("hidden");
    } catch {}
  };

  window.applyNapSuggestion = function (napName, portLabel) {
    setVal("acta-pe-nap", napName);
    setVal("acta-pe-puerto", portLabel);
    toast(`Asignado ${napName} (${portLabel})`, "success");
  };

  window.setNowTimeForActa = function (inputId) {
    const now = new Date();
    setVal(inputId, `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
  };

  window.updatePotenciaIndicator = function () {
    const val = parseFloat(getVal("acta-pe-potencia"));
    const badge = document.getElementById("acta-potencia-badge");
    if (!badge) return;
    if (isNaN(val)) {
      badge.className = "hidden";
      return;
    }
    if (val >= -24 && val <= -12) {
      badge.textContent = "Óptima";
      badge.className = "px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-400";
    } else if (val < -24 && val >= -27) {
      badge.textContent = "Aceptable";
      badge.className = "px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-400";
    } else {
      badge.textContent = "Crítica";
      badge.className = "px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/15 text-rose-400";
    }
  };

  window.generateActaRotuladoQr = function () {
    const folio = (getVal("acta-prefijo-input") || "LIM-") + (getVal("acta-folio-input") || "000001");
    const dni = getVal("acta-cliente-dni") || "SN";
    const code = `TN-${folio}-${dni}`;
    setVal("acta-cliente-qr", code);
    toast("Código de rotulado generado: " + code, "success");
  };

  // ==========================================================================
  // ESCÁNER QR / CÓDIGO DE BARRAS EN VIVO (BarcodeDetector + jsQR)
  // ==========================================================================
  window.openActaQrScanner = async function (onResult) {
    state.qrCallback = onResult;
    const modal = document.getElementById("acta-qr-modal");
    const video = document.getElementById("acta-qr-video");
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return toast("Cámara no disponible en este navegador", "error");
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      state.qrStream = stream;
      video.srcObject = stream;
      await video.play();
      modal?.classList.remove("hidden");

      const detector = ("BarcodeDetector" in window)
        ? new window.BarcodeDetector({ formats: ["qr_code", "code_128", "code_39", "ean_13"] })
        : null;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      const scanFrame = async () => {
        if (!state.qrStream) return;
        if (video.readyState >= 2) {
          if (detector) {
            try {
              const codes = await detector.detect(video);
              if (codes && codes.length && codes[0].rawValue) {
                const val = codes[0].rawValue.trim();
                stopActaQrScanner();
                if (state.qrCallback) state.qrCallback(val);
                toast("Código escaneado: " + val, "success");
                return;
              }
            } catch {}
          }
          if (typeof jsQR !== "undefined") {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const qr = jsQR(imgData.data, imgData.width, imgData.height);
            if (qr && qr.data) {
              const val = qr.data.trim();
              stopActaQrScanner();
              if (state.qrCallback) state.qrCallback(val);
              toast("QR escaneado: " + val, "success");
              return;
            }
          }
        }
        state.qrRafId = requestAnimationFrame(scanFrame);
      };
      state.qrRafId = requestAnimationFrame(scanFrame);
    } catch (err) {
      toast("No se pudo abrir la cámara: " + err.message, "error");
    }
  };

  window.stopActaQrScanner = function () {
    if (state.qrRafId) {
      cancelAnimationFrame(state.qrRafId);
      state.qrRafId = null;
    }
    if (state.qrStream) {
      state.qrStream.getTracks().forEach((t) => t.stop());
      state.qrStream = null;
    }
    document.getElementById("acta-qr-modal")?.classList.add("hidden");
  };

  window.runActaOcrScan = function (mode) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (typeof Tesseract === "undefined") {
        return toast("Motor OCR no disponible", "error");
      }
      toast("Analizando imagen con OCR...", "info");
      try {
        const result = await Tesseract.recognize(file, "eng");
        const text = result?.data?.text || "";
        if (mode === "dni") {
          const dniMatch = text.match(/\b\d{8}\b/);
          if (dniMatch) {
            setVal("acta-cliente-dni", dniMatch[0]);
            toast("DNI detectado: " + dniMatch[0], "success");
            lookupActaSunatReniec();
          } else {
            toast("No se detectó un DNI de 8 dígitos claro", "warning");
          }
        } else if (mode === "ssid") {
          const ssidMatch = text.match(/SSID[:\s]*([^\s\n]+)/i);
          if (ssidMatch) {
            setVal("acta-ssid", ssidMatch[1]);
            toast("SSID detectado: " + ssidMatch[1], "success");
          } else {
            const firstLine = text.split("\n").map((l) => l.trim()).find((l) => l.length >= 4);
            if (firstLine) setVal("acta-ssid", firstLine);
            toast("Texto OCR extraído", "info");
          }
        } else if (mode === "pass") {
          const passMatch = text.match(/(?:PASS(?:WORD)?|KEY|CLAVE|WPA)[:\s]*([^\s\n]+)/i);
          if (passMatch) {
            setVal("acta-wifi-pass", passMatch[1]);
            toast("Clave detectada", "success");
          } else {
            const firstLine = text.split("\n").map((l) => l.trim()).find((l) => l.length >= 6);
            if (firstLine) setVal("acta-wifi-pass", firstLine);
            toast("Texto OCR extraído", "info");
          }
        }
      } catch (err) {
        toast("Error en OCR: " + err.message, "error");
      }
    };
    input.click();
  };

  // ==========================================================================
  // MOCHILA DEL TÉCNICO -> EQUIPOS Y MATERIALES
  // ==========================================================================
  window.onActaTechnicianChange = async function () {
    const techId = getVal("acta-tecnico-select");
    if (!techId) {
      state.mochilaEquipos = [];
      state.mochilaMateriales = [];
      renderMochilaPanels();
      return;
    }
    await loadTechnicianMochila(techId);
  };

  async function loadTechnicianMochila(employeeId) {
    try {
      const res = await api(`/api/actas/technician-mochila/${encodeURIComponent(employeeId)}`);
      state.mochilaEquipos = res?.data?.equipos || [];
      state.mochilaMateriales = res?.data?.materiales || [];
      renderMochilaPanels();
    } catch (err) {
      console.error("[Actas] Error cargando mochila:", err);
    }
  }

  function renderMochilaPanels() {
    const eqBox = document.getElementById("acta-mochila-equipos-box");
    const matBox = document.getElementById("acta-mochila-materiales-box");

    if (eqBox) {
      if (!state.mochilaEquipos.length) {
        eqBox.innerHTML = `<span class="text-xs text-slate-400">Sin equipos disponibles en la mochila del técnico seleccionado.</span>`;
      } else {
        eqBox.innerHTML = state.mochilaEquipos.map((item) => {
          const alreadyAdded = state.equipos.some((e) => e.mochilaAssignmentId === item.assignmentId);
          return `
            <button type="button" ${alreadyAdded ? "disabled" : ""} onclick="addEquipoFromMochila('${safeEsc(item.assignmentId)}')"
              class="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                alreadyAdded
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400 cursor-default"
                  : "bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/30 text-purple-300"
              }">
              <i class="${alreadyAdded ? "ri-check-line" : "ri-add-circle-line"}"></i>
              <span>${safeEsc(item.productName)}</span>
              ${item.serialOrMac ? `<span class="font-mono text-[10px] opacity-80">[${safeEsc(item.serialOrMac)}]</span>` : ""}
              <span class="px-1.5 py-0.5 rounded bg-black/20 text-[10px] font-mono">x${item.quantity}</span>
            </button>`;
        }).join("");
      }
    }

    if (matBox) {
      if (!state.mochilaMateriales.length) {
        matBox.innerHTML = `<span class="text-xs text-slate-400">Sin materiales disponibles en la mochila del técnico seleccionado.</span>`;
      } else {
        matBox.innerHTML = state.mochilaMateriales.map((item) => {
          const alreadyAdded = state.materiales.some((m) => m.mochilaAssignmentId === item.assignmentId);
          return `
            <button type="button" ${alreadyAdded ? "disabled" : ""} onclick="addMaterialFromMochila('${safeEsc(item.assignmentId)}')"
              class="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                alreadyAdded
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400 cursor-default"
                  : "bg-cyan-500/10 hover:bg-cyan-500/20 border-cyan-500/30 text-cyan-300"
              }">
              <i class="${alreadyAdded ? "ri-check-line" : "ri-add-circle-line"}"></i>
              <span>${safeEsc(item.productName)}</span>
              <span class="px-1.5 py-0.5 rounded bg-black/20 text-[10px] font-mono">Disp: ${item.quantity} ${safeEsc(item.unit)}</span>
            </button>`;
        }).join("");
      }
    }
  }

  window.addEquipoFromMochila = function (assignmentId) {
    const item = state.mochilaEquipos.find((x) => x.assignmentId === assignmentId);
    if (!item) return;
    state.equipos.push({
      id: "eq-" + Date.now() + Math.random().toString(16).slice(2, 6),
      accion: "Instala",
      productId: item.productId,
      mochilaAssignmentId: item.assignmentId,
      modeloMarca: item.productName,
      serieMac: item.serialOrMac || "",
      propiedad: "Alquiler",
      unitSku: item.unitSku || "",
      desdeMochila: true,
      mochilaSynced: false,
    });
    renderEquiposList();
    renderMochilaPanels();
    toast(`${item.productName} agregado desde Mochila como Instala`, "success");
  };

  window.addManualEquipoRow = function () {
    state.equipos.push({
      id: "eq-" + Date.now() + Math.random().toString(16).slice(2, 6),
      accion: "Instala",
      modeloMarca: "",
      serieMac: "",
      propiedad: "Alquiler",
      desdeMochila: false,
    });
    renderEquiposList();
  };

  window.removeEquipoRow = function (idx) {
    state.equipos.splice(idx, 1);
    renderEquiposList();
    renderMochilaPanels();
  };

  window.updateEquipoField = function (idx, field, val) {
    if (!state.equipos[idx]) return;
    state.equipos[idx][field] = val;
  };

  window.scanEquipoSerialQr = function (idx) {
    openActaQrScanner((code) => {
      if (!state.equipos[idx]) return;
      state.equipos[idx].serieMac = code;
      renderEquiposList();
    });
  };

  function renderEquiposList() {
    const container = document.getElementById("acta-equipos-rows");
    if (!container) return;
    if (!state.equipos.length) {
      container.innerHTML = `<div class="text-xs text-slate-400 py-3 text-center">No hay equipos agregados. Selecciona de la mochila o haz clic en "+ Agregar Equipo".</div>`;
      return;
    }
    container.innerHTML = state.equipos.map((eq, idx) => `
      <div class="grid grid-cols-1 md:grid-cols-12 gap-2 items-center p-2.5 rounded-xl bg-slate-100/60 dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/10">
        <div class="md:col-span-2">
          <select onchange="updateEquipoField(${idx}, 'accion', this.value)" class="w-full px-2.5 py-2 rounded-lg text-xs bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white">
            <option value="Instala" ${eq.accion === "Instala" ? "selected" : ""}>Instala</option>
            <option value="Retira" ${eq.accion === "Retira" ? "selected" : ""}>Retira</option>
          </select>
        </div>
        <div class="md:col-span-4">
          <div class="relative flex items-center">
            <input type="text" value="${safeEsc(eq.modeloMarca)}" placeholder="Modelo / Marca..."
              oninput="updateEquipoField(${idx}, 'modeloMarca', this.value)"
              class="w-full px-2.5 py-2 rounded-lg text-xs bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white" />
            ${eq.desdeMochila ? `<span class="ml-1.5 shrink-0 px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[9.5px] font-bold">Mochila</span>` : ""}
          </div>
        </div>
        <div class="md:col-span-3 flex items-center gap-1">
          <input type="text" value="${safeEsc(eq.serieMac)}" placeholder="SN / MAC"
            oninput="updateEquipoField(${idx}, 'serieMac', this.value)"
            class="w-full px-2.5 py-2 rounded-lg text-xs font-mono bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white" />
          <button type="button" onclick="scanEquipoSerialQr(${idx})" title="Escanear QR / Código de Barras" class="shrink-0 w-8 h-8 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-400 flex items-center justify-center">
            <i class="ri-qr-scan-2-line"></i>
          </button>
        </div>
        <div class="md:col-span-2">
          <select onchange="updateEquipoField(${idx}, 'propiedad', this.value)" class="w-full px-2.5 py-2 rounded-lg text-xs bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white">
            <option value="Alquiler" ${eq.propiedad === "Alquiler" ? "selected" : ""}>Alquiler</option>
            <option value="Venta" ${eq.propiedad === "Venta" ? "selected" : ""}>Venta</option>
            <option value="Comodato" ${eq.propiedad === "Comodato" ? "selected" : ""}>Comodato</option>
            <option value="Propio" ${eq.propiedad === "Propio" ? "selected" : ""}>Propio</option>
          </select>
        </div>
        <div class="md:col-span-1 flex justify-end">
          <button type="button" onclick="removeEquipoRow(${idx})" class="w-8 h-8 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-500 flex items-center justify-center">
            <i class="ri-close-line"></i>
          </button>
        </div>
      </div>`).join("");
  }

  window.addMaterialFromMochila = function (assignmentId) {
    const item = state.mochilaMateriales.find((x) => x.assignmentId === assignmentId);
    if (!item) return;
    state.materiales.push({
      id: "mat-" + Date.now() + Math.random().toString(16).slice(2, 6),
      accion: "Instala",
      productId: item.productId,
      mochilaAssignmentId: item.assignmentId,
      descripcion: item.productName,
      cantidad: 1,
      unidad: item.unit || "Und",
      propiedad: "Alquiler",
      desdeMochila: true,
      mochilaSynced: false,
    });
    renderMaterialesList();
    renderMochilaPanels();
    toast(`${item.productName} agregado desde Mochila`, "success");
  };

  window.addManualMaterialRow = function () {
    state.materiales.push({
      id: "mat-" + Date.now() + Math.random().toString(16).slice(2, 6),
      accion: "Instala",
      descripcion: "",
      cantidad: 1,
      unidad: "Und",
      propiedad: "Alquiler",
      desdeMochila: false,
    });
    renderMaterialesList();
  };

  window.removeMaterialRow = function (idx) {
    state.materiales.splice(idx, 1);
    renderMaterialesList();
    renderMochilaPanels();
  };

  window.updateMaterialField = function (idx, field, val) {
    if (!state.materiales[idx]) return;
    state.materiales[idx][field] = field === "cantidad" ? Number(val || 1) : val;
  };

  window.quickSetMaterialQty = function (idx, delta) {
    if (!state.materiales[idx]) return;
    const cur = Number(state.materiales[idx].cantidad || 0);
    state.materiales[idx].cantidad = cur === 1 && delta >= 5 ? delta : cur + delta;
    renderMaterialesList();
  };

  function renderMaterialesList() {
    const container = document.getElementById("acta-materiales-rows");
    if (!container) return;
    if (!state.materiales.length) {
      container.innerHTML = `<div class="text-xs text-slate-400 py-3 text-center">No hay materiales agregados. Selecciona de la mochila o haz clic en "+ Agregar Material".</div>`;
      return;
    }
    container.innerHTML = state.materiales.map((mat, idx) => `
      <div class="p-2.5 rounded-xl bg-slate-100/60 dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/10 space-y-2">
        <div class="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
          <div class="md:col-span-2">
            <select onchange="updateMaterialField(${idx}, 'accion', this.value)" class="w-full px-2.5 py-2 rounded-lg text-xs bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white">
              <option value="Instala" ${mat.accion === "Instala" ? "selected" : ""}>Instala</option>
              <option value="Retira" ${mat.accion === "Retira" ? "selected" : ""}>Retira</option>
            </select>
          </div>
          <div class="md:col-span-4">
            <div class="relative flex items-center">
              <input type="text" value="${safeEsc(mat.descripcion)}" placeholder="Descripción material..."
                oninput="updateMaterialField(${idx}, 'descripcion', this.value)"
                class="w-full px-2.5 py-2 rounded-lg text-xs bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white" />
              ${mat.desdeMochila ? `<span class="ml-1.5 shrink-0 px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[9.5px] font-bold">Mochila</span>` : ""}
            </div>
          </div>
          <div class="md:col-span-1">
            <input type="number" min="1" value="${safeEsc(mat.cantidad)}"
              oninput="updateMaterialField(${idx}, 'cantidad', this.value)"
              class="w-full px-2.5 py-2 rounded-lg text-xs font-mono text-center bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white" />
          </div>
          <div class="md:col-span-2">
            <input type="text" value="${safeEsc(mat.unidad)}" placeholder="Und / m"
              oninput="updateMaterialField(${idx}, 'unidad', this.value)"
              class="w-full px-2.5 py-2 rounded-lg text-xs bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white" />
          </div>
          <div class="md:col-span-2">
            <select onchange="updateMaterialField(${idx}, 'propiedad', this.value)" class="w-full px-2.5 py-2 rounded-lg text-xs bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white">
              <option value="Alquiler" ${mat.propiedad === "Alquiler" ? "selected" : ""}>Alquiler</option>
              <option value="Incluido" ${mat.propiedad === "Incluido" ? "selected" : ""}>Incluido</option>
              <option value="Venta" ${mat.propiedad === "Venta" ? "selected" : ""}>Venta</option>
              <option value="Adicional" ${mat.propiedad === "Adicional" ? "selected" : ""}>Adicional</option>
            </select>
          </div>
          <div class="md:col-span-1 flex justify-end">
            <button type="button" onclick="removeMaterialRow(${idx})" class="w-8 h-8 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-500 flex items-center justify-center">
              <i class="ri-close-line"></i>
            </button>
          </div>
        </div>
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="text-[10px] text-slate-400">Cant. rápida:</span>
          <button type="button" onclick="quickSetMaterialQty(${idx}, 5)" class="px-2 py-0.5 rounded bg-white/10 hover:bg-blue-500/20 text-[10px] font-mono text-slate-300">+5</button>
          <button type="button" onclick="quickSetMaterialQty(${idx}, 10)" class="px-2 py-0.5 rounded bg-white/10 hover:bg-blue-500/20 text-[10px] font-mono text-slate-300">+10</button>
          <button type="button" onclick="quickSetMaterialQty(${idx}, 50)" class="px-2 py-0.5 rounded bg-white/10 hover:bg-blue-500/20 text-[10px] font-mono text-slate-300">+50</button>
          <button type="button" onclick="quickSetMaterialQty(${idx}, 100)" class="px-2 py-0.5 rounded bg-white/10 hover:bg-blue-500/20 text-[10px] font-mono text-slate-300">+100</button>
        </div>
      </div>`).join("");
  }

  // ==========================================================================
  // EVIDENCIAS FOTOGRÁFICAS (CÁMARA + GALERÍA + MINIATURA + CHECKLIST 4 FOTOS)
  // ==========================================================================
  const RECOMMENDED_EVIDENCE = [
    { key: "instalacion_fachada", label: "Fachada" },
    { key: "potencia_optica", label: "Power Meter" },
    { key: "router_equipos", label: "ONT / MAC" },
    { key: "test_velocidad", label: "Test Velocidad" },
  ];

  function renderEvidenceChecklist() {
    const box = document.getElementById("acta-evidence-checklist");
    if (!box) return;
    box.innerHTML = RECOMMENDED_EVIDENCE.map((item) => {
      const hasIt = state.evidencias.some((e) => e.categoria === item.key);
      return `
        <button type="button" onclick="takeEvidenceForCategory('${item.key}')"
          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
            hasIt
              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
              : "bg-slate-200/50 dark:bg-white/5 border-slate-300/60 dark:border-white/10 text-slate-400 hover:border-blue-500/40"
          }">
          <i class="${hasIt ? "ri-checkbox-circle-fill text-emerald-400" : "ri-camera-line"}"></i>
          <span>${item.label}</span>
        </button>`;
    }).join("");
  }

  window.takeEvidenceForCategory = function (catKey) {
    const sel = document.getElementById("acta-evidencia-categoria");
    if (sel) sel.value = catKey;
    openActaCameraModal();
  };

  async function compressAndMakeThumbnail(fileOrDataUrl) {
    const img = new Image();
    const src = typeof fileOrDataUrl === "string"
      ? fileOrDataUrl
      : await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(fileOrDataUrl);
        });

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = src;
    });

    const resizeTo = (maxDim, quality) => {
      const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * ratio));
      const h = Math.max(1, Math.round(img.height * ratio));
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      return c.toDataURL("image/jpeg", quality);
    };

    return {
      imageUrl: resizeTo(1280, 0.82),
      thumbnailUrl: resizeTo(260, 0.72),
    };
  }

  window.triggerActaGalleryUpload = function () {
    document.getElementById("acta-evidencia-file-input")?.click();
  };

  window.handleActaEvidenceFiles = async function (files) {
    if (!files || !files.length) return;
    const catSel = document.getElementById("acta-evidencia-categoria");
    const categoria = catSel?.value || "router_equipos";
    const titulo = catSel?.options[catSel.selectedIndex]?.text || "Evidencia";

    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      try {
        const { imageUrl, thumbnailUrl } = await compressAndMakeThumbnail(file);
        state.evidencias.push({
          id: "ev-" + Date.now() + Math.random().toString(16).slice(2, 6),
          categoria,
          titulo,
          imageUrl,
          thumbnailUrl,
          createdAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error("Error procesando imagen:", err);
      }
    }
    renderEvidenciasGrid();
    toast("Evidencia agregada como miniatura", "success");
  };

  window.openActaCameraModal = async function () {
    const modal = document.getElementById("acta-camera-modal");
    const video = document.getElementById("acta-camera-video");
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      document.getElementById("acta-evidencia-capture-input")?.click();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      state.cameraStream = stream;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
      modal?.classList.remove("hidden");
    } catch {
      document.getElementById("acta-evidencia-capture-input")?.click();
    }
  };

  window.capturePhotoFromActaCamera = async function () {
    const video = document.getElementById("acta-camera-video");
    if (!video || !video.videoWidth) return;

    const c = document.createElement("canvas");
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    c.getContext("2d").drawImage(video, 0, 0);
    const rawDataUrl = c.toDataURL("image/jpeg", 0.9);

    const { imageUrl, thumbnailUrl } = await compressAndMakeThumbnail(rawDataUrl);
    const catSel = document.getElementById("acta-evidencia-categoria");
    const categoria = catSel?.value || "router_equipos";
    const titulo = catSel?.options[catSel.selectedIndex]?.text || "Foto Cámara";

    state.evidencias.push({
      id: "ev-" + Date.now() + Math.random().toString(16).slice(2, 6),
      categoria,
      titulo,
      imageUrl,
      thumbnailUrl,
      createdAt: new Date().toISOString(),
    });

    renderEvidenciasGrid();
    stopCameraModal();
    toast("Foto capturada y guardada como miniatura", "success");
  };

  window.stopCameraModal = function () {
    if (state.cameraStream) {
      state.cameraStream.getTracks().forEach((t) => t.stop());
      state.cameraStream = null;
    }
    document.getElementById("acta-camera-modal")?.classList.add("hidden");
  };

  window.removeActaEvidencia = function (idx) {
    state.evidencias.splice(idx, 1);
    renderEvidenciasGrid();
  };

  function renderEvidenciasGrid() {
    renderEvidenceChecklist();
    const grid = document.getElementById("acta-evidencias-thumbnails");
    if (!grid) return;
    if (!state.evidencias.length) {
      grid.innerHTML = "";
      return;
    }
    grid.innerHTML = state.evidencias.map((ev, idx) => `
      <div class="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 bg-slate-900">
        <img src="${safeEsc(ev.thumbnailUrl || ev.imageUrl)}" alt="${safeEsc(ev.titulo)}"
          onclick="window.open('${safeEsc(ev.imageUrl)}', '_blank')"
          class="w-full h-24 object-cover cursor-pointer hover:opacity-90 transition" />
        <div class="px-2 py-1 text-[10px] font-semibold text-slate-200 truncate bg-black/50">${safeEsc(ev.titulo || ev.categoria)}</div>
        <button type="button" onclick="removeActaEvidencia(${idx})"
          class="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-rose-600 text-white text-xs flex items-center justify-center shadow hover:bg-rose-500">
          <i class="ri-close-line"></i>
        </button>
      </div>`).join("");
  }

  // ==========================================================================
  // FIRMAS DIGITALES + PANTALLA COMPLETA
  // ==========================================================================
  function bindCanvasDrawing(canvas, padState) {
    const ctx = canvas.getContext("2d");
    const getPos = (e) => {
      const r = canvas.getBoundingClientRect();
      const pt = e.touches && e.touches[0] ? e.touches[0] : e;
      return { x: pt.clientX - r.left, y: pt.clientY - r.top };
    };
    const start = (e) => {
      e.preventDefault();
      padState.drawing = true;
      padState.hasDrawn = true;
      const p = getPos(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    };
    const move = (e) => {
      if (!padState.drawing) return;
      e.preventDefault();
      const p = getPos(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    };
    const end = () => {
      padState.drawing = false;
    };
    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    window.addEventListener("mouseup", end);
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", end);
  }

  function initSignaturePad(role) {
    const canvas = document.getElementById(`acta-sig-canvas-${role}`);
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(300, rect.width) * dpr;
    canvas.height = Math.max(150, rect.height) * dpr;

    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";

    if (state.sigPads[role]?.initialized) return;
    const padState = { initialized: true, drawing: false, hasDrawn: false, canvas, ctx };
    state.sigPads[role] = padState;
    bindCanvasDrawing(canvas, padState);
  }

  function loadSignaturePreview(role, imageUrl) {
    const pad = state.sigPads[role];
    if (!pad || !imageUrl) return;
    const img = new Image();
    img.onload = () => {
      const r = pad.canvas.getBoundingClientRect();
      pad.ctx.clearRect(0, 0, r.width, r.height);
      pad.ctx.drawImage(img, 0, 0, r.width, r.height);
      pad.hasDrawn = true;
    };
    img.src = imageUrl;
  }

  window.clearSignaturePad = function (role) {
    const pad = state.sigPads[role];
    if (!pad) return;
    const r = pad.canvas.getBoundingClientRect();
    pad.ctx.clearRect(0, 0, r.width, r.height);
    pad.hasDrawn = false;
    if (role === "cliente") state.firmaCliente = null;
    if (role === "tecnico") state.firmaTecnico = null;
  };

  window.openFullscreenSignature = function (role) {
    state.fsSigRole = role;
    const modal = document.getElementById("acta-sig-fullscreen-modal");
    const title = document.getElementById("acta-sig-fs-title");
    const canvas = document.getElementById("acta-sig-fs-canvas");
    if (title) title.textContent = role === "cliente" ? "Firma del Cliente (Pantalla Completa)" : "Firma del Técnico (Pantalla Completa)";
    modal?.classList.remove("hidden");

    setTimeout(() => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#0f172a";

      if (!state.fsSigPad) {
        state.fsSigPad = { drawing: false, hasDrawn: false, canvas, ctx };
        bindCanvasDrawing(canvas, state.fsSigPad);
      } else {
        state.fsSigPad.ctx = ctx;
        state.fsSigPad.hasDrawn = false;
      }
    }, 50);
  };

  window.clearFullscreenSignature = function () {
    if (!state.fsSigPad) return;
    const r = state.fsSigPad.canvas.getBoundingClientRect();
    state.fsSigPad.ctx.clearRect(0, 0, r.width, r.height);
    state.fsSigPad.hasDrawn = false;
  };

  window.applyFullscreenSignature = function () {
    if (state.fsSigPad?.hasDrawn && state.fsSigRole) {
      const dataUrl = state.fsSigPad.canvas.toDataURL("image/png");
      loadSignaturePreview(state.fsSigRole, dataUrl);
    }
    closeFullscreenSignature();
  };

  window.closeFullscreenSignature = function () {
    document.getElementById("acta-sig-fullscreen-modal")?.classList.add("hidden");
  };

  function exportSignaturePayload(role) {
    const pad = state.sigPads[role];
    const existing = role === "cliente" ? state.firmaCliente : state.firmaTecnico;
    const firmanteNombre = role === "cliente"
      ? (getVal("acta-firma-cliente-nombre") || getVal("acta-cliente-nombre"))
      : (document.getElementById("acta-tecnico-select")?.selectedOptions[0]?.dataset?.name || "");

    if (pad && pad.hasDrawn) {
      return {
        dataUrl: pad.canvas.toDataURL("image/png"),
        firmanteNombre,
        signedAt: new Date().toISOString(),
      };
    }
    return existing || undefined;
  }

  // ==========================================================================
  // GUARDAR ACTA (+ CREAR CLIENTE OPCIONAL + AUTO-WHATSAPP AL FINALIZAR)
  // ==========================================================================
  window.saveActaForm = async function (overrideEstado) {
    const nombreCompleto = getVal("acta-cliente-nombre");
    if (!nombreCompleto) {
      toast("El Nombre Completo / Razón Social del cliente es obligatorio", "error");
      document.getElementById("acta-cliente-nombre")?.focus();
      return;
    }

    const targetEstado = overrideEstado || getVal("acta-estado") || "En Proceso";

    // Validar fotos recomendadas al finalizar
    if (targetEstado === "Finalizada (Éxito)") {
      const missing = RECOMMENDED_EVIDENCE.filter((r) => !state.evidencias.some((e) => e.categoria === r.key));
      if (missing.length > 0) {
        const ok = confirm(
          `Faltan las siguientes fotos recomendadas: ${missing.map((m) => m.label).join(", ")}.\n\n¿Deseas finalizar el acta de todas formas?`
        );
        if (!ok) return;
      }
    }

    if (overrideEstado) {
      setVal("acta-estado", overrideEstado);
    }

    // Crear cliente automáticamente si se marcó el check y aún no tiene customerId
    let customerId = getVal("acta-cliente-id");
    const shouldCreateCustomer = document.getElementById("acta-save-customer-check")?.checked;
    if (!customerId && shouldCreateCustomer) {
      try {
        const dniVal = getVal("acta-cliente-dni") || "00000000";
        const phoneVal = getVal("acta-cliente-whatsapp") || getVal("acta-cliente-celular") || "999999999";
        const addrVal = getVal("acta-cliente-direccion") || getVal("acta-cliente-distrito") || "Dirección por confirmar";
        const planIdVal = getVal("acta-plan-select");
        const custRes = await api("/api/customers", {
          method: "POST",
          body: JSON.stringify({
            fullName: nombreCompleto,
            identification: dniVal.length >= 4 ? dniVal : "00000000",
            phone: phoneVal.length >= 6 ? phoneVal : "999999999",
            address: addrVal.length >= 3 ? addrVal : "Dirección registrada en acta",
            latitude: getVal("acta-cliente-lat") || undefined,
            longitude: getVal("acta-cliente-lng") || undefined,
            serviceId: planIdVal ? Number(planIdVal) : undefined,
            status: "active",
            notes: `Creado desde Acta de Instalación`,
          }),
        });
        if (custRes?.success && custRes?.data?.id) {
          customerId = String(custRes.data.id);
          setVal("acta-cliente-id", customerId);
          state.customers.unshift(custRes.data);
          toast("Cliente registrado en el módulo de Clientes", "success");
        }
      } catch (err) {
        console.warn("[Actas] No se pudo crear cliente automático:", err);
      }
    }

    const planSel = document.getElementById("acta-plan-select");
    const planName = planSel?.selectedOptions[0]?.dataset?.name || "Sin plan";
    const techSel = document.getElementById("acta-tecnico-select");
    const techName = techSel?.selectedOptions[0]?.dataset?.name || window.currentUser?.name || "Técnico";

    const payload = {
      prefijo: getVal("acta-prefijo-input") || "LIM-",
      folioNumero: getVal("acta-folio-input") || "000001",
      cliente: {
        customerId: customerId || undefined,
        nombreCompleto,
        dniRuc: getVal("acta-cliente-dni"),
        rotuladoQr: getVal("acta-cliente-qr"),
        direccion: getVal("acta-cliente-direccion"),
        distrito: getVal("acta-cliente-distrito"),
        referencia: getVal("acta-cliente-referencia"),
        whatsappPrincipal: getVal("acta-cliente-whatsapp"),
        celularAlternativo: getVal("acta-cliente-celular"),
        latitud: getVal("acta-cliente-lat"),
        longitud: getVal("acta-cliente-lng"),
      },
      plantaExterna: {
        nodoCluster: getVal("acta-pe-nodo"),
        napCaja: getVal("acta-pe-nap"),
        puerto: getVal("acta-pe-puerto"),
        potenciaDbm: getVal("acta-pe-potencia"),
        atenuacionEmpalme: getVal("acta-pe-atenuacion"),
        dropMetros: getVal("acta-pe-drop"),
        precinto: getVal("acta-pe-precinto"),
      },
      detallesServicio: {
        fecha: getVal("acta-fecha") || new Date().toISOString().slice(0, 10),
        horaInicio: getVal("acta-hora-inicio"),
        horaFin: getVal("acta-hora-fin"),
        tipo: getVal("acta-tipo") || "Instalación",
        estadoFinal: targetEstado,
        servicioContratadoId: getVal("acta-plan-select"),
        servicioContratadoNombre: planName,
        tecnicoId: getVal("acta-tecnico-select"),
        tecnicoNombre: techName,
        ssidWifi: getVal("acta-ssid"),
        passwordWifi: getVal("acta-wifi-pass"),
        speedDl: getVal("acta-speed-dl"),
        speedUl: getVal("acta-speed-ul"),
        numTvs: getVal("acta-num-tvs"),
        splitters: getVal("acta-splitters"),
        senalLow: getVal("acta-senal-low"),
        vlanPppoe: getVal("acta-vlan"),
      },
      equipos: state.equipos,
      materiales: state.materiales,
      evidencias: state.evidencias,
      observaciones: getVal("acta-observaciones"),
      firmaCliente: exportSignaturePayload("cliente"),
      firmaTecnico: exportSignaturePayload("tecnico"),
    };

    try {
      const isEdit = Boolean(state.editingId);
      const url = isEdit ? `/api/actas/${encodeURIComponent(state.editingId)}` : "/api/actas";
      const method = isEdit ? "PUT" : "POST";

      const res = await api(url, {
        method,
        body: JSON.stringify(payload),
      });

      if (res?.success) {
        localStorage.removeItem(DRAFT_KEY);
        toast(res.message || "Acta guardada correctamente", "success");

        const autoWa = document.getElementById("acta-auto-whatsapp-check")?.checked;
        if (autoWa && targetEstado === "Finalizada (Éxito)" && res.data?.id) {
          await sendActaWhatsApp(res.data.id);
        }

        await loadActasList();
        showActasListView();
      } else {
        toast(res?.message || "No se pudo guardar el acta", "error");
      }
    } catch (err) {
      toast("Error guardando acta: " + err.message, "error");
    }
  };
})();
