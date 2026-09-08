import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import * as ts from 'typescript'

function transpile(source) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022
    },
    reportDiagnostics: true
  })

  const errors = (output.diagnostics || []).filter(
    item => item.category === ts.DiagnosticCategory.Error
  )

  assert.equal(errors.length, 0)

  return `data:text/javascript;base64,${Buffer.from(
    output.outputText
  ).toString('base64')}`
}

const dbUrl = transpile(`
  const state = () => globalThis.__giaeExplicitState;
  const clone = value => structuredClone(value);

  function cloneLessons() {
    return new Map(
      Array.from(state().lessons.entries()).map(
        ([id, lesson]) => [id, clone(lesson)]
      )
    );
  }

  export const maProfessorDb = {
    lessons: {
      async get(id) {
        const lesson = state().lessons.get(id);
        return lesson ? clone(lesson) : undefined;
      },
      async put(lesson) {
        state().lessons.set(lesson.id, clone(lesson));
      },
      async bulkGet(ids) {
        return ids.map(id => {
          const lesson = state().lessons.get(id);
          return lesson ? clone(lesson) : undefined;
        });
      },
      async bulkPut(lessons) {
        for (const lesson of lessons) {
          state().lessons.set(lesson.id, clone(lesson));
        }
      }
    },
    async transaction(_mode, _tables, callback) {
      const before = cloneLessons();
      try {
        return await callback();
      } catch (error) {
        state().lessons = before;
        throw error;
      }
    }
  };

  export async function openMAProfessorDatabase() {}
`)

const temporalSafetyUrl = transpile(`
  export function assertLessonNotTaughtInFuture(date, status) {
    if (status === 'taught' && date > '2026-09-07') {
      throw new Error('Uma aula futura não pode ser marcada como dada.');
    }
  }
`)

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/giaeExplicitSubmissionRepository.ts',
    import.meta.url
  ),
  'utf8'
)

const runtime = source
  .replaceAll("'./db'", `'${dbUrl}'`)
  .replaceAll(
    "'./lessons/lessonTemporalSafety'",
    `'${temporalSafetyUrl}'`
  )

const module = await import(
  transpile(runtime)
)

function buildLesson({
  id = 'lesson-1',
  summary = 'Sumário S1.',
  updatedAt = 'v2',
  status = 'taught',
  giaeStatus = 'pending',
  date = '2026-09-06'
} = {}) {
  return {
    id,
    academicYearId: 'year-1',
    teachingAssignmentId: 'assignment-1',
    moduleId: 'module-1',
    scheduleSlotId: 'slot-1',
    origin: 'scheduled',
    status,
    date,
    startTime: '09:00',
    endTime: '09:50',
    periodCount: 1,
    countTowardProgress: true,
    plannedActivity: '',
    summary,
    summarySource: 'manual',
    planificationItemIds: [],
    giaeStatus,
    giaeSubmittedAt:
      giaeStatus === 'submitted'
        ? 'submitted-old'
        : null,
    notes: '',
    createdAt: 'created-v1',
    updatedAt
  }
}

function resetState(lessons) {
  globalThis.__giaeExplicitState = {
    lessons: new Map(
      lessons.map(lesson => [
        lesson.id,
        structuredClone(lesson)
      ])
    )
  }

  return globalThis.__giaeExplicitState
}

test(
  'explicitly copied current version can be submitted after an earlier submitted version was edited',
  { concurrency: false },
  async () => {
    const lesson = buildLesson({
      summary: 'Sumário S1 depois da edição.',
      updatedAt: 'v2',
      giaeStatus: 'pending'
    })
    const state = resetState([lesson])
    const repository =
      new module.GIAEExplicitSubmissionRepository()

    const submitted =
      await repository.markSubmitted({
        lessonId: lesson.id,
        expectedUpdatedAt: 'v2'
      })

    assert.equal(
      submitted.giaeStatus,
      'submitted'
    )
    assert.equal(
      state.lessons.get(lesson.id).summary,
      'Sumário S1 depois da edição.'
    )
    assert.notEqual(
      state.lessons.get(lesson.id).updatedAt,
      'v2'
    )
  }
)

test(
  'stale copied version is rejected without changing persisted state',
  { concurrency: false },
  async () => {
    const lesson = buildLesson({
      updatedAt: 'v2'
    })
    const state = resetState([lesson])
    const repository =
      new module.GIAEExplicitSubmissionRepository()

    await assert.rejects(
      () => repository.markSubmitted({
        lessonId: lesson.id,
        expectedUpdatedAt: 'v1'
      }),
      /alterada.*cópia|copie novamente/i
    )

    assert.equal(
      state.lessons.get(lesson.id).giaeStatus,
      'pending'
    )
    assert.equal(
      state.lessons.get(lesson.id).updatedAt,
      'v2'
    )
  }
)

