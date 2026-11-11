/**
 * TurboNetwork SaaS — Guardián Unificado de Sesión, JWT e Inactividad
 * Protege index.html, chat.html y tech.html contra sesiones infinitas,
 * sincroniza actividad entre pestañas y gestiona expiración automática con aviso regresivo.
 */
(function () {
  var SESSION_KEY = "turbonetwork_session";
  var META_KEY = "turbonetwork_auth_meta";
  var ACTIVE_USER_KEY = "turbonetwork_active_user";
  var PENDING_2FA_KEY = "turbonetwork_pending_2fa";

  var DEFAULT_IDLE_MS = 15 * 60 * 1000; // 15 minutos por defecto
  var DEFAULT_MAX_MS = 8 * 60 * 60 * 1000; // 8 horas por defecto
  var WARNING_BEFORE_MS = 60 * 1000; // Aviso regresivo 60s antes
  var ACTIVITY_THROTTLE_MS = 4000;
  var SERVER_REFRESH_INTERVAL_MS = 3 * 60 * 1000; // Heartbeat al servidor cada 3 min si hay actividad

  var lastActivityWrite = 0;
  var lastServerRefresh = 0;
  var warningModalEl = null;
  var warningShown = false;
  var isLoggingOut = false;

  function readMeta() {
    try {
      var raw = localStorage.getItem(META_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function writeMeta(meta) {
    try {
      localStorage.setItem(META_KEY, JSON.stringify(meta));
    } catch (_) {}
  }

  function hasActiveUserInStorage() {
    try {
      return Boolean(localStorage.getItem(SESSION_KEY));
    } catch (_) {
      return false;
    }
  }

  function clearStorageSession() {
    try {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(META_KEY);
      localStorage.removeItem(ACTIVE_USER_KEY);
      localStorage.removeItem(PENDING_2FA_KEY);
    } catch (_) {}
  }

  /**
   * Validación síncrona temprana: purga sesiones legadas sin JWT o caducadas por tiempo/inactividad
   * antes de que la interfaz pinte el contenido protegido.
   */
  function validateStoredSessionSync() {
    if (!hasActiveUserInStorage()) return false;
    var meta = readMeta();
    if (!meta || !meta.token || typeof meta.token !== "string") {
      // Sesión antigua sin token JWT firmado -> invalidar de inmediato
      clearStorageSession();
      return false;
    }
    var now = Date.now();
    var idleLimit = meta.idleTimeoutMs || DEFAULT_IDLE_MS;
    var lastAct = meta.lastActivityAt || now;
    var maxExp = meta.expiresAt || now + DEFAULT_MAX_MS;

    if (now >= maxExp || now - lastAct > idleLimit) {
      clearStorageSession();
      return false;
    }
    return true;
  }

  // Ejecutar validación inmediata al cargar el script en <head>
  validateStoredSessionSync();

  var origFetch = window.fetch;

  function notifyServerLogout(token) {
    try {
      var headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = "Bearer " + token;
      origFetch.call(window, "/api/auth/logout", {
        method: "POST",
        headers: headers,
        credentials: "same-origin",
        body: "{}",
      }).catch(function () {});
    } catch (_) {}
  }

  function hideWarningModal() {
    warningShown = false;
    if (warningModalEl) {
      warningModalEl.classList.add("hidden");
    }
  }

  function ensureWarningModal() {
    if (warningModalEl) return warningModalEl;
    var wrapper = document.createElement("div");
    wrapper.id = "tn-idle-warning-modal";
    wrapper.style.cssText =
      "position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(2,6,23,0.78);backdrop-filter:blur(6px);padding:16px;";
    wrapper.className = "hidden";
    wrapper.innerHTML =
      '<div style="max-width:400px;width:100%;background:#0f172a;border:1px solid rgba(255,255,255,0.12);border-radius:20px;padding:24px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.65);color:#f8fafc;font-family:Inter,system-ui,sans-serif;text-align:center;">' +
      '<div style="width:52px;height:52px;margin:0 auto 14px;border-radius:16px;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.35);display:flex;align-items:center;justify-content:center;color:#fbbf24;">' +
      '<svg style="width:26px;height:26px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>' +
      "</div>" +
      '<h3 style="font-size:17px;font-weight:700;margin:0 0 6px;color:#ffffff;">Inactividad detectada</h3>' +
      '<p style="font-size:13px;color:#94a3b8;margin:0 0 16px;line-height:1.5;">Por seguridad, tu sesión se cerrará automáticamente en <strong id="tn-idle-countdown" style="color:#fbbf24;font-family:monospace;font-size:15px;">60s</strong>.</p>' +
      '<div style="display:flex;gap:10px;justify-content:center;">' +
      '<button type="button" id="tn-idle-logout-now" style="flex:1;padding:10px 14px;border-radius:12px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.05);color:#cbd5e1;font-size:12px;font-weight:600;cursor:pointer;">Cerrar ahora</button>' +
      '<button type="button" id="tn-idle-stay-btn" style="flex:1.3;padding:10px 14px;border-radius:12px;border:none;background:#2563eb;color:#ffffff;font-size:12px;font-weight:700;cursor:pointer;box-shadow:0 8px 20px -4px rgba(37,99,235,0.5);">Seguir conectado</button>' +
      "</div>" +
      "</div>";

    document.body.appendChild(wrapper);
    warningModalEl = wrapper;

    var stayBtn = document.getElementById("tn-idle-stay-btn");
    if (stayBtn) {
      stayBtn.onclick = function () {
        keepAliveExplicit();
      };
    }
    var logoutBtn = document.getElementById("tn-idle-logout-now");
    if (logoutBtn) {
      logoutBtn.onclick = function () {
        performSessionLogout("Sesión cerrada manualmente.");
      };
    }
    return warningModalEl;
  }

  function showWarningModal(secondsLeft) {
    if (!document.body) return;
    var modal = ensureWarningModal();
    var countEl = document.getElementById("tn-idle-countdown");
    if (countEl) countEl.textContent = Math.max(1, secondsLeft) + "s";
    if (modal.classList.contains("hidden")) {
      modal.classList.remove("hidden");
    }
    warningShown = true;
  }

  function keepAliveExplicit() {
    var meta = readMeta();
    if (!meta) return;
    meta.lastActivityAt = Date.now();
    writeMeta(meta);
    hideWarningModal();
    pingServerRefresh(true);
  }

  function pingServerRefresh(force) {
    var now = Date.now();
    if (!force && now - lastServerRefresh < SERVER_REFRESH_INTERVAL_MS) return;
    var meta = readMeta();
    if (!meta || !meta.token) return;
    lastServerRefresh = now;

    origFetch
      .call(window, "/api/auth/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + meta.token,
        },
        credentials: "same-origin",
        body: "{}",
      })
      .then(function (r) {
        if (r.status === 401) {
          performSessionLogout("Tu sesión expiró. Inicia sesión nuevamente.");
          return null;
        }
        return r.json();
      })
      .then(function (res) {
        if (res && res.success && res.data) {
          var cur = readMeta();
          if (cur) {
            if (res.data.expiresAt) cur.expiresAt = res.data.expiresAt;
            if (res.data.idleTimeoutMs) cur.idleTimeoutMs = res.data.idleTimeoutMs;
            writeMeta(cur);
          }
        }
      })
      .catch(function () {});
  }

  function performSessionLogout(reasonMessage, skipServerCall) {
    if (isLoggingOut) return;
    isLoggingOut = true;

    var meta = readMeta();
    var oldToken = meta ? meta.token : null;
    hideWarningModal();
    clearStorageSession();

    if (!skipServerCall) {
      notifyServerLogout(oldToken);
    }

    try {
      // Cerrar conexiones SSE en tiempo real si están activas
      if (typeof window.messagesEventSource !== "undefined" && window.messagesEventSource) {
        try { window.messagesEventSource.close(); } catch (_) {}
        window.messagesEventSource = null;
      }
      if (typeof window.remoteScannerEventSource !== "undefined" && window.remoteScannerEventSource) {
        try { window.remoteScannerEventSource.close(); } catch (_) {}
        window.remoteScannerEventSource = null;
      }

      // 1. Si estamos en index.html (tiene función logout() y #pin-login-screen)
      if (typeof window.logout === "function" && document.getElementById("pin-login-screen")) {
        window.logout(true);
        if (reasonMessage && typeof window.showToast === "function") {
          window.showToast(reasonMessage, "error");
        }
      }
      // 2. Si estamos en tech.html (Apartado Móvil de Técnicos)
      else if (typeof window.techLogout === "function" && document.getElementById("tech-login-overlay")) {
        window.techLogout(true);
      }
      // 3. Si estamos en chat.html standalone -> redirigir al portal principal para autenticar PIN
      else if (window.location.pathname.indexOf("chat") !== -1 || window.location.pathname.indexOf("messages") !== -1) {
        window.location.href = "/?expired=1";
      }
    } finally {
      setTimeout(function () {
        isLoggingOut = false;
      }, 400);
    }
  }

  function recordUserActivity() {
    if (warningShown) return; // Si el aviso de 60s ya está visible, exigir clic en "Seguir conectado"
    if (!hasActiveUserInStorage()) return;
    var now = Date.now();
    if (now - lastActivityWrite < ACTIVITY_THROTTLE_MS) return;

    var meta = readMeta();
    if (!meta || !meta.token) return;

    lastActivityWrite = now;
    meta.lastActivityAt = now;
    writeMeta(meta);
    pingServerRefresh(false);
  }

  function evaluateSessionTimers() {
    if (!hasActiveUserInStorage()) {
      hideWarningModal();
      return;
    }

    var meta = readMeta();
    if (!meta || !meta.token) {
      performSessionLogout("Sesión inválida o caducada. Ingrese su PIN nuevamente.");
      return;
    }

    var now = Date.now();
    var idleLimit = meta.idleTimeoutMs || DEFAULT_IDLE_MS;
    var lastAct = meta.lastActivityAt || now;
    var maxExp = meta.expiresAt || now + DEFAULT_MAX_MS;

    if (now >= maxExp) {
      performSessionLogout("Se alcanzó la duración máxima de la jornada. Inicia sesión nuevamente.");
      return;
    }

    var idleElapsed = now - lastAct;
    var remainingMs = Math.min(idleLimit - idleElapsed, maxExp - now);

    if (remainingMs <= 0) {
      performSessionLogout("Tu sesión se cerró automáticamente por inactividad.");
      return;
    }

    if (remainingMs <= WARNING_BEFORE_MS) {
      showWarningModal(Math.ceil(remainingMs / 1000));
    } else if (warningShown) {
      hideWarningModal();
    }
  }

  // Interceptor global de window.fetch: inyecta Authorization Bearer + x-tenant-id y captura 401 o logins exitosos
  window.fetch = function (url, options) {
    options = options || {};
    var urlStr = typeof url === "string" ? url : url && url.url ? url.url : "";
    var isApiCall = urlStr.indexOf("/api") === 0 || urlStr.indexOf("/api/") !== -1;

    if (isApiCall) {
      var activeTenant = "turbonetwork";
      try {
        activeTenant = localStorage.getItem("turbonetwork_active_tenant") || "turbonetwork";
      } catch (_) {}

      var meta = readMeta();
      var token = meta && meta.token ? meta.token : "";

      if (!options.credentials) {
        options.credentials = "same-origin";
      }

      if (!options.headers) {
        options.headers = {};
      }

      if (options.headers instanceof Headers) {
        if (!options.headers.has("x-tenant-id")) options.headers.set("x-tenant-id", activeTenant);
        if (token && !options.headers.has("Authorization")) {
          options.headers.set("Authorization", "Bearer " + token);
        }
      } else if (Array.isArray(options.headers)) {
        if (!options.headers.some(function (h) { return h[0].toLowerCase() === "x-tenant-id"; })) {
          options.headers.push(["x-tenant-id", activeTenant]);
        }
        if (token && !options.headers.some(function (h) { return h[0].toLowerCase() === "authorization"; })) {
          options.headers.push(["Authorization", "Bearer " + token]);
        }
      } else {
        if (!options.headers["x-tenant-id"]) options.headers["x-tenant-id"] = activeTenant;
        if (token && !options.headers["Authorization"] && !options.headers["authorization"]) {
          options.headers["Authorization"] = "Bearer " + token;
        }
      }
    }

    return origFetch.call(window, url, options).then(function (response) {
      if (!isApiCall) return response;

      // Si es login exitoso, persistir automáticamente el JWT firmado y los tiempos de sesión
      if (urlStr.indexOf("/api/auth/pin-login") !== -1 && response.ok) {
        response
          .clone()
          .json()
          .then(function (body) {
            if (body && body.success && body.data && body.data.token) {
              var now = Date.now();
              writeMeta({
                token: body.data.token,
                expiresAt: body.data.expiresAt || now + DEFAULT_MAX_MS,
                lastActivityAt: now,
                idleTimeoutMs: body.data.idleTimeoutMs || DEFAULT_IDLE_MS,
              });
              lastActivityWrite = now;
              lastServerRefresh = now;
            }
          })
          .catch(function () {});
        return response;
      }

      // Si cualquier endpoint protegido responde 401 y creíamos tener sesión -> cerrar sesión de inmediato
      var isAuthAttempt =
        urlStr.indexOf("/api/auth/pin-login") !== -1 ||
        urlStr.indexOf("/api/auth/logout") !== -1;

      if (response.status === 401 && !isAuthAttempt && hasActiveUserInStorage()) {
        response
          .clone()
          .json()
          .then(function (errData) {
            performSessionLogout(
              (errData && errData.message) || "Tu sesión expiró. Por favor ingresa nuevamente.",
              true
            );
          })
          .catch(function () {
            performSessionLogout("Tu sesión expiró. Por favor ingresa nuevamente.", true);
          });
      }

      return response;
    });
  };

  // Renderizador local de códigos QR 100% offline (evita filtrar secretos TOTP a servicios externos)
  window.renderLocalQrToImg = function (imgEl, textValue) {
    if (!imgEl || !textValue) return;
    if (typeof window.QRCode === "undefined") return;
    try {
      var tempDiv = document.createElement("div");
      new window.QRCode(tempDiv, {
        text: textValue,
        width: 240,
        height: 240,
        colorDark: "#0f172a",
        colorLight: "#ffffff",
        correctLevel: window.QRCode.CorrectLevel.M,
      });
      var canvas = tempDiv.querySelector("canvas");
      if (canvas) {
        imgEl.src = canvas.toDataURL("image/png");
        return;
      }
      var innerImg = tempDiv.querySelector("img");
      if (innerImg && innerImg.src) {
        imgEl.src = innerImg.src;
      }
    } catch (_) {}
  };

  window.handleQrError = function (imgEl) {
    if (!imgEl || imgEl.dataset.fallbackTried) return;
    imgEl.dataset.fallbackTried = "true";
    var raw = imgEl.dataset.rawOtpUrl;
    if (raw) {
      window.renderLocalQrToImg(imgEl, raw);
    }
  };

  // Registrar listeners de actividad del usuario
  ["pointerdown", "mousemove", "keydown", "touchstart", "scroll"].forEach(function (evtName) {
    window.addEventListener(evtName, recordUserActivity, { passive: true });
  });

  // Al volver a la pestaña o despertar la pantalla bloqueada, evaluar de inmediato
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      evaluateSessionTimers();
    }
  });
  window.addEventListener("focus", evaluateSessionTimers);

  // Sincronización multi-pestaña en tiempo real (cerrar sesión en una pestaña cierra todas)
  window.addEventListener("storage", function (e) {
    if (e.key === SESSION_KEY && !e.newValue) {
      performSessionLogout("La sesión fue cerrada en otra pestaña.", true);
    } else if (e.key === META_KEY && e.newValue) {
      evaluateSessionTimers();
    }
  });

  // Revisar cada segundo para actualizar el contador regresivo con precisión
  setInterval(evaluateSessionTimers, 1000);

  // Sincronizar política configurada en el servidor al iniciar
  window.addEventListener("DOMContentLoaded", function () {
    origFetch
      .call(window, "/api/auth/session-config", { credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (cfg) {
        if (cfg && cfg.success && cfg.data) {
          if (cfg.data.idleTimeoutMs) DEFAULT_IDLE_MS = cfg.data.idleTimeoutMs;
          if (cfg.data.maxSessionMs) DEFAULT_MAX_MS = cfg.data.maxSessionMs;
          var meta = readMeta();
          if (meta) {
            meta.idleTimeoutMs = DEFAULT_IDLE_MS;
            writeMeta(meta);
          }
        }
      })
      .catch(function () {});

    // Si estamos en chat.html standalone y no hay sesión válida, redirigir al login principal
    if (
      (window.location.pathname.indexOf("/chat") === 0 ||
        window.location.pathname.indexOf("/messages") === 0 ||
        window.location.pathname.indexOf("/chat") !== -1) &&
      !hasActiveUserInStorage()
    ) {
      window.location.href = "/";
    }
  });

  window.TurboSessionGuard = {
    validateStoredSessionSync: validateStoredSessionSync,
    logout: performSessionLogout,
    keepAlive: keepAliveExplicit,
    getToken: function () {
      var m = readMeta();
      return m ? m.token : "";
    },
  };
})();
