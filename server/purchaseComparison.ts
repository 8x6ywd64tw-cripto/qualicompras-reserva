/**
 * Purchase Comparison Engine
 * Implements normalized basket comparison (price effect vs volume effect),
 * comparability index, and historical evolution.
 * 
 * RULE: Never compare just total values. Separate price effect from volume effect.
 * Formula: "For the same current volume, are we paying more or less than the reference?"
 */

// ==================== TYPES ====================

export interface BasketItem {
  productName: string;
  quantity: number; // normalized quantity
  unit: string;
  unitPrice: number;
  totalPrice: number;
  supplierId?: number;
  supplierName?: string;
}

export interface ConsolidatedPurchase {
  id: string; // purchaseGroupId or single order id
  orderId?: number;
  orderIds: number[];
  unitId: number | null;
  unitName: string;
  category: string;
  period: string;
  date: Date;
  totalValue: number;
  items: BasketItem[];
  isOptimized: boolean;
  status: string;
}

export interface ProductComparison {
  productName: string;
  unit: string;
  currentQty: number;
  currentPrice: number;
  referencePrice: number;
  priceDiffAbsolute: number; // positive = cheaper
  priceDiffPercent: number;
  financialImpact: number; // qty * (refPrice - curPrice)
  currentSupplier: string;
  referenceSupplier: string;
  referenceDate: string;
  situation: 'cheaper' | 'more_expensive' | 'stable' | 'new_product' | 'no_reference' | 'unit_not_comparable';
}

export interface ComparabilityResult {
  index: number; // 0-100
  classification: 'very_comparable' | 'comparable_with_differences' | 'low_comparability';
  productOverlap: number;
  volumeSimilarity: number;
  financialCoverage: number;
  commonProductsCount: number;
  currentOnlyCount: number;
  referenceOnlyCount: number;
}

export interface ComparisonResult {
  current: {
    totalValue: number;
    period: string;
    unitName: string;
    category: string;
    itemCount: number;
    date: string;
  };
  reference: {
    totalValue: number;
    period: string;
    unitName: string;
    category: string;
    itemCount: number;
    date: string;
    purchaseId: string;
  };
  // Price effect calculation
  currentCostComparable: number; // sum(qty_current * price_current) for comparable items
  volumeAtOldPrices: number; // sum(qty_current * price_reference) for comparable items
  priceEffect: number; // volumeAtOldPrices - currentCostComparable (positive = cheaper)
  priceEffectPercent: number; // priceEffect / volumeAtOldPrices * 100
  priceIndex: number; // currentCostComparable / volumeAtOldPrices * 100
  // Gross total variation
  grossDifference: number; // reference.totalValue - current.totalValue
  grossDifferencePercent: number;
  // Comparability
  comparability: ComparabilityResult;
  // Per-product breakdown
  products: ProductComparison[];
  // Summary
  cheaperCount: number;
  moreExpensiveCount: number;
  stableCount: number;
  noComparisonCount: number;
  topSavings: ProductComparison[]; // top 5 savings
  topIncreases: ProductComparison[]; // top 5 cost increases
  // Executive phrase
  executivePhrase: string;
  // Basket identification
  basketType: 'identical' | 'same_products_diff_volumes' | 'partial';
  // Week status
  weekInProgress: boolean;
  // Confidence
  isConclusive: boolean; // comparability >= 60% AND coverage >= 70%
}

// ==================== CONSOLIDATION ====================

/**
 * Consolidate orders from the same optimized purchase into a single basket.
 * Orders sharing the same purchaseGroupId or quotationId are treated as one purchase.
 */
