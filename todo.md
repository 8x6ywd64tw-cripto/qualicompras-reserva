# QualiCompras - TODO

## Correções de Compatibilidade — Limpeza e Descartáveis Queiroz (17/08 a 23/08)
- [x] Confirmar marca e fornecedor exatos do Perflex e do saco de lixo de supermercado na cotação atual
- [x] Registrar rejeição global: Detergente 500 ml marca Valência da Casa das Embalagens por qualidade insuficiente
- [x] Registrar rejeição global: Perflex do supermercado (Oliveira) marca HOMESTAR que não atende a unidade
- [x] Registrar rejeição global: saco de lixo do supermercado (Bom Preço) marca GUARANI que não atende a unidade
- [x] Normalizar saco de lixo Porus da Casa das Embalagens: 2 pacotes de 5 kg a R$ 75,00, total de R$ 150,00
- [x] Corrigir alocação e totais dos pedidos afetados sem duplicidade
- [x] Motor de compatibilidade brand-aware: rejeita apenas a marca específica quando cadastrada
- [x] Endpoint listAllIncompatibilities para frontend consultar regras
- [x] Comparativo por produto: preço rejeitado aparece riscado com badge vermelho + motivo
- [x] Comparativo por produto: verdinho vai para o item aceito mais barato (exclui incompatíveis do cálculo)
- [x] Gerar e conferir PDFs individuais dos pedidos corrigidos

## Correções de Pedidos — Cotação Ipaumirim Descartáveis e Cereais (24/08 a 30/08)
- [x] HAMBURGUEIRA (PED-MSYUNF421-60007 Roni): Corrigido de R$0,27/un para R$27,00/fardo (100un/fardo), 3 fardos = R$81,00
- [x] DOCE PÉ DE MOLEQUE (PED-MSYUSQ514-120004 Vale Verde): Corrigido de R$0,05/un para R$0,28/un, 1500 un = R$420,00
- [x] Auto-correção Vale Verde: Quando PAÇOQUINHA ou PÉ DE MOLEQUE tiver preço <50% do último pedido, corrige automaticamente para o valor do último pedido

## Simplificação Operacional (18/08/2026)
- [x] Travar criação manual de cotações (botão + modal removidos, fluxo exclusivo via Fortes)
- [x] Remover botão Reupload PDF da tela de cotação
- [x] Remover seção Itens Solicitados da tela principal da cotação
- [x] Remover módulos: Barganha, Comparativo, Logística, Metas de Preço (menu + rotas + páginas)
- [x] Adicionar legenda visual no rodapé do comparativo (verde/vermelho/laranja/cinza)
- [x] PDF comercial limpo (sem Inteligência Histórica Confidencial)
- [x] Valor de referência (último preço) ao lado da porcentagem de variação no comparativo

## Exportação para Aplicativo de Qualidade de Serviço
- [x] Exportar dados disponíveis de unidades em arquivo estruturado para importação externa
- [x] Consolidar todos os dados disponíveis do QualiCompras conforme requisitos do arquivo de integração com o QualiRH
- [x] Incluir vínculos fornecedor–unidade ativos e totais de fornecedores por unidade na exportação QualiRH

## Notificações Personalizadas
- [x] Criar tabelas user_notifications, notification_preferences e push_subscriptions
- [x] Criar APIs: listar, contar não lidas, marcar lida, salvar preferências, registrar push
- [x] Adicionar gatilhos nos fluxos: resposta fornecedor, cotação fechada, pedido gerado, reabertura, alerta preço
- [x] Sino no header com contador de não lidas e popover com últimas notificações
- [x] Página de Notificações com histórico, filtros e ações
- [x] Push Web com VAPID e service worker
- [x] Tela de Preferências de Notificação por usuário
- [x] Testar regras de destinatário, segurança e publicar

## Acesso às Notificações
- [x] Tornar o acesso a Notificações visível na navegação principal e no header mobile
- [x] Validar o novo caminho no iPhone e publicar
- [x] Restringir Preferências de Notificação: só conta Master pode definir alertas e quando aparecem
- [x] Outros usuários veem notificações mas não podem alterar regras

## Códigos Fortes — 14 Fornecedores Pendentes
- [x] Conciliar 14 fornecedores pelo CNPJ com IDs internos do QualiCompras
- [x] Inserir 13 códigos Fortes (empresa 0032) na tabela supplier_fortes_codes
- [x] Validar: apenas Martins Pescados (sem CNPJ) permanece sem código
- [x] Edir Dist Alimentos = GF Comércio de Alimentos (CNPJ bateu: 06.963.092/0004-34)

## Infraestrutura e Base
- [x] Schema do banco de dados completo (fornecedores, unidades, cotações, itens, propostas, pedidos, alertas, auditoria)
- [x] Migrations aplicadas no banco
- [x] Routers tRPC para todas as entidades
- [x] Controle de acesso por perfil (Admin, Comprador, Aprovador)
- [x] Tema visual profissional (azul marinho + dourado Qualities)

## Dashboard Executivo
- [x] KPI: Saving gerado (economia acumulada)
- [x] KPI: Cotações abertas
- [x] KPI: Pedidos pendentes
- [x] KPI: Alertas de preço anômalo
- [x] KPI: Impacto no CMV
- [x] Cotações recentes com status
- [x] Alertas recentes

## Gestão de Fornecedores
- [x] Cadastro completo (CNPJ, razão social, contato, endereço, categorias)
- [x] Score de confiabilidade em semáforo (verde/amarelo/vermelho)
- [x] Controle de documentação com validade
- [x] Histórico de avaliações pós-entrega (estrelas)
- [x] Listagem com filtros e busca

## Central de Cotações
- [x] Criação de cotação por unidade/obra
- [x] Adição de itens (produto + quantidade + unidade de medida)
- [x] Envio de link público para fornecedor responder (sem login)
- [x] Portal público do fornecedor para preenchimento de preços
- [x] Comparativo de propostas lado a lado
- [x] Badge de preço justo/alto no comparativo

## Módulo de Barganha
- [x] Benchmark de preço regional (faixa de referência)
- [x] Exibição da faixa para o comprador negociar
- [x] Botão "Solicitar que cubra oferta"
- [x] Histórico de menor preço praticado

## Workflow de Pedido de Compra
- [x] Geração automática a partir da proposta aprovada
- [x] Aprovação por alçada (Admin/Aprovador)
- [x] Download do pedido em PDF
- [x] Rastreamento de status em tempo real (Pendente → Aprovado → Enviado → Entregue)
- [x] Marcação de entrega e avaliação pós-entrega

## Gestão Multiunidade/Obra
- [x] Cadastro de unidades por estado com endereço
- [x] Requisições vinculadas a centros de custo
- [x] Histórico de compras por unidade
- [x] Filtro global por unidade no sistema

## Logística Inteligente
- [x] Score de viabilidade por fornecedor (distância + frete + nota)
- [x] Estimativa de frete por km
- [x] Ranking automático dos melhores fornecedores por praça

## Importação de Insumos
- [x] Upload de CSV/Excel
- [x] Compatibilidade com formato Gastrotec
- [x] Criação rápida de cotação a partir da importação
- [x] Validação e preview antes de confirmar

## Alertas Automáticos
- [x] Preço anômalo detectado (acima da média histórica)
- [x] Documentação de fornecedor vencida
- [x] Ausência de resposta do fornecedor em 48h
- [x] Ruptura de insumos críticos da Curva A

## Controle de Acesso e Auditoria
- [x] Perfis: Admin, Comprador, Aprovador
- [x] Trilha de auditoria para ações críticas
- [x] Log de quem fez o quê e quando

## Incorporações da Reunião com Adiles (Processo Real)
- [x] Fluxo: Nutricionista define cardápio → gera lista de insumos → comprador cota
- [x] Cotação mínima com 3 fornecedores para comparação
- [x] Aprovação por alçada (valores altos precisam do diretor)
- [x] Registro de quem aprovou e quando (auditoria)
- [x] Suporte a múltiplas unidades/obras simultâneas
- [x] Controle de prazo de entrega e avaliação pós-entrega

## Personalização Visual e PWA (Sprint 2)
- [x] Analisar identidade visual do grupocomenda.com.br
- [x] Gerar ícone personalizado com marca Qualities/Grupo Comenda
- [x] Gerar favicon personalizado
- [x] Configurar Apple Touch Icon para iPhone/iPad
- [x] Criar manifest.json PWA completo
- [x] Configurar theme-color compatível com identidade
- [x] Implementar splash screen PWA
- [x] Aplicar tema azul-marinho/navy + branco + verde corporativo em todo o sistema
- [x] Personalizar tela de login com branding
- [x] Personalizar dashboard, menus, cabeçalhos, botões, cards, tabelas
- [x] Personalizar portal do fornecedor com branding
- [x] Tipografia moderna e corporativa (Inter ou similar)
- [x] Layout responsivo premium para mobile, tablet e desktop

## Reestruturação de Fornecedores (Sprint 2)
- [x] Analisar planilhas de fornecedores (Cocalinho + Todas Unidades)
- [x] Criar categorias de setores de compras baseadas nas planilhas
- [x] Adicionar campo "Responsável na Unidade" no cadastro
- [x] Adicionar campo "Escriturário" por unidade
- [x] Vincular fornecedor à unidade específica
- [x] Importar dados das planilhas para o sistema

## Novos Campos de Fornecedores (Sprint 3)
- [x] Adicionar campo "Observações" no cadastro de fornecedores
- [x] Adicionar campo "Dias de Entrega" no cadastro de fornecedores
- [x] Adicionar campo "Forma de Pagamento" no cadastro de fornecedores
- [x] Exibir observações nos cards de fornecedores com destaque visual (caixa amarela)
- [x] Exibir dias de entrega e forma de pagamento nos cards

## Autenticação por Email/Senha (Sprint 4)
- [x] Adicionar hash de senha na tabela users
- [x] Criar endpoint de login por email/senha
- [x] Criar tela de login com email/senha
- [x] Seed do usuário admin com credenciais fornecidas
- [x] Redirecionar para /login ao invés de Manus OAuth

## Cadastro Completo de Fornecedores e Automação (Sprint 5)
- [x] Pesquisar dados faltantes dos fornecedores (WhatsApp/email)
- [x] Cadastrar 21 fornecedores com CNPJ completo no banco (13 Cocalinho + 8 Maranguape)
- [x] Enviar lista de dados faltantes ao usuário
- [x] Implementar disparo automático de link de cotação por WhatsApp (wa.me com mensagem pré-formatada)
- [x] Implementar disparo automático de link de cotação por email (mailto)
- [x] Botão "Enviar para Fornecedores" que dispara para todos da cotação
- [x] Notificação em tempo real quando fornecedor responder cotação (push notification + alerta no sistema)
- [x] Integração com Fortes AG - endpoint POST /api/fortes/requisicao
- [x] Parser automático de solicitação: identificar produtos e categorias
- [x] Converter solicitação do Fortes em cotação com um clique (identificação automática de categorias + sugestão de fornecedores)
- [x] Página de Requisições Fortes no menu lateral

## Importação PDF Fortes + Workflow Enterprise (Sprint 6)
- [x] Upload de PDF do Fortes AG com parsing automático (extrair itens, qtd, un, códigos)
- [x] Identificar categoria (Cereais/Proteína/Hortifrut/Limpeza) e unidade do cabeçalho
- [x] Criar cotação com um clique a partir do PDF importado
- [x] Dashboard Power BI style: layout com gráficos de evolução de preços, ranking fornecedores, categorias
- [x] Tabela Top Produtos com histórico de preço (média vs último vs tendência)
- [x] Score determinístico de fornecedores (histórico real de preços + região/logística + prazo) - remover Math.random
- [x] Comparativo por produto na cotação: preço atual vs histórico anterior (tabela Top Produtos)
- [x] Exibir histórico por fornecedor no frontend (ranking + API supplierHistory)
- [x] Savings reais calculados a partir de propostas/pedidos fechados (diff min vs max por produto)
- [x] CMV por unidade com agregação real por unidade e período (gráfico Gasto por Unidade)
- [x] Comparativo por item na tela de cotação/requisição: preço atual vs histórico anterior do produto
- [x] UI de histórico por fornecedor: últimos preços, datas e variação por produto

## Login Universal com Senha Fixa (Sprint 7)
- [x] Login universal: qualquer email + senha 319918 acessa o sistema
- [x] Auto-criação de conta no primeiro login (role comprador por padrão)
- [x] Auditoria mantida: cada ação registra email/nome de quem fez

## Correções e Melhorias (Sprint 8)
- [x] Bug: Filtrar fornecedores convidados na cotação pela unidade selecionada (não mostrar todos)
- [x] Auto-selecionar todos os fornecedores da unidade ao escolher a unidade
- [x] Bug: PDF upload na Requisições Fortes dá erro "pdfjsLib.getDocument is not a function" - fix import pdf.js
- [x] Bug: "Criar Cotação" button crash - JSON.parse on already-deserialized categories array

