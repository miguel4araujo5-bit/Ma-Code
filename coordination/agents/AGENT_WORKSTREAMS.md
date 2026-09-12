# MA-CODE — Agent Workstreams

Registo operacional apenas de trabalho **ativo ou bloqueado** dos agentes. A política de execução aplicável está em `coordination/agents/AGENT_EXECUTION_POLICY.md`.

A `main` remota é sempre a fonte de verdade. Entradas concluídas devem ser removidas assim que o respetivo commit/PR for integrado.

| Fluxo | Problema | Branch | Ficheiros em alteração | Estado | Base remota | Atualizado |
|---|---|---|---|---|---|---|
| F103 | Expor no Dashboard os `Cargo` já ocorridos que continuam sem sumário, reutilizando `schoolCalendarEvents` e o parser partilhado de Cargo, sem criar entidades pedagógicas falsas nem alterar avaliação/GIAE | `work/f103-dashboard-duty-pending` | `src/components/ma-professor/dashboard/DashboardDutyPendingPanel.tsx`; `src/components/ma-professor/dashboard/DashboardView.tsx`; testes MA-Professor relacionados | EM CURSO — leitura local de eventos existentes; sem novo schema, Worker, D1, Durable Object, binding, polling ou recurso pago | `dbed249893edbab4a2e4125105df1e58f6d2e2c3` | 2026-09-12 |

## Regras de utilização

- Registar apenas trabalho que esteja realmente em curso ou bloqueado.
- Não manter linhas de PRs já integrados ou fechados.
- Antes de começar uma tarefa, confirmar a `main` atual e verificar se os ficheiros alvo já estão reservados.
- Um ficheiro ou zona lógica deve ter um único agente escritor de cada vez.
- Ao concluir ou abandonar o trabalho, remover imediatamente a reserva correspondente.
