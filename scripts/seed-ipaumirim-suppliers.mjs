/**
 * Seed Ipaumirim-CE suppliers from the spreadsheet data
 * This script:
 * 1. Removes existing supplier_units links for unit 3 (IPAUMIRIM)
 * 2. Removes existing suppliers that were only linked to IPAUMIRIM
 * 3. Inserts fresh suppliers with correct contacts from the spreadsheet
 * 4. Links them to unit 3
 */

import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('DATABASE_URL not set in environment');
  process.exit(1);
}

const connection = await mysql.createConnection(dbUrl);

const UNIT_ID = 3; // IPAUMIRIM

// Suppliers data from the spreadsheet
const suppliersData = [
  {
    companyName: 'Supermercado Oliveira',
    contactName: 'Alcir',
    whatsapp: '5588999970065',
    phone: '(88) 9 9997-0065',
    categories: JSON.stringify(['Cereais', 'Limpeza e Descartáveis']),
    city: 'Ipaumirim',
    state: 'CE',
  },
  {
    companyName: 'Supermercado Bom Preço',
    contactName: 'Cida',
    whatsapp: '5583999904709',
    phone: '(83) 9 9990-4709',
    categories: JSON.stringify(['Cereais', 'Limpeza e Descartáveis']),
    city: 'Ipaumirim',
    state: 'CE',
  },
  {
    companyName: 'DSG Distribuidora',
    tradeName: 'Vó Ita Frios',
    contactName: 'Hugo Felipe',
    whatsapp: '5583993752924',
    phone: '(83) 9 9375-2924',
    categories: JSON.stringify(['Cereais', 'Proteína']),
    city: 'Sousa',
    state: 'PB',
  },
  {
    companyName: 'NG Distribuidora',
    contactName: null,
    whatsapp: null,
    phone: null,
    categories: JSON.stringify(['Proteína']),
    city: 'João Pessoa',
    state: 'PB',
    notes: 'SEM CONTATO WHATSAPP - precisa obter',
  },
  {
    companyName: 'Frigorífico Santa Luzia',
    contactName: 'Rafael',
    whatsapp: '5588996486058',
    phone: '(88) 9 9648-6058',
    categories: JSON.stringify(['Proteína']),
    city: 'Ipaumirim',
    state: 'CE',
  },
  {
    companyName: 'Cajá Ovos',
    contactName: null,
    whatsapp: null,
    phone: null,
    categories: JSON.stringify(['Proteína']),
    city: 'Ipaumirim',
    state: 'CE',
    notes: 'SEM CONTATO WHATSAPP - precisa obter',
  },
  {
    companyName: 'Roniclei Martins',
    contactName: 'Roni',
    whatsapp: '5583991726104',
    phone: '(83) 9 9172-6104',
    categories: JSON.stringify(['Limpeza e Descartáveis']),
    city: 'Ipaumirim',
    state: 'CE',
  },
  {
    companyName: 'Mais Embalagens',
    contactName: 'Naldo',
    whatsapp: '5583993551995',
    phone: '(83) 9 9355-1995',
    categories: JSON.stringify(['Limpeza e Descartáveis']),
    city: 'Ipaumirim',
    state: 'CE',
  },
  {
    companyName: 'Tarcio Frutas',
    contactName: null,
    whatsapp: null,
    phone: null,
    categories: JSON.stringify(['Hortifruti']),
    city: 'Ipaumirim',
    state: 'CE',
    notes: 'SEM CONTATO WHATSAPP - precisa obter',
  },
  {
    companyName: 'Hortifruti Pai Eterno',
    contactName: 'Bruno',
    whatsapp: '5583999346373',
    phone: '(83) 9 9934-6373',
    categories: JSON.stringify(['Hortifruti']),
    city: 'Cajazeiras',
    state: 'PB',
  },
  {
    companyName: 'Damião Pereira Nunes',
    contactName: 'Damião',
    whatsapp: '5583991623544',
    phone: '(83) 9 9162-3544',
    categories: JSON.stringify(['Hortifruti']),
    city: 'Ipaumirim',
    state: 'CE',
  },
  {
    companyName: 'José Luiz Moreira Gomes',
    contactName: 'José Luiz',
    whatsapp: '5583996413688',
    phone: '(83) 9 9641-3688',
    categories: JSON.stringify(['Pão']),
    city: 'Ipaumirim',
    state: 'CE',
  },
  {
    companyName: 'Ultragaz',
    contactName: 'Ultragaz',
    whatsapp: null,
    phone: '0800 701 0123',
    categories: JSON.stringify(['Gás']),
    city: 'Ipaumirim',
    state: 'CE',
    notes: 'Central 0800 - sem WhatsApp direto',
  },
];

try {
  console.log('=== Seed Fornecedores Ipaumirim-CE ===\n');

  // 1. Remove existing links for unit 3
  console.log('1. Removendo vínculos antigos da unidade IPAUMIRIM...');
  await connection.execute('DELETE FROM supplier_units WHERE unitId = ?', [UNIT_ID]);
  console.log('   Vínculos removidos.\n');

  // 2. Remove existing suppliers that were seeded before (IDs 30001-30009)
  console.log('2. Removendo fornecedores antigos (IDs 30001-30009)...');
  await connection.execute('DELETE FROM suppliers WHERE id BETWEEN 30001 AND 30009');
  console.log('   Fornecedores antigos removidos.\n');

  // 3. Insert new suppliers
  console.log('3. Inserindo fornecedores atualizados...\n');
  
  const insertedIds = [];
  
  for (const s of suppliersData) {
    const [result] = await connection.execute(
      `INSERT INTO suppliers (companyName, tradeName, contactName, phone, whatsapp, state, city, categories, notes, active, reliabilityScore)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'yellow')`,
      [
        s.companyName,
        s.tradeName || null,
        s.contactName,
        s.phone,
        s.whatsapp,
        s.state,
        s.city,
        s.categories,
        s.notes || null,
      ]
    );
    
    const insertId = result.insertId;
    insertedIds.push(insertId);
    
    const status = s.whatsapp ? '✅' : '⚠️  SEM WHATSAPP';
    console.log(`   ${status} ${s.companyName} (ID: ${insertId}) - ${s.contactName || 'sem contato'} - ${s.phone || 'sem telefone'}`);
  }

  // 4. Link all to unit 3
  console.log('\n4. Vinculando fornecedores à unidade IPAUMIRIM (ID: 3)...');
  
  for (const supplierId of insertedIds) {
    await connection.execute(
      'INSERT INTO supplier_units (supplierId, unitId, active) VALUES (?, ?, 1)',
      [supplierId, UNIT_ID]
    );
  }
  
  console.log(`   ${insertedIds.length} fornecedores vinculados.\n`);

  // Summary
  const withWhatsapp = suppliersData.filter(s => s.whatsapp).length;
  const withoutWhatsapp = suppliersData.filter(s => !s.whatsapp);
  
  console.log('=== RESUMO ===');
  console.log(`Total cadastrados: ${suppliersData.length}`);
  console.log(`Com WhatsApp: ${withWhatsapp}`);
  console.log(`Sem WhatsApp: ${withoutWhatsapp.length}`);
  
  if (withoutWhatsapp.length > 0) {
    console.log('\n⚠️  FORNECEDORES SEM WHATSAPP (não receberão cotação automática):');
    for (const s of withoutWhatsapp) {
      console.log(`   - ${s.companyName}`);
    }
  }

  console.log('\n✅ Seed concluído com sucesso!');
} catch (error) {
  console.error('Erro:', error);
  process.exit(1);
} finally {
  await connection.end();
}
