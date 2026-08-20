# Saving Real - Notas de Implementação

## Estrutura dos Dados

### price_history (500 registros, threshold <= R$200)
- Colunas: id, productName, productCode, supplierId, supplierName, unitId, unitName, unitPrice, quantity, unit, quotationId, orderId, source, recordedAt
- NÃO tem coluna "brand" (marca)
- Produtos com múltiplas cotações: ARROZ-1KG, MOLHO DE PIMENTA-150ML, ACUCAR-1KG, FEIJAO PRETO-1KG, MARGARINA-3KG, SAL REFINADO, CAFE-250G, DUETO-170G, OLEO-900ML, CREME DE LEITE-200G

### proposal_items (TEM coluna "brand")
- Colunas: id, proposalId, quotationItemId, unitPrice, totalPrice, brand, notes, packagingType, unitsPerPackage, unitPriceNormalized
- Marcas existentes: SAANA, ALEGRE, KIKA, PAI VOVO, FAZMAX, DAMARE, FUGINI, CAMIL

## Lógica do Saving Real (Afonso quer):
1. Agrupar por **produto + marca** (não só produto)
2. Comparar preço unitário da compra ATUAL vs compra ANTERIOR do **mesmo produto, mesma marca**
3. Calcular: (preço_anterior - preço_atual) × quantidade_atual
4. Se preço atual < anterior → economia (verde)
5. Se preço atual > anterior → gasto a mais (vermelho)

## Plano:
1. Adicionar coluna "brand" na tabela price_history (ALTER TABLE)
2. Backfill: popular brand a partir de proposal_items existentes
3. Reescrever query de saving: para cada registro, buscar o registro anterior do mesmo productName+brand e calcular diferença
4. Atualizar o código que grava em price_history para incluir brand
5. Reescrever frontend Analytics com dados limpos

## Problemas atuais no Analytics (foto do Afonso):
- "Sem unidade" com R$ 2.6M dominando gráfico → filtrar
- Eixo X repetindo "27/07 a 02/08" → corrigir formatação de datas
- Gráficos difíceis de ler → redesign com labels claros
