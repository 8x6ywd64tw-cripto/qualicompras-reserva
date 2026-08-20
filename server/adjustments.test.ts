import { describe, expect, it } from "vitest";
import { z } from "zod";

// Replicate the Zod schema from routers.ts for adjustments.create
const adjustmentItemSchema = z.object({
  quotationItemId: z.number(),
  productName: z.string(),
  quantity: z.number(),
  unit: z.string(),
  recommendedSupplierId: z.number(),
  recommendedSupplierName: z.string(),
  recommendedUnitPrice: z.number(),
  recommendedTotal: z.number(),
  recommendedBrand: z.string().optional().nullable(),
  recommendedReason: z.string().optional().nullable(),
  cheapestSupplierId: z.number().optional().nullable(),
  cheapestSupplierName: z.string().optional().nullable(),
  cheapestUnitPrice: z.number().optional().nullable(),
  selectedSupplierId: z.number(),
  selectedSupplierName: z.string(),
  selectedUnitPrice: z.number(),
  selectedTotal: z.number(),
  selectedBrand: z.string().optional().nullable(),
  impactValue: z.number(),
  impactPct: z.number(),
  justificationCategory: z.string(),
  justificationText: z.string().min(10),
});

const supplierItemSchema = z.object({
  productName: z.string(),
  quantity: z.number(),
  unit: z.string(),
  unitPrice: z.number(),
  total: z.number(),
  packagingType: z.string().optional().nullable(),
  unitsPerPackage: z.number().optional().nullable(),
});

const adjustmentsCreateSchema = z.object({
  quotationId: z.number(),
  adjustments: z.array(adjustmentItemSchema),
  suppliers: z.array(z.object({
    supplierId: z.number(),
    items: z.array(supplierItemSchema),
    total: z.number(),
  })),
});

