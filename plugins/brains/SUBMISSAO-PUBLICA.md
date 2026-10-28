# Brains — preparação para submissão pública

Status do pacote: 1.2.0 · endpoint: `https://www.heybrains.app/api/brains-mcp-prepare`

## Informações do diretório

- Nome: **Brains — Criar flashcard**
- Descrição curta: **Da conversa para a sua memória**
- Descrição: **Transforme uma palavra que aprendeu em um flashcard com frase e imagem. Revise a prévia, escolha uma área e confirme no Brains. Nada é salvo sem sua confirmação.**
- Suporte: `thallyssondesigner@gmail.com` (autorizado pelo responsável do produto)
- Site: `https://www.heybrains.app`
- Privacidade: `https://www.heybrains.app/privacy/`
- Termos: `https://www.heybrains.app/terms/`
- Suporte web: `https://www.heybrains.app/support/`
- Repositório público: `https://github.com/thallyssonmax/brains`
- Endpoint MCP publicado: `https://www.heybrains.app/api/brains-mcp-prepare`
- Metadados do pacote incluem os links de suporte, privacidade e termos e os 5 casos positivos + 3 negativos.

O pacote público oferece apenas preparação de rascunho. A rota OAuth separada do domínio não está referenciada no manifest do plugin.

## Casos positivos para revisão

1. Preparar uma palavra e frase contextual com imagem anexada pela ferramenta nativa do ChatGPT; o Brains deve retornar um link de revisão não salvo.
2. Preparar três cards em três chamadas, cada um com imagem própria; validar que frente, verso e imagem de cada link correspondem.
3. Preparar sem imagem somente depois de o usuário escolher explicitamente essa opção.
4. Abrir o link sem sessão, entrar na conta e confirmar que o mesmo rascunho continua disponível.
5. Selecionar uma área, revisar/editar conteúdo e imagem e salvar somente ao confirmar no Brains.

## Casos negativos para revisão

1. Imagem pedida sem anexo: retornar `MISSING_IMAGE`; não substituir por `withoutImage`.
2. Caminho local, URI `sandbox:` ou ID isolado: recusar a referência sem tentar ler o computador do usuário.
3. Host não permitido, arquivo inacessível/expirado, tipo diferente de PNG/JPEG/WebP ou arquivo acima de 5 MiB: retornar erro específico e não salvar.

## Materiais e ações que ainda dependem do responsável

- Gravar e hospedar uma demonstração curta no fluxo real do ChatGPT e do Brains; inserir a URL pública solicitada pelo formulário de revisão. A URL ainda não está no pacote.
- Concluir a verificação de identidade/organização no OpenAI Platform.
- Verificar o domínio `heybrains.app` hospedando o token exato exibido no portal em `/.well-known/openai-apps-challenge` e concluir a verificação.
- Criar uma conta de demonstração isolada com dados de exemplo e inserir as credenciais diretamente no formulário protegido de revisão. Não usar a conta real do proprietário; não enviar senha pelo chat.
- Executar manualmente os cinco casos positivos e três negativos no ChatGPT e na conta de demonstração, conferindo os resultados antes da submissão.
- Revisar os campos preenchidos e autorizar o clique final em **Submit for review**.

A aprovação depende da análise da OpenAI e não pode ser garantida pelo código ou pelo responsável do app. O guia atual exige identidade verificada, domínio validado, demonstração acessível, cinco casos positivos, três negativos e conta de demonstração sem MFA ou outros passos manuais. A conexão GitHub/Vercel e o manifest, sozinhos, não substituem esses requisitos.
