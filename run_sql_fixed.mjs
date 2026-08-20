import mysql from 'mysql2/promise';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('No DATABASE_URL');
    process.exit(1);
  }
  
  const conn = await mysql.createConnection(url);
  
  // All the SQL statements to execute - CORRECTED (no 'sector' column)
  const statements = [
    // Already done: Mix Mateus price updates for items 810001, 810009
    // Remaining Mix Mateus updates
    "UPDATE purchase_order_items SET unitPrice = 3.61, totalPrice = 72.20 WHERE id = 810005",
    "UPDATE purchase_order_items SET unitPrice = 1.06, totalPrice = 25.44 WHERE id = 810011",
    "INSERT INTO purchase_order_items (orderId, productName, quantity, unit, unitPrice, totalPrice, brand) VALUES (630001, 'AMIDO MILHO AMAFIL 1KG', 5, 'UN', 7.75, 38.75, 'AMAFIL')",
    "UPDATE purchase_orders SET totalValue = 16304.14, status = 'purchased' WHERE id = 630001",
    
    // GV Silveira Proteína (480001) - Delete old items
    "DELETE FROM purchase_order_items WHERE orderId = 480001",
    // Insert NF items
    "INSERT INTO purchase_order_items (orderId, productName, quantity, unit, unitPrice, totalPrice, brand) VALUES (480001, 'CARNE SUINO FREILLA CX+/-23KG', 800.65, 'KG', 13.99, 11201.09, 'FREILLA')",
    "INSERT INTO purchase_order_items (orderId, productName, quantity, unit, unitPrice, totalPrice, brand) VALUES (480001, 'COSTELA BOV CONG MINGA CX+/-25KG', 88.55, 'KG', 22.99, 2035.70, 'MINGA')",
    "INSERT INTO purchase_order_items (orderId, productName, quantity, unit, unitPrice, totalPrice, brand) VALUES (480001, 'COSTELA SUINA FRI DE PORCO FREILLA 20KG', 39.02, 'KG', 18.99, 741.01, 'FREILLA')",
    "INSERT INTO purchase_order_items (orderId, productName, quantity, unit, unitPrice, totalPrice, brand) VALUES (480001, 'COXA S/ COXA RAIA 20KG', 220, 'KG', 8.59, 1889.80, 'RAIA')",
    "INSERT INTO purchase_order_items (orderId, productName, quantity, unit, unitPrice, totalPrice, brand) VALUES (480001, 'COXAO MOLE CONG FRIBOI CX+/-29KG', 302.93, 'KG', 16.99, 5146.78, 'FRIBOI')",
    "INSERT INTO purchase_order_items (orderId, productName, quantity, unit, unitPrice, totalPrice, brand) VALUES (480001, 'HAMBURGUER REZENDE CX 2.016KG', 9, 'CX', 33.69, 303.21, 'REZENDE')",
    "INSERT INTO purchase_order_items (orderId, productName, quantity, unit, unitPrice, totalPrice, brand) VALUES (480001, 'QUEIJO RETATANG SERVANT BELA PC+/-4KG', 26.35, 'KG', 10.59, 279.05, 'SERVANT BELA')",
    "INSERT INTO purchase_order_items (orderId, productName, quantity, unit, unitPrice, totalPrice, brand) VALUES (480001, 'LOMBINHO BOV CONG MINERVA CX 25KG', 222.34, 'KG', 30.99, 6890.32, 'MINERVA')",
    "UPDATE purchase_orders SET totalValue = 28486.96, status = 'purchased' WHERE id = 480001",
    
    // DSB Super Baratão Proteína (480004) - Delete old items
    "DELETE FROM purchase_order_items WHERE orderId = 480004",
    "INSERT INTO purchase_order_items (orderId, productName, quantity, unit, unitPrice, totalPrice, brand) VALUES (480004, 'RABO SUINO SALG RESFR ECOFRIGO CX10KG', 20.0, 'UN', 19.99, 399.80, 'ECOFRIGO')",
    "INSERT INTO purchase_order_items (orderId, productName, quantity, unit, unitPrice, totalPrice, brand) VALUES (480004, 'LING CALABRESA CARRER 2,5KG/CX 20KG', 227.5, 'UN', 12.99, 2955.23, 'CARRER')",
    "INSERT INTO purchase_order_items (orderId, productName, quantity, unit, unitPrice, totalPrice, brand) VALUES (480004, 'SALSICHA AVIVAR PCT2,5/CX20KG', 147.5, 'UN', 5.99, 883.53, 'AVIVAR')",
    "UPDATE purchase_orders SET totalValue = 4238.56, status = 'purchased' WHERE id = 480004",
    
    // Bodegão Cereais (630002) - Delete old items
    "DELETE FROM purchase_order_items WHERE orderId = 630002",
    "INSERT INTO purchase_order_items (orderId, productName, quantity, unit, unitPrice, totalPrice, brand) VALUES (630002, 'FEIJAO DONA DE CARIOCA 10X1 KG', 39, 'FD', 80.00, 3120.00, 'DONA DE')",
    "INSERT INTO purchase_order_items (orderId, productName, quantity, unit, unitPrice, totalPrice, brand) VALUES (630002, 'MOLHO DE PIMENTA MARATA GOTA 24X150ML', 3, 'CX', 48.60, 145.80, 'MARATA')",
    "INSERT INTO purchase_order_items (orderId, productName, quantity, unit, unitPrice, totalPrice, brand) VALUES (630002, 'SAL MAR E SOL 30X1KG', 6, 'FD', 28.70, 172.20, 'MAR E SOL')",
    "INSERT INTO purchase_order_items (orderId, productName, quantity, unit, unitPrice, totalPrice, brand) VALUES (630002, 'FEIJAO DONA DE CORDA 10x1KG', 7, 'FD', 45.20, 316.40, 'DONA DE')",
    "UPDATE purchase_orders SET totalValue = 3754.40, status = 'purchased' WHERE id = 630002",
    
    // Solmar Cereais (630005) - Delete old items
    "DELETE FROM purchase_order_items WHERE orderId = 630005",
    "INSERT INTO purchase_order_items (orderId, productName, quantity, unit, unitPrice, totalPrice, brand) VALUES (630005, 'LASANHA SECA SEMOLA BRANDINI 500G', 60, 'UN', 8.55, 513.00, 'BRANDINI')",
    "INSERT INTO purchase_order_items (orderId, productName, quantity, unit, unitPrice, totalPrice, brand) VALUES (630005, 'CATCHUP TAMBAU 830G', 48, 'UN', 8.09, 388.32, 'TAMBAU')",
    "INSERT INTO purchase_order_items (orderId, productName, quantity, unit, unitPrice, totalPrice, brand) VALUES (630005, 'MOSTARDA AMARELA CEPERA 1,01L', 6, 'UN', 11.57, 69.42, 'CEPERA')",
    "INSERT INTO purchase_order_items (orderId, productName, quantity, unit, unitPrice, totalPrice, brand) VALUES (630005, 'ACHOCOLATADO PO ITALAC 700G', 60, 'UN', 12.30, 738.00, 'ITALAC')",
    "UPDATE purchase_orders SET totalValue = 1708.74, status = 'purchased' WHERE id = 630005",
    
    // GV Silveira Cereais (630004) - Delete old items
    "DELETE FROM purchase_order_items WHERE orderId = 630004",
    "INSERT INTO purchase_order_items (orderId, productName, quantity, unit, unitPrice, totalPrice, brand) VALUES (630004, 'CALDO DE GALINHA TECNUTRI (PCT) 1,01 KG', 10, 'PT', 8.79, 87.90, 'TECNUTRI')",
    "INSERT INTO purchase_order_items (orderId, productName, quantity, unit, unitPrice, totalPrice, brand) VALUES (630004, 'MACARRAO ESPAG FAVORITA 20X400G', 46, 'FD', 44.49, 2046.54, 'FAVORITA')",
    "INSERT INTO purchase_order_items (orderId, productName, quantity, unit, unitPrice, totalPrice, brand) VALUES (630004, 'OLEO DE SOJA MISTO ST IZABEL 12X900ML', 2, 'CX', 127.89, 255.78, 'ST IZABEL')",
    "INSERT INTO purchase_order_items (orderId, productName, quantity, unit, unitPrice, totalPrice, brand) VALUES (630004, 'FEIJAO CARIOCA FIBRA 10X1', 25, 'FD', 81.00, 2025.00, 'FIBRA')",
    "UPDATE purchase_orders SET totalValue = 4415.22, status = 'purchased' WHERE id = 630004",
    
    // G&T Limpeza (540002) - Delete old items
    "DELETE FROM purchase_order_items WHERE orderId = 540002",
    "INSERT INTO purchase_order_items (orderId, productName, quantity, unit, unitPrice, totalPrice, brand) VALUES (540002, 'ESPONJA', 12, 'UN', 2.20, 26.40, 'N/A')",
    "INSERT INTO purchase_order_items (orderId, productName, quantity, unit, unitPrice, totalPrice, brand) VALUES (540002, 'SACO LIXO 200L', 7, 'FD', 50.00, 350.00, 'N/A')",
    "INSERT INTO purchase_order_items (orderId, productName, quantity, unit, unitPrice, totalPrice, brand) VALUES (540002, 'SACO LIXO 250L', 2, 'FD', 50.00, 100.00, 'N/A')",
    "UPDATE purchase_orders SET totalValue = 476.40, status = 'purchased' WHERE id = 540002",
    
    // Bodegão Limpeza (540001) - Delete old items
    "DELETE FROM purchase_order_items WHERE orderId = 540001",
    "INSERT INTO purchase_order_items (orderId, productName, quantity, unit, unitPrice, totalPrice, brand) VALUES (540001, 'DET LIQ YPE 24X500ML NEUTRO', 9, 'CX', 49.40, 444.60, 'YPE')",
    "INSERT INTO purchase_order_items (orderId, productName, quantity, unit, unitPrice, totalPrice, brand) VALUES (540001, 'ESPONJA JEITOSA MULTIUSO 60UND', 1, 'CX', 29.30, 29.30, 'JEITOSA')",
    "UPDATE purchase_orders SET totalValue = 473.90, status = 'purchased' WHERE id = 540001",
    
    // Exact matches - just update status
    "UPDATE purchase_orders SET status = 'purchased' WHERE id = 630003",
    "UPDATE purchase_orders SET status = 'purchased' WHERE id = 630007",
    "UPDATE purchase_orders SET status = 'purchased' WHERE id = 570001",
    "UPDATE purchase_orders SET status = 'purchased' WHERE id = 570004",
    "UPDATE purchase_orders SET status = 'purchased' WHERE id = 540003",
    "UPDATE purchase_orders SET status = 'purchased' WHERE id = 630009",
    
    // Create MARTINS supplier (categories is JSON)
    `INSERT INTO suppliers (companyName, tradeName, phone, state, city, categories, active, createdAt, updatedAt) VALUES ('Martins Comércio de Pescados', 'Martins Pescados', '', 'CE', 'Maranguape', '["Proteína"]', 1, NOW(), NOW())`,
  ];
  
  let success = 0;
  let failed = 0;
  let martinsSupId = null;
  
  for (const stmt of statements) {
    try {
      const [result] = await conn.execute(stmt);
      success++;
      // Capture the supplier ID for MARTINS
      if (stmt.includes('Martins Comércio')) {
        martinsSupId = result.insertId;
        console.log(`  MARTINS supplier created with ID: ${martinsSupId}`);
      }
    } catch (err) {
      console.error(`FAILED: ${stmt.substring(0, 100)}`);
      console.error(`  Error: ${err.message}`);
      failed++;
    }
  }
  
  // Now create the MARTINS order using the captured ID
  if (martinsSupId) {
    try {
      const [orderResult] = await conn.execute(
        `INSERT INTO purchase_orders (code, supplierId, unitId, createdBy, approvedBy, totalValue, status, approvedAt, createdAt, updatedAt, notes) VALUES ('PED-MSNF-MARTINS-01', ?, 2, 1, 1, 1678.20, 'purchased', NOW(), NOW(), NOW(), 'Pedido criado a partir da NF - compra emergencial Júnior 30/07/2026')`,
        [martinsSupId]
      );
      const orderId = orderResult.insertId;
      console.log(`  MARTINS order created with ID: ${orderId}`);
      
      await conn.execute(
        `INSERT INTO purchase_order_items (orderId, productName, quantity, unit, unitPrice, totalPrice, brand) VALUES (?, 'FILÉ DE PANGA SEM GORDURA', 60, 'KG', 27.97, 1678.20, 'N/A')`,
        [orderId]
      );
      console.log(`  MARTINS order item created`);
      success += 2;
    } catch (err) {
      console.error(`FAILED creating MARTINS order: ${err.message}`);
      failed += 2;
    }
  }
  
  console.log(`\nDone: ${success} succeeded, ${failed} failed`);
  await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
