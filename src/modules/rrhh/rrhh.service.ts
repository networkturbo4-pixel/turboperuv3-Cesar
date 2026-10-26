import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getInventoryProducts, getPersonnelAssignments } from "../inventory/inventory.service";

const DATA_DIR = path.resolve(process.cwd(), "data");
const LEAVES_FILE = path.join(DATA_DIR, "rrhh_leaves.json");
const COMMISSION_RULES_FILE = path.join(DATA_DIR, "rrhh_commission_rules.json");
const COMMISSIONS_FILE = path.join(DATA_DIR, "rrhh_commissions.json");
const INCIDENTS_FILE = path.join(DATA_DIR, "rrhh_incidents.json");
const PAYROLLS_FILE = path.join(DATA_DIR, "rrhh_payrolls.json");

// ==========================================
// 1. INTERFACES DE EXPEDIENTE Y DOCUMENTOS
// ==========================================

export interface EmployeeDocument {
  id: string;
  title: string;
  category: "contrato" | "adenda" | "dni" | "antecedentes" | "certificado" | "licencia" | "boleta" | "otro" | string;
  issueDate?: string;
  expiryDate?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: string | number;
  notes?: string;
  uploadedAt: string;
}

export interface HRContractAlert {
  id: string;
  employeeId: number;
  employeeName: string;
  position: string;
  avatar?: string;
  alertType: "contract_expiring" | "contract_expired" | "document_expiring";
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  targetDate: string;
  daysRemaining: number;
  contractType?: string;
}

// ==========================================
// 2. INTERFACES DE PERMISOS Y VACACIONES
// ==========================================

export type LeaveType =
  | "vacation"
  | "medical"
  | "personal_paid"
  | "personal_unpaid"
  | "maternity_paternity"
  | "field_commission";

export interface LeaveRequest {
  id: number;
  employeeId: number;
  employeeName: string;
  employeePosition?: string;
  employeeAvatar?: string;
  tenantId: string;
  type: LeaveType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  daysCount: number;
  reason: string;
  attachmentUrl?: string;
  status: "pending" | "approved" | "rejected";
  reviewedBy?: string;
  reviewedAt?: string | null;
  reviewNotes?: string;
  createdAt: string;
}

// ==========================================
// 3. INTERFACES DE COMISIONES (SOBRE MARGEN)
// ==========================================

export interface CommissionRule {
  id: string;
  name: string;
  productType: string; // ej: "activos", "fibra", "pasivos", "planes_isp", "epp", "servicios", "general"
  categoryId?: string;
  percentageOnMargin: number; // % sobre (precioVenta - costoBase)
  description?: string;
  isActive: boolean;
  updatedAt: string;
}

export interface CommissionSale {
  id: number;
  employeeId: number;
  employeeName: string;
  tenantId: string;
  period: string; // YYYY-MM
  date: string; // YYYY-MM-DD
  customerName: string;
  productId?: number | null;
  productName: string;
  productType: string;
  ruleId: string;
  ruleName: string;
  quantity: number;
  unitCost: number;
  unitSalePrice: number;
  totalCost: number;
  totalSale: number;
  profitMargin: number; // totalSale - totalCost
  commissionPercentage: number;
  commissionAmount: number; // profitMargin * (commissionPercentage / 100)
  status: "confirmed" | "paid" | "cancelled";
  notes?: string;
  createdAt: string;
}

// ==========================================
// 4. INTERFACES DE PLANILLA E INCIDENCIAS
// ==========================================

export type IncidentType =
  | "material_damage"
  | "garment_epp"
  | "salary_advance"
  | "other_deduction"
  | "bonus";

export interface PayrollIncident {
  id: number;
  employeeId: number;
  employeeName: string;
  tenantId: string;
  period: string; // YYYY-MM
  date: string; // YYYY-MM-DD
  type: IncidentType;
  title: string;
  description?: string;
  amount: number;
  sourceAssignmentId?: string;
  status: "active" | "waived";
  createdBy?: string;
  createdAt: string;
}

