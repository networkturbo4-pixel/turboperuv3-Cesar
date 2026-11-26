import type { CapacitorConfig } from "@capacitor/cli";

const SERVER_URL = process.env.TURBO_MOBILE_SERVER_URL || "https://sistemaloa.cloud";

const config: CapacitorConfig = {
  appId: "com.turbonetwork.app",
  appName: "TurboNetwork",
  webDir: "www",
  server: {
    // En producción apunta al servidor en vivo; para pruebas locales usar TURBO_MOBILE_SERVER_URL=http://10.0.2.2:3000
    url: SERVER_URL,
    cleartext: true,
    androidScheme: "https",
    allowNavigation: ["*"],
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#2563eb",
    },
  },
};

export default config;
