import fs from "fs";
import { FastifyInstance } from "fastify";
import { resolveTenantId } from "../tenants/tenants.service";
import { autodetectMailProvider } from "./mail.providers";
import {
  listAccessibleAccounts,
  testMailConnection,
  createMailAccount,
  updateMailAccount,
  deleteMailAccount,
  syncAccount,
  listMailFolders,
  listMailMessages,
  getMailMessageDetail,
  getMailAttachment,
  updateMailMessage,
  deleteMailMessage,
  sendMailMessage,
  mailEvents,
  getMailAccountAvatarFile,
  checkDomainDeliverability,
} from "./mail.service";

export async function mailRoutes(fastify: FastifyInstance) {
  // Autodetección de servidor IMAP/SMTP por correo
  fastify.get("/mail/accounts/autodetect", async (request, reply) => {
    const q = request.query as { email?: string };
    return reply.send(autodetectMailProvider(q?.email || ""));
  });

  // Diagnóstico DNS de entregabilidad (SPF / DKIM / DMARC)
  fastify.get("/mail/deliverability", async (request, reply) => {
    const q = request.query as { email?: string };
    const report = await checkDomainDeliverability(q?.email || "");
    return reply.send(report);
  });

  // Servir avatar personalizado de una cuenta de correo
  fastify.get("/mail/accounts/:id/avatar", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const file = await getMailAccountAvatarFile(tenantId, Number(id));
    if (!file) {
      return reply.status(404).send({ error: "Avatar no encontrado." });
    }
    reply.header("Content-Type", file.mimeType);
    reply.header("Cache-Control", "public, max-age=86400");
    return reply.send(fs.createReadStream(file.filePath));
  });

  // Listar cuentas accesibles del tenant
  fastify.get("/mail/accounts", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const user = request.authUser!;
    const accounts = await listAccessibleAccounts(tenantId, user);
    return reply.send({ accounts });
  });

  // Probar conexión IMAP + SMTP sin guardar
  fastify.post("/mail/accounts/test", async (request, reply) => {
    const body = (request.body || {}) as any;
    const email = String(body.email || "").trim().toLowerCase();
    const preset = autodetectMailProvider(email);
    const result = await testMailConnection({
      email,
      imapHost: String(body.imapHost || preset.imapHost).trim(),
      imapPort: Number(body.imapPort || preset.imapPort),
      imapSecure: body.imapSecure !== undefined ? Boolean(body.imapSecure) : preset.imapSecure,
      smtpHost: String(body.smtpHost || preset.smtpHost).trim(),
      smtpPort: Number(body.smtpPort || preset.smtpPort),
      smtpSecure: body.smtpSecure !== undefined ? Boolean(body.smtpSecure) : preset.smtpSecure,
      username: String(body.username || email).trim(),
      password: String(body.password || ""),
    });
    return reply.send(result);
  });

  // Crear nueva cuenta de correo en el tenant
  fastify.post("/mail/accounts", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const user = request.authUser!;
    try {
      const account = await createMailAccount(tenantId, user, request.body || {});
      return reply.status(201).send({ account });
    } catch (err: any) {
      return reply.status(err?.statusCode || 400).send({
        error: err?.message || "No se pudo crear la cuenta de correo.",
      });
    }
  });

  // Actualizar cuenta o firma HTML
  fastify.put("/mail/accounts/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const user = request.authUser!;
    const { id } = request.params as { id: string };
    try {
      const account = await updateMailAccount(tenantId, user, Number(id), request.body || {});
      return reply.send({ account });
    } catch (err: any) {
      return reply.status(err?.statusCode || 400).send({
        error: err?.message || "No se pudo actualizar la cuenta.",
      });
    }
  });

  // Eliminar cuenta de correo
  fastify.delete("/mail/accounts/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const user = request.authUser!;
    const { id } = request.params as { id: string };
    try {
      await deleteMailAccount(tenantId, user, Number(id));
      return reply.send({ ok: true });
    } catch (err: any) {
      return reply.status(err?.statusCode || 400).send({
        error: err?.message || "No se pudo eliminar la cuenta.",
      });
    }
  });

  // Forzar sincronización manual de una cuenta
  fastify.post("/mail/accounts/:id/sync", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const user = request.authUser!;
    const { id } = request.params as { id: string };
    const accounts = await listAccessibleAccounts(tenantId, user);
    if (!accounts.some((a) => a.id === Number(id))) {
      return reply.status(403).send({ error: "No tienes acceso a esta cuenta." });
    }
    try {
      const stats = await syncAccount(tenantId, Number(id));
      return reply.send({ ok: true, ...stats });
    } catch (err: any) {
      return reply.status(502).send({
        error: err?.responseText || err?.message || "Error al sincronizar con el servidor IMAP.",
      });
    }
  });

  // Carpetas del tenant / cuenta
  fastify.get("/mail/folders", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const user = request.authUser!;
    const q = request.query as { accountId?: string };
    const accountId = q?.accountId ? Number(q.accountId) : undefined;
    const folders = await listMailFolders(tenantId, user, accountId);
    return reply.send({ folders });
  });

  // Listado de correos
  fastify.get("/mail/messages", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const user = request.authUser!;
    const q = request.query as Record<string, string | undefined>;
    const result = await listMailMessages(tenantId, user, {
      accountId: q.accountId ? Number(q.accountId) : undefined,
      folderRole: q.folder || undefined,
      folderId: q.folderId ? Number(q.folderId) : undefined,
      q: q.q || undefined,
      unread: q.unread === "1" || q.unread === "true",
      starred: q.starred === "1" || q.starred === "true",
      limit: q.limit ? Number(q.limit) : 40,
      offset: q.offset ? Number(q.offset) : 0,
    });
    return reply.send(result);
  });

  // Detalle de un correo (con hilo y adjuntos)
  fastify.get("/mail/messages/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const user = request.authUser!;
    const { id } = request.params as { id: string };
    try {
      const detail = await getMailMessageDetail(tenantId, user, Number(id));
      return reply.send(detail);
    } catch (err: any) {
      return reply.status(err?.statusCode || 404).send({ error: err?.message || "Correo no encontrado." });
    }
  });

  // Descargar adjunto
  fastify.get("/mail/messages/:id/attachments/:aid", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const user = request.authUser!;
    const { id, aid } = request.params as { id: string; aid: string };
    try {
      const att = await getMailAttachment(tenantId, user, Number(id), Number(aid));
      reply.header("Content-Type", att.mime_type || "application/octet-stream");
      reply.header("Content-Disposition", `attachment; filename="${encodeURIComponent(att.filename)}"`);
      return reply.send(fs.createReadStream(att.storage_path));
    } catch (err: any) {
      return reply.status(err?.statusCode || 404).send({ error: err?.message || "Adjunto no encontrado." });
    }
  });

  // Actualizar flags o mover de carpeta (leído, destacado, spam, papelera, recibidos)
  fastify.patch("/mail/messages/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const user = request.authUser!;
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as any;
    try {
      const res = await updateMailMessage(tenantId, user, Number(id), {
        isRead: body.isRead,
        isStarred: body.isStarred,
        moveToRole: body.moveToRole,
      });
      return reply.send(res);
    } catch (err: any) {
      return reply.status(err?.statusCode || 400).send({ error: err?.message || "No se pudo actualizar." });
    }
  });

  // Enviar a papelera o eliminar definitivo
  fastify.delete("/mail/messages/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const user = request.authUser!;
    const { id } = request.params as { id: string };
    const q = request.query as { permanent?: string };
    try {
      const res = await deleteMailMessage(tenantId, user, Number(id), q?.permanent === "1" || q?.permanent === "true");
      return reply.send(res);
    } catch (err: any) {
      return reply.status(err?.statusCode || 400).send({ error: err?.message || "No se pudo eliminar." });
    }
  });

  // Enviar correo (nuevo, respuesta, reenvío, con firma y adjuntos)
  fastify.post("/mail/send", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const user = request.authUser!;
    try {
      const result = await sendMailMessage(tenantId, user, (request.body || {}) as any);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(err?.statusCode || 500).send({
        error: err?.message || "No se pudo enviar el correo.",
      });
    }
  });

  // Stream SSE de notificaciones en tiempo real por tenant
  fastify.get("/mail/events", (request, reply) => {
    const tenantId = resolveTenantId(request);
    reply.hijack();

    const headers: Record<string, string> = {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform, no-store, must-revalidate",
      "X-Accel-Buffering": "no",
    };
    if ((request.raw.httpVersion || "1.1").startsWith("1.")) {
      headers["Connection"] = "keep-alive";
    }

    try {
      reply.raw.writeHead(200, headers);
      reply.raw.flushHeaders?.();
      reply.raw.write("event: connected\ndata: {}\n\n");
    } catch {
      return;
    }

    const onUpdate = (ev: any) => {
      if (ev?.tenantId !== tenantId) return;
      try {
        if (!reply.raw.writableEnded) {
          reply.raw.write(`event: mail\ndata: ${JSON.stringify(ev)}\n\n`);
        }
      } catch {}
    };

    mailEvents.on("mail_update", onUpdate);
    const ping = setInterval(() => {
      try {
        if (!reply.raw.writableEnded) reply.raw.write(": ping\n\n");
      } catch {}
    }, 25000);

    request.raw.on("close", () => {
      clearInterval(ping);
      mailEvents.off("mail_update", onUpdate);
    });
  });
}
