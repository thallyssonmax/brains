# Revisão espaçada — contrato atual

Atualizado em 16/09/2026. Fontes: src/scheduler.ts, src/review.ts, src/App.tsx e package.json.

5. REVISÃO ESPAÇADA — REGRA IMPLEMENTADA
Biblioteca ts-fsrs 5.4.2.
Configuração: request_retention=0.9; enable_fuzz=false; enable_short_term=true.
Os demais parâmetros e passos são os padrões da versão fixada da biblioteca. Não há otimização personalizada de parâmetros por usuário.
90% é um parâmetro do agendamento, não garantia de retenção.

Fluxo:
1. Abrir a área e tocar em Revisar.
2. Ver a frente, tentar lembrar e escolher Sei ou Não sei.
3. Conferir o verso; a avaliação ainda pode ser alterada.
4. Tocar em Próximo card para confirmar.
5. Salvar evento e novo estado FSRS na mesma alteração versionada da biblioteca.
Virar o card não salva a revisão. Sair antes de Próximo card não registra a tentativa.
Sei → Rating.Good. Não sei → Rating.Again. Difícil/Fácil não são oferecidos.
O FSRS calcula a próxima data conforme estado anterior, resposta e instante da revisão. Aprendizagem/reaprendizagem podem retornar no mesmo dia.
NÃO existe regra fixa de 10 minutos nem sequência universal de dias. Essa proposta antiga foi substituída pelos resultados da biblioteca.
Eventos repetidos com o mesmo identificador não duplicam o histórico. Revisões antecipadas ou de cards que deixaram de ser elegíveis são rejeitadas.
O algoritmo roda no cliente; banco mantém o resultado e o histórico. Não existe tarefa agendada do servidor para liberar cada card.

Fila:
- Apenas cards, áreas e decks técnicos ativos, sem arquivamento ou lixeira.
- Respeita a área escolhida.
- Primeiro todos os cards com agendamento vencido (due <= agora), ordenados pela data mais antiga. Não há prioridade separada por estado de aprendizagem.
- Depois cards sem estado FSRS, ordenados por criação e identificador, respeitando o saldo global de novos do dia.
- Não antecipa cards futuros para completar a meta.
A sessão é uma lista selecionada ao iniciar. Cards que vencem depois precisam de uma nova entrada na revisão; não são reinseridos automaticamente na sessão já aberta.
Revisões confirmadas persistem. O índice de uma sessão interrompida não é persistido; uma nova sessão recalcula a fila.

6. META E TEMPO
Padrão de conta nova: meta 20 cards distintos/dia; limite 5 novos/dia. Preferências existentes não são sobrescritas.
Meta permitida: 1 a 999. Limite de novos: 0 a 999.
Meta e limite abrangem todas as áreas. Meta não bloqueia revisões vencidas e não altera datas.
Um card conta uma vez por dia; repetições aumentam tentativas. Novos contam também na meta.
Primeira revisão introduz o card; o total de introduzidos é calculado pelo histórico do dia.
Dia definido pelo fuso da conta. Alterar fuso reagrupa estatísticas sem mudar os instantes salvos.
Excluir definitivamente cards remove seu histórico e pode reduzir contagens do dia e de introduzidos.
Datas exibidas sem segundos, no fuso salvo; precisão original preservada no agendamento.
Home/área mostram Em dia e próxima revisão quando não há fila; também indicam ausência de cards ou novos disponíveis amanhã conforme o caso.
O relógio da interface é atualizado a cada 30 segundos; listagens consultam a nuvem a cada 15 segundos e ao retornar à aba/conexão. Editor e sessão não são substituídos por atualização de fundo.


## Verificação
scheduler.test.ts: elegibilidade, atraso, novos, idempotência e rejeição de revisão antecipada.
review.test.ts: contagem distinta, fuso e lados das mídias.
cloud-store.test.ts: recuperação por outra instância, evento/estado e conflitos.
Não há intervalo fixo de 10 minutos. Atualizar a versão de ts-fsrs exige revalidar os resultados e documentar mudanças dos padrões.
O relógio do cliente fornece o instante; alterações incorretas no relógio do aparelho podem afetar a elegibilidade.
