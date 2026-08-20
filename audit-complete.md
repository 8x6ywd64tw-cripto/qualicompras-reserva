# Auditoria Completa QualiCompras - 25/07/2026

## Problemas Encontrados e Status

### CRÍTICOS (Corrigidos)
1. **Saving Real inflado R$396k → R$4.759** - Comparava preços entre cotações diferentes + outliers
2. **Total Comprado inflado R$92k → R$23.429** - Incluía pedidos PALM fictícios
3. **supplierId null na proposta** - Formulário público não vinculava fornecedor
4. **Download de pedido gerava .txt** - Agora gera PDF profissional
5. **Select de preço não funcionava** - Estado do dropdown resetava

### MÉDIOS (Corrigidos nesta sessão)
6. **Total Comprado mostrava R$23.429,2** (faltava zero) - Corrigido: minimumFractionDigits:2
7. **Divisão por zero em HistoricoPrecos** - prices[1] poderia ser 0 - Corrigido
8. **Divisão por zero em Analytics** - d.count poderia ser 0 - Corrigido com guard

### BAIXOS (Não-bloqueantes, para futuro)
9. **N+1 queries em listPurchaseOrders** - Refatorar para JOIN (performance)
10. **N+1 queries em getLastPurchasePrices** - Refatorar para batch (performance)
11. **Sem transactions em operações multi-tabela** - Adicionar (integridade)
12. **4 fornecedores sem telefone** - Dados incompletos, não é bug

### VERIFICADOS OK
- PDF download funciona corretamente com jsPDF + autoTable
- Compra Otimizada: detecção de anomalias funciona (threshold 4x mediana)
- Compra Otimizada: tolerância de crédito 3% funciona
- Formulário público: validação de supplier OK
- ComparativoFornecedores: guard contra divisão por zero já existe (minPrice > 0)
- Cotações: criação, envio, fechamento - fluxo completo OK
- Pedidos: status workflow (pending → approved → sent → delivered) OK
- Alertas: sistema de notificações funciona
- Auditoria: logs de ações registrados corretamente

## Correções Aplicadas Nesta Sessão
1. Analytics.tsx: `minimumFractionDigits: 2, maximumFractionDigits: 2` no Total Comprado
2. Analytics.tsx: Guard `d.count > 0` antes de divisão no priceEvolution
3. HistoricoPrecos.tsx: Guard `prices[1] !== 0` antes de calcular variação
4. db.ts: Filtro outlier `unitPrice < 200` em getAnalyticsData, getSupplierScores, getCrossComparison
5. db.ts: Savings calculado apenas dentro da mesma quotationId
6. routers.ts: submitProposal tenta match por nome quando supplierId não vem na URL
7. routers.ts: optimize ignora propostas sem supplierId válido
