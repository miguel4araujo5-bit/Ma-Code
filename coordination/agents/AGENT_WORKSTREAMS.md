# MA-CODE — Agent Workstreams

Registo operacional apenas de trabalho **ativo ou bloqueado** dos agentes. A política de execução aplicável está em `coordination/agents/AGENT_EXECUTION_POLICY.md`.

A `main` remota é sempre a fonte de verdade. Entradas concluídas devem ser removidas assim que o respetivo commit/PR for integrado.

| Fluxo | Problema | Branch | Ficheiros em alteração | Estado | Base remota | Atualizado |
|---|---|---|---|---|---|---|
| Avaliação regular | Suporte qualitativo do 1.º ciclo no fecho da disciplina | feat/ma-professor-first-cycle-qualitative-assessment | `types.ts`; `assessments/*`; `settings/csvExport.ts`; testes MA-Professor | ATIVO | `main` | 2026-09-13 |
| Importação de planificações | Fixar em CI a estrutura real do DOCX 12.º D · Área de Expressões sem guardar o documento escolar | test/ma-professor-real-12d-docx-regression-v2 | `tests/ma-professor/module-planification-docx-wrapped-cells.test.mjs` | ATIVO | `main` | 2026-09-13 |

## Regras de utilização

- Registar apenas trabalho que esteja realmente em curso ou bloqueado.
- Não manter linhas de PRs já integrados ou fechados.
- Antes de começar uma tarefa, confirmar a `main` atual e verificar se os ficheiros alvo já estão reservados.
- Um ficheiro ou zona lógica deve ter um único agente escritor de cada vez.
- Ao concluir ou abandonar o trabalho, remover imediatamente a reserva correspondente.
