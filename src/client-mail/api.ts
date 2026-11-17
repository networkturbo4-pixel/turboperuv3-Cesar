export function getMailAuthToken(): string {
  try {
    const raw = localStorage.getItem("turbonetwork_session");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.token) return String(parsed.token);
    }
  } catch {}
  return "";
}

export function getActiveTenantId(): string {
  return localStorage.getItem("turbonetwork_active_tenant") || "";
}

export async function mailApi<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getMailAuthToken();
  const activeTenant = getActiveTenantId();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (activeTenant) {
    headers["x-tenant-id"] = activeTenant;
  }

  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    throw new Error(data?.error || data?.message || `Error HTTP ${res.status}`);
  }
  return data as T;
}
