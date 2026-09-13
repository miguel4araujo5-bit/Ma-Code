# MA-CODE — Agent Workstreams

Registo operacional apenas de trabalho **ativo ou bloqueado** dos agentes. A política de execução aplicável está em `coordination/agents/AGENT_EXECUTION_POLICY.md`.

A `main` remota é sempre a fonte de verdade. Entradas concluídas devem ser removidas assim que o respetivo commit/PR for integrado.

| Fluxo | Problema | Branch | Ficheiros em alteração | Estado | Base remota | Atualizado |
|---|---|---|---|---|---|---|
| Agente | Escala e experiência de avaliação final no ensino regular sem alterar o motor profissional | `feat/ma-professor-regular-assessment-scale` | `src/components/ma-professor/assessments/*regular*`; `AssessmentWorkspaceView.tsx`; `assessmentWorkspaceRepository.ts`; testes dedicados | ATIVO | `8a465d6490870b2e14e9c69b4ed3eeac5a34235e` | 2026-09-13 |

## Regras de utilização

- Registar apenas trabalho que esteja realmente em curso ou bloqueado.
- Não manter linhas de PRs já integrados ou fechados.
- Antes de começar uma tarefa, confirmar a `main` atual e verificar se os ficheiros alvo já estão reservados.
- Um ficheiro ou zona lógica deve ter um único agente escritor de cada vez.
- Ao concluir ou abandonar o trabalho, remover imediatamente a reserva correspondente.
