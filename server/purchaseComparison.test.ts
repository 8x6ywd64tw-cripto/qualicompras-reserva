import { describe, it, expect } from 'vitest';
import {
  consolidateOrders,
  comparePurchases,
  findBestReference,
  calculateEvolution,
  normalizeProductName,
  type BasketItem,
  type ConsolidatedPurchase,
} from './purchaseComparison';

// ==================== UNIT TESTS: normalizeProductName ====================
describe('normalizeProductName', () => {
  it('normalizes case and trims whitespace', () => {
    expect(normalizeProductName('  FEIJAO CARIOCA - 1KG  ')).toBe('feijao carioca 1kg');
  });

  it('removes dashes and extra spaces', () => {
    expect(normalizeProductName('OLEO - 900ML')).toBe('oleo 900ml');
  });

  it('handles accented characters', () => {
    expect(normalizeProductName('AÇÚCAR REFINADO - 5KG')).toBe('acucar refinado 5kg');
  });
});

// ==================== UNIT TESTS: consolidateOrders ====================
describe('consolidateOrders', () => {
  it('groups orders by purchaseGroupId', () => {
    const orders = [
      { id: 1, purchaseGroupId: 'G1', quotationId: 100, unitId: 1, unitName: 'Ipaumirim', category: 'Cereais', period: '16/07 a 26/07', createdAt: '2026-07-24T00:00:00Z', totalValue: '5000', items: [{ productName: 'ARROZ', quantity: 10, unit: 'KG', unitPrice: 5, totalPrice: 50, supplierId: 1, supplierName: 'Sup A' }] },
      { id: 2, purchaseGroupId: 'G1', quotationId: 100, unitId: 1, unitName: 'Ipaumirim', category: 'Cereais', period: '16/07 a 26/07', createdAt: '2026-07-24T00:00:00Z', totalValue: '3000', items: [{ productName: 'FEIJAO', quantity: 5, unit: 'KG', unitPrice: 8, totalPrice: 40, supplierId: 2, supplierName: 'Sup B' }] },
    ];
    const result = consolidateOrders(orders as any);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('G1');
    expect(result[0].items.length).toBe(2);
    expect(result[0].totalValue).toBe(8000);
  });

  it('creates separate groups for orders without purchaseGroupId', () => {
    const orders = [
      { id: 1, purchaseGroupId: null, quotationId: 100, unitId: 1, unitName: 'Ipaumirim', category: 'Cereais', period: '', createdAt: '2026-07-20T00:00:00Z', totalValue: '1000', items: [{ productName: 'ARROZ', quantity: 10, unit: 'KG', unitPrice: 5, totalPrice: 50, supplierId: 1, supplierName: 'A' }] },
      { id: 2, purchaseGroupId: null, quotationId: 200, unitId: 1, unitName: 'Ipaumirim', category: 'Cereais', period: '', createdAt: '2026-07-22T00:00:00Z', totalValue: '2000', items: [{ productName: 'FEIJAO', quantity: 5, unit: 'KG', unitPrice: 8, totalPrice: 40, supplierId: 2, supplierName: 'B' }] },
    ];
    const result = consolidateOrders(orders as any);
    expect(result.length).toBe(2);
  });
});

