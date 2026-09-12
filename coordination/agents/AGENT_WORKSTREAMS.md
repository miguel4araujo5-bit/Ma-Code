# MA-CODE — Agent Workstreams

Registo operacional apenas de trabalho **ativo ou bloqueado** dos agentes. A política de execução aplicável está em `coordination/agents/AGENT_EXECUTION_POLICY.md`.

A `main` remota é sempre a fonte de verdade. Entradas concluídas devem ser removidas assim que o respetivo commit/PR for integrado.

| Fluxo | Problema | Branch | Ficheiros em alteração | Estado | Base remota | Atualizado |
|---|---|---|---|---|---|---|
| F103 | Dar sumário real aos blocos `Cargo` importados sem criar disciplinas/UFCD falsas: manter os cargos fora da avaliação, reutilizar as ocorrências locais já criadas no calendário e expô-las no fluxo diário com gravação própria de sumário | `work/f103-duty-summaries` | `src/components/ma-professor/daily/*`; `src/components/ma-professor/setup/scheduleImportAtomicRepository.ts`; testes MA-Professor relacionados | EM CURSO — solução local-first sobre `schoolCalendarEvents`; sem novo Worker, D1, Durable Object, binding, polling ou recurso pago | `6878b3dfc13def79e1046e544118f85120ab88c1` | 2026-09-12 |

## Regras de utilização

- Registar apenas trabalho que esteja realmente em curso ou bloqueado.
- Não manter linhas de PRs já integrados ou fechados.
- Antes de começar uma tarefa, confirmar a `main` atual e verificar se os ficheiros alvo já estão reservados.
- Um ficheiro ou zona lógica deve ter um único agente escritor de cada vez.
- Ao concluir ou abandonar o trabalho, remover imediatamente a reserva correspondente.
