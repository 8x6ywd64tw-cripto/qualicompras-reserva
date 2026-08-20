import { eq, ne, desc, and, sql, like, inArray, isNull, isNotNull, lte, gte, count, sum } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, units, suppliers, supplierDocuments, supplierUnits, quotations, quotationItems, quotationSuppliers, proposals, proposalItems, purchaseOrders, purchaseOrderItems, deliveryRatings, alerts, auditLogs, securityEvents, loginSessions, priceReferences, priceHistory, systemSettings, priceTargets, fortesItems, purchaseAdjustments, brands, brandRegistry, brandRejectionsGlobal, brandRejectionsUnit, historicalPayments, preferredSuppliers, brandAliases, orderItemRemanagements } from "../drizzle/schema";
import type { InsertUnit, InsertSupplier, InsertQuotation } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ==================== USERS ====================
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);

  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function listAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(users.name);
}

export async function updateUserRole(userId: number, role: "admin" | "comprador" | "aprovador" | "buyer_senior" | "cotador") {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserPassword(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}

// ==================== UNITS ====================
export async function listUnits() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(units).where(eq(units.active, true)).orderBy(units.name);
}

export async function getUnit(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(units).where(eq(units.id, id)).limit(1);
  return result[0];
}

export async function createUnit(data: Omit<InsertUnit, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(units).values(data);
  return result[0].insertId;
}

export async function updateUnit(id: number, data: Partial<InsertUnit>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(units).set(data).where(eq(units.id, id));
}

// ==================== SUPPLIERS ====================
export async function listSuppliers(filters?: { search?: string; state?: string; score?: string }) {
  const db = await getDb();
  if (!db) return [];
  const allSuppliers = await db.select().from(suppliers).where(eq(suppliers.active, true)).orderBy(suppliers.companyName);
  // Attach unit IDs to each supplier
  const allLinks = await db.select().from(supplierUnits).where(eq(supplierUnits.active, true));
  const unitMap = new Map<number, number[]>();
  for (const link of allLinks) {
    if (!unitMap.has(link.supplierId)) unitMap.set(link.supplierId, []);
    unitMap.get(link.supplierId)!.push(link.unitId);
  }
  return allSuppliers.map(s => ({ ...s, unitIds: Array.from(new Set(unitMap.get(s.id) || [])) }));
}

export async function getSupplier(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
  return result[0];
}

export async function createSupplier(data: any) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(suppliers).values(data);
  return result[0].insertId;
}

export async function updateSupplier(id: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(suppliers).set(data).where(eq(suppliers.id, id));
}

// ==================== SUPPLIER UNITS ====================
export async function linkSupplierToUnit(data: { supplierId: number; unitId: number; responsavelNaUnidade?: string; escriturario?: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(supplierUnits).values(data);
  return result[0].insertId;
}

export async function getSupplierUnits(supplierId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(supplierUnits).where(eq(supplierUnits.supplierId, supplierId));
}

export async function getUnitSuppliers(unitId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(supplierUnits).where(eq(supplierUnits.unitId, unitId));
}
export async function getSuppliersByUnit(unitId: number) {
  const db = await getDb();
  if (!db) return [];
  const links = await db.select().from(supplierUnits).where(and(eq(supplierUnits.unitId, unitId), eq(supplierUnits.active, true)));
  if (links.length === 0) return [];
  const supplierIds = links.map(l => l.supplierId);
  return db.select().from(suppliers).where(and(inArray(suppliers.id, supplierIds), eq(suppliers.active, true), eq(suppliers.quotationBlocked, false)));
}

// ==================== SUPPLIER DOCUMENTS ====================
export async function listSupplierDocuments(supplierId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(supplierDocuments).where(eq(supplierDocuments.supplierId, supplierId));
}

export async function createSupplierDocument(data: any) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(supplierDocuments).values(data);
  return result[0].insertId;
}

// ==================== QUOTATIONS ====================
export async function listQuotations(filters?: { status?: string; unitId?: number }) {
  const db = await getDb();
  if (!db) return [];
  const allQuotations = await db.select().from(quotations).orderBy(desc(quotations.createdAt));
  
  // Enrich with proposal count and invited supplier count
  const enriched = await Promise.all(allQuotations.map(async (q) => {
    const qSuppliers = await db.select().from(quotationSuppliers).where(eq(quotationSuppliers.quotationId, q.id));
    const qProposals = await db.select().from(proposals).where(eq(proposals.quotationId, q.id));
    return {
      ...q,
      suppliersInvited: qSuppliers.length,
      proposalsReceived: qProposals.length,
    };
  }));
  return enriched;
}

export async function getQuotation(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(quotations).where(eq(quotations.id, id)).limit(1);
  return result[0];
}

export async function getQuotationByToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(quotations).where(eq(quotations.publicToken, token)).limit(1);
  return result[0];
}

export async function createQuotation(data: any) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(quotations).values(data);
  return result[0].insertId;
}

export async function updateQuotation(id: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(quotations).set(data).where(eq(quotations.id, id));
}

// ==================== QUOTATION ITEMS ====================
export async function listQuotationItems(quotationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(quotationItems).where(eq(quotationItems.quotationId, quotationId));
}

export async function createQuotationItems(items: any[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (items.length === 0) return;
  await db.insert(quotationItems).values(items);
}

// ==================== QUOTATION SUPPLIERS ====================
export async function listQuotationSuppliers(quotationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(quotationSuppliers).where(eq(quotationSuppliers.quotationId, quotationId));
}

export async function addQuotationSuppliers(data: { quotationId: number; supplierId: number }[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (data.length === 0) return;
  await db.insert(quotationSuppliers).values(data);
}

export async function updateQuotationSupplierStatus(quotationId: number, supplierId: number, status: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(quotationSuppliers)
    .set({ status: status as any, respondedAt: status === 'responded' ? new Date() : undefined })
    .where(and(eq(quotationSuppliers.quotationId, quotationId), eq(quotationSuppliers.supplierId, supplierId)));
}

// ==================== PROPOSALS ====================
export async function listProposals(quotationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(proposals).where(eq(proposals.quotationId, quotationId));
}

export async function createProposal(data: any) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(proposals).values(data);
  return result[0].insertId;
}

export async function getProposalItem(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(proposalItems).where(eq(proposalItems.id, id));
  return rows[0] || null;
}

export async function listProposalItems(proposalId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(proposalItems).where(eq(proposalItems.proposalId, proposalId));
}

export async function listProposalItemsByQuotation(quotationId: number) {
  const db = await getDb();
  if (!db) return [];
  const quotationProposals = await db.select({ id: proposals.id }).from(proposals).where(eq(proposals.quotationId, quotationId));
  if (quotationProposals.length === 0) return [];
  const proposalIds = quotationProposals.map(p => p.id);
  return db.select().from(proposalItems).where(inArray(proposalItems.proposalId, proposalIds));
}

export async function createProposalItems(items: any[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (items.length === 0) return;
  await db.insert(proposalItems).values(items);
}

// ==================== PURCHASE ORDERS ====================
export async function listPurchaseOrders(filters?: { status?: string; unitId?: number }) {
  const db = await getDb();
  if (!db) return [];
  const orders = await db.select().from(purchaseOrders).orderBy(desc(purchaseOrders.createdAt));
  
  // Enrich with unit name, category, period, and supplier name from linked quotation
  const enriched = await Promise.all(orders.map(async (o) => {
    let unitName = '';
    let unitState = '';
    let category = '';
    let quotationTitle = '';
    let period = '';
    let supplierName = '';
    
    // Get unit name
    if (o.unitId) {
      const unitResult = await db.select().from(units).where(eq(units.id, o.unitId)).limit(1);
      if (unitResult[0]) {
        unitName = unitResult[0].name;
        unitState = unitResult[0].state;
      }
    }
    
    // Get supplier name
    if (o.supplierId) {
      const supResult = await db.select({ tradeName: suppliers.tradeName, companyName: suppliers.companyName }).from(suppliers).where(eq(suppliers.id, o.supplierId)).limit(1);
      if (supResult[0]) {
        supplierName = supResult[0].tradeName || supResult[0].companyName;
      }
    }
    
    // Get category and period from quotation title
    if (o.quotationId) {
      const qResult = await db.select().from(quotations).where(eq(quotations.id, o.quotationId)).limit(1);
      if (qResult[0]?.title) {
        quotationTitle = qResult[0].title;
        // Extract category from title pattern: "... (Cereais) ..." or "... (Limpeza e Descartáveis) ..."
        const catMatch = qResult[0].title.match(/\(([^)]+)\)/);
        if (catMatch) category = catMatch[1];
        // Use stored period column first, fallback to regex extraction from title
        if (o.period) {
          period = o.period;
        } else {
          // Improved regex: handles "DD/MM a DD/MM", "Consumo DD/MM a DD/MM", "DD/MM/AAAA a DD/MM/AAAA"
          const periodMatch = qResult[0].title.match(/(\d{2}\/\d{2}(?:\/\d{2,4})?)\s*a\s*(\d{2}\/\d{2}(?:\/\d{2,4})?)/);
          if (periodMatch) period = `${periodMatch[1]} a ${periodMatch[2]}`;
        }
      }
      // Fallback: get from quotation_items categories
      if (!category) {
        const itemCats = await db.select({ category: quotationItems.category }).from(quotationItems).where(eq(quotationItems.quotationId, o.quotationId)).limit(5);
        const cats = itemCats.map(i => i.category).filter(Boolean);
        if (cats.length > 0) category = cats[0] || '';
      }
    }
    
    return { ...o, unitName, unitState, category, quotationTitle, period, supplierName };
  }));
  return enriched;
}

export async function getPurchaseOrder(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id)).limit(1);
  return result[0];
}

export async function createPurchaseOrder(data: any) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(purchaseOrders).values(data);
  return result[0].insertId;
}

export async function updatePurchaseOrder(id: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(purchaseOrders).set(data).where(eq(purchaseOrders.id, id));
}

export async function listPurchaseOrderItems(orderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.orderId, orderId));
}

export async function createPurchaseOrderItems(items: any[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (items.length === 0) return;
  await db.insert(purchaseOrderItems).values(items);
}

// ==================== DELIVERY RATINGS ====================
export async function createDeliveryRating(data: any) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(deliveryRatings).values(data);
  return result[0].insertId;
}

export async function listSupplierRatings(supplierId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(deliveryRatings).where(eq(deliveryRatings.supplierId, supplierId)).orderBy(desc(deliveryRatings.createdAt));
}

// ==================== ALERTS ====================
export async function listAlerts(resolved?: boolean) {
  const db = await getDb();
  if (!db) return [];
  if (resolved !== undefined) {
    return db.select().from(alerts).where(eq(alerts.resolved, resolved)).orderBy(desc(alerts.createdAt));
  }
  return db.select().from(alerts).orderBy(desc(alerts.createdAt));
}

export async function createAlert(data: any) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(alerts).values(data);
  return result[0].insertId;
}

export async function resolveAlert(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(alerts).set({ resolved: true, resolvedBy: userId, resolvedAt: new Date() }).where(eq(alerts.id, id));
}

// ==================== AUDIT LOGS (ENHANCED SECURITY) ====================
export async function createAuditLog(data: {
  userId?: number | null;
  userName?: string;
  userRole?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  details?: Record<string, unknown> | string;
  ipAddress?: string;
  userAgent?: string;
  sessionFingerprint?: string;
  severity?: "info" | "warning" | "critical";
  // Legacy compatibility
  userEmail?: string;
  entityType?: string;
  entityId?: number;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditLogs).values({
    userId: data.userId ?? null,
    userName: data.userName || null,
    userRole: data.userRole || null,
    action: data.action,
    resource: data.resource || data.entityType || "unknown",
    resourceId: data.resourceId || (data.entityId ? String(data.entityId) : null),
    details: typeof data.details === "string" ? data.details : data.details ? JSON.stringify(data.details) : null,
    ipAddress: data.ipAddress || null,
    userAgent: data.userAgent || null,
    sessionFingerprint: data.sessionFingerprint || null,
    severity: data.severity || "info",
  });
}

export async function listAuditLogs(opts: { limit?: number; userId?: number; action?: string; resource?: string; severity?: string; offset?: number } = {}) {
  const db = await getDb();
  if (!db) return [];
  const { limit = 100, offset = 0 } = opts;
  const conditions: any[] = [];
  if (opts.userId) conditions.push(eq(auditLogs.userId, opts.userId));
  if (opts.action) conditions.push(eq(auditLogs.action, opts.action));
  if (opts.resource) conditions.push(eq(auditLogs.resource, opts.resource));
  if (opts.severity) conditions.push(eq(auditLogs.severity, opts.severity as any));
  const query = conditions.length > 0
    ? db.select().from(auditLogs).where(and(...conditions)).orderBy(desc(auditLogs.createdAt)).limit(limit).offset(offset)
    : db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit).offset(offset);
  return query;
}

