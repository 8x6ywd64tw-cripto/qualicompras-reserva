/**
 * Purchase Intelligence Analytics Module
 * Provides advanced analytics queries for the Inteligência de Compras dashboard.
 * 
 * Panels:
 * 1. Índice de Preços (price index over time by product/sector)
 * 2. Sazonalidade (weekly patterns)
 * 3. Comparativo entre Unidades (same product, different units)
 * 4. Fornecedor por Setor (who supplies what)
 * 5. Curva ABC (top products by spend)
 * 6. Evolução Semanal (spend trend by week)
 */

import { getDb } from "./db";
import { sql } from "drizzle-orm";

// ==================== 1. PRICE INDEX ====================
export async function getPriceIndex(filters: {
  productName?: string;
  sector?: string;
  unitName?: string;
  supplierId?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions: string[] = [
    "source = 'fortes_historical'",
    "CAST(unitPrice AS DECIMAL(12,2)) > 0",
    "weekNumber IS NOT NULL",
  ];
  const params: any[] = [];

  if (filters.productName) {
    conditions.push("productName LIKE ?");
    params.push(`%${filters.productName}%`);
  }
  if (filters.sector) {
    conditions.push("sector = ?");
    params.push(filters.sector);
  }
  if (filters.unitName) {
    conditions.push("unitName = ?");
    params.push(filters.unitName);
  }
  if (filters.supplierId) {
    conditions.push("supplierId = ?");
    params.push(filters.supplierId);
  }

  const where = conditions.join(" AND ");

  const result = await db.execute(sql.raw(`
    SELECT 
      productName,
      weekNumber,
      weekLabel,
      unitName,
      ROUND(AVG(CAST(unitPrice AS DECIMAL(12,2))), 2) as avgPrice,
      ROUND(MIN(CAST(unitPrice AS DECIMAL(12,2))), 2) as minPrice,
      ROUND(MAX(CAST(unitPrice AS DECIMAL(12,2))), 2) as maxPrice,
      COUNT(*) as sampleCount
    FROM price_history
    WHERE ${where}
    GROUP BY productName, weekNumber, weekLabel, unitName
    ORDER BY productName, weekNumber
  `));

  return (result as any)?.[0] || [];
}

// ==================== 2. SEASONALITY ====================
export async function getSeasonality(filters: {
  sector?: string;
  unitName?: string;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions: string[] = [
    "source = 'fortes_historical'",
    "CAST(unitPrice AS DECIMAL(12,2)) > 0",
    "weekNumber IS NOT NULL",
  ];
  const params: any[] = [];

  if (filters.sector) {
    conditions.push("sector = ?");
    params.push(filters.sector);
  }
  if (filters.unitName) {
    conditions.push("unitName = ?");
    params.push(filters.unitName);
  }

  const where = conditions.join(" AND ");

  const result = await db.execute(sql.raw(`
    SELECT 
      weekNumber,
      weekLabel,
      sector,
      ROUND(SUM(CAST(unitPrice AS DECIMAL(12,2)) * CAST(quantity AS DECIMAL(12,3))), 2) as totalSpend,
      COUNT(DISTINCT productName) as productCount,
      COUNT(*) as transactionCount
    FROM price_history
    WHERE ${where}
    GROUP BY weekNumber, weekLabel, sector
    ORDER BY weekNumber, sector
  `));

  return (result as any)?.[0] || [];
}

// ==================== 3. UNIT COMPARISON ====================
export async function getUnitComparison(filters: {
  productName?: string;
  sector?: string;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions: string[] = [
    "source = 'fortes_historical'",
    "CAST(unitPrice AS DECIMAL(12,2)) > 0",
  ];
  const params: any[] = [];

  if (filters.productName) {
    conditions.push("productName LIKE ?");
    params.push(`%${filters.productName}%`);
  }
  if (filters.sector) {
    conditions.push("sector = ?");
    params.push(filters.sector);
  }

  const where = conditions.join(" AND ");

  const result = await db.execute(sql.raw(`
    SELECT 
      productName,
      unitName,
      ROUND(AVG(CAST(unitPrice AS DECIMAL(12,2))), 2) as avgPrice,
      ROUND(MIN(CAST(unitPrice AS DECIMAL(12,2))), 2) as minPrice,
      ROUND(MAX(CAST(unitPrice AS DECIMAL(12,2))), 2) as maxPrice,
      ROUND(SUM(CAST(quantity AS DECIMAL(12,3))), 1) as totalQty,
      ROUND(SUM(CAST(unitPrice AS DECIMAL(12,2)) * CAST(quantity AS DECIMAL(12,3))), 2) as totalSpend,
      COUNT(*) as purchaseCount
    FROM price_history
    WHERE ${where}
    GROUP BY productName, unitName
    HAVING COUNT(*) >= 2
    ORDER BY productName, avgPrice ASC
  `));

  return (result as any)?.[0] || [];
}

// ==================== 4. SUPPLIER BY SECTOR ====================
export async function getSupplierBySector(filters: {
  unitName?: string;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions: string[] = [
    "source = 'fortes_historical'",
    "CAST(unitPrice AS DECIMAL(12,2)) > 0",
    "sector IS NOT NULL",
  ];
  const params: any[] = [];

  if (filters.unitName) {
    conditions.push("unitName = ?");
    params.push(filters.unitName);
  }

  const where = conditions.join(" AND ");

  const result = await db.execute(sql.raw(`
    SELECT 
      supplierName,
      sector,
      unitName,
      ROUND(SUM(CAST(unitPrice AS DECIMAL(12,2)) * CAST(quantity AS DECIMAL(12,3))), 2) as totalSpend,
      COUNT(DISTINCT productName) as productCount,
      COUNT(*) as transactionCount,
      ROUND(AVG(CAST(unitPrice AS DECIMAL(12,2))), 2) as avgUnitPrice
    FROM price_history
    WHERE ${where}
    GROUP BY supplierName, sector, unitName
    ORDER BY totalSpend DESC
  `));

  return (result as any)?.[0] || [];
}

// ==================== 5. ABC CURVE ====================
export async function getAbcCurve(filters: {
  unitName?: string;
  sector?: string;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions: string[] = [
    "source = 'fortes_historical'",
    "CAST(unitPrice AS DECIMAL(12,2)) > 0",
  ];
  const params: any[] = [];

  if (filters.unitName) {
    conditions.push("unitName = ?");
    params.push(filters.unitName);
  }
  if (filters.sector) {
    conditions.push("sector = ?");
    params.push(filters.sector);
  }

  const where = conditions.join(" AND ");

  const result = await db.execute(sql.raw(`
    SELECT 
      productName,
      sector,
      ROUND(SUM(CAST(unitPrice AS DECIMAL(12,2)) * CAST(quantity AS DECIMAL(12,3))), 2) as totalSpend,
      ROUND(SUM(CAST(quantity AS DECIMAL(12,3))), 1) as totalQty,
      ROUND(AVG(CAST(unitPrice AS DECIMAL(12,2))), 2) as avgPrice,
      COUNT(*) as purchaseCount,
      COUNT(DISTINCT supplierName) as supplierCount,
      COUNT(DISTINCT unitName) as unitCount
    FROM price_history
    WHERE ${where}
    GROUP BY productName, sector
    ORDER BY totalSpend DESC
  `));

  return (result as any)?.[0] || [];
}

// ==================== 6. WEEKLY SPEND EVOLUTION ====================
export async function getWeeklyEvolution(filters: {
  unitName?: string;
  sector?: string;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions: string[] = [
    "source = 'fortes_historical'",
    "CAST(unitPrice AS DECIMAL(12,2)) > 0",
    "weekNumber IS NOT NULL",
  ];
  const params: any[] = [];

  if (filters.unitName) {
    conditions.push("unitName = ?");
    params.push(filters.unitName);
  }
  if (filters.sector) {
    conditions.push("sector = ?");
    params.push(filters.sector);
  }

  const where = conditions.join(" AND ");

  const result = await db.execute(sql.raw(`
    SELECT 
      weekNumber,
      weekLabel,
      unitName,
      sector,
      ROUND(SUM(CAST(unitPrice AS DECIMAL(12,2)) * CAST(quantity AS DECIMAL(12,3))), 2) as totalSpend,
      COUNT(DISTINCT productName) as productCount,
      COUNT(DISTINCT supplierName) as supplierCount,
      COUNT(*) as transactionCount
    FROM price_history
    WHERE ${where}
    GROUP BY weekNumber, weekLabel, unitName, sector
    ORDER BY weekNumber, unitName
  `));

  return (result as any)?.[0] || [];
}

// ==================== SUMMARY STATS ====================
export async function getIntelligenceSummary() {
  const db = await getDb();
  if (!db) return null;

  const result = await db.execute(sql.raw(`
    SELECT 
      COUNT(*) as totalRecords,
      COUNT(DISTINCT productName) as uniqueProducts,
      COUNT(DISTINCT supplierName) as uniqueSuppliers,
      COUNT(DISTINCT unitName) as uniqueUnits,
      COUNT(DISTINCT sector) as uniqueSectors,
      ROUND(SUM(CAST(unitPrice AS DECIMAL(12,2)) * CAST(quantity AS DECIMAL(12,3))), 2) as totalSpend,
      MIN(weekNumber) as minWeek,
      MAX(weekNumber) as maxWeek
    FROM price_history
    WHERE source = 'fortes_historical'
    AND CAST(unitPrice AS DECIMAL(12,2)) > 0
  `));

  const row = (result as any)?.[0]?.[0];
  if (!row) return null;

  // Get sector breakdown
  const sectorResult = await db.execute(sql.raw(`
    SELECT sector, COUNT(*) as count, 
           ROUND(SUM(CAST(unitPrice AS DECIMAL(12,2)) * CAST(quantity AS DECIMAL(12,3))), 2) as spend
    FROM price_history
    WHERE source = 'fortes_historical' AND CAST(unitPrice AS DECIMAL(12,2)) > 0
    GROUP BY sector ORDER BY spend DESC
  `));

  // Get unit breakdown
  const unitResult = await db.execute(sql.raw(`
    SELECT unitName, COUNT(*) as count,
           ROUND(SUM(CAST(unitPrice AS DECIMAL(12,2)) * CAST(quantity AS DECIMAL(12,3))), 2) as spend
    FROM price_history
    WHERE source = 'fortes_historical' AND CAST(unitPrice AS DECIMAL(12,2)) > 0
    GROUP BY unitName ORDER BY spend DESC
  `));

  return {
    ...row,
    sectors: (sectorResult as any)?.[0] || [],
    units: (unitResult as any)?.[0] || [],
  };
}

// ==================== PRODUCT SEARCH ====================
export async function searchProducts(query: string) {
  const db = await getDb();
  if (!db) return [];

  const result = await db.execute(sql.raw(`
    SELECT DISTINCT productName, sector,
           ROUND(AVG(CAST(unitPrice AS DECIMAL(12,2))), 2) as avgPrice,
           COUNT(*) as occurrences
    FROM price_history
    WHERE source = 'fortes_historical'
    AND productName LIKE '%${query.replace(/'/g, "''")}%'
    AND CAST(unitPrice AS DECIMAL(12,2)) > 0
    GROUP BY productName, sector
    ORDER BY occurrences DESC
    LIMIT 20
  `));

  return (result as any)?.[0] || [];
}