## Redesign Cotações Fortes - Fluxo PDF → Fornecedores (Sprint 9)
- [x] Renomear "Requisições Fortes" → "Cotações Fortes" no menu e página
- [x] Renomear "Cotações" → "Cotações Convencional" no menu
- [x] Remover lista antiga de requisições do banco (cards REQ-XXX)
- [x] Manter apenas upload de PDF na página
- [x] Após PDF: identificar itens, categoria, setor, unidade
- [x] Mostrar fornecedores filtrados por unidade E categoria (pré-selecionados)
- [x] Formulário igual ao convencional: observação, prazo, data de entrega
- [x] Botão criar cotação + enviar WhatsApp/email
- [x] Redirecionar para detalhe da cotação após criação
- [x] Filtragem client-side por categoria (não precisa endpoint extra - usa suppliers.byUnit + filtro)

## Fix Detecção de Setor no PDF Fortes (Sprint 10)
- [x] Corrigir parser PDF: extrair setor/categoria do título da coleta (ex: "PROTEINA" no "Coleta Nº 9 - PROTEINA")
- [x] Adicionar seletor manual de setor no frontend como confirmação/fallback
- [x] Adicionar seletor de unidade no frontend (pré-preenchido se detectado)
- [x] Mapear nomes do Fortes para categorias do sistema (PROTEINA→Proteína, CEREAIS→Cereais, etc.)

## Atualizar fornecedores + Setor Gás (Sprint 11)
- [x] Atualizar Cajá Ovos com WhatsApp: (83) 99125-2835 (Neguin)
- [x] Atualizar Tarcio Frutas com WhatsApp: (83) 99141-3735
- [x] Atualizar NG Distribuidora com WhatsApp: (83) 98816-7719 (Rafael Belmont)
- [x] Pesquisar WhatsApp Ultragaz regional (Ipaumirim/CE) → (88) 9 8855-2604 (Revenda Cariri)
- [x] Adicionar setor "Gás" nas categorias de cotação (Convencional e Fortes)
- [x] Adicionar filtro de setor na Cotação Convencional (filtra fornecedores por categoria)
- [x] Adicionar "Gás" e "Pão" na lista de categorias de Fornecedores

## Limpeza + Pesquisar Novos Fornecedores (Sprint 12)
- [x] Auditar fornecedores cadastrados e remover os que estão longe demais (removido Saborecitrus SP→CE)
- [x] Botão "Pesquisar Novos Fornecedores" na aba Fornecedores
- [x] Selecionar unidade + setor para busca
- [x] Buscar via Google Places API (raio 150km regional)
- [x] Mostrar resultados com nome, telefone, endereço, site, avaliação
- [x] Botão "Adicionar" → cadastra fornecedor com unidade e setor preenchidos
- [x] Endpoint tRPC suppliers.searchPlaces no servidor
- [x] Bloquear botão "Adicionar" para resultados sem telefone
- [x] Verificar duplicidade antes de cadastrar (nome similar na mesma unidade)
- [x] Mostrar erro visível se a busca Places falhar

## Filtros de Distância e Nota + Limpeza Cotações (Sprint 13)
- [x] Excluir todas as cotações existentes (simulações)
- [x] Garantir que não existe botão de excluir cotação na interface (confirmado: não há)
- [x] Adicionar filtro de distância máxima (km) na pesquisa de novos fornecedores
- [x] Adicionar filtro de nota mínima (estrelas Google) na pesquisa de novos fornecedores
- [x] Passar parâmetros de raio ao endpoint searchPlaces
- [x] Filtrar resultados por nota mínima no frontend

## Coordenadas GPS nas Unidades (Sprint 14)
- [x] Adicionar colunas latitude/longitude na tabela units
- [x] Migrar schema e aplicar SQL
- [x] Buscar coordenadas GPS de todas as unidades existentes (Cocalinho -14.39/-51.00, Maranguape -3.88/-38.68, Ipaumirim -6.85/-38.75, Fortaleza -3.73/-38.53)
- [x] Popular coordenadas no banco
- [x] Atualizar searchPlaces para usar coordenadas salvas em vez de geocodificar toda vez

## ADM Master - Gerenciar Senha de Acesso (Sprint 15)
- [x] Criar tabela system_settings para armazenar senha universal
- [x] Definir afonsoqueirogagn@gmail.com como ADM Master (hardcoded)
- [x] Endpoint tRPC para alterar senha universal (só ADM Master)
- [x] Página/painel de configurações acessível só pelo ADM Master
- [x] Atualizar login para usar senha do banco em vez de hardcoded

## Identificação de Usuário na Auditoria (Sprint 16)
- [x] Login com fluxo de dois passos: email+senha → campo de nome (se necessário)
- [x] Novo usuário: campo obrigatório "Seu Nome" aparece automaticamente no primeiro acesso
- [x] Usuário existente com nome genérico (Qualities Refeições, Admin, Teste): forçado a definir nome real
- [x] Usuário existente com nome real: login direto, sem campo de nome
- [x] Nome salvo permanentemente no banco (nunca muda após ser definido)
- [x] Session token usa o nome correto (fix do bug de stale user.name)
- [x] Tentativa de alterar nome via operatorName é ignorada para usuários com nome real
- [x] Auditoria e sidebar usam ctx.user.name que agora é o nome real do operador

## Auditoria só para ADM Master (Sprint 17)
- [x] Esconder menu/página de Auditoria para usuários que não são ADM Master
- [x] Proteger endpoint de auditoria no backend (só ADM Master pode consultar)

## Bug Fix: Filtro de Fornecedores por Unidade e Categoria (Sprint 18)
- [x] Filtro de Unidade na página de Fornecedores não filtra a lista ao selecionar
- [x] Filtro de Categoria + Unidade deve funcionar combinado (ex: Proteína + Ipameri = só fornecedores de proteína de Ipameri)
- [x] "Todas as Unidades" mostra todos os fornecedores independente de unidade

## Badge de Unidade no Card de Fornecedor (Sprint 19)
- [x] Mostrar badge(s) com nome da unidade vinculada em cada card de fornecedor
- [x] Contador de quantas unidades o fornecedor atende (1, 2, 3 unidades)
- [x] Deduplicação de unidades (sem repetição)

## Link Personalizado por Fornecedor
- [x] Frontend: ler parâmetro ?s=ID da URL e pré-selecionar fornecedor automaticamente
- [x] Frontend: ocultar lista de fornecedores quando ?s=ID está presente (fornecedor não vê concorrentes)
- [x] Backend: gerar links individuais por fornecedor no envio de cotação (WhatsApp/email)

## Sprint: Melhorias Cotação v2
- [x] 1. Botão copiar link individual por fornecedor na tela de detalhes da cotação
- [x] 2. Bloquear reenvio duplicado do mesmo fornecedor na mesma cotação
- [x] 3. Campo data+hora de término na criação da cotação (já existia)
- [x] 3b. Exibir prazo com horário no link público para o fornecedor
- [x] 3c. Bloqueio automático de envio após o prazo expirar (frontend + backend)
- [x] 4. Notificações push quando fornecedor responder (via notifyOwner - push nativo da plataforma Manus)
- [x] 4b. Bloqueio de duplicidade coberto via check no backend (listProposals antes do insert)

## Sprint: Ranking + PDF + Histórico de Preços
- [x] Ranking automático de propostas: ordenar por menor preço total, destacar vencedor com badge
- [x] Exportar comparativo em PDF: gerar relatório da cotação para anexar ao pedido de compra
- [x] Histórico de preços por fornecedor: página com evolução temporal de preços por item/fornecedor

## Sprint: Alertas de Preço + Comparativo Cruzado
- [x] Alerta automático de preço em alta: detectar aumento >10% vs última cotação do mesmo produto/fornecedor
- [x] Gerar alerta no sistema + notificação push quando preço sobe >10%
- [x] Comparativo cruzado entre fornecedores: tabela por produto mostrando preço de cada fornecedor
- [x] Destacar menor preço por produto na tabela cruzada
- [x] Filtro por categoria/unidade no comparativo cruzado

## Bug Fix: Modal de envio + Itens duplicados (Sprint 21)
- [x] Ao criar cotação, modal com botões individuais de WhatsApp/Email por fornecedor não aparece
- [x] Está mostrando apenas um link genérico ao invés de abrir modal com cada fornecedor separado
- [x] Itens duplicados no formulário público do fornecedor (ex: OLEO 900ML aparece 2x)
- [x] Deduplicar itens na criação da cotação e/ou na exibição do formulário público

## Sprint 22: Teste Parser + Constraint + Enviar Todos
- [x] Teste vitest para parser Fortes com deduplicação (8 testes passando)
- [x] Constraint UNIQUE no banco (quotationId + productName) para proteção definitiva
- [x] Botão "Enviar Todos" no modal com delay sequencial de 2s entre cada WhatsApp

## Sprint 23: Notificação push + Bug fix detalhe cotação
- [x] Notificação push já existia (linhas 711-720 routers.ts)
- [x] Fix crash ao abrir detalhe da cotação (hooks dinâmicos → query bulk)
- [x] Tratamento de cotação não encontrada (mostra mensagem + botão voltar)
- [x] Apagada cotação 270001 (QUEIROZ) do banco conforme solicitado

## Sprint 24: Fix visual bugs + Melhorar comparativo
- [x] Fix unicode literal "\u2014" aparecendo na coluna Curva (deve ser "—")
- [x] Fix header sobreposto (título + botões) no mobile
- [x] Melhorar comparativo: card resumo com valor total por fornecedor no topo (barras de progresso + ranking)
- [x] Tabela matricial Produto × Fornecedor com preços lado a lado (menor preço em verde)

## Sprint 25: Compra Otimizada Automática (Optimization Engine)
- [x] Backend: Endpoint de otimização - analisar propostas, aplicar critérios (tolerância % para fornecedor a prazo, menor preço vence), retornar distribuição otimizada
- [x] Backend: Gerar pedidos de compra a partir do resultado da otimização - um pedido por fornecedor com itens selecionados
- [x] Frontend: Botão "Gerar Compra Otimizada" na tela de detalhe da cotação (quando há propostas)
- [x] Frontend: Tela de resultado da otimização mostrando distribuição por fornecedor com motivos
- [x] Frontend: Configuração de tolerância % e condições de pagamento antes de rodar otimização
- [x] Frontend: Botão para confirmar e gerar pedidos de compra a partir da otimização

## Sprint 26: Exportar Pedido de Compra em PDF
- [x] Frontend: Botão "Baixar PDF" por fornecedor no modal de resultado da otimização
- [x] Frontend: Gerar PDF formatado com cabeçalho Qualities, dados do fornecedor, tabela de itens, total
- [x] Frontend: Botão WhatsApp ao lado do PDF para enviar direto ao fornecedor

## Sprint 27: Fechar Pedido + Histórico de Compras Realizadas
- [x] Backend: Ao gerar pedidos da otimização, registrar preços no priceHistory com source="order"
- [x] Frontend: Após gerar pedidos, abrir WhatsApp automaticamente para cada fornecedor com mensagem do pedido
- [x] Frontend: Fluxo completo: Compra Otimizada → Fechar Pedido e Enviar via WhatsApp → Pedidos gerados
- [x] Backend: Endpoint getLastPurchasePrices para comparar preço atual vs última compra efetivada
- [x] Frontend: Coluna "Últ. Compra" no modal de otimização mostrando preço anterior + variação %
- [x] Frontend: Indicador visual de variação (verde = mais barato que última compra, vermelho = mais caro)
- [x] Frontend: Na página Pedidos, botão WhatsApp + expandir itens + botão "Enviar ao Fornecedor"

## Sprint 28: Embalagem/Caixa - Normalização de Preço Unitário
- [x] Backend: Adicionar campos packagingType (unidade/caixa/fardo/pacote) e unitsPerPackage na tabela proposal_items
- [x] Frontend: No formulário público do fornecedor, seletor "Cotando por: Unidade / Caixa / Fardo / Pacote"
- [x] Frontend: Se caixa/fardo/pacote, campo obrigatório "Qtd na embalagem" + cálculo automático do preço unitário
- [x] Backend: Calcular e armazenar unitPriceNormalized = unitPrice / unitsPerPackage
- [x] Frontend: No comparativo e otimização, usar preço unitário normalizado para comparação justa
- [x] Frontend: Exibir indicador visual quando fornecedor cotou por caixa (badge "CX" ou "FD")

## Sprint 29: Detecção Automática de Preço Discrepante
- [x] Backend: No endpoint optimize, detectar preços >300% acima da mediana dos outros fornecedores para o mesmo item
- [x] Backend: Excluir automaticamente itens com preço discrepante da otimização
- [x] Backend: Retornar anomalias no resultado da otimização (fornecedor, preço, mediana, desvio %)
- [x] Frontend: No modal de otimização, seção "Preços Suspeitos" com itens excluídos e motivo
- [x] Frontend: Recomendação automática de solicitar correção ao fornecedor
- [x] Frontend: Badge "SUSPEITO" no comparativo para itens com valor >4x o menor preço (fundo laranja)

