# Integrações MCP do Brains

Atualizado em 27/10/2026.

O Brains mantém duas integrações MCP com contratos e permissões diferentes. Não confundir os endpoints.

## Plugin público: rascunho com confirmação dentro do Brains

- Endpoint: `https://www.heybrains.app/api/brains-mcp-prepare`
- Configuração publicada: `plugins/brains/mcp.json`
- Ferramenta: `prepare_flashcard`
- Não exige OAuth porque não acessa uma conta nem banco de dados.
- Recebe frente, verso e referência de imagem opcional e devolve link temporário (`saved:false`).
- A referência deve ser anexo real do ChatGPT em `files.oaiusercontent.com` ou `sdmntpr*.oaiusercontent.com`, por HTTPS.
- Não aceitar caminho local, URI `sandbox:` ou ID de arquivo isolado.
- A imagem é validada e baixada apenas em `/api/chatgpt-import-image`, depois que o usuário entra na conta. São aceitos PNG/JPEG/WebP até 5 MiB, sem redirects, com timeout de 8 s.
- O rascunho expira em 30 minutos. O usuário escolhe a área, revisa e confirma no Brains. O MCP público nunca salva.

## Conector OAuth separado: cards de texto

- Endpoint: `https://www.heybrains.app/api/brains-mcp-import`
- Exige token Supabase Auth, cliente OAuth permitido e policies RLS.
- Pode listar áreas ativas e gravar cards de texto após aprovação explícita do conteúdo e área na conversa.
- Não transfere imagens ou áudio.
- Usa a chave pública do projeto; nunca usa `service_role`.
- A escrita usa `brains_cloud_save`, versão esperada e `operation_id` idempotente.

O conector OAuth não faz parte do manifest do plugin público `plugins/brains`. O fluxo OAuth continua isolado em `/oauth/consent` e pode ser usado separadamente por clientes autorizados.

## Segurança e preservação

O fluxo público de preparação não faz consultas, não salva imagens e não altera dados. O fluxo autenticado delimita acesso pelo token Supabase e RLS. Nenhuma das rotas recria tabelas, IDs, relações ou progresso de estudo.

Não coloque tokens, chaves privadas ou URLs assinadas em logs. Mensagens do endpoint público devem distinguir referência ausente/inválida, host não permitido, acesso falho, formato não suportado e tamanho acima do limite. Nunca use `withoutImage` como fallback automático.

## Testes mínimos

1. Uma chamada válida retorna `reviewUrl` e `saved:false`.
2. Três chamadas com imagens diferentes criam três rascunhos independentes.
3. Caminho local, `sandbox:` e host não permitido são rejeitados.
4. Arquivo expirado/inacessível, formato inválido e tamanho >5 MiB exibem erros distintos.
5. URL de revisão direta e atualização preservam o fluxo de login.
6. A imagem só é carregada após autenticação.
7. Nenhum card é gravado até a confirmação do botão no Brains.
