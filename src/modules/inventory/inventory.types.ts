export type ProductType = "simple" | "bulk" | "epp";

export interface ProductVariant {
  id: string;
  name: string; // ej: "Talla M - Blanco", "Talla 42"
  sku: string;
  quantity: number;
  costPrice?: number; // Aplica si hasDifferentCostPerVariant es true
  salePrice?: number;
}

export interface InventoryCategory {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  color?: string; // Hex color code
  createdAt: string;
  updatedAt: string;
}

export interface InventoryProduct {
  id: number;
  tenantId: string;
  type: ProductType;
  name: string;
  alternativeNames: string[]; // Múltiples nombres alternativos / sinónimos / tags
  categoryId: string;
  categoryName?: string;
  sku: string;
  barcode?: string;
  baseCost: number; // Costo base
  salePrice?: number;
  stock: number; // Stock total calculado
  stockMin: number; // Umbral de stock mínimo
  stockCritical: number; // Umbral de stock crítico
  images: string[]; // URLs o Base64 data URLs de múltiples fotos
  description?: string;
  location?: string; // Ubicación en almacén

  // Específico para "bulk" (A Granel)
  unitOfMeasure?: string; // ej: "Metros (m)", "Bobina", "Kilogramos (kg)", "Litros"
  unitSku?: string; // SKU específico para la unidad de medida
  allowDecimals?: boolean;

  // Específico para "epp"
  hasDifferentCostPerVariant?: boolean; // Switcher moderno para activar costo distinto por variante
  variants?: ProductVariant[];

  // Impresión de Código de Barras y Lotes
  barcodePrinted?: boolean;
  barcodePrintedAt?: string;
  batchNumber?: string; // Número de lote
  entryDate?: string; // Fecha y hora de ingreso

  // Papelera y Soft-Delete (máximo 60 días)
  isDeleted?: boolean;
  deletedAt?: string;

  // Unidades individuales físicas con SKU / Código de barras propio
  itemUnits?: ProductItemUnit[];

  status: "optimal" | "low" | "critical" | "out_of_stock";
  createdAt: string;
  updatedAt: string;
}

export interface ProductItemUnit {
  id: string;
  itemNumber: number;
  sku: string;
  barcode?: string;
  status: "disponible" | "asignado" | "en_uso" | "baja";
  assignedTo?: string;
  assignedAt?: string;
  serialNumber?: string;
  notes?: string;
  createdAt?: string;
}

export interface StockMovement {
  id: string;
  tenantId: string;
  productId: number;
  productName: string;
  type: "in" | "out" | "adjustment";
  quantity: number;
  variantId?: string;
  variantName?: string;
  reason: string;
  operatorName?: string;
  timestamp: string;
}

export interface InventoryMetrics {
  totalProducts: number;
  totalValuation: number;
  criticalStockCount: number;
  lowStockCount: number;
  optimalStockCount: number;
  outOfStockCount: number;
  categoriesCount: number;
  trashCount?: number;
  assetsCount?: number;
}

// ==========================================
// ACTIVOS FIJOS (VEHÍCULO, TECNOLOGÍA, MOBILIARIO)
// ==========================================
export type AssetCategory = "vehiculo" | "tecnologia" | "mobiliario";
export type AssetStatus = "operativo" | "mantenimiento" | "baja" | "en_reserva";

export interface AssetMaintenance {
  id: string;
  assetId: number;
  type: "preventivo" | "correctivo" | "calibracion";
  title: string;
  description: string;
  cost: number;
  technician: string;
  date: string;
  photos: string[];
  videos: string[]; // URLs o base64
  createdAt: string;
}

export interface AssetHistoryEvent {
  id: string;
  assetId: number;
  type: "creacion" | "asignacion" | "mantenimiento" | "traslado" | "inspeccion" | "baja";
  title: string;
  description: string;
  operator: string;
  date: string;
  photos?: string[];
  videos?: string[];
}

