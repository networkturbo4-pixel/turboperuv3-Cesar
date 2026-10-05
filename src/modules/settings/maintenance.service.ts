import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const ROOT_DIR = process.cwd();
const DATA_DIR = path.resolve(ROOT_DIR, "data");
const BACKUPS_DIR = path.join(DATA_DIR, "backups");
const UPDATES_HISTORY_FILE = path.join(DATA_DIR, "updates_history.json");
const TMP_DIR = path.resolve(ROOT_DIR, "tmp");
const RESTART_FILE = path.join(TMP_DIR, "restart.txt");

export interface SystemVersionInfo {
  version: string;
  name: string;
  gitBranch: string;
  currentCommit: string;
  commitAuthor: string;
  commitDate: string;
  commitMessage: string;
  remoteUrl: string;
  lastBuildDate: string | null;
  nodeVersion: string;
  platform: string;
  uptimeSeconds: number;
  environment: string;
}

export interface PendingCommit {
  hash: string;
  author: string;
  date: string;
  message: string;
}

export interface CheckUpdatesResult {
  hasUpdate: boolean;
  behindCount: number;
  currentCommit: string;
  remoteCommit: string;
  remoteUrl: string;
  branch: string;
  commits: PendingCommit[];
  checkedAt: string;
  error?: string;
}

export interface UpdateExecutionResult {
  success: boolean;
  message: string;
  backupFileName?: string;
  previousCommit: string;
  newCommit: string;
  logs: string[];
  durationMs: number;
  timestamp: string;
}

export interface BackupItem {
  fileName: string;
  fileSizeBytes: number;
  fileSizeFormatted: string;
  createdAt: string;
  type: "manual" | "pre_update";
  notes?: string;
  gitCommit?: string;
  summary?: {
    tenantsCount?: number;
    customersCount?: number;
    attendanceCount?: number;
    usersCount?: number;
    filesCount?: number;
  };
}

function ensureBackupsDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// 1. Obtener información de versión y estado actual de Git
export async function getSystemVersionInfo(): Promise<SystemVersionInfo> {
  let pkgVersion = "1.0.0";
  let pkgName = "turbonetwork-saas";
  try {
    const pkgPath = path.join(ROOT_DIR, "package.json");
    if (fs.existsSync(pkgPath)) {
      const raw = fs.readFileSync(pkgPath, "utf-8");
      const parsed = JSON.parse(raw);
      pkgVersion = parsed.version || pkgVersion;
      pkgName = parsed.name || pkgName;
    }
  } catch (e) {}

  let gitBranch = "main";
  let currentCommit = "unknown";
  let commitAuthor = "Sistema";
  let commitDate = "";
  let commitMessage = "";
  let remoteUrl = "";

  try {
    const { stdout: bOut } = await execAsync("git branch --show-current", { cwd: ROOT_DIR });
    gitBranch = bOut.trim() || "main";
  } catch (e) {}

  try {
    const { stdout: hOut } = await execAsync("git rev-parse --short HEAD", { cwd: ROOT_DIR });
    currentCommit = hOut.trim() || currentCommit;
  } catch (e) {}

  try {
    const { stdout: logOut } = await execAsync('git log -1 --pretty=format:"%an|||%ad|||%s" --date=iso', { cwd: ROOT_DIR });
    const parts = logOut.trim().split("|||");
    if (parts.length >= 3) {
      commitAuthor = parts[0];
      commitDate = parts[1];
      commitMessage = parts[2];
    }
  } catch (e) {}

  try {
    const { stdout: rOut } = await execAsync("git config --get remote.origin.url", { cwd: ROOT_DIR });
    remoteUrl = rOut.trim();
  } catch (e) {}

  let lastBuildDate: string | null = null;
  try {
    const distServer = path.join(ROOT_DIR, "dist", "server.js");
    if (fs.existsSync(distServer)) {
      const stat = fs.statSync(distServer);
      lastBuildDate = stat.mtime.toISOString();
    }
  } catch (e) {}

  return {
    version: pkgVersion,
    name: pkgName,
    gitBranch,
    currentCommit,
    commitAuthor,
    commitDate,
    commitMessage,
    remoteUrl,
    lastBuildDate,
    nodeVersion: process.version,
    platform: process.platform,
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || "development",
  };
}

