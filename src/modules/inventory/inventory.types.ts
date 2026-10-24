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

  // Control de Caducidad / Vida Útil / Inspección (Perecibles, Herramientas, EPP)
  hasLifespanControl?: boolean;
  lifespanType?: "expiration_date" | "lifespan" | "both" | "none";
  expirationDate?: string | null; // Fecha fija de caducidad (YYYY-MM-DD)
  lifespanValue?: number | null; // Duración de vida útil
  lifespanUnit?: "dias" | "meses" | "anios" | "horas" | null; // Unidad de vida útil
  alertBeforeDays?: number | null; // Días previos para alertar antes del vencimiento (default 30)
  requiresInspection?: boolean; // Requiere inspección física periódica para verificar estado
  inspectionFrequencyDays?: number | null; // Frecuencia de revisión periódica en días (ej. 30, 90)
  replacementCriteria?: string | null; // Criterios o motivos de cambio / descarte

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
  status: "disponible" | "asignado" | "en_uso" | "baja" | "entregado" | "en_garantia" | "instalado";
  assignedTo?: string;
  assignedAt?: string;
  serialNumber?: string;
  notes?: string;
  barcodePrinted?: boolean;
  barcodePrintedAt?: string;
  createdAt?: string;

  // Seguimiento específico de unidad para caducidad / vida útil / condición
  expirationDate?: string | null;
  manufactureDate?: string | null;
  conditionStatus?: "optimo" | "bueno" | "regular" | "requiere_cambio" | "baja";
  lastInspectionDate?: string | null;
  nextInspectionDate?: string | null;
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
  technicianName?: string;
  unitsAffected?: string[];
  previousStock?: number;
  newStock?: number;
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
  expiringProductsCount?: number;
}

// ==========================================
// ACTIVOS FIJOS (VEHÍCULO, TECNOLOGÍA, MOBILIARIO)
// ==========================================
export type AssetCategory = "vehiculo" | "tecnologia" | "mobiliario" | "nodo";

export interface NodeDocumentation {
  address?: string;              // Dirección física del inmueble / casa del nodo
  reference?: string;            // Referencia de llegada
  latitude?: number | string;    // Latitud GPS
  longitude?: number | string;   // Longitud GPS
  propertyType?: "alquilado" | "propio" | "comodato"; // Condición del inmueble
  landlordName?: string;         // Propietario / Arrendador
  landlordPhone?: string;        // Teléfono de contacto
  rentalCost?: number | string;  // Costo mensual del alquiler
  paymentDay?: number | string;  // Día de pago del alquiler
  powerType?: string;            // Monofásica / Trifásica
  powerMeterNumber?: string;     // N° de Suministro eléctrico / Medidor
  upsModel?: string;             // Sistema UPS y banco de baterías
  generator?: string;            // Generador auxiliar / Grupo electrógeno
  powerAutonomyHours?: number | string; // Horas de autonomía eléctrica
  airConditioning?: string;      // Climatización / Aire acondicionado
  racksCount?: number | string;  // Cantidad de racks / gabinetes
  serversCount?: number | string; // Servidores físicos / OLTs / Switches instalados
  ipSubnet?: string;             // IP de gestión del nodo / VLAN / Segmento
  uplinkProvider?: string;       // Enlace troncal fibra / Proveedor
  keyHolder?: string;            // Custodio / Llaves en poder de
  cctvCameras?: string;          // Sistema de videovigilancia / CCTV
}

export interface TechDocumentation {
  techCategory?: string;         // "computo" | "redes" | "instrumentacion" | "herramienta_electrica" | "herramienta_manual" | "seguridad_altura" | "general"
  deviceType?: string;           // Subtipo o nombre específico (ej: Fusionadora 6 motores, Laptop Core i7, Taladro 18V)
  specifications?: string;       // Ficha técnica o resumen de capacidades
  powerSource?: string;          // Tipo de alimentación: Batería Li-Ion, 220V, PoE, Manual, etc.
  processor?: string;            // CPU
  ram?: string;                  // RAM
  storage?: string;              // Disco
  macAddress?: string;           // MAC
  managementIp?: string;         // IP de gestión
  osVersion?: string;            // Sistema Operativo / Firmware
  portsCount?: string;           // Puertos / Interfaces
  wavelength?: string;           // Longitud de onda / Rango de pérdida
  calibrationDate?: string;      // Fecha de calibración
  calibrationExpiry?: string;    // Vigencia / Próxima calibración
  calibrationCertNumber?: string;// N° Certificado de Calibración
  powerRating?: string;          // Potencia / Voltaje (ej: 18V, 750W, 150Kg)
  lifespanNotes?: string;        // Criterios de inspección / desgaste / vida útil
  warrantyExpiry?: string;       // Garantía vigente hasta
  accessories?: string;          // Maletín, kit y accesorios incluidos
}

