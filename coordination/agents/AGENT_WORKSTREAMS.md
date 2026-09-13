# MA-CODE — Agent Workstreams

Registo operacional apenas de trabalho **ativo ou bloqueado** dos agentes. A política de execução aplicável está em `coordination/agents/AGENT_EXECUTION_POLICY.md`.

A `main` remota é sempre a fonte de verdade. Entradas concluídas devem ser removidas assim que o respetivo commit/PR for integrado.

| Fluxo | Problema | Branch | Ficheiros em alteração | Estado | Base remota | Atualizado |
|---|---|---|---|---|---|---|
| Recuperações | Até 3 tentativas estruturadas e encaminhamento para exame | feat/ma-professor-recovery-attempts | `src/components/ma-professor/types.ts`; `src/components/ma-professor/attendance/*`; testes MA-Professor | ATIVO | `main` | 2026-09-13 |
| Planificações | Expor Excel em todos os seletores normais que já usam o parser comum | fix/ma-professor-planification-excel-picker | `src/components/ma-professor/setup/ModulePlanificationImportPanelLegacy.tsx`; `src/components/ma-professor/planifications/PlanificationPdfImportPanel.tsx`; testes MA-Professor | ATIVO | `main` | 2026-09-13 |

## Regras de utilização

- Registar apenas trabalho que esteja realmente em curso ou bloqueado.
- Não manter linhas de PRs já integrados ou fechados.
- Antes de começar uma tarefa, confirmar a `main` atual e verificar se os ficheiros alvo já estão reservados.
- Um ficheiro ou zona lógica deve ter um único agente escritor de cada vez.
- Ao concluir ou abandonar o trabalho, remover imediatamente a reserva correspondente.