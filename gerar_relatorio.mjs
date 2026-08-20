import dotenv from 'dotenv';
dotenv.config();
import mysql from 'mysql2/promise';
import { writeFileSync } from 'fs';

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // Get quotation items (quantities)
  const [items] = await conn.execute(
    'SELECT qi.id, qi.productName, qi.quantity, qi.unit FROM quotation_items qi WHERE qi.quotationId = 450001 ORDER BY qi.productName'
  );
  
  // Get all proposal items
  const [allProposals] = await conn.execute(
    `SELECT p.id as proposalId, p.supplierId, s.companyName, pi.quotationItemId, pi.unitPrice, pi.totalPrice, pi.brand
     FROM proposals p 
     JOIN proposal_items pi ON pi.proposalId = p.id 
     JOIN suppliers s ON s.id = p.supplierId
     WHERE p.quotationId = 450001
     ORDER BY s.companyName, pi.quotationItemId`
  );
  
  // Map supplier names
  const supplierMap = {
    'DSG Distribuidora': 'Vó Ita Frios (DSG)',
    'Indústria e Comércio de Doces Vale Verde': 'Vale Verde',
    'Mix Mateus': 'Mix Mateus',
    'Supermercado Oliveira': 'Sup. Oliveira'
  };
  
  const suppliers = [...new Set(allProposals.map(p => p.companyName))];
  
  // Build data structure
  let md = '';
  
  // ===== PART 1: TABELA COMPARATIVA COMPLETA =====
  md += '# COMPARATIVO COMPLETO - COT-MRV31Y84 IPAUMIRIM (Cereais)\n\n';
  md += '**Cotação:** COT-MRV31Y84 | **Coleta:** IPAUMIRIM (Cereais) | **Data:** 22/07/2026\n\n';
  md += '## Ranking de Fornecedores\n\n';
  
  // Calculate totals per supplier
  const supplierTotals = {};
  for (const s of suppliers) {
    const sItems = allProposals.filter(p => p.companyName === s);
    const total = sItems.reduce((sum, p) => sum + parseFloat(p.totalPrice), 0);
    supplierTotals[s] = total;
  }
  
  const sortedSuppliers = Object.entries(supplierTotals).sort((a, b) => a[1] - b[1]);
  md += '| Pos. | Fornecedor | Total | Pagamento |\n';
  md += '|---|---|---|---|\n';
  const pgto = { 'DSG Distribuidora': 'A prazo (8d)', 'Indústria e Comércio de Doces Vale Verde': '0 dias', 'Mix Mateus': '—', 'Supermercado Oliveira': 'À vista' };
  sortedSuppliers.forEach(([name, total], i) => {
    md += `| ${i+1}° | ${supplierMap[name] || name} | R$ ${total.toFixed(2).replace('.', ',')} | ${pgto[name] || '—'} |\n`;
  });
  
  md += '\n## Detalhamento por Item (Preço Unitário / Total Correto)\n\n';
  md += '| Produto | Qtd | Unid | Vale Verde | Mix Mateus | Sup. Oliveira | Vó Ita (DSG) |\n';
  md += '|---|---|---|---|---|---|---|\n';
  
  const supplierOrder = ['Indústria e Comércio de Doces Vale Verde', 'Mix Mateus', 'Supermercado Oliveira', 'DSG Distribuidora'];
  
  for (const item of items) {
    const qty = parseFloat(item.quantity);
    let row = `| ${item.productName} | ${qty} | ${item.unit} |`;
    
    for (const sName of supplierOrder) {
      const prop = allProposals.find(p => p.companyName === sName && p.quotationItemId === item.id);
      if (prop) {
        const unit = parseFloat(prop.unitPrice);
        const correctTotal = (unit * qty).toFixed(2);
        row += ` R$ ${unit.toFixed(2)} / R$ ${correctTotal} (${prop.brand || '—'}) |`;
      } else {
        row += ' — |';
      }
    }
    md += row + '\n';
  }
  
  // ===== PART 2: COMPRA OTIMIZADA =====
  md += '\n---\n\n';
  md += '# LISTA DE COMPRA OTIMIZADA\n\n';
  md += '**Critérios:**\n';
  md += '1. Vó Ita (DSG) tem preferência até 3% acima do menor preço (paga a prazo 8 dias)\n';
  md += '2. AÇÚCAR e ARROZ da Vó Ita desconsiderados (preço errado: total no campo unitário)\n';
  md += '3. Doces → Vale Verde (preço imbatível por unidade)\n';
  md += '4. Se só um fornecedor cotou → vai direto pra ele\n';
  md += '5. Entre os demais: menor preço leva\n\n';
  
  const VOITA_ERRADOS = ['ACUCAR - 1KG', 'ARROZ - 1KG'];
  const TOLERANCIA = 0.03;
  
  const compra = { 'Mix Mateus': [], 'Supermercado Oliveira': [], 'DSG Distribuidora': [], 'Indústria e Comércio de Doces Vale Verde': [] };
  const semFornecedor = [];
  
  for (const item of items) {
    const qty = parseFloat(item.quantity);
    if (qty === 0) continue;
    
    // Get all proposals for this item
    const itemProps = allProposals.filter(p => p.quotationItemId === item.id);
    
    // Build options
    let opcoes = [];
    for (const prop of itemProps) {
      const unit = parseFloat(prop.unitPrice);
      if (unit <= 0) continue;
      
      // Exclude Vó Ita errados
      if (prop.companyName === 'DSG Distribuidora' && VOITA_ERRADOS.includes(item.productName)) continue;
      
      opcoes.push({ supplier: prop.companyName, unit, brand: prop.brand || '—', total: Math.round(unit * qty * 100) / 100 });
    }
    
    if (opcoes.length === 0) {
      semFornecedor.push({ produto: item.productName, qtd: qty, unid: item.unit });
      continue;
    }
    
    if (opcoes.length === 1) {
      const o = opcoes[0];
      compra[o.supplier].push({ produto: item.productName, qtd: qty, unid: item.unit, unit: o.unit, total: o.total, marca: o.brand, motivo: 'único fornecedor' });
      continue;
    }
    
    // Multiple options - apply Vó Ita preference
    const menorPreco = Math.min(...opcoes.map(o => o.unit));
    const voitaOpcao = opcoes.find(o => o.supplier === 'DSG Distribuidora');
    
    if (voitaOpcao) {
      const limite = menorPreco * (1 + TOLERANCIA);
      if (voitaOpcao.unit <= limite) {
        compra['DSG Distribuidora'].push({ produto: item.productName, qtd: qty, unid: item.unit, unit: voitaOpcao.unit, total: voitaOpcao.total, marca: voitaOpcao.brand, motivo: voitaOpcao.unit <= menorPreco ? 'mais barata' : `dentro 3% (prazo)` });
        continue;
      }
    }
    
    // Get cheapest among non-Vó Ita (or all if Vó Ita didn't quote)
    const opcoesSemVoita = opcoes.filter(o => o.supplier !== 'DSG Distribuidora');
    const melhor = (opcoesSemVoita.length > 0 ? opcoesSemVoita : opcoes).sort((a, b) => a.unit - b.unit)[0];
    compra[melhor.supplier].push({ produto: item.productName, qtd: qty, unid: item.unit, unit: melhor.unit, total: melhor.total, marca: melhor.brand, motivo: 'menor preço' });
  }
  
  // Format purchase lists
  const supplierLabels = {
    'Mix Mateus': 'MIX MATEUS (Cajazeiras/PB)',
    'Supermercado Oliveira': 'SUPERMERCADO OLIVEIRA',
    'DSG Distribuidora': 'VÓ ITA FRIOS / DSG (A PRAZO 8d)',
    'Indústria e Comércio de Doces Vale Verde': 'VALE VERDE (Doces)'
  };
  
  let totalGeral = 0;
  
  for (const [sName, label] of Object.entries(supplierLabels)) {
    const lista = compra[sName];
    if (!lista || lista.length === 0) continue;
    
    const totalForn = lista.reduce((s, i) => s + i.total, 0);
    totalGeral += totalForn;
    
    md += `### ${label} — ${lista.length} itens = R$ ${totalForn.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, '.').replace('.', 'X').replace(/\./g, '.').replace('X', ',')}\n\n`;
    md += '| Produto | Qtd | Unid | P. Unit. | Total | Marca | Motivo |\n';
    md += '|---|---|---|---|---|---|---|\n';
    
    for (const i of lista) {
      md += `| ${i.produto} | ${i.qtd} | ${i.unid} | R$ ${i.unit.toFixed(2)} | R$ ${i.total.toFixed(2)} | ${i.marca} | ${i.motivo} |\n`;
    }
    md += '\n';
  }
  
  if (semFornecedor.length > 0) {
    md += '### SEM FORNECEDOR\n\n';
    for (const i of semFornecedor) {
      md += `- ${i.produto}: ${i.qtd} ${i.unid}\n`;
    }
    md += '\n';
  }
  
  md += `---\n\n## TOTAL GERAL OTIMIZADO: R$ ${totalGeral.toFixed(2)}\n\n`;
  
  // Summary table
  md += '| Fornecedor | Itens | Total | Condição |\n';
  md += '|---|---|---|---|\n';
  for (const [sName, label] of Object.entries(supplierLabels)) {
    const lista = compra[sName];
    if (!lista || lista.length === 0) continue;
    const totalForn = lista.reduce((s, i) => s + i.total, 0);
    md += `| ${label} | ${lista.length} | R$ ${totalForn.toFixed(2)} | ${pgto[sName] || '—'} |\n`;
  }
  md += `| **TOTAL** | **${Object.values(compra).flat().length}** | **R$ ${totalGeral.toFixed(2)}** | |\n`;
  
  writeFileSync('/home/ubuntu/Relatorio_Cotacao_450001.md', md);
  console.log('Relatório gerado: /home/ubuntu/Relatorio_Cotacao_450001.md');
  
  await conn.end();
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
