# Ativação e comunicação do Brains

## Fonte dos dados

Esta extensão usa o Admin atual. `auth.users` fornece cadastro e e-mail; `brains_admin.analytics_events` fornece primeira área, visitas e sessão concluída; `brains_cloud.document` fornece cards, revisões e vencimentos. `brains_admin.activity` continua sendo a visão de criação/revisão. O novo `brains_admin.user_journey` só agrega essas fontes. Não há cópia de cards ou reviews.

A primeira área só tem data quando o trigger de analytics já a capturou. Um valor ausente permanece indisponível. Primeiro card e primeira revisão usam seus timestamps originais; os novos eventos de marco preservam a informação caso o conteúdo venha a ser removido. O hábito é calculado quando houve atividade de criação/revisão em cinco dias distintos numa janela de sete dias, mantendo o primeiro dia em que a condição se confirmou. Sessões concluídas não são inferidas retroativamente.

## Ativação no Admin

`/admin/activation` reutiliza a checagem administrativa do `/admin`. O filtro de período define uma coorte pela data de cadastro. O filtro de etapa/engajamento e a busca restringem a tabela, enquanto o funil e os cartões de visão geral representam a coorte inteira. A consulta é paginada no servidor. A linha do tempo combina cadastro, atividade existente, sessões concluídas e e-mails.

“Primeiro card após clique” usa o último clique antes do primeiro card em até sete dias. É uma relação temporal, não uma afirmação de causalidade. Aberturas detectadas não equivalem a leitura humana. Eventos de e-mail anteriores ao webhook não são inventados.

## Comunicação

A preferência de e-mails de aprendizado começa marcada no cadastro e em Configurações para contas sem escolha salva. Uma escolha explícita de desativar permanece desativada. Os e-mails essenciais de autenticação continuam separados. O usuário pode desligar os e-mails de aprendizado em Configurações ou no link de descadastro; devoluções e reclamações também os desativam. O Resend SMTP já usado pelo Supabase Auth continua independente; os envios de aprendizado usam a API HTTP do Resend com chave de idempotência.

O cron da Vercel Hobby roda uma vez por dia, às 13:00 UTC (10:00 em Brasília), sujeito à precisão da plataforma. Ele reavalia elegibilidade imediatamente antes de enviar e aplica limite de um envio por usuário em 24 horas, três lembretes de revisão em sete dias e cooldown de sete dias para reengajamento. **A liberação geral continua bloqueada:** `ENGAGEMENT_RELEASE_UNLOCKED=false`. A versão de teste exige `ENGAGEMENT_ENABLED=true`, `ENGAGEMENT_RELEASE_APPROVED=true` e `ENGAGEMENT_TEST_RECIPIENT` configurado no servidor. O endereço configurado também precisa corresponder à impressão digital do único destinatário autorizado no código. O cron filtra os candidatos antes do processamento e considera no máximo um destinatário por execução. Sem essas condições, retorna sem enviar. O webhook aceita somente assinatura válida sobre o corpo original, grava eventos por ID de entrega e permite repetição sem duplicá-los.

## Ordem segura de ativação em produção

1. Revisar e aplicar a migração incremental `supabase/migrations/20261025180000_activation_journey.sql` no projeto correto. Ela não altera `brains_cloud` nem remove histórico.
2. Configurar os segredos necessários somente no servidor, conforme `.env.example`. Nunca prefixar segredos com `VITE_`.
3. Configurar o webhook assinado para eventos de entrega, abertura, clique, devolução, reclamação e falha. A disponibilidade dos eventos depende da configuração e do cliente de e-mail.
4. Publicar frontend e funções com `ENGAGEMENT_ENABLED=false` e `ENGAGEMENT_RELEASE_APPROVED=false`. Validar Admin e consentimento. Não acionar o cron manualmente em massa.
5. Após configurar os segredos, definir o único destinatário de teste e ativar as duas variáveis de liberação para testar a conta autorizada. A conta precisa estar confirmada, com preferência ativa e elegível para uma campanha; criar a primeira área a torna elegível ao e-mail inicial. Conferir entrega, descadastro e contadores antes de qualquer plano de liberação geral.

Não registrar chaves no repositório ou no navegador. A migração não deve ser aplicada automaticamente sem revisão do schema de produção. O SMTP de recuperação de senha não é medido nessa aba; somente as campanhas de aprendizado criadas por esta extensão são associadas aos eventos do Resend.

## Verificação local

- `node node_modules/typescript/bin/tsc --noEmit`
- `node api/engagement.test.js`
- `npm run build` com Node compatível e permissão para executar o binário esbuild.

Os cenários de produção devem usar contas próprias de teste e nunca disparo em massa. Após a migração, validar consulta admin/negação a não administradores, eventos históricos, opt-in/opt-out, chave de idempotência, assinatura e replay do webhook e retorno orgânico sem atribuição.

