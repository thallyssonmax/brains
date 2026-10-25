# Integração do Brains com ChatGPT

Atualizado em 24/10/2026.

## Comportamento

O ChatGPT lista as áreas ativas da conta autenticada e prepara cards com frente e verso. Ele deve mostrar o texto completo e a área ao usuário e esperar uma aprovação explícita antes de chamar `create_flashcards`. A aprovação acontece na conversa; a ferramenta grava os cards diretamente na biblioteca selecionada.

O MCP não transfere imagens nem arquivos de áudio. Cards criados pela integração usam `mode: reference` nos dois lados, os mesmos campos usados pelo app para voz de referência. A gravação pelo microfone continua sendo feita no Brains.

## Persistência e isolamento

O endpoint exige um token Bearer válido do Supabase Auth. Usa a chave publicável do projeto e envia o token do usuário em todas as consultas. Não usa `service_role`, chave secreta ou uma credencial compartilhada entre contas.

As áreas e o documento são lidos sob as políticas RLS existentes da conta. Os cards aprovados são acrescentados ao documento atual e salvos por `brains_cloud_save`, com versão esperada e `operation_id` idempotente. Cards, IDs, histórico, progresso, relacionamentos, áreas e preferências existentes são preservados. Esta integração não requer alteração de schema nem migration.

O MCP só retorna ao ChatGPT nomes/IDs de áreas e a confirmação dos textos que acabou de salvar. A deduplicação compara frente e verso dentro da área, incluindo cards na lixeira; outro significado para uma frente existente exige aprovação explícita via `allowDifferentMeaning`.

## Configuração do Supabase OAuth

No projeto Supabase existente, em **Authentication → OAuth Server**:

1. Habilite o servidor OAuth 2.1.
2. Defina **Authorization Path** como `/oauth/consent`.
3. Mantenha Dynamic Client Registration desativado. Registre manualmente um cliente OAuth público e use a URL de callback exata mostrada pelo ChatGPT.
4. Confirme em **Authentication → URL Configuration** que o Site URL aponta para `https://www.heybrains.app`.
5. Cadastre o ID desse cliente nas variáveis da Vercel: `BRAINS_CHATGPT_CLIENT_ID` para a função MCP e `VITE_BRAINS_CHATGPT_CLIENT_ID` para a tela de consentimento. Ambas devem receber o mesmo ID. Se o ChatGPT registrar o cliente dinamicamente, a primeira tentativa mostra o ID e bloqueia a autorização; depois de adicioná-lo às duas variáveis e publicar, reinicie a conexão e autorize esse cliente. A implementação falha de forma fechada enquanto o ID não estiver configurado.
6. Mantenha a aprovação OAuth do usuário habilitada e autorize somente o cliente esperado.

A tela `/oauth/consent` usa o usuário já autenticado do Brains ou pede login preservando o `authorization_id`. Ela mostra o cliente, a conta e as permissões antes de permitir autorizar ou recusar.

Scopes OAuth identificam claims solicitados pelo cliente; eles não substituem autorização de banco. O acesso às linhas continua delimitado pelo token do usuário e pelas políticas RLS. Revise as políticas do projeto antes de ativar o conector para outros usuários.

## Vercel e conexão no ChatGPT

O endpoint MCP publicado é `https://www.heybrains.app/api/brains-mcp-import`. O desafio Bearer aponta para `https://www.heybrains.app/.well-known/oauth-protected-resource`, que anuncia o servidor OAuth Supabase. A função usa `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` se presentes; para manter a configuração atual também aceita `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` em runtime. Esses valores são a URL pública e a chave publicável, nunca uma chave administrativa. Antes de acessar os dados, a função valida o token no Supabase Auth e exige que o claim `client_id` corresponda ao cliente ChatGPT aprovado.

Após publicar, conecte novamente o MCP Brains no ChatGPT para que ele descubra o OAuth. No primeiro uso, faça login no Brains e aprove o cliente esperado na tela `/oauth/consent`. Mantenha a confirmação ativada para a ferramenta de escrita no ChatGPT. Depois disso, o ChatGPT poderá consultar as áreas e, após mostrar e receber aprovação dos cards na conversa, gravá-los sem abrir o app.

## Limites do fluxo de aprovação

A aprovação OAuth autoriza o cliente a usar as ferramentas do Brains; ela não aprova automaticamente o texto de cada card. O prompt e a descrição de `create_flashcards` exigem que o ChatGPT mostre frente, verso e área e aguarde o usuário aprovar. A gravação é imediata quando a ferramenta é chamada, por isso teste primeiro com uma única palavra em uma área de teste.

## Verificação

- `list_areas` retorna apenas áreas ativas da conta autenticada.
- Sem token válido, o endpoint retorna `401` e o endereço de metadados OAuth.
- `create_flashcards` aceita somente texto, área e até 20 cards por chamada.
- Frente e verso usam a voz de referência e o idioma de frente da área.
- A escrita preserva o documento atual, histórico e progresso.
- Nenhum card é salvo por `list_areas`; salvar só ocorre no tool de escrita após aprovação em conversa.
- O caminho não executa SQL DDL, migrations, limpeza ou substituição de tabelas.