// ==================== SECURITY EVENTS ====================
export async function createSecurityEvent(data: {
  eventType: string;
  userId?: number | null;
  userName?: string;
  description: string;
  details?: Record<string, unknown> | string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(securityEvents).values({
    eventType: data.eventType,
    userId: data.userId ?? null,
    userName: data.userName || null,
    description: data.description,
    details: typeof data.details === "string" ? data.details : data.details ? JSON.stringify(data.details) : null,
    ipAddress: data.ipAddress || null,
    userAgent: data.userAgent || null,
    resolved: false,
    notifiedOwner: false,
  });
}

export async function listSecurityEvents(opts: { limit?: number; resolved?: boolean; eventType?: string } = {}) {
  const db = await getDb();
  if (!db) return [];
  const { limit = 50 } = opts;
  const conditions: any[] = [];
  if (opts.resolved !== undefined) conditions.push(eq(securityEvents.resolved, opts.resolved));
  if (opts.eventType) conditions.push(eq(securityEvents.eventType, opts.eventType));
  const query = conditions.length > 0
    ? db.select().from(securityEvents).where(and(...conditions)).orderBy(desc(securityEvents.createdAt)).limit(limit)
    : db.select().from(securityEvents).orderBy(desc(securityEvents.createdAt)).limit(limit);
  return query;
}

export async function resolveSecurityEvent(id: number, resolvedBy: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(securityEvents).set({ resolved: true, resolvedBy, resolvedAt: new Date() }).where(eq(securityEvents.id, id));
}

// ==================== QUOTATION DISPATCH ====================
export async function getQuotationSuppliersWithContacts(quotationId: number) {
  const db = await getDb();
  if (!db) return [];
  // Get supplier IDs linked to this quotation
  const qSuppliers = await db.select().from(quotationSuppliers).where(eq(quotationSuppliers.quotationId, quotationId));
  if (qSuppliers.length === 0) return [];
  const supplierIds = qSuppliers.map(qs => qs.supplierId);
  const supplierList = await db.select().from(suppliers).where(inArray(suppliers.id, supplierIds));
  return supplierList.map(s => {
    const qs = qSuppliers.find(q => q.supplierId === s.id);
    return {
      ...s,
      inviteStatus: qs?.status || 'pending',
      invitedAt: qs?.invitedAt,
      respondedAt: qs?.respondedAt,
    };
  });
}

export async function markQuotationSupplierInvited(quotationId: number, supplierId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(quotationSuppliers)
    .set({ invitedAt: new Date() })
    .where(and(eq(quotationSuppliers.quotationId, quotationId), eq(quotationSuppliers.supplierId, supplierId)));
}

// ==================== PRICE REFERENCES ====================
export async function getPriceReference(productName: string, region?: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(priceReferences)
    .where(like(priceReferences.productName, `%${productName}%`))
    .limit(1);
  return result[0];
}

export async function upsertPriceReference(data: any) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(priceReferences).values(data).onDuplicateKeyUpdate({ set: data });
}

// ==================== DASHBOARD KPIs ====================
// ==================== PRICE HISTORY / ANALYTICS ====================
export async function recordPrice(data: {
  productName: string;
  productCode?: string;
  supplierId: number;
  supplierName?: string;
  brand?: string;
  unitId?: number;
  unitName?: string;
  unitPrice: string;
  quantity?: string;
  unit?: string;
  quotationId?: number;
  orderId?: number;
  source?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(priceHistory).values(data as any);
}

export async function recordPriceBatch(records: Array<{
  productName: string;
  productCode?: string;
  supplierId: number;
  supplierName?: string;
  brand?: string;
  unitId?: number;
  unitName?: string;
  unitPrice: string;
  quantity?: string;
  unit?: string;
  quotationId?: number;
  orderId?: number;
  source?: string;
}>) {
  const db = await getDb();
  if (!db) return;
  if (records.length === 0) return;
  await db.insert(priceHistory).values(records as any);
}

export async function getProductPriceHistory(productName: string, limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(priceHistory)
    .where(like(priceHistory.productName, `%${productName}%`))
    .orderBy(desc(priceHistory.recordedAt))
    .limit(limit);
}

export async function getSupplierPriceHistory(supplierId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(priceHistory)
    .where(eq(priceHistory.supplierId, supplierId))
    .orderBy(desc(priceHistory.recordedAt))
    .limit(limit);
}

export async function getLastPriceForSupplierProduct(supplierId: number, productName: string) {
  const db = await getDb();
  if (!db) return null;
  const results = await db.select().from(priceHistory)
    .where(and(eq(priceHistory.supplierId, supplierId), eq(priceHistory.productName, productName)))
    .orderBy(desc(priceHistory.recordedAt))
    .limit(1);
  return results[0] || null;
}

export async function getProductPriceHistoryForSupplier(supplierId: number, productName: string, excludeQuotationId: number) {
  const db = await getDb();
  if (!db) return null;
  const results = await db.select().from(priceHistory)
    .where(and(
      eq(priceHistory.supplierId, supplierId),
      eq(priceHistory.productName, productName),
      ne(priceHistory.quotationId, excludeQuotationId)
    ))
    .orderBy(desc(priceHistory.recordedAt))
    .limit(1);
  return results[0] || null;
}
export async function getCrossComparison(unitId?: number, category?: string) {
  const db = await getDb();
  if (!db) return { products: [], suppliers: [], bestOverall: null, supplierWins: [] };

  // Get all price history records, optionally filtered by unit
  // Always exclude outlier prices (>R$200 per unit - clearly wrong entries)
  const conditions: any[] = [sql`CAST(${priceHistory.unitPrice} AS DECIMAL(12,2)) <= 200`];
  if (unitId) conditions.push(eq(priceHistory.unitId, unitId));

  const allPrices = await db.select().from(priceHistory)
    .where(and(...conditions))
    .orderBy(desc(priceHistory.recordedAt));

  // Get unique suppliers from price data
  const supplierMap = new Map<number, { id: number; name: string; tradeName?: string }>(); 
  const productMap = new Map<string, { productName: string; unit?: string; prices: Record<number, number> }>();

  // Get latest price per product per supplier
  const seen = new Set<string>();
  for (const record of allPrices) {
    const key = `${record.productName}__${record.supplierId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Filter by category if provided (simple keyword match on product name)
    if (category) {
      const catLower = category.toLowerCase();
      const nameLower = record.productName.toLowerCase();
      // Basic category matching
      const categoryKeywords: Record<string, string[]> = {
        "cereais": ["arroz", "feijão", "feijao", "macarrão", "macarrao", "farinha", "aveia", "fubá", "fuba", "milho", "trigo", "achocolatado", "café", "cafe", "açúcar", "acucar", "sal", "óleo", "oleo", "vinagre", "molho", "extrato", "tempero", "colorau", "cominho", "orégano", "oregano", "alho", "cebola", "leite", "creme", "margarina", "manteiga"],
        "proteína": ["carne", "frango", "peixe", "ovo", "linguiça", "linguica", "salsicha", "bacon", "charque", "costela", "filé", "file", "coxa", "sobrecoxa", "peito", "acém", "acem", "patinho", "alcatra", "músculo", "musculo", "suíno", "suino", "rabo"],
        "hortifruti": ["tomate", "alface", "cebola", "batata", "cenoura", "banana", "laranja", "limão", "limao", "maçã", "maca", "repolho", "pepino", "pimentão", "pimentao", "abóbora", "abobora", "beterraba", "chuchu", "quiabo"],
        "limpeza e descartáveis": ["detergente", "desinfetante", "água sanitária", "agua sanitaria", "sabão", "sabao", "esponja", "vassoura", "rodo", "pano", "copo", "guardanapo", "filme", "palito", "saco", "touca", "luva", "descartável", "descartavel", "limpa"],
        "gás": ["gás", "gas", "glp", "botijão", "botijao"],
        "pão": ["pão", "pao", "bisnaga", "francês", "frances"],
      };
      const keywords = categoryKeywords[catLower] || [];
      if (keywords.length > 0 && !keywords.some(kw => nameLower.includes(kw))) continue;
    }

    if (!supplierMap.has(record.supplierId)) {
      supplierMap.set(record.supplierId, { id: record.supplierId, name: record.supplierName || `Fornecedor ${record.supplierId}` });
    }

    if (!productMap.has(record.productName)) {
      productMap.set(record.productName, { productName: record.productName, unit: record.unit || undefined, prices: {} });
    }
    const product = productMap.get(record.productName)!;
    product.prices[record.supplierId] = parseFloat(String(record.unitPrice));
  }

  // Calculate wins per supplier
  const winsMap = new Map<number, number>();
  const productArr = Array.from(productMap.values());
  for (const product of productArr) {
    const validPrices = Object.entries(product.prices).filter(([_, p]) => (p as number) > 0) as [string, number][];
    if (validPrices.length < 2) continue;
    const minPrice = Math.min(...validPrices.map(([_, p]) => p));
    for (const [sid, price] of validPrices) {
      if (price === minPrice) {
        winsMap.set(Number(sid), (winsMap.get(Number(sid)) || 0) + 1);
      }
    }
  }

  const suppliers = Array.from(supplierMap.values());
  const products = Array.from(productMap.values()).sort((a, b) => a.productName.localeCompare(b.productName));
  const supplierWins = suppliers.map(s => ({ supplierId: s.id, supplierName: s.name, wins: winsMap.get(s.id) || 0 }));
  const bestOverall = supplierWins.sort((a, b) => b.wins - a.wins)[0] || null;

  return {
    products,
    suppliers,
    bestOverall: bestOverall ? { name: bestOverall.supplierName, wins: bestOverall.wins } : null,
    supplierWins,
  };
}

export async function getAnalyticsData() {
  const db = await getDb();
  if (!db) return { priceHistory: [], topProductsRaw: [], spendByCategory: [], supplierRanking: [], totalSpend: "0", totalSaving: "0", savingNegociacao: "0", savingCompetitiva: "0", savingMedia: "0", savingsByUnit: [] };
  
  const OUTLIER_PRICE_THRESHOLD = 200;
  
  // Get all price history for charts (excluding outliers)
  const history = await db.select().from(priceHistory)
    .where(sql`CAST(${priceHistory.unitPrice} AS DECIMAL(12,2)) <= ${OUTLIER_PRICE_THRESHOLD} AND CAST(${priceHistory.unitPrice} AS DECIMAL(12,2)) > 0`)
    .orderBy(desc(priceHistory.recordedAt))
    .limit(500);
  
  // Get total spend from non-cancelled orders
  const [spendResult] = await db.select({ total: sum(purchaseOrders.totalValue) })
    .from(purchaseOrders)
    .where(sql`${purchaseOrders.status} NOT IN ('cancelled')`);
  
  // === 3-DIMENSIONAL SAVING CALCULATION ===
  // 1. Saving por Negociação: preço anterior vs preço atual do MESMO produto+marca
  const savingNegociacaoQuery = await db.execute(sql`
    SELECT COALESCE(SUM(saving_amount), 0) as total FROM (
      SELECT 
        (prev.unitPrice - curr.unitPrice) * curr.quantity as saving_amount
      FROM (
        SELECT ph.productName, ph.brand, CAST(ph.unitPrice AS DECIMAL(12,2)) as unitPrice, 
               CAST(ph.quantity AS DECIMAL(12,3)) as quantity, ph.recordedAt,
               ROW_NUMBER() OVER (PARTITION BY ph.productName, COALESCE(ph.brand,'') ORDER BY ph.recordedAt DESC) as rn
        FROM price_history ph
        WHERE CAST(ph.unitPrice AS DECIMAL(12,2)) <= ${OUTLIER_PRICE_THRESHOLD}
        AND CAST(ph.unitPrice AS DECIMAL(12,2)) > 0
      ) curr
      JOIN (
        SELECT ph.productName, ph.brand, CAST(ph.unitPrice AS DECIMAL(12,2)) as unitPrice, ph.recordedAt,
               ROW_NUMBER() OVER (PARTITION BY ph.productName, COALESCE(ph.brand,'') ORDER BY ph.recordedAt DESC) as rn
        FROM price_history ph
        WHERE CAST(ph.unitPrice AS DECIMAL(12,2)) <= ${OUTLIER_PRICE_THRESHOLD}
        AND CAST(ph.unitPrice AS DECIMAL(12,2)) > 0
      ) prev ON prev.productName = curr.productName 
        AND COALESCE(prev.brand,'') = COALESCE(curr.brand,'')
        AND prev.rn = 2
      WHERE curr.rn = 1
      AND prev.unitPrice > curr.unitPrice
    ) t
  `);
  const savingNegociacao = parseFloat(((savingNegociacaoQuery as any)?.[0]?.[0]?.total) || "0");

  // 2. Saving por Cotação Competitiva: 2º melhor preço vs preço comprado
  const savingCompetitivaQuery = await db.execute(sql`
    SELECT COALESCE(SUM(saving_amount), 0) as total FROM (
      SELECT 
        (second_price - min_price) * qty as saving_amount
      FROM (
        SELECT qi.id, CAST(qi.quantity AS DECIMAL(12,3)) as qty,
          MIN(CAST(pi.unitPrice AS DECIMAL(12,2))) as min_price,
          (SELECT CAST(pi2.unitPrice AS DECIMAL(12,2)) FROM proposal_items pi2 
           WHERE pi2.quotationItemId = qi.id 
           AND CAST(pi2.unitPrice AS DECIMAL(12,2)) <= ${OUTLIER_PRICE_THRESHOLD}
           AND CAST(pi2.unitPrice AS DECIMAL(12,2)) > 0
           ORDER BY CAST(pi2.unitPrice AS DECIMAL(12,2)) ASC LIMIT 1 OFFSET 1) as second_price
        FROM quotation_items qi
        JOIN proposal_items pi ON pi.quotationItemId = qi.id
        JOIN quotations q ON q.id = qi.quotationId
        WHERE q.status IN ('ordered', 'closed')
        AND CAST(pi.unitPrice AS DECIMAL(12,2)) <= ${OUTLIER_PRICE_THRESHOLD}
        AND CAST(pi.unitPrice AS DECIMAL(12,2)) > 0
        GROUP BY qi.id, qi.quantity
        HAVING COUNT(DISTINCT pi.proposalId) > 1
      ) t2
      WHERE second_price IS NOT NULL AND second_price > min_price
    ) t
  `);
  const savingCompetitiva = parseFloat(((savingCompetitivaQuery as any)?.[0]?.[0]?.total) || "0");

  // 3. Saving vs Média Histórica: preço pago vs média histórica do item
  const savingMediaQuery = await db.execute(sql`
    SELECT COALESCE(SUM(saving_amount), 0) as total FROM (
      SELECT 
        (avg_price - curr_price) * curr_qty as saving_amount
      FROM (
        SELECT ph.productName, COALESCE(ph.brand,'') as brand_key,
               CAST(ph.unitPrice AS DECIMAL(12,2)) as curr_price,
               CAST(ph.quantity AS DECIMAL(12,3)) as curr_qty,
               ROW_NUMBER() OVER (PARTITION BY ph.productName, COALESCE(ph.brand,'') ORDER BY ph.recordedAt DESC) as rn
        FROM price_history ph
        WHERE CAST(ph.unitPrice AS DECIMAL(12,2)) <= ${OUTLIER_PRICE_THRESHOLD}
        AND CAST(ph.unitPrice AS DECIMAL(12,2)) > 0
      ) latest
      JOIN (
        SELECT productName, COALESCE(brand,'') as brand_key,
               AVG(CAST(unitPrice AS DECIMAL(12,2))) as avg_price
        FROM price_history
        WHERE CAST(unitPrice AS DECIMAL(12,2)) <= ${OUTLIER_PRICE_THRESHOLD}
        AND CAST(unitPrice AS DECIMAL(12,2)) > 0
        GROUP BY productName, COALESCE(brand,'')
        HAVING COUNT(*) >= 2
      ) hist ON hist.productName = latest.productName AND hist.brand_key = latest.brand_key
      WHERE latest.rn = 1
      AND hist.avg_price > latest.curr_price
    ) t
  `);
  const savingMedia = parseFloat(((savingMediaQuery as any)?.[0]?.[0]?.total) || "0");

  const totalSaving = savingNegociacao + savingCompetitiva + savingMedia;

  // Top products with price evolution (for analytics table)
  const topProductsQuery = await db.execute(sql`
    SELECT productName, brand, 
           CAST(unitPrice AS DECIMAL(12,2)) as unitPrice,
           CAST(quantity AS DECIMAL(12,3)) as quantity,
           supplierName, recordedAt
    FROM price_history
    WHERE CAST(unitPrice AS DECIMAL(12,2)) <= ${OUTLIER_PRICE_THRESHOLD}
    AND CAST(unitPrice AS DECIMAL(12,2)) > 0
    ORDER BY recordedAt DESC
    LIMIT 300
  `);
  const topProductsRaw = (topProductsQuery as any)?.[0] || [];
  
  // Get supplier ranking by total value
  const supplierRanking = await db.select({
    supplierId: priceHistory.supplierId,
    orderCount: count(),
    totalValue: sql<string>`CAST(SUM(CAST(${priceHistory.unitPrice} AS DECIMAL(12,2)) * CAST(${priceHistory.quantity} AS DECIMAL(12,3))) AS CHAR)`,
  }).from(priceHistory)
    .where(sql`CAST(${priceHistory.unitPrice} AS DECIMAL(12,2)) <= ${OUTLIER_PRICE_THRESHOLD} AND CAST(${priceHistory.unitPrice} AS DECIMAL(12,2)) > 0`)
    .groupBy(priceHistory.supplierId)
    .orderBy(desc(sql`SUM(CAST(${priceHistory.unitPrice} AS DECIMAL(12,2)) * CAST(${priceHistory.quantity} AS DECIMAL(12,3)))`))
    .limit(10);
  
  // Category distribution
  const categorySpend = await db.select({
    category: quotationItems.category,
    itemCount: count(),
  }).from(quotationItems)
    .groupBy(quotationItems.category)
    .orderBy(desc(count()));
  
  // Spend by unit - excluding empty/null unit names
  const spendByUnit = await db.select({
    unitName: priceHistory.unitName,
    totalValue: sql<string>`CAST(SUM(CAST(${priceHistory.unitPrice} AS DECIMAL(12,2)) * CAST(${priceHistory.quantity} AS DECIMAL(12,3))) AS CHAR)`,
    itemCount: count(),
  }).from(priceHistory)
    .where(sql`CAST(${priceHistory.unitPrice} AS DECIMAL(12,2)) <= ${OUTLIER_PRICE_THRESHOLD} AND CAST(${priceHistory.unitPrice} AS DECIMAL(12,2)) > 0 AND ${priceHistory.unitName} IS NOT NULL AND ${priceHistory.unitName} != '' AND ${priceHistory.unitName} != 'Sem unidade'`)
    .groupBy(priceHistory.unitName)
    .orderBy(desc(sql`SUM(CAST(${priceHistory.unitPrice} AS DECIMAL(12,2)) * CAST(${priceHistory.quantity} AS DECIMAL(12,3)))`))
    .limit(10);
  
  return {
    priceHistory: history,
    topProductsRaw,
    totalSpend: spendResult?.total || "0",
    totalSaving: totalSaving.toFixed(2),
    savingNegociacao: savingNegociacao.toFixed(2),
    savingCompetitiva: savingCompetitiva.toFixed(2),
    savingMedia: savingMedia.toFixed(2),
    supplierRanking,
    spendByCategory: categorySpend,
    savingsByUnit: spendByUnit,
  };
}

// Deterministic supplier scoring based on real price history
export async function getSupplierScores(category: string, unitName?: string) {
  const db = await getDb();
  if (!db) return [];
  
  // Get all suppliers matching category
  const allSuppliers = await db.select().from(suppliers).where(eq(suppliers.active, true));
  const matchingSuppliers = allSuppliers.filter(s => {
    const cats: string[] = Array.isArray(s.categories) ? s.categories : (s.categories ? JSON.parse(s.categories as unknown as string) : []);
    return cats.some((c: string) => c.toLowerCase().includes(category.toLowerCase()));
  });
  
  if (matchingSuppliers.length === 0) return [];
  
  const scores = [];
  for (const supplier of matchingSuppliers) {
    // Price score: average price relative to the cheapest supplier for same products
    // Exclude outlier prices (>R$200) from scoring
    const priceData = await db.select({
      avgPrice: sql<string>`AVG(CAST(${priceHistory.unitPrice} AS DECIMAL(12,2)))`,
      entryCount: count(),
    }).from(priceHistory)
      .where(and(eq(priceHistory.supplierId, supplier.id), sql`CAST(${priceHistory.unitPrice} AS DECIMAL(12,2)) <= 200`));
    
    const supplierAvgPrice = parseFloat(priceData[0]?.avgPrice || "0");
    const entryCount = priceData[0]?.entryCount || 0;
    
    // Get global min average for comparison (excluding outliers)
    const [globalMin] = await db.select({
      minAvg: sql<string>`MIN(avg_price)`,
    }).from(
      db.select({
        avg_price: sql<string>`AVG(CAST(${priceHistory.unitPrice} AS DECIMAL(12,2)))`,
      }).from(priceHistory)
        .where(sql`CAST(${priceHistory.unitPrice} AS DECIMAL(12,2)) <= 200`)
        .groupBy(priceHistory.supplierId)
        .as('sub')
    );
    
    const globalMinPrice = parseFloat(globalMin?.minAvg || "1");
    // Price score: 100 if cheapest, decreasing proportionally
    const priceScore = globalMinPrice > 0 && supplierAvgPrice > 0
      ? Math.max(0, Math.min(100, Math.round((globalMinPrice / supplierAvgPrice) * 100)))
      : 50; // Default if no data
    
    // Logistics score: based on same state as unit
    const unitState = getUnitState(unitName || '');
    const supplierState = supplier.state || '';
    const logisticsScore = supplierState.toLowerCase() === unitState.toLowerCase() ? 95
      : isNearbyState(supplierState, unitState) ? 75
      : 50;
    
    // Response score: based on delivery days
    const deliveryDays = parseInt(supplier.deliveryDays || '5') || 5;
    const responseScore = deliveryDays <= 2 ? 95 : deliveryDays <= 4 ? 80 : deliveryDays <= 7 ? 65 : 50;
    
    // Weighted total: price 50%, logistics 30%, response 20%
    const totalScore = Math.round((priceScore * 0.5) + (logisticsScore * 0.3) + (responseScore * 0.2));
    
    scores.push({
      id: supplier.id,
      name: supplier.tradeName || supplier.companyName || `Fornecedor #${supplier.id}`,
      state: supplier.state || 'N/I',
      priceScore,
      logisticsScore,
      responseScore,
      totalScore,
      avgPrice: supplierAvgPrice.toFixed(2),
      deliveryDays: supplier.deliveryDays || 'N/I',
      historyEntries: entryCount,
    });
  }
  
  return scores.sort((a, b) => b.totalScore - a.totalScore);
}