## Sprint 30: Solicitar Correção de Preço Suspeito
- [x] Backend: Endpoint getCorrectionItem + submitCorrection para correção específica por item/fornecedor
- [x] Backend: Rota pública /correcao/:token/:supplierId/:itemId que mostra só o item suspeito
- [x] Frontend: Botão "Solicitar Correção via WhatsApp" por item na seção de anomalias + botão "Copiar Link"
- [x] Frontend: Abre WhatsApp com mensagem formatada pedindo confirmação/correção do preço + link direto
- [x] Frontend: Página pública de correção (CorrecaoPreco.tsx) com formulário de preço, marca e embalagem
- [x] Backend: Ao corrigir, atualiza proposta, recalcula unitPriceNormalized e totalPrice, registra auditoria

## Correção Manual de Embalagem: PALITO DE DENTE + FILME PVC (Cotação 480001)
- [x] PALITO DE DENTE 2000UND - GINA (ID 270008): Corrigido packagingType=caixa, unitsPerPackage=200, unitPriceNormalized=0.0074
- [x] PALITO DE DENTE 2000UND - T/Roniclei (ID 330008): Corrigido packagingType=caixa, unitsPerPackage=1000, unitPriceNormalized=0.014
- [x] FILME PVC - EST (ID 270003): Confirmado correto (R$ 7,48/un, vende por unidade)
- [x] FILME PVC - T/Roniclei (ID 330003): Confirmado correto (R$ 105,00/cx com 1 un = R$ 105,00/un real)

## Bug: Navegação travada após gerar/compartilhar PDF na cotação
- [x] Após gerar PDF na tela de cotação e abrir compartilhamento, usuário fica preso sem botão de voltar
- [x] Adicionar botão de fechar/voltar na visualização do PDF (overlay com iframe + barra de ações)

## Melhoria: Título automático da cotação após upload PDF Fortes
- [x] Após upload do PDF, gerar título pré-preenchido com: Unidade + Período (data início até data fim / X dias) + Setor
- [x] Exibir campos editáveis de unidade, período e setor logo após o upload
- [x] Permitir edição manual do título gerado antes de criar a cotação (somente ADM pode editar)

## Melhoria: Fluxo pós-upload PDF - Título por seleção + dados automáticos
- [x] Extrair do PDF: Nº Coleta, Unidade, Setor, Período de consumo (OBS), Data, Fornecedores pré-cadastrados
- [x] Após upload, exibir dados extraídos como campos pré-preenchidos (seleção, não digitação)
- [x] Título montado automaticamente por composição dos campos selecionados
- [x] Somente ADM pode editar o título final; demais usuários apenas selecionam os campos
- [x] Extrair período de consumo do campo OBS (ex: "CONSUMO DE 16/07 A 26/07") e calcular dias
- [x] Pré-selecionar fornecedores que vieram no PDF (match por nome/CNPJ com cadastro)

## Melhoria: Listagem de cotações - título visível + cronologia
- [x] Exibir título completo da cotação no card (não truncar)
- [x] Mostrar data de criação em cada card de cotação
- [x] Ordenar cotações por data (mais recente primeiro)
- [x] Filtro por unidade na listagem de cotações (dropdown para ver só cotações de uma unidade)

## Melhoria: Indicador de propostas recebidas nos cards de cotação
- [x] Mostrar no card de cotação quantas propostas já foram recebidas vs total de fornecedores convidados
- [x] Formato visual: "X/Y respostas" com ícone e cores (verde=completo, amarelo=parcial, vermelho=nenhuma)

## Sprint: Melhorias na listagem de cotações (24/07)
- [x] Adicionar período de consumo no título das cotações existentes no banco
- [x] Botão "Fechar Cotação" direto no card (mudar status para closed)
- [x] Filtro por status (Aberta/Fechada/Rascunho/Cancelada) na listagem de cotações

## Melhoria: Campo obrigatório "Unidades por Embalagem" no formulário público (24/07)
- [x] Quando fornecedor selecionar Caixa/Fardo/Pacote, exibir campo obrigatório "Qtd por embalagem" (ex: 1000 palitos/cx)
- [x] Salvar esse dado no banco (proposal_items.unitsPerPackage)
- [x] Comparativo usar preço/unidade real para comparação justa entre fornecedores
- [x] Pedido discriminar: "1 CX (1000 un/cx)" para clareza

## Melhoria: Campo Quantidade como Dropdown obrigatório (24/07)
- [x] Converter campo "Qtd de embalagens" de input livre para dropdown de seleção (1,2,3,4,5...100)
- [x] Tornar obrigatório quando tipo de embalagem é Caixa/Fardo/Pacote
- [x] Exibir cálculo total: "X CX × Y un = Z un totais"

## Melhoria: Entrega e Pagamento como Dropdowns obrigatórios (24/07)
- [x] Substituir "Prazo de Entrega (dias)" por: dropdown "Realiza entrega?" (Sim/Não) obrigatório
- [x] Se Sim → dropdown "Prazo de entrega" (1 a 30 dias) obrigatório
- [x] Pagamento como checkboxes múltiplos: À Vista / A Prazo / Outro (pode marcar vários)
- [x] Se A Prazo → dropdown "Prazo pagamento" (7,14,21,28,30,45,60,90,120 dias) obrigatório
- [x] Se Outro → campo livre para digitar obrigatório
- [x] Observações mantido como opcional
- [x] Validação impede envio sem preencher campos obrigatórios

## Melhoria: Preço como dropdown + campo livre (24/07)
- [x] Dropdown com preços comuns (0,50 a 500,00) + opção "Outro valor" com campo livre

## Melhoria: Dropdown de Marcas auto-aprendido (24/07)
- [x] Usar proposal_items existente como fonte de marcas (sem tabela extra)
- [x] Endpoint público brandsByToken que retorna marcas por produto (sem auth)
- [x] Auto-aprendizado: marcas novas são salvas nas propostas e aparecem nas próximas
- [x] Excluir marcas inválidas (1 caractere, "T", "teste", etc.)
- [x] Dropdown com "+ Digitar marca (se não achar abaixo)" como primeira opção + marcas conhecidas

## Melhoria: Busca/filtro no dropdown de marcas (24/07)
- [x] Substituir select nativo por combobox com campo de busca que filtra marcas em tempo real

## Melhoria: Marca no comparativo (24/07)
- [x] Exibir a marca de cada fornecedor na tabela comparativa de cotações

## Melhoria: Cards de Pedidos e Cotações com Categoria, Unidade e Cor por Setor (24/07)
- [x] Exibir categoria (Cereais/Limpeza/Descartáveis) visível no card de cada pedido
- [x] Exibir unidade (Ipaumirim) visível no card de cada pedido
- [x] Cor distinta por setor/categoria nos cards (Cereais=azul, Limpeza=verde, Descartáveis=roxo, Proteína=vermelho, etc.)
- [x] Aplicar mesma lógica de cor por setor nos cards de cotações
- [x] Informações devem ser claras e identificáveis de imediato

## Correção: Pedidos de Compra com itens errados (24/07)
- [x] PED-MIXMATEUS-450001: já estava correto (8 itens, R$ 6.672,36)
- [x] PED-OLIVEIRA-450001: corrigido - marcas e preços atualizados (Bomsabor, São Braz, InterSal, Nordestino, Pitu, Estrela, Powerlate)
- [x] PED-OLIVEIRA-510001: já estava correto (13 itens limpeza, R$ 1.053,60)
- [x] PED-RONICLEI-480001: já estava correto (9 itens descartáveis, R$ 2.576,00)
- [x] Totais recalculados e verificados

## Correção Final: Redistribuição de itens entre fornecedores (24/07)
- [x] Oliveira ficou com 13 itens cereais (Arroz, Macarrão, Far.Trigo c/ e s/, Flocão, Sal, Açúcar, Far.Mandioca, Colorau, Cachaça, Vinagre, Lasanha, Achocolatado)
- [x] Mix Mateus ficou com 3 itens (Feijão Carioca R$7,98, Leite em Pó R$6,98, Farinha de Mandioca preço pendente)
- [x] Sem duplicatas entre pedidos
- [x] Pendente: preço da Farinha de Mandioca no Mix Mateus (dado ausente no fornecedor - ADM pode editar via ✏️)

## Bug: Select de preço não funciona no formulário público de cotação (24/07)
- [x] Investigar e corrigir bug onde selecionar preço no dropdown não registra o valor
- [x] Testar formulário após correção

## Melhoria: Prazo opcional nas cotações (24/07)
- [x] Tornar prazo (deadline) opcional na criação de cotação
- [x] Perguntar ao usuário se quer prazo ou não antes de gerar
- [x] Se não definir prazo, não exibir no link público do fornecedor
- [x] Remover prazo da cotação COT-CREMO-0001

## Bug: Download de pedido gera .txt ao invés de PDF (24/07)
- [x] Corrigir botão de download para gerar PDF formatado profissional
- [x] PDF deve conter: cabeçalho com logo/nome, dados do pedido, tabela de itens, totais
- [x] Testar download no mobile

## Bug: Fechar pedido na cotação dá erro supplierId null (24/07)
- [x] Corrigir erro "expected number, received null" no supplierId ao fechar pedido via Compra Otimizada
- [x] Garantir que supplierId é corretamente extraído das propostas
- [x] Fix: proposta do Walmor (id 390001) atualizada com supplierId=300001
- [x] Fix: otimização agora ignora propostas sem supplierId válido
- [x] Fix: submitProposal agora tenta match por nome quando supplierId não vem na URL

## Bug: Quantidade errada no Cremosinho - Parser Fortes (24/07)
- [x] Corrigir quantidade de 1378 para 1300 no banco (cotação COT-CREMO-0001)
- [x] Investigar parser do Fortes para entender por que extraiu 1378 ao invés de 1300
- [x] Corrigir: adicionada tabela editável de revisão de itens/quantidades antes de criar cotação
- [x] Aviso visual: "⚠️ Confira se as quantidades estão corretas. O parser pode extrair valores errados do PDF."

## Melhoria: Analytics com dados inflados por outliers (25/07)
- [x] Investigar propostas com preços discrepantes (ex: Vó Ita café/arroz com preço de fardo como unitário)
- [x] Implementar filtro de outliers no cálculo de savings, total comprado e evolução de preços
- [x] Excluir pedidos PALM (Compra Anterior Italo) - não eram compras reais controladas
- [x] Excluir price_history do fornecedor Compra Anterior (Italo)
- [x] Corrigir cálculo de Saving Real: comparar apenas dentro da mesma cotação (quotationId)
- [x] Excluir preços outliers: Paçoquinha R$17.98, Pé de Moleque R$7.98, Filme PVC R$105
- [x] Excluir preços errados Vó Ita: Açúcar R$324/kg, Arroz R$348/kg (preço de fardo)
- [x] Resultado final: Saving Real R$4.759 | Total Comprado R$23.429 | 146 registros

## Auditoria Completa - Robustez do Sistema (25/07)
- [x] Corrigir encoding Unicode em todas as páginas (Cotacoes, Pedidos, Fornecedores, CotacaoDetalhe)
- [x] Auditar navegação: adicionar botões de voltar em todas as sub-páginas
- [x] Teste end-to-end: cotação Fortes → proposta fornecedor → compra otimizada → pedido
- [x] Garantir que formulário público nunca dê erro ao fornecedor responder
- [x] Verificar que todos os fluxos funcionam sem intervenção manual
- [x] Corrigir formatação de moeda (R$ 23.429,2 → R$ 23.429,20)

## Permissões ADM Master (25/07)
- [x] Só ADM Master pode excluir cotações
- [x] Só ADM Master pode excluir pedidos
- [x] Só ADM Master pode editar preços/itens de cotações existentes
- [x] Só ADM Master pode editar pedidos existentes
- [x] Outros usuários: apenas visualizar, criar e responder cotações
- [x] Backend: proteger endpoints com verificação de role/email
- [x] Frontend: esconder botões de excluir/editar para não-ADM

## Fix: Totais inflados por outliers na tela de cotação (25/07)
- [x] CotacaoDetalhe: calcular total exibido a partir dos proposal_items excluindo preços >R$200/un
- [x] Ranking de fornecedores usa total derivado (sem outliers) ao invés do totalValue armazenado
- [x] Tabela comparativa TOTAL row usa total derivado
- [x] Export PDF usa total derivado
- [x] DSG Distribuidora corrigido: de R$346.718 para R$5.796 (Arroz R$348/kg e Açúcar R$324/kg excluídos)
- [x] TypeScript check: 0 errors
- [x] Vitest: 21 tests passed (4 test files)

