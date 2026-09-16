# Brains — persistência automática por conta

Estado em 16/09/2026: versão publicada e verificada em https://brains-puce.vercel.app/. Commit 792294a71df4e28a4737f47366ba68d6acdcfac9; deployment dpl_7FwBrQcdNxLh2YvgBZ1gjcTGapUh (READY).

## Problema corrigido
O fluxo anterior salvava primeiro a biblioteca local e exigia sincronização manual. Todos os anexos precisavam ser enviados antes de qualquer texto ou progresso. Uma falha de áudio interrompia tudo. O novo fluxo usa o banco como fonte principal, sem botão de sincronização da biblioteca.

## Implementação
- Supabase Auth identifica a conta; StoreContext instancia CloudStore por usuário.
- Postgres mantém uma biblioteca JSONB por conta em brains_cloud, sem arquivos binários. A escolha mantém áreas, cards, preferências e histórico na mesma transação para o uso pessoal atual; não se trata de tabelas normalizadas por entidade. Limite atual: 10 MiB de metadados por biblioteca.
- brains_cloud_save usa versão esperada, bloqueio transacional por usuário e operation_id idempotente. Alterações concorrentes reais retornam conflito; concluir um anexo não provoca conflito artificial de conteúdo.
- A biblioteca é consultada ao entrar, ao retornar à aba e a cada 15 segundos nas telas de listagem. Editor, configurações e sessão de revisão não são substituídos por atualização em segundo plano.
- O app só confirma o salvamento após a resposta do banco. Falhas de conexão não viram uma biblioteca vazia.
- Fotos e áudios ficam no bucket privado brains-media, com caminhos exclusivos vinculados ao usuário. Os bytes não passam pelo documento JSONB.
- IndexedDB mantém rascunhos e uma fila durável de anexos, isolados por conta. O card pode estar salvo enquanto o anexo ainda aguarda envio.
- A fila tenta novamente ao abrir, ao voltar a conexão/foco e a cada 30 segundos com o app aberto. O usuário pode tentar reenviar somente os anexos. Logout interrompe novas operações da instância.
- Downloads ocorrem ao exibir a mídia. Falhar um arquivo não impede abrir a biblioteca ou revisar o texto.
- Requisições HTTP têm limite de espera de 45 segundos. Tentativas repetidas de uma mesma operação usam o mesmo identificador durante a repetição automática.
- Backup foi retirado da interface; o código legado exporta também os arquivos; restauração substitui a biblioteca da conta e os rascunhos locais, com novos caminhos de mídia. Não há mais desfazer local da restauração; a tela informa isso antes de confirmar.

## Transição autorizada
O usuário dispensou a preservação dos dados antigos de teste. A nova versão inicia em brains_cloud e em um banco local de rascunhos v3, sem importar brains_sync nem bibliotecas antigas. A conta de autenticação foi mantida. A arquitetura está publicada. Foi criada na nova biblioteca somente a área “Validação da nuvem”, com um card de teste, imagem mínima, áudio de teste de um segundo e uma revisão.

## Evidências de validação
- TypeScript: aprovado.
- Vitest: 52 testes em 15 arquivos aprovados.
- Build Vite: concluído. Aviso não bloqueante: bundle JavaScript principal acima de 500 kB (aproximadamente 160 kB gzip).
- Novos testes: leitura por segunda instância; progresso FSRS; indisponibilidade do banco; preservação de rascunho; falha e retomada de mídia após reabertura; conflitos reais; conclusão de upload sem falso conflito; exclusão de card com upload pendente; substituição de imagem; exportação/restauração entre contas; bloqueio de referência de mídia de outra conta; logout; timeout e cancelamento HTTP.
- SQL executado como authenticated em transações revertidas: gravação, idempotência, rejeição de versão antiga, rejeição de operation_id reutilizado com outro conteúdo, isolamento de leitura/escrita entre contas e bloqueio do acesso anon.
- Interface local autenticada usando o Supabase real: criar área e card; enviar PNG e WAV; confirmar arquivos no Storage e estados pending=false; abrir segunda aba; carregar imagem (naturalWidth>0) e áudio (readyState=4, sem erro); registrar revisão. Banco confirmou 1 card, 1 revisão e 1 repetição.
- Console do navegador local: sem erros/avisos observados no fluxo.
- Advisors: nenhum novo aviso de RLS; permanece apenas a proteção contra senhas vazadas desativada, conforme decisão anterior do usuário.

## Limites e próximos passos
- Publicado; usuário confirmou persistência e agendamento no iPhone e navegador.
- Usuário confirmou o teste em dois aparelhos. VoiceOver e teclado virtual permanecem pendentes.
- Salvar e revisar exige internet. Rascunhos e arquivos ainda não enviados dependem do navegador do aparelho de origem; limpar seus dados antes do envio pode perder esses arquivos.
- Voz de referência continua sendo síntese do dispositivo; não é arquivo enviado à nuvem.
- Exclusão definitiva remove o card e histórico da biblioteca. Coleta automática implementada; consultar MEDIA-CLEANUP.md.
- Atualizações são por consulta periódica/foco, não Supabase Realtime.
- A tabela de operações idempotentes e o documento por conta precisam de políticas de retenção/normalização se o volume crescer. Não há promessa de armazenamento gratuito ilimitado.

## Verificação após publicação
O domínio principal carregou a biblioteca da nuvem e o progresso existente. A imagem carregou e o áudio apresentou readyState=4 sem erro, em produção. Nenhum erro de console observado. Teste no iPhone confirmado pelo usuário.
