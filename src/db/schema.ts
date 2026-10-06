import { pgTable, text, serial, timestamp, integer, numeric, boolean, pgEnum, index, uniqueIndex } from "drizzle-orm/pg-core";

// Enums
export const userRoleEnum = pgEnum("user_role", ["superadmin", "admin", "technician", "billing"]);
export const deviceVendorEnum = pgEnum("device_vendor", ["mikrotik", "huawei_olt", "zte_olt", "vsol_olt", "ubiquiti", "generic"]);
export const deviceStatusEnum = pgEnum("device_status", ["online", "offline", "unknown"]);
export const customerStatusEnum = pgEnum("customer_status", ["active", "suspended", "canceled", "pending_installation"]);
export const serviceStatusEnum = pgEnum("service_status", ["active", "suspended", "retired"]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["pending", "paid", "overdue", "canceled"]);
export const paymentMethodEnum = pgEnum("payment_method", ["cash", "bank_transfer", "pos", "other"]);

// 1. Usuarios del Sistema (Operadores, Administradores, Técnicos)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("turbonetwork"),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").default("admin").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("idx_users_tenant").on(table.tenantId),
}));

// 2. Zonas y Sectores de Cobertura
export const zones = pgTable("zones", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("turbonetwork"),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("idx_zones_tenant").on(table.tenantId),
}));

// 3. Nodos / Torres de Transmisión
export const networkNodes = pgTable("network_nodes", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("turbonetwork"),
  name: text("name").notNull(),
  zoneId: integer("zone_id").references(() => zones.id),
  address: text("address"),
  latitude: text("latitude"),
  longitude: text("longitude"),
  status: text("status").default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("idx_nodes_tenant").on(table.tenantId),
}));

// 4. Equipos de Red Multi-Vendor (MikroTik, OLTs, Switches)
export const networkDevices = pgTable("network_devices", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("turbonetwork"),
  name: text("name").notNull(),
  vendor: deviceVendorEnum("vendor").default("mikrotik").notNull(),
  model: text("model"),
  ipAddress: text("ip_address").notNull(),
  port: integer("port").default(8728),
  username: text("username").default("admin"),
  passwordEncrypted: text("password_encrypted"),
  apiType: text("api_type").default("routeros_api").notNull(),
  status: deviceStatusEnum("status").default("unknown").notNull(),
  lastPingAt: timestamp("last_ping_at"),
  zoneId: integer("zone_id").references(() => zones.id),
  nodeId: integer("node_id").references(() => networkNodes.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("idx_devices_tenant").on(table.tenantId),
}));

// 5. Planes de Internet
export const plans = pgTable("plans", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("turbonetwork"),
  name: text("name").notNull(),
  downloadSpeedMbps: integer("download_speed_mbps").notNull(),
  uploadSpeedMbps: integer("upload_speed_mbps").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("$").notNull(),
  burstLimit: text("burst_limit"),
  priority: integer("priority").default(8),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("idx_plans_tenant").on(table.tenantId),
}));

// 6. Clientes
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("turbonetwork"),
  customerCode: text("customer_code").notNull(),
  fullName: text("full_name").notNull(),
  identification: text("identification").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  address: text("address").notNull(),
  latitude: text("latitude"),
  longitude: text("longitude"),
  status: customerStatusEnum("status").default("active").notNull(),
  zoneId: integer("zone_id").references(() => zones.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("idx_customers_tenant").on(table.tenantId),
  tenantCodeIdx: uniqueIndex("idx_customers_tenant_code").on(table.tenantId, table.customerCode),
}));

// 7. Servicios y Contratos de Clientes
export const customerServices = pgTable("customer_services", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("turbonetwork"),
  customerId: integer("customer_id").references(() => customers.id).notNull(),
  planId: integer("plan_id").references(() => plans.id).notNull(),
  deviceId: integer("device_id").references(() => networkDevices.id),
  assignedIp: text("assigned_ip"),
  macAddress: text("mac_address"),
  pppoeUsername: text("pppoe_username"),
  routerModel: text("router_model"),
  monthlyFee: numeric("monthly_fee", { precision: 10, scale: 2 }).notNull(),
  status: serviceStatusEnum("status").default("active").notNull(),
  installationDate: timestamp("installation_date").defaultNow(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("idx_services_tenant").on(table.tenantId),
}));

// 8. Facturación Interna (Recibos / Facturas)
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("turbonetwork"),
  invoiceNumber: text("invoice_number").notNull(),
  customerId: integer("customer_id").references(() => customers.id).notNull(),
  serviceId: integer("service_id").references(() => customerServices.id),
  period: text("period").notNull(), // Ej: "2026-10"
  issueDate: timestamp("issue_date").defaultNow().notNull(),
  dueDate: timestamp("due_date").notNull(),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 10, scale: 2 }).default("0.00"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  status: invoiceStatusEnum("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("idx_invoices_tenant").on(table.tenantId),
  tenantInvoiceNumberIdx: uniqueIndex("idx_invoices_tenant_num").on(table.tenantId, table.invoiceNumber),
}));

// 9. Registro de Pagos (Efectivo, Transferencia, etc.)
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("turbonetwork"),
  invoiceId: integer("invoice_id").references(() => invoices.id).notNull(),
  customerId: integer("customer_id").references(() => customers.id).notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: paymentMethodEnum("payment_method").default("cash").notNull(),
  referenceNumber: text("reference_number"),
  notes: text("notes"),
  registeredByUserId: integer("registered_by_user_id").references(() => users.id),
  paymentDate: timestamp("payment_date").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("idx_payments_tenant").on(table.tenantId),
}));
