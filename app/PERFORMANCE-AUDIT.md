# Auditoria de desempenho — 9 de outubro de 2026

## Alterações

- Carregamento sob demanda do aplicativo após autenticação, do editor e da visualização de mídia. Login e painel não carregam antecipadamente o detector de idiomas.
- Reutilização limitada a 32 formatadores de data por fuso. Nenhum dado pessoal é armazenado nesse cache.
- Índices temporários de áreas, decks e última revisão por card substituem buscas repetidas na montagem da fila.
- Memoização do resumo de estudo por biblioteca/horário e da detecção de idioma por texto/idioma. Mudanças nos dados continuam invalidando os cálculos.

## Medições locais

| Medida | Antes | Depois |
| --- | --- | --- |
| JavaScript inicial do produto, gzip (Vite) | 513,35 KB | 170,96 KB |
| Cálculo da fila: 200 cards e 2.000 eventos | 640 ms | 17 ms |

Benchmark sintético em Node 24, mesma máquina e dados, comparando a versão anterior com a otimizada. A ordem resultante foi idêntica. Tempos não representam a latência completa em produção ou no iPhone. O painel autenticado carrega também o módulo App (25,34 KB gzip). Mídia (317 KB gzip) e dicionário (961 KB gzip, já separado anteriormente) continuam disponíveis sob demanda; seus tamanhos totais não foram reduzidos.

## Validação e limites

TypeScript, build e 129 testes aprovados, incluindo fila com histórico grande, agendamentos, metas, autenticação, persistência e áudio. Não houve mudança no banco, nas regras FSRS, no histórico, nas cotas ou nas funcionalidades.

A auditoria concentrou-se em carregamento e cálculos do frontend. Latência de serviços de IA, consultas do banco e experiência real em rede móvel não foram medidas nesta etapa. A primeira abertura do editor/revisão ainda precisa baixar o módulo de mídia; aberturas seguintes reutilizam o módulo.
