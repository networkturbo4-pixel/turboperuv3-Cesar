/**
 * TurboNetwork Native Bridge (Capacitor Android/iOS)
 * Conecta el sistema web con capacidades nativas:
 *  - Push Notifications (FCM + Canales de alta prioridad)
 *  - Ubicación GPS en segundo plano (Foreground Service)
 *  - Dispositivos Cercanos (Bluetooth / BLE / Beacons / Impresoras térmicas)
 *  - Botón físico Atrás, Deep Linking y Haptics
 */
(function () {
  "use strict";

  var cap = typeof window !== "undefined" ? window.Capacitor : null;
  var isNative = Boolean(cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform());
  var Plugins = (cap && cap.Plugins) || {};

  var state = {
    isNative: isNative,
    platform: cap && typeof cap.getPlatform === "function" ? cap.getPlatform() : "web",
    fcmToken: localStorage.getItem("turbonetwork_fcm_token") || "",
    bgWatcherId: null,
    lastPingAt: 0,
    lastPrinterDeviceId: localStorage.getItem("turbonetwork_bt_printer_id") || "",
  };

  function hasSession() {
    try {
      return Boolean(localStorage.getItem("turbonetwork_session"));
    } catch (_) {
      return false;
    }
  }

  async function apiFetch(url, options) {
    var opts = options || {};
    opts.headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    return fetch(url, opts);
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
                  appVersion: "1.0.0",
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
  // 2. UBICACIÓN GPS EN SEGUNDO PLANO (FOREGROUND SERVICE)
  // =========================================================================
  async function startBackgroundTracking() {
    var BgGeo = Plugins.BackgroundGeolocation;
    if (!isNative || !BgGeo) {
      return { ok: false, reason: "plugin_unavailable" };
    }
    if (state.bgWatcherId) {
      return { ok: true, watcherId: state.bgWatcherId };
    }

    try {
      var watcherId = await BgGeo.addWatcher(
        {
          backgroundMessage: "TurboNetwork está compartiendo tu ubicación operativa en campo.",
          backgroundTitle: "Rastreo Operativo Activo",
          requestPermissions: true,
          stale: false,
          distanceFilter: 25,
        },
        async function (location, error) {
          if (error) {
            if (error.code === "NOT_AUTHORIZED" && window.confirm("TurboNetwork necesita permiso de ubicación 'Permitir todo el tiempo' para el seguimiento de cuadrilla. ¿Abrir ajustes?")) {
              BgGeo.openSettings();
            }
            return;
          }
          if (!location || !hasSession()) return;

          var now = Date.now();
          if (now - state.lastPingAt < 12000) return;
          state.lastPingAt = now;

          try {
            await apiFetch("/api/mobile/telemetry/location", {
              method: "POST",
              body: JSON.stringify({
                latitude: location.latitude,
                longitude: location.longitude,
                accuracy: location.accuracy,
                speed: location.speed,
                heading: location.bearing,
                source: "background_gps",
              }),
            });
          } catch (_) {}
        }
      );

      state.bgWatcherId = watcherId;
      localStorage.setItem("turbonetwork_bg_gps_enabled", "1");
      return { ok: true, watcherId: watcherId };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  }

  async function stopBackgroundTracking() {
    var BgGeo = Plugins.BackgroundGeolocation;
    if (BgGeo && state.bgWatcherId) {
      try {
        await BgGeo.removeWatcher({ id: state.bgWatcherId });
      } catch (_) {}
    }
    state.bgWatcherId = null;
    localStorage.removeItem("turbonetwork_bg_gps_enabled");
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

  function bootstrap() {
    if (!isNative) return;
    setupSystemListeners();
    if (hasSession()) {
      initPushNotifications(false);
      if (localStorage.getItem("turbonetwork_bg_gps_enabled") === "1") {
        startBackgroundTracking();
      }
      if (!localStorage.getItem("turbonetwork_native_onboarded")) {
        setTimeout(openPermissionsWizard, 900);
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }

  window.TurboNative = {
    isNative: isNative,
    platform: state.platform,
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
