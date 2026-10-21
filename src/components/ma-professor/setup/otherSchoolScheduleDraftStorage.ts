import Dexie, { type Table } from 'dexie'

type DraftRecord = {
  id: string
  accountEmail: string
  academicYearId: string
  schemaVersion: 1
  revision: number
  state: unknown
}

class ScheduleDraftDatabase extends Dexie {
  drafts!: Table<DraftRecord, string>
  documents!: Table<{ id: string; file: File }, string>
  constructor() {
    super('ma-professor-other-school-schedule-drafts')
    this.version(1).stores({ drafts: '&id, accountEmail, academicYearId', documents: '&id' })
  }
}

const db = new ScheduleDraftDatabase()

export type ScheduleDraftScope = { accountEmail: string; academicYearId: string }

function draftId(scope: ScheduleDraftScope) {
  const email = scope.accountEmail.trim().toLowerCase()
  if (!email || !scope.academicYearId) throw new Error('Não foi possível identificar a conta para guardar o rascunho.')
  return JSON.stringify([email, scope.academicYearId])
}

export async function readOtherSchoolScheduleDraft<T>(scope: ScheduleDraftScope) {
  const id = draftId(scope)
  return db.transaction('r', [db.drafts, db.documents], async () => {
    const record = await db.drafts.get(id)
    if (!record || record.schemaVersion !== 1) return null
    const document = await db.documents.get(id)
    if (!document) throw new Error('O PDF do rascunho não está disponível neste dispositivo.')
    return { revision: record.revision, state: record.state as T, originalPdf: document.file }
  })
}

export async function saveOtherSchoolScheduleDraft<T>(
  scope: ScheduleDraftScope, state: T, originalPdf: File | null, expectedRevision: number
) {
  const id = draftId(scope)
  const revision = await db.transaction('rw', [db.drafts, db.documents], async () => {
    const current = await db.drafts.get(id)
    if ((current?.revision ?? 0) !== expectedRevision) {
      throw new Error('A revisão foi alterada noutra janela. Volte a abrir o horário para retomar o rascunho mais recente.')
    }
    const revision = expectedRevision + 1
    await db.drafts.put({
      id, accountEmail: scope.accountEmail.trim().toLowerCase(),
      academicYearId: scope.academicYearId, schemaVersion: 1, revision, state
    })
    // null retains the original already stored for this revision.
    if (!originalPdf && (!current || !(await db.documents.get(id)))) {
      throw new Error('O PDF original é necessário para guardar esta revisão.')
    }
    if (originalPdf) {
      await db.documents.put({ id, file: originalPdf })
    }
    return revision
  })
  return revision
}

export async function deleteOtherSchoolScheduleDraft(scope: ScheduleDraftScope, expectedRevision: number) {
  const id = draftId(scope)
  await db.transaction('rw', [db.drafts, db.documents], async () => {
    const current = await db.drafts.get(id)
    if (current && current.revision !== expectedRevision) {
      throw new Error('Existe um rascunho mais recente noutra janela; foi preservado.')
    }
    await db.drafts.delete(id)
    await db.documents.delete(id)
  })
}

export async function clearOtherSchoolScheduleDrafts() {
  await db.transaction('rw', [db.drafts, db.documents], async () => {
    await db.drafts.clear()
    await db.documents.clear()
  })
}