function getUnitState(unitName: string): string {
  const mapping: Record<string, string> = {
    'COCALINHO': 'MS', 'cocalinho': 'MS',
    'MARANGUAPE': 'CE', 'maranguape': 'CE',
    'IPAUMIRIM': 'CE', 'ipaumirim': 'CE',
    'FORTALEZA': 'CE', 'fortaleza': 'CE',
    'EUSEBIO': 'CE', 'eusebio': 'CE',
  };
  return mapping[unitName.toUpperCase()] || mapping[unitName] || '';
}

function isNearbyState(state1: string, state2: string): boolean {
  const regions: Record<string, string[]> = {
    'NE': ['CE', 'PB', 'PE', 'RN', 'PI', 'MA', 'AL', 'SE', 'BA'],
    'SE': ['SP', 'RJ', 'MG', 'ES'],
    'CO': ['GO', 'MT', 'MS', 'DF'],
    'N': ['PA', 'AM', 'TO', 'RO', 'AC', 'RR', 'AP'],
    'S': ['PR', 'SC', 'RS'],
  };
  for (const region of Object.values(regions)) {
    if (region.includes(state1.toUpperCase()) && region.includes(state2.toUpperCase())) return true;
  }
  return false;
}

export async function getDashboardKPIs() {
  const db = await getDb();
  if (!db) return { openQuotations: 0, pendingOrders: 0, activeSuppliers: 0, unresolvedAlerts: 0, totalSaving: "0", savingNegociacao: "0", savingCompetitiva: "0", savingMedia: "0", totalPurchased: "0", totalOrders: 0, avgOrderValue: "0", topSuppliers: [], recentOrders: [], purchasesByMonth: [], categoryDistribution: [], savingPercentage: "0" };
  const OUTLIER_PRICE_THRESHOLD = 200;
  const [openQuots] = await db.select({ count: count() }).from(quotations).where(eq(quotations.status, "open"));
  const [pendingOrd] = await db.select({ count: count() }).from(purchaseOrders).where(eq(purchaseOrders.status, "pending_approval"));
  const [activeSup] = await db.select({ count: count() }).from(suppliers).where(eq(suppliers.active, true));
  const [unresolvedAl] = await db.select({ count: count() }).from(alerts).where(eq(alerts.resolved, false));
  // Total purchased (non-cancelled)
  const [totalPurch] = await db.select({ total: sum(purchaseOrders.totalValue), cnt: count() })
    .from(purchaseOrders)
    .where(sql`${purchaseOrders.status} NOT IN ('cancelled')`);
  const totalPurchased = totalPurch?.total || "0";
  const totalOrders = totalPurch?.cnt || 0;
  const avgOrderValue = totalOrders > 0 ? (parseFloat(totalPurchased) / totalOrders).toFixed(2) : "0";
  // === 3-DIMENSIONAL SAVING CALCULATION ===
  // 1. Saving por Negociação: preço anterior vs preço atual do MESMO produto+marca
  const savingNegociacaoQuery = await db.execute(sql`
    SELECT COALESCE(SUM(saving_amount), 0) as total FROM (
      SELECT 
        (prev.unitPrice - curr.unitPrice) * curr.quantity as saving_amount
      FROM (
        SELECT ph.productName, ph.brand, CAST(ph.unitPrice AS DECIMAL(12,2)) as unitPrice, 
               CAST(ph.quantity AS DECIMAL(12,3)) as quantity, ph.recordedAt,
               ROW_NUMBER() OVER (PARTITION BY ph.productName, COALESCE(ph.brand,'') ORDER BY ph.recordedAt DESC) as rn
        FROM price_history ph
        WHERE CAST(ph.unitPrice AS DECIMAL(12,2)) <= ${OUTLIER_PRICE_THRESHOLD}
        AND CAST(ph.unitPrice AS DECIMAL(12,2)) > 0
      ) curr
      JOIN (
        SELECT ph.productName, ph.brand, CAST(ph.unitPrice AS DECIMAL(12,2)) as unitPrice, ph.recordedAt,
               ROW_NUMBER() OVER (PARTITION BY ph.productName, COALESCE(ph.brand,'') ORDER BY ph.recordedAt DESC) as rn
        FROM price_history ph
        WHERE CAST(ph.unitPrice AS DECIMAL(12,2)) <= ${OUTLIER_PRICE_THRESHOLD}
        AND CAST(ph.unitPrice AS DECIMAL(12,2)) > 0
      ) prev ON prev.productName = curr.productName 
        AND COALESCE(prev.brand,'') = COALESCE(curr.brand,'')
        AND prev.rn = 2
      WHERE curr.rn = 1
      AND prev.unitPrice > curr.unitPrice
    ) t
  `);
  const savingNegociacao = parseFloat(((savingNegociacaoQuery as any)?.[0]?.[0]?.total) || "0");

  // 2. Saving por Cotação Competitiva: 2º melhor preço vs preço comprado (dentro da mesma cotação)
  const savingCompetitivaQuery = await db.execute(sql`
    SELECT COALESCE(SUM(saving_amount), 0) as total FROM (
      SELECT 
        (second_price - min_price) * qty as saving_amount
      FROM (
        SELECT qi.id, CAST(qi.quantity AS DECIMAL(12,3)) as qty,
          MIN(CAST(pi.unitPrice AS DECIMAL(12,2))) as min_price,
          (SELECT CAST(pi2.unitPrice AS DECIMAL(12,2)) FROM proposal_items pi2 
           WHERE pi2.quotationItemId = qi.id 
           AND CAST(pi2.unitPrice AS DECIMAL(12,2)) <= ${OUTLIER_PRICE_THRESHOLD}
           AND CAST(pi2.unitPrice AS DECIMAL(12,2)) > 0
           ORDER BY CAST(pi2.unitPrice AS DECIMAL(12,2)) ASC LIMIT 1 OFFSET 1) as second_price
        FROM quotation_items qi
        JOIN proposal_items pi ON pi.quotationItemId = qi.id
        JOIN quotations q ON q.id = qi.quotationId
        WHERE q.status IN ('ordered', 'closed')
        AND CAST(pi.unitPrice AS DECIMAL(12,2)) <= ${OUTLIER_PRICE_THRESHOLD}
        AND CAST(pi.unitPrice AS DECIMAL(12,2)) > 0
        GROUP BY qi.id, qi.quantity
        HAVING COUNT(DISTINCT pi.proposalId) > 1
      ) t2
      WHERE second_price IS NOT NULL AND second_price > min_price
    ) t
  `);
  const savingCompetitiva = parseFloat(((savingCompetitivaQuery as any)?.[0]?.[0]?.total) || "0");

  // 3. Saving vs Média Histórica: preço pago vs média histórica do item
  const savingMediaQuery = await db.execute(sql`
    SELECT COALESCE(SUM(saving_amount), 0) as total FROM (
      SELECT 
        (avg_price - curr_price) * curr_qty as saving_amount
      FROM (
        SELECT ph.productName, COALESCE(ph.brand,'') as brand_key,
               CAST(ph.unitPrice AS DECIMAL(12,2)) as curr_price,
               CAST(ph.quantity AS DECIMAL(12,3)) as curr_qty,
               ROW_NUMBER() OVER (PARTITION BY ph.productName, COALESCE(ph.brand,'') ORDER BY ph.recordedAt DESC) as rn
        FROM price_history ph
        WHERE CAST(ph.unitPrice AS DECIMAL(12,2)) <= ${OUTLIER_PRICE_THRESHOLD}
        AND CAST(ph.unitPrice AS DECIMAL(12,2)) > 0
      ) latest
      JOIN (
        SELECT productName, COALESCE(brand,'') as brand_key,
               AVG(CAST(unitPrice AS DECIMAL(12,2))) as avg_price
        FROM price_history
        WHERE CAST(unitPrice AS DECIMAL(12,2)) <= ${OUTLIER_PRICE_THRESHOLD}
        AND CAST(unitPrice AS DECIMAL(12,2)) > 0
        GROUP BY productName, COALESCE(brand,'')
        HAVING COUNT(*) >= 2
      ) hist ON hist.productName = latest.productName AND hist.brand_key = latest.brand_key
      WHERE latest.rn = 1
      AND hist.avg_price > latest.curr_price
    ) t
  `);
  const savingMedia = parseFloat(((savingMediaQuery as any)?.[0]?.[0]?.total) || "0");

  const totalSaving = (savingNegociacao + savingCompetitiva + savingMedia).toFixed(2);
  const savingPercentage = parseFloat(totalPurchased) > 0 ? ((parseFloat(totalSaving) / (parseFloat(totalPurchased) + parseFloat(totalSaving))) * 100).toFixed(1) : "0";
  // Top 5 suppliers by volume
  const topSuppliers = await db.select({
    supplierId: purchaseOrders.supplierId,
    totalValue: sql<string>`CAST(SUM(CAST(${purchaseOrders.totalValue} AS DECIMAL(14,2))) AS CHAR)`,
    orderCount: count(),
  }).from(purchaseOrders)
    .where(sql`${purchaseOrders.status} NOT IN ('cancelled')`)
    .groupBy(purchaseOrders.supplierId)
    .orderBy(desc(sql`SUM(CAST(${purchaseOrders.totalValue} AS DECIMAL(14,2)))`))
    .limit(5);
  // Enrich with supplier names
  const enrichedTopSuppliers = [];
  for (const ts of topSuppliers) {
    const [sup] = await db.select({ tradeName: suppliers.tradeName, companyName: suppliers.companyName }).from(suppliers).where(eq(suppliers.id, ts.supplierId)).limit(1);
    enrichedTopSuppliers.push({ ...ts, name: sup?.tradeName || sup?.companyName || `Fornecedor #${ts.supplierId}` });
  }
  // Recent 5 orders (non-cancelled)
  const recentOrders = await db.select({
    id: purchaseOrders.id,
    code: purchaseOrders.code,
    totalValue: purchaseOrders.totalValue,
    status: purchaseOrders.status,
    createdAt: purchaseOrders.createdAt,
    supplierId: purchaseOrders.supplierId,
  }).from(purchaseOrders)
    .where(sql`${purchaseOrders.status} NOT IN ('cancelled')`)
    .orderBy(desc(purchaseOrders.createdAt))
    .limit(5);
  const enrichedRecentOrders = [];
  for (const ro of recentOrders) {
    const [sup] = await db.select({ tradeName: suppliers.tradeName, companyName: suppliers.companyName }).from(suppliers).where(eq(suppliers.id, ro.supplierId)).limit(1);
    enrichedRecentOrders.push({ ...ro, supplierName: sup?.tradeName || sup?.companyName || '' });
  }
  // Purchases by month (last 6 months)
  const purchasesByMonth = await db.execute(sql`
    SELECT DATE_FORMAT(createdAt, '%Y-%m') as month, 
           COUNT(*) as order_count, 
           CAST(SUM(CAST(totalValue AS DECIMAL(14,2))) AS CHAR) as total_value
    FROM purchase_orders 
    WHERE status NOT IN ('cancelled')
    GROUP BY DATE_FORMAT(createdAt, '%Y-%m')
    ORDER BY month DESC
    LIMIT 6
  `);
  // Category distribution from quotation_items
  const categoryDistribution = await db.select({
    category: quotationItems.category,
    itemCount: count(),
  }).from(quotationItems)
    .groupBy(quotationItems.category)
    .orderBy(desc(count()))
    .limit(8);
  return {
    openQuotations: openQuots?.count || 0,
    pendingOrders: pendingOrd?.count || 0,
    activeSuppliers: activeSup?.count || 0,
    unresolvedAlerts: unresolvedAl?.count || 0,
    totalSaving,
    savingNegociacao: savingNegociacao.toFixed(2),
    savingCompetitiva: savingCompetitiva.toFixed(2),
    savingMedia: savingMedia.toFixed(2),
    totalPurchased,
    totalOrders,
    avgOrderValue,
    savingPercentage,
    topSuppliers: enrichedTopSuppliers,
    recentOrders: enrichedRecentOrders,
    purchasesByMonth: (purchasesByMonth as any)?.[0] || [],
    categoryDistribution,
  };
}

