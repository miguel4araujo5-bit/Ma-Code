import { maProfessorDb, openMAProfessorDatabase } from '../db'
import { markDashboardDataDirty } from '../dashboard/dashboardRefreshSignal'
import type { ModuleUnit, Planification, PlanificationItem } from '../types'
import type { ModuleDocument } from './planificationModuleDocument'

export interface ModuleImportSelection {
  sectionIndex: number
  code: string
  name: string
  plannedPeriods: number
  reviewed: boolean
}

const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-PT')
const clean = (value: string) => value.trim().replace(/\s+/g, ' ')
const tables = () => [
  maProfessorDb.academicYears, maProfessorDb.groups, maProfessorDb.subjects,
  maProfessorDb.teachingAssignments, maProfessorDb.modules,
  maProfessorDb.planifications, maProfessorDb.planificationItems, maProfessorDb.settings
]

async function state() {
  const values = await Promise.all(tables().map(table => table.toArray()))
  return JSON.stringify(values.map(rows => rows.sort((a, b) => String(a.id).localeCompare(String(b.id)))))
}

export async function readModuleImportState() {
  await openMAProfessorDatabase()
  return maProfessorDb.transaction('r', tables(), async () => ({
    fingerprint: await state(),
    periodMinutes: (await maProfessorDb.settings.get('default'))?.defaultPeriodMinutes ?? 50
  }))
}

export async function commitModulePlanificationImport(input: {
  confirmed: true
  academicYearId: string
  assignmentIds: string[]
  expectedFingerprint: string
  courseName?: string
  document: ModuleDocument
  selections: ModuleImportSelection[]
}) {
  if (input.confirmed !== true) throw new Error('Confirme a importação antes de guardar.')
  // Freeze the payload before any asynchronous work.
  const request = structuredClone(input)
  if (!/^[a-f0-9]{64}$/.test(request.document.sha256) || !request.document.name.trim()) {
    throw new Error('O documento de origem não é válido.')
  }
  const assignments = [...new Set(request.assignmentIds)]
  if (!assignments.length || !request.selections.length) throw new Error('Selecione UFCD e turmas de destino.')
  const codes = new Set<string>()
  const indices = new Set<number>()
  for (const row of request.selections) {
    if (!Number.isInteger(row.sectionIndex) || !request.document.sections[row.sectionIndex] ||
        !row.reviewed || !row.name.trim() || !/^\d{3,6}$/.test(row.code) ||
        !Number.isInteger(row.plannedPeriods) || row.plannedPeriods <= 0) {
      throw new Error('Reveja o código, designação e tempos de cada UFCD selecionada.')
    }
    if (codes.has(row.code) || indices.has(row.sectionIndex)) throw new Error('A seleção contém UFCD repetidas.')
    codes.add(row.code)
    indices.add(row.sectionIndex)
  }
  const confirmedCourseName = clean(request.courseName ?? '')
  await openMAProfessorDatabase()
  const result = await maProfessorDb.transaction('rw', tables(), async () => {
    if (await state() !== request.expectedFingerprint) {
      throw new Error('Os dados foram alterados após a revisão. Atualize a revisão antes de confirmar novamente.')
    }
    if (!await maProfessorDb.academicYears.get(request.academicYearId)) throw new Error('O ano letivo já não existe.')
    let created = 0
    let skipped = 0
    const updatedGroupIds = new Set<string>()
    for (const assignmentId of assignments) {
      const assignment = await maProfessorDb.teachingAssignments.get(assignmentId)
      const group = assignment ? await maProfessorDb.groups.get(assignment.groupId) : null
      const subject = assignment ? await maProfessorDb.subjects.get(assignment.subjectId) : null
      if (!assignment?.active || assignment.academicYearId !== request.academicYearId ||
          !group?.active || !subject?.active ||
          group.academicYearId !== request.academicYearId || subject.academicYearId !== request.academicYearId) {
        throw new Error('Uma turma ou disciplina de destino deixou de estar disponível.')
      }
      if (
        confirmedCourseName &&
        !updatedGroupIds.has(group.id) &&
        normalize(group.courseName ?? '') !== normalize(confirmedCourseName)
      ) {
        await maProfessorDb.groups.update(group.id, {
          courseName: confirmedCourseName,
          updatedAt: new Date().toISOString()
        })
        updatedGroupIds.add(group.id)
      }
      const existing = await maProfessorDb.modules.where('teachingAssignmentId').equals(assignmentId).toArray()
      let order = Math.max(0, ...existing.map(module => module.order)) + 1
      for (const row of request.selections) {
        const sameCode = existing.filter(module => normalize(module.code) === normalize(row.code))
        if (sameCode.length > 1) throw new Error('Existem módulos ambíguos com o mesmo código no destino.')
        if (sameCode.length) {
          skipped++
          continue
        }
        if (existing.some(module => normalize(module.name) === normalize(row.name))) {
          throw new Error('Já existe um módulo com esta designação e outro código. Resolva a correspondência antes de importar.')
        }
        const source = request.document.sections[row.sectionIndex]
        if (!source.contentsText.trim()) throw new Error('Uma UFCD selecionada não contém conteúdos de planificação.')
        const timestamp = new Date().toISOString()
        const audit = { createdAt: timestamp, updatedAt: timestamp }
        const module: ModuleUnit = {
          id: crypto.randomUUID(), academicYearId: request.academicYearId,
          teachingAssignmentId: assignmentId, code: row.code, name: row.name.trim(),
          plannedPeriods: row.plannedPeriods, order: order++,
          plannedStartDate: null, plannedEndDate: null, active: true, ...audit
        }
        const planification: Planification = {
          id: crypto.randomUUID(), academicYearId: request.academicYearId,
          teachingAssignmentId: assignmentId, moduleId: module.id, active: true,
          title: `Planificação — UFCD ${row.code} · ${row.name.trim()}`,
          description: [
            source.periodLabel,
            source.durationHours !== null ? `Duração no documento: ${source.durationHours} horas.` : '',
            source.plannedLessons !== null ? `Aulas previstas no documento: ${source.plannedLessons}.` : '',
            request.document.periodMinutes ? `Duração das aulas no documento: ${request.document.periodMinutes} minutos.` : '',
            `Tempos letivos confirmados: ${row.plannedPeriods}.`
          ].filter(Boolean).join('\n'),
          sourceDocumentName: request.document.name, sourcePages: source.sourcePages, ...audit
        }
        const item: PlanificationItem = {
          id: crypto.randomUUID(), planificationId: planification.id, order: 1,
          content: source.contentsText, objectives: source.objectivesText,
          activity: source.methodologyText, resources: source.resourcesText,
          evaluation: source.evaluationText, suggestedSummary: '', status: 'planned',
          usedLessonId: null, usedAt: null,
          sourceDocumentName: request.document.name, sourcePages: source.sourcePages,
          sourceImportKey: `module-plan-v1:${request.document.sha256}:${row.sectionIndex}:${assignmentId}`,
          ...audit
        }
        await maProfessorDb.modules.add(module)
        await maProfessorDb.planifications.add(planification)
        await maProfessorDb.planificationItems.add(item)
        existing.push(module)
        created++
      }
    }
    return { created, skipped }
  })
  if (result.created) markDashboardDataDirty()
  return result
}
