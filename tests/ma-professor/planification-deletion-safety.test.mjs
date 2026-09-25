import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const repositorySource = await readFile(
  new URL(
    '../../src/components/ma-professor/planifications/planificationWorkspaceRepositoryBase.ts',
    import.meta.url
  ),
  'utf8'
)

const workspaceViewSource = await readFile(
  new URL(
    '../../src/components/ma-professor/planifications/PlanificationWorkspaceView.tsx',
    import.meta.url
  ),
  'utf8'
)

const appSource = await readFile(
  new URL(
    '../../src/components/ma-professor/MAProfessorApp.tsx',
    import.meta.url
  ),
  'utf8'
)

const setupSource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/PlanificationsSetupStep.tsx',
    import.meta.url
  ),
  'utf8'
)

const guidedImportSource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/ModulePlanificationImportPanelLegacy.tsx',
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
let failPlanificationDelete = false

const emptyState = () => ({
  planifications: [],
  planificationItems: [],
  lessons: [],
  modules: [],
  other: []
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

  async toArray() {
    return clone(rows(this.name))
  }

  async delete(id) {
    if (
      this.name === 'planifications' &&
      failPlanificationDelete
    ) {
      throw new Error('simulated planification delete failure')
    }

    const index = rows(this.name).findIndex(item => item.id === id)
    if (index >= 0) rows(this.name).splice(index, 1)
  }

  async bulkDelete(ids) {
    const remove = new Set(ids)
    state[this.name] = rows(this.name).filter(item => !remove.has(item.id))
  }

  async put(record) {
    const index = rows(this.name).findIndex(item => item.id === record.id)
    if (index < 0) rows(this.name).push(clone(record))
    else rows(this.name)[index] = clone(record)
  }

  async bulkPut(records) {
    for (const record of records) await this.put(record)
  }

  async add(record) {
    rows(this.name).push(clone(record))
    return record.id
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
  planifications: new Table('planifications'),
  planificationItems: new Table('planificationItems'),
  lessons: new Table('lessons'),

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
  failPlanificationDelete = false
}

export function __snapshot() {
  return clone(state)
}

export function __failPlanificationDelete(value) {
  failPlanificationDelete = Boolean(value)
}
`)

const setupRepositoryUrl = asDataModule(`
export const maProfessorRepository = {
  async getSetupSnapshot() {
    throw new Error('not used')
  },
  async createPlanification() {
    throw new Error('not used')
  },
  async reorderPlanificationItems() {
    throw new Error('not used')
  }
}
`)

const removalSource = await readFile(new URL('../../src/components/ma-professor/planifications/planificationRemoval.ts', import.meta.url), 'utf8')
const removalUrl = transpile(removalSource.replace("from '../db'", `from '${dbUrl}'`))

const runtimeSource = repositorySource
  .replace("from './planificationRemoval'", `from '${removalUrl}'`)
  .replace(
    "from '../db'",
    `from '${dbUrl}'`
  )
  .replace(
    `import {
  maProfessorRepository,
  type PlanificationItemDraft
} from '../repository'`,
    `import { maProfessorRepository } from '${setupRepositoryUrl}'`
  )

const repositoryModule = await import(
  transpile(runtimeSource)
)
const dbModule = await import(dbUrl)
const repository =
  new repositoryModule.PlanificationWorkspaceRepository()

function baseState() {
  return {
    planifications: [
      {
        id: 'plan-a',
        academicYearId: 'year-1',
        teachingAssignmentId: 'assignment-1',
        moduleId: 'module-a',
        title: 'Planificação errada',
        description: '',
        active: true,
        createdAt: '2026-09-01T09:00:00.000Z',
        updatedAt: '2026-09-01T09:00:00.000Z'
      },
      {
        id: 'plan-b',
        academicYearId: 'year-1',
        teachingAssignmentId: 'assignment-1',
        moduleId: 'module-b',
        title: 'Planificação a manter',
        description: '',
        active: true,
        createdAt: '2026-09-01T09:00:00.000Z',
        updatedAt: '2026-09-01T09:00:00.000Z'
      }
    ],
    planificationItems: [
      {
        id: 'item-a-1',
        planificationId: 'plan-a',
        order: 1,
        content: 'Conteúdo errado 1',
        activity: '',
        objectives: '',
        suggestedSummary: '',
        status: 'planned',
        usedLessonId: null,
        usedAt: null,
        createdAt: '2026-09-01T09:00:00.000Z',
        updatedAt: '2026-09-01T09:00:00.000Z'
      },
      {
        id: 'item-a-2',
        planificationId: 'plan-a',
        order: 2,
        content: 'Conteúdo errado 2',
        activity: '',
        objectives: '',
        suggestedSummary: '',
        status: 'skipped',
        usedLessonId: null,
        usedAt: null,
        createdAt: '2026-09-01T09:00:00.000Z',
        updatedAt: '2026-09-01T09:00:00.000Z'
      },
      {
        id: 'item-b-1',
        planificationId: 'plan-b',
        order: 1,
        content: 'Conteúdo certo',
        activity: '',
        objectives: '',
        suggestedSummary: '',
        status: 'planned',
        usedLessonId: null,
        usedAt: null,
        createdAt: '2026-09-01T09:00:00.000Z',
        updatedAt: '2026-09-01T09:00:00.000Z'
      }
    ],
    lessons: [
      {
        id: 'lesson-unrelated',
        moduleId: 'module-b',
        status: 'planned',
        planificationItemIds: ['item-b-1']
      }
    ],
    modules: [
      { id: 'module-a', code: '0349' },
      { id: 'module-b', code: '10385' }
    ],
    other: [
      { id: 'criteria-1', name: 'Critério a preservar' }
    ]
  }
}

test(
  'whole-planification deletion removes only the selected free planification and its items',
  async () => {
    dbModule.__reset(baseState())

    const before =
      dbModule.__snapshot()

    const result =
      await repository.deletePlanification(
        'plan-a'
      )

    assert.equal(result, true)

    const after =
      dbModule.__snapshot()

    assert.deepEqual(
      after.planifications.map(item => item.id),
      ['plan-b']
    )
    assert.deepEqual(
      after.planificationItems.map(item => item.id),
      ['item-b-1']
    )
    assert.deepEqual(after.lessons, before.lessons)
    assert.deepEqual(after.modules, before.modules)
    assert.deepEqual(after.other, before.other)
  }
)

test(
  'whole-planification deletion archives historical items and keeps lessons unchanged',
  async () => {
    const seeded =
      baseState()

    seeded.planificationItems[0] = {
      ...seeded.planificationItems[0],
      status: 'used',
      usedLessonId: 'lesson-taught',
      usedAt: '2026-09-10T09:50:00.000Z'
    }
    seeded.lessons.push({
      id: 'lesson-taught',
      moduleId: 'module-a',
      status: 'taught',
      planificationItemIds: ['item-a-1']
    })

    dbModule.__reset(seeded)

    const before =
      dbModule.__snapshot()

    await repository.deletePlanification('plan-a')
    const after = dbModule.__snapshot()
    assert.equal(after.planifications.find(plan => plan.id === 'plan-a').active, false)
    assert.deepEqual(after.planifications.find(plan => plan.id === 'plan-b'), before.planifications[1])
    assert.deepEqual(after.planificationItems, before.planificationItems)
    assert.deepEqual(after.lessons, before.lessons)
    assert.deepEqual(after.modules, before.modules)
  }
)

test(
  'whole-planification deletion preserves future reservations while removing the active plan',
  async () => {
    const seeded =
      baseState()

    seeded.lessons.push({
      id: 'lesson-planned',
      moduleId: 'module-a',
      status: 'planned',
      planificationItemIds: ['item-a-2']
    })

    dbModule.__reset(seeded)

    const before =
      dbModule.__snapshot()

    await repository.deletePlanification('plan-a')
    const after = dbModule.__snapshot()
    assert.equal(after.planifications.find(plan => plan.id === 'plan-a').active, false)
    assert.deepEqual(after.planifications.find(plan => plan.id === 'plan-b'), before.planifications[1])
    assert.deepEqual(after.planificationItems, before.planificationItems)
    assert.deepEqual(after.lessons, before.lessons)
    assert.deepEqual(after.modules, before.modules)
  }
)

test(
  'whole-planification deletion rolls back item deletion when the planification delete fails',
  async () => {
    dbModule.__reset(
      baseState()
    )
    dbModule.__failPlanificationDelete(
      true
    )

    const before =
      dbModule.__snapshot()

    await assert.rejects(
      repository.deletePlanification(
        'plan-a'
      ),
      /simulated planification delete failure/
    )

    assert.deepEqual(
      dbModule.__snapshot(),
      before
    )
  }
)

test(
  'deletion and replacement keep their distinct UI actions and preserve lesson history',
  () => {
    assert.match(
      repositorySource,
      /async deletePlanification\([\s\S]*maProfessorDb\.planifications[\s\S]*maProfessorDb\.planificationItems[\s\S]*maProfessorDb\.lessons/
    )
    assert.match(
      removalSource,
      /planificationItemIds[\s\S]*bulkDelete[\s\S]*planifications\.delete\(/
    )

    assert.match(
      workspaceViewSource,
      /onDeletePlanification[\s\S]*Apagar planificação/
    )
    assert.match(
      appSource,
      /handleDeletePlanification[\s\S]*onDeletePlanification=\{handleDeletePlanification\}/
    )
    assert.match(
      setupSource,
      /deleteExistingPlanification[\s\S]*Apagar planificação/
    )
    assert.match(
      guidedImportSource,
      /Planificações já adicionadas/
    )
    assert.match(
      guidedImportSource,
      /planificationWorkspaceRepository[\s\S]*?\.deletePlanification\(/
    )
    assert.match(
      guidedImportSource,
      /Apagar planificação/
    )

    for (const source of [
      workspaceViewSource,
      setupSource,
      guidedImportSource
    ]) {
      assert.match(
        source,
        /UFCD, módulo ou UC, turma, horário, critérios/
      )
    }

    assert.doesNotMatch(
      guidedImportSource,
      /mode:\s*'replace'/
    )
  }
)
