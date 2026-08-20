import { getDb } from './server/db.ts';
import { users } from './drizzle/schema.ts';

async function main() {
  const db = await getDb();
  const all = await db.select().from(users);
  console.log('All users:');
  all.forEach(u => console.log(u.id, '|', u.email, '|', u.name, '|', u.role));
}
main().catch(console.error).finally(() => process.exit(0));
