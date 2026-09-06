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
  const s = () => globalThis.__giaeConcurrencyState;

  export const maProfessorDb = {
    lessons: {},
    async transaction(_mode, _tables, callback) {
      const state = s();
      state.transactionAttempts += 1;

      const previous = state.transactionTail;
      let release;
      state.transactionTail = new Promise(resolve => {
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
  const s = () => globalThis.__giaeConcurrencyState;
  const c = structuredClone;

  async function staleWrite(changes) {
    const state = s();
    const snapshot = c(state.lesson);

    state.giaeReadVersion = snapshot.updatedAt;
    state.resolveGiaeRead();

    await state.releaseGiaePromise;

    const updated = {
      ...snapshot,
      ...changes,
      updatedAt: 'giae-v2'
    };

    state.lesson = updated;
    return c(updated);
  }

  export const lessonRepository = {
    async markGIAESubmitted() {
      return staleWrite({
        giaeStatus: 'submitted',
        giaeSubmittedAt: '2026-09-06T15:00:00.000Z'
      });
    },

    async markGIAEPending() {
      return staleWrite({
        giaeStatus: 'pending',
        giaeSubmittedAt: null
      });
    },

    async markManyGIAESubmitted() {
      return [
        await staleWrite({
          giaeStatus: 'submitted',
          giaeSubmittedAt: '2026-09-06T15:00:00.000Z'
        })
      ];
    }
  };
`)

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/giae/giaeWorkspaceRepository.ts',
    import.meta.url
  ),
  'utf8'
)

const runtime = `${source
  .replaceAll("'../db'", `'${dbUrl}'`)
  .replaceAll(
    "'../lessons/lessonRepository'",
    `'${lessonRepositoryUrl}'`
  )}

export async function __testSaveSummary(summary) {
  const state = globalThis.__giaeConcurrencyState;
  state.summaryAttempted = true;
  state.resolveSummaryAttempt();

  return maProfessorDb.transaction(
    'rw',
    maProfessorDb.lessons,
    async () => {
      const current = structuredClone(state.lesson);
      state.summaryReadVersion = current.updatedAt;
      state.lesson = {
        ...current,
        summary,
        updatedAt: 'summary-v2'
      };
      return structuredClone(state.lesson);
    }
  );
}
`

const module = await import(transpile(runtime))

function deferred() {
  let resolve
  const promise = new Promise(resolvePromise => {
    resolve = resolvePromise
  })

  return {
    promise,
    resolve
  }
}

function resetState(initialGIAEStatus = 'pending') {
  const giaeRead = deferred()
  const releaseGiae = deferred()
  const summaryAttempt = deferred()

  globalThis.__giaeConcurrencyState = {
    lesson: {
      id: 'lesson-1',
      status: 'taught',
      summary: 'Sumário antigo.',
      giaeStatus: initialGIAEStatus,
      giaeSubmittedAt:
        initialGIAEStatus === 'submitted'
          ? '2026-09-06T14:00:00.000Z'
          : null,
      updatedAt: 'v1'
    },
    transactionTail: Promise.resolve(),
    transactionAttempts: 0,
    giaeReadVersion: null,
    summaryReadVersion: null,
    summaryAttempted: false,
    resolveGiaeRead: giaeRead.resolve,
    giaeReadPromise: giaeRead.promise,
    releaseGiae: releaseGiae.resolve,
    releaseGiaePromise: releaseGiae.promise,
    resolveSummaryAttempt: summaryAttempt.resolve,
    summaryAttemptPromise: summaryAttempt.promise
  }

  return globalThis.__giaeConcurrencyState
}

async function runConcurrentScenario({
  initialGIAEStatus,
  action,
  expectedGIAEStatus
}) {
  const state = resetState(initialGIAEStatus)
  const repository = new module.GIAEWorkspaceRepository()

  const giaePromise = action(repository)

  await state.giaeReadPromise

  const summaryPromise = module.__testSaveSummary(
    'Sumário novo guardado noutra operação.'
  )

  await state.summaryAttemptPromise

  if (state.transactionAttempts === 1) {
    await summaryPromise
  }

  state.releaseGiae()

  await Promise.all([
    giaePromise,
    summaryPromise
  ])

  assert.equal(
    state.lesson.summary,
    'Sumário novo guardado noutra operação.'
  )
  assert.equal(
    state.lesson.giaeStatus,
    expectedGIAEStatus
  )

  return state
}

test(
  'GIAE submit cannot overwrite a newer summary saved concurrently',
  { concurrency: false },
  async () => {
    const state = await runConcurrentScenario({
      initialGIAEStatus: 'pending',
      expectedGIAEStatus: 'submitted',
      action: repository =>
        repository.markSubmitted('lesson-1')
    })

    if (state.transactionAttempts === 1) {
      assert.equal(state.giaeReadVersion, 'v1')
      assert.equal(state.summaryReadVersion, 'v1')
    }
  }
)

test(
  'GIAE pending cannot overwrite a newer summary saved concurrently',
  { concurrency: false },
  async () => {
    await runConcurrentScenario({
      initialGIAEStatus: 'submitted',
      expectedGIAEStatus: 'pending',
      action: repository =>
        repository.markPending('lesson-1')
    })
  }
)

test(
  'GIAE bulk submit cannot overwrite a newer summary saved concurrently',
  { concurrency: false },
  async () => {
    await runConcurrentScenario({
      initialGIAEStatus: 'pending',
      expectedGIAEStatus: 'submitted',
      action: repository =>
        repository.markManySubmitted([
          'lesson-1'
        ])
    })
  }
)
