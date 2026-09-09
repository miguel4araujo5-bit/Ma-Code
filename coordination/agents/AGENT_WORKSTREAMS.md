# MA-CODE — Agent Workstreams

Registo operacional dos agentes 101–103. Preservar entradas alheias e atualizar apenas o fluxo próprio.

| Fluxo | Problema | Branch | Ficheiros em alteração | Estado | Base remota | Atualizado |
|---|---|---|---|---|---|---|
| F101 | Revisão visual da importação de horário em grelha semanal | `work/f101-schedule-import-visual-review` | `src/components/ma-professor/setup/ScheduleImportVisualGrid.tsx` (novo); `tests/ma-professor/schedule-import-visual-grid.test.mjs` (novo); integração final prevista em `src/components/ma-professor/setup/SchedulePdfImportStep.tsx`. | EM CURSO — PR #48/F102 já integrado; branch F101 sincronizada com a nova `main`; falta montar a grelha no ecrã produtivo e revalidar antes de qualquer merge do #49 | `747b9fcfa5ce0d5dea524a7e2aaf1d0960ddab74` | 2026-09-09 |
| F103 | Importação automática e segura de critérios de avaliação por PDF | `work/f103-criteria-pdf-import` | `src/components/ma-professor/setup/AssessmentCriteriaSetupStep.tsx` (integração); novos ficheiros de extração/parser/importação de critérios e testes respetivos | EM CURSO — implementar análise local, proposta editável e criação apenas em destinos sem critérios, sem alterar schema nem Cloudflare | `747b9fcfa5ce0d5dea524a7e2aaf1d0960ddab74` | 2026-09-09 |