## Edição ADM Completa - Todos os campos de proposta (25/07)
- [x] Backend: expandir editProposalItem para aceitar quantity, packagingType, unitsPerPackage, unitPrice
- [x] Backend: recalcular unitPriceNormalized = unitPrice / unitsPerPackage (preço por unidade real)
- [x] Backend: recalcular totalPrice = quantity * unitPrice (total da embalagem × qtd)
- [x] Backend: recalcular proposal totalValue após qualquer edição
- [x] Frontend: modal/formulário de edição com TODOS os campos editáveis (não só preço)
- [x] Frontend: mostrar cálculo em tempo real ao editar (preço/un atualizado)
- [x] Garantir que comparação de preços usa unitPriceNormalized para ser justa

## Compra Otimizada - Validação de Quantidade (25/07)
- [x] Compra Otimizada: só selecionar fornecedor que cotou quantidade >= quantidade solicitada
- [x] Alerta visual quando fornecedor cotou quantidade insuficiente
- [x] Formulário público: mostrar claramente ao fornecedor a quantidade necessária (ex: "Precisamos de 840 KG")
- [x] Formulário público: informar que 1 caixa = X unidades para o fornecedor preencher corretamente

## Redesign Formulário Público - Preço Obrigatório por Embalagem (25/07)
- [x] Tornar obrigatório: fornecedor DEVE informar preço DA EMBALAGEM (ou da unidade se vende avulso)
- [x] Tornar obrigatório: fornecedor DEVE informar quantas unidades tem na embalagem (SEMPRE, mesmo se vende por unidade)
- [x] Labels dinâmicos: "Preço por unidade (R$)" ou "Preço de 1 caixa/fardo/pacote (R$)" conforme seleção
- [x] Calcular e exibir automaticamente: "Preço por unidade: R$ X,XX" (preço embalagem ÷ un/embalagem)
- [x] Se selecionar "Unidade" como embalagem: opção "1 unidade (vendo avulso)" disponível
- [x] Validação: bloquear envio se un/embalagem não selecionado ou preço = 0
- [x] Instrução clara no topo: "COMO PREENCHER" em 4 passos com destaque visual
- [x] Backend: unitPriceNormalized = unitPrice / unitsPerPackage garantido em submitProposal e editProposalItem

## Painel "Cenários de Custo" (25/07)
- [x] Função central computeScenarios em shared/scenarios.ts (pura, sem DB)
- [x] 3 cards: Pior (vermelho), Intermediário (amarelo), Ideal (verde)
- [x] Gráfico de barras comparativo proporcional
- [x] Mensagem de economia potencial (R$ e %) Pior→Ideal e vs Intermediário
- [x] Distribuição por fornecedor no cenário ideal (ranking com % participação)
- [x] Disclaimer sobre frete/condições não incluídos
- [x] Integração com Compra Otimizada: endpoint retorna scenarios no response
- [x] Botão "Executar Compra Otimizada" no painel de cenários
- [x] Testes matemáticos: 8 testes (Produto A, B, combinados, edge cases)
- [x] TypeScript: 0 errors
- [x] Vitest: 29 tests passed (5 files)

## Economia na Compra Otimizada + WhatsApp (26/07)
- [x] Economia card no modal Compra Otimizada (R$ e % vs pior cenário)
- [x] Economia no WhatsApp auto-send após gerar pedidos
- [x] Economia no WhatsApp manual (botão por fornecedor)
- [x] Fix hooks crash definitivo (verificar e redeployar)
- [x] Teste end-to-end: upload CEREAIS(1).pdf → gerar cotação → Compra Otimizada

## Redesign Cards Pedidos
- [x] Reformular cards de pedidos: mostrar Unidade, Período consumo (datas Fortes), Setor e Fornecedor como info principal (código PED-XXX secundário)

## Inteligência Histórica de Compras
- [x] DB: campo purchase_group_id em purchase_orders para agrupar pedidos da mesma Compra Otimizada
- [x] Backend: engine de comparação de cestas (normalização, preço médio ponderado, efeito preço vs volume)
- [x] Backend: cálculo de comparabilidade (sobreposição SKUs + semelhança volumes ponderada)
- [x] Backend: rota comparação histórica de uma compra (busca automática referência)
- [x] Backend: rota evolução ao longo do tempo (semanal/mensal)
- [x] Frontend: painel "Comparação histórica desta compra" no detalhe do pedido
- [x] Frontend: tabela analítica por produto (preço atual vs referência, impacto, situação)
- [x] Frontend: evolução das compras no Analytics/Histórico (gráfico temporal)
- [x] Frontend: filtros combináveis (período, unidade, categoria, fornecedor, tipo compra)
- [x] PDF interno: incluir comparação histórica no relatório confidencial
- [x] Confidencialidade: garantir que dados históricos não apareçam em WhatsApp/PDF fornecedor
- [x] Testes: teste matemático obrigatório (cenário A/B do spec)
- [x] Testes: edge cases (cesta idêntica, volumes diferentes, produto novo, sem histórico, etc.)
- [x] Responsividade: desktop, iPad, iPhone

## Relatório Mensal Automático
- [x] Backend: gerador de PDF mensal (evolução preços, economia acumulada, ranking fornecedores)
- [x] Backend: job Heartbeat agendado para gerar e enviar relatório mensalmente (dia 1)
- [x] Backend: envio por email (owner notification) com PDF anexo
- [x] Backend: link WhatsApp com resumo + link para download do PDF
- [x] Frontend: página de configuração (destinatários, preview, disparo manual)
- [x] Testes unitários para geração do relatório

## Ativar Agendamento + Meta de Preço por Produto
- [x] Ativar agendamento Heartbeat do relatório mensal (dia 1, 6h UTC)
- [x] DB: tabela price_targets (productName, unit, maxPrice, category, unitId, createdBy)
- [x] Backend: CRUD de metas de preço (criar, listar, editar, excluir)
- [x] Backend: verificação automática na Compra Otimizada (comparar preço vs meta)
- [x] Backend: gerar alerta quando preço excede meta
- [x] Frontend: página/seção de Metas de Preço (cadastro + listagem)
- [x] Frontend: indicador visual na Compra Otimizada quando item excede meta
- [x] Testes e checkpoint

## Comparativo entre Unidades (Benchmark Interno)
- [x] Backend: endpoint comparativo com filtros combináveis (período, unidade, categoria/setor, produto)
- [x] Backend: visão por categoria - total gasto por unidade em cada categoria
- [x] Backend: visão por setor - agrupamento por setor de compra
- [x] Backend: visão por produto - preço unitário de cada produto em cada unidade
- [x] Backend: ranking de unidades (quem compra mais barato por categoria/setor/produto)
- [x] Backend: identificar produtos com maior divergência de preço entre unidades
- [x] Frontend: página "Comparativo Unidades" com tabs (Categoria, Setor, Produto)
- [x] Frontend: filtros combináveis (período de/até, unidade, categoria, setor)
- [x] Frontend: destaque visual para unidade mais econômica e mais cara
- [x] Frontend: tabela detalhada por produto mostrando preço em cada unidade
- [x] PDF: exportar relatório comparativo entre unidades
- [x] Rota no sidebar + testes

## Poderes Totais ADM Master (editar/apagar tudo pela UI)
- [x] Backend: replaceItems endpoint (reupload PDF na cotação)
- [x] Backend: delete helpers (proposals, proposalItems, quotationItems, priceHistory)
- [x] Cotações lista: botão Excluir (só master)
- [x] Fornecedores: editar todos os campos + deletar fornecedor
- [x] Histórico Preços: deletar entradas individuais
- [x] Cotações detalhe: botão reupload PDF (substituir itens)
- [x] Unidades: editar nome/estado/endereço + deletar unidade
- [x] Teste end-to-end de todos os poderes master

## Separar Botão Fechar Pedido e WhatsApp na Compra Otimizada
- [x] Remover envio automático de WhatsApp ao fechar pedido
- [x] Botão "Fechar Pedido" separado (gera pedidos + fecha cotação como "ordered")
- [x] Botões individuais "Enviar via WhatsApp" por fornecedor (usa navigator.share ou wa.me sem número fixo)
- [x] Adicionar status "ordered" na cotação (schema + migration + frontend)
- [x] Backend: fechar cotação como "ordered" ao gerar pedidos da otimização

## Remoção Pergunta Qtd Embalagens do Link Público
- [x] Remover pergunta "Quantas caixas/fardos/pacotes você vai entregar?" do formulário público
- [x] Remover validação obrigatória do campo quantityPkg
- [x] Atualizar texto de campos obrigatórios

## Campo de Preço Livre no Link Público
- [x] Substituir dropdown de preços pré-selecionados por input de texto livre (R$ + digitar valor)

## Pedido Vale Verde (Pé de Moleque + Paçoca) para Queiroz
- [x] Gerar pedido PED-MS3KIN35-120004 com preços da última cotação de Ipaumirim
- [x] Paçoquinha 900 UN x R$ 0,24 = R$ 216,00
- [x] Pé de Moleque 900 UN x R$ 0,28 = R$ 252,00
- [x] Total R$ 468,00 - Status: Aprovado

## Fluxo Pedidos: Aprovado → Compra feita → Entrega feita
- [x] Adicionar status "purchased" ao schema do banco
- [x] Criar procedure markPurchased no backend
- [x] Remover botão "Enviar ao Fornecedor" que mandava WhatsApp automaticamente
- [x] Novo fluxo: Aprovado → "Compra feita" → "Entregue" (sem WhatsApp forçado)
- [x] WhatsApp fica como ícone separado (opcional, o usuário decide)
- [x] Aumentar fontes 20% nos cards de pedido
- [x] Duplicate guard: impedir double-click em "Fechar Pedido" na cotação
- [x] Remover botões WhatsApp do modal de Compra Otimizada (só "Fechar Pedido" + "Cancelar")
- [x] Badge "Pedido Gerado" em verde na lista de cotações
- [x] Exportar para Fortes: botão CSV nos pedidos aprovados/comprados/entregues (formato Fortes: Produto;Grupo;Unid.;Per Capta;Custo;Quantidade;Total)
## Ajuste de Compra + Justificativas (Sprint Atual)
- [x] Ajustar Compra: botão na Compra Otimizada para alterar fornecedor manualmente com justificativa obrigatória
- [x] Justificativas de Compra: novo setor no menu com tabela, filtros e indicadores
- [x] Registro de auditoria imutável para cada item alterado (snapshot completo)
- [x] Resumo financeiro da compra ajustada (impacto em R$ e %)
- [x] Remover "Enviar ao Fornecedor" do fluxo de Pedidos (já feito anteriormente)
- [x] Fluxo Pedidos: Aprovado → Compra feita → Entrega feita (já feito anteriormente)
- [x] Aumentar 20% textos dentro dos cards de Pedidos (já feito anteriormente)
- [x] Executar ajuste real: cereais Queiroz → fornecedor Pereira com justificativa logística

## Indicador Visual de Variação de Preço (Sprint Atual)
- [x] Componente PriceIndicator: círculo colorido (verde=caiu/manteve, vermelho=subiu) envolvendo o preço
- [x] Tooltip explicativo com motivo da variação (último preço, data, % de variação, fornecedor)
- [x] Integrar indicador na tela de comparativo de propostas da cotação
- [x] Endpoint backend para buscar último preço histórico por produto+fornecedor

## Correções SEO - Página Inicial (Sprint Atual)
- [x] Adicionar meta keywords com 3-8 palavras-chave relevantes
- [x] Adicionar cabeçalho H2 descritivo (máx 80 caracteres)

## Bug Fix: Botão "Continuar → Selecionar Itens" não funciona (Sprint Atual)
- [x] Botão com estilo visual de desabilitado quando justificativa < 10 caracteres (bg-gray-400 + opacity)
- [x] Auto-scroll para topo do modal ao avançar para step 2 (seleção de itens)

## Redesign Ajuste de Compra - Seleção por Item com Checkbox (Sprint Atual)
- [x] Adicionar checkbox em cada item na tabela de fornecedor (todos marcados por padrão)
- [x] Desmarcar item = não comprar esse produto nesse pedido
- [x] Recalcular total do pedido em tempo real conforme seleção
- [x] Quando só 1 fornecedor respondeu: mostrar checkboxes direto (sem precisar do fluxo "Ajustar")
- [x] Justificativa obrigatória apenas para itens desmarcados (campo único)
- [x] Botão "Fechar Pedido" gera pedido apenas com itens selecionados
- [x] Remover fluxo complexo de 2 steps quando não há alternativa de fornecedor

## Bug Fix: "Sem alternativa" na coluna Ajustar (Sprint Atual)
- [x] Corrigido: usar item.alternatives do servidor (já calculado na otimização) em vez de getAlternativesForItem que usava dados incompletos
- [x] Adicionado supplierId ao array alternatives retornado pelo servidor para permitir a troca funcionar

## UI: Mover botão Compra Otimizada (Sprint Atual)
- [x] Remover botão "Compra Otimizada" do topo (junto com Link/PDF/Excluir)
- [x] Colocar "Executar Compra Otimizada" apenas dentro dos Cenários de Custo (onde funcionava)

## Feature: Real-time item movement between supplier cards
- [x] Items visually move from source card to destination card when adjusted
- [x] Totals and item counts update in real-time
- [x] Undo button to move item back to original supplier

