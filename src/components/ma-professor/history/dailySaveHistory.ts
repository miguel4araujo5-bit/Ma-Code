import { maProfessorDb } from '../db'
import { maProfessorHistory } from './sessionHistory'

type Row = { id: string; [key: string]: unknown }
type Snapshot = Map<string, Map<string, Row>>
type Change = { table: string; id: string; before: Row | null; after: Row | null }

function signature(row: Row | null): string {
  return JSON.stringify(row)
}

async function snapshot(lessonId: string): Promise<Snapshot> {
  const result: Snapshot = new Map()
  // Ler apenas o âmbito da aula, evitando copiar a base de dados inteira.
  const lesson = await maProfessorDb.lessons.get(lessonId)
  if (!lesson) throw new Error('A aula indicada não existe.')
  const moduleId = lesson.moduleId
  const planifications = moduleId ? await maProfessorDb.planifications.where('moduleId').equals(moduleId).toArray() : []
  const planificationIds = planifications.map(item => item.id)
  const assessments = await maProfessorDb.lessonAssessments.where('lessonId').equals(lessonId).toArray()
  const assessmentIds = assessments.map(item => item.id)

  const collect = (name: string, rows: Row[]) => {
    result.set(name, new Map(rows.map(row => [String(row.id), structuredClone(row)])))
  }
  collect('lessons', [lesson as Row])
  collect('lessonAttendance', await maProfessorDb.lessonAttendance.where('lessonId').equals(lessonId).toArray() as Row[])
  collect('lessonAssessments', assessments as Row[])
  collect('assessmentResults', assessmentIds.length
    ? await maProfessorDb.assessmentResults.where('assessmentId').anyOf(assessmentIds).toArray() as Row[]
    : [])
  collect('learningRecoveries', moduleId ? await maProfessorDb.learningRecoveries.where('moduleId').equals(moduleId).toArray() as Row[] : [])
  collect('moduleFinalGrades', moduleId ? await maProfessorDb.moduleFinalGrades.where('moduleId').equals(moduleId).toArray() as Row[] : [])
  collect('planificationItems', planificationIds.length
    ? await maProfessorDb.planificationItems.where('planificationId').anyOf(planificationIds).toArray() as Row[]
    : [])
  return result
}

function diff(before: Snapshot, after: Snapshot): Change[] {
  const changes: Change[] = []
  for (const [name, oldRows] of before) {
    const newRows = after.get(name) ?? new Map<string, Row>()
    for (const id of new Set([...oldRows.keys(), ...newRows.keys()])) {
      const oldRow = oldRows.get(id) ?? null
      const newRow = newRows.get(id) ?? null
      if (signature(oldRow) !== signature(newRow)) {
        changes.push({ table: name, id, before: oldRow, after: newRow })
      }
    }
  }
  return changes
}

/**
 * Regista a alteração completa de uma gravação (aula, faltas, avaliações,
 * planificação e registos derivados) sem escrever o histórico em disco.
 * O histórico só é criado depois de a gravação terminar com sucesso.
 */
export async function captureDailySave(
  label: string,
  save: () => Promise<boolean>,
  navigate?: () => void,
  lessonId?: string
): Promise<boolean> {
  if (!lessonId) throw new Error('É necessário identificar a aula para registar o histórico.')
  const before = await snapshot(lessonId)
  const saved = await save()
  if (!saved) return false
  const after = await snapshot(lessonId)
  const changes = diff(before, after)
  if (!changes.length) return true

  let expected: 'before' | 'after' = 'after'
  const apply = async (direction: 'undo' | 'redo') => {
    const target = direction === 'undo' ? 'before' : 'after'
    const source = direction === 'undo' ? 'after' : 'before'
    if (expected !== source) throw new Error('O histórico desta gravação está desatualizado.')
    await maProfessorDb.transaction('rw', maProfessorDb.tables, async () => {
      // Primeiro validar todos os registos; nunca aplicar apenas parte da reversão.
      for (const change of changes) {
        const table = maProfessorDb.table(change.table)
        const current = (await table.get(change.id) ?? null) as Row | null
        if (signature(current) !== signature(change[source])) {
          throw new Error('Os dados foram alterados entretanto. Atualize a página antes de desfazer ou refazer.')
        }
      }
      for (const change of changes) {
        const table = maProfessorDb.table(change.table)
        const row = change[target]
        if (row) await table.put(structuredClone(row))
        else await table.delete(change.id)
      }
    })
    expected = target
  }

  maProfessorHistory.record({
    label,
    undo: () => apply('undo'),
    redo: () => apply('redo'),
    navigate
  })
  return true
}
