# Cadastro público — Brains

Implementação: cadastro e login por e-mail/senha, confirmação e reenvio, recuperação de senha e OAuth Google via Supabase Auth. Senhas novas têm no mínimo 8 caracteres na interface. Login preserva compatibilidade com senhas existentes. Cada usuário continua isolado pelo auth.uid(), com sua própria biblioteca e pasta privada de mídia.

## Configuração para produção
- Supabase → Authentication → Sign In / Providers: permitir cadastro, Email habilitado, confirmação de e-mail mantida.
- URL Configuration: Site URL https://www.heybrains.app/login. Permitir /login e /login?auth=reset nas origens https://heybrains.app, https://www.heybrains.app e https://brains-puce.vercel.app. Manter também / e /?auth=reset para links emitidos antes da mudança. Não usar curinga para domínios de terceiros.
- Configurar SMTP próprio para confirmação, reenvio e recuperação para endereços públicos. O serviço padrão Supabase só envia para membros da equipe; não serve para lançamento público.
- Google Cloud → Google Auth Platform: cliente OAuth do tipo Web, público externo; origens https://heybrains.app e https://www.heybrains.app; redirect URI https://rtbfieorpmevebwlquvs.supabase.co/auth/v1/callback. Usar apenas openid, email e profile. Publicar o consentimento para público externo (modo de testes restringe usuários).
- Cadastrar Client ID e Client Secret no provedor Google do Supabase e ativá-lo. Nunca incluir o secret no frontend ou no GitHub.
- O botão Google consulta /auth/v1/settings e aparece apenas quando o provedor está ativo. Não requer novo deploy ao ativá-lo.

## Retornos
O cliente SPA processa os retornos de confirmação/OAuth com detectSessionInUrl=true. PASSWORD_RECOVERY abre formulário próprio antes da biblioteca; ?auth=reset mantém essa intenção no carregamento. Link inválido exibe mensagem segura. Nenhum parâmetro de redirecionamento arbitrário é aceito pelo formulário.

## Validação pendente de configuração externa
Testar uma conta nova real com confirmação recebida, recuperação por link e login Google em celular e desktop. Conferir usuário A sem acesso à biblioteca do usuário B. Não considerar Google liberado antes da ativação das credenciais. Não considerar entrega pública de e-mails validada sem SMTP e teste de recebimento.

