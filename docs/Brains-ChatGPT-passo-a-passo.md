# Brains + ChatGPT — passo a passo de entrega

Data: 23/10/2026. Complementa [a especificação](Brains-ChatGPT-especificacao.md). O plugin privado **Brains — Criar flashcard** está conectado ao ChatGPT e a importação com revisão está publicada no Brains. Um teste real levou texto e imagem gerada na conversa até a prévia autenticada em produção; nenhum card de teste foi salvo.

**Caminho implementado:** o MCP `app/api/brains-mcp-import.js` prepara um link de revisão. `app/src/ChatGPTImport.tsx` exige login, área e confirmação. `app/api/chatgpt-import-image.js` baixa a imagem apenas para um usuário autenticado; o navegador a otimiza e a salva por meio do mecanismo de card atual. Esse desenho evita entregar ao plugin um token Supabase com acesso amplo à biblioteca. Não requer nova tabela, chave de serviço nem migração. O upload e o salvamento de um card importado com imagem ainda não foram exercitados em uma conta de teste isolada.

## Como usar agora

1. No ChatGPT, invoque **Brains — Criar flashcard** e peça um card específico. Exemplo: “Crie um card para *apple*, com uma frase simples e uma imagem contextual, sem texto. Prepare para revisão no Brains.” A imagem é gerada pelo ChatGPT, sujeita aos limites da conta.
2. Abra o link **Revisar flashcard no Brains** em até 30 minutos. Ele contém uma referência temporária da imagem; não o compartilhe. Entre na sua conta Brains, se necessário.
3. Escolha uma área ativa, confira e edite a frente, o verso e a imagem. O app verifica duplicatas. Só clique em **Confirmar e salvar card** se o conteúdo estiver correto. Se a imagem falhar, o app exige escolha explícita para salvar sem ela.

O plugin não vê suas áreas, cards ou histórico e não salva nada sozinho. O teste de produção confirmou a prévia com imagem; falta validar a persistência completa em uma conta de teste, incluindo upload e reabertura do card em outro dispositivo.

## Histórico da prova e evolução futura

As etapas seguintes registram a prova inicial com GPT Actions e um plano opcional para OAuth, propostas e salvamento direto. **Não são necessárias para usar o fluxo com revisão no app que está publicado agora.**

