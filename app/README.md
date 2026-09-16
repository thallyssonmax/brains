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
- Frente: pergunta e áudio. Verso: resposta e imagem/câmera/galeria.
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
