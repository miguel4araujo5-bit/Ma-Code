# Sequência prevista e contabilização confirmada das aulas

Ao abrir uma aula vazia da UFCD seguinte, a seleção automática usava apenas os tempos submetidos no GIAE. Uma última aula ainda pendente podia fazer a aula seguinte regressar à UFCD anterior.

A atribuição automática passa a reservar os tempos das aulas anteriores, incluindo as pendentes, excluindo aulas bloqueadas e explicitamente não contabilizáveis. A numeração usa a mesma sequência: cinzenta com «prevista» enquanto pendente, verde depois da submissão. Submeter uma aula não renumera as seguintes. O progresso efetivo continua a depender exclusivamente do visto GIAE.

Não há migração, campos novos nos registos guardados, alterações à cifra, formato das cópias, autenticação ou serviços Cloudflare. O indicador de confirmação é calculado no contexto do editor. A proteção existente de sumários, notas, atividades, faltas, avaliações e reservas de planificação mantém-se; só uma aula vazia elegível pode ter a UFCD ajustada.

## Validação

- O teste de regressão reproduziu o problema antes da correção na mesma estrutura de dados da versão atual.
- Conta fictícia: três UFCDs de 30 tempos, 29 aulas anteriores (20 submetidas e nove pendentes), última aula às 15h, UFCD seguinte às 16h, sumários e atividades futuras preparados, faltas, avaliações, classificação final e planificação reservada.
- Comparação de todas as tabelas antes/depois de abrir as aulas e depois de fechar/reabrir a base: nenhum registo alterado no cenário corretamente configurado.
- Bloqueio/exclusão e aula adicional: só muda a UFCD da aula vazia quando necessário; os restantes dados permanecem iguais.
- Numeração prevista/confirmada, intervalos de vários tempos, independência entre disciplinas e contabilização real mantida após submissão explícita.
- Ensaio Chromium integrado acrescentado à navegação existente: cinzento/verde com o mesmo número e retorno ao estado pendente após recarregar.

Os testes usam dados fictícios e IndexedDB isolado. Não constituem ensaio na conta real nem num Safari/iPhone físico. Resultados finais do CI e integração/publicação devem ser consultados na PR desta alteração.
