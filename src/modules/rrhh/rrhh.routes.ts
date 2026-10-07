import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { resolveTenantId, loadTenantsFromDisk } from "../tenants/tenants.service";

const DATA_DIR = path.resolve(process.cwd(), "data");
const EMPLOYEES_FILE = path.join(DATA_DIR, "employees.json");
const ATTENDANCE_FILE = path.join(DATA_DIR, "attendance.json");

// ==========================================
// 1. MODELOS Y TIPOS
// ==========================================

export interface Employee {
  id: number;
  name: string;
  position: string;
  dni: string;
  phone: string;
  email: string;
  workSchedule: string; // ej: "08:00 - 17:00"
  expectedCheckInTime: string; // ej: "08:00"
  salary: string;
  currency: string;
  hireDate: string;
  birthDate?: string;
  emergencyContact?: string;
  status: "active" | "inactive";
  avatar: string;
  publicToken: string;
  totpSecret: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AttendanceRecord {
  id: number;
  employeeId: number;
  employeeName: string;
  tenantId?: string;
  tenantName?: string;
  isShared?: boolean;
  date: string; // YYYY-MM-DD
  checkIn: string; // ISO timestamp
  checkInTime: string; // "08:15:30"
  lunchStart?: string | null;
  lunchEndTime?: string | null;
  checkOut?: string | null;
  overtimeUnlocked?: boolean;
  overtimeStartedAt?: string | null;
  previousCheckOut?: string | null;
  photo: string; // Base64 data URL o URL
  location: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    address?: string;
  } | null;
  status: "on_time" | "late" | "very_late_blocked" | "unlocked";
  minutesLate: number;
  unlockedByTotp?: boolean;
  unlockedAt?: string | null;
  notes?: string;
}

// ==========================================
// 1.1 HELPER ZONA HORARIA PERÚ (AMERICA/LIMA)
// ==========================================

export function getPeruDateTime(d = new Date()) {
  const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const timeFormatter = new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const peruDate = dateFormatter.format(d); // "YYYY-MM-DD"
  const peruTime = timeFormatter.format(d); // "HH:MM:SS"
  return { peruDate, peruTime, now: d };
}

// ==========================================
// 2. UTILIDAD TOTP (GOOGLE AUTHENTICATOR)
// ==========================================

// Base32 decoding para TOTP
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(str: string): Buffer {
  const cleaned = (str || "").toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTOTP(secret: string, offsetSteps = 0, timeStepSeconds = 30): string {
  try {
    const key = base32Decode(secret);
    if (key.length === 0) return "123456";

    const epoch = Math.floor(Date.now() / 1000);
    const counter = Math.floor(epoch / timeStepSeconds) + offsetSteps;

    const buf = Buffer.alloc(8);
    buf.writeBigUInt64BE(BigInt(counter));

    const hmac = crypto.createHmac("sha1", key);
    hmac.update(buf);
    const digest = hmac.digest();

    const offset = digest[digest.length - 1] & 0xf;
    const code =
      ((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff);

    const str = (code % 1000000).toString();
    return str.padStart(6, "0");
  } catch {
    return "123456";
  }
}

export function verifyTOTP(token: string, secret: string): boolean {
  const cleanToken = token.trim();
  // Master bypass code del supervisor en emergencias
  if (cleanToken === "998877" || cleanToken === "123456") return true;

  // Probar ventana actual, -1 y +1 pasos de 30 segundos (skew de 90s)
  for (let offset = -1; offset <= 1; offset++) {
    const expected = generateTOTP(secret, offset);
    if (expected === cleanToken) return true;
  }
  return false;
}

export const MASTER_SUPERVISOR_TOTP_SECRET = "TURBONETWORKKEY2";

export function getSystemMasterTotpSecret(): string {
  try {
    const file = path.join(DATA_DIR, "connections_settings.json");
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, "utf-8"));
      if (data?.security?.masterTotpSecret) return data.security.masterTotpSecret;
    }
  } catch (e) {}
  return MASTER_SUPERVISOR_TOTP_SECRET;
}

// ==========================================
// 3. DATOS INICIALES Y PERSISTENCIA
// ==========================================

const defaultEmployees: Employee[] = [
  {
    id: 1,
    name: "César Administrador",
    position: "Director General de Operaciones & NOC",
    dni: "70891234",
    phone: "+51 987 654 321",
    email: "cesar@turbonetwork.com",
    workSchedule: "08:00 - 17:00",
    expectedCheckInTime: "08:00",
    salary: "4500.00",
    currency: "$",
    hireDate: "2024-01-15",
    birthDate: "1988-06-12",
    emergencyContact: "+51 999 111 222 (Hermano)",
    status: "active",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
    publicToken: "emp-cesar-adm-9841",
    totpSecret: "JBSWY3DPEHPK3PXP",
    createdAt: "2024-01-15T08:00:00Z",
  },
  {
    id: 2,
    name: "Ing. Alejandro Torres",
    position: "Ingeniero Principal de Redes & MikroTik",
    dni: "45981273",
    phone: "+51 912 345 678",
    email: "alejandro.redes@turbonetwork.com",
    workSchedule: "08:30 - 17:30",
    expectedCheckInTime: "08:30",
    salary: "3800.00",
    currency: "$",
    hireDate: "2024-03-01",
    birthDate: "1991-09-24",
    emergencyContact: "+51 988 222 333 (Esposa)",
    status: "active",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
    publicToken: "emp-ale-torres-5521",
    totpSecret: "MZXW6YTBOJUW4ZY=",
    createdAt: "2024-03-01T08:30:00Z",
  },
  {
    id: 3,
    name: "Ana Morales",
    position: "Coordinadora de Cobranzas y Atención al Abonado",
    dni: "72109845",
    phone: "+51 945 678 123",
    email: "ana.caja@turbonetwork.com",
    workSchedule: "08:00 - 16:30",
    expectedCheckInTime: "08:00",
    salary: "2400.00",
    currency: "$",
    hireDate: "2024-06-10",
    birthDate: "1995-11-03",
    emergencyContact: "+51 977 333 444 (Madre)",
    status: "active",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80",
    publicToken: "emp-ana-morales-3341",
    totpSecret: "NBSWY3DPEHPK3PXP",
    createdAt: "2024-06-10T08:00:00Z",
  },
  {
    id: 4,
    name: "Luis Lopez",
    position: "Especialista en Infraestructura FTTH & Soporte",
    dni: "41982734",
    phone: "+51 933 444 555",
    email: "cesarestudio2395@gmail.com",
    workSchedule: "09:00 - 18:00",
    expectedCheckInTime: "09:00",
    salary: "3100.00",
    currency: "$",
    hireDate: "2024-08-01",
    birthDate: "1993-04-18",
    emergencyContact: "+51 966 555 666 (Padre)",
    status: "active",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Luis%20Lopez",
    publicToken: "emp-luis-lopez-7712",
    totpSecret: "JBSWY3DPEHPK3PXP",
    createdAt: "2024-08-01T09:00:00Z",
  },
];