export interface FurnitureDocumentation {
  furnitureType?: string;        // Rack de piso, Gabinete mural, Escritorio, Silla, etc.
  rackUnits?: number | string;   // Altura en U (42U, 24U, 12U, etc.)
  dimensions?: string;           // Dimensiones (Alto x Ancho x Fondo)
  material?: string;             // Acero, Madera, Metal, etc.
  weightCapacityKg?: number | string; // Capacidad de carga máx.
  floorLocation?: string;        // Piso / Sala / Oficina
}
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

export interface AssetAssignment {
  id: string;
  assetId: number;
  assignedTo: string;          // Técnico, chofer o cuadrilla asignada
  previousAssignedTo?: string; // Responsable anterior o Almacén Central
  assignedDate: string;        // Fecha de entrega/asignación (YYYY-MM-DD)
  assignedTime?: string;       // Hora de entrega/asignación (HH:mm)
  status: "activa" | "finalizada" | "devuelto"; // Estado de la asignación
  returnDate?: string;         // Fecha de relevo/devolución
  returnTime?: string;         // Hora de relevo/devolución
  location?: string;           // Base o sede operativa
  purpose?: string;            // Motivo / Proyecto / Misión
  condition?: string;          // Condición física / Kilometraje al entregar
  assignedBy?: string;         // Supervisor o persona que realiza la entrega
  documentUrl?: string;        // Enlace a acta de entrega o documento firmado
  notes?: string;              // Observaciones detalladas (llaves, herramientas, combustible)
  createdAt: string;
}

export interface NodeStockItem {
  id: string;
  assetId: number;
  assetCode?: string;
  assetName?: string;
  productId: number;
  productName: string;
  productSku: string;
  productImage?: string;
  category?: string;
  quantity: number;
  unitPrice?: number;
  serialNumber?: string;
  itemUnitId?: string;
  rackLocation?: string;
  assignedDate: string;
  assignedBy?: string;
  status: "en_operacion" | "en_reserva" | "retornado" | "danado";
  notes?: string;
  returnedDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleImplementItem {
  id: string;
  name: string;
  category: 'seguridad' | 'mecanica' | 'herramientas' | 'documentos' | 'emergencia' | 'otro';
  status: 'ok' | 'faltante' | 'dañado';
  checked: boolean;
  quantity: number;
  notes?: string;
  expirationDate?: string | null; // Fecha en que vence y necesita cambio (YYYY-MM-DD)
  updatedAt?: string;
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
  assignmentHistory?: AssetAssignment[];
  eventHistory: AssetHistoryEvent[];
  vehicleDocs?: VehicleDocumentation; // Tarjeta de Identificación Vehicular, SOAT y CITV
  vehicleChecklist?: VehicleImplementItem[]; // Checklist de implementos, herramientas y accesorios del auto
  nodeDetails?: NodeDocumentation;    // Infraestructura de casa del nodo & servidores físicos
  techDetails?: TechDocumentation;    // Hardware & especificaciones técnicas
  furnitureDetails?: FurnitureDocumentation;
  nodeStock?: NodeStockItem[]; // Dimensiones & características de mobiliario/rack
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
  purchaseDate?: string;
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
  clientName?: string;
  contractNumber?: string;
  address?: string;
  assignedIp?: string;
  installedAt: string;
  technicianName: string;
  technician?: string;
  serialOrMac?: string;
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
  category?: string;
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
  expirationDate?: string;
  hasLifespanControl?: boolean;
  alertBeforeDays?: number;
  lifespanValue?: number;
  lifespanUnit?: string;
  expectedReturnDate?: string;
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