test(
  'bulk explicit submission is all-or-nothing when one copied version is stale',
  { concurrency: false },
  async () => {
    const first = buildLesson({
      id: 'lesson-1',
      updatedAt: 'a-v2'
    })
    const second = buildLesson({
      id: 'lesson-2',
      updatedAt: 'b-v2'
    })
    const state = resetState([
      first,
      second
    ])
    const repository =
      new module.GIAEExplicitSubmissionRepository()

    await assert.rejects(
      () => repository.markManySubmitted([
        {
          lessonId: first.id,
          expectedUpdatedAt: 'a-v2'
        },
        {
          lessonId: second.id,
          expectedUpdatedAt: 'b-v1'
        }
      ]),
      /alterada.*cópia|copie novamente/i
    )

    assert.equal(
      state.lessons.get(first.id).giaeStatus,
      'pending'
    )
    assert.equal(
      state.lessons.get(second.id).giaeStatus,
      'pending'
    )
  }
)

test(
  'bulk explicit submission validates every version before one atomic write',
  { concurrency: false },
  async () => {
    const first = buildLesson({
      id: 'lesson-1',
      updatedAt: 'a-v2'
    })
    const second = buildLesson({
      id: 'lesson-2',
      updatedAt: 'b-v2'
    })
    const state = resetState([
      first,
      second
    ])
    const repository =
      new module.GIAEExplicitSubmissionRepository()

    const submitted =
      await repository.markManySubmitted([
        {
          lessonId: first.id,
          expectedUpdatedAt: 'a-v2'
        },
        {
          lessonId: second.id,
          expectedUpdatedAt: 'b-v2'
        }
      ])

    assert.equal(submitted.length, 2)
    assert.equal(
      state.lessons.get(first.id).giaeStatus,
      'submitted'
    )
    assert.equal(
      state.lessons.get(second.id).giaeStatus,
      'submitted'
    )
    assert.equal(
      state.lessons.get(first.id).updatedAt,
      state.lessons.get(second.id).updatedAt
    )
  }
)

test(
  'duplicate lessons in one explicit bulk request are rejected',
  { concurrency: false },
  async () => {
    const lesson = buildLesson()
    const state = resetState([lesson])
    const repository =
      new module.GIAEExplicitSubmissionRepository()

    await assert.rejects(
      () => repository.markManySubmitted([
        {
          lessonId: lesson.id,
          expectedUpdatedAt: 'v2'
        },
        {
          lessonId: lesson.id,
          expectedUpdatedAt: 'v2'
        }
      ]),
      /mesma aula.*duas vezes/i
    )

    assert.equal(
      state.lessons.get(lesson.id).giaeStatus,
      'pending'
    )
  }
)

test(
  'future or non-taught lessons cannot use the explicit GIAE path',
  { concurrency: false },
  async () => {
    const future = buildLesson({
      id: 'future',
      date: '2026-09-08',
      updatedAt: 'future-v1'
    })
    const planned = buildLesson({
      id: 'planned',
      status: 'planned',
      updatedAt: 'planned-v1'
    })
    resetState([
      future,
      planned
    ])
    const repository =
      new module.GIAEExplicitSubmissionRepository()

    await assert.rejects(
      () => repository.markSubmitted({
        lessonId: future.id,
        expectedUpdatedAt: 'future-v1'
      }),
      /futura/i
    )

    await assert.rejects(
      () => repository.markSubmitted({
        lessonId: planned.id,
        expectedUpdatedAt: 'planned-v1'
      }),
      /aulas dadas com sumário/i
    )
  }
)

test(
  'the new contract is opt-in and does not replace automatic Daily or Calendar submission paths',
  async () => {
    const [
      baseSource,
      dailySource,
      calendarSource
    ] = await Promise.all([
      readFile(
        new URL(
          '../../src/components/ma-professor/lessons/lessonRepositoryBase.ts',
          import.meta.url
        ),
        'utf8'
      ),
      readFile(
        new URL(
          '../../src/components/ma-professor/daily/dailyWorkspaceRepository.ts',
          import.meta.url
        ),
        'utf8'
      ),
      readFile(
        new URL(
          '../../src/components/ma-professor/calendar/LessonEditorDialogBase.tsx',
          import.meta.url
        ),
        'utf8'
      )
    ])

    assert.match(
      baseSource,
      /giaeInvalidatedAt/
    )
    assert.match(
      baseSource,
      /invalidatedAt[\s\S]*lesson\.updatedAt[\s\S]*return lesson/
    )
    assert.doesNotMatch(
      dailySource,
      /giaeExplicitSubmissionRepository/
    )
    assert.doesNotMatch(
      calendarSource,
      /giaeExplicitSubmissionRepository/
    )
  }
)
