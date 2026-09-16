# Supabase — implementação atual
Atualizado em 16/09/2026. Projeto rtbfieorpmevebwlquvs.
A proposta inicial normalizada e o fluxo antigo brains_sync são históricos; não orientam o cliente atual.
Fluxo ativo: CloudStore → brains_cloud (JSONB por usuário) → brains_cloud_save, com versão esperada e operation_id idempotente.
Bucket brains-media privado para arquivos; referências no documento; ownership por usuário e políticas RLS.
Migração brains_media_cleanup aplicada: fila brains_media_gc, trigger de referências, claim e finish. Exclusão física pela API Storage, não DELETE em storage.objects.
Consultar ../CLOUD-FIRST.md e ../MEDIA-CLEANUP.md para detalhes e evidências.
Não reaplicar SQL antigo indiscriminadamente nem remover tabelas legadas sem migração explícita.
Histórico: modelo inicial aplicado em 14/09, substituído no cliente pela persistência direta na nuvem publicada em 16/09.
Isolamento autenticado/anônimo e exclusão de mídia foram verificados; usuário confirmou operação entre iPhone e navegador.
Aviso conhecido: proteção contra senhas vazadas desativada por decisão anterior do usuário.
Nunca colocar chaves administrativas no frontend.
