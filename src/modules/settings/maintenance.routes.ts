import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import fs from "fs";
import path from "path";
import {
  getSystemVersionInfo,
  checkForSystemUpdates,
  executeSystemUpdate,
  getUpdatesHistory,
  createFullBackup,
  listBackups,
  restoreBackup,
  deleteBackup,
  touchCpanelRestart,
} from "./maintenance.service";

const BACKUPS_DIR = path.resolve(process.cwd(), "data", "backups");

export const maintenanceRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. Obtener versión del sistema, commit Git y estado del servidor
  fastify.get("/settings/system/version", async (_request, reply) => {
    try {
      const data = await getSystemVersionInfo();
      return reply.send({ success: true, data });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message });
    }
  });

  // 2. Comprobar si hay actualizaciones disponibles en el repositorio de GitHub
  fastify.get("/settings/system/check-updates", async (_request, reply) => {
    try {
      const data = await checkForSystemUpdates();
      return reply.send({ success: true, data });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message });
    }
  });

  // 3. Ejecutar actualización del sistema desde GitHub (Git Pull + Dependencias + Migración + Build cPanel)
  fastify.post("/settings/system/update", async (request, reply) => {
    const schema = z.object({
      branch: z.string().default("main").optional(),
      createBackup: z.boolean().optional(),
      createBackupBefore: z.boolean().optional(),
      runMigrations: z.boolean().optional(),
      runMigration: z.boolean().optional(),
      rebuild: z.boolean().optional(),
      runBuild: z.boolean().optional(),
    });

    const parse = schema.safeParse(request.body || {});
    if (!parse.success) {
      return reply.status(400).send({ success: false, errors: parse.error.format() });
    }

    const data = parse.data;
    const updateOptions = {
      branch: data.branch || "main",
      createBackup: data.createBackup ?? data.createBackupBefore ?? true,
      runMigrations: data.runMigrations ?? data.runMigration ?? true,
      rebuild: data.rebuild ?? data.runBuild ?? true,
    };

    try {
      const result = await executeSystemUpdate(updateOptions);

      // Enviamos primero la respuesta JSON completa para que el cliente reciba HTTP 200 y todos los logs
      await reply.send(result);

      // Programamos la recarga en caliente para Phusion Passenger (cPanel) y PM2 (VPS)
      // con 1.5s de retraso para garantizar que el socket HTTP envíe los datos sin cortes
      setTimeout(async () => {
        touchCpanelRestart();
        try {
          const { exec } = await import("child_process");
          exec("pm2 reload turbonetwork || pm2 reload all || pm2 restart turbonetwork", { cwd: process.cwd() });
        } catch (e) {}
      }, 1500);

      return;
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        message: err.message || "Error al ejecutar la actualización",
      });
    }
  });

  // 4. Historial de actualizaciones aplicadas
  fastify.get("/settings/system/updates-history", async (_request, reply) => {
    try {
      const history = getUpdatesHistory();
      return reply.send({ success: true, data: history });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message });
    }
  });

  // 5. Listar copias de seguridad disponibles
  fastify.get("/settings/backups", async (_request, reply) => {
    try {
      const backups = listBackups();
      return reply.send({ success: true, count: backups.length, data: backups });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message });
    }
  });

  // 6. Crear una nueva copia de seguridad inmediata
  fastify.post("/settings/backups/create", async (request, reply) => {
    const schema = z.object({
      notes: z.string().optional(),
      type: z.enum(["manual", "pre_update"]).default("manual").optional(),
    });

    const parse = schema.safeParse(request.body || {});
    const notes = parse.success ? parse.data.notes : "";
    const type = parse.success && parse.data.type ? parse.data.type : "manual";

    try {
      const backup = await createFullBackup(type, notes);
      return reply.send({
        success: true,
        message: "Copia de seguridad generada con éxito.",
        data: backup,
      });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message });
    }
  });

  // 7. Descargar una copia de seguridad específica
  fastify.get("/settings/backups/download/:fileName", async (request, reply) => {
    const { fileName } = request.params as { fileName: string };
    const safeName = path.basename(fileName);
    const filePath = path.join(BACKUPS_DIR, safeName);

    if (!fs.existsSync(filePath)) {
      return reply.status(404).send({ success: false, message: "Archivo de respaldo no encontrado" });
    }

    const stream = fs.createReadStream(filePath);
    reply.header("Content-Disposition", `attachment; filename="${safeName}"`);
    reply.header("Content-Type", "application/json");
    return reply.send(stream);
  });

  // 8. Restaurar el sistema desde una copia de seguridad existente
  fastify.post("/settings/backups/restore/:fileName", async (request, reply) => {
    const { fileName } = request.params as { fileName: string };
    try {
      const result = await restoreBackup(fileName);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message });
    }
  });

  // 9. Eliminar una copia de seguridad
  fastify.delete("/settings/backups/:fileName", async (request, reply) => {
    const { fileName } = request.params as { fileName: string };
    try {
      const deleted = deleteBackup(fileName);
      if (!deleted) {
        return reply.status(404).send({ success: false, message: "Copia de seguridad no encontrada" });
      }
      return reply.send({ success: true, message: "Copia de seguridad eliminada con éxito." });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message });
    }
  });

  // 10. Subir y registrar/restaurar una copia de seguridad externa (.json)
  fastify.post("/settings/backups/upload", async (request, reply) => {
    const schema = z.object({
      fileName: z.string().optional(),
      content: z.record(z.any()),
      restoreImmediately: z.boolean().default(false).optional(),
    });

    const parse = schema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        success: false,
        message: "El archivo de copia de seguridad no tiene formato JSON válido.",
      });
    }

    try {
      if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, "0");
      const defaultName = `backup_uploaded_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}.json`;
      const targetName = path.basename(parse.data.fileName || defaultName);
      const filePath = path.join(BACKUPS_DIR, targetName);

      fs.writeFileSync(filePath, JSON.stringify(parse.data.content, null, 2), "utf-8");

      let restoreMsg = "";
      if (parse.data.restoreImmediately) {
        const restoreRes = await restoreBackup(targetName);
        restoreMsg = ` y ${restoreRes.message}`;
      }

      return reply.send({
        success: true,
        message: `Copia de seguridad cargada con éxito${restoreMsg}.`,
        fileName: targetName,
      });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message });
    }
  });
};
