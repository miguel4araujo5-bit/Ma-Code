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
    async markGIAESubmitted() {
      state().legacySingleSubmitCalls += 1;
      throw new Error('Legacy single GIAE submission path must not be used.');
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

    async markManyGIAESubmitted() {
      state().legacyBulkSubmitCalls += 1;
      throw new Error('Legacy bulk GIAE submission path must not be used.');
    }
  };
`)

const explicitSubmissionUrl = transpile(`
  const state = () => globalThis.__giaeCopyVersionState;
  const clone = value => structuredClone(value);

  function getLesson(id) {
    const lesson = state().lessons.get(id);
    if (!lesson) {
      throw new Error('A aula indicada não existe.');
    }
    return clone(lesson);
  }

  function assertExpectedVersion(lesson, expectedUpdatedAt) {
    if (!expectedUpdatedAt || lesson.updatedAt !== expectedUpdatedAt) {
      throw new Error(
        'Esta aula foi alterada desde a cópia para o GIAE. Copie novamente o sumário antes de o marcar como submetido.'
      );
    }
  }

  function buildSubmitted(lesson, updatedAt) {
    return {
      ...lesson,
      giaeStatus: 'submitted',
      giaeSubmittedAt: updatedAt,
      updatedAt
    };
  }

  export const giaeExplicitSubmissionRepository = {
    async markSubmitted(input) {
      const current = state();
      current.singleSubmitCalls += 1;
      const lesson = getLesson(input.lessonId);
      assertExpectedVersion(lesson, input.expectedUpdatedAt);

      if (current.forcePendingSingleResult) {
        return clone(lesson);
      }

      const updated = buildSubmitted(
        lesson,
        'explicit-submitted-' + current.singleSubmitCalls
      );
      current.lessons.set(input.lessonId, updated);
      return clone(updated);
    },

    async markManySubmitted(inputs) {
      const current = state();
      current.bulkSubmitCalls += 1;

      const lessons = inputs.map(input => {
        const lesson = getLesson(input.lessonId);
        assertExpectedVersion(lesson, input.expectedUpdatedAt);
        return lesson;
      });

      if (current.forcePendingBulkResult) {
        return lessons.map(clone);
      }

      const updatedAt =
        'explicit-bulk-submitted-' + current.bulkSubmitCalls;
      const updated = lessons.map(lesson =>
        buildSubmitted(lesson, updatedAt)
      );

      for (const lesson of updated) {
        current.lessons.set(lesson.id, lesson);
      }

      return updated.map(clone);
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
    "'../giaeExplicitSubmissionRepository'",
    `'${explicitSubmissionUrl}'`
  )
  .replaceAll(
    "'../lessons/lessonRepository'",
    `'${lessonRepositoryUrl}'`
  )

const module = await import(transpile(runtime))

function buildLesson(
  id,
  summary,
  updatedAt,
  giaeStatus = 'pending'
) {
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
    giaeStatus,
    giaeSubmittedAt:
      giaeStatus === 'submitted'
        ? 'submitted-old'
        : null,
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
    legacySingleSubmitCalls: 0,
    legacyBulkSubmitCalls: 0,
    forcePendingSingleResult: false,
    forcePendingBulkResult: false,
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
    assert.equal(state.legacySingleSubmitCalls, 0)
    assert.equal(
      state.lessons.get(original.id).giaeStatus,
      'pending'
    )
  }
)

test(
  'the exact copied version can be marked submitted through the explicit contract',
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
    assert.equal(state.legacySingleSubmitCalls, 0)
    assert.equal(submitted.giaeStatus, 'submitted')
    assert.equal(
      state.lessons.get(lesson.id).giaeStatus,
      'submitted'
    )
  }
)

test(
  'submitted S0 edited to S1 pending can be explicitly recopied and submitted as S1',
  { concurrency: false },
  async () => {
    const submittedS0 = buildLesson(
      'lesson-1',
      'Sumário S0.',
      'submitted-s0',
      'submitted'
    )
    const state = resetState([submittedS0])
    const repository = new module.GIAEWorkspaceRepository()

    const editedS1 = buildLesson(
      submittedS0.id,
      'Sumário S1 depois da edição.',
      'edited-s1',
      'pending'
    )
    state.lessons.set(editedS1.id, editedS1)

    repository.recordCopiedLesson(editedS1)
    const result = await repository.markSubmitted(
      editedS1.id
    )

    assert.equal(result.giaeStatus, 'submitted')
    assert.equal(
      state.lessons.get(editedS1.id).giaeStatus,
      'submitted'
    )
    assert.equal(
      state.lessons.get(editedS1.id).summary,
      'Sumário S1 depois da edição.'
    )
    assert.equal(state.singleSubmitCalls, 1)
    assert.equal(state.legacySingleSubmitCalls, 0)
  }
)

test(
  'a pending return is never presented as successful and keeps the copied authorization for retry',
  { concurrency: false },
  async () => {
    const lesson = buildLesson(
      'lesson-1',
      'Sumário S1.',
      'v1'
    )
    const state = resetState([lesson])
    const repository = new module.GIAEWorkspaceRepository()

    repository.recordCopiedLesson(lesson)
    state.forcePendingSingleResult = true

    await assert.rejects(
      () => repository.markSubmitted(lesson.id),
      /confirmar.*submissão/i
    )

    assert.equal(
      state.lessons.get(lesson.id).giaeStatus,
      'pending'
    )

    state.forcePendingSingleResult = false
    const submitted = await repository.markSubmitted(
      lesson.id
    )

    assert.equal(submitted.giaeStatus, 'submitted')
    assert.equal(state.singleSubmitCalls, 2)
    assert.equal(state.legacySingleSubmitCalls, 0)
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
    assert.equal(state.legacySingleSubmitCalls, 0)
    assert.equal(state.legacyBulkSubmitCalls, 0)
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
    assert.equal(state.legacyBulkSubmitCalls, 0)
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
  'bulk submit succeeds atomically through the explicit contract when every copied version matches',
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
    assert.equal(state.legacyBulkSubmitCalls, 0)
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
  'bulk pending return is rejected and copied authorizations remain available',
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
    state.forcePendingBulkResult = true

    await assert.rejects(
      () => repository.markManySubmitted([
        first.id,
        second.id
      ]),
      /confirmar.*todas.*aulas/i
    )

    assert.equal(
      state.lessons.get(first.id).giaeStatus,
      'pending'
    )
    assert.equal(
      state.lessons.get(second.id).giaeStatus,
      'pending'
    )

    state.forcePendingBulkResult = false
    const submitted = await repository.markManySubmitted([
      first.id,
      second.id
    ])

    assert.equal(submitted.length, 2)
    assert.equal(state.bulkSubmitCalls, 2)
    assert.equal(state.legacyBulkSubmitCalls, 0)
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
