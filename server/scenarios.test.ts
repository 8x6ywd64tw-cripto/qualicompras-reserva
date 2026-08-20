import { describe, it, expect } from "vitest";
import { computeScenarios, type ScenarioItemInput } from "@shared/scenarios";

describe("computeScenarios - Cálculo de Cenários de Custo", () => {
  it("Produto A: 3 fornecedores com preços 10, 12, 15 e quantidade 100", () => {
    const items: ScenarioItemInput[] = [
      {
        quotationItemId: 1,
        productName: "Produto A",
        quantity: 100,
        unit: "UN",
        prices: [
          { supplierId: 1, supplierName: "Fornecedor 1", unitPrice: 10, brand: "Marca A", paymentTerms: null },
          { supplierId: 2, supplierName: "Fornecedor 2", unitPrice: 12, brand: "Marca B", paymentTerms: "30 dias" },
          { supplierId: 3, supplierName: "Fornecedor 3", unitPrice: 15, brand: "Marca C", paymentTerms: null },
        ],
      },
    ];

    const result = computeScenarios(items);

    // Pior: 15 * 100 = 1500
    expect(result.worstTotal).toBe(1500);
    // Ideal: 10 * 100 = 1000
    expect(result.idealTotal).toBe(1000);
    // Mediana de [10, 12, 15] = 12 → 12 * 100 = 1200
    expect(result.medianTotal).toBe(1200);
    // Economia: 1500 - 1000 = 500 (33.3%)
    expect(result.economyValue).toBe(500);
    expect(result.economyPct).toBeCloseTo(33.33, 1);
    // Economia vs mediana: 1200 - 1000 = 200 (16.7%)
    expect(result.economyVsMedian).toBe(200);
    expect(result.economyVsMedianPct).toBeCloseTo(16.67, 1);
    // Tem concorrência suficiente
    expect(result.hasEnoughCompetition).toBe(true);
    expect(result.itemsWithCompetition).toBe(1);
    expect(result.itemsSingleQuote).toBe(0);
    expect(result.itemsNoPrice).toBe(0);
  });

  it("Produto B: 2 fornecedores com preços 8 e 20 e quantidade 50", () => {
    const items: ScenarioItemInput[] = [
      {
        quotationItemId: 2,
        productName: "Produto B",
        quantity: 50,
        unit: "KG",
        prices: [
          { supplierId: 1, supplierName: "Fornecedor 1", unitPrice: 8, brand: "Marca A", paymentTerms: null },
          { supplierId: 2, supplierName: "Fornecedor 2", unitPrice: 20, brand: "Marca B", paymentTerms: null },
        ],
      },
    ];

    const result = computeScenarios(items);

    // Pior: 20 * 50 = 1000
    expect(result.worstTotal).toBe(1000);
    // Ideal: 8 * 50 = 400
    expect(result.idealTotal).toBe(400);
    // Mediana de [8, 20] = (8+20)/2 = 14 → 14 * 50 = 700
    expect(result.medianTotal).toBe(700);
    // Economia: 1000 - 400 = 600 (60%)
    expect(result.economyValue).toBe(600);
    expect(result.economyPct).toBeCloseTo(60.0, 1);
  });

  it("Múltiplos produtos: A + B combinados", () => {
    const items: ScenarioItemInput[] = [
      {
        quotationItemId: 1,
        productName: "Produto A",
        quantity: 100,
        unit: "UN",
        prices: [
          { supplierId: 1, supplierName: "F1", unitPrice: 10, brand: "", paymentTerms: null },
          { supplierId: 2, supplierName: "F2", unitPrice: 12, brand: "", paymentTerms: null },
          { supplierId: 3, supplierName: "F3", unitPrice: 15, brand: "", paymentTerms: null },
        ],
      },
      {
        quotationItemId: 2,
        productName: "Produto B",
        quantity: 50,
        unit: "KG",
        prices: [
          { supplierId: 1, supplierName: "F1", unitPrice: 8, brand: "", paymentTerms: null },
          { supplierId: 2, supplierName: "F2", unitPrice: 20, brand: "", paymentTerms: null },
        ],
      },
    ];

    const result = computeScenarios(items);

    // Pior: (15*100) + (20*50) = 1500 + 1000 = 2500
    expect(result.worstTotal).toBe(2500);
    // Ideal: (10*100) + (8*50) = 1000 + 400 = 1400
    expect(result.idealTotal).toBe(1400);
    // Mediana: (12*100) + (14*50) = 1200 + 700 = 1900
    expect(result.medianTotal).toBe(1900);
    // Economia: 2500 - 1400 = 1100 (44%)
    expect(result.economyValue).toBe(1100);
    expect(result.economyPct).toBeCloseTo(44.0, 1);
  });

  it("Item sem preço válido (preço 0)", () => {
    const items: ScenarioItemInput[] = [
      {
        quotationItemId: 1,
        productName: "Produto C",
        quantity: 100,
        unit: "UN",
        prices: [
          { supplierId: 1, supplierName: "F1", unitPrice: 0, brand: "", paymentTerms: null },
        ],
      },
    ];

    const result = computeScenarios(items);

    expect(result.itemsNoPrice).toBe(1);
    expect(result.itemsWithCompetition).toBe(0);
    expect(result.hasEnoughCompetition).toBe(false);
    expect(result.worstTotal).toBe(0);
    expect(result.idealTotal).toBe(0);
  });

  it("Item com apenas 1 fornecedor (sem concorrência)", () => {
    const items: ScenarioItemInput[] = [
      {
        quotationItemId: 1,
        productName: "Produto D",
        quantity: 200,
        unit: "UN",
        prices: [
          { supplierId: 1, supplierName: "F1", unitPrice: 5, brand: "Marca X", paymentTerms: null },
        ],
      },
    ];

    const result = computeScenarios(items);

    // Sem concorrência mas tem preço
    expect(result.itemsSingleQuote).toBe(1);
    expect(result.itemsWithCompetition).toBe(0);
    // Pior = Ideal = 5 * 200 = 1000 (só um fornecedor)
    expect(result.worstTotal).toBe(1000);
    expect(result.idealTotal).toBe(1000);
    expect(result.medianTotal).toBe(1000);
    // Sem economia possível
    expect(result.economyValue).toBe(0);
    expect(result.economyPct).toBe(0);
  });

  it("Item sem nenhum fornecedor", () => {
    const items: ScenarioItemInput[] = [
      {
        quotationItemId: 1,
        productName: "Produto E",
        quantity: 50,
        unit: "UN",
        prices: [],
      },
    ];

    const result = computeScenarios(items);

    expect(result.itemsNoPrice).toBe(1);
    expect(result.hasEnoughCompetition).toBe(false);
    expect(result.worstTotal).toBe(0);
    expect(result.idealTotal).toBe(0);
  });

  it("Distribuição por fornecedor no cenário ideal", () => {
    const items: ScenarioItemInput[] = [
      {
        quotationItemId: 1,
        productName: "Produto A",
        quantity: 100,
        unit: "UN",
        prices: [
          { supplierId: 1, supplierName: "F1", unitPrice: 10, brand: "", paymentTerms: null },
          { supplierId: 2, supplierName: "F2", unitPrice: 12, brand: "", paymentTerms: null },
        ],
      },
      {
        quotationItemId: 2,
        productName: "Produto B",
        quantity: 50,
        unit: "KG",
        prices: [
          { supplierId: 1, supplierName: "F1", unitPrice: 20, brand: "", paymentTerms: null },
          { supplierId: 2, supplierName: "F2", unitPrice: 8, brand: "", paymentTerms: null },
        ],
      },
    ];

    const result = computeScenarios(items);

    // Ideal: Produto A → F1 (10*100=1000), Produto B → F2 (8*50=400)
    // F1: 1 item, 1000; F2: 1 item, 400
    expect(result.idealBySupplier).toHaveLength(2);
    const f1 = result.idealBySupplier.find(s => s.supplierId === 1);
    const f2 = result.idealBySupplier.find(s => s.supplierId === 2);
    expect(f1?.itemCount).toBe(1);
    expect(f1?.subtotal).toBe(1000);
    expect(f2?.itemCount).toBe(1);
    expect(f2?.subtotal).toBe(400);
    // Total ideal = 1400
    expect(f1?.participationPct + f2?.participationPct).toBeCloseTo(100, 0);
  });

  it("Preço outlier (>200) deve ser excluído pelo chamador, não pela função", () => {
    // A função computeScenarios não filtra outliers - isso é responsabilidade do chamador
    // Aqui testamos que com 2 preços válidos, a função calcula corretamente
    const items: ScenarioItemInput[] = [
      {
        quotationItemId: 1,
        productName: "Arroz",
        quantity: 840,
        unit: "KG",
        prices: [
          { supplierId: 1, supplierName: "F1", unitPrice: 3.48, brand: "", paymentTerms: null },
          { supplierId: 2, supplierName: "F2", unitPrice: 5.20, brand: "", paymentTerms: null },
        ],
      },
    ];

    const result = computeScenarios(items);

    // 2 preços válidos = concorrência
    expect(result.itemsWithCompetition).toBe(1);
    // Pior: 5.20 * 840 = 4368
    expect(result.worstTotal).toBeCloseTo(4368, 2);
    // Ideal: 3.48 * 840 = 2923.20
    expect(result.idealTotal).toBeCloseTo(2923.20, 2);
    // Mediana de [3.48, 5.20] = (3.48+5.20)/2 = 4.34 → 4.34 * 840 = 3645.60
    expect(result.medianTotal).toBeCloseTo(3645.60, 2);
  });
});
