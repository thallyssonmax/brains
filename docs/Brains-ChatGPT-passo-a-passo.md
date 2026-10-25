# Brains + ChatGPT — passo a passo de ativação

Atualizado em 25/10/2026. Consulte a [especificação da integração](Brains-ChatGPT-especificacao.md).

## Estado atual

O código de integração está no [PR #1](https://github.com/thallyssonmax/brains/pull/1), baseado na `main` atual e com preview Vercel concluído. O PR segue como rascunho; ainda não há publicação em produção.

No projeto Supabase de produção, o OAuth Server já está habilitado, o Site URL está em `https://www.heybrains.app` e o Authorization Path em `/oauth/consent`. O registro dinâmico continua desligado. Nenhum cliente OAuth foi criado. Nenhum schema, migration, card ou histórico foi alterado.

## Próximos passos

1. Revisar o preview do PR e aprovar sua publicação.
2. Depois que o código estiver em produção, iniciar a conexão do MCP Brains no ChatGPT e copiar o callback OAuth exato apresentado pelo ChatGPT.
3. Registrar manualmente um cliente OAuth público no Supabase com esse callback. Não ativar Dynamic Client Registration.
4. Copiar o ID do cliente para `BRAINS_CHATGPT_CLIENT_ID` e `VITE_BRAINS_CHATGPT_CLIENT_ID` na Vercel Production. Os dois valores precisam ser iguais. Não compartilhe segredos no chat.
5. Fazer um login OAuth, revisar os dados e permissões mostrados em `/oauth/consent` e autorizar o cliente Brains correto.
6. Testar `list_areas` e confirmar que aparecem apenas as áreas da conta conectada.
7. Preparar um card, conferir frente, verso e área na conversa e aprovar explicitamente antes de permitir a gravação imediata.
8. Confirmar no app que o card está na área correta, que áudio de referência funciona na frente e no verso e que nenhum progresso/histórico anterior mudou.

## Segurança e comportamento

A autorização da conta libera o uso das ferramentas, mas cada gravação exige aprovação do conteúdo exato na conversa. A integração não importa imagens ou áudio; a voz de referência usa o mecanismo existente no Brains e gravações permanecem no app.

O backend verifica token Supabase e o `client_id` permitido, aplica RLS por usuário e salva através da RPC versionada existente. Sem configuração correspondente de cliente, falha de forma fechada. Não usa chave administrativa, migration ou reset de dados.

## Como usar depois da ativação

Peça cards de um assunto específico. Se necessário, escolha uma área. Confira a lista completa de frentes e versos que o ChatGPT propuser. Aprove o conteúdo exato para então gravá-lo no Brains. Para áudio gravado, abra o card no app e use a função de gravação existente.