// ==================== UNIT TESTS: comparePurchases ====================
describe('comparePurchases', () => {
  const makeBasket = (items: Array<{ name: string; qty: number; price: number }>): BasketItem[] =>
    items.map(i => ({ productName: i.name, quantity: i.qty, unit: 'KG', unitPrice: i.price, totalPrice: i.qty * i.price, supplierId: 1, supplierName: 'Test' }));

  const makePurchase = (id: string, items: BasketItem[], date: string, period = ''): ConsolidatedPurchase => ({
    id,
    items,
    totalValue: items.reduce((s, i) => s + i.totalPrice, 0),
    date: new Date(date),
    period,
    unitId: 1,
    unitName: 'Test Unit',
    category: 'Cereais',
  });

  it('calculates zero price effect for identical baskets', () => {
    const items = makeBasket([{ name: 'ARROZ - 1KG', qty: 10, price: 5 }, { name: 'FEIJAO - 1KG', qty: 5, price: 8 }]);
    const current = makePurchase('C1', items, '2026-07-24');
    const reference = makePurchase('R1', items, '2026-07-17');
    const result = comparePurchases(current, reference);
    expect(result.priceEffect).toBe(0);
    expect(result.priceEffectPercent).toBe(0);
    expect(result.priceIndex).toBe(100);
    expect(result.comparability.index).toBe(100);
  });

  it('detects price increase correctly', () => {
    const refItems = makeBasket([{ name: 'ARROZ - 1KG', qty: 10, price: 5 }]);
    const curItems = makeBasket([{ name: 'ARROZ - 1KG', qty: 10, price: 6 }]);
    const current = makePurchase('C1', curItems, '2026-07-24');
    const reference = makePurchase('R1', refItems, '2026-07-17');
    const result = comparePurchases(current, reference);
    // Price went from 5 to 6 = +20% increase
    // priceEffect should be NEGATIVE (it costs more now, so savings are negative)
    expect(result.priceEffect).toBeLessThan(0);
    expect(result.priceEffectPercent).toBeCloseTo(-20, 0);
    expect(result.priceIndex).toBeCloseTo(120, 0);
    expect(result.moreExpensiveCount).toBe(1);
    expect(result.cheaperCount).toBe(0);
  });

  it('detects price decrease (economy) correctly', () => {
    const refItems = makeBasket([{ name: 'ARROZ - 1KG', qty: 10, price: 10 }]);
    const curItems = makeBasket([{ name: 'ARROZ - 1KG', qty: 10, price: 8 }]);
    const current = makePurchase('C1', curItems, '2026-07-24');
    const reference = makePurchase('R1', refItems, '2026-07-17');
    const result = comparePurchases(current, reference);
    // Price went from 10 to 8 = -20% decrease = economy
    expect(result.priceEffect).toBeGreaterThan(0);
    expect(result.priceEffectPercent).toBeCloseTo(20, 0);
    expect(result.priceIndex).toBeCloseTo(80, 0);
    expect(result.cheaperCount).toBe(1);
    expect(result.moreExpensiveCount).toBe(0);
  });

  it('isolates price effect from volume effect', () => {
    // Same prices, different quantities → price effect should be zero
    const refItems = makeBasket([{ name: 'ARROZ - 1KG', qty: 10, price: 5 }]);
    const curItems = makeBasket([{ name: 'ARROZ - 1KG', qty: 20, price: 5 }]);
    const current = makePurchase('C1', curItems, '2026-07-24');
    const reference = makePurchase('R1', refItems, '2026-07-17');
    const result = comparePurchases(current, reference);
    expect(result.priceEffect).toBe(0);
    expect(result.priceIndex).toBe(100);
  });

  it('handles partial overlap (comparability < 100%)', () => {
    const refItems = makeBasket([{ name: 'ARROZ - 1KG', qty: 10, price: 5 }, { name: 'FEIJAO - 1KG', qty: 5, price: 8 }]);
    const curItems = makeBasket([{ name: 'ARROZ - 1KG', qty: 10, price: 6 }, { name: 'SAL - 1KG', qty: 3, price: 2 }]);
    const current = makePurchase('C1', curItems, '2026-07-24');
    const reference = makePurchase('R1', refItems, '2026-07-17');
    const result = comparePurchases(current, reference);
    // Only ARROZ is common
    expect(result.comparability.commonProductsCount).toBe(1);
    expect(result.comparability.currentOnlyCount).toBe(1);
    expect(result.comparability.referenceOnlyCount).toBe(1);
    expect(result.comparability.index).toBeLessThan(100);
  });

  it('returns topSavings and topIncreases sorted by financial impact', () => {
    const refItems = makeBasket([
      { name: 'ARROZ - 1KG', qty: 100, price: 5 },
      { name: 'FEIJAO - 1KG', qty: 50, price: 8 },
      { name: 'SAL - 1KG', qty: 20, price: 2 },
    ]);
    const curItems = makeBasket([
      { name: 'ARROZ - 1KG', qty: 100, price: 4 },   // -R$100 savings
      { name: 'FEIJAO - 1KG', qty: 50, price: 10 },  // +R$100 increase
      { name: 'SAL - 1KG', qty: 20, price: 1.5 },    // -R$10 savings
    ]);
    const current = makePurchase('C1', curItems, '2026-07-24');
    const reference = makePurchase('R1', refItems, '2026-07-17');
    const result = comparePurchases(current, reference);
    expect(result.topSavings.length).toBeGreaterThan(0);
    expect(result.topIncreases.length).toBeGreaterThan(0);
    // Biggest saving should be ARROZ
    expect(result.topSavings[0].productName.toLowerCase()).toContain('arroz');
  });

  it('marks comparison as non-conclusive when comparability is low', () => {
    const refItems = makeBasket([{ name: 'ARROZ - 1KG', qty: 10, price: 5 }]);
    const curItems = makeBasket([
      { name: 'FEIJAO - 1KG', qty: 5, price: 8 },
      { name: 'SAL - 1KG', qty: 3, price: 2 },
      { name: 'OLEO - 900ML', qty: 2, price: 9 },
    ]);
    const current = makePurchase('C1', curItems, '2026-07-24');
    const reference = makePurchase('R1', refItems, '2026-07-17');
    const result = comparePurchases(current, reference);
    expect(result.isConclusive).toBe(false);
  });
});

