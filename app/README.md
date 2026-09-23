# Brains
Aplicativo web mobile first publicado em https://brains-puce.vercel.app/.
Documentação consolidada em 16/09/2026; versão funcional de referência 7d9dbfc8aa119a299b291052d54a4fab29c5f860.

## Executar
Node 22.12+ ou 24. Na pasta app: npm ci; npm run dev.
Servidor local: http://127.0.0.1:5174. iniciar.ps1 usa o runtime Node 24 disponível neste computador.
Configurar .env.local conforme .env.example, apenas URL e chave pública Supabase. Nunca commitar senhas ou chaves administrativas.

## Produto atual
- Conta autenticada; salvamento automático no Supabase, com internet.
- Áreas contêm cards diretamente; área herdada ao cadastrar.
- Frente: pergunta e áudio. Verso: resposta, áudio próprio e imagem/câmera/galeria.
- Voz do dispositivo, gravação de até 30 segundos, importação ou sem áudio; até 5 MB por mídia.
- FSRS 5.4.2 com alvo 90%; confirmação em Próximo card; vencidos antes de novos.
- Meta global por cards distintos e limite separado de novos.
- Arquivo/lixeira/restauração/exclusão definitiva; limpeza segura de mídia não referenciada.
- Rascunhos e fila de anexos locais por conta; não há sincronização manual.
- Português, inglês, espanhol; interface responsiva e melhorias de foco/seleção.

## Arquitetura
CloudStore usa brains_cloud (documento JSONB por conta), RPC versionada/idempotente e bucket privado brains-media.
IndexedDB guarda rascunhos e uploads pendentes; não é a fonte principal da biblioteca.
Sessões e alterações não confirmadas não são uma fila de revisões offline.
Backup não está na interface. PWA offline e apps nativos são futuros.

## Documentos
- [PRD](../PRD%20-%20Personal%20Anki.txt)
- [Revisão espaçada](REVISAO-ESPACADA.md)
- [Persistência](CLOUD-FIRST.md)
- [Mídias e exclusão](MEDIA-CLEANUP.md)
- [UX](UX-DECISIONS.md)
- [Publicação](DEPLOY.md)
- [Conta](CONFIGURAR-CONTA.md)

## Verificação
npm test; npm run build. Última entrega funcional: 59 testes, TypeScript e build aprovados.
Usuário confirmou câmera/microfone, persistência, exclusão de área e agendamento iguais no iPhone/navegador.
Pendentes: VoiceOver, teclado virtual/zoom e descrição opcional de imagens.

Atualização de áudio: o verso oferece referência, gravação, importação e sem áudio. Novos cards iniciam com referência no verso em pt-BR; cards existentes preservam sua opção. Frente mantém idioma da área. Os arquivos dos lados são independentes.

Detecção automática de idioma: ELD 2.1.0 (60 idiomas), executado localmente no navegador para cada lado. Referência lê o texto do respectivo lado. Quando a detecção é confiável, usa o idioma detectado; quando incerta, conserva o idioma salvo como contexto e informa isso. Idioma da voz permite correção para a reprodução atual; a correção não é persistida no card e reinicia ao mudar texto/lado. Não há promessa de cobertura universal nem de acerto em palavras isoladas. Se o aparelho não tiver voz compatível, mostra indisponibilidade, sem escolher outro idioma. Gravações/importações não são traduzidas nem regravadas. 66 testes passaram. Fonte: https://github.com/nitotm/efficient-language-detector-js

17/09/2026 — Regra atual: frente usa o idioma escolhido na área, sem detecção nem seletor de voz. Apenas o verso detecta automaticamente o idioma da resposta e oferece ajuste na reprodução. Esta regra substitui a detecção em ambos os lados descrita na atualização anterior.

17/09/2026 — Revisão diária única: esta regra substitui os retornos intradiários anteriores. FSRS 5.4.2 com enable_short_term=false; próxima data nunca anterior ao início do dia seguinte no fuso da conta. Primeiro erro confirmado adiciona uma única tentativa ao fim da sessão. A repetição (acerto ou erro) também é registrada, sem gerar terceira tentativa. Eventos guardam sessionId e retryOf; somente a sessão original pode repetir, com validação de origem, card ativo e ausência de repetição prévia. Sair/atualizar encerra a sessão; o card segue para outro dia. Meta conta o card uma vez; tentativas incluem a repetição. Cards já revisados hoje não entram em uma nova sessão, inclusive agendamentos legados intradiários. Datas antigas não são regravadas em massa; exibição e fila respeitam o dia mínimo.

Compressão de imagens: browser-image-compression 2.0.2 executa no dispositivo antes do rascunho e upload, com worker servido pelo próprio app. Qualidade inicial 0,8 e maior lado até 1600 px; apenas substitui o original se menor. GIF e animações PNG/WebP são preservados. Entrada JPG/PNG/WebP/GIF até 20 MB; resultado até 5 MB. Em falha mantém o original se couber. Não recomprime imagens existentes nem altera agendamentos. HEIC não é convertido; depende da conversão oferecida pelo seletor do aparelho. A qualidade visual varia conforme imagem e navegador.

23/09/2026 — Cadastro público: interface de cadastro com e-mail/senha, confirmação/reenvio, recuperação de senha e integração OAuth Google. A confirmação permanece obrigatória conforme configuração do Supabase. O botão Google só aparece com o provedor habilitado. Credenciais Google e entrega pública via SMTP ainda dependem de configuração e teste externo. Detalhes em app/AUTH-PUBLICO.md.

## Rotas em produção
Entrada pública: https://heybrains.app (a Vercel mantém www como domínio canônico). Landing na raiz; autenticação em /login; Today em /home; áreas em /areas; configurações em /settings. Acesso direto e refresh são resolvidos pela Vercel. Consulte [ROTAS.md](ROTAS.md) para arquitetura, preservação de dados e callbacks. Nenhuma migration de banco foi executada nesta reorganização.