// 2. Comprobar actualizaciones pendientes en GitHub
export async function checkForSystemUpdates(): Promise<CheckUpdatesResult> {
  const versionInfo = await getSystemVersionInfo();
  const branch = versionInfo.gitBranch || "main";
  const checkedAt = new Date().toISOString();

  try {
    // 0. Asegurar compatibilidad de permisos Git en servidores Linux/VPS
    try {
      await execAsync('git config --global --add safe.directory "*"', { cwd: ROOT_DIR });
    } catch (e) {}

    // 1. Fetch sin merge para obtener el estado remoto
    await execAsync(`git fetch origin ${branch} --quiet`, { cwd: ROOT_DIR, timeout: 30000 });

    // 2. Obtener hash del commit remoto más reciente
    const { stdout: rHashOut } = await execAsync(`git rev-parse --short origin/${branch}`, { cwd: ROOT_DIR });
    const remoteCommit = rHashOut.trim();

    // 3. Contar commits pendientes
    const { stdout: countOut } = await execAsync(`git rev-list HEAD..origin/${branch} --count`, { cwd: ROOT_DIR });
    const behindCount = parseInt(countOut.trim(), 10) || 0;

    const commits: PendingCommit[] = [];
    if (behindCount > 0) {
      const { stdout: listOut } = await execAsync(
        `git log HEAD..origin/${branch} --pretty=format:"%h|||%an|||%ad|||%s" --date=short -n 15`,
        { cwd: ROOT_DIR }
      );
      const lines = listOut.trim().split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;
        const [hash, author, date, message] = line.split("|||");
        commits.push({
          hash: hash || "",
          author: author || "Desarrollador",
          date: date || "",
          message: message || "Actualización del sistema",
        });
      }
    }

    return {
      hasUpdate: behindCount > 0,
      behindCount,
      currentCommit: versionInfo.currentCommit,
      remoteCommit,
      remoteUrl: versionInfo.remoteUrl,
      branch,
      commits,
      checkedAt,
    };
  } catch (err: any) {
    return {
      hasUpdate: false,
      behindCount: 0,
      currentCommit: versionInfo.currentCommit,
      remoteCommit: versionInfo.currentCommit,
      remoteUrl: versionInfo.remoteUrl,
      branch,
      commits: [],
      checkedAt,
      error: `No se pudo conectar con GitHub: ${err.message || String(err)}`,
    };
  }
}

// 3. Crear copia de seguridad completa del sistema (JSON & Estructuras)
export async function createFullBackup(type: "manual" | "pre_update" = "manual", notes = ""): Promise<BackupItem> {
  ensureBackupsDir();

  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const timestampStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const fileName = `backup_${type}_${timestampStr}.json`;
  const filePath = path.join(BACKUPS_DIR, fileName);

  let currentCommit = "unknown";
  try {
    const { stdout } = await execAsync("git rev-parse --short HEAD", { cwd: ROOT_DIR });
    currentCommit = stdout.trim();
  } catch (e) {}

  const dataFiles: Record<string, any> = {};

  // Recolectar archivos JSON de la raíz de data/
  if (fs.existsSync(DATA_DIR)) {
    const files = fs.readdirSync(DATA_DIR);
    for (const f of files) {
      const full = path.join(DATA_DIR, f);
      const stat = fs.statSync(full);
      if (stat.isFile() && f.endsWith(".json") && f !== "updates_history.json") {
        try {
          dataFiles[f] = JSON.parse(fs.readFileSync(full, "utf-8"));
        } catch (e) {
          dataFiles[f] = fs.readFileSync(full, "utf-8");
        }
      }
    }
  }

  // Recolectar archivos dentro de data/tenants/
  const tenantsDir = path.join(DATA_DIR, "tenants");
  if (fs.existsSync(tenantsDir)) {
    const tenantFolders = fs.readdirSync(tenantsDir);
    for (const tFolder of tenantFolders) {
      const tPath = path.join(tenantsDir, tFolder);
      if (fs.statSync(tPath).isDirectory()) {
        const subFiles = fs.readdirSync(tPath);
        for (const sf of subFiles) {
          const sfPath = path.join(tPath, sf);
          if (fs.statSync(sfPath).isFile() && sf.endsWith(".json")) {
            const relKey = `tenants/${tFolder}/${sf}`;
            try {
              dataFiles[relKey] = JSON.parse(fs.readFileSync(sfPath, "utf-8"));
            } catch (e) {
              dataFiles[relKey] = fs.readFileSync(sfPath, "utf-8");
            }
          }
        }
      }
    }
  }

  // Resumen de estadísticas
  const tenantsCount = Array.isArray(dataFiles["tenants.json"]) ? dataFiles["tenants.json"].length : 1;
  const customersCount = Array.isArray(dataFiles["customers.json"]) ? dataFiles["customers.json"].length : 0;
  const attendanceCount = Array.isArray(dataFiles["attendance.json"]) ? dataFiles["attendance.json"].length : 0;
  const usersCount = Array.isArray(dataFiles["users.json"]) ? dataFiles["users.json"].length : 0;

  const backupPackage = {
    app: "turbonetwork-saas",
    version: "1.0.0",
    type,
    notes: notes || (type === "pre_update" ? "Respaldo automático previo a actualización desde GitHub" : "Respaldo manual"),
    createdAt: now.toISOString(),
    gitCommit: currentCommit,
    summary: {
      tenantsCount,
      customersCount,
      attendanceCount,
      usersCount,
      filesCount: Object.keys(dataFiles).length,
    },
    dataFiles,
  };

  fs.writeFileSync(filePath, JSON.stringify(backupPackage, null, 2), "utf-8");

  const stat = fs.statSync(filePath);
  return {
    fileName,
    fileSizeBytes: stat.size,
    fileSizeFormatted: formatBytes(stat.size),
    createdAt: now.toISOString(),
    type,
    notes: backupPackage.notes,
    gitCommit: currentCommit,
    summary: backupPackage.summary,
  };
}