describe("adjustments.create Zod schema validation", () => {
  it("accepts null for optional brand/reason fields", () => {
    const payload = {
      quotationId: 960001,
      adjustments: [{
        quotationItemId: 1020001,
        productName: "ALMONDEGAS BOVINA",
        quantity: 100,
        unit: "kg",
        recommendedSupplierId: 14,
        recommendedSupplierName: "Oliveira Distribuidora",
        recommendedUnitPrice: 5.5,
        recommendedTotal: 550,
        recommendedBrand: null,
        recommendedReason: null,
        cheapestSupplierId: null,
        cheapestSupplierName: null,
        cheapestUnitPrice: null,
        selectedSupplierId: 17,
        selectedSupplierName: "Martins Atacado",
        selectedUnitPrice: 5.8,
        selectedTotal: 580,
        selectedBrand: null,
        impactValue: 30,
        impactPct: 5.45,
        justificationCategory: "Ajuste manual",
        justificationText: "Fornecedor preferencial com melhor prazo de entrega",
      }],
      suppliers: [{
        supplierId: 17,
        items: [{
          productName: "ALMONDEGAS BOVINA",
          quantity: 100,
          unit: "kg",
          unitPrice: 5.8,
          total: 580,
          packagingType: null,
          unitsPerPackage: null,
        }],
        total: 580,
      }],
    };

    const result = adjustmentsCreateSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("accepts undefined for optional brand/reason fields", () => {
    const payload = {
      quotationId: 960001,
      adjustments: [{
        quotationItemId: 1020001,
        productName: "ALMONDEGAS BOVINA",
        quantity: 100,
        unit: "kg",
        recommendedSupplierId: 14,
        recommendedSupplierName: "Oliveira Distribuidora",
        recommendedUnitPrice: 5.5,
        recommendedTotal: 550,
        recommendedBrand: undefined,
        recommendedReason: undefined,
        selectedSupplierId: 17,
        selectedSupplierName: "Martins Atacado",
        selectedUnitPrice: 5.8,
        selectedTotal: 580,
        selectedBrand: undefined,
        impactValue: 30,
        impactPct: 5.45,
        justificationCategory: "Ajuste manual",
        justificationText: "Fornecedor preferencial com melhor prazo de entrega",
      }],
      suppliers: [{
        supplierId: 17,
        items: [{
          productName: "ALMONDEGAS BOVINA",
          quantity: 100,
          unit: "kg",
          unitPrice: 5.8,
          total: 580,
          packagingType: undefined,
          unitsPerPackage: undefined,
        }],
        total: 580,
      }],
    };

    const result = adjustmentsCreateSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("rejects NaN for numeric fields", () => {
    const payload = {
      quotationId: 960001,
      adjustments: [{
        quotationItemId: 1020001,
        productName: "ALMONDEGAS BOVINA",
        quantity: NaN, // This should fail
        unit: "kg",
        recommendedSupplierId: 14,
        recommendedSupplierName: "Oliveira Distribuidora",
        recommendedUnitPrice: 5.5,
        recommendedTotal: 550,
        selectedSupplierId: 17,
        selectedSupplierName: "Martins Atacado",
        selectedUnitPrice: 5.8,
        selectedTotal: 580,
        impactValue: 30,
        impactPct: 5.45,
        justificationCategory: "Ajuste manual",
        justificationText: "Fornecedor preferencial com melhor prazo de entrega",
      }],
      suppliers: [{
        supplierId: 17,
        items: [{
          productName: "ALMONDEGAS BOVINA",
          quantity: 100,
          unit: "kg",
          unitPrice: 5.8,
          total: 580,
          packagingType: null,
          unitsPerPackage: null,
        }],
        total: 580,
      }],
    };

    const result = adjustmentsCreateSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("accepts valid string values for optional brand fields", () => {
    const payload = {
      quotationId: 960001,
      adjustments: [{
        quotationItemId: 1020001,
        productName: "ALMONDEGAS BOVINA",
        quantity: 100,
        unit: "kg",
        recommendedSupplierId: 14,
        recommendedSupplierName: "Oliveira Distribuidora",
        recommendedUnitPrice: 5.5,
        recommendedTotal: 550,
        recommendedBrand: "Seara",
        recommendedReason: "Melhor preço",
        cheapestSupplierId: 14,
        cheapestSupplierName: "Oliveira Distribuidora",
        cheapestUnitPrice: 5.5,
        selectedSupplierId: 17,
        selectedSupplierName: "Martins Atacado",
        selectedUnitPrice: 5.8,
        selectedTotal: 580,
        selectedBrand: "Perdigão",
        impactValue: 30,
        impactPct: 5.45,
        justificationCategory: "Ajuste manual",
        justificationText: "Fornecedor preferencial com melhor prazo de entrega",
      }],
      suppliers: [{
        supplierId: 17,
        items: [{
          productName: "ALMONDEGAS BOVINA",
          quantity: 100,
          unit: "kg",
          unitPrice: 5.8,
          total: 580,
          packagingType: "caixa",
          unitsPerPackage: 12,
        }],
        total: 580,
      }],
    };

    const result = adjustmentsCreateSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("rejects justificationText shorter than 10 characters", () => {
    const payload = {
      quotationId: 960001,
      adjustments: [{
        quotationItemId: 1020001,
        productName: "ALMONDEGAS BOVINA",
        quantity: 100,
        unit: "kg",
        recommendedSupplierId: 14,
        recommendedSupplierName: "Oliveira Distribuidora",
        recommendedUnitPrice: 5.5,
        recommendedTotal: 550,
        selectedSupplierId: 17,
        selectedSupplierName: "Martins Atacado",
        selectedUnitPrice: 5.8,
        selectedTotal: 580,
        impactValue: 30,
        impactPct: 5.45,
        justificationCategory: "Ajuste manual",
        justificationText: "Curto", // Less than 10 chars
      }],
      suppliers: [{
        supplierId: 17,
        items: [{
          productName: "ALMONDEGAS BOVINA",
          quantity: 100,
          unit: "kg",
          unitPrice: 5.8,
          total: 580,
        }],
        total: 580,
      }],
    };

    const result = adjustmentsCreateSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});
