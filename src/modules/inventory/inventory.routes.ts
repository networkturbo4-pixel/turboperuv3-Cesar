import fs from "fs";
import path from "path";
import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { resolveTenantId } from "../tenants/tenants.service";
import {
  getInventoryProducts,
  getProductById,
  createProduct,
  updateProduct,
  softDeleteProduct,
  bulkSoftDeleteProducts,
  bulkUpdateProductCategory,
  getTrashProducts,
  restoreProduct,
  permanentDeleteProduct,
  emptyTrash,
  markBarcodesPrinted,
  adjustStock,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  loadAssets,
  getAssets,
  getAssetById,
  createAsset,
  updateAsset,
  deleteAsset,
  addAssetMaintenance,
  addAssetEvent,
  addAssetAssignment,
  getNodeStock,
  assignStockToNode,
  returnStockFromNode,
  getVehicleChecklist,
  updateVehicleChecklist,
  addVehicleChecklistItem,
  removeVehicleChecklistItem,
  getProductTraceability,
  createPurchase,
  createClientInstallation,
  createPersonnelAssignment,
  createPersonnelAssignmentsBatch,
  returnPersonnelAssignment,
  transferPersonnelAssignment,
  getPersonnelAssignments,
  getInventoryMetrics,
  loadMovements,
} from "./inventory.service";

const variantSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "El nombre de la variante es requerido"),
  sku: z.string().min(1, "El SKU de la variante es requerido"),
  quantity: z.number().min(0).default(0),
  costPrice: z.number().min(0).optional(),
  salePrice: z.number().min(0).optional(),
});

const itemUnitSchema = z.object({
  id: z.string(),
  itemNumber: z.number(),
  sku: z.string(),
  barcode: z.string().optional().nullable(),
  status: z.enum(["disponible", "asignado", "en_uso", "baja"]).default("disponible"),
  assignedTo: z.string().optional().nullable(),
  assignedAt: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  createdAt: z.string().optional().nullable(),
  expirationDate: z.string().optional().nullable(),
  manufactureDate: z.string().optional().nullable(),
  conditionStatus: z.enum(["optimo", "bueno", "regular", "requiere_cambio", "baja"]).optional().nullable(),
  lastInspectionDate: z.string().optional().nullable(),
  nextInspectionDate: z.string().optional().nullable(),
});

const productSchema = z.object({
  type: z.enum(["simple", "bulk", "epp"]),
  name: z.string().min(1, "El nombre del producto es requerido"),
  alternativeNames: z.array(z.string()).default([]),
  categoryId: z.string().min(1, "La categoría es requerida"),
  sku: z.string().min(1, "El SKU es requerido"),
  barcode: z.string().optional().nullable(),
  batchNumber: z.string().optional().nullable(),
  entryDate: z.string().optional().nullable(),
  baseCost: z.number().min(0, "El costo base no puede ser negativo"),
  salePrice: z.number().min(0).optional().nullable(),
  stock: z.number().min(0).default(0),
  stockMin: z.number().min(0).default(5),
  stockCritical: z.number().min(0).default(2),
  images: z.array(z.string()).default([]),
  description: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  // Específico para bulk
  unitOfMeasure: z.string().optional().nullable(),
  unitSku: z.string().optional().nullable(),
  allowDecimals: z.boolean().optional().nullable(),
  // Específico para EPP
  hasDifferentCostPerVariant: z.boolean().optional().nullable(),
  variants: z.array(variantSchema).optional().nullable(),
  // Control de Caducidad y Vida Útil
  hasLifespanControl: z.boolean().optional().nullable(),
  lifespanType: z.enum(["expiration_date", "lifespan", "both", "none"]).optional().nullable(),
  expirationDate: z.string().optional().nullable(),
  lifespanValue: z.number().min(0).optional().nullable(),
  lifespanUnit: z.enum(["dias", "meses", "anios", "horas"]).optional().nullable(),
  alertBeforeDays: z.number().min(0).optional().nullable(),
  requiresInspection: z.boolean().optional().nullable(),
  inspectionFrequencyDays: z.number().min(0).optional().nullable(),
  replacementCriteria: z.string().optional().nullable(),
  // Unidades individuales
  itemUnits: z.array(itemUnitSchema).optional().nullable(),
});

