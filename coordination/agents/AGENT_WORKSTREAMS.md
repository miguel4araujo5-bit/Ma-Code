# MA-CODE — Agent Workstreams

Registo operacional apenas de trabalho **ativo ou bloqueado** dos agentes. A política de execução aplicável está em `coordination/agents/AGENT_EXECUTION_POLICY.md`.

A `main` remota é sempre a fonte de verdade. Entradas concluídas devem ser removidas assim que o respetivo commit/PR for integrado.

| Fluxo | Problema | Branch | Ficheiros em alteração | Estado | Base remota | Atualizado |
|---|---|---|---|---|---|---|
| F103 | Reservar conteúdos de planificação já associados a aulas planeadas, evitando sugestões duplicadas e mantendo Diário/Calendário/Dashboard coerentes | `work/f103-planification-item-reservations` | `src/components/ma-professor/lessons/lessonRepositoryBase.ts`; `src/components/ma-professor/calendar/calendarWorkspaceRepositoryBase.ts`; `src/components/ma-professor/dashboard/dashboardRepositoryBase.ts`; utilitário/testes de reserva de planificação | EM CURSO | `aa5a37dedf45543491544a817017cc8d80647f50` | 2026-09-13 |

## Regras de utilização

- Registar apenas trabalho que esteja realmente em curso ou bloqueado.
- Não manter linhas de PRs já integrados ou fechados.
- Antes de começar uma tarefa, confirmar a `main` atual e verificar se os ficheiros alvo já estão reservados.
- Um ficheiro ou zona lógica deve ter um único agente escritor de cada vez.
- Ao concluir ou abandonar o trabalho, remover imediatamente a reserva correspondente.