export function consolidateOrders(
  orders: Array<{
    id: number;
    quotationId: number | null;
    purchaseGroupId: string | null;
    unitId: number | null;
    unitName: string;
    category: string;
    period: string;
    totalValue: string;
    status: string;
    createdAt: string | Date;
    items: BasketItem[];
  }>
): ConsolidatedPurchase[] {
  const groups = new Map<string, typeof orders>();
  
  for (const order of orders) {
    // Group by purchaseGroupId, fallback to quotationId, fallback to individual order
    const groupKey = order.purchaseGroupId 
      || (order.quotationId ? `QID-${order.quotationId}` : `SINGLE-${order.id}`);
    
    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(order);
  }
  
  const consolidated: ConsolidatedPurchase[] = [];
  
  for (const [groupId, groupOrders] of Array.from(groups.entries())) {
    // Merge all items from all orders in the group
    const allItems: BasketItem[] = [];
    let totalValue = 0;
    
    for (const order of groupOrders) {
      totalValue += parseFloat(order.totalValue);
      allItems.push(...order.items);
    }
    
    // Consolidate items by product (same product from different suppliers)
    const productMap = new Map<string, BasketItem>();
    for (const item of allItems) {
      const key = normalizeProductKey(item.productName, item.unit);
      if (productMap.has(key)) {
        const existing = productMap.get(key)!;
        const newQty = existing.quantity + item.quantity;
        const newTotal = existing.totalPrice + item.totalPrice;
        existing.quantity = newQty;
        existing.totalPrice = newTotal;
        existing.unitPrice = newTotal / newQty; // weighted average
        // Keep first supplier as reference
      } else {
        productMap.set(key, { ...item });
      }
    }
    
    const firstOrder = groupOrders[0];
    const latestDate = groupOrders.reduce((max: Date, o: any) => {
      const d = new Date(o.createdAt);
      return d > max ? d : max;
    }, new Date(0));
    
    consolidated.push({
      id: groupId,
      orderId: groupOrders.length === 1 ? groupOrders[0].id : undefined,
      orderIds: groupOrders.map((o: any) => o.id),
      unitId: firstOrder.unitId,
      unitName: firstOrder.unitName,
      category: firstOrder.category,
      period: firstOrder.period,
      date: latestDate,
      totalValue,
      items: Array.from(productMap.values()),
      isOptimized: groupOrders.length > 1 || groupId.startsWith('OPT-'),
      status: firstOrder.status,
    });
  }
  
  // Sort by date descending
  consolidated.sort((a, b) => b.date.getTime() - a.date.getTime());
  return consolidated;
}

// ==================== PRODUCT MATCHING ====================

/**
 * Normalize product key for matching.
 * Uses exact product name + unit as canonical identifier.
 * Does NOT use fuzzy matching or AI.
 */
