import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, json, bigint, boolean, uniqueIndex } from "drizzle-orm/mysql-core";

// ==================== USERS ====================
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["admin", "comprador", "aprovador", "buyer_senior", "cotador"]).default("comprador").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ==================== UNIDADES / OBRAS ====================
export const units = mysqlTable("units", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  state: varchar("state", { length: 2 }).notNull(),
  city: varchar("city", { length: 255 }).notNull(),
  address: text("address"),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  costCenter: varchar("costCenter", { length: 100 }),
  contactName: varchar("contactName", { length: 255 }),
  contactPhone: varchar("contactPhone", { length: 20 }),
  active: boolean("active").default(true).notNull(),
  fortesEmpresa: varchar("fortesEmpresa", { length: 10 }),
  fortesEstabelecimento: varchar("fortesEstabelecimento", { length: 10 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Unit = typeof units.$inferSelect;
export type InsertUnit = typeof units.$inferInsert;

// ==================== FORNECEDORES ====================
export const suppliers = mysqlTable("suppliers", {
  id: int("id").autoincrement().primaryKey(),
  cnpj: varchar("cnpj", { length: 18 }),
  companyName: varchar("companyName", { length: 500 }).notNull(),
  tradeName: varchar("tradeName", { length: 500 }),
  contactName: varchar("contactName", { length: 255 }),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 320 }),
  whatsapp: varchar("whatsapp", { length: 20 }),
  state: varchar("state", { length: 2 }),
  city: varchar("city", { length: 255 }),
  address: text("address"),
  categories: json("categories").$type<string[]>(),
  // Novos campos baseados nas planilhas reais
  deliveryMode: varchar("deliveryMode", { length: 255 }), // Ex: "PEGA NO LOCAL", "ENTREGA UMA VEZ POR SEMANA"
  deliveryDays: varchar("deliveryDays", { length: 500 }), // Ex: "QUARTA", "TERCA; SEXTA", "TODO OS DIAS"
  paymentTerms: varchar("paymentTerms", { length: 255 }), // Ex: "À VISTA", "7 DIAS", "14 DIAS"
  paymentMethod: varchar("paymentMethod", { length: 255 }), // Ex: "BOLETO", "PIX", "CARTÃO"
  responsavelContato: varchar("responsavelContato", { length: 255 }), // Responsável no fornecedor
  reliabilityScore: mysqlEnum("reliabilityScore", ["green", "yellow", "red"]).default("yellow").notNull(),
  avgRating: decimal("avgRating", { precision: 3, scale: 2 }).default("0"),
  totalDeliveries: int("totalDeliveries").default(0),
  supplierType: varchar("supplierType", { length: 50 }).default("outro"),
  notes: text("notes"),
  active: boolean("active").default(true).notNull(),
  quotationBlocked: boolean("quotationBlocked").default(false).notNull(),
  quotationBlockedReason: varchar("quotationBlockedReason", { length: 500 }),
  quotationBlockedAt: timestamp("quotationBlockedAt"),
  quotationBlockedBy: varchar("quotationBlockedBy", { length: 200 }),
  specificProducts: json("specificProducts").$type<string[]>(), // Palavras-chave de produtos — se preenchido, fornecedor só é convidado quando cotação contém esses itens
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = typeof suppliers.$inferInsert;

// ==================== VÍNCULO FORNECEDOR-UNIDADE ====================
export const supplierUnits = mysqlTable("supplier_units", {
  id: int("id").autoincrement().primaryKey(),
  supplierId: int("supplierId").notNull(),
  unitId: int("unitId").notNull(),
  responsavelNaUnidade: varchar("responsavelNaUnidade", { length: 255 }), // Quem recebe na unidade
  escriturario: varchar("escriturario", { length: 255 }), // Escriturário da unidade
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SupplierUnit = typeof supplierUnits.$inferSelect;

// ==================== DOCUMENTOS DO FORNECEDOR ====================
export const supplierDocuments = mysqlTable("supplier_documents", {
  id: int("id").autoincrement().primaryKey(),
  supplierId: int("supplierId").notNull(),
  docType: varchar("docType", { length: 100 }).notNull(),
  docName: varchar("docName", { length: 255 }).notNull(),
  fileUrl: text("fileUrl"),
  expiresAt: timestamp("expiresAt"),
  status: mysqlEnum("status", ["valid", "expiring", "expired"]).default("valid").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SupplierDocument = typeof supplierDocuments.$inferSelect;

// ==================== COTAÇÕES ====================
export const quotations = mysqlTable("quotations", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  title: varchar("title", { length: 500 }).notNull(),
  unitId: int("unitId"),
  createdBy: int("createdBy").notNull(),
  status: mysqlEnum("status", ["draft", "open", "closed", "ordered", "cancelled"]).default("draft").notNull(),
  deadline: timestamp("deadline"),
  notes: text("notes"),
  publicToken: varchar("publicToken", { length: 64 }).notNull().unique(),
  reopenCount: int("reopenCount").default(0).notNull(),
  lastReopenedAt: timestamp("lastReopenedAt"),
  lastReopenedBy: varchar("lastReopenedBy", { length: 255 }),
  lastReopenReason: text("lastReopenReason"),
  coletaNumber: varchar("coletaNumber", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Quotation = typeof quotations.$inferSelect;
export type InsertQuotation = typeof quotations.$inferInsert;

// ==================== ITENS DA COTAÇÃO ====================
export const quotationItems = mysqlTable("quotation_items", {
  id: int("id").autoincrement().primaryKey(),
  quotationId: int("quotationId").notNull(),
  productName: varchar("productName", { length: 500 }).notNull(),
  quantity: decimal("quantity", { precision: 12, scale: 3 }).notNull(),
  unit: varchar("unit", { length: 20 }).notNull(),
  category: varchar("category", { length: 100 }),
  curveClass: mysqlEnum("curveClass", ["A", "B", "C"]),
  referencePrice: decimal("referencePrice", { precision: 12, scale: 2 }),
}, (table) => ({
  uqQuotationProduct: uniqueIndex("uq_quotation_product").on(table.quotationId, table.productName),
}));

export type QuotationItem = typeof quotationItems.$inferSelect;

// ==================== FORNECEDORES CONVIDADOS PARA COTAÇÃO ====================
export const quotationSuppliers = mysqlTable("quotation_suppliers", {
  id: int("id").autoincrement().primaryKey(),
  quotationId: int("quotationId").notNull(),
  supplierId: int("supplierId").notNull(),
  invitedAt: timestamp("invitedAt").defaultNow().notNull(),
  respondedAt: timestamp("respondedAt"),
  status: mysqlEnum("status", ["pending", "responded", "declined"]).default("pending").notNull(),
});

export type QuotationSupplier = typeof quotationSuppliers.$inferSelect;

// ==================== PROPOSTAS (RESPOSTAS DOS FORNECEDORES) ====================
export const proposals = mysqlTable("proposals", {
  id: int("id").autoincrement().primaryKey(),
  quotationId: int("quotationId").notNull(),
  supplierId: int("supplierId").notNull(),
  totalValue: decimal("totalValue", { precision: 14, scale: 2 }),
  deliveryDays: int("deliveryDays"),
  paymentTerms: varchar("paymentTerms", { length: 255 }),
  notes: text("notes"),
  submittedAt: timestamp("submittedAt").defaultNow().notNull(),
});

export type Proposal = typeof proposals.$inferSelect;

// ==================== ITENS DA PROPOSTA ====================
export const proposalItems = mysqlTable("proposal_items", {
  id: int("id").autoincrement().primaryKey(),
  proposalId: int("proposalId").notNull(),
  quotationItemId: int("quotationItemId").notNull(),
  unitPrice: decimal("unitPrice", { precision: 12, scale: 2 }).notNull(),
  totalPrice: decimal("totalPrice", { precision: 14, scale: 2 }).notNull(),
  brand: varchar("brand", { length: 255 }),
  notes: text("notes"),
  packagingType: mysqlEnum("packagingType", ["unidade", "caixa", "fardo", "pacote"]).default("unidade"),
  unitsPerPackage: int("unitsPerPackage").default(1),
  unitPriceNormalized: decimal("unitPriceNormalized", { precision: 12, scale: 4 }),
});

export type ProposalItem = typeof proposalItems.$inferSelect;

// ==================== PEDIDOS DE COMPRA ====================
export const purchaseOrders = mysqlTable("purchase_orders", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  quotationId: int("quotationId"),
  proposalId: int("proposalId"),
  supplierId: int("supplierId").notNull(),
  unitId: int("unitId"),
  createdBy: int("createdBy").notNull(),
  approvedBy: int("approvedBy"),
  totalValue: decimal("totalValue", { precision: 14, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["pending_approval", "approved", "sent", "delivered", "cancelled", "purchased"]).default("pending_approval").notNull(),
  approvedAt: timestamp("approvedAt"),
  sentAt: timestamp("sentAt"),
  purchasedAt: timestamp("purchasedAt"),
  deliveredAt: timestamp("deliveredAt"),
    notes: text("notes"),
  purchaseGroupId: varchar("purchaseGroupId", { length: 50 }),
  period: varchar("period", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;

// ==================== ITENS DO PEDIDO ====================
export const purchaseOrderItems = mysqlTable("purchase_order_items", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  productName: varchar("productName", { length: 500 }).notNull(),
  quantity: decimal("quantity", { precision: 12, scale: 3 }).notNull(),
  unit: varchar("unit", { length: 20 }).notNull(),
  unitPrice: decimal("unitPrice", { precision: 12, scale: 2 }).notNull(),
  totalPrice: decimal("totalPrice", { precision: 14, scale: 2 }).notNull(),
    packagingType: varchar("packagingType", { length: 20 }),
  unitsPerPackage: int("unitsPerPackage"),
  brand: varchar("brand", { length: 200 }),
});
export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;

// ==================== AVALIAÇÕES PÓS-ENTREGA ====================
export const deliveryRatings = mysqlTable("delivery_ratings", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  supplierId: int("supplierId").notNull(),
  ratedBy: int("ratedBy").notNull(),
  punctuality: int("punctuality").notNull(),
  quality: int("quality").notNull(),
  quantity: int("quantity").notNull(),
  service: int("service").notNull(),
  overallScore: decimal("overallScore", { precision: 3, scale: 2 }).notNull(),
  comments: text("comments"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DeliveryRating = typeof deliveryRatings.$inferSelect;

// ==================== ALERTAS ====================
export const alerts = mysqlTable("alerts", {
  id: int("id").autoincrement().primaryKey(),
  type: mysqlEnum("type", ["price_anomaly", "doc_expired", "no_response", "curve_a_rupture", "supplier_response", "price_increase"]).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  severity: mysqlEnum("severity", ["low", "medium", "high", "critical", "info"]).default("medium").notNull(),
  relatedEntityType: varchar("relatedEntityType", { length: 50 }),
  relatedEntityId: int("relatedEntityId"),
  resolved: boolean("resolved").default(false).notNull(),
  resolvedBy: int("resolvedBy"),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Alert = typeof alerts.$inferSelect;

// ==================== NOTIFICAÇÕES POR USUÁRIO ====================
export const userNotifications = mysqlTable("user_notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", [
    "supplier_response", "quotation_ready", "order_generated",
    "order_cancelled", "quotation_reopened", "price_alert",
    "delivery_adjusted", "no_response_48h", "doc_expired", "item_edited",
    "system"
  ]).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  message: text("message"),
  priority: mysqlEnum("priority", ["low", "medium", "high", "critical"]).default("medium").notNull(),
  relatedEntityType: varchar("relatedEntityType", { length: 50 }),
  relatedEntityId: int("relatedEntityId"),
  actionUrl: varchar("actionUrl", { length: 500 }),
  readAt: timestamp("readAt"),
  dedupeKey: varchar("dedupeKey", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type UserNotification = typeof userNotifications.$inferSelect;

// ==================== PREFERÊNCIAS DE NOTIFICAÇÃO ====================
export const notificationPreferences = mysqlTable("notification_preferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  eventType: varchar("eventType", { length: 50 }).notNull(),
  inAppEnabled: boolean("inAppEnabled").default(true).notNull(),
  pushEnabled: boolean("pushEnabled").default(true).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type NotificationPreference = typeof notificationPreferences.$inferSelect;

// ==================== ASSINATURAS PUSH ====================
export const pushSubscriptions = mysqlTable("push_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: varchar("userAgent", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PushSubscription = typeof pushSubscriptions.$inferSelect;

// ==================== TRILHA DE AUDITORIA (ENHANCED) ====================
export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"), // null = anonymous/system
  userName: varchar("userName", { length: 255 }),
  userRole: varchar("userRole", { length: 64 }),
  action: varchar("action", { length: 100 }).notNull(),
  resource: varchar("resource", { length: 100 }).notNull(),
  resourceId: varchar("resourceId", { length: 100 }),
  details: text("details"), // JSON with before/after or extra info
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  sessionFingerprint: varchar("sessionFingerprint", { length: 64 }),
  severity: mysqlEnum("severity", ["info", "warning", "critical"]).default("info").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AuditLog = typeof auditLogs.$inferSelect;

// ==================== PREÇOS DE REFERÊNCIA (BENCHMARK) ====================
export const priceReferences = mysqlTable("price_references", {
  id: int("id").autoincrement().primaryKey(),
  productName: varchar("productName", { length: 500 }).notNull(),
  region: varchar("region", { length: 100 }),
  minPrice: decimal("minPrice", { precision: 12, scale: 2 }).notNull(),
  maxPrice: decimal("maxPrice", { precision: 12, scale: 2 }).notNull(),
  avgPrice: decimal("avgPrice", { precision: 12, scale: 2 }).notNull(),
  source: varchar("source", { length: 255 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PriceReference = typeof priceReferences.$inferSelect;

// ==================== HISTÓRICO DE PREÇOS ====================
export const priceHistory = mysqlTable("price_history", {
  id: int("id").autoincrement().primaryKey(),
  productName: varchar("productName", { length: 500 }).notNull(),
  productCode: varchar("productCode", { length: 50 }),
  supplierId: int("supplierId").notNull(),
  supplierName: varchar("supplierName", { length: 255 }),
  brand: varchar("brand", { length: 255 }),
  unitId: int("unitId"),
  unitName: varchar("unitName", { length: 255 }),
  unitPrice: decimal("unitPrice", { precision: 12, scale: 2 }).notNull(),
  quantity: decimal("quantity", { precision: 12, scale: 3 }),
  unit: varchar("unit", { length: 20 }),
  quotationId: int("quotationId"),
  orderId: int("orderId"),
  source: varchar("source", { length: 50 }).default("proposal"),
  sector: varchar("sector", { length: 100 }),
  weekNumber: int("weekNumber"),
  weekLabel: varchar("weekLabel", { length: 30 }),
  recordedAt: timestamp("recordedAt").defaultNow().notNull(),
});

export type PriceHistory = typeof priceHistory.$inferSelect;

// ==================== CONFIGURAÇÕES DO SISTEMA ====================
export const systemSettings = mysqlTable("system_settings", {
  id: int("id").autoincrement().primaryKey(),
  settingKey: varchar("settingKey", { length: 100 }).notNull().unique(),
  settingValue: text("settingValue").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  updatedBy: int("updatedBy"),
});

export type SystemSetting = typeof systemSettings.$inferSelect;

// ==================== REQUISIÇÕES FORTES AG ====================
export const fortesRequisitions = mysqlTable("fortes_requisitions", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  unitName: varchar("unitName", { length: 255 }),
  unitId: int("unitId"),
  requestedBy: varchar("requestedBy", { length: 255 }).notNull(),
  notes: text("notes"),
  urgency: mysqlEnum("urgency", ["low", "normal", "high", "critical"]).default("normal").notNull(),
  items: json("items").$type<Array<{ productName: string; quantity: string; unit: string; category?: string }>>().notNull(),
  status: mysqlEnum("status", ["pending", "processing", "converted", "cancelled"]).default("pending").notNull(),
  quotationId: int("quotationId"),
  processedBy: int("processedBy"),
  processedAt: timestamp("processedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FortesRequisition = typeof fortesRequisitions.$inferSelect;

// ==================== METAS DE PREÇO ====================
export const priceTargets = mysqlTable("price_targets", {
  id: int("id").autoincrement().primaryKey(),
  productName: varchar("productName", { length: 255 }).notNull(),
  productUnit: varchar("productUnit", { length: 50 }).notNull(), // kg, un, cx, pct
  maxPrice: decimal("maxPrice", { precision: 10, scale: 2 }).notNull(),
  category: varchar("category", { length: 100 }),
  unitId: int("unitId"), // null = all units
  notes: text("notes"),
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type PriceTarget = typeof priceTargets.$inferSelect;


// ==================== CADASTRO DE ITENS FORTES ====================
export const fortesItems = mysqlTable("fortes_items", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 20 }).notNull(), // Código interno Fortes (ex: "0010200526")
  name: varchar("name", { length: 500 }).notNull(), // Nome no Fortes (ex: "ACHOCOLATADO - 700G")
  group: varchar("itemGroup", { length: 100 }), // Grupo (ex: "CEREAIS", "PROTEINA")
  unit: varchar("unit", { length: 20 }), // Unidade (ex: "KG", "UN", "PCT")
  active: boolean("active").default(true).notNull(),
});
export type FortesItem = typeof fortesItems.$inferSelect;

// ==================== JUSTIFICATIVAS DE COMPRA ====================
export const purchaseAdjustments = mysqlTable("purchase_adjustments", {
  id: int("id").autoincrement().primaryKey(),
  quotationId: int("quotationId").notNull(),
  orderId: int("orderId"),
  purchaseGroupId: varchar("purchaseGroupId", { length: 50 }),
  unitId: int("unitId"),
  quotationItemId: int("quotationItemId").notNull(),
  productName: varchar("productName", { length: 500 }).notNull(),
  quantity: decimal("quantity", { precision: 12, scale: 3 }).notNull(),
  unit: varchar("unit", { length: 20 }).notNull(),
  // Original recommendation
  recommendedSupplierId: int("recommendedSupplierId").notNull(),
  recommendedSupplierName: varchar("recommendedSupplierName", { length: 200 }).notNull(),
  recommendedUnitPrice: decimal("recommendedUnitPrice", { precision: 12, scale: 4 }).notNull(),
  recommendedTotal: decimal("recommendedTotal", { precision: 14, scale: 2 }).notNull(),
  recommendedBrand: varchar("recommendedBrand", { length: 200 }),
  recommendedReason: varchar("recommendedReason", { length: 500 }),
  // Cheapest option
  cheapestSupplierId: int("cheapestSupplierId"),
  cheapestSupplierName: varchar("cheapestSupplierName", { length: 200 }),
  cheapestUnitPrice: decimal("cheapestUnitPrice", { precision: 12, scale: 4 }),
  // Selected option (manual choice)
  selectedSupplierId: int("selectedSupplierId").notNull(),
  selectedSupplierName: varchar("selectedSupplierName", { length: 200 }).notNull(),
  selectedUnitPrice: decimal("selectedUnitPrice", { precision: 12, scale: 4 }).notNull(),
  selectedTotal: decimal("selectedTotal", { precision: 14, scale: 2 }).notNull(),
  selectedBrand: varchar("selectedBrand", { length: 200 }),
  // Impact
  impactValue: decimal("impactValue", { precision: 14, scale: 2 }).notNull(),
  impactPct: decimal("impactPct", { precision: 8, scale: 2 }).notNull(),
  // Justification
  justificationCategory: varchar("justificationCategory", { length: 100 }).notNull(),
  justificationText: text("justificationText").notNull(),
  // Audit
  userId: int("userId").notNull(),
  userName: varchar("userName", { length: 200 }).notNull(),
  userEmail: varchar("userEmail", { length: 200 }),
  optimizationRule: varchar("optimizationRule", { length: 200 }),
  status: mysqlEnum("adjustmentStatus", ["active", "cancelled"]).default("active").notNull(),
  closedAt: timestamp("closedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PurchaseAdjustment = typeof purchaseAdjustments.$inferSelect;

// ==================== AJUSTES DE ENTREGA (com foto NF) ====================
export const orderDeliveryAdjustments = mysqlTable("order_delivery_adjustments", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  itemId: int("itemId"),
  productName: varchar("productName", { length: 500 }).notNull(),
  adjustmentType: mysqlEnum("adjustmentType", ["removed", "quantity_reduced"]).notNull(),
  oldQuantity: decimal("oldQuantity", { precision: 12, scale: 3 }),
  newQuantity: decimal("newQuantity", { precision: 12, scale: 3 }),
  oldUnitPrice: decimal("oldUnitPrice", { precision: 12, scale: 2 }),
  justification: text("justification").notNull(),
  invoicePhotoUrl: varchar("invoicePhotoUrl", { length: 1000 }).notNull(),
  userId: int("userId").notNull(),
  userName: varchar("userName", { length: 200 }).notNull(),
  userEmail: varchar("userEmail", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type OrderDeliveryAdjustment = typeof orderDeliveryAdjustments.$inferSelect;

// Brand classification system
export const brands = mysqlTable("brands", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  normalizedName: varchar("normalizedName", { length: 200 }).notNull(), // lowercase, trimmed for matching
  status: mysqlEnum("brandStatus", ["approved", "unknown", "rejected"]).default("unknown").notNull(),
  reason: text("reason"), // why approved/rejected
  category: varchar("category", { length: 100 }), // optional: which product category this brand is for
  addedBy: varchar("addedBy", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type Brand = typeof brands.$inferSelect;


// ==================== SECURITY EVENTS (ALERTAS) ====================
export const securityEvents = mysqlTable("security_events", {
  id: int("id").autoincrement().primaryKey(),
  eventType: varchar("eventType", { length: 100 }).notNull(),
  userId: int("userId"),
  userName: varchar("userName", { length: 255 }),
  description: text("description").notNull(),
  details: text("details"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  resolved: boolean("resolved").default(false).notNull(),
  resolvedBy: varchar("resolvedBy", { length: 255 }),
  resolvedAt: timestamp("resolvedAt"),
  notifiedOwner: boolean("notifiedOwner").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type SecurityEvent = typeof securityEvents.$inferSelect;

// ==================== LOGIN SESSIONS (IP TRACKING) ====================
export const loginSessions = mysqlTable("login_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  userName: varchar("userName", { length: 255 }),
  userEmail: varchar("userEmail", { length: 320 }),
  ipAddress: varchar("ipAddress", { length: 45 }).notNull(),
  userAgent: text("userAgent"),
  loginAt: timestamp("loginAt").defaultNow().notNull(),
  suspicious: boolean("suspicious").default(false).notNull(),
  suspiciousReason: text("suspiciousReason"),
});
export type LoginSession = typeof loginSessions.$inferSelect;


// ==================== BANCO DE MARCAS ====================
export const brandRegistry = mysqlTable("brand_registry", {
  id: int("id").autoincrement().primaryKey(),
  productName: varchar("productName", { length: 500 }).notNull(),
  brand: varchar("brand", { length: 200 }).notNull(),
  brandNormalized: varchar("brandNormalized", { length: 200 }).notNull(),
  supplierId: int("supplierId"),
  supplierName: varchar("supplierName", { length: 300 }),
  sector: varchar("sector", { length: 100 }),
  unitId: int("unitId"),
  unitName: varchar("unitName", { length: 200 }),
  lastUsedAt: bigint("lastUsedAt", { mode: "number" }).notNull(),
  usageCount: int("usageCount").notNull().default(1),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
});
export type BrandRegistry = typeof brandRegistry.$inferSelect;


// ==================== MARCAS REJEITADAS - GLOBAL ====================
export const brandRejectionsGlobal = mysqlTable("brand_rejections_global", {
  id: int("id").autoincrement().primaryKey(),
  brandName: varchar("brandName", { length: 255 }).notNull(),
  brandNormalized: varchar("brandNormalized", { length: 255 }).notNull(),
  productCategory: varchar("productCategory", { length: 255 }), // optional: specific product (e.g. "cuscuz", "macarrão")
  reason: text("reason"),
  createdBy: int("createdBy"),
  createdByName: varchar("createdByName", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type BrandRejectionGlobal = typeof brandRejectionsGlobal.$inferSelect;

// ==================== MARCAS REJEITADAS - POR UNIDADE ====================
export const brandRejectionsUnit = mysqlTable("brand_rejections_unit", {
  id: int("id").autoincrement().primaryKey(),
  brandName: varchar("brandName", { length: 255 }).notNull(),
  brandNormalized: varchar("brandNormalized", { length: 255 }).notNull(),
  unitId: int("unitId").notNull(),
  unitName: varchar("unitName", { length: 255 }),
  productCategory: varchar("productCategory", { length: 255 }), // optional: specific product
  reason: text("reason"),
  createdBy: int("createdBy"),
  createdByName: varchar("createdByName", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type BrandRejectionUnit = typeof brandRejectionsUnit.$inferSelect;


// ==================== HISTÓRICO FINANCEIRO (CONTAS A PAGAR FORTES) ====================
export const historicalPayments = mysqlTable("historical_payments", {
  id: int("id").autoincrement().primaryKey(),
  supplierName: varchar("supplierName", { length: 500 }).notNull(),
  tradeName: varchar("tradeName", { length: 500 }),
  unitName: varchar("unitName", { length: 255 }).notNull(),
  value: decimal("value", { precision: 14, scale: 2 }).notNull(),
  entryDate: varchar("entryDate", { length: 10 }).notNull(),
  category: mysqlEnum("category", ["alimentos", "combustivel", "energia", "transporte", "servicos", "pessoa_fisica", "outros"]).default("outros").notNull(),
  source: varchar("source", { length: 100 }).default("fortes_cap"),
  importBatch: varchar("importBatch", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type HistoricalPayment = typeof historicalPayments.$inferSelect;


// ==================== FORNECEDORES PREFERENCIAIS ====================
export const preferredSuppliers = mysqlTable("preferred_suppliers", {
  id: int("id").autoincrement().primaryKey(),
  supplierId: int("supplierId").notNull(),
  unitId: int("unitId"), // NULL = todas as unidades
  tolerancePct: decimal("tolerancePct", { precision: 4, scale: 2 }).notNull().default("3.00"),
  reason: varchar("reason", { length: 255 }),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PreferredSupplier = typeof preferredSuppliers.$inferSelect;

// ==================== COMPRA EMERGENCIAL ====================
export const emergencyPurchaseRequests = mysqlTable("emergency_purchase_requests", {
  id: int("id").autoincrement().primaryKey(),
  originalOrderId: int("originalOrderId").notNull(),
  quotationId: int("quotationId"),
  requestedBy: int("requestedBy").notNull(),
  requestedByName: varchar("requestedByName", { length: 255 }),
  requestedByEmail: varchar("requestedByEmail", { length: 320 }),
  status: mysqlEnum("status", ["pending_approval", "approved", "rejected", "expired"]).default("pending_approval").notNull(),
  emergencySupplierId: int("emergencySupplierId").notNull(),
  emergencySupplierName: varchar("emergencySupplierName", { length: 300 }),
  invoicePhotoUrl: text("invoicePhotoUrl"),
  nfAnalysis: json("nfAnalysis"),
  deficitItems: json("deficitItems"), // Array of {productName, requestedQty, receivedQty, deficit, unit, emergencyUnitPrice}
  justification: text("justification").notNull(),
  totalEstimated: decimal("totalEstimated", { precision: 14, scale: 2 }),
  approvalToken: varchar("approvalToken", { length: 100 }).unique(),
  approvalTokenExpiresAt: timestamp("approvalTokenExpiresAt"),
  approvedBy: int("approvedBy"),
  approvedAt: timestamp("approvedAt"),
  rejectionReason: text("rejectionReason"),
  generatedOrderId: int("generatedOrderId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type EmergencyPurchaseRequest = typeof emergencyPurchaseRequests.$inferSelect;

// ==================== SOLICITAÇÕES DE EDIÇÃO DE PEDIDO ====================
export const orderEditRequests = mysqlTable("order_edit_requests", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  itemId: int("itemId"), // null for add_item
  requestType: mysqlEnum("requestType", ["change_quantity", "add_item", "remove_item"]).notNull(),
  requestedBy: int("requestedBy").notNull(),
  requestedByName: varchar("requestedByName", { length: 255 }),
  requestedByEmail: varchar("requestedByEmail", { length: 320 }),
  currentValue: text("currentValue"), // JSON: current quantity/item data
  newValue: text("newValue"), // JSON: new quantity/item data
  justification: text("justification").notNull(),
  status: mysqlEnum("editRequestStatus", ["pending", "approved", "rejected"]).default("pending").notNull(),
  approvalToken: varchar("approvalToken", { length: 100 }).unique(),
  reviewedBy: int("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type OrderEditRequest = typeof orderEditRequests.$inferSelect;

// ==================== VALIDAÇÃO DE NF COM IA VISUAL ====================
export const nfValidations = mysqlTable("nf_validations", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  imageUrl: text("imageUrl").notNull(),
  aiExtractedData: json("aiExtractedData"), // JSON: {fornecedor, cnpj, data, itens: [{descricao, quantidade, unidade, valorUnitario, valorTotal}], valorTotal, confianca}
  matchResult: json("matchResult"), // JSON: {matches: [{orderItem, nfItem, status, confidence}], summary: {matched, partial, missing, extra}}
  status: mysqlEnum("nfValidationStatus", ["pending", "validated", "partial", "rejected", "emergency_generated"]).default("pending").notNull(),
  confidence: varchar("confidence", { length: 20 }).default("pending"),
  validatedBy: int("validatedBy"),
  validatedByName: varchar("validatedByName", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type NfValidation = typeof nfValidations.$inferSelect;

// ==================== MAPEAMENTO DE PRODUTOS POR FORNECEDOR (BASE DE CONHECIMENTO) ====================
export const supplierProductMappings = mysqlTable("supplier_product_mappings", {
  id: int("id").autoincrement().primaryKey(),
  supplierId: int("supplierId").notNull(),
  supplierName: varchar("supplierName", { length: 300 }),
  nfProductName: varchar("nfProductName", { length: 500 }).notNull(), // Nome como aparece na NF
  nfProductNameNormalized: varchar("nfProductNameNormalized", { length: 500 }).notNull(), // lowercase, trimmed
  systemProductName: varchar("systemProductName", { length: 500 }).notNull(), // Nome no QualiCompras/Fortes
  confidence: decimal("confidence", { precision: 5, scale: 2 }).default("1.00"),
  usageCount: int("usageCount").default(1).notNull(),
  lastUsedAt: timestamp("lastUsedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type SupplierProductMapping = typeof supplierProductMappings.$inferSelect;

// ==================== REMANEJAMENTO DE ITENS DE PEDIDO ====================
export const orderItemRemanagements = mysqlTable("order_item_remanagements", {
  id: int("id").autoincrement().primaryKey(),
  originalOrderId: int("originalOrderId").notNull(),
  originalOrderCode: varchar("originalOrderCode", { length: 50 }),
  complementaryOrderId: int("complementaryOrderId"),
  complementaryOrderCode: varchar("complementaryOrderCode", { length: 50 }),
  quotationId: int("quotationId").notNull(),
  productName: varchar("productName", { length: 500 }).notNull(),
  unit: varchar("unit", { length: 50 }).notNull(),
  originalQuantity: decimal("originalQuantity", { precision: 12, scale: 3 }).notNull(),
  availableQuantity: decimal("availableQuantity", { precision: 12, scale: 3 }).notNull(),
  deficit: decimal("deficit", { precision: 12, scale: 3 }).notNull(),
  originalSupplierId: int("originalSupplierId").notNull(),
  originalSupplierName: varchar("originalSupplierName", { length: 300 }),
  originalUnitPrice: decimal("originalUnitPrice", { precision: 12, scale: 4 }),
  alternativeSupplierId: int("alternativeSupplierId"),
  alternativeSupplierName: varchar("alternativeSupplierName", { length: 300 }),
  alternativeUnitPrice: decimal("alternativeUnitPrice", { precision: 12, scale: 4 }),
  alternativeBrand: varchar("alternativeBrand", { length: 300 }),
  alternativeRank: int("alternativeRank"),
  justification: text("justification").notNull(),
  status: mysqlEnum("remanagementStatus", ["completed", "failed_no_alternative", "cancelled"]).default("completed").notNull(),
  costImpact: decimal("costImpact", { precision: 12, scale: 2 }),
  userId: int("userId").notNull(),
  userName: varchar("userName", { length: 255 }),
  userEmail: varchar("userEmail", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type OrderItemRemanejamento = typeof orderItemRemanagements.$inferSelect;

// ==================== ALIASES DE MARCA (NORMALIZAÇÃO ORTOGRÁFICA) ====================
export const brandAliases = mysqlTable("brand_aliases", {
  id: int("id").autoincrement().primaryKey(),
  aliasName: varchar("aliasName", { length: 300 }).notNull(),
  aliasNormalized: varchar("aliasNormalized", { length: 300 }).notNull(),
  canonicalName: varchar("canonicalName", { length: 300 }).notNull(),
  canonicalNormalized: varchar("canonicalNormalized", { length: 300 }).notNull(),
  reason: text("reason"),
  createdBy: int("createdBy"),
  createdByName: varchar("createdByName", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type BrandAlias = typeof brandAliases.$inferSelect;
