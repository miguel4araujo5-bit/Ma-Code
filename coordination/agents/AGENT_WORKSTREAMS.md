# MA-CODE — Agent Workstreams

Registo operacional apenas de trabalho **ativo ou bloqueado** dos agentes. A política de execução aplicável está em `coordination/agents/AGENT_EXECUTION_POLICY.md`.

A `main` remota é sempre a fonte de verdade. Entradas concluídas devem ser removidas assim que o respetivo commit/PR for integrado.

| Fluxo | Problema | Branch | Ficheiros em alteração | Estado | Base remota | Atualizado |
|---|---|---|---|---|---|---|
| F103 | Garantir que faltas não geram classificação nem penalização académica; ausência fica pendente até existir avaliação efetiva, sem distinguir justificada/injustificada no cálculo | `work/f103-absence-no-grade-penalty` | `src/components/ma-professor/daily/dailyCriteriaGridRepository.ts`; `src/components/ma-professor/assessments/assessmentWorkspaceRepository.ts`; `src/components/ma-professor/assessments/lessonGradeCalculation.ts`; testes de avaliação | EM CURSO | `edb1f336f50ea8d5e8c65efd3e1f5ffc1c26d3c5` | 2026-09-13 |

## Regras de utilização

- Registar apenas trabalho que esteja realmente em curso ou bloqueado.
- Não manter linhas de PRs já integrados ou fechados.
- Antes de começar uma tarefa, confirmar a `main` atual e verificar se os ficheiros alvo já estão reservados.
- Um ficheiro ou zona lógica deve ter um único agente escritor de cada vez.
- Ao concluir ou abandonar o trabalho, remover imediatamente a reserva correspondente.
