
import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('No DATABASE_URL');
    process.exit(1);
  }
  
  const conn = await mysql.createConnection(url);
  
  const statements = JSON.parse(readFileSync('/home/ubuntu/statements.json', 'utf8'));
  
  let success = 0;
  let failed = 0;
  
  for (const stmt of statements) {
    if (!stmt.trim()) continue;
    try {
      await conn.execute(stmt);
      success++;
      if (success % 10 === 0) console.log(`Progress: ${success}/${statements.length}`);
    } catch (err) {
      console.error(`FAILED: ${stmt.substring(0, 100)}...`);
      console.error(`  Error: ${err.message}`);
      failed++;
    }
  }
  
  console.log(`\nDone: ${success} succeeded, ${failed} failed out of ${statements.length} total`);
  await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
