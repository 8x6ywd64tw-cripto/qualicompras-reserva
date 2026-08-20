/**
 * Monthly Report Generator
 * Generates a consolidated PDF with:
 * - Executive summary (total purchased, savings, order count)
 * - Price evolution by category
 * - Supplier ranking by performance
 * - Top savings and price increases
 */
import { getDb } from "./db";
import { eq, gte, lte, and, sql } from "drizzle-orm";
import {
  purchaseOrders,
  purchaseOrderItems,
  suppliers,
  units,
  quotations,
  deliveryRatings,
  type PurchaseOrder,
  type PurchaseOrderItem,
} from "../drizzle/schema";

export interface MonthlyReportData {
  period: { month: number; year: number; label: string };
  summary: {
    totalPurchased: number;
    totalOrders: number;
    totalItems: number;
    totalSuppliers: number;
    totalUnits: number;
    avgOrderValue: number;
  };
  savings: {
    totalSavings: number;
    savingsPercent: number;
  };
  categoryBreakdown: Array<{
    category: string;
    totalValue: number;
    orderCount: number;
    avgPrice: number;
    percentOfTotal: number;
  }>;
  supplierRanking: Array<{
    supplierName: string;
    totalValue: number;
    orderCount: number;
    avgRating: number | null;
    onTimeDelivery: number | null;
    percentOfTotal: number;
  }>;
  priceMovements: Array<{
    productName: string;
    previousPrice: number;
    currentPrice: number;
    variation: number;
    variationPercent: number;
    supplier: string;
    direction: "up" | "down";
  }>;
  unitBreakdown: Array<{
    unitName: string;
    state: string;
    totalValue: number;
    orderCount: number;
    percentOfTotal: number;
  }>;
}

