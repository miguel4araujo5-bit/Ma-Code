# MA-CODE — Agent Workstreams

Registo operacional apenas de trabalho **ativo ou bloqueado** dos agentes. A política de execução aplicável está em `coordination/agents/AGENT_EXECUTION_POLICY.md`.

A `main` remota é sempre a fonte de verdade. Entradas concluídas devem ser removidas assim que o respetivo commit/PR for integrado.

| Fluxo | Problema | Branch | Ficheiros em alteração | Estado | Base remota | Atualizado |
|---|---|---|---|---|---|---|
| Agente | Ressincronizar componente anual regular depois de o preset S. Bento criar eventos escolares | `fix/ma-professor-sbento-regular-preset` | `src/components/ma-professor/calendar/initialSchoolCalendar2026_2027.ts`; `tests/ma-professor/regular-school-calendar-preset.test.mjs` | ATIVO | `b3d5f8986309f4b1bd099954c9ee76b7ab99b6e7` | 2026-09-13 |

## Regras de utilização

- Registar apenas trabalho que esteja realmente em curso ou bloqueado.
- Não manter linhas de PRs já integrados ou fechados.
- Antes de começar uma tarefa, confirmar a `main` atual e verificar se os ficheiros alvo já estão reservados.
- Um ficheiro ou zona lógica deve ter um único agente escritor de cada vez.
- Ao concluir ou abandonar o trabalho, remover imediatamente a reserva correspondente.