export interface PayrollItem {
  id: string;
  period: string; // YYYY-MM
  tenantId: string;
  employeeId: number;
  employeeName: string;
  position: string;
  dni: string;
  currency: string;
  baseSalary: number;
  hourlyRate: number;
  minuteRate: number;
  // Asistencia y Tardanzas
  daysWorked: number;
  lateOccurrences: number;
  totalMinutesLate: number;
  minutesLateTotal: number;
  tardinessDeduction: number;
  tardinessDiscount: number;
  // Permisos y Faltas
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  unpaidLeaveDeduction: number;
  unpaidLeaveDiscount: number;
  // Horas Extras
  totalOvertimeMinutes: number;
  overtimeHours: number;
  overtimePay: number;
  // Comisiones
  commissionsCount: number;
  commissionsTotal: number;
  // Incidencias / Descuentos (Daños de material, prendas EPP, adelantos) y Bonos
  materialDamageDeduction: number;
  garmentDeduction: number;
  advancesDeduction: number;
  otherDeductions: number;
  materialAndEppDeductions: number;
  advanceAndOtherDeductions: number;
  bonusesTotal: number;
  incidentsList: PayrollIncident[];
  // Ley / AFP / ONP
  afpType: string;
  pensionSystem: string;
  pensionRatePercent: number;
  pensionDeduction: number;
  // Totales
  grossIncome: number;
  totalDeductions: number;
  netPay: number;
  netSalary: number;
  // Estado de Pago
  paymentStatus: "draft" | "approved" | "paid";
  status: "paid" | "pending";
  paidAt?: string | null;
  voucherCode?: string;
}

// ==========================================
// 5. DATOS SEMILLA Y PERSISTENCIA
// ==========================================

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

const DEFAULT_COMMISSION_RULES: CommissionRule[] = [];

const DEFAULT_COMMISSIONS: CommissionSale[] = [];

const DEFAULT_LEAVES: LeaveRequest[] = [];

const DEFAULT_INCIDENTS: PayrollIncident[] = [];

// Loaders & Savers

export function loadLeavesFromDisk(): LeaveRequest[] {
  ensureDataDir();
  try {
    if (fs.existsSync(LEAVES_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(LEAVES_FILE, "utf-8"));
      if (Array.isArray(parsed)) return parsed;
    }
    fs.writeFileSync(LEAVES_FILE, JSON.stringify([], null, 2), "utf-8");
    return [];
  } catch {
    return [];
  }
}

export function saveLeavesToDisk(list: LeaveRequest[]) {
  ensureDataDir();
  fs.writeFileSync(LEAVES_FILE, JSON.stringify(list, null, 2), "utf-8");
}

export function loadCommissionRulesFromDisk(): CommissionRule[] {
  ensureDataDir();
  try {
    if (fs.existsSync(COMMISSION_RULES_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(COMMISSION_RULES_FILE, "utf-8"));
      if (Array.isArray(parsed)) return parsed;
    }
    fs.writeFileSync(COMMISSION_RULES_FILE, JSON.stringify([], null, 2), "utf-8");
    return [];
  } catch {
    return [];
  }
}

export function saveCommissionRulesToDisk(list: CommissionRule[]) {
  ensureDataDir();
  fs.writeFileSync(COMMISSION_RULES_FILE, JSON.stringify(list, null, 2), "utf-8");
}

export function loadCommissionsFromDisk(): CommissionSale[] {
  ensureDataDir();
  try {
    if (fs.existsSync(COMMISSIONS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(COMMISSIONS_FILE, "utf-8"));
      if (Array.isArray(parsed)) return parsed;
    }
    fs.writeFileSync(COMMISSIONS_FILE, JSON.stringify([], null, 2), "utf-8");
    return [];
  } catch {
    return [];
  }
}

export function saveCommissionsToDisk(list: CommissionSale[]) {
  ensureDataDir();
  fs.writeFileSync(COMMISSIONS_FILE, JSON.stringify(list, null, 2), "utf-8");
}

export function loadIncidentsFromDisk(): PayrollIncident[] {
  ensureDataDir();
  try {
    if (fs.existsSync(INCIDENTS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(INCIDENTS_FILE, "utf-8"));
      if (Array.isArray(parsed)) return parsed;
    }
    fs.writeFileSync(INCIDENTS_FILE, JSON.stringify([], null, 2), "utf-8");
    return [];
  } catch {
    return [];
  }
}

export function saveIncidentsToDisk(list: PayrollIncident[]) {
  ensureDataDir();
  fs.writeFileSync(INCIDENTS_FILE, JSON.stringify(list, null, 2), "utf-8");
}

export function loadPayrollsStatusFromDisk(): Record<string, { paymentStatus: "draft" | "approved" | "paid"; paidAt?: string | null; voucherCode?: string }> {
  ensureDataDir();
  try {
    if (fs.existsSync(PAYROLLS_FILE)) {
      return JSON.parse(fs.readFileSync(PAYROLLS_FILE, "utf-8")) || {};
    }
    return {};
  } catch {
    return {};
  }
}

