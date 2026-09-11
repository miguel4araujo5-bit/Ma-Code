# MA-CODE — Agent Workstreams

Registo operacional apenas de trabalho **ativo ou bloqueado** dos agentes. A política de execução aplicável está em `coordination/agents/AGENT_EXECUTION_POLICY.md`.

A `main` remota é sempre a fonte de verdade. Entradas concluídas devem ser removidas assim que o respetivo commit/PR for integrado.

| Fluxo | Problema | Branch | Ficheiros em alteração | Estado | Base remota | Atualizado |
|---|---|---|---|---|---|---|
| F103 | Permitir selecionar várias turma/disciplina logo na primeira revisão da importação guiada de critérios | `work/f103-criteria-multi-destination-first-pass` | `src/components/ma-professor/setup/GuidedAssessmentCriteriaImportPanel.tsx`; `tests/ma-professor/guided-criteria-multi-destination-first-pass.test.mjs` | EM CURSO — destinos reconhecidos ficam pré-selecionados mas a multi-seleção aparece imediatamente; mantém aplicação batch segura e o fluxo para adicionar outro critério ou seguir em frente | `dd8db68d0d82de4e4bf94e03632a54bfa259a0a2` | 2026-09-11 |

## Regras de utilização

- Registar apenas trabalho que esteja realmente em curso ou bloqueado.
- Não manter linhas de PRs já integrados ou fechados.
- Antes de começar uma tarefa, confirmar a `main` atual e verificar se os ficheiros alvo já estão reservados.
- Um ficheiro ou zona lógica deve ter um único agente escritor de cada vez.
- Ao concluir ou abandonar o trabalho, remover imediatamente a reserva correspondente.
