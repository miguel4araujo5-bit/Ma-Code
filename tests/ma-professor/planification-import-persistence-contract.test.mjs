import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/planificationImportRepository.ts',
    import.meta.url
  ),
  'utf8'
)

function asDataModule(sourceText) {
  return `data:text/javascript;base64,${Buffer.from(
    sourceText,
    'utf8'
  ).toString('base64')}`
}

function transpile(sourceText) {
  const output = ts.transpileModule(sourceText, {
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

  return asDataModule(output.outputText)
}

const dbUrl = asDataModule(`
const emptyState = () => ({
  academicYears: [],
  teachingAssignments: [],
  modules: [],
  planifications: [],
  planificationItems: [],
  lessons: [],
  lessonAttendance: [],
  lessonAssessments: [],
  assessmentResults: []
})

let state = emptyState()

function clone(value) {
  return structuredClone(value)
}

function rows(name) {
  return state[name]
}

class Table {
  constructor(name) {
    this.name = name
  }

  async get(id) {
    const value = rows(this.name).find(item => item.id === id)
    return value ? clone(value) : undefined
  }

  async add(record) {
    if (rows(this.name).some(item => item.id === record.id)) {
      throw new Error('duplicate id')
    }
    rows(this.name).push(clone(record))
    return record.id
  }

  async bulkAdd(records) {
    for (const record of records) {
      await this.add(record)
    }
  }

  async toArray() {
    return clone(rows(this.name))
  }

  where(field) {
    return {
      equals: value => ({
        toArray: async () => clone(
          rows(this.name).filter(item => item[field] === value)
        )
      })
    }
  }
}

export const maProfessorDb = {
  academicYears: new Table('academicYears'),
  teachingAssignments: new Table('teachingAssignments'),
  modules: new Table('modules'),
  planifications: new Table('planifications'),
  planificationItems: new Table('planificationItems'),

  async transaction(mode, ...args) {
    const callback = args.at(-1)
    const before = clone(state)
    try {
      return await callback()
    } catch (error) {
      state = before
      throw error
    }
  }
}

export async function openMAProfessorDatabase() {}

export function __reset(next = {}) {
  state = {
    ...emptyState(),
    ...clone(next)
  }
}

export function __snapshot() {
  return clone(state)
}

export function __push(table, record) {
  rows(table).push(clone(record))
}
`)

const repositoryUrl = transpile(
  source.replace(
    "from './db'",
    `from '${dbUrl}'`
  )
)

const repositoryModule = await import(repositoryUrl)
const dbModule = await import(dbUrl)

const repository =
  new repositoryModule.PlanificationImportRepository()

const YEAR_ID = 'year-2026'
const ASSIGNMENT_ID = 'assignment-a'
const MODULE_A = 'module-a'
const MODULE_B = 'module-b'
const PDF_HASH = 'a'.repeat(64)

function baseState() {
  return {
    academicYears: [
      {
        id: YEAR_ID,
        name: '2026/2027',
        active: true
      }
    ],
    teachingAssignments: [
      {
        id: ASSIGNMENT_ID,
        academicYearId: YEAR_ID,
        active: true
      }
    ],
    modules: [
      {
        id: MODULE_A,
        academicYearId: YEAR_ID,
        teachingAssignmentId: ASSIGNMENT_ID,
        active: true,
        code: '0349'
      },
      {
        id: MODULE_B,
        academicYearId: YEAR_ID,
        teachingAssignmentId: ASSIGNMENT_ID,
        active: true,
        code: '10385'
      }
    ],
    lessons: [
      {
        id: 'lesson-existing',
        moduleId: MODULE_A,
        summary: 'Sumário existente'
      }
    ],
    lessonAttendance: [
      {
        id: 'attendance-existing',
        lessonId: 'lesson-existing'
      }
    ],
    lessonAssessments: [
      {
        id: 'assessment-existing',
        lessonId: 'lesson-existing'
      }
    ],
    assessmentResults: [
      {
        id: 'result-existing',
        assessmentId: 'assessment-existing'
      }
    ]
  }
}

async function destinationState(moduleId) {
  return repository.getPlanificationImportDestinationState({
    academicYearId: YEAR_ID,
    teachingAssignmentId: ASSIGNMENT_ID,
    moduleId
  })
}

function importEntry({
  moduleId,
  mode,
  fingerprint,
  sectionOrdinal = 1,
  pages = [2, 1, 2],
  content = 'Conteúdo pedagógico'
}) {
  return {
    academicYearId: YEAR_ID,
    teachingAssignmentId: ASSIGNMENT_ID,
    moduleId,
    mode,
    expectedStateFingerprint: fingerprint,
    source: {
      pages,
      sectionOrdinal
    },
    planification: {
      title: `Planificação ${moduleId}`,
      description: 'Importada do PDF'
    },
    items: [
      {
        content,
        objectives: 'Objetivo 1',
        activity: 'Metodologia 1',
        resources: 'Projetor',
        evaluation: 'Observação direta',
        suggestedSummary: '',
        sourcePages: pages
      }
    ]
  }
}

function batch(entries, documentName = 'planificacao.pdf') {
  return {
    confirmed: true,
    document: {
      name: documentName,
      sha256: PDF_HASH
    },
    entries
  }
}

test(
  'create persists source metadata without touching lessons, attendance, assessments or results',
  async () => {
    dbModule.__reset(baseState())

    const before = dbModule.__snapshot()
    const state = await destinationState(MODULE_A)

    assert.equal(state.hasActivePlanification, false)

    const result = await repository.commitPlanificationImportBatch(
      batch([
        importEntry({
          moduleId: MODULE_A,
          mode: 'create',
          fingerprint: state.stateFingerprint
        })
      ])
    )

    assert.equal(result.results[0].action, 'created')

    const after = dbModule.__snapshot()

    assert.equal(after.planifications.length, 1)
    assert.equal(after.planificationItems.length, 1)
    assert.equal(after.planifications[0].moduleId, MODULE_A)
    assert.equal(after.planifications[0].sourceDocumentName, 'planificacao.pdf')
    assert.deepEqual(after.planifications[0].sourcePages, [1, 2])

    const item = after.planificationItems[0]
    assert.equal(item.content, 'Conteúdo pedagógico')
    assert.equal(item.objectives, 'Objetivo 1')
    assert.equal(item.activity, 'Metodologia 1')
    assert.equal(item.resources, 'Projetor')
    assert.equal(item.evaluation, 'Observação direta')
    assert.equal(item.status, 'planned')
    assert.equal(item.usedLessonId, null)
    assert.equal(item.usedAt, null)
    assert.equal(item.sourceDocumentName, 'planificacao.pdf')
    assert.deepEqual(item.sourcePages, [1, 2])
    assert.match(item.sourceImportKey, /^plan-import-v1:[a-f0-9]{64}$/)

    assert.deepEqual(after.lessons, before.lessons)
    assert.deepEqual(after.lessonAttendance, before.lessonAttendance)
    assert.deepEqual(after.lessonAssessments, before.lessonAssessments)
    assert.deepEqual(after.assessmentResults, before.assessmentResults)
    assert.deepEqual(after.modules, before.modules)
  }
)

test(
  'append preserves historical used items and adds new planned items at the end',
  async () => {
    const seeded = baseState()
    seeded.planifications = [
      {
        id: 'plan-existing',
        academicYearId: YEAR_ID,
        teachingAssignmentId: ASSIGNMENT_ID,
        moduleId: MODULE_A,
        title: 'Existente',
        description: '',
        active: true,
        createdAt: '2026-09-01T10:00:00.000Z',
        updatedAt: '2026-09-01T10:00:00.000Z'
      }
    ]
    seeded.planificationItems = [
      {
        id: 'item-used',
        planificationId: 'plan-existing',
        order: 1,
        content: 'Conteúdo já dado',
        activity: '',
        objectives: '',
        suggestedSummary: 'Sumário antigo',
        status: 'used',
        usedLessonId: 'lesson-existing',
        usedAt: '2026-09-02T10:00:00.000Z',
        createdAt: '2026-09-01T10:00:00.000Z',
        updatedAt: '2026-09-02T10:00:00.000Z'
      }
    ]

    dbModule.__reset(seeded)

    const state = await destinationState(MODULE_A)
    const historicalBefore = dbModule.__snapshot().planificationItems[0]

    const result = await repository.commitPlanificationImportBatch(
      batch([
        importEntry({
          moduleId: MODULE_A,
          mode: 'append',
          fingerprint: state.stateFingerprint
        })
      ])
    )

    assert.equal(result.results[0].action, 'appended')

    const after = dbModule.__snapshot()
    assert.equal(after.planifications.length, 1)
    assert.equal(after.planificationItems.length, 2)
    assert.deepEqual(after.planificationItems[0], historicalBefore)

    const appended = after.planificationItems[1]
    assert.equal(appended.planificationId, 'plan-existing')
    assert.equal(appended.order, 2)
    assert.equal(appended.status, 'planned')
    assert.equal(appended.usedLessonId, null)
    assert.equal(appended.usedAt, null)
  }
)

test(
  'repeating the same import is idempotent even if the PDF was renamed',
  async () => {
    dbModule.__reset(baseState())

    const state = await destinationState(MODULE_A)
    const entry = importEntry({
      moduleId: MODULE_A,
      mode: 'create',
      fingerprint: state.stateFingerprint
    })

    const first = await repository.commitPlanificationImportBatch(
      batch([entry], 'original.pdf')
    )

    assert.equal(first.results[0].action, 'created')

    const afterFirst = dbModule.__snapshot()

    const second = await repository.commitPlanificationImportBatch(
      batch([entry], 'renomeado.pdf')
    )

    assert.equal(second.results[0].action, 'alreadyImported')

    const afterSecond = dbModule.__snapshot()
    assert.equal(afterSecond.planifications.length, 1)
    assert.equal(afterSecond.planificationItems.length, 1)
    assert.deepEqual(afterSecond, afterFirst)
  }
)

test(
  'stale preview fingerprint aborts without writing',
  async () => {
    const seeded = baseState()
    seeded.planifications = [
      {
        id: 'plan-existing',
        academicYearId: YEAR_ID,
        teachingAssignmentId: ASSIGNMENT_ID,
        moduleId: MODULE_A,
        title: 'Existente',
        description: '',
        active: true,
        createdAt: '2026-09-01T10:00:00.000Z',
        updatedAt: '2026-09-01T10:00:00.000Z'
      }
    ]

    dbModule.__reset(seeded)

    const preview = await destinationState(MODULE_A)

    dbModule.__push('planificationItems', {
      id: 'concurrent-item',
      planificationId: 'plan-existing',
      order: 1,
      content: 'Alteração noutra aba',
      activity: '',
      objectives: '',
      suggestedSummary: '',
      status: 'planned',
      usedLessonId: null,
      usedAt: null,
      createdAt: '2026-09-06T17:00:00.000Z',
      updatedAt: '2026-09-06T17:00:00.000Z'
    })

    const beforeCommit = dbModule.__snapshot()

    await assert.rejects(
      repository.commitPlanificationImportBatch(
        batch([
          importEntry({
            moduleId: MODULE_A,
            mode: 'append',
            fingerprint: preview.stateFingerprint
          })
        ])
      ),
      /alterada depois da pré-visualização/
    )

    assert.deepEqual(
      dbModule.__snapshot(),
      beforeCommit
    )
  }
)

test(
  'multi-UFCD commit is all-or-nothing when a later destination fails',
  async () => {
    dbModule.__reset(baseState())

    const stateA = await destinationState(MODULE_A)
    const stateB = await destinationState(MODULE_B)
    const before = dbModule.__snapshot()

    await assert.rejects(
      repository.commitPlanificationImportBatch(
        batch([
          importEntry({
            moduleId: MODULE_A,
            mode: 'create',
            fingerprint: stateA.stateFingerprint,
            sectionOrdinal: 1
          }),
          importEntry({
            moduleId: MODULE_B,
            mode: 'create',
            fingerprint: `${stateB.stateFingerprint}-stale`,
            sectionOrdinal: 2
          })
        ])
      ),
      /alterada depois da pré-visualização/
    )

    assert.deepEqual(
      dbModule.__snapshot(),
      before
    )
  }
)

test(
  'explicit confirmation is mandatory before any persistent import',
  async () => {
    dbModule.__reset(baseState())

    const state = await destinationState(MODULE_A)
    const before = dbModule.__snapshot()

    await assert.rejects(
      repository.commitPlanificationImportBatch({
        confirmed: false,
        document: {
          name: 'planificacao.pdf',
          sha256: PDF_HASH
        },
        entries: [
          importEntry({
            moduleId: MODULE_A,
            mode: 'create',
            fingerprint: state.stateFingerprint
          })
        ]
      }),
      /confirmação explícita/
    )

    assert.deepEqual(
      dbModule.__snapshot(),
      before
    )
  }
)

test(
  'contract contains no replace mode or destructive planification operation',
  () => {
    assert.doesNotMatch(
      source,
      /\|\s*'replace'/
    )
    assert.doesNotMatch(
      source,
      /planifications\.(?:delete|clear)\s*\(/
    )
    assert.doesNotMatch(
      source,
      /planificationItems\.(?:delete|clear)\s*\(/
    )
  }
)
