# Ativação e comunicação do Brains

## Fonte dos dados

Esta extensão usa o Admin atual. `auth.users` fornece cadastro e e-mail; `brains_admin.analytics_events` fornece primeira área, visitas e sessão concluída; `brains_cloud.document` fornece cards, revisões e vencimentos. `brains_admin.activity` continua sendo a visão de criação/revisão. O novo `brains_admin.user_journey` só agrega essas fontes. Não há cópia de cards ou reviews.

A primeira área só tem data quando o trigger de analytics já a capturou. Um valor ausente permanece indisponível. Primeiro card e primeira revisão usam seus timestamps originais; os novos eventos de marco preservam a informação caso o conteúdo venha a ser removido. O hábito é calculado quando houve atividade de criação/revisão em cinco dias distintos numa janela de sete dias, mantendo o primeiro dia em que a condição se confirmou. Sessões concluídas não são inferidas retroativamente.

## Ativação no Admin

`/admin/activation` reutiliza a checagem administrativa do `/admin`. O filtro de período define uma coorte pela data de cadastro. O filtro de etapa/engajamento e a busca restringem a tabela, enquanto o funil e os cartões de visão geral representam a coorte inteira. A consulta é paginada no servidor. A linha do tempo combina cadastro, atividade existente, sessões concluídas e e-mails.

“Primeiro card após clique” usa o último clique antes do primeiro card em até sete dias. É uma relação temporal, não uma afirmação de causalidade. Aberturas detectadas não equivalem a leitura humana. Eventos de e-mail anteriores ao webhook não são inventados.

## Comunicação

O consentimento para e-mails de aprendizado é opt-in, separado dos e-mails essenciais de autenticação. O usuário pode desligá-lo em Configurações ou no link de descadastro. Bounces e reclamações desligam o consentimento. O Resend SMTP já usado pelo Supabase Auth continua independente; os novos envios de engajamento usam a API HTTP do Resend com chave de idempotência.

O cron da Vercel Hobby roda uma vez por dia, às 13:00 UTC (10:00 em Brasília), sujeito à precisão da plataforma. Ele reavalia elegibilidade imediatamente antes de enviar, limita a 20 mensagens por execução para preservar a cota gratuita compartilhada com a autenticação, aplica limite de um envio por usuário em 24 horas, três lembretes de revisão em sete dias e cooldown de sete dias para reengajamento. A ausência de consentimento, de configuração ou `ENGAGEMENT_ENABLED=false` resulta em zero envios. O webhook aceita somente assinatura Svix válida sobre o corpo original, grava eventos por ID de entrega e permite repetição sem duplicá-los.

## Ordem segura de ativação em produção

1. Revisar e aplicar a migração incremental `supabase/migrations/20261025180000_activation_journey.sql` no projeto correto. Ela não altera `brains_cloud` nem remove histórico.
2. Configurar na Vercel, somente no servidor: `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `CRON_SECRET` e `EMAIL_UNSUBSCRIBE_SECRET` (aleatório, estável). `SUPABASE_URL` pode usar o URL atual. Nunca prefixar esses segredos com `VITE_`.
3. No Resend, criar webhook para `https://www.heybrains.app/api/resend-webhook`, com eventos de envio, entrega, abertura, clique, bounce, reclamação e falha. Habilitar rastreamento de aberturas e cliques caso deseje essas métricas. A disponibilidade dos eventos depende da configuração e do cliente de e-mail.
4. Publicar frontend e funções **com `ENGAGEMENT_ENABLED=false`**. Validar Admin e consentimento com contas de teste, autenticação de um usuário comum, primeira área, primeiro card e revisão. Não acionar o cron manualmente em massa.
5. Depois de confirmar o webhook assinado e os contadores, definir `ENGAGEMENT_ENABLED=true`. Confirmar primeiro um único usuário que optou pelo recebimento e observar a cota do Resend. Desligar novamente se houver qualquer divergência.

Não registrar chaves no repositório ou no navegador. A migração não deve ser aplicada automaticamente sem revisão do schema de produção. O SMTP de recuperação de senha não é medido nessa aba; somente as campanhas de aprendizado criadas por esta extensão são associadas aos eventos do Resend.

## Verificação local

- `node node_modules/typescript/bin/tsc --noEmit`
- `node api/engagement.test.js`
- `npm run build` com Node compatível e permissão para executar o binário esbuild.

Os cenários de produção devem usar contas próprias de teste e nunca disparo em massa. Após a migração, validar consulta admin/negação a não administradores, eventos históricos, opt-in/opt-out, chave de idempotência, assinatura e replay do webhook e retorno orgânico sem atribuição.
