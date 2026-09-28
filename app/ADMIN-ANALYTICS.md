# Admin analytics do Brains

Implementado em 24/09/2026 no app existente (React, Vite, React Router e Supabase). Publicação do frontend autorizada em 28/09/2026, pelo fluxo GitHub → Vercel. As três migrations incrementais de `supabase/migrations/` já foram aplicadas ao projeto `rtbfieorpmevebwlquvs`.

## Acesso

Rotas: `/admin`, `/admin/funnel`, `/admin/users`. Sem sessão, vão a `/login?next=admin`; após o login nessa tela, retornam a `/admin`. O login comum (`/login`) continua levando a Hoje (`/home`), inclusive para administradores. O único destino alternativo aceito é o marcador literal `next=admin`, sem URLs arbitrárias. Contas comuns recebem “Acesso restrito” no Admin. Cada consulta administrativa verifica novamente `auth.users.raw_app_meta_data.role = 'admin'` no banco, com `auth.uid()`. Alterar `user_metadata` não concede acesso. Nenhuma service_role é usada pelo frontend.

A conta indicada pelo proprietário recebeu o papel admin em 24/09/2026. A alteração preservou as demais chaves de `raw_app_meta_data`, sem alterar senha, sessão ou biblioteca. Outras atribuições devem ser feitas exclusivamente pelo backend/dashboard; nunca por `user_metadata`.

O gráfico de crescimento permite alternar entre Colunas e Linhas para Contas, Áreas e Baralhos. A escolha permanece ao trocar métrica ou período na tela, sem mudar os valores ou a tabela acessível.

## Fontes e decisões

- Contas e e-mails: `auth.users`. Não há nome no schema/metadados atuais; e-mail identifica o usuário.
- Áreas, baralhos, cards e revisões: o documento existente em `brains_cloud`. As tabelas antigas `brains_areas`, `brains_reviews` etc. estão vazias e não são a fonte do app atual.
- Totais de áreas/baralhos/cards excluem registros na lixeira (`deleted`), mas incluem arquivados.
- Baralhos são registros internos de compatibilidade; a interface atual organiza estudo por áreas. Essa distinção aparece no Admin.
- Cards e revisões usam `createdAt` e `at` já existentes. Não há cópia dos conteúdos ou duplicação desses eventos.
- Áreas/baralhos não tinham data de criação. Um trigger somente observa IDs novos e registra `area_created`/`deck_created`. Bibliotecas antigas não foram alteradas nem receberam datas inventadas. Importações são contadas na primeira observação do registro. O histórico desconhecido é omitido do gráfico.
- A captura é best-effort: falhas de analytics registram apenas SQLSTATE no log e não impedem salvamentos da biblioteca.

## Métricas

DAU: únicos com criação de área, baralho ou card, ou revisão, no dia de Brasília. WAU/MAU: mesmos eventos nos últimos 7/30 dias de calendário, incluindo hoje. Page views e login não são atividade de estudo. Os três indicadores mantêm janelas fixas; o filtro afeta crescimento, ativos do período, funil e page usage. Padrão: 30 dias.

O funil exige Landing → Login → Autenticação → Home, em ordem e dentro do período. Home direto não entra. IDs anônimos aleatórios são persistidos no navegador. O coletor deriva a conta de `auth.uid()` e impede vincular o mesmo ID a outra conta autenticada. A consulta associa a jornada anônima à conta e deduplica contas entre navegadores. Não se pode reconhecer a mesma pessoa anônima em dispositivos diferentes; bloqueio/limpeza do armazenamento também limita associação.

`login_completed` representa passagem autenticada pela rota de login (cadastro, login ou sessão já válida). Contas criadas são medidas em `auth.users`; eventos adicionais de signup não são necessários nesta versão. Views só aceitam rotas permitidas, sem parâmetros, fragmentos, referrers ou conteúdo. Rotas de áreas individuais viram `/areas`.

Page usage diferencia visitas de usuários autenticados únicos. “Dos ativos” é a interseção entre visitantes da página e usuários com atividade real no período, dividida pelos ativos. Sem denominador, mostra “—”.

Exclusão definitiva de cards/revisões remove o histórico da fonte original; não há retenção paralela de conteúdo ou histórico pessoal. Datas inválidas são ignoradas nas agregações. Último login e última atividade de produto aparecem separados no drawer.

## Segurança e desempenho

`brains_admin` não é schema exposto. Tabelas de eventos/configuração têm RLS habilitada e nenhum grant de leitura/escrita a clientes. Funções privilegiadas ficam no schema privado com `search_path` vazio, permissões explícitas e checagem administrativa antes da leitura; wrappers públicos são `security invoker`. O coletor público aceita apenas page view/autenticação, valida caminhos, tem chave idempotente e limite de 60 eventos/minuto por visitante. Não é uma solução antifraude: um cliente malicioso pode gerar novos IDs; nunca usar os eventos para decisões de segurança.

Agregação acontece no Postgres. A lista é paginada (25 contas), com busca no servidor, sem carregar bibliotecas no navegador e sem requisição por usuário. Índices cobrem tempo, visitante, usuário e deduplicação de criações. A arquitetura JSONB existente ainda implica examinar documentos para agregar atividade; se a base crescer muito, medir as consultas antes de adotar projeções/materialização.

Analytics fica desligado no desenvolvimento local para não contaminar a base. A landing continua leve: usa fetch e chave publicável, sem carregar o cliente Supabase. O código do Admin é carregado sob demanda.

## Verificação

- Build e TypeScript aprovados; 104 testes de aplicação aprovados.
- `supabase/admin-analytics-check.sql`: testes transacionais com conta fictícia e rollback. Cobre admin, revogação imediata de papel, negação de metadados editáveis, conta comum e anônimo, idempotência, períodos, caminhos, deduplicação entre navegadores, atividade real versus page views, criação de áreas/baralhos e ausência de duplicação ao mudar preferências.
- Conta comum também foi bloqueada visualmente na rota real `/admin` local.
- Prévia visual isolada em `.cache/admin-preview.html` (não incluída no build de produção), com dados demonstrativos. Navegação, período, drawer, copiar e-mail, Escape/foco e layout em 390px foram inspecionados.
- Totais antes/depois: 4 contas, 3 bibliotecas, 1 área, 1 baralho, 35 cards e 72 revisões. Nenhuma conta fictícia persistiu.
- Advisor de segurança: sem novo alerta de vulnerabilidade. Os dois avisos informativos de RLS sem políticas são intencionais nas tabelas privadas sem acesso direto. Há aviso preexistente de proteção contra senhas vazadas desativada, fora deste escopo: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Próximo passo e reversão

Publicar o frontend no fluxo existente do Brains após a revisão local. Publicação autorizada pelo proprietário em 28/09/2026. As novas visitas começam a ser coletadas quando o frontend atualizado for publicado; criações de áreas/baralhos já são observadas pelo trigger.

Reversão do frontend não altera bibliotecas. Se necessário desativar a captura de criações, remover somente o trigger `brains_analytics_creation`, mantendo as tabelas para revisão. Não restaurar, recriar ou sobrescrever `brains_cloud`, autenticação, mídia ou histórico dos usuários.