export function savePayrollsStatusToDisk(map: Record<string, { paymentStatus: "draft" | "approved" | "paid"; paidAt?: string | null; voucherCode?: string }>) {
  ensureDataDir();
  fs.writeFileSync(PAYROLLS_FILE, JSON.stringify(map, null, 2), "utf-8");
}

// ==========================================
// 6. LÓGICA DE EXPEDIENTE Y ALERTAS A 15 DÍAS
// ==========================================

export function enrichEmployeeExpediente(emp: any, approvedLeaves: LeaveRequest[], todayStr: string): any {
  // Calcular vacaciones acumuladas según fecha de ingreso (2.5 días por mes completo en Perú = 30 días/año)
  const hireDateStr = emp.hireDate || todayStr;
  const hireMs = new Date(`${hireDateStr}T00:00:00`).getTime();
  const nowMs = new Date(`${todayStr}T00:00:00`).getTime();
  const monthsWorked = isNaN(hireMs) ? 0 : Math.max(0, Math.floor((nowMs - hireMs) / (1000 * 60 * 60 * 24 * 30.4375)));
  const autoAccumulated = Math.min(60, Math.round(monthsWorked * 2.5));

  const accumulated =
    typeof emp.vacationDaysAccumulated === "number" ? emp.vacationDaysAccumulated : autoAccumulated;

  const approvedVacDays = (approvedLeaves || [])
    .filter((l) => l.employeeId === emp.id && l.type === "vacation" && l.status === "approved")
    .reduce((sum, l) => sum + (Number(l.daysCount) || 0), 0);

  const baseTaken = typeof emp.vacationDaysBaseTaken === "number" ? emp.vacationDaysBaseTaken : 0;
  const taken = baseTaken + approvedVacDays;
  const available = Math.max(0, accumulated - taken);

  let contractType = emp.contractType || "Plazo Fijo";
  let contractStartDate = emp.contractStartDate || emp.hireDate || "";
  let contractEndDate = emp.contractEndDate || "";

  const isIndeterminado =
    String(contractType).toLowerCase() === "indeterminado";

  let daysUntilContractExpiry: number | null = null;
  if (!isIndeterminado && contractEndDate) {
    const endMs = new Date(`${contractEndDate}T00:00:00`).getTime();
    if (!isNaN(endMs)) {
      daysUntilContractExpiry = Math.ceil((endMs - nowMs) / (1000 * 60 * 60 * 24));
    }
  }

  const contractAlertStatus =
    daysUntilContractExpiry === null
      ? "ok"
      : daysUntilContractExpiry < 0
      ? "expired"
      : daysUntilContractExpiry <= 15
      ? "expiring_soon"
      : "ok";

  const contractAlert = {
    status: contractAlertStatus,
    daysRemaining: daysUntilContractExpiry,
    label:
      contractAlertStatus === "expired"
        ? `Vencido (${Math.abs(daysUntilContractExpiry || 0)}d)`
        : contractAlertStatus === "expiring_soon"
        ? `Vence en ${daysUntilContractExpiry}d`
        : "Vigente",
  };

  const rawDocs: any[] = Array.isArray(emp.documents) ? emp.documents : [];
  const normalizedDocs = rawDocs.map((d) => ({
    ...d,
    expiresAt: d.expiresAt || d.expiryDate || undefined,
    uploadedAt: (d.uploadedAt || todayStr).slice(0, 10),
  }));

  const bioPin = emp.biometricId || emp.biometricPin || `BIO-${String(emp.id || 1).padStart(3, "0")}`;

  return {
    ...emp,
    contractType,
    contractStartDate,
    contractEndDate: contractEndDate || "",
    daysUntilContractExpiry,
    contractAlert,
    workModality: emp.workModality || "office",
    biometricPin: bioPin,
    biometricId: bioPin,
    biometricCredentialId: emp.biometricCredentialId || "",
    biometricRegisteredAt: emp.biometricRegisteredAt || "",
    fingerprintEnrolled: Boolean(emp.fingerprintEnrolled || emp.biometricCredentialId),
    vacationDaysAccumulated: accumulated,
    vacationDaysTaken: taken,
    vacationDaysAvailable: available,
    afpType: emp.afpType || emp.pensionSystem || "ONP",
    pensionSystem: emp.pensionSystem || emp.afpType || "ONP",
    bankName: emp.bankName || "",
    bankAccount: emp.bankAccount || "",
    documents: normalizedDocs,
  };
}