## Fix: Re-ajuste em cotações fechadas + error handling
- [x] Permitir re-ajuste em cotações já ordered (cancelar pedidos antigos e gerar novos)
- [x] Melhorar error handling no frontend (toast + stop loading em todos os cenários)

## Bug Fixes - Julho 2026
- [x] Fix: Botão "Confirmar Ajuste e Fechar Pedido" travava em "Salvando..." infinitamente
  - [x] Causa: servidor retornava HTML em vez de JSON quando sessão expirava (Cloud Run)
  - [x] Fix 1: tRPC client fetch com timeout de 45s + interceptor que converte HTML errors em JSON
  - [x] Fix 2: Guard no servidor para bloquear cotações canceladas/rascunho
  - [x] Fix 3: Safety timeout de 50s no frontend para garantir que botão nunca trava
  - [x] Fix 4: Guard no cliente para cotações canceladas antes de chamar mutation

## Bug Fix: Parser Fortes PDF - Itens faltando/trocados (Sprint Atual)
- [x] Fix: Unidade "PC" (peça) não estava na lista de unidades reconhecidas → MARMITAS não era parseada
- [x] Fix: Parênteses () não estavam na character class da descrição → BOBINA 20X30 (P) não era parseada
- [x] Fix: Nº Coleta (11 dígitos) era parcialmente capturado como código de item → adicionado negative lookbehind (?<!\d)
- [x] Fix: Detecção de categoria para Limpeza e Descartáveis não existia → adicionados keywords de limpeza e descartáveis
- [x] Fix: Período de consumo com formato "CONSUMO 03.08 A 09.08" (ponto em vez de barra, sem "DE") não era parseado
- [x] Adicionadas unidades extras: PC, TB, RL, FR, PT, BL, RS
- [x] Adicionados caracteres especiais na regex: :;#&+'°ºª

## Feature: Opção "Não tenho" no Portal do Fornecedor
- [x] Adicionar toggle/checkbox "Não tenho este item" em cada item do formulário do fornecedor
- [x] Itens marcados como "não tenho" devem desabilitar os campos de preço e não exigir preenchimento
- [x] Atualizar validação do frontend para permitir envio com itens marcados como indisponíveis
- [x] Atualizar backend para aceitar itens com flag "unavailable" na proposta (filtra da validação)
- [x] Garantir que itens indisponíveis apareçam corretamente na comparação de preços (como "N/D")

## Atualização Fornecedor PRASO
- [x] Vincular PRASO às unidades Maranguape e Fortaleza (já estava vinculado)
- [x] Atualizar categorias para: Limpeza, Descartáveis, Cereais, Proteína

## Feature: Sistema de Classificação de Marcas (v1 - genérica)
- [x] Criar tabela `brands` no banco (nome, status: approved/unknown/rejected, motivo, createdAt)
- [x] Criar endpoints CRUD para marcas (listar, criar, atualizar status, deletar)
- [x] Exibir cor da marca no comparativo de preços (verde=aprovada, amarelo=desconhecida, vermelho=reprovada)
- [x] Exibir cor da marca na tela de cotação/propostas
- [x] Bloquear marcas vermelhas na compra otimizada (selecionar próximo mais barato com marca aceitável)
- [x] Criar página de gerenciamento de marcas no painel admin
- [x] Cadastrar marcas reprovadas iniciais: Cuzcuzmais, Castanhão

## Feature: Classificação de Marcas por Produto/Categoria (v2)
- [x] Adicionar coluna `productCategory` na tabela brands (nullable - quando NULL aplica a todos)
- [x] Atualizar endpoints CRUD para suportar filtro por produto/categoria
- [x] Atualizar compra otimizada para verificar marca+produto antes de bloquear
- [x] Atualizar comparativo e telas de cotação para mostrar status da marca conforme o produto
- [x] Atualizar página Marcas para cadastro e edição por produto/categoria
- [x] Corrigir dados: Castanhão reprovada APENAS para macarrão/espaguete e cuscuz, aprovada para arroz
- [x] Cadastrar: Dona Clara reprovada para cuscuz
- [x] Regra: só rejeitar marca em produto/categoria não especificado se o usuário der ordem explícita

## Feature: Auto-popular Marcas a partir das Propostas
- [x] Criar endpoint que extrai todas as combinações marca+produto únicas das propostas dos fornecedores
- [x] Sincronizar automaticamente: novas marcas entram como "unknown" (amarela) na tabela brands
- [x] Atualizar página Marcas para mostrar todas as marcas agrupadas por produto, com botão de classificação rápida
- [x] Comprador pode classificar cada marca+produto com um clique (verde/amarelo/vermelho)

## Feature: Senhas Diferenciadas e Permissão de Edição para Comprador
- [x] Implementar senha exclusiva para Afonso (ADM master): Samuelqg123
- [x] Manter senha padrão para demais usuários: Quali319918
- [x] Criar role "buyer_senior" para Junior (Luiz Antonio jr) com permissão de editar preços nas propostas
- [x] Junior pode editar preços suspeitos nas propostas dos fornecedores
- [x] Demais funcionalidades admin continuam exclusivas do Afonso

## Histórico de Cotações e Pedidos - Páginas Separadas
- [x] Página "Histórico de Cotações": cotações encerradas (status ordered/closed/cancelled) com acesso detalhado
- [x] Página "Histórico de Pedidos": pedidos entregues (status delivered) com acesso detalhado a valores
- [x] Página principal "Cotações" mostra APENAS cotações ativas (open/draft) por padrão
- [x] Página principal "Pedidos" mostra APENAS pedidos ativos (pending/approved/purchased) — não entregues
- [x] Menu lateral: adicionar "Histórico Cotações" e "Histórico Pedidos" como itens separados
- [x] Ao clicar em item do histórico, abrir detalhe completo (mesma tela CotacaoDetalhe / detalhe do pedido)
- [x] Fluxo completo: Cotação aberta → Encerrada (vai pro histórico) → Pedido ativo → Entregue (vai pro histórico)

## Ajuste de Fluxo: Históricos e Cancelados
- [x] Pedidos (lista principal): pendente + aprovado + compra feita (purchased)
- [x] Histórico de Pedidos: APENAS entregue (delivered)
- [x] Cotações (lista principal): rascunho + aberta + fechada (closed)
- [x] Histórico de Cotações: APENAS "pedido gerado" (ordered)
- [x] Página separada "Cancelados": cotações canceladas + pedidos cancelados juntos
- [x] Menu lateral: adicionar "Cancelados" na seção HISTÓRICO
- [x] Filtros dos históricos: apenas Unidade e Setor (sem filtro de status)

## Bugs Reportados por Junior (30/07/2026)
- [x] BUG: Timeout "Tempo limite excedido" ao confirmar ajuste na Compra Otimizada (root cause: fetch AbortController era 45s, aumentado para 180s + safety timeout 120s + backend otimizado com Promise.all)
- [x] BUG: Compra Otimizada não expande tela cheia — dialog expandido para 95vw/95vh
- [x] BUG: Ao mover item para outro fornecedor no ajuste, a marca exibida continua sendo a do fornecedor antigo — corrigido: agora propaga brand/packagingType/unitsPerPackage do novo fornecedor

## Bugs Críticos - Marcas Reprovadas e Fechamento de Pedido (30/07/2026)
- [x] BUG: Marca reprovada não é excluída da Compra Otimizada — já implementado no backend (getBrandStatusBatch filtra marcas rejected)
- [x] BUG: Marca reprovada deveria aparecer com nome vermelho e riscado na tela de cotação/comparativo — já implementado (text-red-700 bg-red-50 line-through)
- [x] BUG: Fechar pedido na Compra Otimizada ainda falha — corrigido: fetch timeout 45s→180s + backend batch operations (recordPriceBatch + Promise.all)
## Fix Crítico: Fechamento de Pedido com Ajuste - Correção Final (30/07/2026)
- [x] FIX: splitLink - Mutations agora usam httpLink individual (sem batching) para evitar conflito com queries simultâneas
- [x] FIX: Zod schema - Todos os campos opcionais agora aceitam null além de undefined (.optional().nullable())
- [x] FIX: Frontend - Campos opcionais enviam null explícito em vez de undefined (evita edge cases do superjson)
- [x] FIX: Defensive number handling - isFinite() checks em todos os toFixed() calls no backend
- [x] FIX: Empty supplier filter - Fornecedores com 0 itens são filtrados antes de criar pedidos
- [x] FIX: Safety timeout removido - Era redundante com o fetch timeout de 180s e causava double-error
- [x] FIX: Logging detalhado step-by-step no backend para diagnóstico em produção
- [x] TEST: 5 testes unitários validando o schema Zod (null, undefined, NaN, strings válidas, justificativa curta)

## Fix Crítico v2: Service Worker Caching Bug (30/07/2026)
- [x] Identificado que SW antigo (qualicompras-v1) cacheava HTML e impedia atualização do JS bundle
- [x] Substituído SW por versão que limpa todos os caches e passa requests direto
- [x] Adicionado unregister de SW no main.tsx para limpar registros antigos
- [x] Adicionado headers no-cache para index.html e sw.js no servidor
- [x] Adicionado try-catch completo no confirmAdjustment com mensagens de erro específicas
- [x] Validação defensiva de supplier/item/adj antes de acessar propriedades
- [x] Filtro de supplier groups vazios antes de enviar payload

## Feature: Reabrir Cotação Fechada (30/07/2026)
- [x] Endpoint backend quotations.reopen: muda status de 'ordered' para 'open', cancela pedidos existentes
- [x] Botão no frontend (página de detalhe da cotação) para reabrir cotação fechada
- [x] Audit log registrando quem reabriu e quando
- [x] Pedidos vinculados são cancelados automaticamente ao reabrir

## Feature: Edição de Quantidades dos Itens da Cotação
- [x] Permitir edição inline de quantidade dos itens da cotação para ADM Master e buyer_senior
- [x] Funcionar em qualquer status da cotação (aberta, fechada, ordered)
- [x] Endpoint backend para atualizar quantidade do item (já existia, permissão expandida)
- [x] Feedback visual ao salvar (toast de sucesso)

## Feature: Redirecionamento de Estoque Insuficiente
- [x] Botão "Fornecedor com Estoque Insuficiente" na tela de cotação após compra otimizada
- [x] Dialog para selecionar fornecedor + item + informar quantidade real disponível
- [x] Cálculo automático do remanescente (qtd pedida - qtd real)
- [x] Identificação automática do 2º melhor preço para o item
- [x] Geração automática de pedido complementar para o 2º fornecedor
- [x] Atualização do pedido original (reduzir quantidade para o que o fornecedor realmente tem)
- [x] Registro de auditoria da operação
- [x] Permissão: ADM Master + buyer_senior (Junior)

## Feature: Ranking de Alternativas no Estoque Insuficiente
- [x] Ao clicar "Redirecionar", mostrar tela intermediária com ranking de fornecedores alternativos
- [x] 2º melhor preço em destaque no topo
- [x] Demais opções (3º, 4º, 5º...) listadas abaixo em ordem de preço
- [x] Cada opção mostra: fornecedor, marca, preço unitário, total estimado
- [x] Se escolher opção diferente do 2º melhor preço, exigir justificativa obrigatória
- [x] Backend: endpoint getStockAlternatives para listar alternativas por item (sem redirecionar direto)
- [x] Backend: redirectInsufficientStock aceita chosenSupplierId + justificativa por item

## Segurança: Blindagem Completa contra Interferência Externa
- [x] Headers HTTP de segurança (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Strict-Transport-Security, Referrer-Policy, Permissions-Policy)
- [x] Content Security Policy (CSP) restritiva
- [x] Rate limiting global (200/min) e por endpoint sensível (auth: 10/min, propostas: 5/5min, API pública: 30/min)
- [x] Proteção contra brute force em endpoints de autenticação (10 req/min)
- [x] CORS restritivo (apenas domínios autorizados: qualicompra.manus.space, manus.computer)
- [x] Validação de origem em mutations tRPC (bloqueia POST de origens não autorizadas)
- [x] Proteção de endpoints públicos do fornecedor contra abuso (rate limit 30/min)
- [x] Proteção de endpoints Fortes AG com API Key obrigatória
- [x] Proteção de endpoint scheduled com validação de chave interna
- [x] Proteção contra clickjacking (X-Frame-Options DENY + frame-ancestors 'none')
- [x] Desabilitar fingerprinting do servidor (X-Powered-By removido)
- [x] Cross-Origin-Opener-Policy, Cross-Origin-Resource-Policy, X-DNS-Prefetch-Control
- [x] Security logger para requisições suspeitas (path traversal, XSS, SQL injection)

