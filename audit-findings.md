# Auditoria QualiCompras - 31/07/2026

## 1. Sistema de Login (Email/Senha)

| Teste | Status | Detalhe |
|-------|--------|---------|
| Login credenciais corretas | OK | Token JWT gerado, usuário retornado |
| Login senha errada | OK | HTTP 401 - "Senha inválida" |
| Login email inexistente | OK | HTTP 401 - "Senha inválida" |
| Login sem body | OK | HTTP 400 - "Preencha email e senha" |
| auth.me com token válido | OK | Retorna dados do usuário |
| auth.me sem token | OK | Retorna null (JSON, não HTML) |
| auth.me token inválido | OK | Retorna null (não quebra) |
| Página /login acessível | OK | HTTP 200 |
| Login via browser (E2E) | OK | Redireciona para Dashboard |

**Latência:** ~3s por request (bcrypt + TLS + serverless cold start). Aceitável para login, mas pode ser otimizado.

## 2. API Endpoints (tRPC)

| Endpoint | Status | Detalhe |
|----------|--------|---------|
| auth.me | OK | 2.3s |
| dashboard.kpis | OK | 3.3s |
| units.list | OK | 7 registros |
| suppliers.list | OK | 71 registros |
| quotations.list | OK | 16 registros |
| orders.list | OK | 66 registros |
| brands.list | OK | 463 registros |
| alerts.list | OK | 66 registros |
| adminSettings.getPassword | OK | Retorna senha universal |
| adminSettings.listUsers | OK | 11 registros |

**1 endpoint não encontrado:** `priceHistory.list` (correto: `prices.list`)

## 3. Banco de Dados

| Tabela | Registros |
|--------|-----------|
| users | 11 |
| units | 7 |
| suppliers | 71 |
| quotations | 16 |
| purchase_orders | 66 |
| brands | 463 |
| alerts | 66 |

**Integridade:** OK - Sem erros de conexão, queries executando normalmente.

## 4. Frontend (Produção)

| Página | Status | Detalhe |
|--------|--------|---------|
| /login | OK | Formulário renderiza corretamente |
| / (Dashboard) | OK | Sidebar + KPIs + gráficos carregam |
| Navegação sidebar | OK | 24 itens de menu visíveis |
| Login flow E2E | OK | Login → redirect → Dashboard funcional |

## 5. Problemas Identificados

### 5.1 Latência Alta (~3-4s por request)
- **Causa:** Hosting Autoscale (serverless) + TLS handshake + bcrypt
- **Impacto:** Experiência lenta para usuários no Brasil
- **Recomendação:** Considerar Reserved hosting para eliminar cold starts

### 5.2 Cache PWA no iOS
- **Causa:** Service worker antigo cached no PWA do iPhone
- **Impacto:** Usuários que adicionaram à tela inicial veem versão antiga
- **Solução aplicada:** DashboardLayout agora usa `window.location.replace("/login")` em vez de tela intermediária
- **Ação do usuário:** Limpar dados do Safari e re-adicionar à tela inicial

### 5.3 Usuários sem nome (3 registros)
- **Causa:** Contas criadas antes do campo nome ser obrigatório
- **Impacto:** Baixo - apenas visual
- **Recomendação:** Forçar preenchimento no próximo login (já implementado)

## 6. Resumo Executivo

O sistema está **100% funcional em produção**. Todos os endpoints críticos respondem corretamente, o login por email/senha funciona, o banco de dados está íntegro e o frontend carrega normalmente.

O problema reportado pelo Afonso era causado por **cache do PWA no iOS** que mantinha uma versão antiga do JavaScript. A correção aplicada (redirect imediato sem tela intermediária) resolve o problema para novos acessos. Para usuários com o atalho antigo, é necessário limpar dados do Safari.
