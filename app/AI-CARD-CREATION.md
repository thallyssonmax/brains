# Criação de cards com IA (preparada, desativada)

O verso pode receber uma frase simples a partir da frente e do vocabulário da mesma área. Uma segunda ação gera uma ilustração sem texto com base na frente e, quando houver, na frase. Cada card permite três gerações de frase e três de imagem. O usuário pode editar o texto e remover uma imagem gerada antes de salvar. A imagem passa pela otimização já existente e é salva pelo fluxo de mídia atual. Nenhum estado de revisão, histórico ou card existente é migrado.

Provedores gratuitos escolhidos em outubro de 2026:

- Frase: Gemini 2.5 Flash-Lite (API gratuita com limites variáveis por projeto).
- Imagem: Cloudflare Workers AI, `@cf/black-forest-labs/flux-1-schnell` (cota compartilhada de 10.000 Neurons por dia no plano Free; novas chamadas falham quando a cota acaba, sem cobrança automática).

No Supabase, a migration `20261003131126_ai_generation_limits.sql` apenas cria um log privado de gerações e funções de cota. Ela não altera as tabelas dos usuários. Além dos três usos por ação e card, as cotas iniciais são 15 frases e 5 imagens por usuário por dia, e 300 frases e 100 imagens por dia para todo o app. Chamadas que falham no provedor não consomem a cota do Brains. As cotas dos provedores podem ser menores e mudar.

Para ativar, criar uma chave gratuita em Google AI Studio e um token da Cloudflare com permissão Workers AI Read no projeto desejado. Adicionar **somente como variáveis de servidor** na Vercel: `GEMINI_API_KEY`, `CLOUDFLARE_ACCOUNT_ID` e `CLOUDFLARE_AI_TOKEN`. Nunca usar prefixo `VITE_` nessas chaves, nem colocá-las no repositório ou no chat. Após conferir as cotas nos painéis dos provedores, definir `VITE_AI_ENABLED=true` para Production e fazer redeploy. Com a flag desativada, o formulário atual de câmera/galeria permanece disponível; com a flag ativada, os botões de IA a substituem.

Os pedidos passam pela função `/api/ai`, que valida a sessão Supabase, limita as gerações e só então chama o provedor. O texto da frente, a frase do verso e até 40 palavras da área podem ser enviados aos provedores; não são enviados e-mail nem áudio. A saída do modelo deve ser conferida antes de salvar, pois pode conter erros. Um limite gratuito atingido mostra falha e mantém o rascunho intacto.

Documentação: [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing), [Gemini rate limits](https://ai.google.dev/gemini-api/docs/rate-limits), [Cloudflare Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/), [FLUX.1 Schnell](https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/).