## Segurança Avançada: Proteção contra IA, Bots e Insider Threat
- [x] Audit trail completo — registrar TODA ação de TODOS os usuários (quem, o quê, quando, IP, user-agent)
- [x] Tabela audit_logs no banco com campos: severity, resource, ip, user-agent, session fingerprint
- [x] Tabela security_events no banco para alertas de segurança
- [x] Página Central de Segurança no painel admin (somente owner) com 2 abas: Auditoria + Alertas
- [x] Proteção anti-bot/IA — bloqueia headless browsers, python-requests, scrapy, puppeteer, playwright, selenium
- [x] Fingerprinting de sessão (user-agent + IP) para detectar anomalias de comportamento
- [x] Detecção de manipulação suspeita — alerta se usuário executa >50 ações/min ou padrões anômalos
- [x] Notificação push ao owner (Afonso) quando ação suspeita for detectada
- [x] Controle de permissões granular — MASTER_EMAIL protege todas as operações críticas
- [x] Restrição de acesso: usuários não-admin não podem excluir, alterar configurações ou aprovar pedidos
- [x] Proteção contra prompt injection em campos de texto (sanitização no securityGuard)
- [x] Rate limiting por usuário autenticado via securityCheck no tRPC middleware
- [x] Bloqueio automático de requisição após ações suspeitas (securityCheck retorna allowed:false)
- [x] Botão "Marcar como Resolvido" nos alertas de segurança (com registro de quem resolveu)

## Controle de Acesso Rígido + Alertas WhatsApp
- [x] Só Master (afonsoqueirogagn@gmail.com) e Junior (buyer_senior) podem fazer mutations críticas (writeProcedure em 46 endpoints)
- [x] Demais usuários (compradores) são somente leitura — visualizam tudo, não alteram nada
- [x] Alertas de segurança por WhatsApp para (83) 99314-9365 com link direto wa.me
- [x] Aba WhatsApp na Central de Segurança com histórico de alertas e botão "Enviar WhatsApp"
- [x] Painel de gerenciamento de usuários e permissões em Configurações (somente Master)
- [x] Dropdown para alterar role de qualquer usuário (Somente Leitura / Comprador Sênior / Aprovador)

## Logs de Tentativa Bloqueada + Expiração de Sessão
- [x] Registrar no banco toda tentativa de mutation bloqueada (quem, o quê, quando, IP) como security_event tipo "blocked_mutation"
- [x] Gerar alerta WhatsApp imediato ao owner quando tentativa bloqueada ocorrer (link wa.me com detalhes)
- [x] Exibir tentativas bloqueadas na Central de Segurança (aba Alertas + aba WhatsApp)
- [x] Expiração de sessão após 8h de inatividade (JWT expira em 8h, cookie maxAge 8h)
- [x] Frontend: detectar sessão expirada e redirecionar automaticamente para /login

## IP Logging por Sessão
- [x] Registrar IP de cada login no banco (tabela login_sessions)
- [x] Detectar se mesmo usuário logou de IPs diferentes em menos de 1h
- [x] Gerar alerta WhatsApp ao owner quando detectar IPs múltiplos (possível compartilhamento de credenciais)
- [x] Exibir histórico de IPs por usuário na Central de Segurança (aba Sessões/IPs)

## Dashboard + Analytics: Reformulação Completa (Nível Enterprise)
- [x] Corrigir Saving Gerado (R$ 573K real: diferença entre maior preço cotado vs preço comprado)
- [x] Remover cotações canceladas do Dashboard (só mostra abertas/pedido gerado)
- [x] Corrigir alertas pendentes (removidos do Dashboard principal)
- [x] Dashboard: KPIs reais (Saving R$573K, Total Comprado R$200K, Cotações 4, Fornecedores 71)
- [x] Dashboard: Gráfico Volume de Compras por Mês (BarChart)
- [x] Dashboard: Gráfico Itens por Categoria (PieChart donut)
- [x] Dashboard: Top 5 Fornecedores por Volume (ranking com valores)
- [x] Dashboard: Cotações Ativas (só abertas/em andamento)
- [x] Analytics: Reformulação completa com gráficos profissionais (Recharts)
- [x] Analytics: Saving Acumulado (AreaChart)
- [x] Analytics: Ranking de Fornecedores por Volume (BarChart horizontal)
- [x] Analytics: Distribuição por Categoria (PieChart donut + legenda)
- [x] Analytics: Gasto por Unidade/Obra (BarChart)
- [x] Analytics: Índice de Preços por Categoria (AreaChart com filtro)
- [x] Analytics: Top Produtos — Histórico de Preço (tabela com tendência)

## Saving Real: Economia 3D Baseada em Produto+Marca
- [x] Adicionar coluna `brand` na tabela price_history
- [x] Backfill brand a partir de proposal_items existentes
- [x] Atualizar recordPrice e recordPriceBatch para incluir brand
- [x] Atualizar todos os pontos de inserção (proposal, order, order_adjusted, manual)
- [x] Implementar Saving por Negociação: preço anterior vs atual do MESMO produto+marca
- [x] Implementar Saving por Cotação Competitiva: 2º melhor preço vs preço comprado
- [x] Implementar Saving vs Média Histórica: preço pago vs média histórica do item
- [x] Expor 3 dimensões de saving no Dashboard KPIs (savingNegociacao, savingCompetitiva, savingMedia)
- [x] Expor 3 dimensões de saving no Analytics
- [x] Redesenhar Analytics com 3 cards de saving + donut de composição
- [x] Adicionar mini-cards de breakdown no Dashboard Home
- [x] Top Produtos com coluna Marca na tabela de evolução
- [x] Filtrar "Sem unidade" do gráfico Gasto por Unidade

## Fix: Sessão Expirada Imediatamente Após Login
- [x] Diagnosticar causa: cookie SameSite=None sendo bloqueado por Safari ITP/iOS
- [x] Corrigir sameSite de "none" para "lax" em cookies.ts
- [x] Aumentar sessão de 8h para 10h conforme solicitado
- [x] Atualizar teste auth.logout.test.ts para refletir novo sameSite

## Permissão: Estoque Insuficiente para Junji
- [x] Dar acesso ao botão "Estoque Insuficiente - Redirecionar para 2º melhor preço" para frotas.patrimonio@qualities.com.br
- [x] Backend já tinha permissão (allowedEmails) — confirmado
- [x] Frontend atualizado: canRedirect inclui email do Junji

## Reestruturação de Permissões (Sprint)
- [x] Dar a Luiz Antonio jr (buyer_senior): Excluir pedido, Editar preço unitário no pedido, Excluir cotação, Substituir itens na cotação
- [x] Compradores comuns: somente visualização (não podem criar, editar, excluir, enviar — só ver)
- [x] Backend: atualizar todas as permission checks
- [x] Frontend: esconder botões de ação para compradores comuns

## Trocar Marca no Pedido Fechado (Ideia Júnior)
- [x] Backend: mutation orders.swapBrand (itemId, orderId, newBrand, newUnitPrice, justification)
- [x] Permissão: somente ADM Master e buyer_senior
- [x] Frontend: coluna Marca na tabela de itens + botão "Trocar" roxo em cada item
- [x] Frontend: dialog com Nova Marca, Novo Preço, Justificativa + indicação de economia/gasto
- [x] Registrar log de auditoria com marca anterior, nova marca, preço anterior, novo preço
- [x] Atualizar price_history com a nova marca/preço
- [x] DB: coluna brand adicionada em purchase_order_items + backfill

## Banco de Marcas + Autocomplete (Ideia Júnior)
- [x] Criar tabela brand_registry (productName, brand, supplierId, supplierName, sector, lastUsedAt, usageCount)
- [x] Auto-registrar marca em toda entrada: proposta enviada → registerBrand automático
- [x] Endpoint autocomplete: ao digitar 2+ letras, sugerir marcas já usadas para aquele produto
- [x] Integrar autocomplete no campo marca do portal do fornecedor (BrandAutocomplete)
- [x] Integrar autocomplete no dialog de Trocar Marca (Pedidos)
- [x] Aba "Histórico por Produto" na página Marcas: tabela com produto, marca, fornecedor, usos, último uso
- [x] Filtros: por produto, fornecedor, unidade
- [x] Deduplicação: normalizar nome da marca (trim, uppercase) antes de registrar
- [x] Backfill brand_registry com dados existentes (proposal_items + price_history)

## Fix: Safari/iOS Login - GET /api/auth/set-session (Sprint Final)
- [x] Criar endpoint GET /api/auth/set-session no servidor
- [x] Verificar token JWT antes de setar cookie
- [x] Usar cookieOptions consistentes (SameSite=Lax, Secure, HttpOnly, 10h)
- [x] Login.tsx já chama o endpoint após login bem-sucedido
- [x] localStorage fallback já implementado (manus-auth-token)
- [x] Varredura completa do aplicativo pós-deploy

## Renomear Menus Histórico
- [x] Renomear "Cotações Feitas" → "Cotações Concluídas" no menu sidebar
- [x] Renomear "Pedidos Feitos" → "Pedidos Concluídos" no menu sidebar

## Fix: Sessão Expirando no Safari/iOS
- [x] Não limpar localStorage token quando cookie existe (manter ambos como backup)
- [x] Estender sessão de 10h para 7 dias (melhor UX mobile)
- [x] Garantir que Bearer token funciona como fallback quando cookie é purgado pelo ITP

## Fix: PWA iOS (standalone) não mantém cookies HttpOnly
- [x] Detectar modo standalone (window.matchMedia display-mode) no getAuthHeaders
- [x] Em modo standalone, SEMPRE enviar Bearer token do localStorage (ignorar cookies)
- [x] Garantir que o token é salvo no localStorage após login bem-sucedido

## Fix DEFINITIVO: PWA iOS cookie bug (form-login bypass)
- [x] Endpoint POST /api/auth/form-login → valida credenciais → 302 redirect /#token=XYZ
- [x] Login.tsx usa form submission nativa (bypassa cache de JS e bugs de cookie PWA)
- [x] Inline script no index.html lê token do hash e salva no localStorage antes do React
- [x] getAuthHeaders sempre envia Bearer do localStorage em modo standalone

## Ajustes Pedidos Maranguape - Compras Júnior (31/07/2026)
- [x] Corrigir AGUA SANITARIA de 25 para 36 no pedido PED-MS91BOY81-60001 (Sup. Oliveira)
- [x] Rebaixar qualitiesrefeicoescomercial@gmail.com de ADM Master para Comprador
- [x] Promover Ana Paula (paularibeiro@qualities.com.br) para Comprador Sênior
- [x] Analisar 14 notas fiscais das compras do Júnior para Maranguape (30/07/2026)
- [x] Cruzar notas com pedidos existentes no sistema
- [x] Criar/atualizar pedidos para ficarem idênticos às notas fiscais
- [x] Fechar cotações pendentes e gerar pedidos correspondentes

## Bugs Reportados 31/07 (iPad)
- [x] Adicionar filtro de data na tela de Pedidos
- [x] Corrigir dropdown de unidades para mostrar TODAS as unidades
- [x] Fix: ao abrir PDF do pedido e voltar, o app faz logout e não consegue relogar (loop login)

## Edição de Itens N/D na Cotação (Sprint atual)
- [x] Backend: procedimento addProposalItem para criar item de proposta em itens N/D
- [x] Frontend: botão "+ preço" nos itens N/D da tabela comparativa
- [x] Frontend: dialog de adição com preço unitário, embalagem, un/embalagem, marca, notas
- [x] Frontend: cálculo em tempo real no dialog (preço normalizado + total)
- [x] Permissão: apenas ADM Master e buyer_senior podem adicionar
- [x] Excluir cotação de teste COT-MS97IL53

## Perfil Restrito para Paula - Cotador (Sprint atual)
- [x] Backend: adicionar role 'cotador' no schema (enum de roles)
- [x] Backend: restringir procedures para cotador (só upload PDF + criar cotação + enviar)
- [x] Frontend: esconder menus/páginas não autorizados para cotador
- [x] Cadastrar Paula com role cotador

## Marcas Rejeitadas (Global + Regional)
- [x] Backend: criar tabelas brand_rejections (global) e brand_rejections_unit (por unidade)
- [x] Backend: procedures CRUD para gerenciar marcas rejeitadas
- [x] Frontend: UI na página Marcas para gerenciar rejeições globais e por unidade
- [x] Compra otimizada: filtrar marcas rejeitadas antes de escolher melhor preço

## Preferência Vó Ita (3%)
- [x] Backend: regra na compra otimizada - se Vó Ita estiver até 3% mais cara, ela ganha
- [x] Remover critério genérico de 3% a prazo vs à vista para outros fornecedores
- [x] Regra aplica para todas as unidades que Vó Ita atende

## Fix: Páginas restritas não mostram "Não Autorizado"
- [x] Configurações: redireciona para / silenciosamente em vez de mostrar "Acesso Negado"
- [x] Auditoria: redireciona para / silenciosamente em vez de mostrar "Acesso Restrito"
- [x] Cotador: menus não autorizados simplesmente não aparecem (sem mensagem de erro)

