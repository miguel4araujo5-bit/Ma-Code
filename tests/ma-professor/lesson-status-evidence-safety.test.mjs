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
    item =>
      item.category ===
      ts.DiagnosticCategory.Error
  )

  assert.equal(
    errors.length,
    0,
    errors.map(item =>
      ts.flattenDiagnosticMessageText(
        item.messageText,
        '\n'
      )
    ).join('\n')
  )

  return `data:text/javascript;base64,${Buffer.from(
    output.outputText
  ).toString('base64')}`
}

const dbUrl = transpile(`
  const state = () => globalThis.__lessonStatusEvidenceState;
  const counter = key => ({
    where(){
      return {
        equals(){
          return {
            async count(){return state()[key]}
          }
        }
      }
    }
  });

  export const maProfessorDb = {
    tables: [],
    lessons: {
      async get(id){
        return state().lesson.id === id
          ? structuredClone(state().lesson)
          : undefined;
      },
      async bulkGet(ids){
        return ids.map(id =>
          state().lesson.id === id
            ? structuredClone(state().lesson)
            : undefined
        );
      }
    },
    lessonAttendance: counter('attendanceCount'),
    lessonAssessments: counter('assessmentCount'),
    async transaction(_mode, _tables, callback){
      return callback();
    }
  };
`)

const baseRepositoryUrl = transpile(`
  export class LessonRepository {
    async initialize(){}
    async createLesson(input){return structuredClone(input)}
    async updateLesson(_id, changes){
      const state = globalThis.__lessonStatusEvidenceState;
      state.lesson = {
        ...state.lesson,
        ...structuredClone(changes),
        updatedAt: 'v2'
      };
      return structuredClone(state.lesson);
    }
    async markGIAESubmitted(){
      return structuredClone(globalThis.__lessonStatusEvidenceState.lesson);
    }
    async markManyGIAESubmitted(){return []}
  }

  export function formatLessonSummaryForGIAE(){}
  export function formatLessonsForBulkGIAE(){}
`)

const historicalSafetyUrl = transpile(`
  export function assertLessonHistoricalDateChangeAllowed(){}
  export function assertLessonHistoricalModuleChangeAllowed(){}
`)

const temporalSafetyUrl = transpile(`
  export function assertLessonNotTaughtInFuture(){}
  export function resolveLessonStatusForDate(_date, status){return status}
`)

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/lessons/lessonRepository.ts',
    import.meta.url
  ),
  'utf8'
)

const runtime = source
  .replaceAll("'../db'", `'${dbUrl}'`)
  .replaceAll("'./lessonRepositoryBase'", `'${baseRepositoryUrl}'`)
  .replaceAll("'./lessonHistoricalEditSafety'", `'${historicalSafetyUrl}'`)
  .replaceAll("'./lessonTemporalSafety'", `'${temporalSafetyUrl}'`)

const module = await import(
  transpile(runtime)
)

const {
  LessonRepository
} = module

function resetState({
  status = 'taught',
  attendanceCount = 0,
  assessmentCount = 0
} = {}) {
  globalThis.__lessonStatusEvidenceState = {
    attendanceCount,
    assessmentCount,
    lesson: {
      id: 'lesson-1',
      date: '2026-09-09',
      moduleId: 'module-1',
      status,
      updatedAt: 'v1'
    }
  }

  return globalThis.__lessonStatusEvidenceState
}

test(
  'a taught lesson with attendance cannot be moved back to planned',
  { concurrency: false },
  async () => {
    const state = resetState({
      status: 'taught',
      attendanceCount: 1,
      assessmentCount: 1
    })

    const repository =
      new LessonRepository()

    await assert.rejects(
      () =>
        repository.updateLesson(
          'lesson-1',
          {
            status: 'planned'
          }
        ),
      /já possui faltas.*marcada como dada/i
    )

    assert.equal(
      state.lesson.status,
      'taught'
    )
  }
)

test(
  'assessment evidence alone does not prevent moving a lesson to planned',
  { concurrency: false },
  async () => {
    const state = resetState({
      status: 'taught',
      attendanceCount: 0,
      assessmentCount: 1
    })

    const repository =
      new LessonRepository()

    const updated =
      await repository.updateLesson(
        'lesson-1',
        {
          status: 'planned'
        }
      )

    assert.equal(
      updated.status,
      'planned'
    )
    assert.equal(
      state.lesson.status,
      'planned'
    )
  }
)

test(
  'a lesson with assessment evidence cannot be cancelled',
  { concurrency: false },
  async () => {
    const state = resetState({
      status: 'planned',
      attendanceCount: 0,
      assessmentCount: 1
    })

    const repository =
      new LessonRepository()

    await assert.rejects(
      () =>
        repository.updateLesson(
          'lesson-1',
          {
            status: 'cancelled'
          }
        ),
      /já possui faltas ou avaliações.*marcada como dada/i
    )

    assert.equal(
      state.lesson.status,
      'planned'
    )
  }
)