**Mudança de canal:** GPTs personalizados serão [descontinuados em 11/12/2026](https://help.openai.com/en/articles/20001519-custom-gpt-retirement-and-migration-faq), e Actions não migram. O restante da implementação deve usar um plugin MCP. O endpoint `app/api/brains-mcp.js` e o pacote `plugins/brains-image-probe/` são uma prova isolada desse canal, protegida pela mesma chave de teste e sem acesso aos dados dos usuários. Primeiro validar seu transporte de arquivo; depois projetar OAuth com permissões estreitas e os endpoints de propostas/commit.

## Etapa 1 — Provar a transferência da imagem

Responsáveis: desenvolvimento e dono do GPT.

1. Verificar se a conta permite criar GPT com Actions e geração de imagens na mesma configuração.
2. Criar GPT privado de teste, sem acesso aos dados reais do Brains.
3. Criar endpoint temporário com chave exclusiva de teste, sem acesso às contas e sem gravar cards de produção.
4. Configurar OpenAPI seguindo `openaiFileIdRefs` da documentação oficial, respeitando a diferença entre schema e payload recebido.
5. Gerar uma imagem educativa no próprio GPT e pedir seu envio.
6. Confirmar que os bytes recebidos correspondem à imagem exibida, e não a thumbnail, imagem diferente ou URL inventada.
7. Testar regeneração, referência expirada, reenvio, ausência de imagem e confirmação nativa da ação.
8. Registrar evidências sem URLs assinadas ou credenciais.

Saída obtida: transporte por Actions funcionou para a imagem testada. Depois, o plugin MCP também transferiu a referência da imagem e abriu a prévia com a imagem correta em produção. O plugin não salva cards.

## Etapa 2 — Validar o plugin MCP e conectar a conta

1. Testar o servidor MCP privado com uma imagem gerada no ChatGPT, usando o parâmetro de arquivo documentado para plugins. A chave desta prova só permite verificar bytes e não representa uma conta Brains.
2. Verificar suporte OAuth do projeto e compatibilidade com MCP. O servidor OAuth 2.1 do Supabase está disponível, mas não habilitar o cliente do plugin antes de restringir seus tokens nas políticas de banco e Storage. As políticas atuais permitem a tokens autenticados ler e modificar a biblioteca do próprio usuário, independentemente de `client_id`; os escopos OAuth não limitam acesso às tabelas.
3. Definir permissões mínimas, consentimento e revogação.
4. Configurar cliente e callbacks exatos fornecidos pelo plugin; cadastrar segredos somente em locais próprios.
5. Implementar validação dos tokens e propriedade dos recursos.
6. Testar com duas contas de teste, expiração e revogação.

Saída: cada usuário acessa apenas suas próprias áreas. O dono do projeto poderá precisar concluir configurações nos painéis; nenhuma senha será solicitada no chat.

## Etapa 3 — Preparar e validar propostas

1. Implementar listagem de áreas e busca limitada de vocabulário/duplicatas.
2. Reutilizar as regras de validação dos cards atuais.
3. Criar propostas versionadas, temporárias e vinculadas ao usuário.
4. Receber imagem, validar, comprimir e guardar como staging privado.
5. Apresentar prévia e exigir aprovação da versão exata.

Saída: proposta completa, ainda fora da fila de estudo. Decidir compressão no servidor ou em página do Brains após a prova de conceito.

## Etapa 4 — Salvar com segurança

1. Inspecionar as RPCs existentes e documentar sua concorrência/idempotência.
2. Integrar o commit ao salvamento versionado, sem substituir histórico nem dados de outros cards.
3. Tratar upload concluído, operação repetida, conflito e resposta perdida.
4. Retornar ID e link verificável após salvar.
5. Aplicar limites por conta e limpeza de propostas expiradas sem remover anexos referenciados.

Saída: um card aprovado produz exatamente um card novo com imagem permanente. Desativar a integração deve deixar o app atual funcionando normalmente.

## Etapa 5 — Configurar o plugin definitivo

1. Nome sugerido: “Brains — Criador de cards”.
2. Empacotar instruções de criação como skill do plugin e exemplos de pedidos.
3. Conectar o servidor MCP validado. A geração de imagem permanece no ChatGPT; a ferramenta recebe o arquivo gerado.
4. Configurar OAuth individual com permissões restritas e confirmar domínio/URLs necessárias.
5. Testar frase → imagem → aprovação → salvamento completo.
6. Manter privado no piloto. Antes de distribuir, revisar requisitos atuais de publicação e política de privacidade descrevendo quais dados transitam entre ChatGPT e Brains.

## Etapa 6 — Piloto e publicação

1. Rodar todos os critérios de aceite da especificação em ambiente isolado.
2. Comparar biblioteca e progresso de conta de teste antes/depois: apenas o card novo e metadados esperados podem mudar.
3. Validar exibição no navegador e iPhone, sem fazer revisões artificiais na conta real.
4. Liberar para a conta do responsável; acompanhar falhas de autenticação, transferência, duplicatas e conflitos.
5. Ampliar para poucos usuários após sucesso do piloto.
6. Em falha, desabilitar as rotas da integração; preservar cards já criados e todos os dados existentes.

## Decisões necessárias antes de escrever a feature

| Decisão | Proposta inicial |
| --- | --- |
| Canal | Plugin privado com MCP; GPT Actions usado somente na prova técnica |
| Aprovação | Na conversa com confirmação nativa validada; página Brains se necessário |
| Volume | Um card por operação; lotes depois |
| Imagem | Gerada no ChatGPT, recebida pelo Brains, nunca regenerada silenciosamente |
| Sem imagem | Apenas por escolha explícita do usuário |
| Persistência | Biblioteca/versionamento existentes, estruturas auxiliares só se necessárias |
| Custo | Sem geração por API do Brains nesse fluxo; acompanhar uso de infraestrutura |

Próxima validação recomendada: em uma conta de teste isolada, confirmar o salvamento de um card importado com imagem e sua leitura em outro dispositivo. A evolução para OAuth e salvamento direto pelo plugin só deve ocorrer depois de restringir as permissões dos tokens no banco e Storage.