export function normalizeProductName(name: string): string {
  return name.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeProductKey(productName: string, unit: string): string {
  return `${productName.trim().toUpperCase()}||${normalizeUnit(unit)}`;
}

/**
 * Normalize unit strings for comparison
 */
function normalizeUnit(unit: string): string {
  const u = unit.trim().toUpperCase();
  const map: Record<string, string> = {
    'KG': 'KG', 'KILO': 'KG', 'QUILOS': 'KG', 'QUILO': 'KG',
    'UN': 'UN', 'UND': 'UN', 'UNID': 'UN', 'UNIDADE': 'UN', 'UNIDADES': 'UN',
    'PCT': 'PCT', 'PACOTE': 'PCT', 'PAC': 'PCT',
    'CX': 'CX', 'CAIXA': 'CX',
    'FD': 'FD', 'FARDO': 'FD',
    'LT': 'LT', 'LITRO': 'LT', 'LITROS': 'LT', 'L': 'LT',
    'G': 'G', 'GRAMA': 'G', 'GRAMAS': 'G',
    'SC': 'SC', 'SACO': 'SC',
    'DZ': 'DZ', 'DUZIA': 'DZ',
    'BD': 'BD', 'BALDE': 'BD',
    'GL': 'GL', 'GALAO': 'GL', 'GALÃO': 'GL',
    'PT': 'PT', 'POTE': 'PT',
    'BG': 'BG', 'BISNAGA': 'BG',
    'RL': 'RL', 'ROLO': 'RL',
    'FR': 'FR', 'FRASCO': 'FR',
    'GF': 'GF', 'GARRAFA': 'GF',
  };
  return map[u] || u;
}

/**
 * Check if two units are comparable (same normalized unit)
 */
function unitsAreComparable(unit1: string, unit2: string): boolean {
  return normalizeUnit(unit1) === normalizeUnit(unit2);
}

// ==================== COMPARISON ENGINE ====================

/**
 * Compare two consolidated purchases.
 * Returns the full comparison result with price effect, comparability, etc.
 */
export function comparePurchases(
  current: ConsolidatedPurchase,
  reference: ConsolidatedPurchase
): ComparisonResult {
  const products: ProductComparison[] = [];
  
  // Build reference lookup
  const refMap = new Map<string, BasketItem>();
  for (const item of reference.items) {
    const key = normalizeProductKey(item.productName, item.unit);
    refMap.set(key, item);
  }
  
  // Track which reference items were matched
  const matchedRefKeys = new Set<string>();
  
  let currentCostComparable = 0;
  let volumeAtOldPrices = 0;
  let cheaperCount = 0;
  let moreExpensiveCount = 0;
  let stableCount = 0;
  let noComparisonCount = 0;
  
  // Compare each current item against reference
  for (const curItem of current.items) {
    const key = normalizeProductKey(curItem.productName, curItem.unit);
    const refItem = refMap.get(key);
    
    if (!refItem) {
      // Check if there's a similar product with incompatible unit
      const hasIncompatibleUnit = Array.from(refMap.entries()).some(([k, _]) => 
        k.split('||')[0] === curItem.productName.trim().toUpperCase() && !unitsAreComparable(k.split('||')[1], curItem.unit)
      );
      
      products.push({
        productName: curItem.productName,
        unit: curItem.unit,
        currentQty: curItem.quantity,
        currentPrice: curItem.unitPrice,
        referencePrice: 0,
        priceDiffAbsolute: 0,
        priceDiffPercent: 0,
        financialImpact: 0,
        currentSupplier: curItem.supplierName || '',
        referenceSupplier: '',
        referenceDate: '',
        situation: hasIncompatibleUnit ? 'unit_not_comparable' : 'new_product',
      });
      noComparisonCount++;
      continue;
    }
    
    matchedRefKeys.add(key);
    
    // Check unit compatibility
    if (!unitsAreComparable(curItem.unit, refItem.unit)) {
      products.push({
        productName: curItem.productName,
        unit: curItem.unit,
        currentQty: curItem.quantity,
        currentPrice: curItem.unitPrice,
        referencePrice: refItem.unitPrice,
        priceDiffAbsolute: 0,
        priceDiffPercent: 0,
        financialImpact: 0,
        currentSupplier: curItem.supplierName || '',
        referenceSupplier: refItem.supplierName || '',
        referenceDate: reference.date.toISOString(),
        situation: 'unit_not_comparable',
      });
      noComparisonCount++;
      continue;
    }
    
    // Calculate price effect for this product
    const curCost = curItem.quantity * curItem.unitPrice;
    const volumeAtOldPrice = curItem.quantity * refItem.unitPrice;
    
    currentCostComparable += curCost;
    volumeAtOldPrices += volumeAtOldPrice;
    
    const priceDiff = refItem.unitPrice - curItem.unitPrice; // positive = cheaper
    const priceDiffPct = refItem.unitPrice !== 0 
      ? (priceDiff / refItem.unitPrice) * 100 
      : 0;
    const impact = curItem.quantity * priceDiff; // positive = savings
    
    let situation: ProductComparison['situation'];
    if (Math.abs(priceDiffPct) < 0.5) {
      situation = 'stable';
      stableCount++;
    } else if (priceDiff > 0) {
      situation = 'cheaper';
      cheaperCount++;
    } else {
      situation = 'more_expensive';
      moreExpensiveCount++;
    }
    
    products.push({
      productName: curItem.productName,
      unit: curItem.unit,
      currentQty: curItem.quantity,
      currentPrice: curItem.unitPrice,
      referencePrice: refItem.unitPrice,
      priceDiffAbsolute: priceDiff,
      priceDiffPercent: priceDiffPct,
      financialImpact: impact,
      currentSupplier: curItem.supplierName || '',
      referenceSupplier: refItem.supplierName || '',
      referenceDate: reference.date.toISOString(),
      situation,
    });
  }
  
  // Add reference-only items (removed products)
  for (const [key, refItem] of Array.from(refMap.entries())) {
    if (!matchedRefKeys.has(key)) {
      products.push({
        productName: refItem.productName,
        unit: refItem.unit,
        currentQty: 0,
        currentPrice: 0,
        referencePrice: refItem.unitPrice,
        priceDiffAbsolute: 0,
        priceDiffPercent: 0,
        financialImpact: 0,
        currentSupplier: '',
        referenceSupplier: refItem.supplierName || '',
        referenceDate: reference.date.toISOString(),
        situation: 'no_reference', // product was in ref but not in current
      });
      noComparisonCount++;
    }
  }
  
  // Calculate price effect
  const priceEffect = volumeAtOldPrices - currentCostComparable; // positive = savings
  const priceEffectPercent = volumeAtOldPrices !== 0 
    ? (priceEffect / volumeAtOldPrices) * 100 
    : 0;
  const priceIndex = volumeAtOldPrices !== 0 
    ? (currentCostComparable / volumeAtOldPrices) * 100 
    : 100;
  
  // Gross total variation
  const grossDifference = reference.totalValue - current.totalValue;
  const grossDifferencePercent = reference.totalValue !== 0 
    ? (grossDifference / reference.totalValue) * 100 
    : 0;
  
  // Calculate comparability
  const comparability = calculateComparability(current, reference, products);
  
  // Determine basket type
  let basketType: ComparisonResult['basketType'];
  const comparableProducts = products.filter(p => 
    p.situation !== 'new_product' && p.situation !== 'no_reference' && p.situation !== 'unit_not_comparable'
  );
  if (comparableProducts.length === current.items.length && comparableProducts.length === reference.items.length) {
    const allSameVolume = comparableProducts.every(p => {
      const refItem = reference.items.find(i => normalizeProductKey(i.productName, i.unit) === normalizeProductKey(p.productName, p.unit));
      return refItem && Math.abs(p.currentQty - refItem.quantity) < 0.001;
    });
    basketType = allSameVolume ? 'identical' : 'same_products_diff_volumes';
  } else {
    basketType = 'partial';
  }
  
  // Check if week is in progress
  const now = new Date();
  const weekStart = getWeekStart(now);
  const weekInProgress = current.date >= weekStart;
  
  // Determine if conclusive
  const isConclusive = comparability.index >= 60 && comparability.financialCoverage >= 70;
  
  // Sort products by financial impact (most negative first = biggest cost increases)
  products.sort((a, b) => a.financialImpact - b.financialImpact);
  
  // Top savings and increases
  const topSavings = products
    .filter(p => p.financialImpact > 0)
    .sort((a, b) => b.financialImpact - a.financialImpact)
    .slice(0, 5);
  
  const topIncreases = products
    .filter(p => p.financialImpact < 0)
    .sort((a, b) => a.financialImpact - b.financialImpact)
    .slice(0, 5);
  
  // Executive phrase
  const executivePhrase = buildExecutivePhrase(
    priceEffect, priceEffectPercent, current, reference, isConclusive, comparability, basketType
  );
  
  return {
    current: {
      totalValue: current.totalValue,
      period: current.period,
      unitName: current.unitName,
      category: current.category,
      itemCount: current.items.length,
      date: current.date.toISOString(),
    },
    reference: {
      totalValue: reference.totalValue,
      period: reference.period,
      unitName: reference.unitName,
      category: reference.category,
      itemCount: reference.items.length,
      date: reference.date.toISOString(),
      purchaseId: reference.id,
    },
    currentCostComparable,
    volumeAtOldPrices,
    priceEffect,
    priceEffectPercent,
    priceIndex,
    grossDifference,
    grossDifferencePercent,
    comparability,
    products,
    cheaperCount,
    moreExpensiveCount,
    stableCount,
    noComparisonCount,
    topSavings,
    topIncreases,
    executivePhrase,
    basketType,
    weekInProgress,
    isConclusive,
  };
}

// ==================== COMPARABILITY ====================

function calculateComparability(
  current: ConsolidatedPurchase,
  reference: ConsolidatedPurchase,
  products: ProductComparison[]
): ComparabilityResult {
  const currentKeys = new Set(current.items.map(i => normalizeProductKey(i.productName, i.unit)));
  const refKeys = new Set(reference.items.map(i => normalizeProductKey(i.productName, i.unit)));
  
  // Product overlap (Dice coefficient)
  const commonKeys = new Set(Array.from(currentKeys).filter(k => refKeys.has(k)));
  const productOverlap = (currentKeys.size + refKeys.size) > 0
    ? (2 * commonKeys.size) / (currentKeys.size + refKeys.size) * 100
    : 0;
  
  // Volume similarity (weighted by current cost)
  let weightedSimilarity = 0;
  let totalWeight = 0;
  
  for (const curItem of current.items) {
    const key = normalizeProductKey(curItem.productName, curItem.unit);
    if (!refKeys.has(key)) continue;
    
    const refItem = reference.items.find(i => normalizeProductKey(i.productName, i.unit) === key);
    if (!refItem) continue;
    
    const weight = curItem.totalPrice; // weight by cost contribution
    const similarity = Math.min(curItem.quantity, refItem.quantity) / Math.max(curItem.quantity, refItem.quantity);
    
    weightedSimilarity += similarity * weight;
    totalWeight += weight;
  }
  
  const volumeSimilarity = totalWeight > 0 ? (weightedSimilarity / totalWeight) * 100 : 0;
  
  // Financial coverage
  const comparableValue = products
    .filter(p => p.situation !== 'new_product' && p.situation !== 'no_reference' && p.situation !== 'unit_not_comparable')
    .reduce((sum, p) => sum + (p.currentQty * p.currentPrice), 0);
  const financialCoverage = current.totalValue > 0 
    ? (comparableValue / current.totalValue) * 100 
    : 0;
  
  // Final index: 60% product overlap + 40% volume similarity
  const index = 0.6 * productOverlap + 0.4 * volumeSimilarity;
  
  // Classification
  let classification: ComparabilityResult['classification'];
  if (index >= 80) classification = 'very_comparable';
  else if (index >= 60) classification = 'comparable_with_differences';
  else classification = 'low_comparability';
  
  return {
    index: Math.round(index * 100) / 100,
    classification,
    productOverlap: Math.round(productOverlap * 100) / 100,
    volumeSimilarity: Math.round(volumeSimilarity * 100) / 100,
    financialCoverage: Math.round(financialCoverage * 100) / 100,
    commonProductsCount: commonKeys.size,
    currentOnlyCount: currentKeys.size - commonKeys.size,
    referenceOnlyCount: refKeys.size - commonKeys.size,
  };
}

// ==================== REFERENCE FINDER ====================

/**
 * Find the best reference purchase for comparison.
 * Priority: 1) previous week same unit/category, 2) last comparable, 3) last 12 months
 */
export function findBestReference(
  current: ConsolidatedPurchase,
  allPurchases: ConsolidatedPurchase[]
): ConsolidatedPurchase | null {
  // Filter: same unit, same category, not the same purchase, valid status
  const candidates = allPurchases.filter(p => 
    p.id !== current.id &&
    p.unitId === current.unitId &&
    p.category.toLowerCase() === current.category.toLowerCase() &&
    p.status !== 'cancelled' &&
    p.date < current.date
  );
  
  if (candidates.length === 0) return null;
  
  // Sort by date descending (most recent first)
  candidates.sort((a, b) => b.date.getTime() - a.date.getTime());
  
  // 1. Previous week
  const currentWeekStart = getWeekStart(current.date);
  const prevWeekStart = new Date(currentWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  const prevWeekEnd = currentWeekStart;
  
  const prevWeekPurchase = candidates.find(p => 
    p.date >= prevWeekStart && p.date < prevWeekEnd
  );
  if (prevWeekPurchase) return prevWeekPurchase;
  
  // 2. Last comparable purchase (most recent before current)
  if (candidates.length > 0) return candidates[0];
  
  return null;
}

// ==================== EVOLUTION ====================

export interface EvolutionPoint {
  period: string;
  date: string;
  totalValue: number;
  normalizedCost: number | null; // cost of a reference basket at this period's prices
  priceIndex: number | null;
  priceEffect: number | null;
  priceEffectPercent: number | null;
  comparability: number | null;
  itemCount: number;
  isCurrentWeek: boolean;
  lowCoverage: boolean;
  unitName: string;
  category: string;
}

/**
 * Calculate evolution over time for a given unit and category.
 * Each point compares to the immediately preceding period.
 */
export function calculateEvolution(
  purchases: ConsolidatedPurchase[],
  unitId: number | null,
  category: string,
  granularity: 'weekly' | 'monthly' = 'weekly'
): EvolutionPoint[] {
  // Filter by unit and category
  let filtered = purchases.filter(p => 
    p.category.toLowerCase() === category.toLowerCase() &&
    p.status !== 'cancelled'
  );
  if (unitId !== null) {
    filtered = filtered.filter(p => p.unitId === unitId);
  }
  
  // Sort by date ascending
  filtered.sort((a, b) => a.date.getTime() - b.date.getTime());
  
  if (filtered.length === 0) return [];
  
  const points: EvolutionPoint[] = [];
  const now = new Date();
  const currentWeekStart = getWeekStart(now);
  
  for (let i = 0; i < filtered.length; i++) {
    const purchase = filtered[i];
    const isCurrentWeek = purchase.date >= currentWeekStart;
    
    let normalizedCost: number | null = null;
    let priceIndex: number | null = null;
    let priceEffect: number | null = null;
    let priceEffectPercent: number | null = null;
    let comparabilityIndex: number | null = null;
    let lowCoverage = false;
    
    if (i > 0) {
      const prev = filtered[i - 1];
      const comparison = comparePurchases(purchase, prev);
      normalizedCost = comparison.volumeAtOldPrices;
      priceIndex = comparison.priceIndex;
      priceEffect = comparison.priceEffect;
      priceEffectPercent = comparison.priceEffectPercent;
      comparabilityIndex = comparison.comparability.index;
      lowCoverage = comparison.comparability.financialCoverage < 70;
    }
    
    points.push({
      period: purchase.period || formatPeriod(purchase.date, granularity),
      date: purchase.date.toISOString(),
      totalValue: purchase.totalValue,
      normalizedCost,
      priceIndex,
      priceEffect,
      priceEffectPercent,
      comparability: comparabilityIndex,
      itemCount: purchase.items.length,
      isCurrentWeek,
      lowCoverage,
      unitName: purchase.unitName,
      category: purchase.category,
    });
  }
  
  return points;
}

// ==================== HELPERS ====================

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1; // Monday = start
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatPeriod(date: Date, granularity: 'weekly' | 'monthly'): string {
  if (granularity === 'monthly') {
    return `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  }
  const weekStart = getWeekStart(date);
  const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
  return `${String(weekStart.getDate()).padStart(2, '0')}/${String(weekStart.getMonth() + 1).padStart(2, '0')} a ${String(weekEnd.getDate()).padStart(2, '0')}/${String(weekEnd.getMonth() + 1).padStart(2, '0')}`;
}

function buildExecutivePhrase(
  priceEffect: number,
  priceEffectPercent: number,
  current: ConsolidatedPurchase,
  reference: ConsolidatedPurchase,
  isConclusive: boolean,
  comparability: ComparabilityResult,
  basketType: ComparisonResult['basketType']
): string {
  if (!isConclusive) {
    return `Não existe uma compra histórica suficientemente semelhante para uma comparação financeira conclusiva. Comparabilidade: ${comparability.index.toFixed(1)}%, cobertura: ${comparability.financialCoverage.toFixed(1)}%.`;
  }
  
  const absEffect = Math.abs(priceEffect);
  const absPct = Math.abs(priceEffectPercent);
  const formattedValue = absEffect.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formattedPct = absPct.toFixed(2);
  
  let basketNote = '';
  if (basketType === 'identical') {
    basketNote = ' (cesta idêntica — comparação direta)';
  } else if (basketType === 'same_products_diff_volumes') {
    basketNote = ' (mesmos produtos, volumes diferentes — resultado normalizado pelo volume atual)';
  } else {
    basketNote = ` (comparação parcial — ${comparability.financialCoverage.toFixed(1)}% do valor atual coberto)`;
  }
  
  if (Math.abs(priceEffectPercent) < 0.5) {
    return `Considerando o volume comprado neste período, a Qualities manteve preços estáveis em relação à última compra comparável de ${current.category} desta unidade${basketNote}.`;
  }
  
  if (priceEffect > 0) {
    return `Considerando o volume comprado neste período, a Qualities pagou R$ ${formattedValue} a menos, equivalente a ${formattedPct}%, em relação à última compra comparável de ${current.category} desta unidade${basketNote}.`;
  }
  
  return `Considerando o mesmo volume atual, a Qualities pagou R$ ${formattedValue} a mais, equivalente a ${formattedPct}%, em relação à referência selecionada${basketNote}.`;
}
