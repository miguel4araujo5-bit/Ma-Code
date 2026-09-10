import { maProfessorDb, openMAProfessorDatabase } from '../db'
import { markDashboardDataDirty } from '../dashboard/dashboardRefreshSignal'
import type {
  ModuleUnit,
  Planification,
  PlanificationItem,
  Subject,
  TeachingAssignment
} from '../types'
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
const validModuleCode = (value: string) => /^[A-Za-z0-9][A-Za-z0-9._/-]{0,15}$/.test(clean(value))
const moduleKindLabel = (code: string) => /^\d{3,6}$/.test(clean(code)) ? 'UFCD' : 'Módulo'
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

async function resolveSubjectAssignments(input: {
  academicYearId: string
  subjectName: string
  groupIds: string[]
}) {
  const subjectName = clean(input.subjectName)
  const groupIds = [...new Set(input.groupIds)]

  if (!subjectName || !groupIds.length) {
    throw new Error('Indique a disciplina e selecione pelo menos uma turma de destino.')
  }

  const groups = []
  for (const groupId of groupIds) {
    const group = await maProfessorDb.groups.get(groupId)
    if (
      !group?.active ||
      group.academicYearId !== input.academicYearId
    ) {
      throw new Error('Uma turma de destino deixou de estar disponível.')
    }
    groups.push(group)
  }

  const sameNameSubjects = (
    await maProfessorDb.subjects
      .where('academicYearId')
      .equals(input.academicYearId)
      .toArray()
  ).filter(subject =>
    subject.active &&
    normalize(subject.name) === normalize(subjectName)
  )

  if (sameNameSubjects.length > 1) {
    throw new Error(
      `Existem várias disciplinas ativas chamadas “${subjectName}”. Corrija a duplicação antes de importar.`
    )
  }

  const timestamp = new Date().toISOString()
  let subject = sameNameSubjects[0]

  if (!subject) {
    subject = {
      id: crypto.randomUUID(),
      academicYearId: input.academicYearId,
      name: subjectName,
      shortName: '',
      code: '',
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp
    } satisfies Subject

    await maProfessorDb.subjects.add(subject)
  }

  const assignmentIds: string[] = []

  for (const group of groups) {
    const matches = (
      await maProfessorDb.teachingAssignments
        .where('groupId')
        .equals(group.id)
        .toArray()
    ).filter(assignment =>
      assignment.active &&
      assignment.academicYearId === input.academicYearId &&
      assignment.subjectId === subject.id
    )

    if (matches.length > 1) {
      throw new Error(
        `A turma “${group.name}” possui várias associações ativas à disciplina “${subject.name}”. Corrija a duplicação antes de importar.`
      )
    }

    let assignment = matches[0]

    if (!assignment) {
      assignment = {
        id: crypto.randomUUID(),
        academicYearId: input.academicYearId,
        groupId: group.id,
        subjectId: subject.id,
        displayName: `${subject.shortName.trim() || subject.name} · ${group.name}`,
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp
      } satisfies TeachingAssignment

      await maProfessorDb.teachingAssignments.add(assignment)
    }

    assignmentIds.push(assignment.id)
  }

  return assignmentIds
}

export async function commitModulePlanificationImport(input: {
  confirmed: true
  academicYearId: string
  assignmentIds?: string[]
  subjectName?: string
  groupIds?: string[]
  expectedFingerprint: string
  courseName?: string
  document: ModuleDocument
  selections: ModuleImportSelection[]
}) {
  if (input.confirmed !== true) throw new Error('Confirme a importação antes de guardar.')
  const request = structuredClone(input)
  if (!/^[a-f0-9]{64}$/.test(request.document.sha256) || !request.document.name.trim()) {
    throw new Error('O documento de origem não é válido.')
  }

  const legacyAssignments = [...new Set(request.assignmentIds ?? [])]
  const requestedGroups = [...new Set(request.groupIds ?? [])]
  const requestedSubjectName = clean(request.subjectName ?? '')
  const usesEditableSubjectDestination = Boolean(
    requestedSubjectName || requestedGroups.length
  )

  if (
    legacyAssignments.length &&
    usesEditableSubjectDestination
  ) {
    throw new Error('O destino da importação está ambíguo. Atualize a revisão e tente novamente.')
  }

  if (
    !legacyAssignments.length &&
    (!requestedSubjectName || !requestedGroups.length)
  ) {
    throw new Error('Indique a disciplina e selecione pelo menos uma turma de destino.')
  }

  if (!request.selections.length) throw new Error('Selecione pelo menos uma UFCD ou módulo para importar.')

  const codes = new Set<string>()
  const indices = new Set<number>()
  for (const row of request.selections) {
    const code = clean(row.code)
    if (!Number.isInteger(row.sectionIndex) || !request.document.sections[row.sectionIndex] ||
        !row.reviewed || !row.name.trim() || !validModuleCode(code) ||
        !Number.isInteger(row.plannedPeriods) || row.plannedPeriods <= 0) {
      throw new Error('Reveja o código, designação e tempos de cada UFCD ou módulo selecionado.')
    }
    const normalizedCode = normalize(code)
    if (codes.has(normalizedCode) || indices.has(row.sectionIndex)) throw new Error('A seleção contém UFCD ou módulos repetidos.')
    row.code = code
    codes.add(normalizedCode)
    indices.add(row.sectionIndex)
  }

  const confirmedCourseName = clean(request.courseName ?? '')
  await openMAProfessorDatabase()
  const result = await maProfessorDb.transaction('rw', tables(), async () => {
    if (await state() !== request.expectedFingerprint) {
      throw new Error('Os dados foram alterados após a revisão. Atualize a revisão antes de confirmar novamente.')
    }
    if (!await maProfessorDb.academicYears.get(request.academicYearId)) throw new Error('O ano letivo já não existe.')

    const assignments = legacyAssignments.length
      ? legacyAssignments
      : await resolveSubjectAssignments({
          academicYearId: request.academicYearId,
          subjectName: requestedSubjectName,
          groupIds: requestedGroups
        })

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
        if (!source.contentsText.trim()) throw new Error('Uma UFCD ou módulo selecionado não contém conteúdos de planificação.')
        const timestamp = new Date().toISOString()
        const audit = { createdAt: timestamp, updatedAt: timestamp }
        const module: ModuleUnit = {
          id: crypto.randomUUID(), academicYearId: request.academicYearId,
          teachingAssignmentId: assignmentId, code: row.code, name: row.name.trim(),
          plannedPeriods: row.plannedPeriods, order: order++,
          plannedStartDate: null, plannedEndDate: null, active: true, ...audit
        }
        const kind = moduleKindLabel(row.code)
        const planification: Planification = {
          id: crypto.randomUUID(), academicYearId: request.academicYearId,
          teachingAssignmentId: assignmentId, moduleId: module.id, active: true,
          title: `Planificação — ${kind} ${row.code} · ${row.name.trim()}`,
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