// ==================== SYSTEM SETTINGS ====================
export async function getSystemSetting(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(systemSettings).where(eq(systemSettings.settingKey, key)).limit(1);
  return row?.settingValue || null;
}

export async function setSystemSetting(key: string, value: string, updatedBy?: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(systemSettings).values({ settingKey: key, settingValue: value, updatedBy })
    .onDuplicateKeyUpdate({ set: { settingValue: value, updatedBy } });
}

export async function getUniversalPassword(): Promise<string> {
  const pwd = await getSystemSetting("universal_password");
  return pwd || "319918"; // fallback to default
}


// ==================== DELETE QUOTATION ====================
export async function deleteQuotation(quotationId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  // Delete in order: proposal_items → proposals → quotation_items → quotation_suppliers → quotation
  const existingProposals = await db.select().from(proposals).where(eq(proposals.quotationId, quotationId));
  for (const p of existingProposals) {
    await db.delete(proposalItems).where(eq(proposalItems.proposalId, p.id));
  }
  await db.delete(proposals).where(eq(proposals.quotationId, quotationId));
  await db.delete(quotationItems).where(eq(quotationItems.quotationId, quotationId));
  await db.delete(quotationSuppliers).where(eq(quotationSuppliers.quotationId, quotationId));
  await db.delete(quotations).where(eq(quotations.id, quotationId));
}

export async function getLatestQuotationId(): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select({ id: quotations.id }).from(quotations).orderBy(desc(quotations.id)).limit(1);
  return result.length > 0 ? result[0].id : null;
}

// Get last purchase prices for a list of products (from delivered/sent orders)
export async function getLastPurchasePrices(productNames: string[]): Promise<Record<string, { unitPrice: number; date: string; supplierName: string; orderId: number }>> {
  const db = await getDb();
  if (!db) return {};
  const result: Record<string, { unitPrice: number; date: string; supplierName: string; orderId: number }> = {};
  // Get from purchase_order_items joined with purchase_orders (status sent or delivered)
  for (const name of productNames) {
    const rows = await db.select({
      unitPrice: purchaseOrderItems.unitPrice,
      createdAt: purchaseOrders.createdAt,
      supplierId: purchaseOrders.supplierId,
      orderId: purchaseOrders.id,
    })
      .from(purchaseOrderItems)
      .innerJoin(purchaseOrders, eq(purchaseOrderItems.orderId, purchaseOrders.id))
      .where(and(
        eq(purchaseOrderItems.productName, name),
        inArray(purchaseOrders.status, ["purchased", "delivered", "sent"])
      ))
      .orderBy(desc(purchaseOrders.createdAt))
      .limit(1);
    if (rows.length > 0) {
      const allSup = await db.select().from(suppliers).where(eq(suppliers.id, rows[0].supplierId)).limit(1);
      const supName = allSup[0]?.tradeName || allSup[0]?.companyName || `#${rows[0].supplierId}`;
      result[name] = {
        unitPrice: parseFloat(rows[0].unitPrice as string),
        date: rows[0].createdAt ? new Date(rows[0].createdAt).toISOString() : '',
        supplierName: supName,
        orderId: rows[0].orderId,
      };
    }
  }
  return result;
}


// ==================== ADM MASTER FUNCTIONS ====================
export async function getQuotationItem(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(quotationItems).where(eq(quotationItems.id, id)).limit(1);
  return result[0] || null;
}

export async function updateQuotationItem(id: number, data: Partial<{ productName: string; quantity: string; unit: string }>) {
  const db = await getDb();
  if (!db) return;
  await db.update(quotationItems).set(data).where(eq(quotationItems.id, id));
}

export async function deletePurchaseOrder(orderId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  // Delete items first, then order
  await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.orderId, orderId));
  await db.delete(purchaseOrders).where(eq(purchaseOrders.id, orderId));
}

export async function listPurchaseOrdersByQuotation(quotationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(purchaseOrders).where(eq(purchaseOrders.quotationId, quotationId));
}

export async function updatePurchaseOrderItem(itemId: number, orderId: number, data: { unitPrice?: string; quantity?: string }) {
  const db = await getDb();
  if (!db) return;
  const updateData: Record<string, any> = {};
  if (data.unitPrice) updateData.unitPrice = data.unitPrice;
  if (data.quantity) updateData.quantity = data.quantity;
  // Recalculate totalPrice
  if (data.unitPrice || data.quantity) {
    const item = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.id, itemId)).limit(1);
    if (item.length > 0) {
      const qty = parseFloat(data.quantity || (item[0].quantity as string));
      const price = parseFloat(data.unitPrice || (item[0].unitPrice as string));
      updateData.totalPrice = (qty * price).toFixed(2);
    }
  }
  await db.update(purchaseOrderItems).set(updateData).where(eq(purchaseOrderItems.id, itemId));
  // Recalculate order total
  const allItems = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.orderId, orderId));
  const newTotal = allItems.reduce((sum, i) => {
    if (i.id === itemId) return sum + parseFloat(updateData.totalPrice || (i.totalPrice as string));
    return sum + parseFloat(i.totalPrice as string);
  }, 0);
  await db.update(purchaseOrders).set({ totalValue: newTotal.toFixed(2) }).where(eq(purchaseOrders.id, orderId));
}

export async function getPurchaseOrderItemById(itemId: number) {
  const db = await getDb();
  if (!db) return null;
  const items = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.id, itemId)).limit(1);
  return items[0] || null;
}