export function computeHRAlerts(_enrichedEmployees: any[], _todayStr: string, _alertWindowDays = 15): any[] {
  return [];
}

// ==========================================
// 7. SINCRONIZACIÓN DE DAÑOS DE INVENTARIO CON INCIDENCIAS DE PLANILLA
// ==========================================

export function syncDamagedInventoryAssignmentsToPayroll(tenantId: string, period: string): PayrollIncident[] {
  const incidents = loadIncidentsFromDisk();
  const assignments = getPersonnelAssignments(tenantId);
  const products = getInventoryProducts(tenantId, { includeDeleted: true });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const created: PayrollIncident[] = [];

  for (const asg of assignments) {
    if (asg.returnCondition !== "danado") continue;
    const alreadySynced = incidents.some((inc) => inc.sourceAssignmentId === asg.id);
    if (alreadySynced) continue;

    const prod = productMap.get(asg.productId);
    const unitCost = prod ? Number(prod.baseCost) || 35 : 35;
    const totalAmount = +(unitCost * (Number(asg.quantity) || 1)).toFixed(2);
    const isEpp =
      prod?.type === "epp" ||
      prod?.categoryName?.toLowerCase().includes("epp") ||
      asg.productName?.toLowerCase().includes("epp") ||
      asg.productName?.toLowerCase().includes("chaleco") ||
      asg.productName?.toLowerCase().includes("casco") ||
      asg.productName?.toLowerCase().includes("uniforme");

    const dateStr = (asg.returnedAt || asg.assignedAt || new Date().toISOString()).slice(0, 10);
    const incPeriod = dateStr.slice(0, 7) || period;

    const nextId = incidents.length > 0 ? Math.max(...incidents.map((i) => i.id)) + 1 : 1;
    const newInc: PayrollIncident = {
      id: nextId,
      employeeId: Number(asg.employeeId) || 1,
      employeeName: asg.employeeName || "Colaborador",
      tenantId,
      period: incPeriod,
      date: dateStr,
      type: isEpp ? "garment_epp" : "material_damage",
      title: `Daño reportado en Almacén: ${asg.productName}${asg.unitSku ? ` [${asg.unitSku}]` : ""}`,
      description: asg.notes || "Devolución registrada en mal estado / dañado en módulo de Inventario",
      amount: totalAmount,
      sourceAssignmentId: asg.id,
      status: "active",
      createdBy: "Sincronización Almacén",
      createdAt: new Date().toISOString(),
    };

    incidents.unshift(newInc);
    created.push(newInc);
  }

  if (created.length > 0) {
    saveIncidentsToDisk(incidents);
  }
  return created;
}

// ==========================================
// 8. MOTOR DE CÁLCULO AUTOMÁTICO DE PLANILLA MENSUAL
// ==========================================

