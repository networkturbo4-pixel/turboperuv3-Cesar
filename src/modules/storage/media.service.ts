import crypto from "crypto";
import fs from "fs";
import path from "path";

const UPLOADS_AVATARS_DIR = path.resolve(process.cwd(), "data", "uploads", "avatars");

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const EXT_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export class MediaService {
  /**
   * Si el valor es un Data URI en Base64 de imagen, lo extrae a disco en data/uploads/avatars
   * y devuelve la ruta limpia (/api/media/avatars/<hash>.<ext>), reduciendo drásticamente el peso de los JSON.
   */
  public static externalizeAvatarIfNeeded(avatarValue?: string | null, prefix = "usr"): string {
    if (!avatarValue || typeof avatarValue !== "string") return "";
    const trimmed = avatarValue.trim();
    if (!trimmed.startsWith("data:image/")) return trimmed;

    // Ignorar SVGs diminutos inline (< 1 KB) como el avatar por defecto
    if (trimmed.startsWith("data:image/svg+xml") && trimmed.length < 1500) {
      return trimmed;
    }

    const match = trimmed.match(/^data:(image\/(?:jpeg|jpg|png|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/i);
    if (!match) return trimmed;

    const mime = match[1].toLowerCase();
    const ext = MIME_TO_EXT[mime] || "jpg";
    const base64Payload = match[2].replace(/\s+/g, "");

    try {
      const buffer = Buffer.from(base64Payload, "base64");
      if (buffer.length === 0 || buffer.length > 8 * 1024 * 1024) {
        return "";
      }
      if (!fs.existsSync(UPLOADS_AVATARS_DIR)) {
        fs.mkdirSync(UPLOADS_AVATARS_DIR, { recursive: true });
      }
      const digest = crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 20);
      const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 12) || "usr";
      const fileName = `${safePrefix}-${digest}.${ext}`;
      const fullPath = path.join(UPLOADS_AVATARS_DIR, fileName);

      if (!fs.existsSync(fullPath)) {
        fs.writeFileSync(fullPath, buffer);
      }

      return `/api/media/avatars/${fileName}`;
    } catch {
      return trimmed;
    }
  }

  public static resolveAvatarFile(fileName: string): { filePath: string; mimeType: string } | null {
    const cleanName = path.basename(fileName || "");
    if (!/^[a-zA-Z0-9._-]{5,80}$/.test(cleanName)) return null;
    const ext = path.extname(cleanName).toLowerCase();
    const mimeType = EXT_TO_MIME[ext];
    if (!mimeType) return null;

    const fullPath = path.join(UPLOADS_AVATARS_DIR, cleanName);
    if (!fullPath.startsWith(UPLOADS_AVATARS_DIR) || !fs.existsSync(fullPath)) {
      return null;
    }
    return { filePath: fullPath, mimeType };
  }
}
