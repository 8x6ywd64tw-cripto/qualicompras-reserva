import { describe, it, expect } from "vitest";

/**
 * Unit tests for the purchase optimization algorithm logic.
 * Tests the core decision-making criteria:
 * 1. Single supplier → goes directly to that supplier
 * 2. Multiple suppliers → cheapest wins
 * 3. Credit supplier within tolerance → preferred over cash supplier
 * 4. Credit supplier above tolerance → cash supplier wins
 */

// Simulate the optimization logic extracted from the router
function optimizeItems(
  items: Array<{ id: number; productName: string; quantity: number; unit: string }>,
  proposalsByItem: Record<number, Array<{
    supplierId: number;
    supplierName: string;
    unitPrice: number;
    brand: string;
    paymentTerms: string | null;
  }>>,
  tolerancePct: number = 3
) {
  const tolerance = tolerancePct / 100;
  const result: Array<{
    productName: string;
    selectedSupplierId: number;
    selectedSupplierName: string;
    unitPrice: number;
    total: number;
    reason: string;
  }> = [];
  const noSupplier: Array<{ productName: string }> = [];

  for (const item of items) {
    const options = proposalsByItem[item.id];
    if (!options || options.length === 0) {
      noSupplier.push({ productName: item.productName });
      continue;
    }

    if (options.length === 1) {
      const o = options[0];
      result.push({
        productName: item.productName,
        selectedSupplierId: o.supplierId,
        selectedSupplierName: o.supplierName,
        unitPrice: o.unitPrice,
        total: Math.round(o.unitPrice * item.quantity * 100) / 100,
        reason: "Único fornecedor",
      });
      continue;
    }

    const sorted = [...options].sort((a, b) => a.unitPrice - b.unitPrice);
    const cheapest = sorted[0];

    const isCreditSupplier = (o: typeof options[0]) => {
      const terms = (o.paymentTerms || "").toUpperCase().trim();
      return terms && terms !== "À VISTA" && terms !== "A VISTA" && terms !== "AVISTA";
    };

    const creditOptions = sorted.filter(o => isCreditSupplier(o));
    const limite = cheapest.unitPrice * (1 + tolerance);

    let selected = cheapest;
    let reason = "Menor preço";

    if (creditOptions.length > 0) {
      const bestCredit = creditOptions[0];
      if (bestCredit.unitPrice <= limite) {
        if (bestCredit.supplierId === cheapest.supplierId) {
          reason = "Menor preço (a prazo)";
        } else {
          reason = `Prazo (dentro de ${tolerancePct}%)`;
        }
        selected = bestCredit;
      }
    }

    result.push({
      productName: item.productName,
      selectedSupplierId: selected.supplierId,
      selectedSupplierName: selected.supplierName,
      unitPrice: selected.unitPrice,
      total: Math.round(selected.unitPrice * item.quantity * 100) / 100,
      reason,
    });
  }

  return { result, noSupplier };
}

