/**
 * Import historical payments from CSV into the database.
 * Run: node import_historical.mjs
 */
import { createConnection } from 'mysql2/promise';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

// Parse the DATABASE_URL
const url = new URL(DATABASE_URL);
const connection = await createConnection({
  host: url.hostname,
  port: parseInt(url.port || '3306'),
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: false }
});

// Read and parse CSV
const csvContent = readFileSync('/home/ubuntu/qualicompras/historical_payments.csv', 'utf-8');
const records = parse(csvContent, { columns: true, skip_empty_lines: true });

console.log(`Parsed ${records.length} records from CSV`);

const BATCH_ID = 'fortes_cap_mai2026_v1';

// Insert in batches of 50
const BATCH_SIZE = 50;
let inserted = 0;

for (let i = 0; i < records.length; i += BATCH_SIZE) {
  const batch = records.slice(i, i + BATCH_SIZE);
  
  const values = batch.map(r => {
    // Use trade_name as supplier if it's better quality
    const supplier = (r.trade_name && r.trade_name.length > 3) ? r.trade_name : r.supplier;
    return [
      supplier,
      r.trade_name || null,
      r.unit || 'Não identificada',
      parseFloat(r.value),
      r.date,
      r.category || 'outros',
      'fortes_cap',
      BATCH_ID
    ];
  });

  const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
  const flatValues = values.flat();

  await connection.execute(
    `INSERT INTO historical_payments (supplierName, tradeName, unitName, value, entryDate, category, source, importBatch) VALUES ${placeholders}`,
    flatValues
  );
  
  inserted += batch.length;
  if (inserted % 200 === 0) console.log(`  Inserted ${inserted}/${records.length}...`);
}

console.log(`\nDone! Inserted ${inserted} records with batch ID: ${BATCH_ID}`);

// Quick verification
const [rows] = await connection.execute('SELECT COUNT(*) as cnt, SUM(value) as total FROM historical_payments WHERE importBatch = ?', [BATCH_ID]);
console.log(`Verification: ${rows[0].cnt} records, total R$ ${parseFloat(rows[0].total).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);

// Category breakdown
const [cats] = await connection.execute('SELECT category, COUNT(*) as cnt, SUM(value) as total FROM historical_payments WHERE importBatch = ? GROUP BY category ORDER BY total DESC', [BATCH_ID]);
console.log('\nBy Category:');
for (const cat of cats) {
  console.log(`  ${cat.category}: ${cat.cnt} records, R$ ${parseFloat(cat.total).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
}

// Unit breakdown
const [units] = await connection.execute('SELECT unitName, COUNT(*) as cnt, SUM(value) as total FROM historical_payments WHERE importBatch = ? GROUP BY unitName ORDER BY total DESC', [BATCH_ID]);
console.log('\nBy Unit:');
for (const u of units) {
  console.log(`  ${u.unitName}: ${u.cnt} records, R$ ${parseFloat(u.total).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
}

await connection.end();