// ==================== UNIT TESTS: findBestReference ====================
describe('findBestReference', () => {
  const makeSimplePurchase = (id: string, unitId: number, category: string, date: string): ConsolidatedPurchase => ({
    id,
    items: [{ productName: 'ARROZ', quantity: 10, unit: 'KG', unitPrice: 5, totalPrice: 50, supplierId: 1, supplierName: 'A' }],
    totalValue: 50,
    date: new Date(date),
    period: '',
    unitId,
    unitName: 'Test',
    category,
  });

  it('returns null when no other purchases exist', () => {
    const current = makeSimplePurchase('C1', 1, 'Cereais', '2026-07-24');
    const result = findBestReference(current, [current]);
    expect(result).toBeNull();
  });

  it('prefers same unit + same category', () => {
    const current = makeSimplePurchase('C1', 1, 'Cereais', '2026-07-24');
    const sameUnitCat = makeSimplePurchase('R1', 1, 'Cereais', '2026-07-17');
    const diffUnit = makeSimplePurchase('R2', 2, 'Cereais', '2026-07-17');
    const result = findBestReference(current, [current, sameUnitCat, diffUnit]);
    expect(result?.id).toBe('R1');
  });

  it('returns the most recent reference (not the current)', () => {
    const current = makeSimplePurchase('C1', 1, 'Cereais', '2026-07-24');
    const older = makeSimplePurchase('R1', 1, 'Cereais', '2026-07-10');
    const newer = makeSimplePurchase('R2', 1, 'Cereais', '2026-07-17');
    const result = findBestReference(current, [current, older, newer]);
    expect(result?.id).toBe('R2');
  });
});

// ==================== UNIT TESTS: calculateEvolution ====================
describe('calculateEvolution', () => {
  it('returns empty for no matching purchases', () => {
    const result = calculateEvolution([], 1, 'Cereais', 'weekly');
    expect(result).toEqual([]);
  });

  it('calculates price index relative to first purchase', () => {
    const purchases: ConsolidatedPurchase[] = [
      {
        id: 'P1',
        items: [{ productName: 'ARROZ - 1KG', quantity: 10, unit: 'KG', unitPrice: 5, totalPrice: 50, supplierId: 1, supplierName: 'A' }],
        totalValue: 50,
        date: new Date('2026-07-10'),
        period: '10/07 a 16/07',
        unitId: 1,
        unitName: 'Test',
        category: 'Cereais',
      },
      {
        id: 'P2',
        items: [{ productName: 'ARROZ - 1KG', quantity: 10, unit: 'KG', unitPrice: 6, totalPrice: 60, supplierId: 1, supplierName: 'A' }],
        totalValue: 60,
        date: new Date('2026-07-17'),
        period: '16/07 a 22/07',
        unitId: 1,
        unitName: 'Test',
        category: 'Cereais',
      },
    ];
    const result = calculateEvolution(purchases, 1, 'Cereais', 'weekly');
    expect(result.length).toBe(2);
    expect(result[0].priceIndex).toBeNull(); // first has no reference
    expect(result[1].priceIndex).toBeCloseTo(120, 0); // 6/5 * 100 = 120
  });
});
