# Brains + ChatGPT — especificação da integração

Atualizado em 25/10/2026 · Versão 2.0 · Implementação em PR; ainda não publicada em produção.

## Objetivo

Permitir que o usuário transforme conteúdo aprovado em uma conversa do ChatGPT em flashcards de texto no Brains, com uma autorização individual da conta e sem abrir o app para confirmar cada card.

## Experiência

1. O usuário pede cards sobre conteúdo específico.
2. O ChatGPT prepara frente e verso e pergunta a área quando ela não estiver clara.
3. Antes de gravar, apresenta a área e o texto completo de cada card e espera aprovação explícita do usuário na conversa.
4. Depois da aprovação, grava os cards diretamente na área escolhida e confirma o resultado.
5. A pessoa usa o app para estudar, gravar áudio ou editar os cards como de costume.

A autorização OAuth do Brains permite ao ChatGPT usar a integração. Ela não substitui a aprovação do conteúdo de cada gravação.

## Escopo desta versão

- Consultar as áreas ativas da conta autenticada e permitir a escolha de uma área.
- Criar de 1 a 20 cards de texto por chamada, com limites de 200 caracteres na frente e 800 no verso.
- Recusar duplicatas exatas na área; frente já existente com outra resposta exige confirmação explícita de significado diferente.
- Usar a voz de referência existente no Brains na frente e no verso. O idioma da frente vem da área; o verso usa a detecção automática já disponível no app.
- Gravar, editar e reproduzir áudio no Brains. A integração não transfere imagem ou arquivos de áudio.
- Criar o card imediatamente após aprovação explícita do conteúdo na conversa.

## Fora de escopo

- Analisar automaticamente todo o histórico do ChatGPT ou extrair palavras sem pedido.
- Importar imagens ou áudios do ChatGPT.
- Alterar cards existentes, áreas, metas, agendamentos ou histórico de estudo.
- Excluir dados, criar áreas, modificar políticas de banco ou acessar dados de outra conta.

## Arquitetura e preservação

O servidor MCP valida o token do usuário pelo Supabase Auth e também confere o `client_id` OAuth permitido. Consultas usam a chave publicável do projeto e o token do usuário; não usam `service_role`. A biblioteca é lida sob as políticas RLS existentes e gravada através da RPC versionada `brains_cloud_save`, com versão esperada e ID de operação.

A criação acrescenta somente os cards aprovados ao documento atual. Não há migration, alteração de schema, reset ou substituição do histórico. Os relacionamentos e IDs existentes são mantidos.

## Rotas e ferramentas

- MCP: `https://www.heybrains.app/api/brains-mcp-import`
- Metadados do recurso protegido: `https://www.heybrains.app/.well-known/oauth-protected-resource`
- Consentimento: `https://www.heybrains.app/oauth/consent`
- `list_areas`: leitura das áreas ativas da conta conectada.
- `create_flashcards`: gravação de cards após a aprovação explícita do conteúdo e área na conversa.

`list_areas` não grava nada. `create_flashcards` grava imediatamente; deve ser chamado apenas depois que frente, verso e área forem exibidos e aprovados.

## Configuração atual e pendências

- Supabase OAuth Server habilitado no projeto existente.
- Site URL: `https://www.heybrains.app`.
- Authorization Path: `/oauth/consent`.
- Dynamic Client Registration: desativado. O cliente deve ser registrado estaticamente usando o callback exato informado pelo ChatGPT.
- Ainda falta publicar o código do PR, obter o callback do ChatGPT, registrar o cliente OAuth, colocar o mesmo ID em `BRAINS_CHATGPT_CLIENT_ID` e `VITE_BRAINS_CHATGPT_CLIENT_ID` na Vercel Production e validar o fluxo completo.
- A integração ainda não está disponível na produção. Nenhum cliente OAuth foi registrado e nenhum card foi criado por ela.

## Critérios de aceite

- O ChatGPT lista somente áreas da conta conectada.
- Conteúdo exato e área são apresentados antes de cada chamada de escrita.
- A ferramenta de escrita exige aprovação explícita do usuário na conversa.
- Frente e verso ficam associados ao card e à área escolhida.
- Cards duplicados são tratados conforme a regra acima.
- Áudio de referência funciona nos dois lados depois da gravação no Brains.
- Sem autenticação válida ou cliente permitido, nenhuma leitura ou escrita é feita.
- Dados, IDs, progresso e histórico existentes permanecem intactos.
- Nenhum card é criado por falha, listagem, consentimento OAuth ou aprovação OAuth isolada.
