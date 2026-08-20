/**
 * Audit the existing Queiroz import for any internal entries (QUALITIES as supplier)
 * that should have been excluded but weren't.
 */
import { createConnection } from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1); }

const url = new URL(DATABASE_URL);
const conn = await createConnection({
  host: url.hostname,
  port: parseInt(url.port || '3306'),
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: false }
});

console.log("=== Auditoria: Importação Queiroz Galvão ===\n");

// Check 1: Any records with supplier name containing "QUALITIES" in price_history
const [phQualities] = await conn.execute(
  `SELECT id, productName, supplierName, unitPrice, quantity, recordedAt 
   FROM price_history 
   WHERE source = 'fortes_entradas_queiroz' 
   AND (supplierName LIKE '%QUALITIES%' OR supplierName LIKE '%qualities%')
   LIMIT 20`
);
console.log(`1. Registros em price_history com fornecedor "QUALITIES": ${phQualities.length}`);
if (phQualities.length > 0) {
  console.log("   ⚠️  ENCONTRADOS - devem ser removidos:");
  phQualities.forEach(r => console.log(`     ID ${r.id}: ${r.productName} | ${r.supplierName} | R$ ${r.unitPrice} | ${r.recordedAt}`));
}

// Check 2: Any records with supplier name containing "QUALITIES" in historical_payments
const [hpQualities] = await conn.execute(
  `SELECT id, supplierName, tradeName, unitName, value, entryDate 
   FROM historical_payments 
   WHERE importBatch = 'queiroz_entradas_abr_jul_2026' 
   AND (supplierName LIKE '%QUALITIES%' OR tradeName LIKE '%QUALITIES%' OR supplierName LIKE '%qualities%' OR tradeName LIKE '%qualities%')
   LIMIT 20`
);
console.log(`2. Registros em historical_payments com fornecedor "QUALITIES": ${hpQualities.length}`);
if (hpQualities.length > 0) {
  console.log("   ⚠️  ENCONTRADOS - devem ser removidos:");
  hpQualities.forEach(r => console.log(`     ID ${r.id}: ${r.supplierName} | ${r.tradeName} | R$ ${r.value} | ${r.entryDate}`));
}

// Check 3: List all unique supplier names in the import to verify none are internal
const [allSuppliers] = await conn.execute(
  `SELECT DISTINCT supplierName, COUNT(*) as cnt, SUM(CAST(unitPrice AS DECIMAL(14,2)) * CAST(quantity AS DECIMAL(12,3))) as total
   FROM price_history 
   WHERE source = 'fortes_entradas_queiroz'
   GROUP BY supplierName
   ORDER BY total DESC`
);
console.log(`\n3. Todos os fornecedores na importação Queiroz (${allSuppliers.length} únicos):`);
allSuppliers.forEach(s => {
  const flag = s.supplierName.toUpperCase().includes('QUALIT') ? ' ⚠️ SUSPEITO' : '';
  console.log(`   ${s.supplierName.substring(0, 45).padEnd(45)} | ${s.cnt} itens | R$ ${parseFloat(s.total).toFixed(2)}${flag}`);
});

// Check 4: Check if any supplier IDs map to internal/Qualities entities
const [suspectIds] = await conn.execute(
  `SELECT DISTINCT ph.supplierId, ph.supplierName, s.companyName, s.tradeName
   FROM price_history ph
   LEFT JOIN suppliers s ON ph.supplierId = s.id
   WHERE ph.source = 'fortes_entradas_queiroz'
   AND (s.companyName LIKE '%QUALITIES%' OR s.tradeName LIKE '%QUALITIES%' OR s.companyName LIKE '%qualities%')
   LIMIT 10`
);
console.log(`\n4. Fornecedores cujo cadastro no banco contém "QUALITIES": ${suspectIds.length}`);
if (suspectIds.length > 0) {
  suspectIds.forEach(r => console.log(`   ⚠️  supplierId ${r.supplierId}: ${r.supplierName} → DB: ${r.companyName} / ${r.tradeName}`));
}

// Summary
const totalIssues = phQualities.length + hpQualities.length + suspectIds.length;
if (totalIssues === 0) {
  console.log("\n✅ RESULTADO: Nenhuma entrada interna/sobra encontrada na importação Queiroz. Filtro funcionou corretamente.");
} else {
  console.log(`\n❌ RESULTADO: ${totalIssues} registros suspeitos encontrados. Necessário limpeza.`);
}

await conn.end();