export async function generateMonthlyReportData(
  month: number,
  year: number
): Promise<MonthlyReportData> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Calculate date range for the month
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const monthLabel = startDate.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  // 1. Get all delivered/sent orders in the period
  const orders: PurchaseOrder[] = await db
    .select()
    .from(purchaseOrders)
    .where(
      and(
        gte(purchaseOrders.createdAt, startDate),
        lte(purchaseOrders.createdAt, endDate),
        sql`${purchaseOrders.status} IN ('delivered', 'sent', 'approved')`
      )
    );

  if (orders.length === 0) {
    return {
      period: { month, year, label: monthLabel },
      summary: {
        totalPurchased: 0,
        totalOrders: 0,
        totalItems: 0,
        totalSuppliers: 0,
        totalUnits: 0,
        avgOrderValue: 0,
      },
      savings: { totalSavings: 0, savingsPercent: 0 },
      categoryBreakdown: [],
      supplierRanking: [],
      priceMovements: [],
      unitBreakdown: [],
    };
  }

  const orderIds = orders.map((o) => o.id);
  const totalPurchased = orders.reduce(
    (sum: number, o) => sum + parseFloat(o.totalValue),
    0
  );

  // 2. Get all items for these orders
  const items: PurchaseOrderItem[] = await db
    .select()
    .from(purchaseOrderItems)
    .where(sql`${purchaseOrderItems.orderId} IN (${sql.join(orderIds.map((id: number) => sql`${id}`), sql`, `)})`);

  // 3. Get unique suppliers and units
  const supplierIds = Array.from(new Set(orders.map((o) => o.supplierId)));
  const unitIds = Array.from(new Set(orders.filter((o) => o.unitId).map((o) => o.unitId!)));

  const suppliersList = supplierIds.length > 0
    ? await db.select().from(suppliers).where(sql`${suppliers.id} IN (${sql.join(supplierIds.map((id: number) => sql`${id}`), sql`, `)})`)
    : [];

  const unitsList = unitIds.length > 0
    ? await db.select().from(units).where(sql`${units.id} IN (${sql.join(unitIds.map((id: number) => sql`${id}`), sql`, `)})`)
    : [];

  // 4. Supplier ranking with ratings
  const supplierRanking = suppliersList.map((s) => {
    const supplierOrders = orders.filter((o) => o.supplierId === s.id);
    const supplierTotal = supplierOrders.reduce(
      (sum: number, o) => sum + parseFloat(o.totalValue),
      0
    );
    return {
      supplierName: s.tradeName || s.companyName,
      totalValue: supplierTotal,
      orderCount: supplierOrders.length,
      avgRating: null as number | null,
      onTimeDelivery: null as number | null,
      percentOfTotal: totalPurchased > 0 ? (supplierTotal / totalPurchased) * 100 : 0,
    };
  }).sort((a, b) => b.totalValue - a.totalValue);

  // Get ratings for these suppliers
  const ratings = supplierIds.length > 0
    ? await db.select().from(deliveryRatings).where(sql`${deliveryRatings.supplierId} IN (${sql.join(supplierIds.map((id: number) => sql`${id}`), sql`, `)})`)
    : [];

  for (const sr of supplierRanking) {
    const supplierObj = suppliersList.find(
      (s) => (s.tradeName || s.companyName) === sr.supplierName
    );
    if (supplierObj) {
      const supplierRatings = ratings.filter(
        (r) => r.supplierId === supplierObj.id
      );
      if (supplierRatings.length > 0) {
        sr.avgRating =
          supplierRatings.reduce(
            (sum: number, r) => sum + parseFloat(String(r.overallScore)),
            0
          ) / supplierRatings.length;
        sr.onTimeDelivery =
          (supplierRatings.filter((r) => r.punctuality >= 4).length /
            supplierRatings.length) *
          100;
      }
    }
  }

  // 5. Category breakdown (from quotation title)
  const quotationIds = Array.from(new Set(orders.filter((o) => o.quotationId).map((o) => o.quotationId!)));
  const quotationsList = quotationIds.length > 0
    ? await db.select().from(quotations).where(sql`${quotations.id} IN (${sql.join(quotationIds.map((id: number) => sql`${id}`), sql`, `)})`)
    : [];

  const categoryMap = new Map<string, { totalValue: number; orderCount: number }>();
  for (const order of orders) {
    const quotation = quotationsList.find((q) => q.id === order.quotationId);
    let category = "Outros";
    if (quotation?.title) {
      const match = quotation.title.match(/\((.*?)\)/);
      if (match) category = match[1];
      else {
        const cats = ["Cereais", "Proteína", "Hortifruti", "Limpeza", "Gás", "Pão", "Descartáveis"];
        for (const c of cats) {
          if (quotation.title.toLowerCase().includes(c.toLowerCase())) {
            category = c;
            break;
          }
        }
      }
    }
    const existing = categoryMap.get(category) || { totalValue: 0, orderCount: 0 };
    existing.totalValue += parseFloat(order.totalValue);
    existing.orderCount += 1;
    categoryMap.set(category, existing);
  }

  const categoryBreakdown = Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      totalValue: data.totalValue,
      orderCount: data.orderCount,
      avgPrice: data.totalValue / data.orderCount,
      percentOfTotal: totalPurchased > 0 ? (data.totalValue / totalPurchased) * 100 : 0,
    }))
    .sort((a, b) => b.totalValue - a.totalValue);

  // 6. Unit breakdown
  const unitBreakdown = unitsList.map((u) => {
    const unitOrders = orders.filter((o) => o.unitId === u.id);
    const unitTotal = unitOrders.reduce(
      (sum: number, o) => sum + parseFloat(o.totalValue),
      0
    );
    return {
      unitName: u.name,
      state: u.state,
      totalValue: unitTotal,
      orderCount: unitOrders.length,
      percentOfTotal: totalPurchased > 0 ? (unitTotal / totalPurchased) * 100 : 0,
    };
  }).sort((a, b) => b.totalValue - a.totalValue);

  // 7. Price movements - compare current month items vs previous month
  const prevStartDate = new Date(year, month - 2, 1);
  const prevEndDate = new Date(year, month - 1, 0, 23, 59, 59);

  const prevOrders: PurchaseOrder[] = await db
    .select()
    .from(purchaseOrders)
    .where(
      and(
        gte(purchaseOrders.createdAt, prevStartDate),
        lte(purchaseOrders.createdAt, prevEndDate),
        sql`${purchaseOrders.status} IN ('delivered', 'sent', 'approved')`
      )
    );

  const priceMovements: MonthlyReportData["priceMovements"] = [];

  if (prevOrders.length > 0) {
    const prevOrderIds = prevOrders.map((o) => o.id);
    const prevItems: PurchaseOrderItem[] = await db
      .select()
      .from(purchaseOrderItems)
      .where(sql`${purchaseOrderItems.orderId} IN (${sql.join(prevOrderIds.map((id: number) => sql`${id}`), sql`, `)})`);

    // Build price map for previous month
    const prevPriceMap = new Map<string, { avgPrice: number; count: number }>();
    for (const item of prevItems) {
      const key = item.productName.toLowerCase().trim();
      const existing = prevPriceMap.get(key) || { avgPrice: 0, count: 0 };
      existing.avgPrice =
        (existing.avgPrice * existing.count + parseFloat(item.unitPrice)) /
        (existing.count + 1);
      existing.count += 1;
      prevPriceMap.set(key, existing);
    }

    // Build current month price map
    const currPriceMap = new Map<string, { avgPrice: number; count: number; supplier: string }>();
    for (const item of items) {
      const key = item.productName.toLowerCase().trim();
      const order = orders.find((o) => o.id === item.orderId);
      const supplier = suppliersList.find((s) => s.id === order?.supplierId);
      const existing = currPriceMap.get(key) || { avgPrice: 0, count: 0, supplier: "" };
      existing.avgPrice =
        (existing.avgPrice * existing.count + parseFloat(item.unitPrice)) /
        (existing.count + 1);
      existing.count += 1;
      existing.supplier = supplier?.tradeName || supplier?.companyName || "N/A";
      currPriceMap.set(key, existing);
    }

    // Compare
    for (const [key, curr] of Array.from(currPriceMap.entries())) {
      const prev = prevPriceMap.get(key);
      if (prev && prev.avgPrice > 0) {
        const variation = curr.avgPrice - prev.avgPrice;
        const variationPercent = (variation / prev.avgPrice) * 100;
        if (Math.abs(variationPercent) >= 5) {
          priceMovements.push({
            productName: key.charAt(0).toUpperCase() + key.slice(1),
            previousPrice: prev.avgPrice,
            currentPrice: curr.avgPrice,
            variation,
            variationPercent,
            supplier: curr.supplier,
            direction: variation > 0 ? "up" : "down",
          });
        }
      }
    }

    priceMovements.sort(
      (a, b) => Math.abs(b.variationPercent) - Math.abs(a.variationPercent)
    );
  }

  // 8. Calculate savings
  const groupIds = Array.from(new Set(orders.filter((o) => o.purchaseGroupId).map((o) => o.purchaseGroupId!)));
  let totalSavings = 0;

  if (groupIds.length > 0) {
    for (const groupId of groupIds) {
      const groupOrders = orders.filter((o) => o.purchaseGroupId === groupId);
      const groupOrderIds = groupOrders.map((o) => o.id);
      const groupItems = items.filter((i) => groupOrderIds.includes(i.orderId));

      const actualTotal = groupItems.reduce(
        (sum: number, i) => sum + parseFloat(i.totalPrice),
        0
      );

      const productPrices = new Map<string, number[]>();
      for (const item of groupItems) {
        const key = item.productName.toLowerCase().trim();
        const prices = productPrices.get(key) || [];
        prices.push(parseFloat(item.unitPrice));
        productPrices.set(key, prices);
      }

      let worstTotal = 0;
      for (const item of groupItems) {
        const key = item.productName.toLowerCase().trim();
        const prices = productPrices.get(key) || [parseFloat(item.unitPrice)];
        const maxPrice = Math.max(...prices);
        worstTotal += maxPrice * parseFloat(String(item.quantity));
      }

      totalSavings += Math.max(0, worstTotal - actualTotal);
    }
  }

  const savingsPercent = totalPurchased > 0 ? (totalSavings / (totalPurchased + totalSavings)) * 100 : 0;

  return {
    period: { month, year, label: monthLabel },
    summary: {
      totalPurchased,
      totalOrders: orders.length,
      totalItems: items.length,
      totalSuppliers: supplierIds.length,
      totalUnits: unitIds.length,
      avgOrderValue: orders.length > 0 ? totalPurchased / orders.length : 0,
    },
    savings: { totalSavings, savingsPercent },
    categoryBreakdown,
    supplierRanking,
    priceMovements: priceMovements.slice(0, 20),
    unitBreakdown,
  };
}