export const inventoryRoutes: FastifyPluginAsync = async (fastify) => {
  // ========================================================
  // 1. PRODUCTOS (CATÁLOGO ACTIVO)
  // ========================================================
  fastify.get("/inventory/products", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const query = request.query as {
      type?: string;
      categoryId?: string;
      search?: string;
      status?: string;
      includeDeleted?: string;
    };
    const products = getInventoryProducts(tenantId, {
      ...query,
      includeDeleted: query.includeDeleted === "true",
    });
    return { success: true, count: products.length, data: products };
  });

  fastify.get("/inventory/products/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      return reply.status(400).send({ success: false, message: "ID inválido" });
    }
    const product = getProductById(tenantId, numId);
    if (!product) {
      return reply.status(404).send({ success: false, message: "Producto no encontrado" });
    }
    return { success: true, data: product };
  });

  fastify.post("/inventory/products", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const parse = productSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        success: false,
        message: "Datos de producto inválidos",
        errors: parse.error.format(),
      });
    }

    try {
      const created = createProduct(tenantId, parse.data as any);
      return reply.status(201).send({
        success: true,
        message: "Producto registrado exitosamente en el inventario",
        data: created,
      });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message || "Error al registrar producto" });
    }
  });

  fastify.put("/inventory/products/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      return reply.status(400).send({ success: false, message: "ID inválido" });
    }

    const partialSchema = productSchema.partial();
    const parse = partialSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        success: false,
        message: "Datos de actualización inválidos",
        errors: parse.error.format(),
      });
    }

    const updated = updateProduct(tenantId, numId, parse.data as any);
    if (!updated) {
      return reply.status(404).send({ success: false, message: "Producto no encontrado" });
    }

    return {
      success: true,
      message: "Producto actualizado correctamente",
      data: updated,
    };
  });

  // GESTIÓN DE UNIDADES INDIVIDUALES Y SKUS POR ÍTEM
  fastify.get("/inventory/products/:id/units", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      return reply.status(400).send({ success: false, message: "ID inválido" });
    }
    const product = getProductById(tenantId, numId);
    if (!product) {
      return reply.status(404).send({ success: false, message: "Producto no encontrado" });
    }
    return { success: true, count: (product.itemUnits || []).length, data: product.itemUnits || [] };
  });

  fastify.put("/inventory/products/:id/units", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      return reply.status(400).send({ success: false, message: "ID inválido" });
    }
    const body = request.body as { units?: any[] };
    if (!body || !Array.isArray(body.units)) {
      return reply.status(400).send({ success: false, message: "Lista de unidades requerida" });
    }
    const updated = updateProduct(tenantId, numId, { itemUnits: body.units });
    if (!updated) {
      return reply.status(404).send({ success: false, message: "Producto no encontrado" });
    }
    return {
      success: true,
      message: "Unidades individuales y SKUs actualizados correctamente",
      data: updated.itemUnits || [],
    };
  });

  // Soft-delete a la papelera (máximo 60 días)
  fastify.delete("/inventory/products/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      return reply.status(400).send({ success: false, message: "ID inválido" });
    }

    const moved = softDeleteProduct(tenantId, numId);
    if (!moved) {
      return reply.status(404).send({ success: false, message: "Producto no encontrado" });
    }

    return { success: true, message: "Producto enviado a la papelera de reciclaje (máx. 60 días)" };
  });

  // Marcación de códigos de barras impresos (a nivel producto y unidad)
  fastify.post("/inventory/products/mark-barcodes-printed", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const schema = z.object({
      productIds: z.array(z.number()),
      unitSkus: z.record(z.string(), z.array(z.string())).optional(),
      printed: z.boolean().optional(),
    });
    const parse = schema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, message: "Parámetros inválidos" });
    }
    const formattedUnitSkus: Record<number, string[]> = {};
    if (parse.data.unitSkus) {
      for (const [k, v] of Object.entries(parse.data.unitSkus)) {
        const pId = parseInt(k, 10);
        if (!isNaN(pId)) formattedUnitSkus[pId] = v;
      }
    }
    const result = markBarcodesPrinted(
      tenantId,
      parse.data.productIds,
      Object.keys(formattedUnitSkus).length > 0 ? formattedUnitSkus : undefined,
      parse.data.printed !== undefined ? parse.data.printed : true
    );
    return { success: true, message: "Marcación actualizada correctamente", ...result };
  });

  // Eliminación masiva hacia la papelera
  fastify.post("/inventory/products/bulk-delete", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const schema = z.object({
      productIds: z.array(z.number()).min(1, "Debe enviar al menos un ID"),
    });
    const parse = schema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, message: "Lista de IDs inválida" });
    }
    const result = bulkSoftDeleteProducts(tenantId, parse.data.productIds);
    return {
      success: true,
      message: `${result.successCount} producto(s) enviado(s) a la papelera`,
      ...result,
    };
  });

  // Asignación masiva de categoría
  fastify.post("/inventory/products/bulk-category", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const schema = z.object({
      productIds: z.array(z.number()).min(1, "Debe enviar al menos un ID"),
      categoryId: z.string().min(1, "La categoría es requerida"),
    });
    const parse = schema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, message: "Datos de solicitud inválidos" });
    }
    const result = bulkUpdateProductCategory(tenantId, parse.data.productIds, parse.data.categoryId);
    return {
      success: true,
      message: `${result.successCount} producto(s) asignado(s) a la categoría`,
      ...result,
    };
  });

  // ========================================================
  // 2. PAPELERA DE RECICLAJE (HASTA 60 DÍAS)
  // ========================================================
  fastify.get("/inventory/trash", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const trash = getTrashProducts(tenantId);
    return { success: true, count: trash.length, data: trash };
  });

  fastify.post("/inventory/trash/:id/restore", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      return reply.status(400).send({ success: false, message: "ID inválido" });
    }
    const restored = restoreProduct(tenantId, numId);
    if (!restored) {
      return reply.status(404).send({ success: false, message: "Producto no encontrado en papelera" });
    }
    return { success: true, message: "Producto restaurado al catálogo activo" };
  });

  fastify.delete("/inventory/trash/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      return reply.status(400).send({ success: false, message: "ID inválido" });
    }
    const deleted = permanentDeleteProduct(tenantId, numId);
    if (!deleted) {
      return reply.status(404).send({ success: false, message: "Producto no encontrado" });
    }
    return { success: true, message: "Producto eliminado definitivamente del sistema" };
  });

  fastify.post("/inventory/trash/empty", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const count = emptyTrash(tenantId);
    return { success: true, message: `Papelera vaciada (${count} productos eliminados definitivamente)` };
  });

  // ========================================================
  // 3. AJUSTE DE STOCK & KARDEX RÁPIDO
  // ========================================================
  fastify.post("/inventory/products/:id/adjust-stock", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      return reply.status(400).send({ success: false, message: "ID inválido" });
    }

    const schema = z.object({
      type: z.enum(["in", "out", "adjustment"]),
      quantity: z.number().min(0, "La cantidad no puede ser negativa"),
      variantId: z.string().optional(),
      reason: z.string().min(1, "El motivo es requerido"),
      operatorName: z.string().optional(),
      technicianName: z.string().optional(),
      selectedUnitSkus: z.array(z.string()).optional(),
    });

    const parse = schema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        success: false,
        message: "Datos de movimiento inválidos",
        errors: parse.error.format(),
      });
    }

    const updated = adjustStock(tenantId, numId, parse.data);
    if (!updated) {
      return reply.status(404).send({ success: false, message: "Producto no encontrado" });
    }

    return {
      success: true,
      message: "Movimiento de stock registrado exitosamente",
      data: updated,
      unitsAffected: (updated as any).lastUnitsAffected || [],
    };
  });

  // ========================================================
  // 4. CATEGORÍAS
  // ========================================================
  fastify.get("/inventory/categories", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const categories = getCategories(tenantId);
    return { success: true, count: categories.length, data: categories };
  });

  fastify.post("/inventory/categories", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const schema = z.object({
      name: z.string().min(1, "El nombre de la categoría es requerido"),
      description: z.string().optional(),
      color: z.string().optional(),
    });

    const parse = schema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, errors: parse.error.format() });
    }

    const created = createCategory(tenantId, parse.data);
    return reply.status(201).send({
      success: true,
      message: "Categoría creada exitosamente",
      data: created,
    });
  });

  fastify.put("/inventory/categories/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const schema = z.object({
      name: z.string().optional(),
      description: z.string().optional(),
      color: z.string().optional(),
    });

    const parse = schema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, errors: parse.error.format() });
    }

    const updated = updateCategory(tenantId, id, parse.data);
    if (!updated) {
      return reply.status(404).send({ success: false, message: "Categoría no encontrada" });
    }

    return { success: true, message: "Categoría actualizada", data: updated };
  });

  fastify.delete("/inventory/categories/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const result = deleteCategory(tenantId, id);
    if (!result.success) {
      return reply.status(400).send(result);
    }
    return { success: true, message: "Categoría eliminada" };
  });

  // ========================================================
  // 5. ACTIVOS FIJOS (VEHÍCULO, TECNOLOGÍA, MOBILIARIO)
  // ========================================================
  fastify.get("/inventory/assets", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const query = request.query as { category?: string };
    const assets = getAssets(tenantId, query.category as any);
    return { success: true, count: assets.length, data: assets };
  });

  fastify.get("/inventory/assets/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      return reply.status(400).send({ success: false, message: "ID inválido" });
    }
    const asset = getAssetById(tenantId, numId);
    if (!asset) {
      return reply.status(404).send({ success: false, message: "Activo fijo no encontrado" });
    }
    return { success: true, data: asset };
  });

  // ----------------------------------------------------
  // SUBIDA UNIFICADA DE ARCHIVOS MULTIMEDIA (FOTOS / VIDEOS)
  // ----------------------------------------------------
  fastify.post("/inventory/assets/upload-media", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const body = request.body as { dataUrl?: string; base64?: string; fileName?: string; mimeType?: string };
    if (!body || (!body.dataUrl && !body.base64)) {
      return reply.status(400).send({ success: false, message: "Contenido multimedia no proporcionado" });
    }

    const raw = body.dataUrl || body.base64 || "";
    let base64Data = raw;
    let mimeType = body.mimeType || "application/octet-stream";
    let ext = ".jpg";

    const matches = raw.match(/^data:([A-Za-z0-9\-+\/.]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      mimeType = matches[1].toLowerCase();
      base64Data = matches[2];
    }

    if (mimeType.includes("jpeg") || mimeType.includes("jpg")) ext = ".jpg";
    else if (mimeType.includes("png")) ext = ".png";
    else if (mimeType.includes("webp")) ext = ".webp";
    else if (mimeType.includes("gif")) ext = ".gif";
    else if (mimeType.includes("svg")) ext = ".svg";
    else if (mimeType.includes("bmp")) ext = ".bmp";
    else if (mimeType.includes("avif")) ext = ".avif";
    else if (mimeType.includes("mp4")) ext = ".mp4";
    else if (mimeType.includes("webm")) ext = ".webm";
    else if (mimeType.includes("ogg")) ext = ".ogg";
    else if (mimeType.includes("quicktime") || mimeType.includes("mov")) ext = ".mov";
    else if (mimeType.includes("x-matroska") || mimeType.includes("mkv")) ext = ".mkv";
    else if (mimeType.includes("avi")) ext = ".avi";

    if (body.fileName && body.fileName.includes(".")) {
      const origParts = body.fileName.split(".");
      const origExt = origParts[origParts.length - 1].toLowerCase();
      if (/^[a-z0-9]{2,5}$/.test(origExt)) {
        ext = `.${origExt}`;
      }
    }

    const uploadDir = path.resolve(process.cwd(), "public", "uploads", "assets");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const safeBase = (body.fileName || "media")
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9_\-]/g, "_")
      .slice(0, 35);
    const fileName = `${Date.now()}_${safeBase}${ext}`;
    const targetFile = path.join(uploadDir, fileName);

    const buffer = Buffer.from(base64Data, "base64");
    fs.writeFileSync(targetFile, buffer);

    const isVideo = mimeType.startsWith("video/") || [".mp4", ".webm", ".ogg", ".mov", ".mkv", ".avi"].includes(ext);

    return reply.send({
      success: true,
      url: `/uploads/assets/${fileName}`,
      fileName: body.fileName || fileName,
      mimeType,
      isVideo,
      size: buffer.length
    });
  });

  fastify.post("/inventory/assets", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const schema = z.object({
      code: z.string().optional().nullable().transform((val) => (val && val.trim()) ? val.trim() : ""),
      name: z.string().min(1, "El nombre del activo es requerido"),
      category: z.enum(["vehiculo", "tecnologia", "mobiliario", "nodo"]),
      brand: z.string().optional().nullable(),
      model: z.string().optional().nullable(),
      serialNumber: z.string().optional().nullable(),
      plateNumber: z.string().optional().nullable(),
      location: z.string().optional().nullable(),
      assignedTo: z.string().optional().nullable(),
      acquisitionDate: z.string().optional().nullable().transform((val) => (val && val.trim()) ? val.trim() : new Date().toISOString().split("T")[0]),
      acquisitionCost: z.union([z.number(), z.string()]).optional().nullable().transform((v) => {
        if (v === null || v === undefined || v === "") return 0;
        const n = Number(v);
        return isNaN(n) || n < 0 ? 0 : n;
      }),
      status: z.enum(["operativo", "mantenimiento", "baja", "en_reserva"]).default("operativo"),
      description: z.string().optional().nullable(),
      photos: z.array(z.string()).default([]),
      videos: z.array(z.string()).default([]),
      vehicleDocs: z.object({
        tiv: z.object({
          number: z.string().optional().nullable(),
          plateNumber: z.string().optional().nullable(),
          vin: z.string().optional().nullable(),
          engineNumber: z.string().optional().nullable(),
          color: z.string().optional().nullable(),
          fuelType: z.string().optional().nullable(),
          year: z.union([z.string(), z.number()]).optional().nullable(),
          ownerName: z.string().optional().nullable(),
          registrationOffice: z.string().optional().nullable(),
          documentUrl: z.string().optional().nullable(),
        }).optional().nullable(),
        soat: z.object({
          policyNumber: z.string().optional().nullable(),
          insurer: z.string().optional().nullable(),
          startDate: z.string().optional().nullable(),
          endDate: z.string().optional().nullable(),
          certificateType: z.enum(["electronico", "fisico"]).optional().nullable(),
          status: z.enum(["vigente", "por_vencer", "vencido"]).optional().nullable(),
          documentUrl: z.string().optional().nullable(),
        }).optional().nullable(),
        citv: z.object({
          certificateNumber: z.string().optional().nullable(),
          inspectionCenter: z.string().optional().nullable(),
          issueDate: z.string().optional().nullable(),
          expirationDate: z.string().optional().nullable(),
          result: z.enum(["aprobado", "desaprobado", "no_aplica"]).optional().nullable(),
          mileageAtInspection: z.union([z.string(), z.number()]).optional().nullable(),
          documentUrl: z.string().optional().nullable(),
        }).optional().nullable(),
      }).optional().nullable(),
      nodeDetails: z.object({
        address: z.string().optional().nullable(),
        reference: z.string().optional().nullable(),
        latitude: z.union([z.string(), z.number()]).optional().nullable(),
        longitude: z.union([z.string(), z.number()]).optional().nullable(),
        propertyType: z.enum(["alquilado", "propio", "comodato"]).optional().nullable(),
        landlordName: z.string().optional().nullable(),
        landlordPhone: z.string().optional().nullable(),
        rentalCost: z.union([z.string(), z.number()]).optional().nullable(),
        paymentDay: z.union([z.string(), z.number()]).optional().nullable(),
        powerType: z.string().optional().nullable(),
        powerMeterNumber: z.string().optional().nullable(),
        upsModel: z.string().optional().nullable(),
        generator: z.string().optional().nullable(),
        powerAutonomyHours: z.union([z.string(), z.number()]).optional().nullable(),
        airConditioning: z.string().optional().nullable(),
        racksCount: z.union([z.string(), z.number()]).optional().nullable(),
        serversCount: z.union([z.string(), z.number()]).optional().nullable(),
        ipSubnet: z.string().optional().nullable(),
        uplinkProvider: z.string().optional().nullable(),
        keyHolder: z.string().optional().nullable(),
        cctvCameras: z.string().optional().nullable(),
      }).optional().nullable(),
      techDetails: z.object({
        techCategory: z.string().optional().nullable(),
        deviceType: z.string().optional().nullable(),
        specifications: z.string().optional().nullable(),
        powerSource: z.string().optional().nullable(),
        processor: z.string().optional().nullable(),
        ram: z.string().optional().nullable(),
        storage: z.string().optional().nullable(),
        macAddress: z.string().optional().nullable(),
        managementIp: z.string().optional().nullable(),
        osVersion: z.string().optional().nullable(),
        portsCount: z.string().optional().nullable(),
        wavelength: z.string().optional().nullable(),
        calibrationDate: z.string().optional().nullable(),
        calibrationExpiry: z.string().optional().nullable(),
        calibrationCertNumber: z.string().optional().nullable(),
        powerRating: z.string().optional().nullable(),
        lifespanNotes: z.string().optional().nullable(),
        warrantyExpiry: z.string().optional().nullable(),
        accessories: z.string().optional().nullable(),
      }).optional().nullable(),
      furnitureDetails: z.object({
        furnitureType: z.string().optional().nullable(),
        rackUnits: z.union([z.string(), z.number()]).optional().nullable(),
        dimensions: z.string().optional().nullable(),
        material: z.string().optional().nullable(),
        weightCapacityKg: z.union([z.string(), z.number()]).optional().nullable(),
        floorLocation: z.string().optional().nullable(),
      }).optional().nullable(),
    });

    const parse = schema.safeParse(request.body);
    if (!parse.success) {
      const errorMsg = parse.error.errors.map((e) => `${e.path.join(".") || "campo"}: ${e.message}`).join(", ");
      return reply.status(400).send({
        success: false,
        message: errorMsg || "Datos de activo inválidos",
        errors: parse.error.format(),
      });
    }

    try {
      const created = createAsset(tenantId, parse.data as any);
      return reply.status(201).send({
        success: true,
        message: "Activo fijo registrado con éxito",
        data: created,
      });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message || "Error al registrar activo fijo" });
    }
  });

  fastify.put("/inventory/assets/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      return reply.status(400).send({ success: false, message: "ID inválido" });
    }

    const updated = updateAsset(tenantId, numId, request.body as any);
    if (!updated) {
      return reply.status(404).send({ success: false, message: "Activo no encontrado" });
    }

    return { success: true, message: "Activo actualizado", data: updated };
  });

  fastify.delete("/inventory/assets/:id", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      return reply.status(400).send({ success: false, message: "ID inválido" });
    }

    const deleted = deleteAsset(tenantId, numId);
    if (!deleted) {
      return reply.status(404).send({ success: false, message: "Activo no encontrado" });
    }

    return { success: true, message: "Activo eliminado" };
  });

  fastify.post("/inventory/assets/:id/maintenance", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      return reply.status(400).send({ success: false, message: "ID inválido" });
    }

    const schema = z.object({
      type: z.enum(["preventivo", "correctivo", "calibracion"]),
      title: z.string().min(1, "El título es requerido"),
      description: z.string().min(1, "La descripción del mantenimiento es requerida"),
      cost: z.number().min(0).default(0),
      technician: z.string().min(1, "El técnico o taller es requerido"),
      date: z.string().min(1, "La fecha es requerida"),
      photos: z.array(z.string()).default([]),
      videos: z.array(z.string()).default([]),
    });

    const parse = schema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, errors: parse.error.format() });
    }

    const record = addAssetMaintenance(tenantId, numId, parse.data);
    if (!record) {
      return reply.status(404).send({ success: false, message: "Activo no encontrado" });
    }

    return reply.status(201).send({
      success: true,
      message: "Mantenimiento registrado y documentado en el historial",
      data: record,
    });
  });

  fastify.post("/inventory/assets/:id/events", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      return reply.status(400).send({ success: false, message: "ID inválido" });
    }

    const schema = z.object({
      type: z.enum(["creacion", "asignacion", "mantenimiento", "traslado", "inspeccion", "baja"]),
      title: z.string().min(1, "El título del evento es requerido"),
      description: z.string().min(1, "La descripción es requerida"),
      operator: z.string().default("Admin"),
      date: z.string().default(new Date().toISOString()),
      photos: z.array(z.string()).optional(),
      videos: z.array(z.string()).optional(),
    });

    const parse = schema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, errors: parse.error.format() });
    }

    const event = addAssetEvent(tenantId, numId, parse.data);
    if (!event) {
      return reply.status(404).send({ success: false, message: "Activo no encontrado" });
    }

    return reply.status(201).send({ success: true, message: "Evento registrado en historial", data: event });
  });

  fastify.post("/inventory/assets/:id/assignments", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      return reply.status(400).send({ success: false, message: "ID inválido" });
    }

    const schema = z.object({
      assignedTo: z.string().min(1, "El nuevo responsable o cuadrilla es requerido"),
      previousAssignedTo: z.string().optional(),
      assignedDate: z.string().min(1, "La fecha de asignación es requerida"),
      assignedTime: z.string().optional(),
      location: z.string().optional(),
      purpose: z.string().optional(),
      condition: z.string().optional(),
      assignedBy: z.string().optional(),
      documentUrl: z.string().optional(),
      notes: z.string().optional(),
    });

    const parse = schema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, errors: parse.error.format() });
    }

    const assignment = addAssetAssignment(tenantId, numId, parse.data);
    if (!assignment) {
      return reply.status(404).send({ success: false, message: "Activo no encontrado" });
    }

    return reply.status(201).send({
      success: true,
      message: "Asignación registrada exitosamente en el historial",
      data: assignment,
    });
  });

  // ========================================================
  // ----------------------------------------------------
  // GESTIÓN DE EQUIPOS Y STOCK ASIGNADO A NODOS POP
  // ----------------------------------------------------
  fastify.get("/inventory/assets/:id/node-stock", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      return reply.status(400).send({ success: false, message: "ID inválido" });
    }
    const items = getNodeStock(tenantId, numId);
    return { success: true, count: items.length, data: items };
  });

  fastify.post("/inventory/assets/:id/node-stock", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      return reply.status(400).send({ success: false, message: "ID inválido" });
    }

    const schema = z.object({
      productId: z.number().min(1, "El producto es requerido"),
      quantity: z.number().min(1, "La cantidad mínima es 1"),
      rackLocation: z.string().optional().nullable(),
      serialNumber: z.string().optional().nullable(),
      itemUnitId: z.string().optional().nullable(),
      assignedBy: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    });

    const parse = schema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, errors: parse.error.format() });
    }

    const result = assignStockToNode(tenantId, numId, parse.data as any);
    if (!result.success) {
      return reply.status(400).send(result);
    }
    return reply.status(201).send(result);
  });

  fastify.post("/inventory/assets/:id/node-stock/:stockId/return", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id, stockId } = request.params as { id: string; stockId: string };
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      return reply.status(400).send({ success: false, message: "ID inválido" });
    }

    const body = (request.body || {}) as { returnedBy?: string; notes?: string };
    const result = returnStockFromNode(tenantId, numId, stockId, body);
    if (!result.success) {
      return reply.status(400).send(result);
    }
    return reply.send(result);
  });

  // 6. HISTORIAL & TRAZABILIDAD 360° (ESCÁNER, COMPRAS, CLIENTES, EPP)
  // ========================================================
  // ----------------------------------------------------
  // GESTIÓN DE CHECKLIST DE IMPLEMENTOS DE VEHÍCULOS
  // ----------------------------------------------------
  fastify.get("/inventory/assets/:id/checklist", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      return reply.status(400).send({ success: false, message: "ID inválido" });
    }
    const checklist = getVehicleChecklist(tenantId, numId);
    return { success: true, count: checklist.length, data: checklist };
  });

  fastify.put("/inventory/assets/:id/checklist", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      return reply.status(400).send({ success: false, message: "ID inválido" });
    }
    const { items } = request.body as { items: any[] };
    if (!Array.isArray(items)) {
      return reply.status(400).send({ success: false, message: "Formato inválido de checklist" });
    }
    const updated = updateVehicleChecklist(tenantId, numId, items);
    return { success: true, message: "Checklist actualizado exitosamente", data: updated };
  });

  fastify.post("/inventory/assets/:id/checklist/item", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      return reply.status(400).send({ success: false, message: "ID inválido" });
    }
    const itemData = request.body as any;
    if (!itemData || !itemData.name) {
      return reply.status(400).send({ success: false, message: "El nombre del implemento es requerido" });
    }
    const updated = addVehicleChecklistItem(tenantId, numId, itemData);
    return { success: true, message: "Implemento agregado al vehículo", data: updated };
  });

  fastify.delete("/inventory/assets/:id/checklist/item/:itemId", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id, itemId } = request.params as { id: string; itemId: string };
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      return reply.status(400).send({ success: false, message: "ID inválido" });
    }
    const updated = removeVehicleChecklistItem(tenantId, numId, itemId);
    return { success: true, message: "Implemento eliminado del vehículo", data: updated };
  });

  fastify.get("/inventory/traceability/:query", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { query } = request.params as { query: string };
    const summary = getProductTraceability(tenantId, query);
    if (!summary) {
      return reply.status(404).send({ success: false, message: "No se encontró ningún producto con ese SKU o Código de Barras" });
    }
    return { success: true, data: summary };
  });

  fastify.post("/inventory/purchases", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const schema = z.object({
      productId: z.number().int().positive(),
      supplier: z.string().min(1, "El proveedor es requerido"),
      invoiceNumber: z.string().min(1, "El número de factura es requerido"),
      date: z.string().optional(),
      purchaseDate: z.string().optional(),
      quantity: z.number().positive("La cantidad debe ser mayor a 0"),
      unitCost: z.number().min(0, "El costo unitario no puede ser negativo"),
      notes: z.string().optional(),
    });

    const parse = schema.safeParse(request.body);
    if (!parse.success) {
      const errMsgs = Object.values(parse.error.flatten().fieldErrors).flat().join(", ");
      return reply.status(400).send({
        success: false,
        message: errMsgs || "Datos de compra inválidos",
        errors: parse.error.format()
      });
    }

    const purchaseDate = parse.data.purchaseDate || parse.data.date || new Date().toISOString().split("T")[0];
    const purchase = createPurchase(tenantId, {
      ...parse.data,
      date: purchaseDate,
      purchaseDate,
      totalCost: parse.data.quantity * parse.data.unitCost,
    } as any);
    return reply.status(201).send({
      success: true,
      message: "Compra registrada e ingresada al Kardex de almacén",
      data: purchase,
    });
  });

  fastify.post("/inventory/client-installations", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const schema = z.object({
      productId: z.number().int().positive(),
      customerId: z.union([z.number(), z.string()]).optional(),
      customerName: z.string().optional(),
      clientName: z.string().optional(),
      contractNumber: z.string().optional(),
      address: z.string().optional(),
      assignedIp: z.string().optional(),
      serialOrMac: z.string().optional(),
      installedAt: z.string().optional(),
      technicianName: z.string().optional(),
      technician: z.string().optional(),
      quantity: z.number().positive().default(1),
      notes: z.string().optional(),
    });

    const parse = schema.safeParse(request.body);
    if (!parse.success) {
      const errMsgs = Object.values(parse.error.flatten().fieldErrors).flat().join(", ");
      return reply.status(400).send({
        success: false,
        message: errMsgs || "Datos de instalación inválidos",
        errors: parse.error.format()
      });
    }

    const clientName = parse.data.clientName || parse.data.customerName || "Cliente";
    const technicianName = parse.data.technician || parse.data.technicianName || "Técnico General";
    const inst = createClientInstallation(tenantId, {
      ...parse.data,
      customerId: parse.data.customerId || parse.data.contractNumber || ("CLI-" + Date.now()),
      customerName: clientName,
      clientName,
      contractNumber: parse.data.contractNumber || "",
      serialOrMac: parse.data.serialOrMac,
      technicianName,
      technician: technicianName,
      installedAt: parse.data.installedAt || new Date().toISOString(),
    } as any);
    return reply.status(201).send({
      success: true,
      message: "Instalación en cliente registrada y descontada del almacén",
      data: inst,
    });
  });

  fastify.get("/inventory/personnel-assignments", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const query = request.query as { employeeId?: string; status?: string };
    const assignments = getPersonnelAssignments(tenantId, query);
    return { success: true, count: assignments.length, data: assignments };
  });

  fastify.post("/inventory/personnel-assignments", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const schema = z.object({
      productId: z.number().int().positive(),
      productName: z.string().optional(),
      productSku: z.string().optional(),
      productImage: z.string().optional(),
      employeeId: z.union([z.number(), z.string()]),
      employeeName: z.string().optional(),
      personnelName: z.string().optional(),
      assignedAt: z.string().default(new Date().toISOString()),
      quantity: z.number().positive().default(1),
      status: z.enum(["entregado", "devuelto", "en_uso", "baja"]).default("en_uso"),
      variantName: z.string().optional(),
      notes: z.string().optional(),
      unitSku: z.string().optional(),
      itemUnitId: z.string().optional(),
      unitNumber: z.number().optional(),
    });

    const parse = schema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, errors: parse.error.format() });
    }

    const payload = {
      ...parse.data,
      employeeName: parse.data.employeeName || parse.data.personnelName || "Colaborador",
      personnelName: parse.data.personnelName || parse.data.employeeName || "Colaborador",
    };

    const assignment = createPersonnelAssignment(tenantId, payload);
    return reply.status(201).send({
      success: true,
      message: "Material/EPP asignado a personal y registrado en almacén",
      data: assignment,
    });
  });

  fastify.post("/inventory/personnel-assignments/batch", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const itemSchema = z.object({
      productId: z.number().int().positive(),
      productName: z.string().optional(),
      productSku: z.string().optional(),
      productImage: z.string().optional(),
      quantity: z.number().positive().default(1),
      status: z.enum(["entregado", "devuelto", "en_uso", "baja"]).default("en_uso"),
      variantName: z.string().optional(),
      notes: z.string().optional(),
      unitSku: z.string().optional(),
      itemUnitId: z.string().optional(),
      unitNumber: z.number().optional(),
    });

    const batchSchema = z.object({
      employeeId: z.union([z.number(), z.string()]),
      employeeName: z.string().optional(),
      personnelName: z.string().optional(),
      assignedAt: z.string().default(new Date().toISOString()),
      items: z.array(itemSchema).min(1, "Debe incluir al menos un material a despachar"),
    });

    const parse = batchSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, errors: parse.error.format() });
    }

    const employeeName = parse.data.employeeName || parse.data.personnelName || "Colaborador";
    const assignments = createPersonnelAssignmentsBatch(
      tenantId,
      parse.data.employeeId,
      employeeName,
      parse.data.items.map((it) => ({
        ...it,
        assignedAt: parse.data.assignedAt,
      }))
    );

    return reply.status(201).send({
      success: true,
      message: `¡Se asignaron exitosamente ${assignments.length} materiales a ${employeeName}!`,
      count: assignments.length,
      data: assignments,
    });
  });

  fastify.post("/inventory/personnel-assignments/:id/return", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const { notes, condition } = (request.body as { notes?: string; condition?: "buen_estado" | "danado" | "observacion" }) || {};

    const returned = returnPersonnelAssignment(tenantId, id, { notes, condition });
    if (!returned) {
      return reply.status(404).send({ success: false, message: "Asignación no encontrada o ya devuelta" });
    }

    return {
      success: true,
      message: "Material/EPP retornado e ingresado nuevamente al stock disponible",
      data: returned,
    };
  });

  fastify.post("/inventory/personnel-assignments/:id/transfer", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const { id } = request.params as { id: string };
    const schema = z.object({
      targetEmployeeId: z.union([z.number(), z.string()]),
      targetEmployeeName: z.string().min(1, "Nombre del técnico receptor requerido"),
      quantity: z.number().positive().optional(),
      notes: z.string().optional(),
    });

    const parse = schema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, errors: parse.error.format() });
    }

    const result = transferPersonnelAssignment(
      tenantId,
      id,
      parse.data.targetEmployeeId,
      parse.data.targetEmployeeName,
      {
        notes: parse.data.notes,
        quantity: parse.data.quantity,
      }
    );

    if (!result) {
      return reply.status(404).send({ success: false, message: "Asignación no encontrada o no disponible para transferir" });
    }

    return {
      success: true,
      message: `¡Material transferido exitosamente a ${parse.data.targetEmployeeName}!`,
      data: result,
    };
  });

  // ========================================================
  // 7. MÉTRICAS Y MOVIMIENTOS GENERALES
  // ========================================================
  fastify.get("/inventory/metrics", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const metrics = getInventoryMetrics(tenantId);
    return { success: true, data: metrics };
  });

  fastify.get("/inventory/movements", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const movements = loadMovements(tenantId);
    return { success: true, count: movements.length, data: movements };
  });
};