export function calculateMonthlyPayroll(params: {
  period: string; // YYYY-MM
  tenantId: string;
  employees: any[];
  attendances: any[];
  leaves: LeaveRequest[];
  commissions: CommissionSale[];
  incidents: PayrollIncident[];
}): PayrollItem[] {
  const { period, tenantId, employees, attendances, leaves, commissions, incidents } = params;
  const statusMap = loadPayrollsStatusFromDisk();

  return employees
    .filter((emp) => emp.status === "active")
    .map((emp) => {
      const baseSalary = parseFloat(emp.salary) || 2500;
      const currency = emp.currency || "S/";
      const dailyRate = baseSalary / 30;
      const hourlyRate = dailyRate / 8;
      const minuteRate = hourlyRate / 60;

      // 1. Filtrar marcaciones de asistencia del colaborador en el mes
      const empAttendances = attendances.filter(
        (a) =>
          Number(a.employeeId) === Number(emp.id) &&
          typeof a.date === "string" &&
          a.date.startsWith(period) &&
          (a.manualApprovalStatus !== "rejected")
      );

      const daysWorked = empAttendances.length;
      const lateRecords = empAttendances.filter(
        (a) => (a.status === "late" || a.status === "very_late_blocked" || a.status === "unlocked") && (Number(a.minutesLate) || 0) > 0 && !a.lateWaived
      );
      const lateOccurrences = lateRecords.length;
      const totalMinutesLate = lateRecords.reduce((sum, a) => sum + (Number(a.minutesLate) || 0), 0);
      const tardinessDeduction = +(totalMinutesLate * minuteRate).toFixed(2);

      // 2. Horas extras acumuladas en asistencias del mes
      const totalOvertimeMinutes = empAttendances.reduce((sum, a) => {
        if (typeof a.overtimeMinutes === "number" && a.overtimeMinutes > 0) {
          return sum + a.overtimeMinutes;
        }
        // Si tiene overtimeStartedAt y checkOut, calcular diferencia en minutos
        if (a.overtimeUnlocked && a.overtimeStartedAt && a.checkOut) {
          const [sh, sm] = String(a.overtimeStartedAt).split(":").map(Number);
          const [eh, em] = String(a.checkOut).split(":").map(Number);
          if (!isNaN(sh) && !isNaN(eh)) {
            const diff = eh * 60 + (em || 0) - (sh * 60 + (sm || 0));
            if (diff > 0) return sum + diff;
          }
        }
        return sum;
      }, 0);

      const overtimeHours = +(totalOvertimeMinutes / 60).toFixed(2);
      // Sobretasa legal 25% por hora extra en Perú
      const overtimePay = +((totalOvertimeMinutes / 60) * hourlyRate * 1.25).toFixed(2);

      // 3. Permisos y Vacaciones del periodo
      const empLeaves = leaves.filter(
        (l) =>
          Number(l.employeeId) === Number(emp.id) &&
          l.status === "approved" &&
          (l.startDate.startsWith(period) || l.endDate.startsWith(period))
      );

      const paidLeaveDays = empLeaves
        .filter((l) => l.type !== "personal_unpaid" && (l.type as string) !== "unpaid_leave")
        .reduce((sum, l) => sum + (Number(l.daysCount) || 0), 0);

      const unpaidLeaveDays = empLeaves
        .filter((l) => l.type === "personal_unpaid" || (l.type as string) === "unpaid_leave")
        .reduce((sum, l) => sum + (Number(l.daysCount) || 0), 0);

      const unpaidLeaveDeduction = +(unpaidLeaveDays * dailyRate).toFixed(2);

      // 4. Comisiones de ventas en el periodo
      const empCommissions = commissions.filter(
        (c) =>
          Number(c.employeeId) === Number(emp.id) &&
          c.period === period &&
          c.status !== "cancelled"
      );
      const commissionsCount = empCommissions.length;
      const commissionsTotal = +empCommissions
        .reduce((sum, c) => sum + (Number(c.commissionAmount) || 0), 0)
        .toFixed(2);

      // 5. Incidencias / Descuentos (Daños de material, prendas EPP, adelantos) y Bonos
      const empIncidents = incidents.filter(
        (i) =>
          Number(i.employeeId) === Number(emp.id) &&
          i.period === period &&
          i.status === "active"
      );

      const materialDamageDeduction = +empIncidents
        .filter((i) => i.type === "material_damage")
        .reduce((sum, i) => sum + (Number(i.amount) || 0), 0)
        .toFixed(2);

      const garmentDeduction = +empIncidents
        .filter((i) => i.type === "garment_epp")
        .reduce((sum, i) => sum + (Number(i.amount) || 0), 0)
        .toFixed(2);

      const materialAndEppDeductions = +(materialDamageDeduction + garmentDeduction).toFixed(2);

      const advancesDeduction = +empIncidents
        .filter((i) => i.type === "salary_advance" || (i.type as string) === "advance")
        .reduce((sum, i) => sum + (Number(i.amount) || 0), 0)
        .toFixed(2);

      const otherDeductions = +empIncidents
        .filter((i) => i.type === "other_deduction")
        .reduce((sum, i) => sum + (Number(i.amount) || 0), 0)
        .toFixed(2);

      const advanceAndOtherDeductions = +(advancesDeduction + otherDeductions).toFixed(2);

      const bonusesTotal = +empIncidents
        .filter((i) => i.type === "bonus")
        .reduce((sum, i) => sum + (Number(i.amount) || 0), 0)
        .toFixed(2);

      // 6. Régimen Pensionario (AFP / ONP - Conforme normativa SBS / SUNAT)
      const rawAfp = String(emp.afpType || emp.pensionSystem || "ONP").toUpperCase().trim();
      let pensionRatePercent = 11.37;
      let pensionLabel = "AFP Integra (Mixta)";

      if (rawAfp.includes("ONP")) {
        pensionRatePercent = 13.00;
        pensionLabel = "ONP (13.00%)";
      } else if (rawAfp.includes("NONE") || rawAfp.includes("SIN") || rawAfp.includes("EXENTO") || rawAfp.includes("JUBILADO") || rawAfp.includes("RXH")) {
        pensionRatePercent = 0.00;
        pensionLabel = "Sin Retención (0.00%)";
      } else if (rawAfp.includes("HABITAT") && rawAfp.includes("FLUJO")) {
        pensionRatePercent = 12.84;
        pensionLabel = "AFP Habitat - Flujo (12.84%)";
      } else if (rawAfp.includes("INTEGRA") && rawAfp.includes("FLUJO")) {
        pensionRatePercent = 12.92;
        pensionLabel = "AFP Integra - Flujo (12.92%)";
      } else if (rawAfp.includes("PRIMA") && rawAfp.includes("FLUJO")) {
        pensionRatePercent = 12.97;
        pensionLabel = "AFP Prima - Flujo (12.97%)";
      } else if (rawAfp.includes("PROFUTURO") && rawAfp.includes("FLUJO")) {
        pensionRatePercent = 13.06;
        pensionLabel = "AFP Profuturo - Flujo (13.06%)";
      } else if (rawAfp.includes("HABITAT")) {
        pensionRatePercent = 11.37;
        pensionLabel = "AFP Habitat - Mixta (11.37%)";
      } else if (rawAfp.includes("PRIMA")) {
        pensionRatePercent = 11.37;
        pensionLabel = "AFP Prima - Mixta (11.37%)";
      } else if (rawAfp.includes("PROFUTURO")) {
        pensionRatePercent = 11.37;
        pensionLabel = "AFP Profuturo - Mixta (11.37%)";
      } else if (rawAfp.includes("INTEGRA")) {
        pensionRatePercent = 11.37;
        pensionLabel = "AFP Integra - Mixta (11.37%)";
      } else {
        pensionRatePercent = 13.00;
        pensionLabel = "ONP (13.00%)";
      }

      const pensionDeduction = +((baseSalary * pensionRatePercent) / 100).toFixed(2);

      // 7. Totales Salariales
      const grossIncome = +(baseSalary + overtimePay + commissionsTotal + bonusesTotal).toFixed(2);
      const totalDeductions = +(
        tardinessDeduction +
        unpaidLeaveDeduction +
        materialAndEppDeductions +
        advanceAndOtherDeductions +
        pensionDeduction
      ).toFixed(2);
      const netPay = Math.max(0, +(grossIncome - totalDeductions).toFixed(2));

      const statusKey = `${period}_${emp.id}`;
      const savedState = statusMap[statusKey];
      const paymentStatus = savedState?.paymentStatus || "draft";

      return {
        id: statusKey,
        period,
        tenantId,
        employeeId: emp.id,
        employeeName: emp.name,
        position: emp.position,
        dni: emp.dni,
        currency,
        baseSalary: +baseSalary.toFixed(2),
        hourlyRate: +hourlyRate.toFixed(2),
        minuteRate: +minuteRate.toFixed(4),
        daysWorked,
        lateOccurrences,
        totalMinutesLate,
        minutesLateTotal: totalMinutesLate,
        tardinessDeduction,
        tardinessDiscount: tardinessDeduction,
        paidLeaveDays,
        unpaidLeaveDays,
        unpaidLeaveDeduction,
        unpaidLeaveDiscount: unpaidLeaveDeduction,
        totalOvertimeMinutes,
        overtimeHours,
        overtimePay,
        commissionsCount,
        commissionsTotal,
        materialDamageDeduction,
        garmentDeduction,
        advancesDeduction,
        otherDeductions,
        materialAndEppDeductions,
        advanceAndOtherDeductions,
        bonusesTotal,
        incidentsList: empIncidents,
        afpType: emp.afpType || "ONP",
        pensionSystem: pensionLabel,
        pensionRatePercent,
        pensionDeduction,
        grossIncome,
        totalDeductions,
        netPay,
        netSalary: netPay,
        paymentStatus,
        status: paymentStatus === "paid" ? "paid" : "pending",
        paidAt: savedState?.paidAt || null,
        voucherCode: savedState?.voucherCode || `BOL-${period}-${String(emp.id).padStart(3, "0")}`,
      };
    });
}

