import { loadCustomersFromDisk, CustomerRecord } from "../customers/customers.routes";
import { cleanPhoneNumber } from "../messages/whatsapp.service";
import { BotCustomerSummary } from "./bot.types";

function toSummary(c: CustomerRecord): BotCustomerSummary {
  return {
    id: Number(c.id),
    customerCode: String(c.customerCode || ""),
    fullName: String(c.fullName || ""),
    identification: String(c.identification || ""),
    phone: String(c.phone || ""),
    address: String(c.address || ""),
    status: String(c.status || "active"),
  };
}

function phoneSuffix(raw: string): string {
  const digits = cleanPhoneNumber(raw || "");
  return digits.length >= 9 ? digits.slice(-9) : digits;
}

/**
 * Busca un cliente del tenant cuyo teléfono coincida con el handle del canal (WhatsApp).
 */
export function identifyCustomerByHandle(
  tenantId: string,
  channel: string,
  contactHandle: string
): BotCustomerSummary | null {
  if (channel !== "whatsapp") return null;
  const targetSuffix = phoneSuffix(contactHandle);
  if (!targetSuffix || targetSuffix.length < 7) return null;

  const customers = loadCustomersFromDisk(tenantId);
  const match = customers.find((c) => {
    const cSuffix = phoneSuffix(c.phone || "");
    return Boolean(cSuffix && cSuffix === targetSuffix);
  });
  return match ? toSummary(match) : null;
}

/**
 * Busca un cliente por ID interno dentro del tenant.
 */
export function getCustomerById(tenantId: string, customerId: number): BotCustomerSummary | null {
  const customers = loadCustomersFromDisk(tenantId);
  const match = customers.find((c) => Number(c.id) === Number(customerId));
  return match ? toSummary(match) : null;
}

/**
 * Verifica a un cliente a partir de su número de documento (DNI/RUC) o código de cliente.
 */
export function verifyCustomerByDocument(tenantId: string, rawInput: string): BotCustomerSummary | null {
  const cleaned = String(rawInput || "").trim().toUpperCase();
  if (!cleaned) return null;

  // Extraer posibles tokens alfanuméricos (ej. "mi dni es 45678912" -> "45678912" o "TN-001")
  const tokens = cleaned.match(/[A-Z0-9-]{4,20}/g) || [cleaned];
  const customers = loadCustomersFromDisk(tenantId);

  for (const token of tokens) {
    const match = customers.find((c) => {
      const doc = String(c.identification || "").trim().toUpperCase();
      const code = String(c.customerCode || "").trim().toUpperCase();
      return (doc && doc === token) || (code && code === token);
    });
    if (match) return toSummary(match);
  }
  return null;
}
