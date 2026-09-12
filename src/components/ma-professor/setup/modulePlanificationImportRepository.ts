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

type PlanificationSummaryPoint = {
  kind: 'content' | 'objective'
  text: string
}

type SemanticPlanificationPoint = {
  content: string
  objectives: string
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
const BULLET_MARKER = /^[•●○▪◦·]\s*/
const BULLET_ANYWHERE = /[•●○▪◦·]/

function dedupePoints(values: string[]) {
  const seen = new Set<string>()

  return values.filter(value => {
    const key = normalize(value)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function splitPlanificationPoints(value: string) {
  const normalized = value
    .replace(/\r\n/g, '\n')
    .trim()

  if (!normalized) return []

  const hasBullets = BULLET_ANYWHERE.test(normalized)

  if (!hasBullets) {
    return dedupePoints(
      normalized
        .split('\n')
        .map(clean)
        .filter(Boolean)
    )
  }

  const lines = normalized
    .replace(/([•●○▪◦·])\s*/g, '\n$1 ')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  const points: string[] = []
  let current = ''

  for (const line of lines) {
    if (BULLET_MARKER.test(line)) {
      if (current) points.push(clean(current))
      current = line.replace(BULLET_MARKER, '').trim()
      continue
    }

    current = current
      ? `${current} ${line}`
      : line
  }

  if (current) points.push(clean(current))

  return dedupePoints(points)
}

function buildSummarySequence(
  contentsText: string,
  objectivesText: string
): PlanificationSummaryPoint[] {
  const contents = splitPlanificationPoints(contentsText)
  const objectives = splitPlanificationPoints(objectivesText)
  const sequence: PlanificationSummaryPoint[] = []
  const count = Math.max(contents.length, objectives.length)

  for (let index = 0; index < count; index++) {
    if (contents[index]) {
      sequence.push({ kind: 'content', text: contents[index] })
    }
    if (objectives[index]) {
      sequence.push({ kind: 'objective', text: objectives[index] })
    }
  }

  return sequence
}

function sourceImportKey(
  sha256: string,
  sectionIndex: number,
  assignmentId: string,
  pointOrder: number
) {
  return `module-plan-v3:${sha256}:${sectionIndex}:${assignmentId}:${pointOrder}`
}

function createPlanificationItem(input: {
  planificationId: string
  source: ModuleDocument['sections'][number]
  point: PlanificationSummaryPoint
  order: number
  documentName: string
  documentSha256: string
  sectionIndex: number
  assignmentId: string
  timestamp: string
}) : PlanificationItem {
  return {
    id: `${input.planificationId}-summary-${String(input.order).padStart(4, '0')}-${crypto.randomUUID()}`,
    planificationId: input.planificationId,
    order: input.order,
    content: input.point.kind === 'content' ? input.point.text : '',
    objectives: input.point.kind === 'objective' ? input.point.text : '',
    activity: input.source.methodologyText,
    resources: input.source.resourcesText,
    evaluation: input.source.evaluationText,
    suggestedSummary: input.point.text,
    status: 'planned',
    usedLessonId: null,
    usedAt: null,
    sourceDocumentName: input.documentName,
    sourcePages: input.source.sourcePages,
    sourceImportKey: sourceImportKey(
      input.documentSha256,
      input.sectionIndex,
      input.assignmentId,
      input.order
    ),
    createdAt: input.timestamp,
    updatedAt: input.timestamp
  }
}

function buildSemanticPlanificationPoints(
  contentsText: string,
  objectivesText: string
): SemanticPlanificationPoint[] {
  const contents = splitPlanificationPoints(contentsText)
  const objectives = splitPlanificationPoints(objectivesText)

  if (!contents.length) {
    return objectives.map(objective => ({
      content: objective,
      objectives: ''
    }))
  }

  return contents.map((content, index) => ({
    content,
    objectives: index === contents.length - 1
      ? objectives.slice(index).join('\n')
      : objectives[index] ?? ''
  }))
}

function semanticSourceImportKey(
  sha256: string,
  sectionIndex: number,
  assignmentId: string,
  pointOrder: number
) {
  return `module-plan-v4:${sha256}:${sectionIndex}:${assignmentId}:${pointOrder}`
}

function buildSemanticPlanificationItems(input: {
  planificationId: string
  source: ModuleDocument['sections'][number]
  documentName: string
  documentSha256: string
  sectionIndex: number
  assignmentId: string
  timestamp: string
}) : PlanificationItem[] {
  return buildSemanticPlanificationPoints(
    input.source.contentsText,
    input.source.objectivesText
  ).map((point, index) => {
    const order = index + 1

    return {
      id: `${input.planificationId}-summary-${String(order).padStart(4, '0')}-${crypto.randomUUID()}`,
      planificationId: input.planificationId,
      order,
      content: point.content,
      objectives: point.objectives,
      activity: '',
      resources: '',
      evaluation: '',
      suggestedSummary: point.content,
      status: 'planned',
      usedLessonId: null,
      usedAt: null,
      sourceDocumentName: input.documentName,
      sourcePages: input.source.sourcePages,
      sourceImportKey: semanticSourceImportKey(
        input.documentSha256,
        input.sectionIndex,
        input.assignmentId,
        order
      ),
      createdAt: input.timestamp,
      updatedAt: input.timestamp
    }
  })
}

function contextBlock(label: string, value: string) {
  const text = value.trim()
  return text ? `${label}:\n${text}` : ''
}

function buildPlanificationDescription(input: {
  source: ModuleDocument['sections'][number]
  periodMinutes: number | null
  confirmedPeriods: number
}) {
  return [
    input.source.periodLabel,
    input.source.durationHours !== null ? `Duração no documento: ${input.source.durationHours} horas.` : '',
    input.source.plannedLessons !== null ? `Aulas previstas no documento: ${input.source.plannedLessons}.` : '',
    input.periodMinutes ? `Duração das aulas no documento: ${input.periodMinutes} minutos.` : '',
    `Tempos letivos confirmados: ${input.confirmedPeriods}.`,
    contextBlock('Metodologia/estratégias', input.source.methodologyText),
    contextBlock('Recursos', input.source.resourcesText),
    contextBlock('Avaliação', input.source.evaluationText)
  ].filter(Boolean).join('\n')
}

function isModuleImportItem(item: PlanificationItem) {
  return Boolean(
    item.sourceImportKey &&
    /^module-plan-v[12]:/.test(item.sourceImportKey)
  )
}

function itemSummaryText(item: PlanificationItem) {
  return item.suggestedSummary.trim() ||
    item.content.trim() ||
    item.objectives.trim()
}

async function repairLegacyImportedPlanification(input: {
  module: ModuleUnit
  source: ModuleDocument['sections'][number]
  documentName: string
  documentSha256: string
  sectionIndex: number
  assignmentId: string
}) {
  const sequence = buildSummarySequence(
    input.source.contentsText,
    input.source.objectivesText
  )

  if (sequence.length <= 1) return false

  const activePlanifications = (
    await maProfessorDb.planifications
      .where('moduleId')
      .equals(input.module.id)
      .toArray()
  ).filter(planification => planification.active)

  if (activePlanifications.length !== 1) return false

  const planification = activePlanifications[0]
  const items = await maProfessorDb.planificationItems
    .where('planificationId')
    .equals(planification.id)
    .toArray()

  if (!items.length || !items.every(isModuleImportItem)) return false

  const legacyAggregate =
    items.length === 1 &&
    items[0].sourceImportKey?.startsWith('module-plan-v1:') &&
    normalize(items[0].content) === normalize(input.source.contentsText) &&
    normalize(items[0].objectives) === normalize(input.source.objectivesText)

  const contentPoints = splitPlanificationPoints(input.source.contentsText)
  const v2ContentItems =
    items.every(item => item.sourceImportKey?.startsWith('module-plan-v2:')) &&
    items.length === contentPoints.length &&
    items.every(item => !item.suggestedSummary.trim()) &&
    items.every(item => normalize(item.objectives) === normalize(input.source.objectivesText)) &&
    items.every(item => contentPoints.some(point => normalize(point) === normalize(item.content)))

  if (!legacyAggregate && !v2ContentItems) return false

  const usedItems = items.filter(item =>
    item.status === 'used' &&
    item.usedLessonId !== null &&
    item.usedAt !== null
  )
  const plannedItems = items.filter(item =>
    item.status === 'planned' &&
    item.usedLessonId === null &&
    item.usedAt === null
  )

  if (usedItems.length + plannedItems.length !== items.length) return false

  const consumed = new Set<string>()

  if (legacyAggregate && usedItems.length === 1 && sequence[0]) {
    consumed.add(normalize(sequence[0].text))
  } else {
    usedItems.forEach(item => {
      const text = itemSummaryText(item)
      if (text) consumed.add(normalize(text))
    })
  }

  const pendingSequence = sequence.filter(point =>
    !consumed.has(normalize(point.text))
  )
  const maxUsedOrder = usedItems.reduce(
    (maximum, item) => Math.max(maximum, item.order),
    0
  )

  const timestamp = new Date().toISOString()
  const replacements = pendingSequence.map((point, index) =>
    createPlanificationItem({
      planificationId: planification.id,
      source: input.source,
      point,
      order: maxUsedOrder + index + 1,
      documentName: input.documentName,
      documentSha256: input.documentSha256,
      sectionIndex: input.sectionIndex,
      assignmentId: input.assignmentId,
      timestamp
    })
  )

  if (plannedItems.length) {
    await maProfessorDb.planificationItems.bulkDelete(
      plannedItems.map(item => item.id)
    )
  }

  if (replacements.length) {
    await maProfessorDb.planificationItems.bulkAdd(replacements)
  }

  return plannedItems.length > 0 || replacements.length > 0
}

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
    if (codes.has(normalizedCode) || indices.has(row.sectionIndex)) throw new Error('A seleção contém entradas repetidas de UFCD ou módulos.')
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
    let repaired = 0
    let attached = 0
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
        const source = request.document.sections[row.sectionIndex]
        const sameCode = existing.filter(module => normalize(module.code) === normalize(row.code))
        if (sameCode.length > 1) throw new Error('Existem módulos ambíguos com o mesmo código no destino.')
        if (sameCode.length) {
          const existingModule = sameCode[0]
          const activePlanifications = (
            await maProfessorDb.planifications
              .where('moduleId')
              .equals(existingModule.id)
              .toArray()
          ).filter(planification => planification.active)

          if (
            existingModule.active &&
            existingModule.academicYearId === request.academicYearId &&
            activePlanifications.length === 0
          ) {
            if (!source.contentsText.trim() && !source.objectivesText.trim()) {
              throw new Error('Uma UFCD ou módulo selecionado não contém conteúdos nem objetivos de planificação.')
            }

            const timestamp = new Date().toISOString()
            const audit = { createdAt: timestamp, updatedAt: timestamp }
            const kind = moduleKindLabel(existingModule.code)
            const planification: Planification = {
              id: crypto.randomUUID(), academicYearId: request.academicYearId,
              teachingAssignmentId: assignmentId, moduleId: existingModule.id, active: true,
              title: `Planificação — ${kind} ${existingModule.code} · ${existingModule.name}`,
              description: buildPlanificationDescription({
                source,
                periodMinutes: request.document.periodMinutes,
                confirmedPeriods: existingModule.plannedPeriods
              }),
              sourceDocumentName: request.document.name, sourcePages: source.sourcePages, ...audit
            }
            const items = buildSemanticPlanificationItems({
              planificationId: planification.id,
              source,
              documentName: request.document.name,
              documentSha256: request.document.sha256,
              sectionIndex: row.sectionIndex,
              assignmentId,
              timestamp
            })

            if (!items.length) throw new Error('Uma UFCD ou módulo selecionado não contém pontos de planificação válidos.')

            await maProfessorDb.planifications.add(planification)
            await maProfessorDb.planificationItems.bulkAdd(items)
            attached++
            continue
          }

          if (
            (source.contentsText.trim() || source.objectivesText.trim()) &&
            await repairLegacyImportedPlanification({
              module: existingModule,
              source,
              documentName: request.document.name,
              documentSha256: request.document.sha256,
              sectionIndex: row.sectionIndex,
              assignmentId
            })
          ) {
            repaired++
          }
          skipped++
          continue
        }
        if (existing.some(module => normalize(module.name) === normalize(row.name))) {
          throw new Error('Já existe um módulo com esta designação e outro código. Resolva a correspondência antes de importar.')
        }
        if (!source.contentsText.trim() && !source.objectivesText.trim()) {
          throw new Error('Uma UFCD ou módulo selecionado não contém conteúdos nem objetivos de planificação.')
        }
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
          description: buildPlanificationDescription({
            source,
            periodMinutes: request.document.periodMinutes,
            confirmedPeriods: row.plannedPeriods
          }),
          sourceDocumentName: request.document.name, sourcePages: source.sourcePages, ...audit
        }
        const items = buildSemanticPlanificationItems({
          planificationId: planification.id,
          source,
          documentName: request.document.name,
          documentSha256: request.document.sha256,
          sectionIndex: row.sectionIndex,
          assignmentId,
          timestamp
        })
        if (!items.length) throw new Error('Uma UFCD ou módulo selecionado não contém pontos de planificação válidos.')
        await maProfessorDb.modules.add(module)
        await maProfessorDb.planifications.add(planification)
        await maProfessorDb.planificationItems.bulkAdd(items)
        existing.push(module)
        created++
      }
    }
    return { created, skipped, repaired, attached }
  })
  if (result.created || result.repaired || result.attached) markDashboardDataDirty()
  return {
    created: result.created,
    skipped: result.skipped,
    ...(result.attached > 0
      ? { attached: result.attached }
      : {})
  }
}
