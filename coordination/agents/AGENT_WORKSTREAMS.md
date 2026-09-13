# MA-CODE — Agent Workstreams

Registo operacional apenas de trabalho **ativo ou bloqueado** dos agentes. A política de execução aplicável está em `coordination/agents/AGENT_EXECUTION_POLICY.md`.

A `main` remota é sempre a fonte de verdade. Entradas concluídas devem ser removidas assim que o respetivo commit/PR for integrado.

| Fluxo | Problema | Branch | Ficheiros em alteração | Estado | Base remota | Atualizado |
|---|---|---|---|---|---|---|
| MA-Professor regular | Componente anual técnica para ensino regular sem UFCD/módulo manual | feat/ma-professor-regular-annual-module | setup/regularEducationModules.ts; setup/ModulesSetupCourseSubjectGuard.tsx; lessons/scheduledLessonReconciliation.ts; lessons/lessonRepositoryBase.ts; setup/SetupConfirmationStep.tsx; testes | ATIVO | bc775676651f4ee5be29866132f4e36fcbf86547 | 2026-09-13 |

## Regras de utilização

- Registar apenas trabalho que esteja realmente em curso ou bloqueado.
- Não manter linhas de PRs já integrados ou fechados.
- Antes de começar uma tarefa, confirmar a `main` atual e verificar se os ficheiros alvo já estão reservados.
- Um ficheiro ou zona lógica deve ter um único agente escritor de cada vez.
- Ao concluir ou abandonar o trabalho, remover imediatamente a reserva correspondente.