// ==========================================
// 8. TRAMAS PLAME, ASIENTOS CONTABLES Y PERSISTENCIA
// ==========================================

const MONTHLY_PAYROLL_FILE = path.join(DATA_DIR, "rrhh_monthly_payroll.json");

export function loadMonthlyPayrollsFromDisk(): Record<string, { period: string; company?: any; items: any[] }> {
  try {
    if (fs.existsSync(MONTHLY_PAYROLL_FILE)) {
      return JSON.parse(fs.readFileSync(MONTHLY_PAYROLL_FILE, "utf-8"));
    }
  } catch (err) {
    console.error("Error reading rrhh_monthly_payroll.json:", err);
  }
  return {};
}

export function getMonthlyPayrollForTenant(tenantId: string | undefined, period: string) {
  const all = loadMonthlyPayrollsFromDisk();
  const safeTenant = (tenantId || "turbonetwork").toLowerCase().trim();
  const tenantKey = `${safeTenant}_${period}`;
  if (all[tenantKey]) return all[tenantKey];
  if (all[period]) return all[period];
  return null;
}

export function saveMonthlyPayrollToDisk(period: string, data: any, tenantId?: string) {
  try {
    const all = loadMonthlyPayrollsFromDisk();
    const safeTenant = (tenantId || data.tenantId || "turbonetwork").toLowerCase().trim();
    const tenantKey = `${safeTenant}_${period}`;
    all[tenantKey] = { ...data, tenantId: safeTenant };
    // Para compatibilidad hacia atrás
    if (safeTenant === "loanetwork" || safeTenant === "turbonetwork" || !all[period]) {
      all[period] = { ...data, tenantId: safeTenant };
    }
    fs.writeFileSync(MONTHLY_PAYROLL_FILE, JSON.stringify(all, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving rrhh_monthly_payroll.json:", err);
  }
}

export function saveMonthlyPayrollItem(period: string, body: any, initialCalculated: any[] = [], tenantId?: string): any {
  const safeTenant = (tenantId || body.tenantId || "turbonetwork").toLowerCase().trim();
  const all = loadMonthlyPayrollsFromDisk();
  const tenantKey = `${safeTenant}_${period}`;
  const existing = all[tenantKey] || all[period];

  const periodData = existing ? { ...existing } : {
    period,
    tenantId: safeTenant,
    company: { name: safeTenant === "loanetwork" ? "LOA NETWORK JL SAC" : "TurboNetwork Perú S.A.C.", ruc: safeTenant === "loanetwork" ? "20607511579" : "20601234567", regimen: "PEQ. EMPRESA" },
    items: initialCalculated || [],
  };

  const items = periodData.items || [];
  const idx = items.findIndex((it: any) => Number(it.employeeId) === Number(body.employeeId));
  let updatedItem;
  if (idx >= 0) {
    items[idx] = { ...items[idx], ...body };
    updatedItem = items[idx];
  } else {
    updatedItem = { ...body };
    items.push(updatedItem);
  }
  periodData.items = items;
  saveMonthlyPayrollToDisk(period, periodData, safeTenant);
  return updatedItem;
}

export function computeTaxAndPensionCuadre(items: any[]) {
  let renta5ta = 0;
  let essalud = 0;
  let onp = 0;
  let renta4ta = 0;
  let integra = 0;
  let profuturo = 0;
  let prima = 0;
  let habitat = 0;

  for (const it of items) {
    renta5ta += Number(it.renta5ta || 0);
    essalud += Number(it.essalud || 0);
    onp += Number(it.dsctoOnp || 0);
    const afpTotal = Number(it.totalDsctoAfp || (Number(it.afpFondoFijo || 0) + Number(it.afpSeguro || 0) + Number(it.afpComision || 0)));
    const penSys = String(it.pensionSystem || "").toUpperCase();
    if (penSys.includes("INTEGRA")) integra += afpTotal;
    else if (penSys.includes("PROFUTURO")) profuturo += afpTotal;
    else if (penSys.includes("PRIMA")) prima += afpTotal;
    else if (penSys.includes("HABITAT")) habitat += afpTotal;
  }

  const totalAfp = +(integra + profuturo + prima + habitat).toFixed(2);
  const totalImpuestos = +(renta5ta + essalud + onp + renta4ta).toFixed(2);

  return {
    plame: {
      renta5ta: +renta5ta.toFixed(2),
      essalud: +essalud.toFixed(2),
      onp: +onp.toFixed(2),
      renta4ta: +renta4ta.toFixed(2),
      totalImpuestos,
    },
    afpnet: {
      integra: +integra.toFixed(2),
      profuturo: +profuturo.toFixed(2),
      prima: +prima.toFixed(2),
      habitat: +habitat.toFixed(2),
      totalAfp,
    },
  };
}

export function computeAccountingSeat(items: any[]) {
  const sueldosBrutos = items.reduce((s, i) => s + (Number(i.baseAportes) || Number(i.basicoMes || 0)), 0);
  const essalud = items.reduce((s, i) => s + Number(i.essalud || 0), 0);
  const onp = items.reduce((s, i) => s + Number(i.dsctoOnp || 0), 0);
  const afp = items.reduce((s, i) => s + Number(i.totalDsctoAfp || 0), 0);
  const r5 = items.reduce((s, i) => s + Number(i.renta5ta || 0), 0);
  const quincena = items.reduce((s, i) => s + (Number(i.adelantoQuincena || 0) + Number(i.prestamo || 0)), 0);
  const neto = items.reduce((s, i) => s + Number(i.netoFinDeMes || 0), 0);

  const totalDebe = +(sueldosBrutos + essalud).toFixed(2);
  const totalHaber = +(essalud + onp + afp + r5 + quincena + neto).toFixed(2);

  const asiento = [
    { cta: "6211", denominacion: "Remuneraciones y Salarios al Personal", cecos: "ADMIN / OPER", debe: +sueldosBrutos.toFixed(2), haber: 0 },
    { cta: "6271", denominacion: "Régimen Prestaciones de Salud - EsSalud 9%", cecos: "COSTO EMPRESA", debe: +essalud.toFixed(2), haber: 0 },
    { cta: "4031", denominacion: "EsSalud por Pagar (Instituciones Públicas)", cecos: "SUNAT / ESSALUD", debe: 0, haber: +essalud.toFixed(2) },
    { cta: "4032", denominacion: "ONP - Sistema Nacional Pensiones", cecos: "SUNAT", debe: 0, haber: +onp.toFixed(2) },
    { cta: "4071", denominacion: "AFPnet - Retenciones Administradoras de Pensiones", cecos: "AFP RETENCIONES", debe: 0, haber: +afp.toFixed(2) },
    { cta: "40173", denominacion: "Impuesto a la Renta de Quinta Categoría", cecos: "SUNAT TRIBUTOS", debe: 0, haber: +r5.toFixed(2) },
    { cta: "1412", denominacion: "Adelanto de Remuneraciones y Préstamos", cecos: "DESCUENTOS BANCARIOS", debe: 0, haber: +quincena.toFixed(2) },
    { cta: "4111", denominacion: "Remuneraciones por Pagar (Neto Colaboradores)", cecos: "DISPERSIÓN FIN DE MES", debe: 0, haber: +neto.toFixed(2) },
  ];

  return { asiento, totalDebe, totalHaber };
}

export function generatePlameTramas(targetPeriod: string, items: any[]) {
  let jor = "";
  let snl = "";
  let rem = "";

  for (const it of items) {
    const docType = it.docType || "01";
    const dni = it.dni || "";
    if (!dni) continue;

    const hOrd = it.hrasLab || 208;
    const heHoras = it.heHoras || 0;
    const heMin = it.heMin || 0;
    jor += `${docType}|${dni}|${hOrd}|0|${heHoras}|${heMin}|0|0|\r\n`;

    if (Number(it.maternidadEsSalud || 0) > 0) {
      snl += `${docType}|${dni}|21|30|\r\n`;
    }
    if (Number(it.licenciaSinGoce || 0) > 0) {
      snl += `${docType}|${dni}|05|${it.licenciaSinGoce}|\r\n`;
    }

    const basico = Number(it.basicoMes || it.sueldoReal || 0).toFixed(2);
    rem += `${docType}|${dni}|0121|${basico}|${basico}|\r\n`;
    if (Number(it.he25 || 0) > 0) {
      const val = Number(it.he25).toFixed(2);
      rem += `${docType}|${dni}|0105|${val}|${val}|\r\n`;
    }
    if (Number(it.he35 || 0) > 0) {
      const val = Number(it.he35).toFixed(2);
      rem += `${docType}|${dni}|0106|${val}|${val}|\r\n`;
    }
    if (Number(it.bonifRegu || 0) > 0) {
      const val = Number(it.bonifRegu).toFixed(2);
      rem += `${docType}|${dni}|0301|${val}|${val}|\r\n`;
    }
  }

  return { jor, snl, rem };
}
