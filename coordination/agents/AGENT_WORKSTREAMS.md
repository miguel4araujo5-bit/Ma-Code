# MA-CODE — Agent Workstreams

Registo operacional apenas de trabalho **ativo ou bloqueado** dos agentes. A política de execução aplicável está em `coordination/agents/AGENT_EXECUTION_POLICY.md`.

A `main` remota é sempre a fonte de verdade. Entradas concluídas devem ser removidas assim que o respetivo commit/PR for integrado.

| Fluxo | Problema | Branch | Ficheiros em alteração | Estado | Base remota | Atualizado |
|---|---|---|---|---|---|---|
| F103 | Remodelar a revisão semanal do horário: preservar todos os tempos do PDF, editar diretamente cada célula e permitir classificar cada bloco como `Componente letiva` ou `Cargo`, sem editor/tabelas duplicados por baixo | `work/f103-schedule-inline-weekly-review` | `src/components/ma-professor/setup/ScheduleImportVisualGrid.tsx`; `src/components/ma-professor/setup/SchedulePdfImportStep.tsx`; testes de importação do horário | EM CURSO — alteração limitada ao fluxo local de importação/revisão; sem Worker, D1, Durable Objects, sync ou schema | `b53770e526929c597aff2c03491d1301f38d4ac8` | 2026-09-12 |

## Regras de utilização

- Registar apenas trabalho que esteja realmente em curso ou bloqueado.
- Não manter linhas de PRs já integrados ou fechados.
- Antes de começar uma tarefa, confirmar a `main` atual e verificar se os ficheiros alvo já estão reservados.
- Um ficheiro ou zona lógica deve ter um único agente escritor de cada vez.
- Ao concluir ou abandonar o trabalho, remover imediatamente a reserva correspondente.
