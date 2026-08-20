import { describe, it, expect } from "vitest";
import { parseFortesItems } from "./_core/index";

describe("parseFortesItems - Deduplication", () => {
  it("should parse items correctly from Fortes PDF text", () => {
    const text = `
      0001234  ARROZ - 1KG  KG  1002
      0001235  FEIJAO CARIOCA - 1KG  KG  500
      0001236  OLEO - 900ML  UN  144
    `;
    const items = parseFortesItems(text);
    expect(items).toHaveLength(3);
    expect(items[0].description).toBe("ARROZ - 1KG");
    expect(items[0].quantity).toBe(1002);
    expect(items[0].unit).toBe("KG");
    expect(items[1].description).toBe("FEIJAO CARIOCA - 1KG");
    expect(items[2].description).toBe("OLEO - 900ML");
  });

  it("should deduplicate items by description - keep first occurrence", () => {
    const text = `
      0001234  ARROZ - 1KG  KG  1002
      0001235  FEIJAO CARIOCA - 1KG  KG  500
      0001236  OLEO - 900ML  UN  144
      0001234  ARROZ - 1KG  KG  1002
      0001235  FEIJAO CARIOCA - 1KG  KG  500
      0001236  OLEO - 900ML  UN  144
    `;
    const items = parseFortesItems(text);
    expect(items).toHaveLength(3);
    expect(items[0].description).toBe("ARROZ - 1KG");
    expect(items[1].description).toBe("FEIJAO CARIOCA - 1KG");
    expect(items[2].description).toBe("OLEO - 900ML");
  });

  it("should deduplicate even with 3x repetitions (real PDF behavior)", () => {
    const text = `
      0001234  ACHOCOLATADO - 700G  PCT  59
      0001235  ACUCAR - 1KG  KG  122
      0001236  ARROZ - 1KG  KG  1002
      0001234  ACHOCOLATADO - 700G  PCT  59
      0001235  ACUCAR - 1KG  KG  122
      0001236  ARROZ - 1KG  KG  1002
      0001234  ACHOCOLATADO - 700G  PCT  59
      0001235  ACUCAR - 1KG  KG  122
      0001236  ARROZ - 1KG  KG  1002
    `;
    const items = parseFortesItems(text);
    expect(items).toHaveLength(3);
    expect(items[0].description).toBe("ACHOCOLATADO - 700G");
    expect(items[0].quantity).toBe(59);
    expect(items[1].description).toBe("ACUCAR - 1KG");
    expect(items[1].quantity).toBe(122);
    expect(items[2].description).toBe("ARROZ - 1KG");
    expect(items[2].quantity).toBe(1002);
  });

  it("should keep the highest quantity when duplicates have different quantities", () => {
    const text = `
      0001234  ARROZ - 1KG  KG  500
      0001235  FEIJAO CARIOCA - 1KG  KG  300
      0001234  ARROZ - 1KG  KG  1002
      0001235  FEIJAO CARIOCA - 1KG  KG  200
    `;
    const items = parseFortesItems(text);
    expect(items).toHaveLength(2);
    expect(items[0].description).toBe("ARROZ - 1KG");
    expect(items[0].quantity).toBe(1002); // Should keep the higher quantity
    expect(items[1].description).toBe("FEIJAO CARIOCA - 1KG");
    expect(items[1].quantity).toBe(300); // First was higher, keep it
  });

  it("should be case-insensitive for deduplication", () => {
    const text = `
      0001234  ARROZ - 1KG  KG  1002
      0001234  Arroz - 1KG  KG  500
    `;
    const items = parseFortesItems(text);
    // Both should match as same product (case-insensitive)
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(1002);
  });

  it("should handle empty text", () => {
    const items = parseFortesItems("");
    expect(items).toHaveLength(0);
  });

  it("should handle text with no matching items", () => {
    const text = "This is just some random text without any product lines";
    const items = parseFortesItems(text);
    expect(items).toHaveLength(0);
  });

  it("should parse various unit types correctly", () => {
    const text = `
      0001234  SAL REFINADO  KG  64
      0001235  OLEO COMPOSTO - 5LT  LT  20
      0001236  ACHOCOLATADO - 700G  PCT  59
      0001237  CREME DE LEITE - 200G  UN  100
      0001238  FARINHA DE TRIGO  FD  30
    `;
    const items = parseFortesItems(text);
    expect(items).toHaveLength(5);
    expect(items[0].unit).toBe("KG");
    expect(items[1].unit).toBe("LT");
    expect(items[2].unit).toBe("PCT");
    expect(items[3].unit).toBe("UN");
    expect(items[4].unit).toBe("FD");
  });
});
