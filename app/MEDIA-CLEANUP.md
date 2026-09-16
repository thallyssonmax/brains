# Limpeza de mídias e exclusão definitiva de áreas

Estado: implementação validada; banco preparado. Publicação autorizada em 16/09/2026.

Validação: 59 testes aprovados, TypeScript e build concluídos.

## Experiência
- Em Hoje/Áreas → Lixeira → Gerenciar área, a ação Excluir definitivamente aparece junto de Restaurar.
- A confirmação mostra o nome da área e o total de cards. A exclusão inclui todos os cards (ativos, arquivados e na lixeira), baralhos internos, revisões e rascunhos vinculados.
- Apenas áreas na lixeira podem ser excluídas definitivamente. A versão da biblioteca impede sobrescrever alterações de outro aparelho.
- Mover para a lixeira não remove arquivos. Arquivos compartilhados com qualquer card restante, inclusive arquivado ou na lixeira, são preservados.

## Persistência e limpeza
- O trigger brains_track_media compara referências antigas e novas do documento da conta. Arquivos sem referência entram em brains_media_gc na mesma transação da alteração.
- A fila fica no servidor. Pode ser retomada em outro aparelho da mesma conta; não depende do armazenamento local.
- O cliente processa lotes de até 50 arquivos, ao abrir o app, após alterações e nas tentativas periódicas com o app aberto e conectado. Não há execução agendada no servidor enquanto todos os aparelhos estão fechados.
- brains_claim_media_gc bloqueia a conta durante a conferência e marca os caminhos como retirados. A gravação de biblioteca recusa reutilizar esses caminhos, evitando corrida entre exclusão e edição antiga.
- Storage remove() realiza a exclusão física. A política exige propriedade, caminho retirado e ausência de referências na biblioteca; a política de INSERT bloqueia reenviar caminhos retirados.
- brains_finish_media_gc só conclui a fila depois de confirmar a ausência do objeto. Falhas não desfazem a alteração do card/área; a limpeza continua pendente e pode ser repetida.
- Uploads abandonados sem referência são incluídos somente depois de 24 horas; uploads recentes não entram nessa varredura.
- Rascunhos de áreas que deixaram de existir são removidos localmente na próxima leitura da biblioteca, inclusive em outro aparelho. Uma resposta antiga de rede não pode descartar rascunhos de uma área nova.
- Backups já baixados não são alterados. Restaurar um backup com arquivos cria novos caminhos.

## Verificação
- Testes unitários cobrem área ativa, versão antiga, remoção em cascata, preservação de outra área/histórico, mídia na lixeira, compartilhamento de arquivo, falha e retomada de limpeza, rascunhos de outro aparelho e resposta antiga de rede.
- SQL autenticado em transações revertidas verificou fila, referências vivas, proibição de reutilização e conclusão. Outra conta não lê/altera a fila. Acesso anon às funções/tabela está bloqueado.
- Advisor não encontrou novos problemas de RLS; permanece apenas o aviso de proteção contra senhas vazadas já conhecido.
- Interface local autenticada: foi criada a área de teste Teste de exclusão 1609 e um card temporário com imagem. A área foi movida para a lixeira e a confirmação foi inspecionada, sem confirmar a exclusão por UI. Essa área fica disponível para validação do usuário após publicar.
- A limpeza automática local concluiu dois arquivos antigos sem referência no Supabase real. A consulta confirmou completed=2 e nenhum desses objetos permaneceu no Storage.
- Remoção física usa a API do Storage; não se faz DELETE SQL em storage.objects: https://supabase.com/docs/guides/storage/management/delete-objects

## Arquivos principais
- src/cloud-store.ts: cascata, fila, reenvio da limpeza e rascunhos.
- src/App.tsx, src/CloudStatus.tsx, src/i18n.ts: ações, confirmação e mensagens pt/en/es.
- supabase/media-cleanup.sql: migração aplicada brains_media_cleanup.
- src/cloud-store.test.ts: regressões.
