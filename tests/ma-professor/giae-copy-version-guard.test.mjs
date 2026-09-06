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
  const state = () => globalThis.__giaeCopyVersionState;
  const clone = value => structuredClone(value);

  export const maProfessorDb = {
    lessons: {
      async get(id) {
        const lesson = state().lessons.get(id);
        return lesson ? clone(lesson) : undefined;
      }
    },
    async transaction(_mode, _tables, callback) {
      const current = state();
      const previous = current.transactionTail;
      let release;

      current.transactionTail = new Promise(resolve => {
        release = resolve;
      });

      await previous;

      try {
        return await callback();
      } finally {
        release();
      }
    }
  };

  export async function openMAProfessorDatabase() {}
`)

const lessonRepositoryUrl = transpile(`
  const state = () => globalThis.__giaeCopyVersionState;
  const clone = value => structuredClone(value);

  function getLesson(id) {
    const lesson = state().lessons.get(id);
    if (!lesson) {
      throw new Error('A aula indicada não existe.');
    }
    return clone(lesson);
  }

  export const lessonRepository = {
    async markGIAESubmitted(id) {
      const current = state();
      current.singleSubmitCalls += 1;
      const lesson = getLesson(id);
      const updated = {
        ...lesson,
        giaeStatus: 'submitted',
        giaeSubmittedAt: '2026-09-06T20:00:00.000Z',
        updatedAt: 'submitted-v1'
      };
      current.lessons.set(id, updated);
      return clone(updated);
    },

    async markGIAEPending(id) {
      const lesson = getLesson(id);
      const updated = {
        ...lesson,
        giaeStatus: 'pending',
        giaeSubmittedAt: null,
        updatedAt: 'pending-v1'
      };
      state().lessons.set(id, updated);
      return clone(updated);
    },

    async markManyGIAESubmitted(ids) {
      const current = state();
      current.bulkSubmitCalls += 1;
      const results = [];

      for (const id of ids) {
        const lesson = getLesson(id);
        const updated = {
          ...lesson,
          giaeStatus: 'submitted',
          giaeSubmittedAt: '2026-09-06T20:00:00.000Z',
          updatedAt: 'bulk-submitted-v1'
        };
        current.lessons.set(id, updated);
        results.push(clone(updated));
      }

      return results;
    }
  };
