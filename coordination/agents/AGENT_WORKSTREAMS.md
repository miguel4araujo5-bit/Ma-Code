# MA-CODE — Agent Workstreams

Registo operacional apenas de trabalho **ativo ou bloqueado** dos agentes. A política de execução aplicável está em `coordination/agents/AGENT_EXECUTION_POLICY.md`.

A `main` remota é sempre a fonte de verdade. Entradas concluídas devem ser removidas assim que o respetivo commit/PR for integrado.

| Fluxo | Problema | Branch | Ficheiros em alteração | Estado | Base remota | Atualizado |
|---|---|---|---|---|---|---|
| F103 | Integrar os blocos `Cargo` no fluxo Diário semanal, para que fiquem acessíveis juntamente com as componentes letivas e permitam abrir/editar o respetivo sumário por ocorrência, reutilizando `schoolCalendarEvents` sem criar disciplinas/UFCD/avaliações falsas | `work/f103-daily-duty-blocks` | `src/components/ma-professor/daily/DailyDutyWeekPanel.tsx`; `src/components/ma-professor/daily/DailyWorkspaceWithDuties.tsx`; `src/components/ma-professor/calendar/dutyEvent.ts`; `src/components/ma-professor/product/MAProfessorProduct.tsx`; testes MA-Professor relacionados | EM CURSO — reutilizar persistência local existente; sem novo schema, Worker, D1, Durable Object, binding, polling ou recurso pago | `07c06dec8cdca665f44c38c333625c6e867f6a86` | 2026-09-12 |

## Regras de utilização

- Registar apenas trabalho que esteja realmente em curso ou bloqueado.
- Não manter linhas de PRs já integrados ou fechados.
- Antes de começar uma tarefa, confirmar a `main` atual e verificar se os ficheiros alvo já estão reservados.
- Um ficheiro ou zona lógica deve ter um único agente escritor de cada vez.
- Ao concluir ou abandonar o trabalho, remover imediatamente a reserva correspondente.
