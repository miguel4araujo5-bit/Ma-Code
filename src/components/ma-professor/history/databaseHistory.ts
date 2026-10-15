import Dexie, { type Transaction } from 'dexie'
import { maProfessorDb } from '../db'
import { maProfessorHistory } from './sessionHistory'
import { markDashboardDataDirty } from '../dashboard/dashboardRefreshSignal'

export interface HistoryLocation {
  workspace: 'daily' | 'assessments'
  academicYearId?: string
  lessonId?: string
  date?: string
  teachingAssignmentId?: string
  moduleId?: string
  studentId?: string
}

export const HISTORY_NAVIGATE_EVENT = 'ma-professor-history-navigate'
export const HISTORY_CHANGED_EVENT = 'ma-professor-history-changed'

type Row = Record<string, unknown>
interface Change { table: string; id: string; before: Row | undefined; after?: Row }
interface Guard { table: string; id: string; value: Row | undefined }
interface ChildrenGuard { table: string; field: string; id: string; keys: string[] }
interface Journal { changes: Map<string, Change> }

const journals = new WeakMap<Transaction, Journal>()
let installed = false
const copy = <T,>(value: T): T => structuredClone(value)
const keyFor = (table: string, id: string) => JSON.stringify([table, id])

function fingerprint(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(fingerprint).join(',') + ']'
  if (value && typeof value === 'object') {
    return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => JSON.stringify(key) + ':' + fingerprint(item)).join(',') + '}'
  }
  return JSON.stringify(value) ?? 'undefined'
}

function journalFor(transaction: Transaction): Journal | undefined {
  let current: Transaction | null = transaction
  while (current) {
    const journal = journals.get(current)
    if (journal) return journal
    current = current.parent ?? null
  }
}

function track(transaction: Transaction, table: string, id: unknown, before: Row | undefined) {
  const journal = journalFor(transaction)
  if (!journal || typeof id !== 'string') return
  const key = keyFor(table, id)
  if (!journal.changes.has(key)) journal.changes.set(key, { table, id, before: copy(before) })
}

function installTracking() {
  if (installed) return
  for (const table of maProfessorDb.tables) {
    table.hook('creating', (key, object, transaction) => {
      track(transaction, table.name, key ?? object.id, undefined)
    })
    table.hook('updating', (_modifications, key, object, transaction) => {
      track(transaction, table.name, key, object)
    })
    table.hook('deleting', (key, object, transaction) => {
      track(transaction, table.name, key, object)
    })
  }
  installed = true
}

const references: Record<string, string> = {
  academicYearId: 'academicYears', teachingAssignmentId: 'teachingAssignments',
  groupId: 'groups', subjectId: 'subjects', moduleId: 'modules', studentId: 'students',
  lessonId: 'lessons', assessmentId: 'lessonAssessments', criterionId: 'assessmentCriteria',
  schemeId: 'assessmentSchemes', planificationId: 'planifications', scheduleSlotId: 'weeklyScheduleSlots',
  usedLessonId: 'lessons'
}

const childRelations: Record<string, Array<[string, string]>> = {
  lessons: [['lessonAttendance', 'lessonId'], ['lessonAssessments', 'lessonId'], ['summarySuggestions', 'lessonId'], ['planificationItems', 'usedLessonId']],
  lessonAssessments: [['assessmentResults', 'assessmentId']],
  assessmentCriteria: [['lessonAssessments', 'criterionId']],
  assessmentSchemes: [['assessmentCriteria', 'schemeId']],
  planifications: [['planificationItems', 'planificationId']],
  weeklyScheduleSlots: [['lessons', 'scheduleSlotId']],
  modules: [['lessons', 'moduleId'], ['lessonAssessments', 'moduleId'], ['moduleFinalGrades', 'moduleId'], ['learningRecoveries', 'moduleId'], ['planifications', 'moduleId'], ['assessmentSchemes', 'moduleId']],
  teachingAssignments: [['modules', 'teachingAssignmentId'], ['lessons', 'teachingAssignmentId'], ['weeklyScheduleSlots', 'teachingAssignmentId'], ['planifications', 'teachingAssignmentId'], ['assessmentSchemes', 'teachingAssignmentId']],
  groups: [['students', 'groupId'], ['teachingAssignments', 'groupId']],
  subjects: [['teachingAssignments', 'subjectId']]
}

