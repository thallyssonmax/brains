# Revisão espaçada — contrato atual

Atualizado em 09/11/2026. Fontes: `src/scheduler.ts`, `src/review.ts`, `src/App.tsx` e `package.json`.

5. REVISÃO ESPAÇADA — REGRA IMPLEMENTADA
Biblioteca ts-fsrs 5.4.2.
Configuração: request_retention=0.9; enable_fuzz=false; enable_short_term=false.
Os demais parâmetros e passos são os padrões da versão fixada da biblioteca. Não há otimização personalizada de parâmetros por usuário.
90% é um parâmetro do agendamento, não garantia de retenção.

Fluxo:
1. Abrir a área e tocar em Revisar.
2. Ver a frente e tentar lembrar a resposta.
3. Revelar o verso e conferir a resposta.
4. Com o verso aberto, tocar em **Sei** ou **Não sei** para confirmar.
5. Salvar evento e novo estado FSRS na mesma alteração versionada da biblioteca.

Virar o card não salva a revisão. A tentativa é registrada quando a resposta é confirmada no verso.
Sei → Rating.Good. Não sei → Rating.Again. Difícil/Fácil não são oferecidos.
O FSRS calcula a próxima data conforme estado anterior, resposta e instante da revisão. O agendamento regular fica disponível à meia-noite da data calculada no fuso da conta, a partir do dia seguinte.
Eventos repetidos com o mesmo identificador não duplicam o histórico. Revisões antecipadas ou de cards que deixaram de ser elegíveis são rejeitadas.
O algoritmo roda no cliente; banco mantém o resultado e o histórico. Não existe tarefa agendada do servidor para liberar cada card.

### Reforço no primeiro estudo

- Um card novo é um card sem estado FSRS, independentemente da data de cadastro. Na primeira resposta confirmada, ele é colocado uma vez no fim da sessão, tanto com **Sei** quanto com **Não sei**.
- Um card já estudado só volta na mesma sessão se a primeira resposta daquela sessão for **Não sei**. A tentativa extra recebe uma avaliação real e não gera uma terceira exibição.
- A próxima data vem do FSRS, inclusive quando o aluno acerta as duas tentativas. A volta obrigatória se limita à própria sessão. A revisão seguinte pode cair no dia seguinte ou em uma data posterior.
- A tentativa extra usa `sessionId` e `retryOf`. O agendador exige a sessão original, o mesmo card ativo e uma resposta original que permita repetição. Se o aluno encerrar ou recarregar antes do reforço, vale o agendamento já salvo na primeira tentativa.
- A regra vale a partir do primeiro estudo, inclusive para cards já cadastrados que nunca foram revisados. Cards já estudados mantêm suas datas e seu histórico. A atualização não exige migração de dados nem recálculo em massa.

Fila:
- Apenas cards, áreas e decks técnicos ativos, sem arquivamento ou lixeira.
- Respeita a área escolhida.
- Primeiro todos os cards com agendamento vencido (due <= agora), ordenados pela data mais antiga. Não há prioridade separada por estado de aprendizagem.
- Depois cards sem estado FSRS, ordenados por criação e identificador, até preencher o saldo da meta diária.
- Não antecipa cards futuros para completar a meta.
A sessão é uma lista selecionada ao iniciar. Cards já revisados hoje ficam fora de novas sessões.
Revisões confirmadas persistem. O índice de uma sessão interrompida não é persistido; uma nova sessão recalcula a fila.

6. META E TEMPO
O padrão de uma conta nova é 20 cards distintos por dia. A meta pode variar de 1 a 999 e abrange todas as áreas. As revisões vencidas têm prioridade. Cards novos usam o saldo disponível.
Um card conta uma vez na meta diária. O reforço aumenta o número de tentativas sem ocupar uma segunda vaga.
Primeira revisão introduz o card; o total de introduzidos é calculado pelo histórico do dia.
Dia definido pelo fuso da conta. Alterar fuso reagrupa estatísticas sem mudar os instantes salvos.
Excluir definitivamente cards remove seu histórico e pode reduzir contagens do dia e de introduzidos.
Datas exibidas sem segundos, no fuso salvo; precisão original preservada no agendamento.
Home/área mostram Em dia e próxima revisão quando não há fila; também indicam ausência de cards ou novos disponíveis amanhã conforme o caso.
O relógio da interface é atualizado a cada 30 segundos; listagens consultam a nuvem a cada 15 segundos e ao retornar à aba/conexão. Editor e sessão não são substituídos por atualização de fundo.


## Verificação
scheduler.test.ts: elegibilidade, atraso, novos, idempotência, reforço após o primeiro acerto, contagem diária e rejeição de revisão antecipada.
review.test.ts: contagem distinta, fuso e lados das mídias.
cloud-store.test.ts: recuperação por outra instância, evento/estado e conflitos.
Não há intervalo fixo de 10 minutos. Atualizar a versão de ts-fsrs exige revalidar os resultados e documentar mudanças dos padrões.
O relógio do cliente fornece o instante; alterações incorretas no relógio do aparelho podem afetar a elegibilidade.

17/09/2026 — Revisão diária única: esta regra substitui os retornos intradiários anteriores. FSRS 5.4.2 com enable_short_term=false; próxima data nunca anterior ao início do dia seguinte no fuso da conta. Primeiro erro confirmado adiciona uma única tentativa ao fim da sessão. A repetição (acerto ou erro) também é registrada, sem gerar terceira tentativa. Eventos guardam sessionId e retryOf; somente a sessão original pode repetir, com validação de origem, card ativo e ausência de repetição prévia. Sair/atualizar encerra a sessão; o card segue para outro dia. Meta conta o card uma vez; tentativas incluem a repetição. Cards já revisados hoje não entram em uma nova sessão, inclusive agendamentos legados intradiários. Datas antigas não são regravadas em massa; exibição e fila respeitam o dia mínimo.

22/09/2026 — Liberação por data: todos os cards previstos para uma data ficam disponíveis desde o início desse dia no fuso da conta. Novos agendamentos são normalizados para 00:00 da data calculada pelo FSRS, nunca antes do dia seguinte à resposta. Fila e exibição normalizam também agendamentos antigos sem regravar o histórico. Em transições sem meia-noite, usa-se o primeiro instante válido do dia. Não requer cron: a disponibilidade é calculada ao consultar a fila, e a interface aberta atualiza o relógio a cada 30 segundos. As demais regras permanecem iguais.
