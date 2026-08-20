# Formato do Arquivo Fortes - Previsão de Compra

## Estrutura do PDF (saída do Fortes)

**Cabeçalho:**
- Nome da unidade (ex: "QUEIROZ")
- Título: "Previsão de Compra"

**Colunas da tabela:**
| Coluna | Descrição | Exemplo |
|--------|-----------|---------|
| Produto | Nome do produto com especificação | ACHOCOLATADO - 700G |
| Grupo | Categoria/setor | CEREAIS |
| Unid. | Unidade de medida (KG, LT, UN) | KG |
| Per Capta | Consumo per capita | 0,02 |
| Custo (R$) | Custo unitário | 26,4143 |
| Quantidade | Quantidade total necessária | 45,5000 |
| Total (R$) | Valor total (custo x quantidade) | 1.201,8506 |

**Rodapé:**
- Cardápio da semana (dias, refeições por dia)
- Data/Hora Solicitação: 25/07/2026 10:28:57

## Observações importantes:
- Formato numérico: vírgula como separador decimal
- Quantidades com 4 casas decimais
- Valores com 4 casas decimais
- Unidades: KG, LT, UN
- Produtos com quantidade 0 aparecem na lista (estoque zerado ou não necessário)
- O Fortes usa este formato para IMPORTAR previsões de compra

## Para gerar arquivo compatível com Fortes:
O Fortes provavelmente aceita importação via CSV/TXT com estas colunas.
Formato provável de importação: CSV com separador ponto-e-vírgula (padrão brasileiro)
Colunas: Produto;Grupo;Unidade;PerCapta;Custo;Quantidade;Total