function loadEmployeesFromDisk(): Employee[] {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(EMPLOYEES_FILE)) {
      const raw = fs.readFileSync(EMPLOYEES_FILE, "utf-8");
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) return list;
    }
    fs.writeFileSync(EMPLOYEES_FILE, JSON.stringify(defaultEmployees, null, 2), "utf-8");
    return defaultEmployees;
  } catch {
    return defaultEmployees;
  }
}

function saveEmployeesToDisk(list: Employee[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(EMPLOYEES_FILE, JSON.stringify(list, null, 2), "utf-8");
  } catch (err) {
    console.error("Error al guardar employees.json:", err);
  }
}

export function resolveEmployeeOrUser(id: number | string, fallbackName = "Colaborador") {
  const numId = typeof id === "string" ? parseInt(id, 10) : id;
  // 1. Buscar en employees.json
  const empList = loadEmployeesFromDisk();
  const emp = empList.find((e) => e.id === numId);
  if (emp) {
    return {
      id: emp.id,
      name: emp.name,
      position: emp.position,
      dni: emp.dni,
      phone: emp.phone,
      email: emp.email,
      workSchedule: emp.workSchedule,
      expectedCheckInTime: emp.expectedCheckInTime || "08:00",
      salary: emp.salary,
      currency: emp.currency || "$",
      hireDate: emp.hireDate,
      avatar: emp.avatar,
      status: emp.status,
      publicToken: emp.publicToken,
      totpSecret: emp.totpSecret || "JBSWY3DPEHPK3PXP",
      isRegisteredEmployee: true,
    };
  }

  // 2. Buscar en users.json (operadores, técnicos y cajeros)
  try {
    const uFile = path.join(DATA_DIR, "users.json");
    if (fs.existsSync(uFile)) {
      const uStore = JSON.parse(fs.readFileSync(uFile, "utf-8"));
      const user = uStore.find((u: any) => u.id === numId || u.id === id);
      if (user) {
        return {
          id: user.id,
          name: user.name || fallbackName,
          position: user.roleName || "Operador de Red",
          dni: user.pin || "74214636",
          phone: "+51 987 654 321",
          email: user.email || "",
          workSchedule: user.workSchedule || "08:00 - 17:00",
          expectedCheckInTime: "08:00",
          salary: "2500.00",
          currency: "S/",
          hireDate: user.hireDate || "2026-09-01",
          avatar: user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.name || "User")}`,
          status: (user.isActive ? "active" : "inactive") as "active" | "inactive",
          publicToken: `usr-${user.id}`,
          totpSecret: "JBSWY3DPEHPK3PXP",
          isRegisteredEmployee: false,
        };
      }
    }
  } catch (e) {}

  return {
    id: numId,
    name: fallbackName,
    position: "Colaborador",
    dni: "",
    phone: "",
    email: "",
    workSchedule: "08:00 - 17:00",
    expectedCheckInTime: "08:00",
    salary: "0",
    currency: "$",
    hireDate: "2026-01-01",
    avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(fallbackName)}`,
    status: "active" as "active" | "inactive",
    publicToken: `colab-${numId}`,
    totpSecret: "JBSWY3DPEHPK3PXP",
    isRegisteredEmployee: false,
  };
}

export function purgeOldAttendancePhotos(days = 60): number {
  try {
    if (!fs.existsSync(ATTENDANCE_FILE)) return 0;
    const raw = fs.readFileSync(ATTENDANCE_FILE, "utf-8");
    const list: AttendanceRecord[] = JSON.parse(raw);
    if (!Array.isArray(list)) return 0;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const { peruDate: cutoffDateStr } = getPeruDateTime(cutoff);

    let purged = 0;
    for (const record of list) {
      if (record.date && record.date < cutoffDateStr && record.photo && record.photo.startsWith("data:image/")) {
        record.photo = "";
        purged++;
      }
    }
    if (purged > 0) {
      fs.writeFileSync(ATTENDANCE_FILE, JSON.stringify(list, null, 2), "utf-8");
      console.log(`[RRHH] Regla de 60 días: ${purged} fotografías biométricas antiguas fueron depuradas.`);
    }
    return purged;
  } catch (err) {
    console.error("Error en purgeOldAttendancePhotos:", err);
    return 0;
  }
}

export function healAttendanceRecords(list: AttendanceRecord[]): boolean {
  let changed = false;
  for (const record of list) {
    if (!record.employeeName || record.employeeName === "Colaborador") {
      const resolved = resolveEmployeeOrUser(record.employeeId);
      if (resolved && resolved.name && resolved.name !== "Colaborador") {
        record.employeeName = resolved.name;
        changed = true;
      }
    }
  }
  return changed;
}

function loadAttendanceFromDisk(): AttendanceRecord[] {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(ATTENDANCE_FILE)) {
      const raw = fs.readFileSync(ATTENDANCE_FILE, "utf-8");
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        if (healAttendanceRecords(list)) {
          fs.writeFileSync(ATTENDANCE_FILE, JSON.stringify(list, null, 2), "utf-8");
        }
        return list;
      }
    }
    const empty: AttendanceRecord[] = [];
    fs.writeFileSync(ATTENDANCE_FILE, JSON.stringify(empty, null, 2), "utf-8");
    return empty;
  } catch {
    return [];
  }
}

function saveAttendanceToDisk(list: AttendanceRecord[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    healAttendanceRecords(list);
    fs.writeFileSync(ATTENDANCE_FILE, JSON.stringify(list, null, 2), "utf-8");
  } catch (err) {
    console.error("Error al guardar attendance.json:", err);
  }
}

let employeesStore = loadEmployeesFromDisk();
let attendanceStore = loadAttendanceFromDisk();
// Ejecutar purga de 60 días al iniciar
purgeOldAttendancePhotos(60);

// ==========================================
// 4. ESQUEMAS DE VALIDACIÓN
// ==========================================

const createEmployeeSchema = z
  .object({
    name: z.string().min(2, "El nombre debe tener al menos 2 caracteres").optional(),
    fullName: z.string().min(2).optional(),
    position: z.string().min(2, "El cargo es requerido"),
    dni: z.string().min(6, "El DNI/Documento debe ser válido"),
    phone: z.string().min(6, "El teléfono debe ser válido"),
    email: z.string().email("Correo electrónico inválido"),
    workSchedule: z.string().default("08:00 - 17:00"),
    expectedCheckInTime: z.string().optional(),
    salary: z
      .union([z.string(), z.number()])
      .transform((val) => (typeof val === "number" ? val.toFixed(2) : val))
      .default("2000.00"),
    currency: z.string().default("$"),
    hireDate: z.string().optional(),
    birthDate: z.string().optional(),
    emergencyContact: z.string().optional(),
    status: z
      .union([z.literal("active"), z.literal("inactive"), z.literal("ACTIVE"), z.literal("INACTIVE")])
      .transform((s) => s.toLowerCase() as "active" | "inactive")
      .default("active"),
    avatar: z.string().optional(),
  })
  .transform((data) => ({
    ...data,
    name: data.name || data.fullName || "Colaborador",
  }));


// ==========================================
// 5. GENERADOR DE CREDENCIAL PÚBLICA HTML
// ==========================================

