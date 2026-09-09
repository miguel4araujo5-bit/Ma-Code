# MA-CODE — Agent Workstreams

Registo operacional dos agentes 101–103. Preservar entradas alheias e atualizar apenas o fluxo próprio.

| Fluxo | Problema | Branch | Ficheiros em alteração | Estado | Base remota | Atualizado |
|---|---|---|---|---|---|---|
| F101 | Revisão visual da importação de horário em grelha semanal | `work/f101-schedule-import-visual-review` | `src/components/ma-professor/setup/ScheduleImportVisualGrid.tsx` (novo); `tests/ma-professor/schedule-import-visual-grid.test.mjs` (novo); integração final prevista em `src/components/ma-professor/setup/SchedulePdfImportStep.tsx`. | EM CURSO — PR #48/F102 já integrado; branch F101 sincronizada com a nova `main`; falta montar a grelha no ecrã produtivo e revalidar antes de qualquer merge do #49 | `747b9fcfa5ce0d5dea524a7e2aaf1d0960ddab74` | 2026-09-09 |
| F103 | Corrigir dados antigos em que AP/TAP ficou persistido como disciplina e impedir que seja usado no passo UFCD/módulos | `work/f103-legacy-course-subject-repair` | `src/components/ma-professor/setup/ModulesSetupCourseSubjectGuard.tsx` (novo); `src/components/ma-professor/setup/SetupWizard.tsx`; `tests/ma-professor/setup-course-subject-import-correction.test.mjs` | EM CURSO — AP/TAP legado é excluído apenas da projeção usada no passo UFCD, sem apagar/reassociar dados; aviso explícito permite regressar a Disciplinas para correção humana | `cda368b3e07ec50972776ff647d432d29fcf4166` | 2026-09-09 |