export async function updatePurchaseOrderItemBrand(itemId: number, orderId: number, data: { brand: string; unitPrice: string }) {
  const db = await getDb();
  if (!db) return;
  // Get current item for quantity
  const item = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.id, itemId)).limit(1);
  if (item.length === 0) return;
  const qty = parseFloat(item[0].quantity as string);
  const newPrice = parseFloat(data.unitPrice);
  const newTotal = (qty * newPrice).toFixed(2);
  await db.update(purchaseOrderItems).set({
    brand: data.brand,
    unitPrice: data.unitPrice,
    totalPrice: newTotal,
  }).where(eq(purchaseOrderItems.id, itemId));
  // Recalculate order total
  const allItems = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.orderId, orderId));
  const orderTotal = allItems.reduce((sum, i) => {
    if (i.id === itemId) return sum + parseFloat(newTotal);
    return sum + parseFloat(i.totalPrice as string);
  }, 0);
  await db.update(purchaseOrders).set({ totalValue: orderTotal.toFixed(2) }).where(eq(purchaseOrders.id, orderId));
}

export async function updatePurchaseOrderItemFull(itemId: number, orderId: number, data: { unitPrice?: string; quantity?: string; unit?: string; productName?: string }) {
  const db = await getDb();
  if (!db) return;
  const updateData: Record<string, any> = {};
  if (data.unitPrice) updateData.unitPrice = data.unitPrice;
  if (data.quantity) updateData.quantity = data.quantity;
  if (data.unit) updateData.unit = data.unit;
  if (data.productName) updateData.productName = data.productName;
  // Recalculate totalPrice
  const item = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.id, itemId)).limit(1);
  if (item.length > 0) {
    const qty = parseFloat(data.quantity || (item[0].quantity as string));
    const price = parseFloat(data.unitPrice || (item[0].unitPrice as string));
    updateData.totalPrice = (qty * price).toFixed(2);
  }
  await db.update(purchaseOrderItems).set(updateData).where(eq(purchaseOrderItems.id, itemId));
  // Recalculate order total
  const allItems = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.orderId, orderId));
  const newTotal = allItems.reduce((sum, i) => {
    if (i.id === itemId) return sum + parseFloat(updateData.totalPrice || (i.totalPrice as string));
    return sum + parseFloat(i.totalPrice as string);
  }, 0);
  await db.update(purchaseOrders).set({ totalValue: newTotal.toFixed(2) }).where(eq(purchaseOrders.id, orderId));
}

export async function deletePurchaseOrderItem(itemId: number, orderId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.id, itemId));
  // Recalculate order total
  const allItems = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.orderId, orderId));
  const newTotal = allItems.reduce((sum, i) => sum + parseFloat(i.totalPrice as string), 0);
  await db.update(purchaseOrders).set({ totalValue: newTotal.toFixed(2) }).where(eq(purchaseOrders.id, orderId));
}

export async function addPurchaseOrderItem(orderId: number, data: { productName: string; quantity: string; unit: string; unitPrice: string; totalPrice: string; brand: string | null }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(purchaseOrderItems).values({ orderId, ...data });
  // Recalculate order total
  const allItems = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.orderId, orderId));
  const newTotal = allItems.reduce((sum, i) => sum + parseFloat(i.totalPrice as string), 0);
  await db.update(purchaseOrders).set({ totalValue: newTotal.toFixed(2) }).where(eq(purchaseOrders.id, orderId));
}

export async function updateProposalItem(id: number, data: Partial<{
  unitPrice: string;
  totalPrice: string;
  brand: string;
  packagingType: "unidade" | "caixa" | "fardo" | "pacote";
  unitsPerPackage: number;
  unitPriceNormalized: string;
  notes: string;
}>) {
  const db = await getDb();
  if (!db) return;
  await db.update(proposalItems).set(data).where(eq(proposalItems.id, id));
}

export async function updateProposal(id: number, data: Partial<{
  totalValue: string;
  notes: string;
}>) {
  const db = await getDb();
  if (!db) return;
  await db.update(proposals).set(data).where(eq(proposals.id, id));
}

// ==================== MARCAS CONHECIDAS POR PRODUTO ====================
export async function getKnownBrandsByProducts(productNames: string[]): Promise<Record<string, string[]>> {
  const db = await getDb();
  if (!db || productNames.length === 0) return {};
  
  // Get all proposal items that have brands, joined with quotation_items to get productName
  const rows = await db.select({
    productName: quotationItems.productName,
    brand: proposalItems.brand,
  })
    .from(proposalItems)
    .innerJoin(quotationItems, eq(proposalItems.quotationItemId, quotationItems.id))
    .where(and(
      inArray(quotationItems.productName, productNames),
      isNotNull(proposalItems.brand),
    ));
  
  // Group brands by product, filter invalid ones, deduplicate
  const result: Record<string, string[]> = {};
  const INVALID_BRANDS = new Set(["t", "T", "teste", "TESTE", "x", "X", "-", ".", "n", "N", "na", "NA", "nao", "NAO"]);
  
  for (const row of rows) {
    const brand = (row.brand || "").trim();
    if (!brand || brand.length < 2 || INVALID_BRANDS.has(brand)) continue;
    
    const product = row.productName;
    if (!result[product]) result[product] = [];
    
    // Case-insensitive dedup
    const upperBrand = brand.toUpperCase();
    if (!result[product].some(b => b.toUpperCase() === upperBrand)) {
      result[product].push(brand);
    }
  }
  
  // Sort each product's brands alphabetically
  for (const key of Object.keys(result)) {
    result[key].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }
  
  return result;
}


// ==================== SYNC BRANDS FROM PROPOSALS ====================
export async function syncBrandsFromProposals(): Promise<{ added: number; total: number }> {
  const db = await getDb();
  if (!db) throw new Error("DB not initialized");
  
  // Get ALL unique brand+product combinations from proposal_items
  const rows = await db.select({
    productName: quotationItems.productName,
    brand: proposalItems.brand,
  })
    .from(proposalItems)
    .innerJoin(quotationItems, eq(proposalItems.quotationItemId, quotationItems.id))
    .where(isNotNull(proposalItems.brand));
  
  const INVALID_BRANDS = new Set(["t", "T", "teste", "TESTE", "x", "X", "-", ".", "n", "N", "na", "NA", "nao", "NAO", "\u2014", ""]);
  const normalize = (s: string) => s.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // Collect unique brand+product combos
  const combos = new Map<string, { brand: string; product: string }>();
  for (const row of rows) {
    const brand = (row.brand || "").trim();
    if (!brand || brand.length < 2 || INVALID_BRANDS.has(brand)) continue;
    const product = row.productName.trim();
    const key = `${normalize(brand)}::${normalize(product)}`;
    if (!combos.has(key)) {
      combos.set(key, { brand: brand.toUpperCase(), product });
    }
  }
  
  // Get existing brands from the table
  const existingBrands = await db.select().from(brands);
  const existingKeys = new Set(existingBrands.map(b => `${b.normalizedName}::${normalize(b.category || "")}`));
  
  // Insert new ones as 'unknown'
  let added = 0;
  for (const [, combo] of Array.from(combos)) {
    const normalizedBrand = normalize(combo.brand);
    const normalizedProduct = normalize(combo.product);
    const key = `${normalizedBrand}::${normalizedProduct}`;
    
    // Also check if there's a broader category rule that already covers this product
    const hasExistingRule = existingBrands.some(b => {
      if (b.normalizedName !== normalizedBrand) return false;
      if (!b.category) return true; // generic rule covers all
      const catNorm = normalize(b.category);
      const catParts = catNorm.split(/[\/,\s]+/).filter(p => p.length > 2);
      return catParts.some(part => normalizedProduct.includes(part));
    });
    
    if (!existingKeys.has(key) && !hasExistingRule) {
      await db.insert(brands).values({
        name: combo.brand,
        normalizedName: normalizedBrand,
        status: "unknown",
        category: combo.product,
        addedBy: "auto-sync",
      });
      existingKeys.add(key);
      added++;
    }
  }
  
  return { added, total: combos.size };
}

// ==================== PRICE TARGETS ====================
export async function listPriceTargets(filters?: { category?: string; unitId?: number; isActive?: boolean }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.category) conditions.push(eq(priceTargets.category, filters.category));
  if (filters?.unitId) conditions.push(eq(priceTargets.unitId, filters.unitId));
  if (filters?.isActive !== undefined) conditions.push(eq(priceTargets.isActive, filters.isActive));
  if (conditions.length > 0) {
    return db.select().from(priceTargets).where(and(...conditions)).orderBy(priceTargets.productName);
  }
  return db.select().from(priceTargets).orderBy(priceTargets.productName);
}

export async function createPriceTarget(data: {
  productName: string;
  productUnit: string;
  maxPrice: string;
  category?: string;
  unitId?: number;
  notes?: string;
  createdBy?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(priceTargets).values(data);
  return result[0].insertId;
}

export async function updatePriceTarget(id: number, data: Partial<{
  productName: string;
  productUnit: string;
  maxPrice: string;
  category: string;
  unitId: number | null;
  notes: string | null;
  isActive: boolean;
}>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(priceTargets).set({ ...data, updatedAt: new Date() }).where(eq(priceTargets.id, id));
}

export async function deletePriceTarget(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(priceTargets).where(eq(priceTargets.id, id));
}

export async function getPriceTargetsForProducts(productNames: string[]) {
  const db = await getDb();
  if (!db) return [];
  if (productNames.length === 0) return [];
  return db.select().from(priceTargets)
    .where(and(
      eq(priceTargets.isActive, true),
      inArray(priceTargets.productName, productNames)
    ));
}


// ==================== COMPARATIVO ENTRE UNIDADES ====================
export async function getUnitBenchmarkData(filters?: { startDate?: Date; endDate?: Date; category?: string }) {
  const db = await getDb();
  if (!db) return { byCategory: [], byProduct: [], units: [] };

  // Get all delivered/approved orders with their items
  const conditions = [
    inArray(purchaseOrders.status, ['delivered', 'purchased', 'sent']),
    isNotNull(purchaseOrders.unitId),
  ];
  if (filters?.startDate) conditions.push(gte(purchaseOrders.createdAt, filters.startDate));
  if (filters?.endDate) conditions.push(lte(purchaseOrders.createdAt, filters.endDate));

  const orders = await db.select({
    id: purchaseOrders.id,
    unitId: purchaseOrders.unitId,
    quotationId: purchaseOrders.quotationId,
    totalValue: purchaseOrders.totalValue,
    createdAt: purchaseOrders.createdAt,
  }).from(purchaseOrders).where(and(...conditions));

  if (orders.length === 0) return { byCategory: [], byProduct: [], units: [] };

  // Get all units
  const allUnits = await db.select().from(units);

  // Get items for all orders
  const orderIds = orders.map(o => o.id);
  const allItems = await db.select().from(purchaseOrderItems).where(inArray(purchaseOrderItems.orderId, orderIds));

  // Get categories from quotation titles
  const quotationIds = Array.from(new Set(orders.filter(o => o.quotationId).map(o => o.quotationId!)));
  const quotationData: Record<number, string> = {};
  if (quotationIds.length > 0) {
    const quots = await db.select({ id: quotations.id, title: quotations.title }).from(quotations).where(inArray(quotations.id, quotationIds));
    for (const q of quots) {
      const catMatch = q.title.match(/\(([^)]+)\)/);
      quotationData[q.id] = catMatch ? catMatch[1] : 'Outros';
    }
  }

  // Build order-to-category map
  const orderCategoryMap: Record<number, string> = {};
  for (const o of orders) {
    orderCategoryMap[o.id] = o.quotationId ? (quotationData[o.quotationId] || 'Outros') : 'Outros';
  }

  // Filter by category if specified
  const filteredOrders = filters?.category
    ? orders.filter(o => orderCategoryMap[o.id]?.toLowerCase() === filters.category!.toLowerCase())
    : orders;
  const filteredOrderIds = new Set(filteredOrders.map(o => o.id));
  const filteredItems = allItems.filter(i => filteredOrderIds.has(i.orderId));

  // === BY CATEGORY: aggregate total spent per unit per category ===
  const categoryUnitTotals: Record<string, Record<number, { total: number; items: number; orders: number }>> = {};
  for (const o of filteredOrders) {
    const cat = orderCategoryMap[o.id] || 'Outros';
    const uid = o.unitId!;
    if (!categoryUnitTotals[cat]) categoryUnitTotals[cat] = {};
    if (!categoryUnitTotals[cat][uid]) categoryUnitTotals[cat][uid] = { total: 0, items: 0, orders: 0 };
    categoryUnitTotals[cat][uid].total += parseFloat(o.totalValue as string);
    categoryUnitTotals[cat][uid].orders += 1;
  }
  // Count items per unit per category
  for (const item of filteredItems) {
    const order = filteredOrders.find(o => o.id === item.orderId);
    if (!order) continue;
    const cat = orderCategoryMap[order.id] || 'Outros';
    const uid = order.unitId!;
    if (categoryUnitTotals[cat]?.[uid]) categoryUnitTotals[cat][uid].items += 1;
  }

  const byCategory = Object.entries(categoryUnitTotals).map(([category, unitData]) => {
    const unitEntries = Object.entries(unitData).map(([uid, data]) => {
      const unit = allUnits.find(u => u.id === parseInt(uid));
      return {
        unitId: parseInt(uid),
        unitName: unit?.name || 'Desconhecida',
        unitState: unit?.state || '',
        total: data.total,
        orders: data.orders,
        items: data.items,
        avgPerOrder: data.orders > 0 ? data.total / data.orders : 0,
      };
    }).sort((a, b) => a.avgPerOrder - b.avgPerOrder);

    const cheapest = unitEntries[0];
    const mostExpensive = unitEntries[unitEntries.length - 1];
    const savingsPotential = mostExpensive && cheapest && mostExpensive.avgPerOrder > 0
      ? ((mostExpensive.avgPerOrder - cheapest.avgPerOrder) / mostExpensive.avgPerOrder) * 100
      : 0;

    return { category, units: unitEntries, cheapestUnit: cheapest?.unitName, savingsPotential };
  }).sort((a, b) => b.savingsPotential - a.savingsPotential);

  // === BY PRODUCT: aggregate price per unit per product ===
  const productUnitPrices: Record<string, Record<number, { prices: number[]; quantities: number[]; totalSpent: number }>> = {};
  for (const item of filteredItems) {
    const order = filteredOrders.find(o => o.id === item.orderId);
    if (!order) continue;
    const uid = order.unitId!;
    const key = item.productName.trim().toLowerCase();
    if (!productUnitPrices[key]) productUnitPrices[key] = {};
    if (!productUnitPrices[key][uid]) productUnitPrices[key][uid] = { prices: [], quantities: [], totalSpent: 0 };
    productUnitPrices[key][uid].prices.push(parseFloat(item.unitPrice as string));
    productUnitPrices[key][uid].quantities.push(parseFloat(item.quantity as string));
    productUnitPrices[key][uid].totalSpent += parseFloat(item.totalPrice as string);
  }

  const byProduct = Object.entries(productUnitPrices).map(([productKey, unitData]) => {
    const unitEntries = Object.entries(unitData).map(([uid, data]) => {
      const unit = allUnits.find(u => u.id === parseInt(uid));
      // Weighted average price
      const totalQty = data.quantities.reduce((a, b) => a + b, 0);
      const weightedPrice = totalQty > 0
        ? data.prices.reduce((sum, p, i) => sum + p * data.quantities[i], 0) / totalQty
        : data.prices.reduce((a, b) => a + b, 0) / data.prices.length;
      return {
        unitId: parseInt(uid),
        unitName: unit?.name || 'Desconhecida',
        unitState: unit?.state || '',
        avgPrice: weightedPrice,
        totalSpent: data.totalSpent,
        purchases: data.prices.length,
        lastPrice: data.prices[data.prices.length - 1],
      };
    }).sort((a, b) => a.avgPrice - b.avgPrice);

    const cheapest = unitEntries[0];
    const mostExpensive = unitEntries[unitEntries.length - 1];
    const priceDivergence = cheapest && mostExpensive && cheapest.avgPrice > 0
      ? ((mostExpensive.avgPrice - cheapest.avgPrice) / cheapest.avgPrice) * 100
      : 0;

    // Get original product name from first item
    const originalName = filteredItems.find(i => i.productName.trim().toLowerCase() === productKey)?.productName || productKey;

    return {
      productName: originalName,
      unit: filteredItems.find(i => i.productName.trim().toLowerCase() === productKey)?.unit || '',
      units: unitEntries,
      cheapestUnit: cheapest?.unitName,
      priceDivergence,
      bestPrice: cheapest?.avgPrice || 0,
      worstPrice: mostExpensive?.avgPrice || 0,
    };
  }).sort((a, b) => b.priceDivergence - a.priceDivergence);

  return {
    byCategory,
    byProduct,
    units: allUnits.map(u => ({ id: u.id, name: u.name, state: u.state })),
  };
}