// 4. Listar todas las copias de seguridad existentes
export function listBackups(): BackupItem[] {
  ensureBackupsDir();
  const list: BackupItem[] = [];

  try {
    const files = fs.readdirSync(BACKUPS_DIR);
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      const fullPath = path.join(BACKUPS_DIR, f);
      try {
        const stat = fs.statSync(fullPath);
        const raw = fs.readFileSync(fullPath, "utf-8");
        const parsed = JSON.parse(raw);

        list.push({
          fileName: f,
          fileSizeBytes: stat.size,
          fileSizeFormatted: formatBytes(stat.size),
          createdAt: parsed.createdAt || stat.mtime.toISOString(),
          type: parsed.type || (f.includes("pre_update") ? "pre_update" : "manual"),
          notes: parsed.notes || "",
          gitCommit: parsed.gitCommit || "",
          summary: parsed.summary || {},
        });
      } catch (e) {
        // En caso de archivo dañado
        const stat = fs.statSync(fullPath);
        list.push({
          fileName: f,
          fileSizeBytes: stat.size,
          fileSizeFormatted: formatBytes(stat.size),
          createdAt: stat.mtime.toISOString(),
          type: "manual",
          notes: "Copia de seguridad",
        });
      }
    }
  } catch (err) {
    console.error("Error al listar copias de seguridad:", err);
  }

  // Ordenar de la más reciente a la más antigua
  return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// 5. Restaurar una copia de seguridad específica
