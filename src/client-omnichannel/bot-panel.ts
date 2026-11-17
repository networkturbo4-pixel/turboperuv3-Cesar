import { svgIcon } from "./icons";

type ApiFetchFn = <T = any>(url: string, options?: RequestInit) => Promise<T>;

function esc(val: unknown): string {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const WEEKDAYS = [
  { id: 1, label: "Lun" },
  { id: 2, label: "Mar" },
  { id: 3, label: "Mié" },
  { id: 4, label: "Jue" },
  { id: 5, label: "Vie" },
  { id: 6, label: "Sáb" },
  { id: 0, label: "Dom" },
];

export async function openBotStudioModal(apiFetch: ApiFetchFn): Promise<void> {
  const existing = document.getElementById("bot-studio-backdrop");
  if (existing) existing.remove();

  const backdrop = document.createElement("div");
  backdrop.id = "bot-studio-backdrop";
  backdrop.className = "bot-studio-backdrop";
  backdrop.setAttribute("role", "dialog");
  backdrop.setAttribute("aria-modal", "true");
  backdrop.setAttribute("aria-label", "Automatización y Bot de Mensajes");

  backdrop.innerHTML = `
    <div class="bot-studio-dialog">
      <div class="bot-studio-header">
        <div style="display:flex;align-items:center;gap:0.75rem;min-width:0;flex:1 1 220px;">
          <span style="flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:12px;background:var(--btn-bg,#4f46e5);color:var(--btn-text,#fff);box-shadow:0 6px 16px rgba(79,70,229,0.28);">${svgIcon("bot", 20)}</span>
          <div style="min-width:0;">
            <div style="font-weight:700;font-size:0.98rem;letter-spacing:-0.01em;line-height:1.25;">Bot de Mensajes &amp; Base de Conocimientos</div>
            <div id="bot-studio-subtitle" class="bot-studio-subtitle">Cargando configuración del tenant...</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;justify-content:flex-end;">
          <div id="bot-studio-badges" style="display:flex;gap:0.4rem;flex-wrap:wrap;"></div>
          <button type="button" id="btn-close-bot-studio" class="bot-studio-close-btn" aria-label="Cerrar">✕</button>
        </div>
      </div>

      <div class="bot-studio-tabs" role="tablist">
        <button type="button" class="bot-tab-btn" data-tab="config">Configuración y Horario</button>
        <button type="button" class="bot-tab-btn" data-tab="kb">Base de Conocimientos</button>
        <button type="button" class="bot-tab-btn" data-tab="ops">Tickets y Pagos</button>
        <button type="button" class="bot-tab-btn" data-tab="sim">Simulador</button>
        <button type="button" class="bot-tab-btn" data-tab="runs">Auditoría</button>
      </div>

      <div id="bot-studio-body" class="bot-studio-body">
        <p class="bot-studio-subtitle">Cargando...</p>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);

  const closeModal = () => backdrop.remove();
  backdrop.querySelector("#btn-close-bot-studio")?.addEventListener("click", closeModal);
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeModal();
  });

  let activeTab: "config" | "kb" | "ops" | "sim" | "runs" = "config";
  let settingsData: any = null;
  let aiConfigured = false;
  let tokensUsedToday = 0;
  let kbArticles: any[] = [];
  let simHistory: Array<{ senderType: string; body: string }> = [];
  let simPendingFlow = "";
  let simCustomerId: number | null = null;

  const paintTabs = () => {
    backdrop.querySelectorAll<HTMLButtonElement>(".bot-tab-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === activeTab);
    });
  };

  const loadSettings = async () => {
    const res = await apiFetch<any>("/api/bot/settings");
    settingsData = res.settings;
    aiConfigured = Boolean(res.aiConfigured);
    tokensUsedToday = Number(res.tokensUsedToday || 0);
    const sub = backdrop.querySelector("#bot-studio-subtitle");
    if (sub) {
      sub.textContent = `Tenant: ${settingsData.tenantId} · Tokens hoy: ${tokensUsedToday.toLocaleString()}`;
    }
    const badges = backdrop.querySelector("#bot-studio-badges");
    if (badges) {
      badges.innerHTML = `
        <span class="bot-studio-badge ${settingsData.enabled ? "is-ok" : ""}">${
        settingsData.enabled ? "● Bot Activo" : "○ Bot Pausado"
      }</span>
        <span class="bot-studio-badge ${aiConfigured ? "is-ok" : ""}">${
        aiConfigured ? "Gemini IA" : "Reglas / KB"
      }</span>
      `;
    }
  };

  const renderConfigTab = async () => {
    if (!settingsData) await loadSettings();
    const s = settingsData;
    const bh = s.businessHours || {
      timezone: "America/Lima",
      days: [1, 2, 3, 4, 5, 6],
      start: "08:00",
      end: "20:00",
      holidays: [],
    };
    const body = backdrop.querySelector("#bot-studio-body")!;
    body.innerHTML = `
      <form id="bot-config-form" style="display:grid;gap:1rem;">
        <div class="bot-studio-card" style="display:flex;flex-wrap:wrap;gap:1rem;align-items:center;justify-content:space-between;">
          <label class="bot-switch" style="font-weight:700;">
            <input type="checkbox" id="bot-enabled" ${s.enabled ? "checked" : ""} />
            <span>Activar Bot Automático para mensajes entrantes</span>
          </label>
          <label class="bot-switch" style="font-size:0.86rem;font-weight:600;">
            <input type="checkbox" id="bot-ai-enabled" ${s.aiEnabled ? "checked" : ""} />
            <span>Usar IA (Gemini) cuando no aplique una regla fija</span>
          </label>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:0.85rem;">
          <label style="display:grid;gap:0.35rem;font-size:0.84rem;font-weight:600;">
            Nombre del Bot
            <input type="text" id="bot-name" value="${esc(s.botName)}" style="padding:0.5rem 0.65rem;" />
          </label>
          <label style="display:grid;gap:0.35rem;font-size:0.84rem;font-weight:600;">
            Pausa tras respuesta de agente (min)
            <input type="number" id="bot-pause-min" min="1" max="1440" value="${Number(s.humanPauseMinutes || 30)}" style="padding:0.5rem 0.65rem;" />
          </label>
          <label style="display:grid;gap:0.35rem;font-size:0.84rem;font-weight:600;">
            Agrupar mensajes / Debounce (ms)
            <input type="number" id="bot-debounce" min="0" max="15000" step="500" value="${Number(s.debounceMs ?? 4000)}" style="padding:0.5rem 0.65rem;" />
          </label>
          <label style="display:grid;gap:0.35rem;font-size:0.84rem;font-weight:600;">
            Máx. respuestas / hora por chat
            <input type="number" id="bot-rate-limit" min="1" max="200" value="${Number(s.maxRepliesPerHour || 20)}" style="padding:0.5rem 0.65rem;" />
          </label>
        </div>

        <div style="display:grid;gap:0.4rem;font-size:0.84rem;font-weight:600;">
          Canales activos
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
            ${(["whatsapp", "facebook", "instagram"] as const)
              .map(
                (ch) => `<label class="bot-day-chip">
                  <input type="checkbox" name="bot-channels" value="${ch}" ${
                  (s.channels || []).includes(ch) ? "checked" : ""
                } /> ${ch.toUpperCase()}
                </label>`
              )
              .join("")}
          </div>
        </div>

        <label style="display:grid;gap:0.35rem;font-size:0.84rem;font-weight:600;">
          Personalidad e instrucciones del Bot
          <textarea id="bot-persona" rows="3" style="padding:0.55rem 0.7rem;resize:vertical;">${esc(s.personaPrompt)}</textarea>
        </label>

        <div class="bot-studio-card" style="display:grid;gap:0.75rem;">
          <div style="font-weight:700;font-size:0.9rem;">Horario de Atención Humana</div>
          <div style="display:flex;gap:0.45rem;flex-wrap:wrap;">
            ${WEEKDAYS.map(
              (d) => `<label class="bot-day-chip">
                <input type="checkbox" name="bot-days" value="${d.id}" ${(bh.days || []).includes(d.id) ? "checked" : ""} /> ${d.label}
              </label>`
            ).join("")}
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:0.75rem;">
            <label style="display:grid;gap:0.25rem;font-size:0.82rem;font-weight:600;">
              Hora inicio
              <input type="time" id="bot-bh-start" value="${esc(bh.start)}" style="padding:0.45rem 0.6rem;" />
            </label>
            <label style="display:grid;gap:0.25rem;font-size:0.82rem;font-weight:600;">
              Hora fin
              <input type="time" id="bot-bh-end" value="${esc(bh.end)}" style="padding:0.45rem 0.6rem;" />
            </label>
            <label style="display:grid;gap:0.25rem;font-size:0.82rem;font-weight:600;">
              Zona horaria
              <input type="text" id="bot-bh-tz" value="${esc(bh.timezone)}" style="padding:0.45rem 0.6rem;" />
            </label>
          </div>
          <label style="display:grid;gap:0.25rem;font-size:0.82rem;font-weight:600;">
            Mensaje fuera de horario
            <textarea id="bot-ooh-msg" rows="2" style="padding:0.5rem 0.65rem;">${esc(s.outOfHoursMessage)}</textarea>
          </label>
        </div>

        <div class="bot-studio-grid-submit">
          <label style="display:grid;gap:0.35rem;font-size:0.84rem;font-weight:600;">
            Palabras de traspaso a humano (separadas por coma)
            <input type="text" id="bot-handoff-kw" value="${esc((s.handoffKeywords || []).join(", "))}" style="padding:0.5rem 0.65rem;" />
          </label>
          <button type="submit" class="bot-studio-btn-primary">Guardar Configuración</button>
        </div>
        <div id="bot-config-msg" style="font-size:0.82rem;"></div>
      </form>
    `;

    body.querySelector("#bot-config-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const channels = Array.from(body.querySelectorAll<HTMLInputElement>('input[name="bot-channels"]:checked')).map(
        (el) => el.value
      );
      const days = Array.from(body.querySelectorAll<HTMLInputElement>('input[name="bot-days"]:checked')).map((el) =>
        Number(el.value)
      );
      const payload = {
        enabled: (body.querySelector("#bot-enabled") as HTMLInputElement).checked,
        aiEnabled: (body.querySelector("#bot-ai-enabled") as HTMLInputElement).checked,
        botName: (body.querySelector("#bot-name") as HTMLInputElement).value.trim() || "Turbo",
        humanPauseMinutes: Number((body.querySelector("#bot-pause-min") as HTMLInputElement).value || 30),
        debounceMs: Number((body.querySelector("#bot-debounce") as HTMLInputElement).value || 4000),
        maxRepliesPerHour: Number((body.querySelector("#bot-rate-limit") as HTMLInputElement).value || 20),
        channels,
        personaPrompt: (body.querySelector("#bot-persona") as HTMLTextAreaElement).value,
        outOfHoursMessage: (body.querySelector("#bot-ooh-msg") as HTMLTextAreaElement).value,
        handoffKeywords: (body.querySelector("#bot-handoff-kw") as HTMLInputElement).value
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
        businessHours: {
          days,
          start: (body.querySelector("#bot-bh-start") as HTMLInputElement).value || "08:00",
          end: (body.querySelector("#bot-bh-end") as HTMLInputElement).value || "20:00",
          timezone: (body.querySelector("#bot-bh-tz") as HTMLInputElement).value.trim() || "America/Lima",
          holidays: bh.holidays || [],
        },
      };
      const res = await apiFetch<any>("/api/bot/settings", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      settingsData = res.settings;
      const msgEl = body.querySelector("#bot-config-msg");
      if (msgEl) msgEl.innerHTML = `<span style="color:#10b981;font-weight:600;">Configuración guardada correctamente.</span>`;
    });
  };

  const renderKbTab = async () => {
    const res = await apiFetch<any>("/api/bot/kb/articles");
    kbArticles = res.articles || [];
    const body = backdrop.querySelector("#bot-studio-body")!;
    body.innerHTML = `
      <div style="display:grid;gap:1rem;">
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;justify-content:space-between;">
          <div style="display:flex;gap:0.5rem;flex:1;min-width:220px;">
            <input type="text" id="kb-search-input" placeholder="Probar búsqueda semántica / palabras clave..." style="flex:1;padding:0.45rem 0.65rem;" />
            <button type="button" id="btn-kb-search" class="bot-studio-btn-secondary">Probar</button>
          </div>
          <button type="button" id="btn-kb-reindex" class="bot-studio-btn-secondary">Reindexar</button>
        </div>
        <div id="kb-search-results" class="bot-studio-card" style="display:none;border-style:dashed;font-size:0.82rem;"></div>

        <form id="kb-new-form" class="bot-studio-card" style="display:grid;gap:0.65rem;">
          <div style="font-weight:700;font-size:0.88rem;">Nuevo Artículo</div>
          <div class="bot-studio-grid-2-1">
            <input type="text" id="kb-new-title" placeholder="Título (ej. Cobertura en San Juan)" required style="padding:0.45rem 0.65rem;" />
            <input type="text" id="kb-new-category" placeholder="Categoría (planes, pagos...)" value="general" style="padding:0.45rem 0.65rem;" />
          </div>
          <textarea id="kb-new-content" rows="2" placeholder="Contenido detallado que el bot usará para responder..." required style="padding:0.45rem 0.65rem;"></textarea>
          <div style="display:flex;gap:0.65rem;align-items:center;flex-wrap:wrap;">
            <input type="text" id="kb-new-keywords" placeholder="Palabras clave separadas por coma" style="flex:1;min-width:180px;padding:0.45rem 0.65rem;" />
            <button type="submit" class="bot-studio-btn-primary">Agregar</button>
          </div>
        </form>

        <div style="display:grid;gap:0.6rem;">
          ${kbArticles
            .map(
              (a) => `<div class="bot-studio-card" style="display:grid;gap:0.35rem;">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;">
                  <div><strong>${esc(a.title)}</strong> <span style="font-size:0.75rem;padding:2px 8px;border-radius:999px;background:rgba(99,102,241,0.18);color:var(--widget-accent,#6366f1);">${esc(a.category)}</span></div>
                  <button type="button" class="btn-kb-del" data-id="${a.id}" style="padding:0.25rem 0.6rem;border-radius:6px;border:1px solid #ef4444;color:#ef4444;background:transparent;cursor:pointer;font-size:0.76rem;">Eliminar</button>
                </div>
                <div style="font-size:0.83rem;color:var(--text-secondary);white-space:pre-wrap;">${esc(a.content)}</div>
              </div>`
            )
            .join("")}
        </div>
      </div>
    `;

    body.querySelector("#kb-new-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await apiFetch("/api/bot/kb/articles", {
        method: "POST",
        body: JSON.stringify({
          title: (body.querySelector("#kb-new-title") as HTMLInputElement).value,
          category: (body.querySelector("#kb-new-category") as HTMLInputElement).value,
          content: (body.querySelector("#kb-new-content") as HTMLTextAreaElement).value,
          keywords: (body.querySelector("#kb-new-keywords") as HTMLInputElement).value,
        }),
      });
      await renderKbTab();
    });

    body.querySelector("#btn-kb-reindex")?.addEventListener("click", async () => {
      const r = await apiFetch<any>("/api/bot/kb/reindex", { method: "POST", body: "{}" });
      alert(`Reindexación completa: ${r.articles} artículos, ${r.chunks} fragmentos.`);
    });

    body.querySelector("#btn-kb-search")?.addEventListener("click", async () => {
      const q = (body.querySelector("#kb-search-input") as HTMLInputElement).value.trim();
      if (!q) return;
      const r = await apiFetch<any>("/api/bot/kb/search", {
        method: "POST",
        body: JSON.stringify({ query: q }),
      });
      const box = body.querySelector("#kb-search-results") as HTMLElement;
      box.style.display = "block";
      box.innerHTML = (r.hits || []).length
        ? r.hits
            .map(
              (h: any) =>
                `<div style="margin-bottom:0.4rem;"><strong>${esc(h.title)}</strong> (${h.score}): ${esc(
                  h.chunkText.slice(0, 180)
                )}...</div>`
            )
            .join("")
        : "Sin coincidencias relevantes.";
    });

    body.querySelectorAll<HTMLButtonElement>(".btn-kb-del").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await apiFetch(`/api/bot/kb/articles/${btn.dataset.id}`, { method: "DELETE" });
        await renderKbTab();
      });
    });
  };

  const renderOpsTab = async () => {
    const [claimsRes, ticketsRes] = await Promise.all([
      apiFetch<any>("/api/bot/payment-claims"),
      apiFetch<any>("/api/bot/tickets"),
    ]);
    const claims = claimsRes.claims || [];
    const tickets = ticketsRes.tickets || [];
    const body = backdrop.querySelector("#bot-studio-body")!;
    body.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr));gap:1.1rem;align-items:start;">
        <div>
          <h4 style="margin:0 0 0.65rem 0;font-size:0.95rem;">Comprobantes de Pago Recibidos (${claims.length})</h4>
          ${
            claims.length === 0
              ? `<div class="bot-empty-state">${svgIcon("receipt", 28)}<strong>Sin comprobantes</strong><span style="font-size:0.82rem;">Cuando un cliente envíe una captura de Yape, Plin o transferencia, aparecerá aquí para validación.</span></div>`
              : `<div style="display:grid;gap:0.55rem;">${claims
                  .map(
                    (c: any) => `<div class="bot-studio-card" style="display:flex;justify-content:space-between;align-items:center;gap:0.75rem;flex-wrap:wrap;">
                      <div>
                        <strong>#${c.id} · ${esc(c.customer_name)}</strong> (${esc(String(c.method || "").toUpperCase())}) — <strong>${Number(c.amount || 0).toFixed(2)}</strong>
                        <div class="bot-studio-subtitle">Op: ${esc(c.operation_code || "-")} · Estado: <strong>${esc(c.status)}</strong></div>
                      </div>
                      ${
                        c.status === "pending_validation"
                          ? `<div style="display:flex;gap:0.45rem;">
                              <button type="button" class="btn-claim-act bot-studio-btn-primary" data-id="${c.id}" data-status="approved" style="padding:0.35rem 0.7rem;font-size:0.78rem;background:#10b981;">Aprobar</button>
                              <button type="button" class="btn-claim-act bot-studio-btn-secondary" data-id="${c.id}" data-status="rejected" style="padding:0.35rem 0.7rem;font-size:0.78rem;color:#ef4444;border-color:#ef4444;">Rechazar</button>
                            </div>`
                          : `<span class="bot-studio-subtitle">Revisado por ${esc(c.reviewed_by || "-")}</span>`
                      }
                    </div>`
                  )
                  .join("")}</div>`
          }
        </div>

        <div>
          <h4 style="margin:0 0 0.65rem 0;font-size:0.95rem;">Tickets de Soporte Creados por el Bot (${tickets.length})</h4>
          ${
            tickets.length === 0
              ? `<div class="bot-empty-state">${svgIcon("wrench", 28)}<strong>Sin tickets pendientes</strong><span style="font-size:0.82rem;">Los reportes técnicos generados automáticamente desde el chat aparecerán aquí.</span></div>`
              : `<div style="display:grid;gap:0.55rem;">${tickets
                  .map(
                    (t: any) => `<div class="bot-studio-card" style="display:flex;justify-content:space-between;align-items:center;gap:0.75rem;flex-wrap:wrap;">
                      <div>
                        <strong>#${t.id} · ${esc(t.subject)}</strong> (${esc(t.customer_name)})
                        <div class="bot-studio-subtitle">${esc(t.category)} · Estado: <strong>${esc(t.status)}</strong></div>
                      </div>
                      ${
                        t.status !== "resolved"
                          ? `<button type="button" class="btn-ticket-resolve bot-studio-btn-secondary" data-id="${t.id}" style="padding:0.35rem 0.7rem;font-size:0.78rem;">Marcar resuelto</button>`
                          : `<span style="color:#10b981;font-size:0.78rem;font-weight:600;">Resuelto</span>`
                      }
                    </div>`
                  )
                  .join("")}</div>`
          }
        </div>
      </div>
    `;

    body.querySelectorAll<HTMLButtonElement>(".btn-claim-act").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await apiFetch(`/api/bot/payment-claims/${btn.dataset.id}`, {
          method: "PUT",
          body: JSON.stringify({ status: btn.dataset.status }),
        });
        await renderOpsTab();
      });
    });

    body.querySelectorAll<HTMLButtonElement>(".btn-ticket-resolve").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await apiFetch(`/api/bot/tickets/${btn.dataset.id}`, {
          method: "PUT",
          body: JSON.stringify({ status: "resolved" }),
        });
        await renderOpsTab();
      });
    });
  };

  const renderSimTab = () => {
    const body = backdrop.querySelector("#bot-studio-body")!;
    body.innerHTML = `
      <div style="display:grid;gap:0.85rem;">
        <div style="display:flex;gap:0.65rem;flex-wrap:wrap;align-items:center;">
          <input type="text" id="sim-phone" placeholder="Teléfono opcional (ej. +51987654321)" style="flex:1;min-width:200px;padding:0.45rem 0.65rem;" />
          <button type="button" id="btn-sim-reset" class="bot-studio-btn-secondary">Reiniciar chat</button>
        </div>
        <div id="sim-chat-log" class="bot-studio-card" style="min-height:220px;max-height:320px;overflow-y:auto;display:grid;gap:0.55rem;align-content:start;">
          ${
            simHistory.length === 0
              ? `<div class="bot-studio-subtitle">Escriba un mensaje abajo (ej. "hola", "cuánto debo", "planes", "asesor") para probar la lógica sin enviar nada real.</div>`
              : simHistory
                  .map(
                    (m) => `<div style="padding:0.55rem 0.8rem;border-radius:8px;max-width:85%;${
                      m.senderType === "contact"
                        ? "justify-self:end;background:var(--btn-bg,#4f46e5);color:var(--btn-text,#fff);"
                        : "justify-self:start;background:var(--widget-bg);border:1px solid var(--widget-border);color:var(--text-primary);"
                    }white-space:pre-wrap;font-size:0.85rem;">${esc(m.body)}</div>`
                  )
                  .join("")
          }
        </div>
        <form id="sim-form" style="display:flex;gap:0.5rem;">
          <input type="text" id="sim-input" placeholder="Escriba como si fuera un cliente..." required style="flex:1;padding:0.55rem 0.75rem;" />
          <button type="submit" class="bot-studio-btn-primary">Simular</button>
        </form>
        <div id="sim-trace" class="bot-studio-subtitle"></div>
      </div>
    `;

    body.querySelector("#btn-sim-reset")?.addEventListener("click", () => {
      simHistory = [];
      simPendingFlow = "";
      simCustomerId = null;
      renderSimTab();
    });

    body.querySelector("#sim-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = body.querySelector("#sim-input") as HTMLInputElement;
      const phone = (body.querySelector("#sim-phone") as HTMLInputElement).value.trim();
      const text = input.value.trim();
      if (!text) return;
      input.value = "";
      const res = await apiFetch<any>("/api/bot/simulate", {
        method: "POST",
        body: JSON.stringify({
          text,
          phone,
          customerId: simCustomerId,
          pendingFlow: simPendingFlow,
          history: simHistory,
        }),
      });
      simHistory.push({ senderType: "contact", body: text });
      const d = res.decision || {};
      const reply = d.handoff ? `[Traspaso a humano: ${d.reason || ""}]` : d.text || "(sin respuesta)";
      simHistory.push({ senderType: "bot", body: reply });
      simPendingFlow = res.nextPendingFlow || "";
      simCustomerId = res.nextCustomerId ?? simCustomerId;
      renderSimTab();
      const trace = backdrop.querySelector("#sim-trace");
      if (trace) {
        trace.textContent = `Ruta: ${d.path} · Intención: ${d.intent} · Herramientas: ${(d.toolsUsed || []).join(", ") || "ninguna"} · Tokens: ${d.tokens || 0} · Latencia: ${res.latencyMs}ms`;
      }
    });
  };

  const renderRunsTab = async () => {
    const res = await apiFetch<any>("/api/bot/runs?limit=30");
    const runs = res.runs || [];
    const body = backdrop.querySelector("#bot-studio-body")!;
    body.innerHTML = runs.length
      ? `<div style="display:grid;gap:0.5rem;">${runs
          .map(
            (r: any) => `<div class="bot-studio-card" style="font-size:0.8rem;">
              <div style="display:flex;justify-content:space-between;gap:0.5rem;">
                <strong>Chat #${r.conversation_id ?? "-"} · ${esc(r.path)} (${esc(r.intent)})</strong>
                <span class="bot-studio-subtitle">${r.tokens || 0} tok · ${r.latency_ms || 0}ms</span>
              </div>
              ${r.reply_text ? `<div style="color:var(--text-secondary);margin-top:0.25rem;">${esc(r.reply_text.slice(0, 180))}</div>` : ""}
              ${r.error ? `<div style="color:#ef4444;margin-top:0.25rem;">${esc(r.error)}</div>` : ""}
            </div>`
          )
          .join("")}</div>`
      : `<div class="bot-empty-state">${svgIcon("bot", 28)}<strong>Sin ejecuciones registradas</strong><span style="font-size:0.82rem;">Aquí verá el historial de decisiones, herramientas usadas, tokens y latencia de cada respuesta automática.</span></div>`;
  };

  const switchTab = async (tab: "config" | "kb" | "ops" | "sim" | "runs") => {
    activeTab = tab;
    paintTabs();
    if (tab === "config") await renderConfigTab();
    else if (tab === "kb") await renderKbTab();
    else if (tab === "ops") await renderOpsTab();
    else if (tab === "sim") renderSimTab();
    else await renderRunsTab();
  };

  backdrop.querySelectorAll<HTMLButtonElement>(".bot-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      void switchTab(btn.dataset.tab as any);
    });
  });

  await loadSettings();
  await switchTab("config");
}