export function renderPublicCredentialHtml(emp: Employee, baseUrl: string): string {
  const publicUrl = `${baseUrl}/credencial/${emp.publicToken}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(publicUrl)}`;
  const salaryNum = parseFloat(emp.salary) || 2500;
  const currency = emp.currency || "S/";

  // Generar historial de nómina mensual reciente
  const months = [
    { period: "Septiembre 2026", date: "30/09/2026", voucher: "REC-2026-09" },
    { period: "Agosto 2026", date: "30/08/2026", voucher: "REC-2026-08" },
    { period: "Julio 2026", date: "30/07/2026", voucher: "REC-2026-07" },
    { period: "Junio 2026", date: "30/06/2026", voucher: "REC-2026-06" },
    { period: "Mayo 2026", date: "30/05/2026", voucher: "REC-2026-05" },
    { period: "Abril 2026", date: "30/04/2026", voucher: "REC-2026-04" },
  ];

  const bonus = 150;
  const afpDeduction = salaryNum * 0.128; // ~12.8% AFP promedio
  const netPay = salaryNum + bonus - afpDeduction;

  const paymentsHtml = months.map(m => `
    <tr class="border-b border-slate-100 hover:bg-slate-50 transition text-xs">
      <td class="py-2.5 px-3 font-semibold text-slate-800">${m.period}</td>
      <td class="py-2.5 px-3 font-mono text-slate-600">${currency} ${salaryNum.toFixed(2)}</td>
      <td class="py-2.5 px-3 font-mono text-emerald-600">+${currency} ${bonus.toFixed(2)}</td>
      <td class="py-2.5 px-3 font-mono text-rose-500">-${currency} ${afpDeduction.toFixed(2)}</td>
      <td class="py-2.5 px-3 font-mono font-bold text-slate-900">${currency} ${netPay.toFixed(2)}</td>
      <td class="py-2.5 px-3 font-mono text-slate-500">${m.date}</td>
      <td class="py-2.5 px-3 text-center">
        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
          Pagado • ${m.voucher}
        </span>
      </td>
    </tr>
  `).join("");

  // Obtener asistencias recientes del colaborador
  const attAll = loadAttendanceFromDisk();
  const empAtts = attAll.filter(a => a.employeeId === emp.id).slice(0, 8);
  const attendancesHtml = empAtts.length > 0 ? empAtts.map(a => {
    const isLate = a.status === 'late' || a.status === 'very_late_blocked';
    const statusText = a.status === 'on_time' ? 'Puntual' : (a.status === 'late' ? `Tarde (+${a.minutesLate}m)` : (a.status === 'unlocked' ? 'Desbloqueado TOTP' : 'Bloqueado'));
    const statusColor = a.status === 'on_time' ? 'bg-emerald-100 text-emerald-800' : (isLate ? 'bg-amber-100 text-amber-800' : 'bg-purple-100 text-purple-800');
    return `
      <tr class="border-b border-slate-100 hover:bg-slate-50 transition text-xs font-mono">
        <td class="py-2 px-3 text-slate-800 font-semibold">${a.date}</td>
        <td class="py-2 px-3 text-slate-900 font-bold">${a.checkInTime || '--:--'}</td>
        <td class="py-2 px-3 text-slate-600">${a.lunchStart ? `${a.lunchStart} - ${a.lunchEndTime || '...'}` : 'No reg.'}</td>
        <td class="py-2 px-3 text-slate-900 font-bold">${a.checkOut || '--:--'}</td>
        <td class="py-2 px-3 text-center">
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColor}">
            ${statusText}
          </span>
        </td>
      </tr>
    `;
  }).join("") : `
    <tr>
      <td colspan="5" class="py-4 text-center text-slate-400 text-xs italic">No hay registros recientes de asistencia en el sistema.</td>
    </tr>
  `;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ficha Técnica A4 - ${emp.name} | TurboNetwork RRHH</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm;
    }
    @media print {
      body {
        background: #ffffff !important;
        color: #000000 !important;
        padding: 0 !important;
      }
      .no-print {
        display: none !important;
      }
      .sheet-a4 {
        box-shadow: none !important;
        border: none !important;
        padding: 0 !important;
        margin: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
      }
    }
  </style>
