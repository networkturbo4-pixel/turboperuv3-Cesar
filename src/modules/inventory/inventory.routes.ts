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
  getProductTraceability,
  createPurchase,
  createClientInstallation,
  createPersonnelAssignment,
  createPersonnelAssignmentsBatch,
  returnPersonnelAssignment,
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
  barcode: z.string().optional(),
  status: z.enum(["disponible", "asignado", "en_uso", "baja"]).default("disponible"),
  assignedTo: z.string().optional(),
  assignedAt: z.string().optional(),
  serialNumber: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.string().optional(),
});

const productSchema = z.object({
  type: z.enum(["simple", "bulk", "epp"]),
  name: z.string().min(1, "El nombre del producto es requerido"),
  alternativeNames: z.array(z.string()).default([]),
  categoryId: z.string().min(1, "La categoría es requerida"),
  sku: z.string().min(1, "El SKU es requerido"),
  barcode: z.string().optional(),
  batchNumber: z.string().optional(),
  entryDate: z.string().optional(),
  baseCost: z.number().min(0, "El costo base no puede ser negativo"),
  salePrice: z.number().min(0).optional(),
  stock: z.number().min(0).default(0),
  stockMin: z.number().min(0).default(5),
  stockCritical: z.number().min(0).default(2),
  images: z.array(z.string()).default([]),
  description: z.string().optional(),
  location: z.string().optional(),
  // Específico para bulk
  unitOfMeasure: z.string().optional(),
  unitSku: z.string().optional(),
  allowDecimals: z.boolean().optional(),
  // Específico para EPP
  hasDifferentCostPerVariant: z.boolean().optional(),
  variants: z.array(variantSchema).optional(),
  // Unidades individuales
  itemUnits: z.array(itemUnitSchema).optional(),
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

  // Marcación de códigos de barras impresos
  fastify.post("/inventory/products/mark-barcodes-printed", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const schema = z.object({
      productIds: z.array(z.number()),
    });
    const parse = schema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, message: "Lista de IDs inválida" });
    }
    const result = markBarcodesPrinted(tenantId, parse.data.productIds);
    return { success: true, message: "Productos marcados como impresos", ...result };
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
      quantity: z.number().positive("La cantidad debe ser mayor a 0"),
      variantId: z.string().optional(),
      reason: z.string().min(1, "El motivo es requerido"),
      operatorName: z.string().optional(),
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

  fastify.post("/inventory/assets", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const schema = z.object({
      code: z.string().min(1, "El código de activo es requerido"),
      name: z.string().min(1, "El nombre del activo es requerido"),
      category: z.enum(["vehiculo", "tecnologia", "mobiliario"]),
      brand: z.string().optional(),
      model: z.string().optional(),
      serialNumber: z.string().optional(),
      plateNumber: z.string().optional(),
      location: z.string().optional(),
      assignedTo: z.string().optional(),
      acquisitionDate: z.string().min(1, "La fecha de adquisición es requerida"),
      acquisitionCost: z.number().min(0, "El costo no puede ser negativo"),
      status: z.enum(["operativo", "mantenimiento", "baja", "en_reserva"]).default("operativo"),
      description: z.string().optional(),
      photos: z.array(z.string()).default([]),
      videos: z.array(z.string()).default([]),
      vehicleDocs: z.object({
        tiv: z.object({
          number: z.string().optional(),
          plateNumber: z.string().optional(),
          vin: z.string().optional(),
          engineNumber: z.string().optional(),
          color: z.string().optional(),
          fuelType: z.string().optional(),
          year: z.union([z.string(), z.number()]).optional(),
          ownerName: z.string().optional(),
          registrationOffice: z.string().optional(),
          documentUrl: z.string().optional(),
        }).optional(),
        soat: z.object({
          policyNumber: z.string().optional(),
          insurer: z.string().optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          certificateType: z.enum(["electronico", "fisico"]).optional(),
          status: z.enum(["vigente", "por_vencer", "vencido"]).optional(),
          documentUrl: z.string().optional(),
        }).optional(),
        citv: z.object({
          certificateNumber: z.string().optional(),
          inspectionCenter: z.string().optional(),
          issueDate: z.string().optional(),
          expirationDate: z.string().optional(),
          result: z.enum(["aprobado", "desaprobado", "no_aplica"]).optional(),
          mileageAtInspection: z.union([z.string(), z.number()]).optional(),
          documentUrl: z.string().optional(),
        }).optional(),
      }).optional(),
    });

    const parse = schema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, errors: parse.error.format() });
    }

    const created = createAsset(tenantId, parse.data as any);
    return reply.status(201).send({
      success: true,
      message: "Activo fijo registrado con éxito",
      data: created,
    });
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

  // ========================================================
  // 6. HISTORIAL & TRAZABILIDAD 360° (ESCÁNER, COMPRAS, CLIENTES, EPP)
  // ========================================================
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
      date: z.string().min(1, "La fecha de compra es requerida"),
      quantity: z.number().positive("La cantidad debe ser mayor a 0"),
      unitCost: z.number().min(0, "El costo unitario no puede ser negativo"),
      notes: z.string().optional(),
    });

    const parse = schema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, errors: parse.error.format() });
    }

    const purchase = createPurchase(tenantId, {
      ...parse.data,
      totalCost: parse.data.quantity * parse.data.unitCost,
    });
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
      customerId: z.union([z.number(), z.string()]),
      customerName: z.string().min(1, "El nombre del cliente es requerido"),
      address: z.string().optional(),
      assignedIp: z.string().optional(),
      installedAt: z.string().default(new Date().toISOString()),
      technicianName: z.string().min(1, "El técnico instalador es requerido"),
      quantity: z.number().positive().default(1),
      notes: z.string().optional(),
    });

    const parse = schema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, errors: parse.error.format() });
    }

    const inst = createClientInstallation(tenantId, parse.data);
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