## Promover Júnior + Edição Completa de Pedidos Aprovados
- [x] Promover Luiz Antônio Júnior para ADM Master (mesmas permissões do Afonso)
- [x] Backend: procedure para editar item de pedido (preço, quantidade, unidade, nome)
- [x] Backend: procedure para excluir item de pedido
- [x] Backend: procedure para adicionar novo item ao pedido (nome, qtd, unidade, preço, marca digitável)
- [x] Frontend: no modal de itens do pedido (olhinho), permitir editar preço/qtd/unidade/nome inline
- [x] Frontend: botão excluir item no modal
- [x] Frontend: botão adicionar item com formulário (nome, qtd, unidade, preço, marca livre)
- [x] Recalcular total do pedido após edições
- [x] Permissão: apenas ADM Master + admin pode editar pedidos aprovados

## Análise de Retroalimentação Histórica do Fortes
- [x] Analisar o PDF de contas a pagar do Fortes e mapear todos os campos disponíveis
- [x] Avaliar quais dados do Fortes podem alimentar retroativamente o QualiCompras
- [x] Identificar lacunas para medir economia histórica, evolução de preços e savings reais
- [x] Definir estratégia prática de importação retroativa e estrutura mínima necessária

# Observações adicionais do PDF visto até agora
As páginas 1 a 8 aparentam ser um índice/listagem de documentos por código e unidade, sem detalhamento financeiro visível nessas páginas.

| Campo visível | Evidência inicial |
|---|---|
| Código | Numeração longa por documento |
| Estabelecimento | Nome da empresa + unidade |
| Sigla | Unidade abreviada |

As unidades vistas até agora incluem Fortaleza, Luís Gomes, Cocallinho/Cocalinho, Maranguape, Ipaumirim e Campo Grande.


## Fase 1: Importação Histórico Financeiro (Contas a Pagar Fortes)
- [x] Parsear PDF e extrair registros em CSV (fornecedor, valor, data, unidade, nome_fantasia)
- [x] Criar tabela historical_payments no banco
- [x] Importar os dados via script (332 registros de alimentos - Maio/2026)
- [x] Limpar dados não-alimentícios (combustível, energia, transporte, serviços, PF)
- [x] Backend: procedures para consultar dados históricos (summary, topSuppliers, list)
- [x] Frontend: página "Histórico de Compras" com dashboard gerencial completo
- [x] Curva ABC de fornecedores (A=80%, B=15%, C=5%) com HHI
- [x] Timeline de gastos diários + distribuição por unidade
- [x] Filtro por unidade + tabela detalhada
- [x] Adicionado à navegação do DashboardLayout

## Painel Comparativo: Fortes vs. QualiCompras
- [x] Backend: procedure que calcula gasto/dia normalizado do Fortes (baseline)
- [x] Backend: procedure que calcula gasto/dia dos pedidos QualiCompras por mês
- [x] Backend: cruzamento por fornecedor (mesmo fornecedor, antes vs. depois)
- [x] Frontend: aba "Fortes vs QualiCompras" na página Histórico de Compras
- [x] Barra visual: gasto diário normalizado (Fortes baseline vs. QualiCompras real)
- [x] Indicador de economia mensal estimada (R$ e %)
- [x] Tabela comparativa por fornecedor (gasto/dia antes vs. depois + variação %)
- [x] Legenda clara: "Período Fortes (sem QualiCompras)" vs. "Período QualiCompras (cotação centralizada)"
- [x] Atualização automática conforme novos pedidos são aprovados

## Bug: Modal de envio WhatsApp não aparece para cotador (Paula)
- [x] Investigar por que o modal com links de envio não abre após criar cotação (role cotador)
- [x] Garantir que sendToSuppliers funcione para cotador
- [x] Corrigir e testar

## Importação PDF Queiroz Galvão (Relatório de Entradas Abr-Jul/2026)
- [x] Parser PDF: extrair 565 lançamentos e 1896 itens (pdftotext + regex Python)
- [x] Filtrar transferências internas (54 lançamentos QUALITIES excluídos)
- [x] Mapear 21 fornecedores para IDs no banco (15 existentes + 6 novos criados inativos)
- [x] Importar 1829 itens para price_history (source=fortes_entradas_queiroz)
- [x] Importar 511 lançamentos para historical_payments (batch=queiroz_entradas_abr_jul_2026)
- [x] Validação: 182 produtos únicos, 21 fornecedores, R$ 664.462 total, período 01/04-31/07/2026

## Inteligência de Compras — Importação Enriquecida + Dashboard Analítico
- [x] Auditoria: confirmar que importação Queiroz anterior não contém entradas internas QUALITIES
- [x] Schema: adicionar campos sector, weekNumber, weekLabel à tabela price_history
- [x] Parser enriquecido: extrair setor, marca, semana dos 3 PDFs (Queiroz, Campo Grande, Cocalinho)
- [x] Importação completa: 1311 itens (3 unidades) com dados enriquecidos em price_history
- [x] Importação: 404 lançamentos em historical_payments (source=fortes_pdf)
- [x] Limpeza: remover dados antigos sem enriquecimento (1829 registros fortes_entradas_queiroz)
- [x] 42 novos fornecedores criados (inativos) para rastreabilidade
- [x] Backend: 8 procedures tRPC (summary, priceIndex, seasonality, unitComparison, supplierBySector, abcCurve, weeklyEvolution, searchProducts)
- [x] Frontend: página Inteligência de Compras com 6 painéis analíticos (Índice Preços, Sazonalidade, Comparativo Unidades, Fornecedor x Setor, Curva ABC, Evolução Semanal)
- [x] Filtros globais: por unidade e por setor
- [x] Navegação: item "Inteligência Compras" adicionado ao menu lateral
- [x] Validação: 51 testes passando, 0 erros TypeScript

## Importação Fortaleza + Ipaumirim + Maranguape + Melhorias Analytics
- [x] Parsear PDF Fortaleza (2.726 itens, R$ 1.007.012)
- [x] Parsear PDF Ipaumirim (1.589 itens, R$ 1.006.423)
- [x] Parsear PDF Maranguape (2.205 itens, R$ 1.498.684)
- [x] Importar Fortaleza no banco (price_history + historical_payments)
- [x] Importar Ipaumirim no banco
- [x] Importar Maranguape no banco (16 fornecedores novos criados)
- [x] Gráfico Curva ABC (Pareto) - Diagrama com barras coloridas por classe + linha % acumulado
- [x] Comparativo por Unidade com alertas de discrepância (>20% acima da média)
- [x] Atualizar header para 6 unidades
- [x] Volume total: R$ 4.516.443 | 398 produtos | 71 fornecedores | 6 unidades
- [x] 51 testes passando, 0 erros TypeScript

## Importação Uiraúna
- [x] Parsear PDF Uiraúna (1.984 itens, 596 NFs, R$ 764.885, 26 fornecedores)
- [x] Excluir 683 entradas internas QUALITIES (sobras Gastro)
- [x] Importar no banco (price_history + historical_payments)
- [x] 17 novos fornecedores criados (inativos)
- [x] Total no sistema: 7 unidades, 11.204 itens, R$ 9,3M volume

## Bug Fix: Trocar fornecedor no ajuste
- [x] Corrigir erro "Fornecedor não encontrado (índice NaN)" ao trocar item de fornecedor no modo ajuste — _originalKey não era injetado quando não havia ajustes prévios
- [x] Remover regra de preferência Roniclei para Palitos (a pedido do usuário)
- [x] Correção DEFINITIVA do bug NaN: substituir sistema de chaves posicionais (suppIdx-itemIdx) por quotationItemId estável em todo o fluxo de ajuste (buildAdjustedSuppliers, dropdown onValueChange, confirmAdjustment, resumo de ajustes)
- [x] Atualizar header Inteligência de Compras de "6 unidades" para "7 unidades" (Uiraúna adicionada)

## Formato do PDF de Pedido + Compras de Urgência
- [x] Corrigir formato confuso de quantidade no PDF do pedido: remover "(1un/cx)" quando unitsPerPackage=1, mostrar apenas número limpo
- [x] Corrigir exibição na tela de otimização: ocultar info de embalagem quando unitsPerPackage=1
- [x] Cadastrar fornecedor Mais Top Embalagens (Naldo, CNPJ 27.380.701/0001-50, Cajazeiras-PB)
- [x] Registrar compra de urgência Mais Top para Ipaumirim (R$335 - Copo Cristalcopo, Filme PVC, Hamburgueira Ultratherm, Palito Inoven)
- [x] Ajustar pedido Roni Ipaumirim descontando itens comprados do Mais Top
- [x] Rejeitar globalmente marcas 5X22 (Saco Talher) e Parana (Filme PVC) que não atendem Queiroz
- [x] Trocar Saco Talher de Oliveira→Bom Preço e Filme PVC de Bom Preço→Oliveira (marca EST)
- [x] Trocar Perflex de Oliveira→Casa das Embalagens (marca Inove, R$98) na cotação 1140001

## Campo Peso/CX Contextual no Portal do Fornecedor
- [x] CotacaoPublica.tsx: Step ③ mostra "Quantos KG vêm em cada caixa?" quando item.unit = KG/kg
- [x] CotacaoPublica.tsx: Opções reduzidas para pesos comuns (1-50) quando item é KG
- [x] CotacaoPublica.tsx: Alerta vermelho quando fornecedor seleciona 1 KG por caixa (provável erro)
- [x] CotacaoPublica.tsx: Resumo mostra "Preço por KG" ao invés de "Preço por unidade" para itens KG
- [x] CorrecaoPreco.tsx: Mesma lógica contextual aplicada na tela de correção de preço
- [x] Instruções atualizadas para mencionar KG/peso
- [x] Corrigir dados Vó Itá/DSG: packagingType alterado de "caixa" para "unidade" nos itens de proteína

## Sistema de Preferência de Fornecedores e Desempate na Compra Otimizada
- [x] Criar tabela preferred_suppliers no banco de dados
- [x] Inserir Vó Itá (ID 60003) e Roni (ID 60007) como preferenciais com 3% de tolerância
- [x] Adicionar helper getPreferredSuppliers(unitId) no server/db.ts
- [x] Refatorar lógica de otimização: substituir hardcode "isVoIta" por consulta à tabela preferred_suppliers
- [x] Implementar cascata de desempate: pagamento → prazo → marca (manual) → volume
- [x] Adicionar unresolvedTies no retorno da otimização para empates de marca
- [x] Implementar UI de resolução de empates no CotacaoDetalhe.tsx (card amber com botões de escolha)
- [x] Adicionar card de fornecedores preferenciais na tela de resultado da otimização (emerald)
- [x] Criar procedures CRUD (preferredList, addPreferred, removePreferred) no suppliers router
- [x] Implementar UI de administração de preferenciais na página Fornecedores (card com chips + select para adicionar)
- [x] Todos os 51 testes passando sem erros

## Separação de Setores e Filtro na Lista de Cotações
- [x] Separar "Limpeza e Descartáveis" em dois setores: "Limpeza" e "Descartáveis"
- [x] Atualizar CATEGORIAS_COMPRAS em Fornecedores.tsx (remover duplicados, adicionar Hortifruti correto)
- [x] Atualizar SECTOR_OPTIONS em Cotacoes.tsx e Requisicoes.tsx
- [x] Atualizar categories em Analytics.tsx e ComparativoFornecedores.tsx
- [x] Atualizar sectorKeywords no server (busca de fornecedores)
- [x] Migrar fornecedores existentes no banco (SQL REPLACE)
- [x] Adicionar filtro de setor na lista de cotações (Cotacoes.tsx) funcionando com unidade + status
- [x] Verificar que pedidos já mostram período e setor (extraídos do título da cotação)
- [x] Verificar que monthlyReport.ts já separa Limpeza de Descartáveis

## Edição de Itens no Comparativo por Produto
- [x] Expandir endpoint editItem para aceitar productName, justification obrigatória, e registrar valores antigos na auditoria
- [x] Criar getQuotationItem helper no db.ts para buscar valores antigos antes de editar
- [x] Expandir updateQuotationItem para aceitar productName
- [x] Adicionar canEditItems (só Master + Luiz Jr) no frontend
- [x] Adicionar ícone de lápis na coluna Produto do Comparativo por Produto
- [x] Criar modal de edição com campos: Nome, Quantidade, Unidade, Unidades/Embalagem (condicional), Justificativa obrigatória
- [x] Recálculo automático dos totais após edição (invalidate queries)
- [x] Todos os 51 testes passando

## Badge Editado + Bloqueio de Edição
- [x] Criar endpoint itemEdits para buscar histórico de edições por cotação
- [x] Bloquear edição no backend quando cotação está com status "ordered"
- [x] Badge amber "Editado" ao lado de itens alterados no Comparativo por Produto
- [x] Tooltip no badge mostrando quem/quando/justificativa da última edição
- [x] Ocultar ícone ✏️ quando cotação tem pedidos gerados (status ordered)
- [x] Todos os 51 testes passando