// ==================== MASTER HELPER FUNCTIONS ====================
export async function deleteProposalItems(proposalId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(proposalItems).where(eq(proposalItems.proposalId, proposalId));
}

export async function deleteProposals(quotationId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(proposals).where(eq(proposals.quotationId, quotationId));
}

export async function deleteQuotationItems(quotationId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(quotationItems).where(eq(quotationItems.quotationId, quotationId));
}

export async function deletePriceHistory(productName: string, supplierId?: number) {
  const db = await getDb();
  if (!db) return;
  if (supplierId) {
    await db.delete(priceHistory).where(and(eq(priceHistory.productName, productName), eq(priceHistory.supplierId, supplierId)));
  } else {
    await db.delete(priceHistory).where(eq(priceHistory.productName, productName));
  }
}

export async function deletePriceHistoryById(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(priceHistory).where(eq(priceHistory.id, id));
}

// ADM Master: delete supplier and all related data
export async function deleteSupplier(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not initialized");
  // Delete supplier_units links
  await db.delete(supplierUnits).where(eq(supplierUnits.supplierId, id));
  // Delete supplier_documents
  await db.delete(supplierDocuments).where(eq(supplierDocuments.supplierId, id));
  // Delete delivery_ratings
  await db.delete(deliveryRatings).where(eq(deliveryRatings.supplierId, id));
  // Delete the supplier itself
  await db.delete(suppliers).where(eq(suppliers.id, id));
}

// ADM Master: delete unit
export async function deleteUnit(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not initialized");
  // Delete supplier_units links for this unit
  await db.delete(supplierUnits).where(eq(supplierUnits.unitId, id));
  // Delete the unit itself
  await db.delete(units).where(eq(units.id, id));
}

// ADM Master: delete single price history entry
export async function deletePriceHistoryEntry(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not initialized");
  await db.delete(priceHistory).where(eq(priceHistory.id, id));
}

// ADM Master: delete all price history for a product
export async function deletePriceHistoryByProduct(productName: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not initialized");
  await db.delete(priceHistory).where(eq(priceHistory.productName, productName));
}

// Fortes Items - get all active items for mapping
export async function getFortesItems() {
  const db = await getDb();
  if (!db) throw new Error("DB not initialized");
  return db.select({
    id: fortesItems.id,
    code: fortesItems.code,
    name: fortesItems.name,
    group: fortesItems.group,
    unit: fortesItems.unit,
  }).from(fortesItems).where(eq(fortesItems.active, true));
}

// ==================== JUSTIFICATIVAS DE COMPRA ====================
export async function createPurchaseAdjustments(records: Array<{
  quotationId: number;
  orderId?: number | null;
  purchaseGroupId?: string | null;
  unitId?: number | null;
  quotationItemId: number;
  productName: string;
  quantity: string;
  unit: string;
  recommendedSupplierId: number;
  recommendedSupplierName: string;
  recommendedUnitPrice: string;
  recommendedTotal: string;
  recommendedBrand?: string | null;
  recommendedReason?: string | null;
  cheapestSupplierId?: number | null;
  cheapestSupplierName?: string | null;
  cheapestUnitPrice?: string | null;
  selectedSupplierId: number;
  selectedSupplierName: string;
  selectedUnitPrice: string;
  selectedTotal: string;
  selectedBrand?: string | null;
  impactValue: string;
  impactPct: string;
  justificationCategory: string;
  justificationText: string;
  userId: number;
  userName: string;
  userEmail?: string | null;
  optimizationRule?: string | null;
}>) {
  const db = await getDb();
  if (!db) throw new Error("DB not initialized");
  if (records.length === 0) return [];
  await db.insert(purchaseAdjustments).values(records as any);
  return records;
}

export async function listPurchaseAdjustments(filters?: {
  quotationId?: number;
  unitId?: number;
  userId?: number;
  supplierId?: number;
  category?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not initialized");
  const conditions: any[] = [];
  if (filters?.quotationId) conditions.push(eq(purchaseAdjustments.quotationId, filters.quotationId));
  if (filters?.unitId) conditions.push(eq(purchaseAdjustments.unitId, filters.unitId));
  if (filters?.userId) conditions.push(eq(purchaseAdjustments.userId, filters.userId));
  if (filters?.supplierId) conditions.push(eq(purchaseAdjustments.selectedSupplierId, filters.supplierId));
  if (filters?.category) conditions.push(eq(purchaseAdjustments.justificationCategory, filters.category));
  if (filters?.status) conditions.push(eq(purchaseAdjustments.status, filters.status as any));
  
  const query = db.select().from(purchaseAdjustments)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(purchaseAdjustments.createdAt))
    .limit(filters?.limit || 100)
    .offset(filters?.offset || 0);
  return query;
}

export async function getPurchaseAdjustmentStats(filters?: { unitId?: number; startDate?: Date; endDate?: Date }) {
  const db = await getDb();
  if (!db) throw new Error("DB not initialized");
  const conditions: any[] = [eq(purchaseAdjustments.status, "active")];
  if (filters?.unitId) conditions.push(eq(purchaseAdjustments.unitId, filters.unitId));
  if (filters?.startDate) conditions.push(gte(purchaseAdjustments.createdAt, filters.startDate));
  if (filters?.endDate) conditions.push(lte(purchaseAdjustments.createdAt, filters.endDate));
  
  const result = await db.select({
    totalCount: count(),
    totalImpact: sum(purchaseAdjustments.impactValue),
  }).from(purchaseAdjustments).where(and(...conditions));
  
  // Get positive (cost additions) and negative (savings) separately
  const positiveImpact = await db.select({
    total: sum(purchaseAdjustments.impactValue),
    count: count(),
  }).from(purchaseAdjustments).where(and(...conditions, sql`${purchaseAdjustments.impactValue} > 0`));
  
  const negativeImpact = await db.select({
    total: sum(purchaseAdjustments.impactValue),
    count: count(),
  }).from(purchaseAdjustments).where(and(...conditions, sql`${purchaseAdjustments.impactValue} < 0`));
  
  return {
    totalExceptions: result[0]?.totalCount || 0,
    netImpact: parseFloat(result[0]?.totalImpact || "0"),
    costAdditions: parseFloat(positiveImpact[0]?.total || "0"),
    costAdditionCount: positiveImpact[0]?.count || 0,
    savings: parseFloat(negativeImpact[0]?.total || "0"),
    savingsCount: negativeImpact[0]?.count || 0,
  };
}

export async function updatePurchaseAdjustmentOrderId(quotationId: number, purchaseGroupId: string, orderId: number, supplierId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not initialized");
  await db.update(purchaseAdjustments)
    .set({ orderId, purchaseGroupId })
    .where(and(
      eq(purchaseAdjustments.quotationId, quotationId),
      eq(purchaseAdjustments.selectedSupplierId, supplierId),
    ));
}

// ===== BRAND CLASSIFICATION =====

