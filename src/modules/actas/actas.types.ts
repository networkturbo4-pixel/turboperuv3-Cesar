export type ActaEstadoFinal =
  | "En Proceso"
  | "Finalizada (Éxito)"
  | "Pendiente"
  | "Observada"
  | "Anulada";

export type ActaTipoServicio =
  | "Instalación"
  | "Migración"
  | "Mantenimiento / Avería"
  | "Traslado"
  | "Reconexión"
  | "Retiro";

export interface ActaCliente {
  customerId?: number | string;
  nombreCompleto: string;
  dniRuc?: string;
  rotuladoQr?: string;
  direccion?: string;
  distrito?: string;
  referencia?: string;
  whatsappPrincipal?: string;
  celularAlternativo?: string;
  latitud?: string;
  longitud?: string;
}

export interface ActaPlantaExterna {
  nodoCluster?: string;
  napCaja?: string;
  puerto?: string;
  potenciaDbm?: string;
  atenuacionEmpalme?: string;
  dropMetros?: string;
  precinto?: string;
}

export interface ActaDetallesServicio {
  fecha: string;
  horaInicio?: string;
  horaFin?: string;
  tipo: ActaTipoServicio | string;
  estadoFinal: ActaEstadoFinal | string;
  servicioContratadoId?: number | string;
  servicioContratadoNombre?: string;
  tecnicoId?: number | string;
  tecnicoNombre: string;
  ssidWifi?: string;
  passwordWifi?: string;
  speedDl?: string;
  speedUl?: string;
  numTvs?: string;
  splitters?: string;
  senalLow?: string;
  vlanPppoe?: string;
}

export interface ActaEquipoItem {
  id: string;
  accion: "Instala" | "Retira" | string;
  productId?: number;
  mochilaAssignmentId?: string;
  modeloMarca: string;
  serieMac: string;
  propiedad: "Alquiler" | "Venta" | "Comodato" | "Propio" | string;
  unitSku?: string;
  desdeMochila?: boolean;
  mochilaSynced?: boolean;
}

export interface ActaMaterialItem {
  id: string;
  accion: "Instala" | "Retira" | string;
  productId?: number;
  mochilaAssignmentId?: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  propiedad: "Alquiler" | "Incluido" | "Venta" | "Adicional" | string;
  desdeMochila?: boolean;
  mochilaSynced?: boolean;
}

export interface ActaEvidencia {
  id: string;
  categoria: "router_equipos" | "potencia_optica" | "instalacion_fachada" | "dni_documento" | "general" | string;
  titulo?: string;
  imageUrl: string;
  thumbnailUrl: string;
  createdAt: string;
}

export interface ActaFirma {
  dataUrl?: string;
  imageUrl?: string;
  firmanteNombre?: string;
  firmanteDni?: string;
  signedAt?: string;
}

export interface ActaInstalacion {
  id: string;
  tenantId: string;
  prefijo: string;
  folioNumero: string;
  folioCompleto: string;
  publicToken: string;
  cliente: ActaCliente;
  plantaExterna: ActaPlantaExterna;
  detallesServicio: ActaDetallesServicio;
  equipos: ActaEquipoItem[];
  materiales: ActaMaterialItem[];
  evidencias: ActaEvidencia[];
  observaciones?: string;
  firmaCliente?: ActaFirma;
  firmaTecnico?: ActaFirma;
  createdBy?: string;
  updatedBy?: string;
  historialEdiciones?: Array<{ user: string; date: string; summary?: string }>;
  createdAt: string;
  updatedAt: string;
}
