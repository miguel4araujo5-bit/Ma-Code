# MA-CODE — Agent Workstreams

Registo operacional apenas de trabalho **ativo ou bloqueado** dos agentes. A política de execução aplicável está em `coordination/agents/AGENT_EXECUTION_POLICY.md`.

A `main` remota é sempre a fonte de verdade. Entradas concluídas devem ser removidas assim que o respetivo commit/PR for integrado.

| Fluxo | Problema | Branch | Ficheiros em alteração | Estado | Base remota | Atualizado |
|---|---|---|---|---|---|---|
| F103 | Unificar o motor de importação dos critérios entre o assistente guiado e a configuração avançada, preservando todas as opções manuais e a pré-visualização | `work/f103-unify-assessment-criteria-import` | `src/components/ma-professor/setup/AssessmentCriteriaPdfImportPanel.tsx`; `tests/ma-professor/assessment-criteria-import-paths.test.mjs` | EM CURSO — análise concluída; alteração limitada ao leitor/resolução comum, sem remover escopo por UFCD, edição manual ou confirmação antes de gravar | `b22d1461a5ba486a0607278575fe39f3134cbd3e` | 2026-09-12 |

## Regras de utilização

- Registar apenas trabalho que esteja realmente em curso ou bloqueado.
- Não manter linhas de PRs já integrados ou fechados.
- Antes de começar uma tarefa, confirmar a `main` atual e verificar se os ficheiros alvo já estão reservados.
- Um ficheiro ou zona lógica deve ter um único agente escritor de cada vez.
- Ao concluir ou abandonar o trabalho, remover imediatamente a reserva correspondente.