`)

const repositorySource = await readFile(
  new URL(
    '../../src/components/ma-professor/giae/giaeWorkspaceRepository.ts',
    import.meta.url
  ),
  'utf8'
)

const viewSource = await readFile(
  new URL(
    '../../src/components/ma-professor/giae/GIAEWorkspaceView.tsx',
    import.meta.url
  ),
  'utf8'
)

const runtime = repositorySource
  .replaceAll("'../db'", `'${dbUrl}'`)
  .replaceAll(
    "'../lessons/lessonRepository'",
    `'${lessonRepositoryUrl}'`
  )

const module = await import(transpile(runtime))

function buildLesson(id, summary, updatedAt) {
  return {
    id,
    academicYearId: 'year-1',
    teachingAssignmentId: 'assignment-1',
    moduleId: 'module-1',
    scheduleSlotId: 'slot-1',
    origin: 'scheduled',
    status: 'taught',
    date: '2026-09-05',
    startTime: '09:00',
    endTime: '09:50',
    periodCount: 1,
    countTowardProgress: true,
    plannedActivity: '',
    summary,
    summarySource: 'manual',
    planificationItemIds: [],
    giaeStatus: 'pending',
    giaeSubmittedAt: null,
    notes: '',
    createdAt: '2026-09-05T09:00:00.000Z',
    updatedAt
  }
}

function resetState(lessons) {
  globalThis.__giaeCopyVersionState = {
    lessons: new Map(
      lessons.map(lesson => [
        lesson.id,
        structuredClone(lesson)
      ])
    ),
    singleSubmitCalls: 0,
    bulkSubmitCalls: 0,
    transactionTail: Promise.resolve()
  }

  return globalThis.__giaeCopyVersionState
}

test(
  'S0 copied then S1 edited cannot be marked submitted without copying again',
  { concurrency: false },
  async () => {
    const original = buildLesson(
      'lesson-1',
      'Sumário S0.',
      'v1'
    )
    const state = resetState([original])
    const repository = new module.GIAEWorkspaceRepository()

    repository.recordCopiedLesson(original)

    state.lessons.set(
      original.id,
      buildLesson(
        original.id,
        'Sumário S1.',
        'v2'
      )
    )

    await assert.rejects(
      () => repository.markSubmitted(original.id),
      /alterado.*copie.*novamente|copie.*novamente.*alterado/i
    )

    assert.equal(state.singleSubmitCalls, 0)
    assert.equal(
      state.lessons.get(original.id).giaeStatus,
      'pending'
    )
  }
)

test(
  'the exact copied version can be marked submitted',
  { concurrency: false },
  async () => {
    const lesson = buildLesson(
      'lesson-1',
      'Sumário confirmado.',
      'v1'
    )
    const state = resetState([lesson])
    const repository = new module.GIAEWorkspaceRepository()

    repository.recordCopiedLesson(lesson)
    const submitted = await repository.markSubmitted(
      lesson.id
    )

    assert.equal(state.singleSubmitCalls, 1)
    assert.equal(submitted.giaeStatus, 'submitted')
    assert.equal(
      state.lessons.get(lesson.id).giaeStatus,
      'submitted'
    )
  }
)

test(
  'recording a successful copy never submits by itself',
  { concurrency: false },
  () => {
    const lesson = buildLesson(
      'lesson-1',
      'Sumário apenas copiado.',
      'v1'
    )
    const state = resetState([lesson])
    const repository = new module.GIAEWorkspaceRepository()

    repository.recordCopiedLesson(lesson)

    assert.equal(state.singleSubmitCalls, 0)
    assert.equal(state.bulkSubmitCalls, 0)
    assert.equal(
      state.lessons.get(lesson.id).giaeStatus,
      'pending'
    )
  }
)

test(
  'bulk submit rejects the whole operation when one copied lesson changed',
  { concurrency: false },
  async () => {
    const first = buildLesson(
      'lesson-1',
      'Primeiro sumário.',
      'v1'
    )
    const second = buildLesson(
      'lesson-2',
      'Segundo sumário.',
      'v1'
    )
    const state = resetState([
      first,
      second
    ])
    const repository = new module.GIAEWorkspaceRepository()

    repository.recordCopiedLessons([
      first,
      second
    ])

    state.lessons.set(
      second.id,
      buildLesson(
        second.id,
        'Segundo sumário alterado.',
        'v2'
      )
    )

    await assert.rejects(
      () =>
        repository.markManySubmitted([
          first.id,
          second.id
        ]),
      /alterado.*copie.*novamente|copie.*novamente.*alterado/i
    )

    assert.equal(state.bulkSubmitCalls, 0)
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
  'bulk submit succeeds when every current lesson matches its copied version',
  { concurrency: false },
  async () => {
    const first = buildLesson(
      'lesson-1',
      'Primeiro sumário.',
      'v1'
    )
    const second = buildLesson(
      'lesson-2',
      'Segundo sumário.',
      'v1'
    )
    const state = resetState([
      first,
      second
    ])
    const repository = new module.GIAEWorkspaceRepository()

    repository.recordCopiedLessons([
      first,
      second
    ])

    const submitted =
      await repository.markManySubmitted([
        first.id,
        second.id
      ])

    assert.equal(state.bulkSubmitCalls, 1)
    assert.equal(submitted.length, 2)
    assert.equal(
      state.lessons.get(first.id).giaeStatus,
      'submitted'
    )
    assert.equal(
      state.lessons.get(second.id).giaeStatus,
      'submitted'
    )
  }
)

test(
  'the view records a copy version only after clipboard writing succeeds',
  () => {
    const singleCopyStart = viewSource.indexOf(
      'function handleCopy('
    )
    const visibleCopyStart = viewSource.indexOf(
      'function handleCopyVisible()'
    )
    const submitStart = viewSource.indexOf(
      'function handleMarkSubmitted('
    )

    assert.notEqual(singleCopyStart, -1)
    assert.notEqual(visibleCopyStart, -1)
    assert.notEqual(submitStart, -1)

    const singleCopy = viewSource.slice(
      singleCopyStart,
      visibleCopyStart
    )
    const visibleCopy = viewSource.slice(
      visibleCopyStart,
      submitStart
    )

    assert.match(
      singleCopy,
      /await\s+writeClipboard\([\s\S]*giaeWorkspaceRepository\.recordCopiedLesson\(/m
    )
    assert.match(
      visibleCopy,
      /await\s+writeClipboard\([\s\S]*giaeWorkspaceRepository\.recordCopiedLessons\(/m
    )

    assert.ok(
      singleCopy.indexOf('await writeClipboard') <
        singleCopy.indexOf(
          'giaeWorkspaceRepository.recordCopiedLesson'
        )
    )
    assert.ok(
      visibleCopy.indexOf('await writeClipboard') <
        visibleCopy.indexOf(
          'giaeWorkspaceRepository.recordCopiedLessons'
        )
    )
  }
)
