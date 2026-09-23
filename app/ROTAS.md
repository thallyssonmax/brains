# Rotas públicas e produto

## Jornada
- `/`: landing existente (HTML estático, sem carregar biblioteca nem cliente Supabase).
- `/login`: autenticação, cadastro e recuperação existentes. Usuário autenticado segue para `/home`, exceto ao redefinir senha.
- `/home`: Today.
- `/areas`: áreas; `/areas/:areaId`: cards da área, com o ID já persistido.
- `/settings`: configurações e logout.
- Rotas internas sem sessão vão para `/login`. Após login, o destino é `/home`.
- URLs desconhecidas exibem página não encontrada; caminhos antigos `/today`, `/decks`, `/app`, `/site` e `/conheca` têm redirects de compatibilidade.

## Implementação
`index.html` é a landing; `product.html` carrega a aplicação React. Não há duas cópias da landing. Os arquivos em `public/site` são seus assets e o antigo HTML é apenas fallback de redirecionamento. Vite gera as duas entradas; `vercel.json` mantém os arquivos estáticos e resolve acesso direto/refresh da SPA. O servidor local usa o mesmo fallback.

`routes.ts` centraliza caminhos, reconhecimento de áreas e retornos de autenticação; React Router gerencia histórico e bloqueio de navegação durante edição. `AuthGate` aguarda a sessão antes de liberar a aplicação. Navegar entre páginas não recria a conta nem a biblioteca. Editor e sessão de revisão continuam transitórios: atualizar a página volta à área; rascunhos persistidos podem ser retomados e respostas já confirmadas continuam no banco, como antes.

Os retornos de OAuth, confirmação e recuperação agora são `/login`. Links antigos na raiz são encaminhados ao login preservando query e fragmento, para não perder tokens. Não se aceita destino arbitrário vindo da URL.

## Dados e segurança
Nenhuma migration, alteração de schema/RPC/RLS, ID ou documento é necessária. `brains_cloud` continua por `user_id` com documento JSONB e versão; cards, áreas, decks, reviews e memória FSRS permanecem no mesmo documento. A RPC de escrita versionada e as políticas `auth.uid() = user_id` não mudam. Mídia permanece no bucket privado e rascunhos/uploads no IndexedDB por conta.

O guard do frontend controla a experiência; a autorização de dados continua no Supabase/RLS. Não existe migração automática nem substituição da biblioteca ao entrar no novo domínio. Sessões e rascunhos locais pertencem à origem: trocar de domínio pode exigir novo login; pendências locais do domínio antigo devem ser concluídas nele. Por isso, o domínio antigo continua atendendo o mesmo app, sem redirect forçado para outro host.

## Domínio e callbacks
Na Vercel, `heybrains.app` já redireciona para `www.heybrains.app`; essa configuração é preservada. Supabase aceita URLs exatas `/`, `/?auth=reset`, `/login` e `/login?auth=reset` nas duas origens e na antiga `brains-puce.vercel.app`. Site URL: `https://www.heybrains.app/login`.

## Validação e rollback
Antes/depois: comparar versão e fingerprint do documento, contagens de áreas/decks/cards/reviews e referências órfãs com SELECT somente. Navegar com conta existente sem registrar revisão, editar ou salvar preferências durante essa comparação. Usuários ativos podem naturalmente alterar a versão; isso precisa ser distinguido de alterações pelo deploy.

Verificar landing → login → home → areas → settings, acesso direto, refresh, Voltar/Avançar, logout e acesso sem sessão. Validar recuperação com link novo separadamente (não considerar entrega de e-mail validada apenas por testar rotas).

Rollback: reverter somente os arquivos frontend/deploy para o commit anterior. Não restaurar nem sobrescrever o banco. Conservar callbacks antigos permitidos.