export async function listBrands(filters?: { status?: string; category?: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB not initialized");
  const conditions: any[] = [];
  if (filters?.status) conditions.push(eq(brands.status, filters.status as any));
  if (filters?.category) conditions.push(eq(brands.category, filters.category));
  return db.select().from(brands)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(brands.name);
}

export async function getBrandByName(name: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not initialized");
  const normalized = name.toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const result = await db.select().from(brands)
    .where(eq(brands.normalizedName, normalized))
    .limit(1);
  return result[0] || null;
}

export async function getBrandStatus(name: string): Promise<"approved" | "unknown" | "rejected"> {
  const brand = await getBrandByName(name);
  return brand?.status || "unknown";
}

export async function getBrandStatusBatch(names: string[], productName?: string): Promise<Record<string, "approved" | "unknown" | "rejected">> {
  const db = await getDb();
  if (!db) throw new Error("DB not initialized");
  if (names.length === 0) return {};
  
  const allBrands = await db.select().from(brands);
  
  // Build a map: normalizedName -> array of brand rules
  const brandRulesMap = new Map<string, Array<{ status: string; category: string | null }>>();
  for (const b of allBrands) {
    if (!brandRulesMap.has(b.normalizedName)) brandRulesMap.set(b.normalizedName, []);
    brandRulesMap.get(b.normalizedName)!.push({ status: b.status, category: b.category });
  }
  
  // Normalize product name for matching against brand categories
  const normalizeForMatch = (s: string) => s.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const normalizedProduct = productName ? normalizeForMatch(productName) : "";
  
  // Check if a product matches a brand category
  const productMatchesCategory = (category: string | null): boolean => {
    if (!category || !normalizedProduct) return false;
    const normalizedCat = normalizeForMatch(category);
    // Check if product name contains the category keyword or vice versa
    // e.g., product "MACARRAO ESPAGUETE 500G" matches category "Macarrão/Espaguete"
    const catParts = normalizedCat.split(/[\/,\s]+/).filter(p => p.length > 2);
    return catParts.some(part => normalizedProduct.includes(part)) || 
           normalizedProduct.split(/[\s]+/).some(part => part.length > 3 && normalizedCat.includes(part));
  };
  
  const result: Record<string, "approved" | "unknown" | "rejected"> = {};
  for (const name of names) {
    const normalized = normalizeForMatch(name);
    const rules = brandRulesMap.get(normalized);
    
    if (!rules || rules.length === 0) {
      result[name] = "unknown";
      continue;
    }
    
    // If we have a product name, look for category-specific rules first
    if (productName) {
      const specificRule = rules.find(r => productMatchesCategory(r.category));
      if (specificRule) {
        result[name] = specificRule.status as "approved" | "unknown" | "rejected";
        continue;
      }
    }
    
    // Fall back to generic rule (category = null)
    const genericRule = rules.find(r => !r.category);
    if (genericRule) {
      result[name] = genericRule.status as "approved" | "unknown" | "rejected";
      continue;
    }
    
    // If there are only category-specific rules but none match this product, brand is unknown for this product
    result[name] = "unknown";
  }
  return result;
}

export async function createBrand(data: { name: string; status: "approved" | "unknown" | "rejected"; reason?: string; category?: string; addedBy?: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB not initialized");
  const normalized = data.name.toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const result = await db.insert(brands).values({
    name: data.name.trim(),
    normalizedName: normalized,
    status: data.status,
    reason: data.reason || null,
    category: data.category || null,
    addedBy: data.addedBy || null,
  });
  return result[0].insertId;
}

export async function updateBrandStatus(id: number, status: "approved" | "unknown" | "rejected", reason?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not initialized");
  await db.update(brands)
    .set({ status, reason: reason || null, updatedAt: new Date() })
    .where(eq(brands.id, id));
}

export async function deleteBrand(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not initialized");
  await db.delete(brands).where(eq(brands.id, id));
}


// ==================== LOGIN SESSIONS (IP TRACKING) ====================
export async function recordLoginSession(data: {
  userId: number;
  userName: string;
  userEmail: string;
  ipAddress: string;
  userAgent: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(loginSessions).values({
    userId: data.userId,
    userName: data.userName,
    userEmail: data.userEmail,
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
  });
}

export async function checkMultiIpLogin(userId: number, currentIp: string): Promise<{ previousIp: string } | null> {
  const db = await getDb();
  if (!db) return null;
  // Look for logins from this user in the last 1 hour with a DIFFERENT IP
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentLogins = await db.select()
    .from(loginSessions)
    .where(and(
      eq(loginSessions.userId, userId),
      ne(loginSessions.ipAddress, currentIp),
      gte(loginSessions.loginAt, oneHourAgo)
    ))
    .orderBy(desc(loginSessions.loginAt))
    .limit(1);
  if (recentLogins.length > 0) {
    // Mark current session as suspicious
    await db.update(loginSessions)
      .set({ suspicious: true, suspiciousReason: `Mesmo usuário logou de IP diferente (${recentLogins[0].ipAddress}) em menos de 1h` })
      .where(and(
        eq(loginSessions.userId, userId),
        eq(loginSessions.ipAddress, currentIp)
      ));
    return { previousIp: recentLogins[0].ipAddress };
  }
  return null;
}

export async function getLoginSessionsByUser(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select()
    .from(loginSessions)
    .where(eq(loginSessions.userId, userId))
    .orderBy(desc(loginSessions.loginAt))
    .limit(limit);
}

export async function getRecentLoginSessions(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select()
    .from(loginSessions)
    .orderBy(desc(loginSessions.loginAt))
    .limit(limit);
}


// ==================== BANCO DE MARCAS ====================
export async function registerBrand(data: {
  productName: string;
  brand: string;
  supplierId?: number | null;
  supplierName?: string | null;
  sector?: string | null;
  unitId?: number | null;
  unitName?: string | null;
}) {
  const db = await getDb();
  if (!db || !data.brand || !data.brand.trim()) return;
  const brandNormalized = data.brand.trim().toUpperCase();
  const now = Date.now();
  try {
    await db.insert(brandRegistry).values({
      productName: data.productName,
      brand: data.brand.trim(),
      brandNormalized,
      supplierId: data.supplierId || null,
      supplierName: data.supplierName || null,
      sector: data.sector || null,
      unitId: data.unitId || null,
      unitName: data.unitName || null,
      lastUsedAt: now,
      usageCount: 1,
      createdAt: now,
    }).onDuplicateKeyUpdate({
      set: {
        lastUsedAt: sql`${now}`,
        usageCount: sql`usageCount + 1`,
        brand: sql`${data.brand.trim()}`,
      },
    });
  } catch (e) {
    // Ignore duplicate errors silently
  }
}

export async function searchBrands(query: string, productName?: string, supplierId?: number) {
  const db = await getDb();
  if (!db || query.length < 2) return [];
  const conditions = [like(brandRegistry.brandNormalized, `%${query.toUpperCase()}%`)];
  if (productName) {
    conditions.push(like(brandRegistry.productName, `%${productName}%`));
  }
  if (supplierId) {
    conditions.push(eq(brandRegistry.supplierId, supplierId));
  }
  return db.select({
    brand: brandRegistry.brand,
    productName: brandRegistry.productName,
    supplierName: brandRegistry.supplierName,
    sector: brandRegistry.sector,
    usageCount: brandRegistry.usageCount,
    lastUsedAt: brandRegistry.lastUsedAt,
  })
    .from(brandRegistry)
    .where(and(...conditions))
    .orderBy(desc(brandRegistry.usageCount))
    .limit(20);
}

export async function listBrandRegistry(filters?: { productName?: string; supplierId?: number; sector?: string; unitName?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filters?.productName) conditions.push(like(brandRegistry.productName, `%${filters.productName}%`));
  if (filters?.supplierId) conditions.push(eq(brandRegistry.supplierId, filters.supplierId));
  if (filters?.sector) conditions.push(eq(brandRegistry.sector, filters.sector));
  if (filters?.unitName) conditions.push(like(brandRegistry.unitName, `%${filters.unitName}%`));
  
  const query = db.select().from(brandRegistry);
  if (conditions.length > 0) {
    return query.where(and(...conditions)).orderBy(desc(brandRegistry.lastUsedAt)).limit(500);
  }
  return query.orderBy(desc(brandRegistry.lastUsedAt)).limit(500);
}

// ==================== BRAND REJECTIONS (GLOBAL + PER-UNIT) ====================

const normalizeBrand = (s: string) => s.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export async function listBrandRejectionsGlobal() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(brandRejectionsGlobal).orderBy(desc(brandRejectionsGlobal.createdAt));
}

export async function addBrandRejectionGlobal(data: { brandName: string; productCategory?: string; reason?: string; createdBy?: number; createdByName?: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB not initialized");
  const result = await db.insert(brandRejectionsGlobal).values({
    brandName: data.brandName.trim(),
    brandNormalized: normalizeBrand(data.brandName),
    productCategory: data.productCategory || null,
    reason: data.reason || null,
    createdBy: data.createdBy || null,
    createdByName: data.createdByName || null,
  });
  return result[0].insertId;
}

export async function removeBrandRejectionGlobal(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not initialized");
  await db.delete(brandRejectionsGlobal).where(eq(brandRejectionsGlobal.id, id));
}

export async function listBrandRejectionsUnit(unitId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (unitId) {
    return db.select().from(brandRejectionsUnit).where(eq(brandRejectionsUnit.unitId, unitId)).orderBy(desc(brandRejectionsUnit.createdAt));
  }
  return db.select().from(brandRejectionsUnit).orderBy(desc(brandRejectionsUnit.createdAt));
}

export async function addBrandRejectionUnit(data: { brandName: string; unitId: number; unitName?: string; productCategory?: string; reason?: string; createdBy?: number; createdByName?: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB not initialized");
  const result = await db.insert(brandRejectionsUnit).values({
    brandName: data.brandName.trim(),
    brandNormalized: normalizeBrand(data.brandName),
    unitId: data.unitId,
    unitName: data.unitName || null,
    productCategory: data.productCategory || null,
    reason: data.reason || null,
    createdBy: data.createdBy || null,
    createdByName: data.createdByName || null,
  });
  return result[0].insertId;
}

export async function removeBrandRejectionUnit(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not initialized");
  await db.delete(brandRejectionsUnit).where(eq(brandRejectionsUnit.id, id));
}

/**
 * Check if a brand is rejected for a specific unit.
 * Checks both global rejections and unit-specific rejections.
 * Optionally filters by product category.
 */
export async function isBrandRejectedForUnit(brandName: string, unitId: number, productName?: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const normalized = normalizeBrand(brandName);
  const normalizeForMatch = (s: string) => s.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // Check global rejections
  const globalRejections = await db.select().from(brandRejectionsGlobal)
    .where(eq(brandRejectionsGlobal.brandNormalized, normalized));
  
  for (const r of globalRejections) {
    if (!r.productCategory) return true; // global rejection without product restriction
    if (productName) {
      const normalizedProduct = normalizeForMatch(productName);
      const catParts = normalizeForMatch(r.productCategory).split(/[\/,\s]+/).filter(p => p.length > 2);
      if (catParts.some(part => normalizedProduct.includes(part))) return true;
    }
  }
  
  // Check unit-specific rejections
  const unitRejections = await db.select().from(brandRejectionsUnit)
    .where(and(eq(brandRejectionsUnit.brandNormalized, normalized), eq(brandRejectionsUnit.unitId, unitId)));
  
  for (const r of unitRejections) {
    if (!r.productCategory) return true; // unit rejection without product restriction
    if (productName) {
      const normalizedProduct = normalizeForMatch(productName);
      const catParts = normalizeForMatch(r.productCategory).split(/[\/,\s]+/).filter(p => p.length > 2);
      if (catParts.some(part => normalizedProduct.includes(part))) return true;
    }
  }
  
  return false;
}

/**
 * Batch check: returns a map of brand -> boolean (rejected or not) for a given unit.
 * More efficient than calling isBrandRejectedForUnit individually.
 */
export async function getBrandRejectionBatch(brandNames: string[], unitId: number, productName?: string): Promise<Record<string, boolean>> {
  const db = await getDb();
  if (!db) return {};
  if (brandNames.length === 0) return {};
  
  const normalizeForMatch = (s: string) => s.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const normalizedProduct = productName ? normalizeForMatch(productName) : "";
  
  // Load all global rejections
  const globalRejections = await db.select().from(brandRejectionsGlobal);
  // Load unit-specific rejections
  const unitRejections = await db.select().from(brandRejectionsUnit)
    .where(eq(brandRejectionsUnit.unitId, unitId));
  // Load brand aliases for resolution (COGRAN → CONGRAN etc.)
  const allAliases = await db.select().from(brandAliases);
  const aliasMap: Record<string, string> = {};
  for (const a of allAliases) { aliasMap[a.aliasNormalized] = a.canonicalNormalized; }
  
  const productMatchesCategory = (category: string | null): boolean => {
    if (!category || !normalizedProduct) return false;
    const catParts = normalizeForMatch(category).split(/[\/,\s]+/).filter(p => p.length > 2);
    return catParts.some(part => normalizedProduct.includes(part));
  };
  
  const result: Record<string, boolean> = {};
  for (const brandName of brandNames) {
    // Resolve alias before checking rejection (e.g. COGRAN → CONGRAN)
    const rawNormalized = normalizeBrand(brandName);
    const normalized = aliasMap[rawNormalized] || rawNormalized;
    let rejected = false;
    
    // Check global
    for (const r of globalRejections) {
      if (r.brandNormalized !== normalized) continue;
      if (!r.productCategory) { rejected = true; break; }
      if (productMatchesCategory(r.productCategory)) { rejected = true; break; }
    }
    
    if (!rejected) {
      // Check unit-specific
      for (const r of unitRejections) {
        if (r.brandNormalized !== normalized) continue;
        if (!r.productCategory) { rejected = true; break; }
        if (productMatchesCategory(r.productCategory)) { rejected = true; break; }
      }
    }
    
    result[brandName] = rejected;
  }
  return result;
}


// ==================== PREFERRED SUPPLIERS ====================

/**
 * Get preferred suppliers for a given unit (or all units if unitId is null).
 * Returns list of { supplierId, tolerancePct } that should get preference in optimization.
 */
export async function getPreferredSuppliers(unitId?: number): Promise<Array<{ supplierId: number; tolerancePct: number; reason: string | null }>> {
  const db = await getDb();
  if (!db) return [];
  
  // Get all preferred suppliers that apply: unitId matches OR unitId is NULL (all units)
  const allPreferred = await db.select().from(preferredSuppliers);
  
  return allPreferred
    .filter(ps => ps.unitId === null || ps.unitId === unitId)
    .map(ps => ({
      supplierId: ps.supplierId,
      tolerancePct: parseFloat(String(ps.tolerancePct)) || 3,
      reason: ps.reason,
    }));
}

// ==================== HISTORICAL PAYMENTS ====================

export async function getHistoricalPaymentsSummary(filters?: { unitName?: string; category?: string; dateFrom?: string; dateTo?: string }) {
  const db = (await getDb())!;
  const conditions: any[] = [];
  
  if (filters?.unitName && filters.unitName !== 'all') {
    conditions.push(eq(historicalPayments.unitName, filters.unitName));
  }
  if (filters?.category && filters.category !== 'all') {
    conditions.push(eq(historicalPayments.category, filters.category as any));
  }
  if (filters?.dateFrom) {
    conditions.push(gte(historicalPayments.entryDate, filters.dateFrom));
  }
  if (filters?.dateTo) {
    conditions.push(lte(historicalPayments.entryDate, filters.dateTo));
  }
  
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  
  // Total summary
  const [totals] = await db.select({
    count: count(),
    total: sum(historicalPayments.value),
  }).from(historicalPayments).where(where);
  
  // By category
  const byCategory = await db.select({
    category: historicalPayments.category,
    count: count(),
    total: sum(historicalPayments.value),
  }).from(historicalPayments).where(where).groupBy(historicalPayments.category).orderBy(desc(sum(historicalPayments.value)));
  
  // By unit
  const byUnit = await db.select({
    unitName: historicalPayments.unitName,
    count: count(),
    total: sum(historicalPayments.value),
  }).from(historicalPayments).where(where).groupBy(historicalPayments.unitName).orderBy(desc(sum(historicalPayments.value)));
  
  // By date
  const byDate = await db.select({
    entryDate: historicalPayments.entryDate,
    count: count(),
    total: sum(historicalPayments.value),
  }).from(historicalPayments).where(where).groupBy(historicalPayments.entryDate).orderBy(historicalPayments.entryDate);
  
  return { totals, byCategory, byUnit, byDate };
}

export async function getHistoricalPaymentsTopSuppliers(filters?: { unitName?: string; category?: string; limit?: number }) {
  const db = (await getDb())!;
  const conditions: any[] = [];
  
  if (filters?.unitName && filters.unitName !== 'all') {
    conditions.push(eq(historicalPayments.unitName, filters.unitName));
  }
  if (filters?.category && filters.category !== 'all') {
    conditions.push(eq(historicalPayments.category, filters.category as any));
  }
  
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const limit = filters?.limit || 20;
  
  const topSuppliers = await db.select({
    supplierName: historicalPayments.supplierName,
    tradeName: historicalPayments.tradeName,
    count: count(),
    total: sum(historicalPayments.value),
  }).from(historicalPayments).where(where).groupBy(historicalPayments.supplierName, historicalPayments.tradeName).orderBy(desc(sum(historicalPayments.value))).limit(limit);
  
  return topSuppliers;
}

export async function getHistoricalPaymentsList(filters?: { unitName?: string; category?: string; supplierName?: string; limit?: number; offset?: number }) {
  const db = (await getDb())!;
  const conditions: any[] = [];
  
  if (filters?.unitName && filters.unitName !== 'all') {
    conditions.push(eq(historicalPayments.unitName, filters.unitName));
  }
  if (filters?.category && filters.category !== 'all') {
    conditions.push(eq(historicalPayments.category, filters.category as any));
  }
  if (filters?.supplierName) {
    conditions.push(like(historicalPayments.supplierName, `%${filters.supplierName}%`));
  }
  
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;
  
  const records = await db.select().from(historicalPayments).where(where).orderBy(desc(historicalPayments.value)).limit(limit).offset(offset);
  
  return records;
}

// ==================== COMPARATIVO FORTES vs QUALICOMPRAS ====================
export async function getComparativoFortesVsQC() {
  const db = (await getDb())!;
  
  // Fortes baseline: 01/05/2026 to 19/05/2026 (19 calendar days)
  const fortesData = await db.select({
    supplierName: historicalPayments.supplierName,
    tradeName: historicalPayments.tradeName,
    count: count(),
    total: sum(historicalPayments.value),
  }).from(historicalPayments)
    .where(eq(historicalPayments.category, 'alimentos' as any))
    .groupBy(historicalPayments.supplierName, historicalPayments.tradeName)
    .orderBy(desc(sum(historicalPayments.value)));
  
  const [fortesTotals] = await db.select({
    count: count(),
    total: sum(historicalPayments.value),
  }).from(historicalPayments)
    .where(eq(historicalPayments.category, 'alimentos' as any));
  
  // QualiCompras: all non-cancelled orders
  const qcOrders = await db.select({
    id: purchaseOrders.id,
    totalValue: purchaseOrders.totalValue,
    createdAt: purchaseOrders.createdAt,
    supplierId: purchaseOrders.supplierId,
  }).from(purchaseOrders)
    .where(ne(purchaseOrders.status, 'cancelled'));
  
  // Get supplier names for QC orders
  const qcSupplierIds = Array.from(new Set(qcOrders.map(o => o.supplierId)));
  let qcSupplierMap: Record<number, { tradeName: string | null; companyName: string }> = {};
  if (qcSupplierIds.length > 0) {
    const supplierRows = await db.select({
      id: suppliers.id,
      tradeName: suppliers.tradeName,
      companyName: suppliers.companyName,
    }).from(suppliers)
      .where(inArray(suppliers.id, qcSupplierIds));
    for (const s of supplierRows) {
      qcSupplierMap[s.id] = { tradeName: s.tradeName, companyName: s.companyName };
    }
  }
  
  // Aggregate QC by supplier
  const qcBySupplier: Record<string, { name: string; total: number; count: number }> = {};
  let qcTotal = 0;
  let qcCount = qcOrders.length;
  
  for (const o of qcOrders) {
    const val = parseFloat(String(o.totalValue));
    qcTotal += val;
    const sup = qcSupplierMap[o.supplierId];
    const name = sup?.tradeName || sup?.companyName || `Fornecedor #${o.supplierId}`;
    if (!qcBySupplier[name]) qcBySupplier[name] = { name, total: 0, count: 0 };
    qcBySupplier[name].total += val;
    qcBySupplier[name].count += 1;
  }
  
  // QC date range
  const qcDates = qcOrders.map(o => o.createdAt).filter(Boolean).sort();
  const qcFirstDate = qcDates[0] ? new Date(qcDates[0]) : null;
  const qcLastDate = qcDates[qcDates.length - 1] ? new Date(qcDates[qcDates.length - 1]) : null;
  const qcCalendarDays = qcFirstDate && qcLastDate 
    ? Math.max(1, Math.ceil((qcLastDate.getTime() - qcFirstDate.getTime()) / (1000 * 60 * 60 * 24)) + 1)
    : 1;
  
  // Fortes: 19 calendar days
  const fortesCalendarDays = 19;
  const fortesTotal = parseFloat(String(fortesTotals?.total || "0"));
  const fortesCount = fortesTotals?.count || 0;
  
  // Normalized daily rates
  const fortesDailyRate = fortesTotal / fortesCalendarDays;
  const qcDailyRate = qcTotal / qcCalendarDays;
  
  // Monthly projection (30 days)
  const fortesMonthlyProjection = fortesDailyRate * 30;
  const qcMonthlyProjection = qcDailyRate * 30;
  
  // Economy calculation
  const economyAbsolute = fortesMonthlyProjection - qcMonthlyProjection;
  const economyPercent = fortesMonthlyProjection > 0 ? (economyAbsolute / fortesMonthlyProjection) * 100 : 0;
  
  // Supplier comparison (match by name similarity)
  const supplierComparison: Array<{
    name: string;
    fortesTotal: number;
    fortesDailyRate: number;
    qcTotal: number;
    qcDailyRate: number;
    variation: number;
  }> = [];
  
  for (const f of fortesData) {
    const fortesName = (f.tradeName || f.supplierName || "").toUpperCase().trim();
    const fortesVal = parseFloat(String(f.total || "0"));
    const fDailyRate = fortesVal / fortesCalendarDays;
    
    // Try to find matching QC supplier
    let matchedQC: { name: string; total: number; count: number } | null = null;
    for (const [qcName, qcData] of Object.entries(qcBySupplier)) {
      const qcUpper = qcName.toUpperCase().trim();
      // Fuzzy match: check if one contains the other or significant overlap
      if (fortesName.includes(qcUpper) || qcUpper.includes(fortesName) ||
          (fortesName.length > 5 && qcUpper.length > 5 && 
           (fortesName.includes(qcUpper.substring(0, 8)) || qcUpper.includes(fortesName.substring(0, 8))))) {
        matchedQC = qcData;
        break;
      }
    }
    
    if (matchedQC) {
      const qcDR = matchedQC.total / qcCalendarDays;
      const variation = fDailyRate > 0 ? ((qcDR - fDailyRate) / fDailyRate) * 100 : 0;
      supplierComparison.push({
        name: matchedQC.name,
        fortesTotal: fortesVal,
        fortesDailyRate: fDailyRate,
        qcTotal: matchedQC.total,
        qcDailyRate: qcDR,
        variation,
      });
    }
  }
  
  supplierComparison.sort((a, b) => a.variation - b.variation);
  
  // QC monthly data (for timeline)
  const qcByMonth: Record<string, { total: number; count: number }> = {};
  for (const o of qcOrders) {
    if (!o.createdAt) continue;
    const d = new Date(o.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!qcByMonth[key]) qcByMonth[key] = { total: 0, count: 0 };
    qcByMonth[key].total += parseFloat(String(o.totalValue));
    qcByMonth[key].count += 1;
  }
  
  return {
    fortes: {
      total: fortesTotal,
      count: fortesCount,
      calendarDays: fortesCalendarDays,
      dailyRate: fortesDailyRate,
      monthlyProjection: fortesMonthlyProjection,
      period: "01/05/2026 a 19/05/2026",
      supplierCount: fortesData.length,
    },
    qualicompras: {
      total: qcTotal,
      count: qcCount,
      calendarDays: qcCalendarDays,
      dailyRate: qcDailyRate,
      monthlyProjection: qcMonthlyProjection,
      firstDate: qcFirstDate?.toISOString().split('T')[0] || null,
      lastDate: qcLastDate?.toISOString().split('T')[0] || null,
      supplierCount: Object.keys(qcBySupplier).length,
      byMonth: Object.entries(qcByMonth).map(([month, data]) => ({ month, ...data })).sort((a, b) => a.month.localeCompare(b.month)),
    },
    economy: {
      absolute: economyAbsolute,
      percent: economyPercent,
      isPositive: economyAbsolute > 0,
    },
    supplierComparison,
  };
}

// ==================== RESOLUÇÃO DE ALIASES DE MARCA ====================

/**
 * Resolve a brand name to its canonical form using brand_aliases table.
 * Returns the canonical name if an alias exists, otherwise returns the original name.
 */
export async function resolveBrandWithAliases(brandName: string): Promise<string> {
  const db = await getDb();
  if (!db || !brandName) return brandName;
  
  const normalized = normalizeBrand(brandName);
  const aliases = await db.select().from(brandAliases)
    .where(eq(brandAliases.aliasNormalized, normalized));
  
  if (aliases.length > 0) {
    return aliases[0].canonicalName;
  }
  return brandName;
}

/**
 * Batch resolve brand names to canonical forms.
 * Returns a map of original → canonical.
 */
export async function resolveBrandsWithAliases(brandNames: string[]): Promise<Record<string, string>> {
  const db = await getDb();
  if (!db || brandNames.length === 0) return {};
  
  const allAliases = await db.select().from(brandAliases);
  const aliasMap: Record<string, string> = {};
  for (const a of allAliases) {
    aliasMap[a.aliasNormalized] = a.canonicalName;
  }
  
  const result: Record<string, string> = {};
  for (const name of brandNames) {
    const normalized = normalizeBrand(name);
    result[name] = aliasMap[normalized] || name;
  }
  return result;
}

/**
 * Check if a brand is rejected, resolving aliases first.
 * This is the SINGLE SOURCE OF TRUTH for brand eligibility.
 */
export async function isBrandRejectedWithAliases(brandName: string, unitId: number, productName?: string): Promise<{rejected: boolean, reason?: string, resolvedAs?: string}> {
  const canonical = await resolveBrandWithAliases(brandName);
  const wasAliased = canonical !== brandName;
  
  const rejected = await isBrandRejectedForUnit(canonical, unitId, productName);
  
  if (rejected) {
    return {
      rejected: true,
      reason: wasAliased 
        ? `Marca "${brandName}" tratada como "${canonical}" (alias) — rejeitada globalmente/regionalmente`
        : `Marca "${brandName}" rejeitada globalmente/regionalmente`,
      resolvedAs: wasAliased ? canonical : undefined,
    };
  }
  return { rejected: false };
}

// ==================== REMANEJAMENTO DE ITENS ====================

export async function createRemanejamento(data: {
  originalOrderId: number;
  originalOrderCode?: string;
  complementaryOrderId?: number;
  complementaryOrderCode?: string;
  quotationId: number;
  productName: string;
  unit: string;
  originalQuantity: string;
  availableQuantity: string;
  deficit: string;
  originalSupplierId: number;
  originalSupplierName?: string;
  originalUnitPrice?: string;
  alternativeSupplierId?: number;
  alternativeSupplierName?: string;
  alternativeUnitPrice?: string;
  alternativeBrand?: string;
  alternativeRank?: number;
  justification: string;
  status?: "completed" | "failed_no_alternative" | "cancelled";
  costImpact?: string;
  userId: number;
  userName?: string;
  userEmail?: string;
}) {
  const db = await getDb();
  if (!db) return null;
  
  const [result] = await db.insert(orderItemRemanagements).values({
    originalOrderId: data.originalOrderId,
    originalOrderCode: data.originalOrderCode,
    complementaryOrderId: data.complementaryOrderId,
    complementaryOrderCode: data.complementaryOrderCode,
    quotationId: data.quotationId,
    productName: data.productName,
    unit: data.unit,
    originalQuantity: data.originalQuantity,
    availableQuantity: data.availableQuantity,
    deficit: data.deficit,
    originalSupplierId: data.originalSupplierId,
    originalSupplierName: data.originalSupplierName,
    originalUnitPrice: data.originalUnitPrice,
    alternativeSupplierId: data.alternativeSupplierId,
    alternativeSupplierName: data.alternativeSupplierName,
    alternativeUnitPrice: data.alternativeUnitPrice,
    alternativeBrand: data.alternativeBrand,
    alternativeRank: data.alternativeRank,
    justification: data.justification,
    status: data.status || "completed",
    costImpact: data.costImpact,
    userId: data.userId,
    userName: data.userName,
    userEmail: data.userEmail,
  });
  return result;
}

// ==================== BRAND ALIASES CRUD ====================
export async function listBrandAliases() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(brandAliases).orderBy(brandAliases.aliasName);
}

export async function createBrandAlias(data: { aliasName: string; canonicalName: string; reason?: string; createdBy?: number; createdByName?: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const aliasNorm = normalizeBrand(data.aliasName);
  const canonicalNorm = normalizeBrand(data.canonicalName);
  const existing = await db.select().from(brandAliases).where(eq(brandAliases.aliasNormalized, aliasNorm));
  if (existing.length > 0) throw new Error(`Alias "${data.aliasName}" já existe, apontando para "${existing[0].canonicalName}".`);
  const result = await db.insert(brandAliases).values({
    aliasName: data.aliasName.trim(),
    aliasNormalized: aliasNorm,
    canonicalName: data.canonicalName.trim(),
    canonicalNormalized: canonicalNorm,
    reason: data.reason || null,
    createdBy: data.createdBy || null,
    createdByName: data.createdByName || null,
  });
  return result[0].insertId;
}

export async function deleteBrandAlias(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(brandAliases).where(eq(brandAliases.id, id));
}
