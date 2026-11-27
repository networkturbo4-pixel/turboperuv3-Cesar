/**
 * TurboNetwork Native & Live GPS Bridge (Capacitor Android/iOS + Fallback PWA)
 * Conecta el sistema web con capacidades nativas y rastreo en tiempo real Fase 1:
 *  - Identificación persistente de dispositivo (Device Binding por deviceId)
 *  - Auto-inicio de rastreo GPS al iniciar sesión (APK Foreground Service + PWA watchPosition)
 *  - Push Notifications (FCM + Canales de alta prioridad)
 *  - Dispositivos Cercanos (Bluetooth / BLE / Beacons / Impresoras térmicas)
 *  - Botón físico Atrás, Deep Linking y Haptics
 */
(function () {
  "use strict";

  var cap = typeof window !== "undefined" ? window.Capacitor : null;
  var isNative = Boolean(cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform());
  var Plugins = (cap && cap.Plugins) || {};

  function getOrCreateDeviceId() {
    var key = "turbonetwork_device_id";
    try {
      var existing = localStorage.getItem(key);
      if (existing && existing.length >= 10) return existing;
      var generated =
        "tn-dev-" +
        (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10));
      localStorage.setItem(key, generated);
      return generated;
    } catch (_) {
      return "tn-dev-" + Date.now().toString(36);
    }
  }

  function detectDeviceModel() {
    try {
      var ua = navigator.userAgent || "";
      var androidMatch = ua.match(/Android\s+[\d.]+;\s*([^;)]+)/i);
      if (androidMatch && androidMatch[1]) {
        return androidMatch[1].replace(/\s*Build\/.*$/i, "").trim().slice(0, 80);
      }
      if (/iPhone|iPad/i.test(ua)) return "Apple iOS";
      return (navigator.platform || "Web Browser").slice(0, 60);
    } catch (_) {
      return "Dispositivo";
    }
  }

  var state = {
    isNative: isNative,
    platform: cap && typeof cap.getPlatform === "function" ? cap.getPlatform() : "web",
    deviceId: getOrCreateDeviceId(),
    deviceModel: detectDeviceModel(),
    deviceStatus: "unknown", // "authorized" | "pending" | "revoked" | "unknown"
    fcmToken: "",
    bgWatcherId: null,
    pwaWatchId: null,
    lastPingAt: 0,
    lastSentLat: null,
    lastSentLng: null,
    trackingActive: false,
    trackingMode: "idle", // "apk_bg" | "pwa_fg" | "idle"
    lastError: "",
    lastPrinterDeviceId: "",
  };

  try {
    state.fcmToken = localStorage.getItem("turbonetwork_fcm_token") || "";
    state.lastPrinterDeviceId = localStorage.getItem("turbonetwork_bt_printer_id") || "";
  } catch (_) {}

  function emitGpsStatus() {
    try {
      window.dispatchEvent(
        new CustomEvent("turbonetwork:gps-status", {
          detail: {
            isNative: state.isNative,
            platform: state.platform,
            deviceId: state.deviceId,
            deviceModel: state.deviceModel,
            deviceStatus: state.deviceStatus,
            trackingActive: state.trackingActive,
            trackingMode: state.trackingMode,
            lastPingAt: state.lastPingAt,
            lastError: state.lastError,
          },
        })
      );
    } catch (_) {}
  }

  function hasSession() {
    try {
      return Boolean(localStorage.getItem("turbonetwork_session"));
    } catch (_) {
      return false;
    }
  }

  function isTechOrMobileContext() {
    try {
      var p = (window.location.pathname || "").toLowerCase();
      if (isNative) return true;
      return p.indexOf("/tech") === 0 || p.indexOf("tech.html") >= 0;
    } catch (_) {
      return isNative;
    }
  }

  async function apiFetch(url, options) {
    var opts = options || {};
    opts.headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    return fetch(url, opts);
  }

  async function readBatteryLevel() {
    try {
      if (navigator && typeof navigator.getBattery === "function") {
        var b = await navigator.getBattery();
        if (b && typeof b.level === "number") {
          return Math.round(b.level * 100);
        }
      }
    } catch (_) {}
    return undefined;
  }

  // =========================================================================
  // 0. REGISTRO DE DISPOSITIVO (DEVICE BINDING FASE 1)
  // =========================================================================
  async function registerCurrentDevice() {
    if (!hasSession()) return { ok: false, reason: "no_session" };
    try {
      var res = await apiFetch("/api/mobile/devices/register", {
        method: "POST",
        body: JSON.stringify({
          deviceId: state.deviceId,
          platform: state.platform === "ios" ? "ios" : state.isNative ? "android" : "web",
          deviceModel: state.deviceModel,
          appVersion: "1.1.0",
        }),
      });
      if (!res.ok) return { ok: false, status: res.status };
      var json = await res.json();
      if (json && json.data && json.data.status) {
        state.deviceStatus = json.data.status;
        emitGpsStatus();
      }
      return {
        ok: true,
        device: json && json.data,
        requiresApproval: Boolean(json && json.requiresApproval),
      };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  }

  // =========================================================================
  // 1. NOTIFICACIONES PUSH FCM Y CANALES DE ALTA PRIORIDAD
  // =========================================================================
  async function setupPushChannels() {
    var PushNotifications = Plugins.PushNotifications;
    if (!PushNotifications || typeof PushNotifications.createChannel !== "function") return;
    var channels = [
      { id: "turbo_urgent_orders", name: "Órdenes Urgentes", description: "Asignaciones y alertas SLA", importance: 5, visibility: 1, sound: "default", vibration: true },
      { id: "turbo_calls", name: "Llamadas TurboCalls", description: "Llamadas WebRTC entrantes", importance: 5, visibility: 1, sound: "default", vibration: true },
      { id: "turbo_chat", name: "Mensajes TurboChat", description: "Mensajes directos y comunidades", importance: 4, visibility: 1, sound: "default", vibration: true },
      { id: "turbo_attendance", name: "Asistencia GPS", description: "Recordatorios y alertas de turno", importance: 4, visibility: 1, sound: "default", vibration: true },
      { id: "turbo_general", name: "General", description: "Notificaciones generales del sistema", importance: 3, visibility: 1 },
    ];
    for (var i = 0; i < channels.length; i++) {
      try {
        await PushNotifications.createChannel(channels[i]);
      } catch (_) {}
    }
  }

  async function initPushNotifications(requestIfPrompt) {
    var PushNotifications = Plugins.PushNotifications;
    var LocalNotifications = Plugins.LocalNotifications;
    if (!isNative || !PushNotifications) return { granted: false };

    try {
      var perm = await PushNotifications.checkPermissions();
      if (perm.receive === "prompt" && requestIfPrompt) {
        perm = await PushNotifications.requestPermissions();
      }
      if (perm.receive !== "granted") {
        return { granted: false, status: perm.receive };
      }

      await setupPushChannels();

      if (!state._pushListenersBound) {
        state._pushListenersBound = true;

        PushNotifications.addListener("registration", async function (token) {
          state.fcmToken = token.value || "";
          try {
            localStorage.setItem("turbonetwork_fcm_token", state.fcmToken);
          } catch (_) {}
          if (hasSession() && state.fcmToken) {
            try {
              await apiFetch("/api/mobile/push/register", {
                method: "POST",
                body: JSON.stringify({
                  fcmToken: state.fcmToken,
                  platform: state.platform,
                  deviceName: state.deviceModel,
                  appVersion: "1.1.0",
                }),
              });
            } catch (_) {}
          }
        });

        PushNotifications.addListener("pushNotificationReceived", async function (notification) {
          haptic("medium");
          if (LocalNotifications) {
            try {
              await LocalNotifications.schedule({
                notifications: [
                  {
                    id: Math.floor(Date.now() % 2147483647),
                    title: notification.title || "TurboNetwork",
                    body: notification.body || "",
                    channelId: (notification.data && notification.data.channelId) || "turbo_general",
                    extra: notification.data || {},
                  },
                ],
              });
            } catch (_) {}
          }
        });

        PushNotifications.addListener("pushNotificationActionPerformed", function (action) {
          var data = (action && action.notification && action.notification.data) || {};
          if (data.url && typeof data.url === "string" && data.url.startsWith("/")) {
            window.location.href = data.url;
          }
        });
      }

      await PushNotifications.register();
      return { granted: true };
    } catch (err) {
      return { granted: false, error: String(err && err.message ? err.message : err) };
    }
  }

  // =========================================================================
  // 2. UBICACIÓN GPS EN TIEMPO REAL (APK FOREGROUND SERVICE + FALLBACK PWA)
  // =========================================================================
  async function sendTelemetryPing(coords, source) {
    if (!hasSession() || !coords) return;
    var lat = Number(coords.latitude);
    var lng = Number(coords.longitude);
    if (!isFinite(lat) || !isFinite(lng)) return;

    var now = Date.now();
    var speed = typeof coords.speed === "number" && isFinite(coords.speed) && coords.speed >= 0 ? coords.speed : undefined;
    var moving = typeof speed === "number" ? speed > 0.8 : true;
    var minInterval = moving ? 5000 : 30000;

    if (now - state.lastPingAt < minInterval) return;
    state.lastPingAt = now;
    state.lastSentLat = lat;
    state.lastSentLng = lng;

    var batteryLevel = await readBatteryLevel();

    try {
      var res = await apiFetch("/api/mobile/telemetry/location", {
        method: "POST",
        body: JSON.stringify({
          latitude: lat,
          longitude: lng,
          accuracy: typeof coords.accuracy === "number" && isFinite(coords.accuracy) ? coords.accuracy : undefined,
          speed: speed,
          heading:
            typeof coords.bearing === "number" && isFinite(coords.bearing) && coords.bearing >= 0
              ? coords.bearing
              : typeof coords.heading === "number" && isFinite(coords.heading) && coords.heading >= 0
              ? coords.heading
              : undefined,
          batteryLevel: batteryLevel,
          isMoving: moving,
          deviceId: state.deviceId,
          platform: state.platform === "ios" ? "ios" : state.isNative ? "android" : "web",
          deviceModel: state.deviceModel,
          source: source,
        }),
      });
      var json = await res.json().catch(function () {
        return {};
      });
      if (res.status === 403 && json && json.code === "DEVICE_NOT_AUTHORIZED") {
        state.deviceStatus = json.deviceStatus || "pending";
        state.lastError = json.message || "Dispositivo pendiente de aprobación";
      } else if (res.ok) {
        state.deviceStatus = (json && json.deviceStatus) || "authorized";
        state.lastError = "";
      }
      emitGpsStatus();
    } catch (_) {}
  }

  async function startPwaForegroundTracking() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return { ok: false, reason: "geolocation_unavailable" };
    }
    if (state.pwaWatchId !== null) {
      return { ok: true, mode: "pwa_fg", watcherId: state.pwaWatchId };
    }

    try {
      state.pwaWatchId = navigator.geolocation.watchPosition(
        function (pos) {
          state.trackingActive = true;
          state.trackingMode = "pwa_fg";
          state.lastError = "";
          sendTelemetryPing(pos.coords, "pwa_gps");
        },
        function (err) {
          state.lastError = err && err.message ? err.message : "Permiso GPS denegado";
          emitGpsStatus();
        },
        {
          enableHighAccuracy: true,
          maximumAge: 4000,
          timeout: 15000,
        }
      );
      state.trackingActive = true;
      state.trackingMode = "pwa_fg";
      emitGpsStatus();
      return { ok: true, mode: "pwa_fg", watcherId: state.pwaWatchId };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  }

  async function startBackgroundTracking() {
    var BgGeo = Plugins.BackgroundGeolocation;
    if (!isNative || !BgGeo) {
      // Fallback automático para PWA/Web en portal técnico
      return startPwaForegroundTracking();
    }
    if (state.bgWatcherId) {
      return { ok: true, mode: "apk_bg", watcherId: state.bgWatcherId };
    }

    try {
      var watcherId = await BgGeo.addWatcher(
        {
          backgroundMessage: "TurboNetwork está compartiendo tu ubicación operativa en campo.",
          backgroundTitle: "Rastreo Operativo Activo",
          requestPermissions: true,
          stale: false,
          distanceFilter: 10,
        },
        async function (location, error) {
          if (error) {
            state.lastError = error.code || "GPS error";
            emitGpsStatus();
            if (error.code === "NOT_AUTHORIZED" && window.confirm("TurboNetwork necesita permiso de ubicación 'Permitir todo el tiempo' para el seguimiento de cuadrilla. ¿Abrir ajustes?")) {
              BgGeo.openSettings();
            }
            return;
          }
          if (!location || !hasSession()) return;
          state.trackingActive = true;
          state.trackingMode = "apk_bg";
          sendTelemetryPing(location, "background_gps");
        }
      );

      state.bgWatcherId = watcherId;
      state.trackingActive = true;
      state.trackingMode = "apk_bg";
      try {
        localStorage.setItem("turbonetwork_bg_gps_enabled", "1");
      } catch (_) {}
      emitGpsStatus();
      return { ok: true, mode: "apk_bg", watcherId: watcherId };
    } catch (err) {
      state.lastError = String(err && err.message ? err.message : err);
      emitGpsStatus();
      return { ok: false, error: state.lastError };
    }
  }

  async function stopBackgroundTracking() {
    var BgGeo = Plugins.BackgroundGeolocation;
    if (BgGeo && state.bgWatcherId) {
      try {
        await BgGeo.removeWatcher({ id: state.bgWatcherId });
      } catch (_) {}
    }
    if (state.pwaWatchId !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      try {
        navigator.geolocation.clearWatch(state.pwaWatchId);
      } catch (_) {}
    }
    state.bgWatcherId = null;
    state.pwaWatchId = null;
    state.trackingActive = false;
    state.trackingMode = "idle";
    try {
      localStorage.removeItem("turbonetwork_bg_gps_enabled");
    } catch (_) {}
    emitGpsStatus();
    return { ok: true };
  }

  // =========================================================================
  // 3. DISPOSITIVOS CERCANOS (BLUETOOTH / BLE / BEACONS / IMPRESORAS)
  // =========================================================================
  async function initBluetooth() {
    var Ble = Plugins.BluetoothLe;
    if (!isNative || !Ble) return { ok: false, reason: "ble_unavailable" };
    try {
      await Ble.initialize({ androidNeverForLocation: false });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  }

  async function scanNearbyDevices(durationMs) {
    var Ble = Plugins.BluetoothLe;
    if (!isNative || !Ble) return [];
    var initRes = await initBluetooth();
    if (!initRes.ok) return [];

    var foundMap = {};
    try {
      await Ble.requestLEScan({ allowDuplicates: false }, function (result) {
        if (!result || !result.device || !result.device.deviceId) return;
        foundMap[result.device.deviceId] = {
          deviceId: result.device.deviceId,
          name: result.device.name || result.localName || "Dispositivo BLE",
          rssi: result.rssi,
          uuids: result.uuids || [],
        };
      });

      await new Promise(function (resolve) {
        setTimeout(resolve, durationMs || 4500);
      });
      await Ble.stopLEScan();
    } catch (_) {}

    return Object.values(foundMap).sort(function (a, b) {
      return (b.rssi || -100) - (a.rssi || -100);
    });
  }

  async function reportNearbyBeacon(beacon) {
    if (!hasSession() || !beacon || !beacon.deviceId) return;
    try {
      await apiFetch("/api/mobile/nearby/checkin", {
        method: "POST",
        body: JSON.stringify({
          beaconId: beacon.deviceId,
          beaconName: beacon.name || "Beacon BLE",
          zoneType: beacon.zoneType || "other",
          rssi: beacon.rssi,
        }),
      });
    } catch (_) {}
  }

  // =========================================================================
  // 4. HAPTICS, BOTÓN ATRÁS Y WIZARD DE PERMISOS
  // =========================================================================
  function haptic(style) {
    var Haptics = Plugins.Haptics;
    if (!isNative || !Haptics) return;
    try {
      Haptics.impact({ style: (style || "LIGHT").toUpperCase() });
    } catch (_) {}
  }

  function setupSystemListeners() {
    if (!isNative) return;
    var App = Plugins.App;
    var StatusBar = Plugins.StatusBar;

    if (StatusBar) {
      try {
        StatusBar.setBackgroundColor({ color: "#0f172a" });
        StatusBar.setStyle({ style: "DARK" });
      } catch (_) {}
    }

    if (App && !state._appListenersBound) {
      state._appListenersBound = true;
      App.addListener("backButton", function (info) {
        var openDialog = document.querySelector("dialog[open]");
        if (openDialog && typeof openDialog.close === "function") {
          openDialog.close();
          return;
        }
        if (info && info.canGoBack) {
          window.history.back();
        } else {
          App.minimizeApp ? App.minimizeApp() : App.exitApp();
        }
      });
    }
  }

  function openPermissionsWizard() {
    if (!isNative) return;
    if (document.getElementById("turboNativePermModal")) return;

    var modal = document.createElement("div");
    modal.id = "turboNativePermModal";
    modal.style.cssText =
      "position:fixed;inset:0;z-index:99999;background:rgba(2,6,23,0.82);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:16px;";
    modal.innerHTML =
      '<div style="width:100%;max-width:400px;background:#0f172a;color:#f8fafc;border:1px solid rgba(148,163,184,0.2);border-radius:20px;padding:22px;font-family:system-ui,sans-serif;box-shadow:0 20px 50px rgba(0,0,0,0.5)">' +
      '<h3 style="margin:0 0 6px;font-size:18px;font-weight:700">Permisos Nativos de la App</h3>' +
      '<p style="margin:0 0 16px;font-size:13px;color:#94a3b8;line-height:1.45">Activa los permisos del teléfono para recibir alertas en tiempo real, rastreo GPS de cuadrilla y conexión con dispositivos cercanos.</p>' +
      '<div style="display:flex;flex-direction:column;gap:10px;margin-bottom:18px">' +
      '<button id="tnPermPush" style="text-align:left;padding:12px;border-radius:12px;border:1px solid rgba(59,130,246,0.35);background:rgba(37,99,235,0.12);color:#fff;font-size:13px;font-weight:600;cursor:pointer">1. Activar Notificaciones Push en Tiempo Real</button>' +
      '<button id="tnPermGeo" style="text-align:left;padding:12px;border-radius:12px;border:1px solid rgba(16,185,129,0.35);background:rgba(16,185,129,0.12);color:#fff;font-size:13px;font-weight:600;cursor:pointer">2. Activar Ubicación GPS en Segundo Plano</button>' +
      '<button id="tnPermBle" style="text-align:left;padding:12px;border-radius:12px;border:1px solid rgba(168,85,247,0.35);background:rgba(168,85,247,0.12);color:#fff;font-size:13px;font-weight:600;cursor:pointer">3. Activar Dispositivos Cercanos (Bluetooth / Wi-Fi)</button>' +
      "</div>" +
      '<button id="tnPermDone" style="width:100%;padding:12px;border-radius:12px;border:0;background:#2563eb;color:#fff;font-weight:700;font-size:14px;cursor:pointer">Continuar al Sistema</button>' +
      "</div>";

    document.body.appendChild(modal);

    document.getElementById("tnPermPush").onclick = async function () {
      var res = await initPushNotifications(true);
      this.textContent = res.granted ? "✓ Notificaciones Push activadas" : "⚠ Permiso de notificaciones denegado";
    };
    document.getElementById("tnPermGeo").onclick = async function () {
      var res = await startBackgroundTracking();
      this.textContent = res.ok ? "✓ Ubicación en segundo plano activa" : "⚠ Revisa permiso de ubicación en Ajustes";
    };
    document.getElementById("tnPermBle").onclick = async function () {
      var res = await initBluetooth();
      this.textContent = res.ok ? "✓ Dispositivos cercanos (BLE) listos" : "⚠ Activa Bluetooth / Dispositivos cercanos";
    };
    document.getElementById("tnPermDone").onclick = function () {
      try {
        localStorage.setItem("turbonetwork_native_onboarded", "1");
      } catch (_) {}
      modal.remove();
    };
  }

  async function bootstrap() {
    if (isNative) {
      setupSystemListeners();
    }
    if (hasSession()) {
      // 1. Registrar dispositivo automáticamente (Device Binding)
      if (isTechOrMobileContext()) {
        await registerCurrentDevice();
        // 2. Arrancar rastreo GPS automáticamente apenas inicia sesión
        await startBackgroundTracking();
      }
      if (isNative) {
        initPushNotifications(false);
        if (!localStorage.getItem("turbonetwork_native_onboarded")) {
          setTimeout(openPermissionsWizard, 900);
        }
      }
    }
    emitGpsStatus();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }

  window.TurboNative = {
    isNative: isNative,
    platform: state.platform,
    getDeviceId: function () { return state.deviceId; },
    getStatus: function () {
      return {
        isNative: state.isNative,
        platform: state.platform,
        deviceId: state.deviceId,
        deviceModel: state.deviceModel,
        deviceStatus: state.deviceStatus,
        trackingActive: state.trackingActive,
        trackingMode: state.trackingMode,
        lastPingAt: state.lastPingAt,
        lastError: state.lastError,
      };
    },
    registerCurrentDevice: registerCurrentDevice,
    initPushNotifications: initPushNotifications,
    startBackgroundTracking: startBackgroundTracking,
    stopBackgroundTracking: stopBackgroundTracking,
    initBluetooth: initBluetooth,
    scanNearbyDevices: scanNearbyDevices,
    reportNearbyBeacon: reportNearbyBeacon,
    openPermissionsWizard: openPermissionsWizard,
    haptic: haptic,
  };
})();
