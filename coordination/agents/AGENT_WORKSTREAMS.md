# MA-CODE — Agent Workstreams

Registo operacional dos agentes 101–103. Preservar entradas alheias e atualizar apenas o fluxo próprio.

| Fluxo | Problema | Branch | Ficheiros em alteração | Estado | Base remota | Atualizado |
|---|---|---|---|---|---|---|
| F101 | Ao carregar em “Copiar” no sumário, marcar imediatamente “Submetido no GIAE”, incluindo aulas futuras | `work/f101-copy-giae-submit` | `src/components/ma-professor/daily/dailyGIAEAuto.ts`; `tests/ma-professor/daily-giae-auto.test.mjs` | EM CURSO — remover a exceção de aula futura do fluxo de cópia, preservando a submissão explícita protegida já existente | `0d17001e2b664db92a0078d47438248f71eea50e` | 2026-09-10 |
| F103 | Corrigir dados antigos em que AP/TAP ficou persistido como disciplina e impedir que seja usado no passo UFCD/módulos | `work/f103-legacy-course-subject-repair` | `src/components/ma-professor/setup/ModulesSetupCourseSubjectGuard.tsx` (novo); `src/components/ma-professor/setup/SetupWizard.tsx`; `tests/ma-professor/setup-course-subject-import-correction.test.mjs` | VALIDADO — AP/TAP/Apoio Psicossocial legado é excluído apenas da projeção usada no passo UFCD, sem apagar/reassociar dados; aviso explícito permite regressar a Disciplinas; Build Check #1717 passou Conquistador, MA-Professor, MA-Quadro e build; PR #52 aguarda autorização explícita para merge | `cda368b3e07ec50972776ff647d432d29fcf4166` | 2026-09-09 |
