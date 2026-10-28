# Brains + ChatGPT — passo a passo de ativação

Atualizado em 28/10/2026. Consulte a [especificação da integração](Brains-ChatGPT-especificacao.md).

## Estado atual

O conector OAuth de cards de texto está publicado em `https://www.heybrains.app/api/brains-mcp-import`. Ele é separado do plugin público de rascunhos e imagens, que usa `/api/brains-mcp-prepare`. O conector exige uma conta Brains autorizada; cada chamada fica limitada à conexão autenticada pelo token Supabase e pelas políticas RLS. A ferramenta `get_connected_account` ajuda o ChatGPT a identificar essa conexão. Nenhum schema ou migration é necessário para a seleção de múltiplas contas.

## Conectar e selecionar contas

1. No ChatGPT, abra **Configurações → Plugins ou Apps → Brains**.
2. Em **Contas conectadas**, escolha **Conectar outra conta**, se essa opção estiver disponível.
3. Autorize a conta Brains desejada pelo fluxo OAuth.
4. Ao pedir cards para uma conta específica, informe o e-mail da conta. O ChatGPT consulta `get_connected_account` para confirmar qual conexão está sendo usada antes de listar áreas ou criar cards.
5. Se a opção de conectar outra conta não aparecer, use a conexão disponível ou consulte a disponibilidade no ChatGPT; o MCP não consegue adicionar nem alternar contas por conta própria.

## Segurança e comportamento

A autorização da conta libera o uso das ferramentas, mas cada gravação exige aprovação do conteúdo exato na conversa. A integração não importa imagens ou áudio; a voz de referência usa o mecanismo existente no Brains e gravações permanecem no app. Cada conexão é independente; o conector só usa o usuário autenticado naquela chamada.

O backend verifica token Supabase e o `client_id` permitido, aplica RLS por usuário e salva através da RPC versionada existente. Sem configuração correspondente de cliente, falha de forma fechada. Não usa chave administrativa, migration ou reset de dados.

## Como usar depois da ativação

Peça cards de um assunto específico. Se tiver mais de uma conta conectada, informe qual quer usar; o ChatGPT confirma a conta com `get_connected_account`. Se necessário, escolha uma área. Confira a lista completa de frentes e versos que o ChatGPT propuser. Aprove o conteúdo exato para então gravá-lo no Brains. Para áudio gravado, abra o card no app e use a função de gravação existente.