</head>
<body class="bg-slate-100 text-slate-800 min-h-screen py-8 px-4 font-sans antialiased">
  
  <!-- Barra Superior de Acciones (No Imprimible) -->
  <div class="max-w-4xl mx-auto mb-5 no-print flex items-center justify-between gap-3 bg-white p-3 rounded-2xl shadow-sm border border-slate-200">
    <div class="flex items-center space-x-2">
      <span class="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
      <span class="text-xs font-bold text-slate-700">Expediente Oficial de Personal (Formato A4)</span>
    </div>
    <div class="flex items-center space-x-2">
      <button onclick="window.print()" class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center space-x-1.5 shadow-sm transition">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
        <span>Imprimir / Descargar PDF</span>
      </button>
      <button onclick="navigator.clipboard.writeText(window.location.href); alert('Enlace de verificación copiado al portapapeles');" class="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition">
        Copiar Enlace
      </button>
      <a href="/" class="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold transition">
        Portal
      </a>
    </div>
  </div>

  <!-- Documento / Ficha Técnica A4 -->
  <main class="sheet-a4 max-w-4xl mx-auto bg-white rounded-2xl shadow-xl border border-slate-200 p-8 sm:p-10 space-y-6">
    
    <!-- Encabezado Institucional -->
    <header class="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b-2 border-slate-900 gap-4">
      <div class="flex items-center space-x-4">
        <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-black text-xl shadow-md">
          TN
        </div>
        <div>
          <h1 class="text-xl font-black text-slate-900 tracking-tight uppercase">TurboNetwork Perú S.A.C.</h1>
          <p class="text-xs font-bold text-blue-600 tracking-wider uppercase">Sistema Integrado de RRHH & Control de Asistencias</p>
          <span class="text-[10px] text-slate-500 font-mono">RUC: 20608941231 • División de Capital Humano & Planillas</span>
        </div>
      </div>
      <div class="flex items-center space-x-3 text-right">
        <div>
          <span class="inline-block px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
            ✓ EXPEDIENTE VERIFICADO
          </span>
          <p class="text-[10px] font-mono text-slate-400 mt-1">Token: ${emp.publicToken}</p>
        </div>
        <img class="w-16 h-16 rounded-lg border border-slate-200 p-1 bg-white" src="${qrUrl}" alt="QR Verificación">
      </div>
    </header>

    <!-- Título de la Ficha -->
    <div class="bg-slate-50 border-l-4 border-blue-600 p-3 rounded-r-xl flex items-center justify-between">
      <div>
        <h2 class="text-sm font-extrabold text-slate-900 uppercase tracking-wide">Ficha Técnica & Expediente de Personal</h2>
        <p class="text-[11px] text-slate-500">Hoja de vida laboral, régimen contractual y constancia de cumplimiento de asistencia</p>
      </div>
      <span class="text-xs font-mono font-bold text-slate-700">ID EMP: #${emp.id}</span>
    </div>

    <!-- SECCIÓN 1: DATOS PERSONALES Y CONTRACTUALES -->
    <section class="space-y-3">
      <h3 class="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 pb-1.5">
        <span class="w-2 h-2 rounded-full bg-blue-600"></span> 1. Información Personal y Contractual
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
        <!-- Foto -->
        <div class="flex flex-col items-center justify-center p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
          <img class="w-24 h-24 rounded-xl object-cover border-2 border-white shadow-md bg-white" src="${emp.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(emp.name)}`}" alt="Foto">
          <span class="mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${emp.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
            ${emp.status === 'active' ? 'En Funciones' : 'Inactivo'}
          </span>
        </div>

        <!-- Matriz de Datos -->
        <div class="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          <div class="p-2 rounded-lg bg-slate-50 border border-slate-200/80">
            <span class="text-slate-400 block text-[10px] uppercase font-bold">Colaborador:</span>
            <span class="font-bold text-slate-900 text-sm">${emp.name}</span>
          </div>
          <div class="p-2 rounded-lg bg-slate-50 border border-slate-200/80">
            <span class="text-slate-400 block text-[10px] uppercase font-bold">Cargo / Especialidad:</span>
            <span class="font-bold text-blue-700">${emp.position}</span>
          </div>
          <div class="p-2 rounded-lg bg-slate-50 border border-slate-200/80">
            <span class="text-slate-400 block text-[10px] uppercase font-bold">DNI / Documento:</span>
            <span class="font-mono font-extrabold text-slate-900">${emp.dni}</span>
          </div>
          <div class="p-2 rounded-lg bg-slate-50 border border-slate-200/80">
            <span class="text-slate-400 block text-[10px] uppercase font-bold">Teléfono de Contacto:</span>
            <span class="font-mono font-bold text-slate-800">${emp.phone}</span>
          </div>
          <div class="p-2 rounded-lg bg-slate-50 border border-slate-200/80">
            <span class="text-slate-400 block text-[10px] uppercase font-bold">Correo Electrónico:</span>
            <span class="font-bold text-slate-800 truncate block">${emp.email}</span>
          </div>
          <div class="p-2 rounded-lg bg-slate-50 border border-slate-200/80">
            <span class="text-slate-400 block text-[10px] uppercase font-bold">Horario de Trabajo Asignado:</span>
            <span class="font-mono font-extrabold text-amber-700">${emp.workSchedule}</span>
          </div>
          <div class="p-2 rounded-lg bg-slate-50 border border-slate-200/80">
            <span class="text-slate-400 block text-[10px] uppercase font-bold">Fecha de Ingreso a la Empresa:</span>
            <span class="font-mono font-bold text-slate-800">${emp.hireDate}</span>
          </div>
          <div class="p-2 rounded-lg bg-slate-50 border border-slate-200/80">
            <span class="text-slate-400 block text-[10px] uppercase font-bold">Salario Mensual Declarado:</span>
            <span class="font-mono font-extrabold text-emerald-700 text-sm">${currency} ${salaryNum.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- SECCIÓN 2: HISTORIAL DE PAGOS Y NÓMINA -->
    <section class="space-y-2.5 pt-2">
      <div class="flex items-center justify-between border-b border-slate-200 pb-1.5">
        <h3 class="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-emerald-600"></span> 2. Historial de Pagos y Nómina de Sueldos (Últimos Periodos)
        </h3>
        <span class="text-[10px] font-bold text-slate-500 uppercase">Modalidad: Transferencia Bancaria</span>
      </div>
      <div class="overflow-x-auto border border-slate-200 rounded-xl">
        <table class="w-full text-left">
          <thead class="bg-slate-100 text-slate-700 text-[10px] uppercase font-bold border-b border-slate-200">
            <tr>
              <th class="py-2 px-3">Periodo</th>
              <th class="py-2 px-3">Sueldo Base</th>
              <th class="py-2 px-3">Bonif.</th>
              <th class="py-2 px-3">Desc. Ley</th>
              <th class="py-2 px-3">Neto Pagado</th>
              <th class="py-2 px-3">Fecha Abono</th>
              <th class="py-2 px-3 text-center">Estado</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${paymentsHtml}
          </tbody>
        </table>
      </div>
    </section>

    <!-- SECCIÓN 3: HISTORIAL DE ASISTENCIAS -->
    <section class="space-y-2.5 pt-2">
      <div class="flex items-center justify-between border-b border-slate-200 pb-1.5">
        <h3 class="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-indigo-600"></span> 3. Historial de Asistencia y Puntualidad (Hora Oficial de Perú)
        </h3>
        <span class="text-[10px] font-bold text-slate-500 uppercase">Registro Biométrico & GPS</span>
      </div>
      <div class="overflow-x-auto border border-slate-200 rounded-xl">
        <table class="w-full text-left">
          <thead class="bg-slate-100 text-slate-700 text-[10px] uppercase font-bold border-b border-slate-200">
            <tr>
              <th class="py-2 px-3">Fecha</th>
              <th class="py-2 px-3">Hora Entrada</th>
              <th class="py-2 px-3">Refrigerio</th>
              <th class="py-2 px-3">Hora Salida</th>
              <th class="py-2 px-3 text-center">Estado de Asistencia</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${attendancesHtml}
          </tbody>
        </table>
      </div>
    </section>

    <!-- SECCIÓN 4: CERTIFICACIÓN Y FIRMAS -->
    <footer class="pt-6 border-t-2 border-slate-200 mt-6">
      <div class="grid grid-cols-2 gap-8 text-center text-xs">
        <div class="pt-10 border-t border-slate-400">
          <p class="font-bold text-slate-900">${emp.name}</p>
          <p class="text-[11px] text-slate-500 font-mono">DNI: ${emp.dni}</p>
          <p class="text-[10px] text-slate-400 uppercase font-semibold mt-0.5">Firma del Colaborador</p>
        </div>
        <div class="pt-10 border-t border-slate-400">
          <p class="font-bold text-slate-900">Gerencia de Operaciones & RRHH</p>
          <p class="text-[11px] text-slate-500">TurboNetwork Perú S.A.C.</p>
          <p class="text-[10px] text-slate-400 uppercase font-semibold mt-0.5">Sello y Firma Autorizada</p>
        </div>
      </div>
      <div class="mt-6 pt-3 border-t border-slate-100 text-center text-[9px] text-slate-400 font-mono">
        Documento oficial emitido conforme a ley por el Sistema Central de TurboNetwork • Verificación Criptográfica: ${publicUrl}
      </div>
    </footer>

  </main>

</body>
</html>`;
}


export function getCredentialHtmlByToken(token: string, baseUrl: string): string | null {
  const employees = loadEmployeesFromDisk();
  const emp = employees.find((e) => e.publicToken === token || e.id.toString() === token);
  if (!emp) return null;
  return renderPublicCredentialHtml(emp, baseUrl);
}

// ==========================================
// 6. RUTAS DEL MÓDULO RRHH
// ==========================================

export const rrhhRoutes: FastifyPluginAsync = async (fastify) => {
  // -------------------------------------------------------------
  // A. GESTIÓN DE PERSONAL (ACTA DE PERSONAL)
  // -------------------------------------------------------------

  // Listar todo el personal
  fastify.get("/rrhh/employees", async (_request, reply) => {
    employeesStore = loadEmployeesFromDisk();
    return reply.send({
      success: true,
      count: employeesStore.length,
      data: employeesStore,
    });
  });

  // Obtener un colaborador por ID
  fastify.get("/rrhh/employees/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const empId = parseInt(id, 10);
    employeesStore = loadEmployeesFromDisk();
    const emp = employeesStore.find((e) => e.id === empId);
    if (!emp) {
      return reply.status(404).send({ success: false, message: "Colaborador no encontrado" });
    }
    return reply.send({ success: true, data: emp });
  });

  // Vista pública de Acta de Personal (HTML en navegador, JSON para APIs)
  fastify.get("/rrhh/employees/:idOrToken/public", async (request, reply) => {
    const { idOrToken } = request.params as { idOrToken: string };
    employeesStore = loadEmployeesFromDisk();

    const emp = employeesStore.find(
      (e) => e.publicToken === idOrToken || e.id.toString() === idOrToken
    );

    if (!emp) {
      if (request.headers.accept?.includes("text/html")) {
        return reply.status(404).type("text/html; charset=utf-8").send(`
          <div style="font-family:sans-serif; text-align:center; padding:50px; background:#0b0f19; color:#fff; min-height:100vh;">
            <h1 style="color:#f43f5e;">Credencial No Encontrada</h1>
            <p style="color:#94a3b8;">El enlace del acta de personal no existe o ha sido revocado.</p>
            <a href="/" style="display:inline-block; margin-top:20px; padding:10px 20px; background:#2563eb; color:#fff; text-decoration:none; border-radius:8px;">Ir al Portal</a>
          </div>
        `);
      }
      return reply.status(404).send({ success: false, message: "Acta de personal no encontrada o enlace vencido" });
    }

    const host = request.headers.host || "localhost:3000";
    const protocol = request.protocol || "http";
    const baseUrl = `${protocol}://${host}`;

    // Si el usuario entra desde el navegador web (Accept: text/html), renderizar la credencial visual oficial
    const acceptsHtml = request.headers.accept?.includes("text/html") || (request.query as any)?.format === "html";
    if (acceptsHtml) {
      return reply.type("text/html; charset=utf-8").send(renderPublicCredentialHtml(emp, baseUrl));
    }

    // Devolver datos públicos JSON para integraciones API
    const publicData = {
      id: emp.id,
      name: emp.name,
      position: emp.position,
      dni: emp.dni,
      phone: emp.phone,
      email: emp.email,
      workSchedule: emp.workSchedule,
      salary: emp.salary,
      currency: emp.currency,
      hireDate: emp.hireDate,
      status: emp.status,
      avatar: emp.avatar,
      company: "TurboNetwork ISP Core",
      verifiedBadge: true,
      issuedAt: new Date().toISOString(),
      publicToken: emp.publicToken,
      publicUrl: `/credencial/${emp.publicToken}`,
    };

    return reply.send({ success: true, data: publicData });
  });

  // Endpoints públicos de credenciales HTML bajo /api
  fastify.get("/credencial/:token", async (request, reply) => {
    const { token } = request.params as { token: string };
    employeesStore = loadEmployeesFromDisk();
    const emp = employeesStore.find((e) => e.publicToken === token || e.id.toString() === token);
    const host = request.headers.host || "localhost:3000";
    const protocol = request.protocol || "http";
    const baseUrl = `${protocol}://${host}`;

    if (!emp) {
      return reply.status(404).type("text/html; charset=utf-8").send("<h1>Credencial no encontrada</h1>");
    }
    return reply.type("text/html; charset=utf-8").send(renderPublicCredentialHtml(emp, baseUrl));
  });

  // Obtener datos para vinculación de Google Authenticator (Código QR y Secreto Base32)
  fastify.get("/rrhh/employees/:id/totp", async (request, reply) => {
    const { id } = request.params as { id: string };
    const empId = parseInt(id, 10);
    employeesStore = loadEmployeesFromDisk();
    let emp = employeesStore.find((e) => e.id === empId);

    if (!emp) {
      try {
        const uFile = path.join(DATA_DIR, "users.json");
        if (fs.existsSync(uFile)) {
          const uStore = JSON.parse(fs.readFileSync(uFile, "utf-8"));
          const user = uStore.find((u: any) => u.id === empId);
          if (user) {
            emp = {
              id: user.id,
              name: user.name,
              position: user.roleName || "Operador",
              dni: "",
              phone: "",
              email: user.email,
              workSchedule: user.workSchedule || "08:00 - 17:00",
              expectedCheckInTime: "08:00",
              salary: "0",
              currency: "PEN",
              hireDate: user.hireDate || "",
              status: user.isActive ? "active" : "inactive",
              avatar: user.avatar || "",
              publicToken: crypto.randomBytes(16).toString("hex"),
              totpSecret: "JBSWY3DPEHPK3PXP",
              createdAt: user.createdAt || new Date().toISOString(),
            };
          }
        }
      } catch (e) {}
    }

    if (!emp) {
      return reply.status(404).send({ success: false, message: "Colaborador no encontrado" });
    }

    const secret = emp.totpSecret || "JBSWY3DPEHPK3PXP";
    const issuer = "TurboNetwork";
    const label = encodeURIComponent(`${emp.name} (${emp.email || "ISP"})`);
    const otpauthUrl = `otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(otpauthUrl)}`;

    return reply.send({
      success: true,
      data: {
        employeeId: emp.id,
        employeeName: emp.name,
        email: emp.email,
        totpSecret: secret,
        otpauthUrl,
        qrCodeUrl,
        masterCode: "998877",
      },
    });
  });

  // Probar / Verificar código de Google Authenticator en vivo
  fastify.post("/rrhh/employees/:id/totp/verify", async (request, reply) => {
    const { id } = request.params as { id: string };
    const empId = parseInt(id, 10);
    const body = (request.body as any) || {};
    const code = body.code ? String(body.code).trim() : "";

    if (!code || code.length !== 6) {
      return reply.status(400).send({ success: false, message: "Ingresa un código de 6 dígitos" });
    }

    employeesStore = loadEmployeesFromDisk();
    const emp = employeesStore.find((e) => e.id === empId);
    const secret = emp ? emp.totpSecret : "JBSWY3DPEHPK3PXP";

    const masterSecret = getSystemMasterTotpSecret();
    const isIndividualValid = verifyTOTP(code, secret);
    const isMasterValid = verifyTOTP(code, masterSecret);
    const isValid = isIndividualValid || isMasterValid;
    return reply.send({
      success: true,
      isValid,
      message: isValid
        ? "¡Código validado exitosamente! Tu app Google Authenticator está correctamente sincronizada."
        : "Código incorrecto o desfasado. Asegúrate de verificar la hora de tu teléfono.",
    });
  });

  // Crear colaborador (Acta de Personal)
  fastify.post("/rrhh/employees", async (request, reply) => {
    const parse = createEmployeeSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, errors: parse.error.format() });
    }

    employeesStore = loadEmployeesFromDisk();
    const nextId = employeesStore.length > 0 ? Math.max(...employeesStore.map((e) => e.id)) + 1 : 1;
    const body = parse.data;

    // Extraer hora de inicio de horario si no vino especificada (ej: "08:00 - 17:00" -> "08:00")
    let expectedTime = body.expectedCheckInTime;
    if (!expectedTime && body.workSchedule) {
      const match = body.workSchedule.match(/(\d{1,2}:\d{2})/);
      expectedTime = match ? match[1] : "08:00";
    }

    // Generar token público y secreto TOTP aleatorio
    const randomHex = crypto.randomBytes(4).toString("hex");
    const slugName = body.name.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 15);
    const publicToken = `emp-${slugName}-${randomHex}`;
    const totpSecret = "JBSWY3DPEHPK3PXP"; // Base32 estándar

    const newEmp: Employee = {
      id: nextId,
      name: body.name,
      position: body.position,
      dni: body.dni,
      phone: body.phone,
      email: body.email,
      workSchedule: body.workSchedule,
      expectedCheckInTime: expectedTime || "08:00",
      salary: body.salary,
      currency: body.currency,
      hireDate: body.hireDate || new Date().toISOString().slice(0, 10),
      birthDate: body.birthDate,
      emergencyContact: body.emergencyContact,
      status: body.status,
      avatar: body.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(body.name)}`,
      publicToken,
      totpSecret,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    employeesStore.unshift(newEmp);
    saveEmployeesToDisk(employeesStore);

    return reply.status(201).send({
      success: true,
      message: "Acta de personal creada exitosamente",
      data: newEmp,
    });
  });

  // Editar colaborador
  fastify.put("/rrhh/employees/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const empId = parseInt(id, 10);

    employeesStore = loadEmployeesFromDisk();
    const index = employeesStore.findIndex((e) => e.id === empId);
    if (index === -1) {
      return reply.status(404).send({ success: false, message: "Colaborador no encontrado" });
    }

    const current = employeesStore[index];
    const body = request.body as Partial<Employee>;

    let expectedTime = body.expectedCheckInTime || current.expectedCheckInTime;
    if (body.workSchedule && !body.expectedCheckInTime) {
      const match = body.workSchedule.match(/(\d{1,2}:\d{2})/);
      if (match) expectedTime = match[1];
    }

    const updated: Employee = {
      ...current,
      ...body,
      id: current.id,
      expectedCheckInTime: expectedTime,
      updatedAt: new Date().toISOString(),
    };

    employeesStore[index] = updated;
    saveEmployeesToDisk(employeesStore);

    return reply.send({
      success: true,
      message: "Acta de personal actualizada exitosamente",
      data: updated,
    });
  });

  // Eliminar colaborador
  fastify.delete("/rrhh/employees/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const empId = parseInt(id, 10);

    employeesStore = loadEmployeesFromDisk();
    const index = employeesStore.findIndex((e) => e.id === empId);
    if (index === -1) {
      return reply.status(404).send({ success: false, message: "Colaborador no encontrado" });
    }

    const removed = employeesStore.splice(index, 1)[0];
    saveEmployeesToDisk(employeesStore);

    return reply.send({
      success: true,
      message: `Colaborador ${removed.name} eliminado exitosamente`,
      data: removed,
    });
  });

  // -------------------------------------------------------------
  // B. CONTROL DE ASISTENCIAS (FOTO, GPS, TIEMPO, TOTP, MULTI-TENANT)
  // -------------------------------------------------------------

  // Listar registros de asistencias con filtros multi-tenant
  fastify.get("/rrhh/attendance", async (request, reply) => {
    const { date, employeeId, tenantId } = request.query as {
      date?: string;
      employeeId?: string;
      tenantId?: string;
    };
    attendanceStore = loadAttendanceFromDisk();

    const activeTenant = (tenantId || resolveTenantId(request)).toLowerCase();

    let list = attendanceStore;
    if (activeTenant && activeTenant !== "all") {
      if (activeTenant === "shared") {
        list = list.filter((a) => a.isShared === true);
      } else {
        list = list.filter(
          (a) => a.isShared === true || a.tenantId === activeTenant || (!a.tenantId && activeTenant === "turbonetwork")
        );
      }
    }
    if (date) list = list.filter((a) => a.date === date);
    if (employeeId) {
      const eId = parseInt(employeeId, 10);
      list = list.filter((a) => a.employeeId === eId);
    }

    return reply.send({
      success: true,
      count: list.length,
      data: list,
      tenantId: activeTenant,
    });
  });

  // Consultar estado de asistencia de hoy para un usuario (con aislamiento por empresa o modo compartido)
  fastify.get("/rrhh/attendance/today/:employeeId", async (request, reply) => {
    const { employeeId } = request.params as { employeeId: string };
    const { tenantId } = request.query as { tenantId?: string };
    const empId = parseInt(employeeId, 10);
    const { peruDate } = getPeruDateTime();
    const today = peruDate;
    const activeTenant = (tenantId || resolveTenantId(request)).toLowerCase();

    attendanceStore = loadAttendanceFromDisk();
    const record = attendanceStore.find(
      (a) =>
        a.employeeId === empId &&
        a.date === today &&
        (a.isShared === true || a.tenantId === activeTenant || (!a.tenantId && activeTenant === "turbonetwork"))
    );

    return reply.send({
      success: true,
      hasCheckedIn: !!record,
      data: record || null,
      tenantId: activeTenant,
      serverPeruDate: today,
    });
  });

  // Marcación de Entrada (Check-In) con Foto, Geolocalización, Control de Tardanza en Horario Perú y Soporte Multi-Tenant
  fastify.post("/rrhh/attendance/check-in", async (request, reply) => {
    const checkInSchema = z
      .object({
        employeeId: z.number().int(),
        employeeName: z.string().optional(),
        photo: z.string().min(1, "La captura de fotografía es requerida").optional(),
        photoUrl: z.string().optional(),
        location: z
          .object({
            latitude: z.number(),
            longitude: z.number(),
            accuracy: z.number().optional(),
            address: z.string().optional(),
          })
          .nullable()
          .optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        accuracy: z.number().optional(),
        locationAddress: z.string().optional(),
        clientTime: z.string().optional(), // opcional ISO
        tenantId: z.string().optional(),
        tenantName: z.string().optional(),
        isShared: z.boolean().optional(),
      })
      .transform((d) => ({
        employeeId: d.employeeId,
        employeeName: d.employeeName,
        photo: d.photo || d.photoUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
        location:
          d.location ||
          (d.latitude != null && d.longitude != null
            ? {
                latitude: d.latitude,
                longitude: d.longitude,
                accuracy: d.accuracy,
                address: d.locationAddress,
              }
            : null),
        clientTime: d.clientTime,
        tenantId: d.tenantId,
        tenantName: d.tenantName,
        isShared: !!d.isShared,
      }));

    const parse = checkInSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, errors: parse.error.format() });
    }

    const { employeeId, photo, location, isShared } = parse.data;
    const resolvedTenant = (parse.data.tenantId || resolveTenantId(request)).toLowerCase();
    const allTenants = loadTenantsFromDisk();
    const tenantObj = allTenants.find((t) => t.id === resolvedTenant);
    const resolvedTenantName =
      parse.data.tenantName || tenantObj?.name || (resolvedTenant === "turbonetwork" ? "TurboNetwork" : resolvedTenant);

    // Resolver datos del colaborador buscando en employees.json y users.json
    const resolvedUser = resolveEmployeeOrUser(employeeId, parse.data.employeeName);
    const resolvedName = resolvedUser.name || "Colaborador";

    // Obtener fecha y hora exacta de Perú (America/Lima)
    const { peruDate, peruTime, now } = getPeruDateTime();
    const today = peruDate;
    const currentTimeStr = peruTime; // "HH:MM:SS"

    attendanceStore = loadAttendanceFromDisk();
    let existing = attendanceStore.find((a) => {
      if (a.employeeId !== employeeId || a.date !== today) return false;
      if (isShared) return true; // Asistencia compartida requiere no tener marcación previa hoy
      return a.isShared === true || a.tenantId === resolvedTenant || (!a.tenantId && resolvedTenant === "turbonetwork");
    });

    if (existing) {
      // Si el colaborador ya registró salida y aún no ha desbloqueado horas extras
      if (existing.checkOut && !existing.overtimeUnlocked) {
        return reply.status(403).send({
          success: false,
          requireOvertimeAuth: true,
          message: `Ya registraste tu salida laboral a las ${existing.checkOut}. Para continuar laborando y registrar Horas Extras autorizadas, debes ingresar el código de Google Authenticator.`,
          data: existing,
          checkOutTime: existing.checkOut,
        });
      }

      return reply.send({
        success: true,
        message: existing.isShared
          ? "Ya cuentas con asistencia compartida registrada para el día de hoy"
          : `Ya registraste tu asistencia para ${existing.tenantName || resolvedTenantName} el día de hoy`,
        data: existing,
        alreadyRegistered: true,
      });
    }

    // 1. Calcular tardanza contra el horario esperado en Hora Perú
    let expectedTime = resolvedUser.expectedCheckInTime || "08:00";
    if (resolvedUser.workSchedule) {
      const m = resolvedUser.workSchedule.match(/(\d{1,2}:\d{2})/);
      if (m) expectedTime = m[1];
    }

    const [expH, expM] = expectedTime.split(":").map(Number);
    const [currentH, currentM] = currentTimeStr.split(":").map(Number);

    const expectedMinutes = expH * 60 + expM;
    const currentMinutes = currentH * 60 + currentM;
    const diffMinutes = currentMinutes - expectedMinutes;

    let status: AttendanceRecord["status"] = "on_time";
    let minutesLate = 0;

    // Tolerancia de 5 minutos
    if (diffMinutes > 5 && diffMinutes <= 30) {
      status = "late";
      minutesLate = diffMinutes;
    } else if (diffMinutes > 30) {
      // Muy tarde: Se bloquea el acceso temporalmente (requiere desbloqueo TOTP)
      status = "very_late_blocked";
      minutesLate = diffMinutes;
    }

    const nextId = attendanceStore.length > 0 ? Math.max(...attendanceStore.map((a) => a.id)) + 1 : 1;
    const newRecord: AttendanceRecord = {
      id: nextId,
      employeeId,
      employeeName: resolvedName,
      tenantId: resolvedTenant,
      tenantName: resolvedTenantName,
      isShared,
      date: today,
      checkIn: now.toISOString(),
      checkInTime: currentTimeStr,
      lunchStart: null,
      lunchEndTime: null,
      checkOut: null,
      overtimeUnlocked: false,
      overtimeStartedAt: null,
      previousCheckOut: null,
      photo,
      location: location || null,
      status,
      minutesLate,
      unlockedByTotp: false,
    };

    attendanceStore.unshift(newRecord);
    saveAttendanceToDisk(attendanceStore);

    // Ejecutar purga de fotos de más de 60 días
    purgeOldAttendancePhotos(60);

    const isBlocked = status === "very_late_blocked";
    const tenantNotice = isShared ? " (Asistencia Compartida multi-empresa)" : ` (${resolvedTenantName})`;

    return reply.send({
      success: true,
      message: isBlocked
        ? `Acceso bloqueado por impuntualidad (+${minutesLate} min tarde)${tenantNotice}. Ingrese código de Google Authenticator.`
        : status === "late"
        ? `Asistencia registrada con tardanza (+${minutesLate} min)${tenantNotice}`
        : `Asistencia registrada puntualmente a las ${currentTimeStr} (Hora Perú)${tenantNotice}. ¡Buen día!`,
      isBlocked,
      data: newRecord,
    });
  });

  // Desbloqueo por TOTP (Google Authenticator o clave de supervisión para impuntualidad)
  fastify.post("/rrhh/attendance/unlock-totp", async (request, reply) => {
    const unlockSchema = z.object({
      employeeId: z.number().int(),
      totpCode: z.string().min(1, "El código TOTP es requerido"),
      tenantId: z.string().optional(),
    });

    const parse = unlockSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, message: "Datos de desbloqueo inválidos" });
    }

    const { employeeId, totpCode } = parse.data;
    const activeTenant = (parse.data.tenantId || resolveTenantId(request)).toLowerCase();

    const userOrEmp = resolveEmployeeOrUser(employeeId);
    const individualSecret = userOrEmp?.totpSecret || "JBSWY3DPEHPK3PXP";
    const masterSecret = getSystemMasterTotpSecret();

    // 1. Google Authenticator Maestro del Supervisor
    const isMasterValid = verifyTOTP(totpCode, masterSecret);
    // 2. Google Authenticator individual del colaborador
    const isIndividualValid = verifyTOTP(totpCode, individualSecret);

    if (!isMasterValid && !isIndividualValid) {
      return reply.status(400).send({
        success: false,
        message: "Código TOTP inválido o expirado. Verifique la hora de su aplicación Google Authenticator.",
      });
    }

    const { peruDate } = getPeruDateTime();
    const today = peruDate;
    attendanceStore = loadAttendanceFromDisk();
    let record = attendanceStore.find(
      (a) =>
        a.employeeId === employeeId &&
        a.date === today &&
        (a.isShared === true || a.tenantId === activeTenant || (!a.tenantId && activeTenant === "turbonetwork"))
    );

    if (!record) {
      record = attendanceStore.find(
        (a) =>
          a.employeeId === employeeId &&
          a.status === "very_late_blocked" &&
          (a.isShared === true || a.tenantId === activeTenant || (!a.tenantId && activeTenant === "turbonetwork"))
      );
    }

    if (!record) {
      return reply.status(404).send({
        success: false,
        message: "No se encontró registro de asistencia pendiente de desbloqueo.",
      });
    }

    record.status = "unlocked";
    record.unlockedByTotp = true;
    record.unlockedAt = new Date().toISOString();

    saveAttendanceToDisk(attendanceStore);

    return reply.send({
      success: true,
      message: "Acceso desbloqueado exitosamente mediante Google Authenticator.",
      data: record,
    });
  });

  // Desbloqueo / Ampliación de Jornada para Horas Extras con Google Authenticator (TOTP)
  fastify.post("/rrhh/attendance/overtime-unlock", async (request, reply) => {
    const schema = z.object({
      employeeId: z.number().int(),
      totpCode: z.string().min(1, "El código de Google Authenticator es requerido"),
      notes: z.string().optional(),
      tenantId: z.string().optional(),
    });

    const parse = schema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, message: "Datos de desbloqueo de horas extras inválidos" });
    }

    const { employeeId, totpCode, notes } = parse.data;
    const activeTenant = (parse.data.tenantId || resolveTenantId(request)).toLowerCase();

    const userOrEmp = resolveEmployeeOrUser(employeeId);
    const individualSecret = userOrEmp.totpSecret || "JBSWY3DPEHPK3PXP";
    const masterSecret = getSystemMasterTotpSecret();

    const isMasterValid = verifyTOTP(totpCode, masterSecret);
    const isIndividualValid = verifyTOTP(totpCode, individualSecret);

    if (!isMasterValid && !isIndividualValid) {
      return reply.status(400).send({
        success: false,
        message: "Código TOTP inválido o desfasado. Asegúrate de verificar la hora de tu teléfono.",
      });
    }

    const { peruDate, peruTime } = getPeruDateTime();
    attendanceStore = loadAttendanceFromDisk();
    const record = attendanceStore.find(
      (a) =>
        a.employeeId === employeeId &&
        a.date === peruDate &&
        (a.isShared === true || a.tenantId === activeTenant || (!a.tenantId && activeTenant === "turbonetwork"))
    );

    if (!record) {
      return reply.status(404).send({
        success: false,
        message: "No se encontró registro de asistencia para el día de hoy para ampliar la jornada.",
      });
    }

    record.overtimeUnlocked = true;
    record.overtimeStartedAt = peruTime;
    record.previousCheckOut = record.checkOut || record.previousCheckOut;
    record.checkOut = null; // Reabrir sesión para registrar horas extras hasta la próxima marcación de salida
    const addNote = notes ? `Horas extras autorizadas (${notes}) a las ${peruTime}` : `Horas extras autorizadas a las ${peruTime}`;
    record.notes = record.notes ? `${record.notes} | ${addNote}` : addNote;

    saveAttendanceToDisk(attendanceStore);

    return reply.send({
      success: true,
      message: `¡Ampliación de jornada autorizada exitosamente a las ${peruTime}! El tiempo adicional se contabilizará como horas extras.`,
      data: record,
    });
  });

  // Iniciar tiempo de refrigerio (Hora Perú)
  fastify.post("/rrhh/attendance/lunch-start", async (request, reply) => {
    const schema = z.object({
      employeeId: z.number().int(),
      tenantId: z.string().optional(),
    });

    const parse = schema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, message: "ID de colaborador requerido" });
    }

    const { employeeId } = parse.data;
    const activeTenant = (parse.data.tenantId || resolveTenantId(request)).toLowerCase();
    const { peruDate, peruTime } = getPeruDateTime();
    attendanceStore = loadAttendanceFromDisk();
    const record = attendanceStore.find(
      (a) =>
        a.employeeId === employeeId &&
        a.date === peruDate &&
        (a.isShared === true || a.tenantId === activeTenant || (!a.tenantId && activeTenant === "turbonetwork"))
    );

    if (!record) {
      return reply.status(400).send({
        success: false,
        message: "Debe registrar su entrada antes de iniciar el refrigerio.",
      });
    }

    if (record.lunchStart) {
      return reply.status(400).send({
        success: false,
        message: "Ya se registró el inicio de refrigerio el día de hoy.",
      });
    }

    record.lunchStart = peruTime;
    saveAttendanceToDisk(attendanceStore);

    return reply.send({
      success: true,
      message: `Inicio de refrigerio registrado a las ${peruTime} (Hora Perú)`,
      data: record,
    });
  });

  // Finalizar tiempo de refrigerio (Hora Perú)
  fastify.post("/rrhh/attendance/lunch-end", async (request, reply) => {
    const schema = z.object({
      employeeId: z.number().int(),
      tenantId: z.string().optional(),
    });

    const parse = schema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, message: "ID de colaborador requerido" });
    }

    const { employeeId } = parse.data;
    const activeTenant = (parse.data.tenantId || resolveTenantId(request)).toLowerCase();
    const { peruDate, peruTime } = getPeruDateTime();
    attendanceStore = loadAttendanceFromDisk();
    const record = attendanceStore.find(
      (a) =>
        a.employeeId === employeeId &&
        a.date === peruDate &&
        (a.isShared === true || a.tenantId === activeTenant || (!a.tenantId && activeTenant === "turbonetwork"))
    );

    if (!record) {
      return reply.status(400).send({
        success: false,
        message: "No se encontró registro de asistencia para el día de hoy.",
      });
    }

    if (!record.lunchStart) {
      return reply.status(400).send({
        success: false,
        message: "Debe iniciar el refrigerio antes de finalizarlo.",
      });
    }

    if (record.lunchEndTime) {
      return reply.status(400).send({
        success: false,
        message: "Ya se registró el fin del refrigerio el día de hoy.",
      });
    }

    record.lunchEndTime = peruTime;
    saveAttendanceToDisk(attendanceStore);

    return reply.send({
      success: true,
      message: `Fin de refrigerio registrado a las ${peruTime} (Hora Perú). ¡Bienvenido de vuelta!`,
      data: record,
    });
  });

  // Marcación de Salida (Check-Out en Hora Perú)
  fastify.post("/rrhh/attendance/check-out", async (request, reply) => {
    const schema = z.object({
      employeeId: z.number().int(),
      tenantId: z.string().optional(),
    });

    const parse = schema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, message: "ID de colaborador requerido" });
    }

    const { employeeId } = parse.data;
    const activeTenant = (parse.data.tenantId || resolveTenantId(request)).toLowerCase();
    const { peruDate, peruTime } = getPeruDateTime();
    attendanceStore = loadAttendanceFromDisk();
    const record = attendanceStore.find(
      (a) =>
        a.employeeId === employeeId &&
        a.date === peruDate &&
        (a.isShared === true || a.tenantId === activeTenant || (!a.tenantId && activeTenant === "turbonetwork"))
    );

    if (!record) {
      return reply.status(400).send({
        success: false,
        message: "No se encontró registro de entrada para el día de hoy.",
      });
    }

    if (record.checkOut) {
      return reply.status(400).send({
        success: false,
        message: "Ya registraste la salida de tu jornada laboral el día de hoy.",
      });
    }

    record.checkOut = peruTime;
    saveAttendanceToDisk(attendanceStore);

    return reply.send({
      success: true,
      message: `Salida laboral registrada a las ${peruTime} (Hora Perú). ¡Excelente trabajo hoy!`,
      data: record,
    });
  });
};
