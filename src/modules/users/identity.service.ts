/**
 * Servicio centralizado de Identidad Única (Sistema Web + RRHH + ZKTeco ADMS)
 *
 * Reglas de arquitectura:
 * 1. Toda persona (Colaborador RRHH y/o Operador Web) comparte UN SOLO ID numérico entero
 *    de 1 a 9 dígitos (1 .. 999_999_999), 100% compatible con el campo PIN de ZKTeco.
 * 2. Si cuenta con DNI / Documento numérico válido (hasta 9 dígitos), su ID único y su
 *    ID en ZKTeco (`biometricPin`) es el valor numérico entero de ese documento
 *    (ej. DNI "45432930" -> 45432930, CE "007599878" -> 7599878), conservando el texto
 *    original con ceros a la izquierda en `dni` para SUNAT PLAME.
 * 3. El Superadministrador raíz conserva exclusivamente el `id = 1`.
 * 4. Si se registra un usuario sin DNI numérico, recibe un ID correlativo libre en el rango
 *    `900001 .. 999999` (6 dígitos), jamás `Date.now()` (13 dígitos) ni prefijos `BIO-xxx`.
 * 5. El PIN de acceso web (8 dígitos) es estrictamente una credencial secreta cifrada con
 *    scrypt (`pinHash`) y JAMÁS se utiliza como ID de empleado ni se envía al reloj ZKTeco.
 */

export const ZKTECO_MAX_NUMERIC_ID = 999_999_999;
export const FALLBACK_NUMERIC_ID_START = 900_001;

/**
 * Convierte un documento o código estrictamente numérico en un entero válido para ZKTeco (1..999999999).
 * Rechaza códigos alfanuméricos tipo "BIO-001" y timestamps de 13 dígitos (`Date.now()`).
 */
export function extractCanonicalNumericId(raw?: string | number | null): number | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === "number") {
    if (Number.isInteger(raw) && raw >= 1 && raw <= ZKTECO_MAX_NUMERIC_ID) {
      return raw;
    }
    return null;
  }

  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  // Rechazar cualquier cadena con letras o guiones (ej. "BIO-001")
  if (!/^\d+$/.test(trimmed)) return null;

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > ZKTECO_MAX_NUMERIC_ID) {
    return null;
  }
  return parsed;
}

/**
 * Asigna el ID numérico único canónico garantizando cero colisiones entre RRHH y Operadores Web.
 */
export function allocateCanonicalUserId(options: {
  dni?: string | null;
  preferredId?: number | string | null;
  usedIds: Iterable<number>;
  allowRootOne?: boolean;
}): number {
  const taken = new Set<number>();
  for (const id of options.usedIds) {
    if (Number.isInteger(id) && id > 0) taken.add(id);
  }

  // 1. Prioridad absoluta: DNI / Documento numérico (si no es 1 o si se permite explícitamente)
  const fromDni = extractCanonicalNumericId(options.dni);
  if (fromDni && (fromDni !== 1 || options.allowRootOne) && !taken.has(fromDni)) {
    return fromDni;
  }

  // 2. ID preferido válido (1..999999999) libre de colisión
  const fromPreferred = extractCanonicalNumericId(options.preferredId);
  if (fromPreferred && (fromPreferred !== 1 || options.allowRootOne) && !taken.has(fromPreferred)) {
    return fromPreferred;
  }

  // 3. Rango secuencial seguro de 6 dígitos (900001+) compatible con todos los relojes ZKTeco
  let candidate = FALLBACK_NUMERIC_ID_START;
  while (taken.has(candidate) && candidate <= ZKTECO_MAX_NUMERIC_ID) {
    candidate++;
  }
  return candidate;
}

/**
 * Formato exacto que se envía como `PIN=` al dispositivo biométrico ZKTeco ADMS.
 */
export function toZktecoPin(canonicalId: number): string {
  const valid = extractCanonicalNumericId(canonicalId);
  if (!valid) {
    throw new Error(`ID inválido para ZKTeco: ${canonicalId}`);
  }
  return String(valid);
}

/**
 * Comprueba si un registro de persona (colaborador u operador) coincide con el ID o PIN enviado
 * por ZKTeco o por el cliente web (soportando documentos con o sin ceros a la izquierda).
 */
export function matchesCanonicalIdentity(
  person: { id?: number; dni?: string; biometricPin?: string; biometricId?: string; operatorId?: number },
  rawIdentifier: number | string
): boolean {
  const rawStr = String(rawIdentifier ?? "").trim();
  if (!rawStr) return false;

  const queryNum = extractCanonicalNumericId(rawStr);
  if (queryNum !== null) {
    if (person.id === queryNum) return true;
    if (person.operatorId && person.operatorId === queryNum) return true;
    const dniNum = extractCanonicalNumericId(person.dni);
    if (dniNum !== null && dniNum === queryNum) return true;
    const bioNum = extractCanonicalNumericId(person.biometricPin || person.biometricId);
    if (bioNum !== null && bioNum === queryNum) return true;
  }

  if (person.dni && String(person.dni).trim() === rawStr) return true;
  return false;
}
