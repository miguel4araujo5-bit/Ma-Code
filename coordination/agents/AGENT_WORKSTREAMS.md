# MA-CODE — Agent Workstreams

Registo operacional apenas de trabalho **ativo ou bloqueado** dos agentes. A política de execução aplicável está em `coordination/agents/AGENT_EXECUTION_POLICY.md`.

A `main` remota é sempre a fonte de verdade. Entradas concluídas devem ser removidas assim que o respetivo commit/PR for integrado.

| Fluxo | Problema | Branch | Ficheiros em alteração | Estado | Base remota | Atualizado |
|---|---|---|---|---|---|---|
| F103 | Unificar a grelha semanal do Diário para mostrar `Componente letiva` e `Cargo` nas mesmas células/horas e com uma única navegação semanal, preservando o editor pedagógico existente e o sumário independente por ocorrência de Cargo | `work/f103-unified-daily-week` | `src/components/ma-professor/daily/DailyUnifiedWeekOverview.tsx`; `src/components/ma-professor/daily/DailyDutyWeekPanel.tsx`; `src/components/ma-professor/daily/DailyWorkspaceWithDuties.tsx`; `src/components/ma-professor/daily/dailyUnifiedWeek.css`; testes MA-Professor relacionados | EM CURSO — reutilizar `schoolCalendarEvents` e o workspace semanal existente; sem novo schema, Worker, D1, Durable Object, binding, polling ou recurso pago | `7807cf7e1c210cf7b28193ba2ca5d989add14776` | 2026-09-12 |

## Regras de utilização

- Registar apenas trabalho que esteja realmente em curso ou bloqueado.
- Não manter linhas de PRs já integrados ou fechados.
- Antes de começar uma tarefa, confirmar a `main` atual e verificar se os ficheiros alvo já estão reservados.
- Um ficheiro ou zona lógica deve ter um único agente escritor de cada vez.
- Ao concluir ou abandonar o trabalho, remover imediatamente a reserva correspondente.