async function collectGuards(changes: Change[]) {
  const changed = new Set(changes.map(item => keyFor(item.table, item.id)))
  const guards = new Map<string, Guard>()
  const children: ChildrenGuard[] = []
  for (const change of changes) {
    for (const row of [change.before, change.after]) {
      if (!row) continue
      for (const [field, table] of Object.entries(references)) {
        const id = row[field]
        if (typeof id !== 'string' || !id || changed.has(keyFor(table, id)) || guards.has(keyFor(table, id))) continue
        guards.set(keyFor(table, id), { table, id, value: copy(await maProfessorDb.table(table).get(id)) })
      }
      for (const id of Array.isArray(row.planificationItemIds) ? row.planificationItemIds : []) {
        if (typeof id === 'string' && !changed.has(keyFor('planificationItems', id))) {
          guards.set(keyFor('planificationItems', id), { table: 'planificationItems', id, value: copy(await maProfessorDb.planificationItems.get(id)) as Row | undefined })
        }
      }
    }
    for (const [table, field] of childRelations[change.table] ?? []) {
      const keys = (await maProfessorDb.table(table).where(field).equals(change.id).primaryKeys())
        .map(String).filter(id => !changed.has(keyFor(table, id))).sort()
      children.push({ table, field, id: change.id, keys })
    }
  }
  return { guards: [...guards.values()], children }
}

function navigate(location: HistoryLocation) {
  markDashboardDataDirty()
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(HISTORY_CHANGED_EVENT))
    window.dispatchEvent(new CustomEvent(HISTORY_NAVIGATE_EVENT, { detail: location }))
  }
}

/** Explicit user-action boundary. Only changed records are retained in RAM.
 * Automatic generation, migrations, backup, restore and authentication never opt in.
 */
export async function runWithDatabaseHistory<T>(
  label: string,
  location: HistoryLocation,
  action: () => Promise<T>
): Promise<T> {
  const parent = Dexie.currentTransaction
  // A caller that owns a transaction also owns its action boundary. Untracked
  // maintenance/restore transactions must never create a history entry.
  if (parent) return action()
  installTracking()
  const endMutation = maProfessorHistory.beginMutation()
  const revision = maProfessorHistory.getRevision()
  try {
    const journal: Journal = { changes: new Map() }
    let changes: Change[] = []
    let guards: Guard[] = []
    let children: ChildrenGuard[] = []
    const result = await maProfessorDb.transaction('rw', maProfessorDb.tables, async transaction => {
      journals.set(transaction, journal)
      try {
        const result = await action()
        for (const change of journal.changes.values()) {
          change.after = copy(await maProfessorDb.table(change.table).get(change.id))
          if (fingerprint(change.before) !== fingerprint(change.after)) changes.push(change)
        }
        const collected = await collectGuards(changes)
        guards = collected.guards
        children = collected.children
        return result
      } finally {
        journals.delete(transaction)
      }
    })

    if (changes.length && revision === maProfessorHistory.getRevision()) {
      const changed = new Set(changes.map(item => keyFor(item.table, item.id)))
      const replay = async (direction: 'undo' | 'redo') => {
        await maProfessorDb.transaction('rw', maProfessorDb.tables, async () => {
          const expected = direction === 'undo' ? 'after' : 'before'
          const target = direction === 'undo' ? 'before' : 'after'
          for (const change of changes) {
            if (fingerprint(await maProfessorDb.table(change.table).get(change.id)) !== fingerprint(change[expected])) {
              throw new Error('Estes registos foram alterados entretanto. Não foi possível reverter a operação em segurança; nenhum dado foi alterado.')
            }
          }
          for (const guard of guards) {
            if (fingerprint(await maProfessorDb.table(guard.table).get(guard.id)) !== fingerprint(guard.value)) {
              throw new Error('O contexto destes registos foi alterado entretanto. Não foi possível reverter a operação em segurança; nenhum dado foi alterado.')
            }
          }
          for (const guard of children) {
            const keys = (await maProfessorDb.table(guard.table).where(guard.field).equals(guard.id).primaryKeys())
              .map(String).filter(id => !changed.has(keyFor(guard.table, id))).sort()
            if (fingerprint(keys) !== fingerprint(guard.keys)) {
              throw new Error('Existem novos registos relacionados. Não foi possível reverter a operação em segurança; nenhum dado foi alterado.')
            }
          }
          for (const change of changes) {
            const table = maProfessorDb.table(change.table)
            if (change[target] === undefined) await table.delete(change.id)
            else await table.put(copy(change[target]))
          }
        })
      }
      const lessonChange = changes.find(change => change.table === 'lessons' && change.id === location.lessonId)
      const locations = {
        undo: { ...location, date: lessonChange?.before?.date as string | undefined ?? location.date },
        redo: { ...location, date: lessonChange?.after?.date as string | undefined ?? location.date }
      }
      let nextLocation = locations.undo
      maProfessorHistory.record({
        label,
        undo: async () => { await replay('undo'); nextLocation = locations.undo },
        redo: async () => { await replay('redo'); nextLocation = locations.redo },
        navigate: () => navigate(nextLocation)
      })
    }
    return result
  } finally {
    endMutation()
  }
}

