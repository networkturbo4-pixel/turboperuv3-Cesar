import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getTenantFilePath } from "../tenants/tenants.service";

export interface MobileDeviceRecord {
  id: string;
  userId: number;
  userName: string;
  platform: "android" | "ios" | "web";
  fcmToken: string;
  deviceName?: string;
  appVersion?: string;
  channels?: string[];
  lastSeenAt: string;
  createdAt: string;
}

export interface MobilePushPayload {
  title: string;
  body: string;
  channelId?: "turbo_urgent_orders" | "turbo_chat" | "turbo_calls" | "turbo_attendance" | "turbo_general";
  url?: string;
  tag?: string;
  data?: Record<string, string>;
}

interface FirebaseServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

function loadMobileDevices(tenantId: string): MobileDeviceRecord[] {
  const filePath = getTenantFilePath(tenantId, "mobile_devices.json");
  try {
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch {
    // ignore corrupt read
  }
  return [];
}

function saveMobileDevices(tenantId: string, devices: MobileDeviceRecord[]): void {
  const filePath = getTenantFilePath(tenantId, "mobile_devices.json");
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(devices, null, 2), "utf-8");
}

function getFirebaseServiceAccount(): FirebaseServiceAccount | null {
  try {
    const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (rawJson && rawJson.trim().startsWith("{")) {
      return JSON.parse(rawJson);
    }
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.resolve(process.cwd(), "firebase-service-account.json");
    if (credPath && fs.existsSync(credPath)) {
      return JSON.parse(fs.readFileSync(credPath, "utf-8"));
    }
  } catch {
    // ignore invalid json
  }
  return null;
}

async function getFirebaseAccessToken(sa: FirebaseServiceAccount): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 60) {
    return cachedAccessToken.token;
  }

  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: sa.token_uri || "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  ).toString("base64url");

  const sign = crypto.createSign("RSA-SHA256");
  sign.update(`${header}.${payload}`);
  const signature = sign.sign(sa.private_key, "base64url");
  const jwt = `${header}.${payload}.${signature}`;

  const res = await fetch(sa.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) return null;
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) return null;

  cachedAccessToken = {
    token: json.access_token,
    expiresAt: now + (json.expires_in || 3600),
  };
  return cachedAccessToken.token;
}

export class MobilePushService {
  static registerDevice(
    tenantId: string,
    input: {
      userId: number;
      userName: string;
      platform: "android" | "ios" | "web";
      fcmToken: string;
      deviceName?: string;
      appVersion?: string;
    }
  ): MobileDeviceRecord {
    const devices = loadMobileDevices(tenantId);
    const now = new Date().toISOString();
    const existing = devices.find((d) => d.fcmToken === input.fcmToken);

    if (existing) {
      existing.userId = input.userId;
      existing.userName = input.userName;
      existing.platform = input.platform;
      existing.deviceName = input.deviceName || existing.deviceName;
      existing.appVersion = input.appVersion || existing.appVersion;
      existing.lastSeenAt = now;
      saveMobileDevices(tenantId, devices);
      return existing;
    }

    const record: MobileDeviceRecord = {
      id: "mob-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      userId: input.userId,
      userName: input.userName,
      platform: input.platform,
      fcmToken: input.fcmToken,
      deviceName: input.deviceName,
      appVersion: input.appVersion,
      channels: ["turbo_urgent_orders", "turbo_chat", "turbo_calls", "turbo_attendance"],
      lastSeenAt: now,
      createdAt: now,
    };

    devices.unshift(record);
    saveMobileDevices(tenantId, devices);
    return record;
  }

  static unregisterDevice(tenantId: string, fcmToken: string): boolean {
    const devices = loadMobileDevices(tenantId);
    const filtered = devices.filter((d) => d.fcmToken !== fcmToken);
    if (filtered.length !== devices.length) {
      saveMobileDevices(tenantId, filtered);
      return true;
    }
    return false;
  }

  static listDevices(tenantId: string, userId?: number): MobileDeviceRecord[] {
    const devices = loadMobileDevices(tenantId);
    return userId != null ? devices.filter((d) => d.userId === userId) : devices;
  }

  static async sendToUser(
    tenantId: string,
    userId: number,
    payload: MobilePushPayload
  ): Promise<{ sent: number; failed: number; fcmConfigured: boolean }> {
    const targets = this.listDevices(tenantId, userId);
    return this.sendToDevices(tenantId, targets, payload);
  }

  static async sendToTenant(
    tenantId: string,
    payload: MobilePushPayload
  ): Promise<{ sent: number; failed: number; fcmConfigured: boolean }> {
    const targets = this.listDevices(tenantId);
    return this.sendToDevices(tenantId, targets, payload);
  }

  private static async sendToDevices(
    tenantId: string,
    targets: MobileDeviceRecord[],
    payload: MobilePushPayload
  ): Promise<{ sent: number; failed: number; fcmConfigured: boolean }> {
    if (targets.length === 0) {
      return { sent: 0, failed: 0, fcmConfigured: Boolean(getFirebaseServiceAccount()) };
    }

    const sa = getFirebaseServiceAccount();
    if (!sa) {
      return { sent: 0, failed: 0, fcmConfigured: false };
    }

    const accessToken = await getFirebaseAccessToken(sa);
    if (!accessToken) {
      return { sent: 0, failed: targets.length, fcmConfigured: true };
    }

    let sent = 0;
    let failed = 0;
    const staleTokens: string[] = [];

    await Promise.all(
      targets.map(async (dev) => {
        try {
          const res = await fetch(
            `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                message: {
                  token: dev.fcmToken,
                  notification: {
                    title: payload.title,
                    body: payload.body,
                  },
                  android: {
                    priority: "HIGH",
                    notification: {
                      channel_id: payload.channelId || "turbo_general",
                      sound: "default",
                      tag: payload.tag,
                    },
                  },
                  data: {
                    url: payload.url || "/",
                    channelId: payload.channelId || "turbo_general",
                    ...(payload.data || {}),
                  },
                },
              }),
            }
          );

          if (res.ok) {
            sent++;
          } else {
            failed++;
            const errBody = await res.text();
            if (errBody.includes("UNREGISTERED") || errBody.includes("INVALID_ARGUMENT")) {
              staleTokens.push(dev.fcmToken);
            }
          }
        } catch {
          failed++;
        }
      })
    );

    if (staleTokens.length > 0) {
      const devices = loadMobileDevices(tenantId).filter((d) => !staleTokens.includes(d.fcmToken));
      saveMobileDevices(tenantId, devices);
    }

    return { sent, failed, fcmConfigured: true };
  }
}
