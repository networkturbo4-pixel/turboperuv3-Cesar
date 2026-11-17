export function normalizeChannelHandle(channel: string, rawHandle: string): string {
  const trimmed = String(rawHandle || "").trim();
  if (!trimmed) return "";

  if (channel !== "whatsapp") {
    return trimmed;
  }

  if (trimmed.endsWith("@g.us")) {
    return trimmed;
  }

  if (trimmed.endsWith("@lid")) {
    const base = trimmed.split(":")[0];
    return base.endsWith("@lid") ? base : `${base}@lid`;
  }

  const withoutJid = trimmed.includes("@") ? trimmed.split("@")[0].split(":")[0] : trimmed;
  const digits = withoutJid.replace(/\D/g, "");

  // Celular de Perú ingresado con 9 dígitos sin código de país (ej. 908596716 -> +51908596716)
  if (digits.length === 9 && digits.startsWith("9")) {
    return `+51${digits}`;
  }

  if (digits.length >= 8) {
    return `+${digits}`;
  }

  return trimmed;
}

export function computeCleanInitials(rawName: string, fallback = "WA"): string {
  const raw = String(rawName || "").trim();
  if (!raw) return fallback;

  // Extraer tokens de letras reales ignorando +, @, guiones bajos, etc.
  const letterTokens = raw.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/g);
  if (letterTokens && letterTokens.length >= 2) {
    return (letterTokens[0][0] + letterTokens[1][0]).toUpperCase();
  }
  if (letterTokens && letterTokens.length === 1) {
    return letterTokens[0].slice(0, 2).toUpperCase();
  }

  // Si es solo un número telefónico (+51 926 997 372), mostrar los últimos 2 dígitos en vez de "+9"
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 2) {
    return digits.slice(-2);
  }

  return fallback;
}
