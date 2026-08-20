/**
 * Central calculation function for cost scenarios.
 * Used by both the "Cenários de custo" panel and the "Compra Otimizada" endpoint.
 * Pure function — no DB access, no side effects.
 *
 * Rules (from spec):
 * - Only valid prices from the current quotation are used
 * - For each item: line_value = quantity × comparable_unit_price
 * - worst_item = max valid line value
 * - median_item = median of valid line values
 * - ideal_item = min valid line value
 * - Items with only 1 valid quote: same value in all 3 scenarios, flagged "Sem concorrência"
 * - Items with 0 valid quotes: flagged "Sem preço válido", excluded from totals
 * - Economy = worst_total − ideal_total
 * - Uses decimal-safe rounding (round each subtotal to 2 decimals before summing)
 */

export interface ScenarioItemInput {
  quotationItemId: number;
  productName: string;
  quantity: number;
  unit: string;
  prices: Array<{
    supplierId: number;
    supplierName: string;
    unitPrice: number; // normalized comparable price per unit
    brand: string;
    paymentTerms: string | null;
  }>;
}

export interface ScenarioResult {
  worstTotal: number;
  medianTotal: number;
  idealTotal: number;
  economyValue: number;       // worstTotal - idealTotal
  economyPct: number;         // economyValue / worstTotal * 100
  economyVsMedian: number;    // medianTotal - idealTotal
  economyVsMedianPct: number; // economyVsMedian / medianTotal * 100
  itemsWithCompetition: number;
  itemsSingleQuote: number;
  itemsNoPrice: number;
  hasEnoughCompetition: boolean; // at least 1 item with 2+ valid quotes
  perItem: Array<{
    quotationItemId: number;
    productName: string;
    quantity: number;
    unit: string;
    validPrices: number;
    worstPrice: number | null;
    medianPrice: number | null;
    idealPrice: number | null;
    worstTotal: number | null;
    medianTotal: number | null;
    idealTotal: number | null;
    idealSupplierId: number | null;
    idealSupplierName: string | null;
    hasCompetition: boolean;
    noPrice: boolean;
  }>;
  idealBySupplier: Array<{
    supplierId: number;
    supplierName: string;
    itemCount: number;
    items: Array<{
      productName: string;
      quantity: number;
      unit: string;
      unitPrice: number;
      total: number;
      brand: string;
      paymentTerms: string | null;
    }>;
    subtotal: number;
    participationPct: number;
  }>;
  disclaimer: string;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function computeScenarios(items: ScenarioItemInput[]): ScenarioResult {
  const perItem: ScenarioResult["perItem"] = [];
  const idealDistribution: Map<number, {
    supplierId: number;
    supplierName: string;
    items: Array<{
      productName: string;
      quantity: number;
      unit: string;
      unitPrice: number;
      total: number;
      brand: string;
      paymentTerms: string | null;
    }>;
    subtotal: number;
  }> = new Map();

  let itemsWithCompetition = 0;
  let itemsSingleQuote = 0;
  let itemsNoPrice = 0;
  let worstTotal = 0;
  let medianTotal = 0;
  let idealTotal = 0;

  for (const item of items) {
    const validPrices = item.prices
      .filter(p => p.unitPrice > 0 && isFinite(p.unitPrice))
      .sort((a, b) => a.unitPrice - b.unitPrice);

    if (validPrices.length === 0) {
      itemsNoPrice++;
      perItem.push({
        quotationItemId: item.quotationItemId,
        productName: item.productName,
        quantity: item.quantity,
        unit: item.unit,
        validPrices: 0,
        worstPrice: null,
        medianPrice: null,
        idealPrice: null,
        worstTotal: null,
        medianTotal: null,
        idealTotal: null,
        idealSupplierId: null,
        idealSupplierName: null,
        hasCompetition: false,
        noPrice: true,
      });
      continue;
    }

    const prices = validPrices.map(p => p.unitPrice);
    const worst = prices[prices.length - 1];
    const med = median(prices);
    const best = prices[0];
    const qty = item.quantity;

    const worstLine = round2(worst * qty);
    const medianLine = round2(med * qty);
    const idealLine = round2(best * qty);

    worstTotal += worstLine;
    medianTotal += medianLine;
    idealTotal += idealLine;

    const hasCompetition = validPrices.length >= 2;
    if (hasCompetition) {
      itemsWithCompetition++;
    } else {
      itemsSingleQuote++;
    }

    // Find the ideal supplier (cheapest)
    const idealSupplier = validPrices[0];

    // Add to ideal distribution
    if (!idealDistribution.has(idealSupplier.supplierId)) {
      idealDistribution.set(idealSupplier.supplierId, {
        supplierId: idealSupplier.supplierId,
        supplierName: idealSupplier.supplierName,
        items: [],
        subtotal: 0,
      });
    }
    const dist = idealDistribution.get(idealSupplier.supplierId)!;
    dist.items.push({
      productName: item.productName,
      quantity: qty,
      unit: item.unit,
      unitPrice: best,
      total: idealLine,
      brand: idealSupplier.brand,
      paymentTerms: idealSupplier.paymentTerms,
    });
    dist.subtotal += idealLine;

    perItem.push({
      quotationItemId: item.quotationItemId,
      productName: item.productName,
      quantity: qty,
      unit: item.unit,
      validPrices: validPrices.length,
      worstPrice: worst,
      medianPrice: med,
      idealPrice: best,
      worstTotal: worstLine,
      medianTotal: medianLine,
      idealTotal: idealLine,
      idealSupplierId: idealSupplier.supplierId,
      idealSupplierName: idealSupplier.supplierName,
      hasCompetition,
      noPrice: false,
    });
  }

  worstTotal = round2(worstTotal);
  medianTotal = round2(medianTotal);
  idealTotal = round2(idealTotal);

  const economyValue = round2(worstTotal - idealTotal);
  const economyPct = worstTotal > 0 ? round2((economyValue / worstTotal) * 10000) / 100 : 0;
  const economyVsMedian = round2(medianTotal - idealTotal);
  const economyVsMedianPct = medianTotal > 0 ? round2((economyVsMedian / medianTotal) * 10000) / 100 : 0;

  const hasEnoughCompetition = itemsWithCompetition > 0;

  const idealBySupplier = Array.from(idealDistribution.values())
    .map(d => ({
      supplierId: d.supplierId,
      supplierName: d.supplierName,
      itemCount: d.items.length,
      items: d.items,
      subtotal: round2(d.subtotal),
      participationPct: idealTotal > 0 ? round2((d.subtotal / idealTotal) * 10000) / 100 : 0,
    }))
    .sort((a, b) => b.subtotal - a.subtotal);

  return {
    worstTotal,
    medianTotal,
    idealTotal,
    economyValue,
    economyPct,
    economyVsMedian,
    economyVsMedianPct,
    itemsWithCompetition,
    itemsSingleQuote,
    itemsNoPrice,
    hasEnoughCompetition,
    perItem,
    idealBySupplier,
    disclaimer: "Análise baseada nos preços dos itens; frete, pedido mínimo e condições adicionais não informados não estão incluídos.",
  };
}