describe("Purchase Optimization Algorithm", () => {
  it("should assign item to single supplier when only one quotes", () => {
    const items = [{ id: 1, productName: "ARROZ", quantity: 100, unit: "KG" }];
    const proposals = {
      1: [{ supplierId: 1, supplierName: "Oliveira", unitPrice: 3.98, brand: "CAETE", paymentTerms: "À VISTA" }],
    };
    const { result } = optimizeItems(items, proposals);
    expect(result[0].selectedSupplierId).toBe(1);
    expect(result[0].reason).toBe("Único fornecedor");
  });

  it("should pick cheapest supplier when multiple quote", () => {
    const items = [{ id: 1, productName: "ARROZ", quantity: 100, unit: "KG" }];
    const proposals = {
      1: [
        { supplierId: 1, supplierName: "Oliveira", unitPrice: 3.98, brand: "CAETE", paymentTerms: "À VISTA" },
        { supplierId: 2, supplierName: "Mix Mateus", unitPrice: 2.88, brand: "Pop", paymentTerms: null },
      ],
    };
    const { result } = optimizeItems(items, proposals);
    expect(result[0].selectedSupplierId).toBe(2);
    expect(result[0].unitPrice).toBe(2.88);
    expect(result[0].reason).toBe("Menor preço");
  });

  it("should prefer credit supplier within 3% tolerance", () => {
    const items = [{ id: 1, productName: "CAFE", quantity: 120, unit: "PCT" }];
    const proposals = {
      1: [
        { supplierId: 1, supplierName: "Mix Mateus", unitPrice: 10.98, brand: "Kimimo", paymentTerms: null },
        { supplierId: 2, supplierName: "Vó Ita", unitPrice: 11.22, brand: "PAI VOVO", paymentTerms: "8 DIAS" },
      ],
    };
    // Vó Ita is 2.2% more expensive → within 3% tolerance → should win
    const { result } = optimizeItems(items, proposals);
    expect(result[0].selectedSupplierId).toBe(2);
    expect(result[0].reason).toContain("Prazo");
  });

  it("should NOT prefer credit supplier above 3% tolerance", () => {
    const items = [{ id: 1, productName: "FEIJAO", quantity: 70, unit: "KG" }];
    const proposals = {
      1: [
        { supplierId: 1, supplierName: "Mix Mateus", unitPrice: 6.98, brand: "Clebom", paymentTerms: null },
        { supplierId: 2, supplierName: "Vó Ita", unitPrice: 10.29, brand: "CAMIL", paymentTerms: "8 DIAS" },
      ],
    };
    // Vó Ita is 47% more expensive → way above 3% → Mix Mateus wins
    const { result } = optimizeItems(items, proposals);
    expect(result[0].selectedSupplierId).toBe(1);
    expect(result[0].reason).toBe("Menor preço");
  });

  it("should mark items without any supplier quote", () => {
    const items = [{ id: 1, productName: "CREMOSINHO", quantity: 1378, unit: "UND" }];
    const proposals: Record<number, any[]> = { 1: [] };
    const { noSupplier } = optimizeItems(items, proposals);
    expect(noSupplier.length).toBe(1);
    expect(noSupplier[0].productName).toBe("CREMOSINHO");
  });

  it("should prefer credit supplier when it IS the cheapest", () => {
    const items = [{ id: 1, productName: "MARGARINA", quantity: 66, unit: "UN" }];
    const proposals = {
      1: [
        { supplierId: 1, supplierName: "Oliveira", unitPrice: 28.98, brand: "PURO SABOR", paymentTerms: "À VISTA" },
        { supplierId: 2, supplierName: "Vó Ita", unitPrice: 25.61, brand: "DELINE", paymentTerms: "8 DIAS" },
      ],
    };
    const { result } = optimizeItems(items, proposals);
    expect(result[0].selectedSupplierId).toBe(2);
    expect(result[0].reason).toBe("Menor preço (a prazo)");
  });

  it("should calculate correct totals", () => {
    const items = [{ id: 1, productName: "OLEO", quantity: 120, unit: "UN" }];
    const proposals = {
      1: [
        { supplierId: 1, supplierName: "Vó Ita", unitPrice: 7.82, brand: "COAMO", paymentTerms: "8 DIAS" },
        { supplierId: 2, supplierName: "Oliveira", unitPrice: 7.98, brand: "SOYA", paymentTerms: "À VISTA" },
      ],
    };
    const { result } = optimizeItems(items, proposals);
    expect(result[0].total).toBe(938.40);
    expect(result[0].selectedSupplierId).toBe(1);
  });

  it("should handle custom tolerance percentage", () => {
    const items = [{ id: 1, productName: "TEST", quantity: 100, unit: "UN" }];
    const proposals = {
      1: [
        { supplierId: 1, supplierName: "Cash", unitPrice: 10.00, brand: "A", paymentTerms: "À VISTA" },
        { supplierId: 2, supplierName: "Credit", unitPrice: 10.50, brand: "B", paymentTerms: "15 DIAS" },
      ],
    };
    // 5% tolerance: Credit is 5% more expensive → within 5% → Credit wins
    const { result } = optimizeItems(items, proposals, 5);
    expect(result[0].selectedSupplierId).toBe(2);

    // 3% tolerance: Credit is 5% more expensive → above 3% → Cash wins
    const { result: result2 } = optimizeItems(items, proposals, 3);
    expect(result2[0].selectedSupplierId).toBe(1);
  });
});