/**
 * Generate PDF buffer from report data using PDFKit
 */
export async function generateMonthlyReportPDF(
  data: MonthlyReportData
): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: `Relatório Mensal de Compras - ${data.period.label}`,
        Author: "QualiCompras - Qualities Refeições",
        Subject: "Relatório Consolidado Mensal",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const navy = "#1e293b";
    const green = "#16a34a";
    const red = "#dc2626";
    const gray = "#64748b";
    const lightGray = "#f1f5f9";

    const pageWidth = doc.page.width - 100;

    // === COVER ===
    doc.rect(0, 0, doc.page.width, 200).fill(navy);
    doc
      .fontSize(28)
      .fillColor("#ffffff")
      .text("RELATÓRIO MENSAL DE COMPRAS", 50, 70, { align: "center" });
    doc
      .fontSize(16)
      .fillColor("#94a3b8")
      .text("Qualities Refeições — Grupo Comenda", 50, 110, { align: "center" });
    doc
      .fontSize(14)
      .fillColor("#e2e8f0")
      .text(data.period.label.toUpperCase(), 50, 145, { align: "center" });

    doc.fillColor(navy);
    doc.y = 230;

    // === EXECUTIVE SUMMARY ===
    doc.fontSize(18).fillColor(navy).text("Resumo Executivo", { underline: true });
    doc.moveDown(0.5);

    const summaryItems: [string, string][] = [
      ["Total Comprado", `R$ ${data.summary.totalPurchased.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`],
      ["Economia Gerada", `R$ ${data.savings.totalSavings.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (${data.savings.savingsPercent.toFixed(1)}%)`],
      ["Pedidos Realizados", `${data.summary.totalOrders}`],
      ["Itens Comprados", `${data.summary.totalItems}`],
      ["Fornecedores Ativos", `${data.summary.totalSuppliers}`],
      ["Unidades Atendidas", `${data.summary.totalUnits}`],
      ["Ticket Médio", `R$ ${data.summary.avgOrderValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`],
    ];

    for (const [label, value] of summaryItems) {
      doc.fontSize(11).fillColor(gray).text(label, { continued: true });
      doc.fillColor(navy).text(`  ${value}`);
    }

    // === CATEGORY BREAKDOWN ===
    if (data.categoryBreakdown.length > 0) {
      doc.moveDown(1.5);
      doc.fontSize(16).fillColor(navy).text("Distribuição por Categoria", { underline: true });
      doc.moveDown(0.5);

      const catColWidths = [150, 100, 80, 80, 80];
      let y = doc.y;
      doc.rect(50, y, pageWidth, 20).fill(navy);
      doc.fontSize(9).fillColor("#ffffff");
      doc.text("Categoria", 55, y + 5, { width: catColWidths[0] });
      doc.text("Valor Total", 55 + catColWidths[0], y + 5, { width: catColWidths[1], align: "right" });
      doc.text("Pedidos", 55 + catColWidths[0] + catColWidths[1], y + 5, { width: catColWidths[2], align: "right" });
      doc.text("Média", 55 + catColWidths[0] + catColWidths[1] + catColWidths[2], y + 5, { width: catColWidths[3], align: "right" });
      doc.text("% Total", 55 + catColWidths[0] + catColWidths[1] + catColWidths[2] + catColWidths[3], y + 5, { width: catColWidths[4], align: "right" });

      y += 22;
      for (let i = 0; i < data.categoryBreakdown.length; i++) {
        const cat = data.categoryBreakdown[i];
        if (i % 2 === 0) {
          doc.rect(50, y, pageWidth, 18).fill(lightGray);
        }
        doc.fontSize(9).fillColor(navy);
        doc.text(cat.category, 55, y + 4, { width: catColWidths[0] });
        doc.text(`R$ ${cat.totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 55 + catColWidths[0], y + 4, { width: catColWidths[1], align: "right" });
        doc.text(`${cat.orderCount}`, 55 + catColWidths[0] + catColWidths[1], y + 4, { width: catColWidths[2], align: "right" });
        doc.text(`R$ ${cat.avgPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 55 + catColWidths[0] + catColWidths[1] + catColWidths[2], y + 4, { width: catColWidths[3], align: "right" });
        doc.text(`${cat.percentOfTotal.toFixed(1)}%`, 55 + catColWidths[0] + catColWidths[1] + catColWidths[2] + catColWidths[3], y + 4, { width: catColWidths[4], align: "right" });
        y += 18;
      }
      doc.y = y + 5;
    }

    // === SUPPLIER RANKING ===
    if (data.supplierRanking.length > 0) {
      if (doc.y > 600) doc.addPage();
      doc.moveDown(1);
      doc.fontSize(16).fillColor(navy).text("Ranking de Fornecedores", { underline: true });
      doc.moveDown(0.5);

      const supColWidths = [160, 100, 60, 70, 80];
      let y = doc.y;
      doc.rect(50, y, pageWidth, 20).fill(navy);
      doc.fontSize(9).fillColor("#ffffff");
      doc.text("Fornecedor", 55, y + 5, { width: supColWidths[0] });
      doc.text("Valor Total", 55 + supColWidths[0], y + 5, { width: supColWidths[1], align: "right" });
      doc.text("Pedidos", 55 + supColWidths[0] + supColWidths[1], y + 5, { width: supColWidths[2], align: "right" });
      doc.text("Avaliação", 55 + supColWidths[0] + supColWidths[1] + supColWidths[2], y + 5, { width: supColWidths[3], align: "right" });
      doc.text("% Total", 55 + supColWidths[0] + supColWidths[1] + supColWidths[2] + supColWidths[3], y + 5, { width: supColWidths[4], align: "right" });

      y += 22;
      for (let i = 0; i < Math.min(data.supplierRanking.length, 15); i++) {
        const sup = data.supplierRanking[i];
        if (i % 2 === 0) {
          doc.rect(50, y, pageWidth, 18).fill(lightGray);
        }
        doc.fontSize(9).fillColor(navy);
        doc.text(sup.supplierName.substring(0, 30), 55, y + 4, { width: supColWidths[0] });
        doc.text(`R$ ${sup.totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 55 + supColWidths[0], y + 4, { width: supColWidths[1], align: "right" });
        doc.text(`${sup.orderCount}`, 55 + supColWidths[0] + supColWidths[1], y + 4, { width: supColWidths[2], align: "right" });
        doc.text(sup.avgRating ? `${sup.avgRating.toFixed(1)}/5` : "—", 55 + supColWidths[0] + supColWidths[1] + supColWidths[2], y + 4, { width: supColWidths[3], align: "right" });
        doc.text(`${sup.percentOfTotal.toFixed(1)}%`, 55 + supColWidths[0] + supColWidths[1] + supColWidths[2] + supColWidths[3], y + 4, { width: supColWidths[4], align: "right" });
        y += 18;
      }
      doc.y = y + 5;
    }

    // === UNIT BREAKDOWN ===
    if (data.unitBreakdown.length > 0) {
      if (doc.y > 600) doc.addPage();
      doc.moveDown(1);
      doc.fontSize(16).fillColor(navy).text("Distribuição por Unidade", { underline: true });
      doc.moveDown(0.5);

      for (const unit of data.unitBreakdown) {
        doc.fontSize(10).fillColor(navy).text(
          `${unit.unitName} (${unit.state}) — R$ ${unit.totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} • ${unit.orderCount} pedidos • ${unit.percentOfTotal.toFixed(1)}% do total`
        );
      }
    }

    // === PRICE MOVEMENTS ===
    if (data.priceMovements.length > 0) {
      if (doc.y > 550) doc.addPage();
      doc.moveDown(1.5);
      doc.fontSize(16).fillColor(navy).text("Movimentações de Preço (vs. mês anterior)", { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(8).fillColor(gray).text("Apenas variações acima de 5% são exibidas.");
      doc.moveDown(0.5);

      const drops = data.priceMovements.filter((p) => p.direction === "down").slice(0, 10);
      const increases = data.priceMovements.filter((p) => p.direction === "up").slice(0, 10);

      if (drops.length > 0) {
        doc.fontSize(12).fillColor(green).text("▼ Quedas de Preço (Economia)");
        doc.moveDown(0.3);
        for (const item of drops) {
          doc.fontSize(9).fillColor(navy).text(
            `${item.productName} — R$ ${item.previousPrice.toFixed(2)} → R$ ${item.currentPrice.toFixed(2)} (${item.variationPercent.toFixed(1)}%) • ${item.supplier}`
          );
        }
        doc.moveDown(0.5);
      }

      if (increases.length > 0) {
        doc.fontSize(12).fillColor(red).text("▲ Aumentos de Preço (Atenção)");
        doc.moveDown(0.3);
        for (const item of increases) {
          doc.fontSize(9).fillColor(navy).text(
            `${item.productName} — R$ ${item.previousPrice.toFixed(2)} → R$ ${item.currentPrice.toFixed(2)} (+${item.variationPercent.toFixed(1)}%) • ${item.supplier}`
          );
        }
      }
    }

    // === FOOTER ===
    doc.moveDown(2);
    doc.fontSize(8).fillColor(gray).text(
      `Relatório gerado automaticamente pelo QualiCompras em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`,
      { align: "center" }
    );
    doc.text("CONFIDENCIAL — Uso interno Qualities Refeições / Grupo Comenda", { align: "center" });

    doc.end();
  });
}

/**
 * Generate WhatsApp summary message from report data
 */
export function generateWhatsAppSummary(data: MonthlyReportData, pdfUrl: string): string {
  const lines = [
    `📊 *RELATÓRIO MENSAL DE COMPRAS*`,
    `📅 ${data.period.label.toUpperCase()}`,
    ``,
    `💰 *Total Comprado:* R$ ${data.summary.totalPurchased.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
    `✅ *Economia Gerada:* R$ ${data.savings.totalSavings.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (${data.savings.savingsPercent.toFixed(1)}%)`,
    `📦 *Pedidos:* ${data.summary.totalOrders}`,
    `🏢 *Fornecedores:* ${data.summary.totalSuppliers}`,
    ``,
  ];

  if (data.supplierRanking.length > 0) {
    lines.push(`🏆 *Top 3 Fornecedores:*`);
    for (const sup of data.supplierRanking.slice(0, 3)) {
      lines.push(`  ${sup.supplierName} — R$ ${sup.totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (${sup.percentOfTotal.toFixed(0)}%)`);
    }
    lines.push(``);
  }

  if (data.priceMovements.length > 0) {
    const drops = data.priceMovements.filter((p) => p.direction === "down").slice(0, 3);
    const increases = data.priceMovements.filter((p) => p.direction === "up").slice(0, 3);

    if (drops.length > 0) {
      lines.push(`📉 *Maiores Quedas:*`);
      for (const d of drops) {
        lines.push(`  ${d.productName}: ${d.variationPercent.toFixed(1)}%`);
      }
    }
    if (increases.length > 0) {
      lines.push(`📈 *Maiores Aumentos:*`);
      for (const inc of increases) {
        lines.push(`  ${inc.productName}: +${inc.variationPercent.toFixed(1)}%`);
      }
    }
    lines.push(``);
  }

  lines.push(`📄 *PDF Completo:* ${pdfUrl}`);
  lines.push(``);
  lines.push(`_QualiCompras — Qualities Refeições_`);

  return lines.join("\n");
}
