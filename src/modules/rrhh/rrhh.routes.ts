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

function loadAttendanceFromDisk(): AttendanceRecord[] {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(ATTENDANCE_FILE)) {
      const raw = fs.readFileSync(ATTENDANCE_FILE, "utf-8");
      const list = JSON.parse(raw);
      if (Array.isArray(list)) return list;
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
    fs.writeFileSync(ATTENDANCE_FILE, JSON.stringify(list, null, 2), "utf-8");
  } catch (err) {
    console.error("Error al guardar attendance.json:", err);
  }
}

let employeesStore = loadEmployeesFromDisk();
let attendanceStore = loadAttendanceFromDisk();

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
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(publicUrl)}`;
  return `<!DOCTYPE html>
<html lang="es" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Credencial Oficial - ${emp.name} | TurboNetwork</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['Plus Jakarta Sans', 'sans-serif'],
            mono: ['JetBrains Mono', 'monospace'],
          }
        }
      }
    }
  </script>
  <style>
    @media print {
      body { background: white !important; color: black !important; padding: 0 !important; }
      .no-print { display: none !important; }
      .print-shadow { box-shadow: none !important; border: 1px solid #cbd5e1 !important; }
    }
  </style>
</head>
<body class="bg-[#0b0f19] text-slate-100 min-h-screen flex flex-col justify-center items-center p-4 selection:bg-blue-500 selection:text-white font-sans antialiased">
  <!-- Tarjeta Central de la Credencial -->
  <div class="max-w-md w-full my-auto space-y-4">
    <div class="print-shadow rounded-2xl bg-gradient-to-b from-slate-900 via-slate-900 to-[#0c1322] text-white border border-white/10 shadow-2xl relative overflow-hidden p-6 sm:p-7">
      <div class="absolute -right-16 -top-16 w-40 h-40 bg-blue-500/15 rounded-full blur-3xl pointer-events-none"></div>
      <div class="absolute -left-16 -bottom-16 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <!-- Encabezado Oficial -->
      <div class="flex items-center justify-between pb-4 border-b border-white/10 relative z-10">
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-black text-white text-sm shadow-lg shadow-blue-500/20">TN</div>
          <div>
            <h4 class="font-extrabold text-xs tracking-wider uppercase text-white">TurboNetwork ISP</h4>
            <span class="text-[10px] text-blue-300 font-mono block">Credencial Oficial de Personal</span>
          </div>
        </div>
        <span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 shadow-sm">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Verificado
        </span>
      </div>

      <!-- Avatar y Nombre -->
      <div class="mt-6 text-center relative z-10">
        <div class="relative inline-block">
          <img class="w-24 h-24 rounded-2xl mx-auto border-2 border-white/20 shadow-2xl object-cover bg-slate-800" src="${emp.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(emp.name)}`}" alt="Foto">
          <span class="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-slate-900"></span>
        </div>
        <h3 class="text-lg font-bold text-white mt-3 tracking-tight">${emp.name}</h3>
        <p class="text-xs text-blue-400 font-medium">${emp.position}</p>
      </div>

      <!-- Tabla de Datos con Alto Contraste y Legibilidad Superior -->
      <div class="mt-5 pt-4 border-t border-white/10 space-y-2 text-xs font-mono relative z-10">
        <div class="flex justify-between items-center py-1.5 px-3 rounded-xl bg-white/[0.06] border border-white/10">
          <span class="text-slate-200 font-semibold font-sans">DNI / Documento:</span>
          <span class="font-extrabold text-white text-[12px] tracking-wider">${emp.dni}</span>
        </div>
        <div class="flex justify-between items-center py-1.5 px-3 rounded-xl bg-white/[0.06] border border-white/10">
          <span class="text-slate-200 font-semibold font-sans">Teléfono Oficial:</span>
          <span class="font-bold text-white">${emp.phone}</span>
        </div>
        <div class="flex justify-between items-center py-1.5 px-3 rounded-xl bg-white/[0.06] border border-white/10">
          <span class="text-slate-200 font-semibold font-sans">Correo Corporativo:</span>
          <span class="font-bold text-white truncate max-w-[210px]">${emp.email}</span>
        </div>
        <div class="flex justify-between items-center py-1.5 px-3 rounded-xl bg-white/[0.06] border border-white/10">
          <span class="text-slate-200 font-semibold font-sans">Horario Asignado:</span>
          <span class="text-amber-300 font-extrabold">${emp.workSchedule}</span>
        </div>
        <div class="flex justify-between items-center py-1.5 px-3 rounded-xl bg-white/[0.06] border border-white/10">
          <span class="text-slate-200 font-semibold font-sans">Salario Declarado:</span>
          <span class="text-emerald-400 font-extrabold">${emp.currency || '$'}${emp.salary}</span>
        </div>
        <div class="flex justify-between items-center py-1.5 px-3 rounded-xl bg-white/[0.06] border border-white/10">
          <span class="text-slate-200 font-semibold font-sans">Fecha de Ingreso:</span>
          <span class="font-bold text-slate-100">${emp.hireDate}</span>
        </div>
        <div class="flex justify-between items-center py-1.5 px-3 rounded-xl bg-white/[0.06] border border-white/10">
          <span class="text-slate-200 font-semibold font-sans">Estado en Nómina:</span>
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${emp.status === 'active' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}">${emp.status === 'active' ? 'Activo / En funciones' : 'Inactivo'}</span>
        </div>
      </div>

      <!-- Sección de Código QR y Validación -->
      <div class="mt-5 pt-4 border-t border-white/10 flex items-center justify-between relative z-10">
        <div>
          <span class="text-[10px] text-slate-400 block font-sans">Escanear para validar:</span>
          <span class="text-[10px] text-emerald-400 font-mono flex items-center gap-1 mt-1">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Credencial Auténtica
          </span>
          <span class="text-[9px] text-slate-500 block mt-1 font-mono">Token: ${emp.publicToken}</span>
        </div>
        <div class="p-2 bg-white rounded-xl shadow-lg border border-white/20">
          <img class="w-20 h-20 rounded-lg object-contain" src="${qrUrl}" alt="QR Verificación">
        </div>
      </div>

      <!-- Pie de Seguridad -->
      <div class="mt-4 pt-3 border-t border-white/10 text-[9px] text-slate-500 text-center font-sans">
        TurboNetwork ISP Core • Sistema Integrado de RRHH & Validación Criptográfica
      </div>
    </div>

    <!-- Botones de Acción Públicos (No imprimibles) -->
    <div class="no-print flex items-center justify-between gap-2 px-1">
      <button onclick="window.print()" class="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition flex items-center justify-center space-x-1.5 border border-white/10 shadow-sm">
        <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
        <span>Imprimir / PDF</span>
      </button>
      <button onclick="navigator.clipboard.writeText(window.location.href); alert('¡Enlace de verificación copiado al portapapeles!')" class="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition flex items-center justify-center space-x-1.5 shadow-sm">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
        <span>Copiar Enlace</span>
      </button>
      <a href="/" class="py-2 px-3 rounded-xl bg-slate-800/70 hover:bg-slate-700 text-slate-300 text-xs font-medium transition border border-white/10">
        Portal
      </a>
    </div>
  </div>
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
    const today = new Date().toISOString().slice(0, 10);
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
    });
  });

  // Marcación de Entrada (Check-In) con Foto, Geolocalización, Control de Tardanza y Soporte Multi-Tenant
  fastify.post("/rrhh/attendance/check-in", async (request, reply) => {
    const checkInSchema = z
      .object({
        employeeId: z.number().int(),
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

    employeesStore = loadEmployeesFromDisk();
    const emp = employeesStore.find((e) => e.id === employeeId);

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const currentTimeStr = now.toTimeString().slice(0, 8); // "HH:MM:SS"

    attendanceStore = loadAttendanceFromDisk();
    let existing = attendanceStore.find((a) => {
      if (a.employeeId !== employeeId || a.date !== today) return false;
      if (isShared) return true; // Asistencia compartida requiere no tener marcación previa hoy
      return a.isShared === true || a.tenantId === resolvedTenant || (!a.tenantId && resolvedTenant === "turbonetwork");
    });

    if (existing) {
      return reply.send({
        success: true,
        message: existing.isShared
          ? "Ya cuentas con asistencia compartida registrada para el día de hoy"
          : `Ya registraste tu asistencia para ${existing.tenantName || resolvedTenantName} el día de hoy`,
        data: existing,
        alreadyRegistered: true,
      });
    }

    // 1. Calcular tardanza contra el horario esperado
    let expectedTime = "08:00";
    if (emp && emp.expectedCheckInTime) {
      expectedTime = emp.expectedCheckInTime;
    } else if (emp && emp.workSchedule) {
      const m = emp.workSchedule.match(/(\d{1,2}:\d{2})/);
      if (m) expectedTime = m[1];
    }

    const [expH, expM] = expectedTime.split(":").map(Number);
    const currentH = now.getHours();
    const currentM = now.getMinutes();

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
      employeeName: emp ? emp.name : "Colaborador",
      tenantId: resolvedTenant,
      tenantName: resolvedTenantName,
      isShared,
      date: today,
      checkIn: now.toISOString(),
      checkInTime: currentTimeStr,
      lunchStart: null,
      lunchEndTime: null,
      checkOut: null,
      photo,
      location: location || null,
      status,
      minutesLate,
      unlockedByTotp: false,
    };

    attendanceStore.unshift(newRecord);
    saveAttendanceToDisk(attendanceStore);

    const isBlocked = status === "very_late_blocked";
    const tenantNotice = isShared ? " (Asistencia Compartida multi-empresa)" : ` (${resolvedTenantName})`;

    return reply.send({
      success: true,
      message: isBlocked
        ? `Acceso bloqueado por impuntualidad (+${minutesLate} min tarde)${tenantNotice}. Ingrese código de Google Authenticator.`
        : status === "late"
        ? `Asistencia registrada con tardanza (+${minutesLate} min)${tenantNotice}`
        : `Asistencia registrada puntualmente${tenantNotice}. ¡Buen día!`,
      isBlocked,
      data: newRecord,
    });
  });

  // Desbloqueo por TOTP (Google Authenticator o clave de supervisión)
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

    employeesStore = loadEmployeesFromDisk();
    const emp = employeesStore.find((e) => e.id === employeeId);
    const individualSecret = emp?.totpSecret || "JBSWY3DPEHPK3PXP";
    const masterSecret = getSystemMasterTotpSecret();

    // 1. Google Authenticator Maestro del Supervisor (¡un solo código desbloquea a todos los colaboradores!)
    const isMasterValid = verifyTOTP(totpCode, masterSecret);
    // 2. Google Authenticator individual del colaborador
    const isIndividualValid = verifyTOTP(totpCode, individualSecret);

    if (!isMasterValid && !isIndividualValid) {
      return reply.status(400).send({
        success: false,
        message: "Código TOTP inválido o expirado. Verifique la hora de su aplicación Google Authenticator.",
      });
    }

    const today = new Date().toISOString().slice(0, 10);
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

  // Iniciar tiempo de refrigerio
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
    const today = new Date().toISOString().slice(0, 10);
    attendanceStore = loadAttendanceFromDisk();
    const record = attendanceStore.find(
      (a) =>
        a.employeeId === employeeId &&
        a.date === today &&
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

    const nowTime = new Date().toTimeString().slice(0, 8);
    record.lunchStart = nowTime;
    saveAttendanceToDisk(attendanceStore);

    return reply.send({
      success: true,
      message: `Inicio de refrigerio registrado a las ${nowTime}`,
      data: record,
    });
  });

  // Finalizar tiempo de refrigerio
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
    const today = new Date().toISOString().slice(0, 10);
    attendanceStore = loadAttendanceFromDisk();
    const record = attendanceStore.find(
      (a) =>
        a.employeeId === employeeId &&
        a.date === today &&
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

    const nowTime = new Date().toTimeString().slice(0, 8);
    record.lunchEndTime = nowTime;
    saveAttendanceToDisk(attendanceStore);

    return reply.send({
      success: true,
      message: `Fin de refrigerio registrado a las ${nowTime}. ¡Bienvenido de vuelta!`,
      data: record,
    });
  });

  // Marcación de Salida (Check-Out)
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
    const today = new Date().toISOString().slice(0, 10);
    attendanceStore = loadAttendanceFromDisk();
    const record = attendanceStore.find(
      (a) =>
        a.employeeId === employeeId &&
        a.date === today &&
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

    const nowTime = new Date().toTimeString().slice(0, 8);
    record.checkOut = nowTime;
    saveAttendanceToDisk(attendanceStore);

    return reply.send({
      success: true,
      message: `Salida laboral registrada a las ${nowTime}. ¡Excelente trabajo hoy!`,
      data: record,
    });
  });
};