export interface VehicleTIV {
  number?: string; // N° de Tarjeta de Propiedad / TIVE
  plateNumber?: string;
  vin?: string; // Número de Chasis / VIN
  engineNumber?: string; // N° de Motor
  color?: string;
  fuelType?: string; // Diésel, Gasolina, GNV, GLP, Eléctrico
  year?: number | string; // Año de fabricación / modelo
  ownerName?: string; // Titular registral (ej. TURBONETWORK S.A.C.)
  registrationOffice?: string; // ej. SUNARP - Zona Registral IX Sede Lima
  documentUrl?: string; // Enlace al PDF o imagen de la TIVE
}

export interface VehicleSOAT {
  policyNumber?: string;
  insurer?: string; // Rímac, Pacífico, La Positiva, Mapfre, Interseguro
  startDate?: string;
  endDate?: string;
  certificateType?: "electronico" | "fisico";
  status?: "vigente" | "por_vencer" | "vencido";
  documentUrl?: string; // Enlace al certificado SOAT o consulta APESEG
}

export interface VehicleCITV {
  certificateNumber?: string;
  inspectionCenter?: string; // Centro de Inspección Técnica Vehicular autorizado MTC (ej. Farenet, Lidercon)
  issueDate?: string;
  expirationDate?: string;
  result?: "aprobado" | "desaprobado" | "no_aplica";
  mileageAtInspection?: number | string;
  documentUrl?: string; // Enlace al certificado CITV
}

export interface VehicleDocumentation {
  tiv?: VehicleTIV;
  soat?: VehicleSOAT;
  citv?: VehicleCITV;
}

export interface FixedAsset {
  id: number;
  tenantId: string;
  code: string; // ej: "ACT-VEH-001", "ACT-TEC-004"
  name: string;
  category: AssetCategory;
  brand?: string;
  model?: string;
  serialNumber?: string;
  plateNumber?: string; // Para vehículos
  location?: string;
  assignedTo?: string; // Técnico o cuadrilla
  acquisitionDate: string;
  acquisitionCost: number;
  status: AssetStatus;
  description?: string;
  photos: string[];
  videos: string[];
  maintenanceHistory: AssetMaintenance[];
  eventHistory: AssetHistoryEvent[];
  vehicleDocs?: VehicleDocumentation; // Tarjeta de Identificación Vehicular, SOAT y CITV
  createdAt: string;
  updatedAt: string;
}


// ==========================================
// HISTORIAL & TRAZABILIDAD 360°
// ==========================================
export interface ProductPurchase {
  id: string;
  tenantId: string;
  productId: number;
  supplier: string;
  invoiceNumber: string;
  date: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  notes?: string;
  createdAt: string;
}

export interface ClientInstallation {
  id: string;
  tenantId: string;
  productId: number;
  customerId: number | string;
  customerName: string;
  address?: string;
  assignedIp?: string;
  installedAt: string;
  technicianName: string;
  quantity: number;
  notes?: string;
}

export interface PersonnelAssignment {
  id: string;
  tenantId: string;
  productId: number;
  productName?: string;
  productSku?: string;
  productImage?: string;
  employeeId: number | string;
  employeeName: string;
  assignedAt: string;
  returnedAt?: string;
  quantity: number;
  status: "entregado" | "devuelto" | "en_uso" | "baja";
  returnCondition?: "buen_estado" | "danado" | "observacion";
  variantName?: string;
  notes?: string;
  unitSku?: string;
  itemUnitId?: string;
  unitNumber?: number;
}

export interface ProductTraceabilitySummary {
  product: InventoryProduct;
  stats: {
    totalRegistered: number;
    stockAvailable: number;
    installedCustomers: number;
    damagedOrDischarged: number;
    inObservation: number;
    inPersonnelEpp: number;
  };
  movements: StockMovement[];
  purchases: ProductPurchase[];
  installations: ClientInstallation[];
  assignments: PersonnelAssignment[];
  matchedUnit?: ProductItemUnit;
}