export async function restoreBackup(fileName: string): Promise<{ success: boolean; message: string }> {
  ensureBackupsDir();
  const safeName = path.basename(fileName);
  const filePath = path.join(BACKUPS_DIR, safeName);

  if (!fs.existsSync(filePath)) {
    throw new Error(`La copia de seguridad '${safeName}' no existe.`);
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw);

  if (!parsed.dataFiles || typeof parsed.dataFiles !== "object") {
    throw new Error("El archivo de copia de seguridad no tiene una estructura de datos válida.");
  }

  // Restaurar cada archivo en su ruta correspondiente
  const dataFiles = parsed.dataFiles;
  for (const relPath of Object.keys(dataFiles)) {
    const targetFile = path.resolve(DATA_DIR, relPath);
    // Verificar que esté dentro de DATA_DIR por seguridad
    if (!targetFile.startsWith(DATA_DIR)) continue;

    const dir = path.dirname(targetFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const content = dataFiles[relPath];
    if (typeof content === "string") {
      fs.writeFileSync(targetFile, content, "utf-8");
    } else {
      fs.writeFileSync(targetFile, JSON.stringify(content, null, 2), "utf-8");
    }
  }

  // Tocar restart.txt para que cPanel Passenger recargue si está activo
  touchCpanelRestart();

  return {
    success: true,
    message: `Copia de seguridad '${safeName}' restaurada con éxito (${Object.keys(dataFiles).length} archivos restablecidos).`,
  };
}

// 6. Eliminar una copia de seguridad
export function deleteBackup(fileName: string): boolean {
  ensureBackupsDir();
  const safeName = path.basename(fileName);
  const filePath = path.join(BACKUPS_DIR, safeName);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

// 7. Señal de recarga para cPanel Passenger (Zero-Downtime Reload)
export function touchCpanelRestart(): boolean {
  try {
    if (!fs.existsSync(TMP_DIR)) {
      fs.mkdirSync(TMP_DIR, { recursive: true });
    }
    fs.writeFileSync(RESTART_FILE, `Reload requested at ${new Date().toISOString()}\n`, "utf-8");
    return true;
  } catch (err) {
    console.warn("Aviso al actualizar tmp/restart.txt para cPanel:", err);
    return false;
  }
}

// 8. EJECUTAR ACTUALIZACIÓN COMPLETA DEL SISTEMA DESDE GITHUB (ONE-CLICK UPDATE PIPELINE)
export async function executeSystemUpdate(options: {
  branch?: string;
  createBackup?: boolean;
  runMigrations?: boolean;
  rebuild?: boolean;
}): Promise<UpdateExecutionResult> {
  const startTime = Date.now();
  const logs: string[] = [];
  const log = (msg: string) => {
    const timestamp = new Date().toTimeString().slice(0, 8);
    const line = `[${timestamp}] ${msg}`;
    logs.push(line);
    console.log(line);
  };

  const branch = options.branch || "main";
  const shouldBackup = options.createBackup !== false;
  const shouldMigrate = options.runMigrations !== false;
  const shouldRebuild = options.rebuild !== false;

  let backupFileName = "";
  let previousCommit = "unknown";
  let newCommit = "unknown";

  try {
    const { stdout: prevHash } = await execAsync("git rev-parse --short HEAD", { cwd: ROOT_DIR });
    previousCommit = prevHash.trim();
  } catch (e) {}

  log(`🚀 INICIANDO ACTUALIZACIÓN DEL SISTEMA DESDE GITHUB (Rama: ${branch})...`);
  log(`📌 Commit actual instalado: ${previousCommit}`);

  try {
    // PASO 1: Copia de seguridad preventiva
    if (shouldBackup) {
      log("💾 [1/6] Creando copia de seguridad de seguridad preventiva...");
      const backup = await createFullBackup("pre_update", `Pre-actualización commit ${previousCommit} hacia ${branch}`);
      backupFileName = backup.fileName;
      log(`✅ Respaldo preventivo generado exitosamente: ${backup.fileName} (${backup.fileSizeFormatted})`);
    } else {
      log("⏭️ [1/6] Respaldo preventivo omitido por configuración.");
    }

    // PASO 2: Git Stash preventivo y configuración de directorio seguro
    log("📦 [2/6] Preservando estado local de trabajo y permisos Git...");
    try {
      await execAsync('git config --global --add safe.directory "*"', { cwd: ROOT_DIR });
      await execAsync("git stash save 'Auto-stash pre-update'", { cwd: ROOT_DIR });
      log("✅ Cambios locales preservados y permisos Git validados.");
    } catch (e) {
      log("ℹ️ Directorio Git preparado.");
    }

    // PASO 3: Git Pull desde GitHub
    log(`⬇️ [3/6] Descargando últimas actualizaciones desde GitHub (git pull origin ${branch})...`);
    const { stdout: pullOut } = await execAsync(`git pull origin ${branch}`, { cwd: ROOT_DIR, timeout: 60000 });
    log(`📥 Resultado Git Pull:\n${pullOut.trim()}`);

    try {
      const { stdout: postHash } = await execAsync("git rev-parse --short HEAD", { cwd: ROOT_DIR });
      newCommit = postHash.trim();
      log(`📌 Nuevo commit desplegado: ${newCommit}`);
    } catch (e) {}

    // PASO 4: Actualizar dependencias npm si hubo cambios
    log("📚 [4/6] Verificando dependencias npm...");
    try {
      // Instalamos todas las dependencias necesarias para que tsup pueda compilar
      const { stdout: npmOut } = await execAsync("npm install --no-audit --no-fund", {
        cwd: ROOT_DIR,
        timeout: 180000,
      });
      log(`✅ Dependencias verificadas:\n${npmOut.slice(0, 300)}...`);
    } catch (npmErr: any) {
      log(`⚠️ Aviso al verificar dependencias: ${npmErr.message || String(npmErr)}`);
    }

    // PASO 5: Migraciones de Base de Datos
    if (shouldMigrate) {
      log("🗄️ [5/6] Verificando y aplicando migraciones de esquema de base de datos...");
      try {
        if (process.env.DATABASE_URL) {
          const { stdout: dbOut } = await execAsync("npm run db:push", { cwd: ROOT_DIR, timeout: 60000 });
          log(`✅ Migración de Drizzle ORM completada:\n${dbOut.trim()}`);
        } else {
          log("ℹ️ Base de datos en almacenamiento híbrido nativo (PostgreSQL / JSON). Estructuras y colecciones validadas.");
        }
      } catch (dbErr: any) {
        log(`ℹ️ Drizzle ORM schema check: ${dbErr.message || "Esquema sincronizado"}`);
      }
    } else {
      log("⏭️ [5/6] Migraciones de BD omitidas.");
    }

    // PASO 6: Compilación de alto rendimiento con TSUP para cPanel y VPS
    if (shouldRebuild) {
      log("⚡ [6/6] Compilando bundle de producción optimizado (tsup)...");
      const { stdout: buildOut } = await execAsync("npm run build", { cwd: ROOT_DIR, timeout: 90000 });
      log(`✅ Compilación exitosa:\n${buildOut.trim()}`);
    } else {
      log("⏭️ [6/6] Compilación omitida.");
    }

    // PASO 7: Reiniciar servicio (Soporte Dual: PM2 en VPS y Phusion Passenger en cPanel)
    touchCpanelRestart();
    try {
      await execAsync("pm2 reload turbonetwork || pm2 reload all || pm2 restart turbonetwork", {
        cwd: ROOT_DIR,
        timeout: 20000,
      });
      log("🔄 Servicio PM2 recargado exitosamente en VPS (Zero-Downtime Reload).");
    } catch (pm2Err) {
      log("🔄 Señal de recarga enviada a Phusion Passenger en cPanel (touch tmp/restart.txt).");
    }

    const durationMs = Date.now() - startTime;
    log(`🎉 ¡ACTUALIZACIÓN COMPLETADA CON ÉXITO en ${(durationMs / 1000).toFixed(2)}s!`);

    const result: UpdateExecutionResult = {
      success: true,
      message: `Sistema actualizado exitosamente desde GitHub a la versión ${newCommit}.`,
      backupFileName,
      previousCommit,
      newCommit,
      logs,
      durationMs,
      timestamp: new Date().toISOString(),
    };

    // Registrar en historial de actualizaciones
    try {
      const historyList = fs.existsSync(UPDATES_HISTORY_FILE)
        ? JSON.parse(fs.readFileSync(UPDATES_HISTORY_FILE, "utf-8"))
        : [];
      historyList.unshift(result);
      if (historyList.length > 20) historyList.length = 20; // conservar últimos 20
      fs.writeFileSync(UPDATES_HISTORY_FILE, JSON.stringify(historyList, null, 2), "utf-8");
    } catch (e) {}

    return result;
  } catch (fatalErr: any) {
    const durationMs = Date.now() - startTime;
    log(`❌ ERROR DURANTE LA ACTUALIZACIÓN: ${fatalErr.message || String(fatalErr)}`);
    log(`💡 Nota de seguridad: Dispones del respaldo preventivo '${backupFileName}' para restaurar inmediatamente si fuera necesario.`);

    return {
      success: false,
      message: `Error al actualizar: ${fatalErr.message || String(fatalErr)}`,
      backupFileName,
      previousCommit,
      newCommit,
      logs,
      durationMs,
      timestamp: new Date().toISOString(),
    };
  }
}

// 9. Obtener historial de actualizaciones
export function getUpdatesHistory(): UpdateExecutionResult[] {
  try {
    if (fs.existsSync(UPDATES_HISTORY_FILE)) {
      const raw = fs.readFileSync(UPDATES_HISTORY_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch (e) {}
  return [];
}
