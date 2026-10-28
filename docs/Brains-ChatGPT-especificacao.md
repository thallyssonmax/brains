# Brains + ChatGPT — integração pública

Atualizado em 27/10/2026 · Versão pública 1.2.0

## Objetivo e princípio de segurança

Transformar conteúdo que o usuário escolheu na conversa em um rascunho de flashcard e permitir que ele revise e confirme o salvamento dentro do Brains. O endpoint do plugin público não acessa contas, áreas, banco de dados ou armazenamento de usuários e não salva cards.

## Jornada do plugin público

1. O usuário pede explicitamente um flashcard; o GPT não deve extrair conteúdo automaticamente do restante da conversa.
2. O ChatGPT prepara frente, verso contextual e, quando solicitado, uma imagem educativa.
3. `prepare_flashcard` recebe os textos e uma referência de anexo compatível. Caminhos locais, `sandbox:` e IDs sem objeto de referência são rejeitados.
4. O Brains retorna um link temporário de revisão com expiração de 30 minutos e `saved:false`.
5. O usuário entra na conta, escolhe uma área, confere ou edita o rascunho e confirma.
6. Só então o aplicativo salva frente, verso e imagem na biblioteca daquela conta.

Cada chamada prepara um rascunho independente, para manter texto e imagem do mesmo card associados. Falhas de imagem retornam códigos específicos e nunca mudam automaticamente para `withoutImage`. Essa opção só é usada quando o usuário escolheu explicitamente não incluir imagem.

## Contrato público

- MCP Streamable HTTP: `https://www.heybrains.app/api/brains-mcp-prepare`
- Ferramenta: `prepare_flashcard`
- Entrada: `front` (1–200 caracteres), `back` (1–800), `file` (referência de anexo opcional) ou `withoutImage:true` por escolha explícita.
- Saída: `reviewUrl`, `expiresInMinutes:30`, `saved:false`.
- Referências de arquivo: somente objeto com `file_id` e `download_url` do host permitido `files.oaiusercontent.com` ou `sdmntpr*.oaiusercontent.com` via HTTPS.
- Imagens: bytes validados como PNG, JPEG ou WebP; limite 5 MiB; redirects são recusados; timeout de download de 8 segundos.
- O servidor público não faz download da imagem nem persiste os bytes durante `prepare_flashcard`.
- A rota autenticada `/api/chatgpt-import-image` verifica a sessão Supabase do usuário, revalida a referência e baixa a imagem quando a página de revisão é aberta.
- O payload é guardado no fragmento de URL, capturado para `sessionStorage` e removido do endereço visível. O fragmento não é enviado ao servidor HTTP ao abrir a página.

## Isolamento da integração OAuth existente

O domínio também mantém `/api/brains-mcp-import`, conector OAuth separado que consulta áreas e pode criar cards de texto após aprovação explícita na conversa. Esse endpoint exige token Supabase válido, cliente permitido e políticas RLS. A ferramenta somente de leitura `get_connected_account` retorna o e-mail e o ID estável da conta autenticada nesta conexão; ela não enumera outras contas nem expõe dados de outra conexão. Se o usuário pedir outra conta, o ChatGPT orienta a conectá-la em Configurações → Plugins ou Apps → Brains → Contas conectadas → Conectar outra conta, quando disponível, e confirma a identidade antes de consultar áreas ou gravar. O plugin público submetido aponta exclusivamente para `/api/brains-mcp-prepare`; não publica as ferramentas OAuth nem as usa no fluxo de importação com imagem.

## Preservação de dados

O fluxo público de rascunho não executa consultas ou escritas no banco e não altera schema, IDs, áreas, cards, relações, progresso ou histórico. A única escrita ocorre após confirmação no aplicativo, usando os mecanismos de persistência já existentes. A migration de retenção de analytics é separada, apaga apenas eventos com mais de 12 meses e não altera dados de estudo.

## Diagnóstico e recuperação

O MCP distingue conteúdo ausente ou longo, imagem ausente, referência inválida, falha de acesso, formato não suportado, limite excedido e falha de preparação. O ChatGPT deve manter o texto do card, pedir para anexar novamente a imagem ou tentar a geração de novo e só omitir a imagem quando o usuário assim decidir.

## Verificação antes de publicar

- Validar manifest e endpoint MCP em produção.
- Testar anexo criado pela ferramenta nativa do ChatGPT e anexo gerado por código após anexá-lo à conversa.
- Testar referência inválida, arquivo inacessível, formato não suportado e acima do limite.
- Preparar três drafts independentes e conferir associação correta de frente, verso e imagem.
- Confirmar que a página importa, a imagem carrega após autenticação e nenhum dado é gravado até o botão de confirmação.
- Testar diretamente `/import/chatgpt` e atualizar a página em produção.
- Nenhum teste de submissão cria cards em conta real; usar conta de demonstração isolada.

## Critérios de aceite

- O pacote público chama apenas `brains-mcp-prepare`.
- O link temporário e a imagem correta chegam à prévia de revisão.
- Login não descarta o rascunho.
- O usuário escolhe a área, edita e confirma no Brains.
- Nenhum card é salvo pelo endpoint MCP público.
- Erros de transporte são diagnosticáveis e nunca contornados silenciosamente.
- Dados e progresso existentes permanecem intactos.