## Bug Fix: Cálculo de Total com Embalagem (Caixa/Fardo)
- [x] Corrigir fórmula no servidor (editProposalItem): totalPrice = normalizedPrice × qty (não unitPrice × qty)
- [x] Corrigir fórmula no servidor (addProposalItem): mesmo fix
- [x] Corrigir fórmula no CotacaoPublica.tsx (handleSubmit): normalizar preço antes de calcular total
- [x] Corrigir display no CotacaoPublica.tsx (resumo): usar pricePerUnit × qty
- [x] Corrigir display no CotacaoDetalhe.tsx (modal editar): mostrar caixas necessárias e total correto
- [x] Corrigir display no CotacaoDetalhe.tsx (modal adicionar): mesmo fix
- [x] CorrecaoPreco.tsx já usava normalizedPrice × qty (correto)

## Sistema de Compatibilidade Fornecedor×Item (Incompatibilidade Automática)
- [x] Tabela supplier_item_compatibility criada (CRUD completo)
- [x] Campo supplierType adicionado à tabela suppliers (supermercado/atacado/distribuidor/fabricante/cooperativa/outro)
- [x] Herança automática por tipo: quando supplierType === 'supermercado', itens MARMITA, HAMBURGUEIRA, PALITO, PERFLEX, SACO DE LIXO, FILME PVC, LUVA, TOUCA, GUARDANAPO são bloqueados automaticamente na compra otimizada
- [x] Alerta visual na compra otimizada: card laranja expansível "X opção(ões) excluída(s) por incompatibilidade" com detalhes
- [x] Oliveira e Bom Preço classificados como 'supermercado' no banco
- [x] UI de compatibilidade em cada card de fornecedor (página Fornecedores)
- [x] Seletor de tipo de fornecedor no modal de edição
- [x] Sugestão automática de categorias baseada no histórico de cotações
- [x] Seção "Ver itens cotados por categoria" no card expandido de fornecedor
- [x] Reabertura de cotação restrita a Afonso (ADM Master) e Luiz Antonio Jr
- [x] Badge "Reaberta" com data, nome e contador nos cards de cotação
- [x] Setores Limpeza e Descartáveis separados em todo o app
- [x] Filtro de setor na lista de cotações funcionando com unidade + status
- [x] Edição de itens no Comparativo por Produto (nome, qtd, unidade) com justificativa obrigatória
- [x] Badge "Editado" com tooltip (quem/quando/motivo) + bloqueio quando ordered
- [x] Período de consumo em todos os pedidos (badge azul + PDF)
- [x] Campo Peso/CX contextual no portal do fornecedor (quando unidade é KG)
- [x] Fix: cálculo total com embalagem (normalizedPrice × qty)
- [x] Fix: BigInt serialization em queries de compatibilidade
- [x] Fix: pool.query → database.execute() no Drizzle
- [x] Fix: NaN no ajuste de fornecedor (chaves por quotationItemId)
- [x] Header Inteligência de Compras dinâmico (mostra contagem real do banco)
- [x] Revisão completa do aplicativo: login, dashboard, cotações, pedidos, fornecedores, inteligência — tudo funcional
- [x] 51 testes passando, 0 erros TypeScript

## Ajuste de Entrega com Justificativa + Foto NF
- [x] Remover FILME PVC do pedido PED-MSOOD2051-240001 (Roni, Queiroz, Descartáveis)
- [x] Criar tabela order_delivery_adjustments no banco
- [x] Endpoint POST /api/upload-invoice para upload de foto da NF (S3, max 5MB, JPEG/PNG/WEBP)
- [x] Procedure orders.adjustDelivery: remover item ou reduzir quantidade com justificativa + foto obrigatória
- [x] Procedure orders.listAdjustments: histórico de ajustes por pedido
- [x] Validação: não pode aumentar quantidade (só diminuir), justificativa mín 10 chars, foto obrigatória
- [x] Permissão: apenas ADM Master e admin/buyer_senior
- [x] Botão tesoura (Ajustar Entrega) ao lado de cada item no pedido expandido
- [x] Dialog completo: tipo (remover/reduzir), nova quantidade, justificativa, upload de foto com preview
- [x] Recálculo automático do total do pedido após ajuste
- [x] Audit log registrando cada ajuste
- [x] Fix: validação de email removida do cadastro de fornecedores (aceita qualquer string)
- [x] 51 testes passando, 0 erros TypeScript

## Vínculo Multiunidade de Fornecedores
- [x] Backend: rota syncUnits com permissão exclusiva Master/Júnior
- [x] Backend: proteção contra duplicidade supplierId+unitId
- [x] Frontend: substituir seletor singular por checkboxes multiunidade
- [x] Frontend: dados por unidade (responsável, escriturário) para cada unidade marcada
- [x] Frontend: visibilidade dos controles apenas para Master/Júnior
- [x] Auditoria: registrar unidades adicionadas/removidas
- [x] Gerar PDFs dos pedidos corrigidos da cotação 1890003 (Casa das Embalagens 2310001 e Oliveira 2310002)

## Edição Rápida de Códigos Fortes
- [x] Botão de edição rápida na lista de fornecedores para inserir códigos Fortes sem abrir perfil completo
- [x] Visível apenas para Master, Júnior e Paula
- [x] Backend: rota updateFortesCode + getFortesCode
- [x] Reforçar no backend a permissão exclusiva de Afonso, Júnior e Paula para rotas de códigos Fortes

## Varredura de Códigos Fortes Pendentes
- [x] Mapear fornecedores ativos sem código Fortes 0032 ou 0034 e apresentar a relação ao Afonso

## Correção do Comparativo e PDFs de Pedido
- [x] Unificar o destaque verde do comparativo à seleção elegível da Compra Otimizada
- [x] Exibir de forma inequívoca a proposta não elegível e seu motivo de bloqueio
- [x] Recalcular distribuição e cenário ideal somente com opções elegíveis
- [x] Separar PDF comercial do fornecedor do relatório interno confidencial
- [x] Adicionar valor de referência (último preço) ao lado da porcentagem de variação no comparativo
- [x] Validar regras, PDFs e responsividade antes de publicar

## Reupload PDF — Exclusivo Master
- [x] Recolocar botão Reupload PDF na cotação, visível apenas para conta Master

## Simplificação Cotação + Vírgula nos Preços
- [x] Remover seção "Cenários de Custo desta Compra" (Pior/Intermediário/Ideal + economia + barras)
- [x] Unificar botão "Executar Compra Otimizada" — manter apenas o do topo (segundo botão removido junto com cenários)
- [x] Aceitar vírgula como separador decimal nos preços do portal do fornecedor (já funcionava — campo aceita "3,48" e "3.48")
- [x] Teclado do fornecedor mudado para inputMode="text" para garantir vírgula em iPad/iPhone

## Separação Limpeza / Descartáveis
- [x] Corrigir detecção de categoria no parser de PDF do Fortes — agora detecta Limpeza e Descartáveis separadamente
- [x] Corrigir 10 cotações históricas que tinham "Limpeza e Descartáveis" juntos — separadas por conteúdo real dos itens

## Notificação de Edições + Quantidade Exclusiva Master
- [x] Restringir alteração de quantidade do item solicitado apenas à conta Master
- [x] Notificar Master (sino + push) quando Júnior editar itens de cotação

## Notificações Auto-Lidas + Dashboard Enxuto + Preços Multiplataforma
- [x] Sino: marcar notificações como lidas ao abrir o popover (badge zera ao fechar)
- [x] Remover card Cotações Ativas do Dashboard
- [x] Módulos fantasma já removidos do menu lateral (confirmado)
- [x] Desabilitar campo de quantidade no frontend para Júnior (somente leitura)

## Auditoria Corporativa — Motor Centralizado (18/08/2026)
- [x] Criar função centralizada `auditSensitiveAction()` com 3 níveis: info (log), warning (log + sino Master), critical (log + sino + email Master)
- [x] Instrumentar `createSupplier` com severity warning
- [x] Instrumentar `updateSupplier` com severity warning (quando supplierType muda)
- [x] Instrumentar `updateFortesCode` com severity warning (remover createAuditLog duplicado)
- [x] Instrumentar `adjustDelivery` com severity dinâmica (>20% do pedido = critical)
- [x] Instrumentar `reopenQuotation` com severity dinâmica (>2 reaberturas = critical)
- [x] Adicionar `supplierType` ao schema Zod do update supplier
- [x] Aviso visual no modal de ajuste de entrega (Pedidos.tsx): "Todas as ações são registradas na auditoria corporativa"
- [x] Aviso visual no modal de edição de fornecedor (Fornecedores.tsx): "Alterações registradas na auditoria corporativa"
- [x] Lápis de edição de itens visível apenas para Master (Júnior não vê)
- [x] Campo de quantidade invisível para Júnior (não desabilitado — invisível)
- [x] Notificação ao Master quando Júnior editar nome de item (sino + email via Gmail MCP)
- [x] Preferências de notificação restritas ao Master
- [x] TypeScript: 0 erros
- [x] Painel de Auditoria `/auditoria` (Entrega 2 — prioridade baixa)
- [x] Fluxo de compra emergencial (Entrega 2 — prioridade baixa)
- [x] Verificação de integridade: após generateOrdersFromOptimization, comparar quantidades vs Fortes (Entrega 2)

## Bug: Header sobrepõe status bar no iOS (18/08/2026)
- [x] Título "Pedidos de Compra" sobe e sobrepõe o relógio/status bar do iOS ao rolar a página
- [x] Garantir que o header fixo respeite safe-area-inset-top em todas as páginas

## Fluxo de Compra Emergencial (18/08/2026)
- [x] Criar tabela emergency_purchase_requests no schema + migration
- [x] Backend: procedure analyzeInvoicePhoto (leitura de NF via LLM Vision gpt-5-mini)
- [x] Backend: procedure requestEmergencyPurchase (solicitação com envio de e-mail ao Master)
- [x] Backend: endpoints REST /api/emergency/approve/:token e /api/emergency/reject/:token
- [x] Frontend: botão "Compra Emergencial" na página de Pedidos (Master + Júnior)
- [x] Frontend: dialog multi-step (upload NF → revisão déficit → fornecedor+preços → justificativa)
- [x] Frontend: badge EMG laranja nos pedidos emergenciais
- [x] Labels de auditoria para ações emergenciais
- [x] CSV Fortes funciona automaticamente (pedido EMG é purchase_order normal)
- [x] Relatório detalhado das mudanças do dia para o Afonso
- [x] Painel de Auditoria `/auditoria` (Entrega 2 — prioridade baixa)

## Classificação de Marcas — Controle de Acesso e Auditoria (18/08/2026)
- [x] Classificação de marcas visível APENAS para Master e Júnior (invisível para todos os outros)
- [x] Justificativa obrigatória ao mudar status para "rejeitado" (aprovado→rejeitado ou desconhecida→rejeitada)
- [x] Aviso visual claro de que tudo fica registrado na auditoria corporativa
- [x] Audit log de cada mudança de classificação com justificativa

## Portal do Fornecedor — Remover Info Interna (18/08/2026)
- [x] Remover seção "COMO PREENCHER" do portal do fornecedor (expõe lógica interna)
- [x] Remover seção "COMO PREENCHER" do portal do fornecedor (expõe lógica interna)
- [x] Esconder menu Marcas para usuários que não são Master/Júnior
- [x] Relatório detalhado das mudanças do dia para o Afonso

## Remanejamento Automático + Rejeições de Marca + Permissões (19/08/2026)
- [x] Schema: tabelas order_item_remanagements e brand_aliases criadas (migration 0019)
- [x] Backend: funções resolveBrandWithAliases, resolveBrandsWithAliases, isBrandRejectedWithAliases, createRemanejamento no db.ts
- [x] Backend: procedures remanejamento.preview e remanejamento.confirm no routers.ts
- [x] Frontend: botão Repeat2 de remanejamento no Pedidos.tsx (visível para pedidos com cotação, status approved/sent/purchased)
- [x] Frontend: modal multi-step (qtd disponível → preview alternativa → justificativa → resultado)
- [x] Alias COGRAN → CONGRAN inserido na tabela brand_aliases
- [x] getBrandRejectionBatch atualizado para resolver aliases antes de verificar rejeição
- [x] Permissões fechadas: excluir cotação → Master only
- [x] Permissões fechadas: reupload PDF (replaceItems) → Master only
- [x] Permissões fechadas: excluir pedido → Master only
- [x] TypeScript: 0 erros

## Júnior Altera Quantidade no Pedido Gerado (19/08/2026)
- [x] Backend: desbloquear edição de quantidade para buyer_senior com justificativa obrigatória (mín 10 chars)
- [x] Backend: alerta crítico (e-mail + notificação) ao Master somente quando variação > 20%
- [x] Backend: variação ≤ 20% apenas registra audit log sem notificação
- [x] Frontend: Júnior clica na quantidade para editar diretamente (mesmo comportamento do Master)
- [x] Frontend: modal de justificativa obrigatória ao confirmar alteração
- [x] Frontend: removido botão "Solicitar Alteração" de quantidade para Júnior (não precisa mais de aprovação)
- [x] TypeScript: 0 erros
