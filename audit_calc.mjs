import dotenv from 'dotenv';
dotenv.config();
import mysql from 'mysql2/promise';

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // Get quotation items (quantities)
  const [items] = await conn.execute(
    'SELECT qi.id, qi.productName, qi.quantity, qi.unit FROM quotation_items qi WHERE qi.quotationId = 450001 ORDER BY qi.productName'
  );
  
  // Get all proposal items with their unit prices and totals
  const [proposals] = await conn.execute(
    `SELECT p.id as proposalId, s.companyName, pi.quotationItemId, pi.unitPrice, pi.totalPrice, pi.brand
     FROM proposals p 
     JOIN proposal_items pi ON pi.proposalId = p.id 
     JOIN suppliers s ON s.id = p.supplierId
     WHERE p.quotationId = 450001
     ORDER BY s.companyName, pi.quotationItemId`
  );
  
  console.log("=" .repeat(100));
  console.log("AUDITORIA DE CÁLCULOS - COT-MRV31Y84 IPAUMIRIM (Cereais)");
  console.log("Verificação: preço_unitário × quantidade = total_item");
  console.log("=" .repeat(100));
  
  let erros = [];
  let ok_count = 0;
  
  for (const item of items) {
    const itemProposals = proposals.filter(p => p.quotationItemId === item.id);
    
    for (const prop of itemProposals) {
      const unitPrice = parseFloat(prop.unitPrice);
      const totalPrice = parseFloat(prop.totalPrice);
      const qty = parseFloat(item.quantity);
      const expectedTotal = Math.round(unitPrice * qty * 100) / 100;
      const diff = Math.abs(expectedTotal - totalPrice);
      
      if (diff > 0.02) { // tolerância de 2 centavos por arredondamento
        erros.push({
          produto: item.productName,
          fornecedor: prop.companyName,
          qtd: qty,
          unitPrice,
          totalNoBanco: totalPrice,
          totalEsperado: expectedTotal,
          diferenca: (totalPrice - expectedTotal).toFixed(2),
          marca: prop.brand
        });
      } else {
        ok_count++;
      }
    }
  }
  
  console.log(`\nTotal de itens verificados: ${ok_count + erros.length}`);
  console.log(`OK (cálculo correto): ${ok_count}`);
  console.log(`ERROS encontrados: ${erros.length}`);
  
  if (erros.length > 0) {
    console.log("\n" + "=".repeat(100));
    console.log("ERROS DE CÁLCULO DETECTADOS:");
    console.log("=".repeat(100));
    console.log(String("Produto").padEnd(35) + String("Fornecedor").padEnd(20) + "Qtd".padStart(6) + " x " + "Unit".padStart(10) + " = " + "Esperado".padStart(12) + " | " + "No Banco".padStart(12) + " | " + "Diff".padStart(10));
    console.log("-".repeat(100));
    
    for (const e of erros) {
      console.log(
        e.produto.substring(0, 34).padEnd(35) +
        e.fornecedor.substring(0, 19).padEnd(20) +
        String(e.qtd).padStart(6) + " x " +
        e.unitPrice.toFixed(2).padStart(10) + " = " +
        e.totalEsperado.toFixed(2).padStart(12) + " | " +
        e.totalNoBanco.toFixed(2).padStart(12) + " | " +
        e.diferenca.padStart(10)
      );
    }
  }
  
  // Also print full table for reference
  console.log("\n" + "=".repeat(100));
  console.log("TABELA COMPLETA - TODOS OS FORNECEDORES:");
  console.log("=".repeat(100));
  
  const suppliers = [...new Set(proposals.map(p => p.companyName))];
  
  for (const supplier of suppliers) {
    console.log(`\n--- ${supplier} ---`);
    console.log(String("Produto").padEnd(35) + "Qtd".padStart(6) + " x " + "Unit".padStart(10) + " = " + "Total DB".padStart(12) + " | " + "Calc".padStart(12) + " | " + "OK?".padStart(5) + " | Marca");
    
    const supplierItems = proposals.filter(p => p.companyName === supplier);
    let totalSupplier = 0;
    let totalCalc = 0;
    
    for (const prop of supplierItems) {
      const item = items.find(i => i.id === prop.quotationItemId);
      if (!item) continue;
      
      const unitPrice = parseFloat(prop.unitPrice);
      const totalPrice = parseFloat(prop.totalPrice);
      const qty = parseFloat(item.quantity);
      const expectedTotal = Math.round(unitPrice * qty * 100) / 100;
      const diff = Math.abs(expectedTotal - totalPrice);
      const isOk = diff <= 0.02;
      
      totalSupplier += totalPrice;
      totalCalc += expectedTotal;
      
      console.log(
        item.productName.substring(0, 34).padEnd(35) +
        String(qty).padStart(6) + " x " +
        unitPrice.toFixed(2).padStart(10) + " = " +
        totalPrice.toFixed(2).padStart(12) + " | " +
        expectedTotal.toFixed(2).padStart(12) + " | " +
        (isOk ? "  OK " : " ERRO") + " | " +
        (prop.brand || "SEM MARCA")
      );
    }
    console.log("-".repeat(100));
    console.log(String("TOTAL").padEnd(35) + String("").padStart(6) + "   " + String("").padStart(10) + "   " + totalSupplier.toFixed(2).padStart(12) + " | " + totalCalc.toFixed(2).padStart(12));
  }
  
  await conn.end();
}

main().catch(console.error);
