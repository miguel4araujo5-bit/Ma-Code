import {
  maProfessorDb,
  openMAProfessorDatabase
} from '../db'
import { lessonRepository } from '../lessons/lessonRepository'
import type {
  AcademicYear,
  ClassGroup,
  EntityId,
  ISODate,
  Lesson,
  ModuleUnit,
  Subject,
  TeachingAssignment
} from '../types'

export type GIAEWorkspaceRowState =
  | 'missing_summary'
  | 'pending'
  | 'submitted'

export interface GIAEWorkspaceFilters {
  query: string
  dateFrom: ISODate | null
  dateTo: ISODate | null
  groupId: EntityId | null
  teachingAssignmentId: EntityId | null
  moduleId: EntityId | null
  state: GIAEWorkspaceRowState | null
}

export interface GIAEWorkspaceGroupOption {
  id: EntityId
  label: string
}

export interface GIAEWorkspaceAssignmentOption {
  id: EntityId
  groupId: EntityId
  subjectId: EntityId
  label: string
}

export interface GIAEWorkspaceModuleOption {
  id: EntityId
  teachingAssignmentId: EntityId
  label: string
}

export interface GIAEWorkspaceRow {
  lesson: Lesson
  assignment: TeachingAssignment
  group: ClassGroup
  subject: Subject
  module: ModuleUnit
  state: GIAEWorkspaceRowState
  isOverdue: boolean
  canCopy: boolean
  canMarkSubmitted: boolean
  canMarkPending: boolean
}

export interface GIAEWorkspaceTotals {
  total: number
  missingSummary: number
  pending: number
  submitted: number
  overdue: number
  copyReady: number
  periods: number
}

export interface GIAEWorkspaceSnapshot {
  academicYear: AcademicYear
  referenceDate: ISODate
  generatedAt: string
  filters: GIAEWorkspaceFilters
  totals: GIAEWorkspaceTotals
  visibleTotals: GIAEWorkspaceTotals
  groups: GIAEWorkspaceGroupOption[]
  assignments: GIAEWorkspaceAssignmentOption[]
  modules: GIAEWorkspaceModuleOption[]
  rows: GIAEWorkspaceRow[]
}

interface GIAEWorkspaceDataSet {
  academicYear: AcademicYear
  groups: ClassGroup[]
  subjects: Subject[]
  assignments: TeachingAssignment[]
  modules: ModuleUnit[]
  lessons: Lesson[]
}

const emptyFilters: GIAEWorkspaceFilters = {
  query: '',
  dateFrom: null,
  dateTo: null,
  groupId: null,
  teachingAssignmentId: null,
  moduleId: null,
  state: null
}

function now() {
  return new Date().toISOString()
}

function buildCopiedLessonFingerprint(
  lesson: Lesson
) {
  return JSON.stringify({
    id: lesson.id,
    teachingAssignmentId:
      lesson.teachingAssignmentId,
    moduleId: lesson.moduleId,
    date: lesson.date,
    startTime: lesson.startTime,
    endTime: lesson.endTime,
    periodCount: lesson.periodCount,
    status: lesson.status,
    summary: lesson.summary.trim()
  })
}

function toISODate(date: Date): ISODate {
  return [
    String(date.getFullYear()).padStart(4, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-')
}

function todayISO(): ISODate {
  return toISODate(new Date())
}

function assertISODate(value: ISODate, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} não é uma data válida.`)
  }

  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  const normalized = [
    String(parsed.getUTCFullYear()).padStart(4, '0'),
    String(parsed.getUTCMonth() + 1).padStart(2, '0'),
    String(parsed.getUTCDate()).padStart(2, '0')
  ].join('-')

  if (normalized !== value) {
    throw new Error(`${label} não é uma data válida.`)
  }
}

function clampReferenceDate(
  academicYear: AcademicYear,
  requestedDate?: ISODate
): ISODate {
  const referenceDate = requestedDate ?? todayISO()

  assertISODate(
    referenceDate,
    'A data de referência'
  )

  if (referenceDate < academicYear.startDate) {
    return academicYear.startDate
  }

  if (referenceDate > academicYear.endDate) {
    return academicYear.endDate
  }

  return referenceDate
}

function normalizeFilters(
  filters?: Partial<GIAEWorkspaceFilters>
): GIAEWorkspaceFilters {
  const normalized: GIAEWorkspaceFilters = {
    ...emptyFilters,
    ...filters,
    query: filters?.query?.trim() ?? ''
  }

  if (normalized.dateFrom) {
    assertISODate(
      normalized.dateFrom,
      'A data inicial'
    )
  }

  if (normalized.dateTo) {
    assertISODate(
      normalized.dateTo,
      'A data final'
    )
  }

  if (
    normalized.dateFrom &&
    normalized.dateTo &&
    normalized.dateFrom > normalized.dateTo
  ) {
    throw new Error(
      'A data inicial não pode ser posterior à data final.'
    )
  }

  return normalized
}

function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-PT')
    .replace(/\s+/g, ' ')
    .trim()
}

function getRowState(
  lesson: Lesson,
  referenceDate: ISODate
): GIAEWorkspaceRowState | null {
  if (lesson.status === 'cancelled') {
    return null
  }

  const hasSummary = Boolean(
    lesson.summary.trim()
  )

  if (
    lesson.status !== 'taught' ||
    !hasSummary
  ) {
    return lesson.date <= referenceDate
      ? 'missing_summary'
      : null
  }

  return lesson.giaeStatus === 'submitted'
    ? 'submitted'
    : 'pending'
}

function buildRow(
  lesson: Lesson,
  assignmentById: Map<EntityId, TeachingAssignment>,
  groupById: Map<EntityId, ClassGroup>,
  subjectById: Map<EntityId, Subject>,
  moduleById: Map<EntityId, ModuleUnit>,
  referenceDate: ISODate
): GIAEWorkspaceRow | null {
  const state = getRowState(
    lesson,
    referenceDate
  )

  if (!state) {
    return null
  }

  const assignment = assignmentById.get(
    lesson.teachingAssignmentId
  )

  const module = moduleById.get(
    lesson.moduleId
  )

  if (!assignment || !module) {
    return null
  }

  const group = groupById.get(
    assignment.groupId
  )

  const subject = subjectById.get(
    assignment.subjectId
  )

  if (!group || !subject) {
    return null
  }

  const canCopy = Boolean(
    lesson.summary.trim()
  )

  return {
    lesson,
    assignment,
    group,
    subject,
    module,
    state,
    isOverdue:
      state === 'missing_summary' &&
      lesson.date < referenceDate,
    canCopy,
    canMarkSubmitted:
      state === 'pending' &&
      lesson.status === 'taught' &&
      canCopy,
    canMarkPending:
      state === 'submitted'
  }
}

function sortRows(rows: GIAEWorkspaceRow[]) {
  return rows.sort((left, right) => {
    const dateComparison =
      right.lesson.date.localeCompare(
        left.lesson.date
      )

    if (dateComparison !== 0) {
      return dateComparison
    }

    const timeComparison =
      right.lesson.startTime.localeCompare(
        left.lesson.startTime
      )

    if (timeComparison !== 0) {
      return timeComparison
    }

    return left.group.name.localeCompare(
      right.group.name,
      'pt-PT',
      {
        numeric: true,
        sensitivity: 'base'
      }
    )
  })
}

function matchesQuery(
  row: GIAEWorkspaceRow,
  query: string
) {
  const normalizedQuery =
    normalizeSearchText(query)

  if (!normalizedQuery) {
    return true
  }

  const searchableText =
    normalizeSearchText(
      [
        row.lesson.date,
        row.lesson.startTime,
        row.lesson.endTime,
        row.lesson.summary,
        row.lesson.plannedActivity,
        row.lesson.notes,
        row.assignment.displayName,
        row.group.name,
        row.group.courseName,
        row.subject.name,
        row.subject.shortName,
        row.subject.code,
        row.module.code,
        row.module.name
      ].join(' ')
    )

  return searchableText.includes(
    normalizedQuery
  )
}

function applyFilters(
  rows: GIAEWorkspaceRow[],
  filters: GIAEWorkspaceFilters
) {
  return rows.filter((row) => {
    if (
      filters.dateFrom &&
      row.lesson.date < filters.dateFrom
    ) {
      return false
    }

    if (
      filters.dateTo &&
      row.lesson.date > filters.dateTo
    ) {
      return false
    }

    if (
      filters.groupId &&
      row.group.id !== filters.groupId
    ) {
      return false
    }

    if (
      filters.teachingAssignmentId &&
      row.assignment.id !==
        filters.teachingAssignmentId
    ) {
      return false
    }

    if (
      filters.moduleId &&
      row.module.id !== filters.moduleId
    ) {
      return false
    }

    if (
      filters.state &&
      row.state !== filters.state
    ) {
      return false
    }

    return matchesQuery(
      row,
      filters.query
    )
  })
}

function buildTotals(
  rows: GIAEWorkspaceRow[]
): GIAEWorkspaceTotals {
  return rows.reduce<GIAEWorkspaceTotals>(
    (totals, row) => {
      totals.total += 1
      totals.periods +=
        row.lesson.periodCount

      if (
        row.state === 'missing_summary'
      ) {
        totals.missingSummary += 1
      } else if (
        row.state === 'pending'
      ) {
        totals.pending += 1
      } else {
        totals.submitted += 1
      }

      if (row.isOverdue) {
        totals.overdue += 1
      }

      if (row.canCopy) {
        totals.copyReady += 1
      }

      return totals
    },
    {
      total: 0,
      missingSummary: 0,
      pending: 0,
      submitted: 0,
      overdue: 0,
      copyReady: 0,
      periods: 0
    }
  )
}

async function loadWorkspaceData(
  academicYearId: EntityId
): Promise<GIAEWorkspaceDataSet> {
  const [
    academicYear,
    groups,
    subjects,
    assignments,
    modules,
    lessons
  ] = await Promise.all([
    maProfessorDb.academicYears.get(
      academicYearId
    ),
    maProfessorDb.groups
      .where('academicYearId')
      .equals(academicYearId)
      .toArray(),
    maProfessorDb.subjects
      .where('academicYearId')
      .equals(academicYearId)
      .toArray(),
    maProfessorDb.teachingAssignments
      .where('academicYearId')
      .equals(academicYearId)
      .toArray(),
    maProfessorDb.modules
      .where('academicYearId')
      .equals(academicYearId)
      .toArray(),
    maProfessorDb.lessons
      .where('academicYearId')
      .equals(academicYearId)
      .toArray()
  ])

  if (!academicYear) {
    throw new Error(
      'O ano letivo indicado não existe.'
    )
  }

  return {
    academicYear,
    groups,
    subjects,
    assignments,
    modules,
    lessons
  }
}

function sortLabels<
  T extends {
    label: string
  }
>(items: T[]) {
  return items.sort((left, right) =>
    left.label.localeCompare(
      right.label,
      'pt-PT',
      {
        numeric: true,
        sensitivity: 'base'
      }
    )
  )
}

export function formatGIAERowForClipboard(
  row: GIAEWorkspaceRow
) {
  return row.lesson.summary.trim()
}

export function formatGIAERowsForClipboard(
  rows: GIAEWorkspaceRow[],
  includeContext = false
) {
  return [...rows]
    .filter((row) => row.canCopy)
    .sort((left, right) => {
      const dateComparison =
        left.lesson.date.localeCompare(
          right.lesson.date
        )

      return dateComparison !== 0
        ? dateComparison
        : left.lesson.startTime.localeCompare(
            right.lesson.startTime
          )
    })
    .map((row) => {
      const summary =
        formatGIAERowForClipboard(row)

      if (!includeContext) {
        return summary
      }

      return [
        `${row.lesson.date} · ${row.lesson.startTime}`,
        `${row.group.name} · ${
          row.subject.shortName ||
          row.subject.name
        }`,
        `${row.module.code} · ${row.module.name}`,
        summary
      ].join('\n')
    })
    .join('\n\n')
}

export class GIAEWorkspaceRepository {
  private readonly copiedLessonFingerprints =
    new Map<EntityId, string>()

  recordCopiedLesson(
    lesson: Lesson
  ) {
    this.copiedLessonFingerprints.set(
      lesson.id,
      buildCopiedLessonFingerprint(
        lesson
      )
    )
  }

  recordCopiedLessons(
    lessons: Lesson[]
  ) {
    lessons.forEach(
      (
        lesson
      ) =>
        this.recordCopiedLesson(
          lesson
        )
    )
  }

  private assertCopiedVersion(
    lesson: Lesson
  ) {
    const copiedFingerprint =
      this.copiedLessonFingerprints.get(
        lesson.id
      )

    if (!copiedFingerprint) {
      throw new Error(
        'Copie este sumário antes de o marcar como submetido no GIAE.'
      )
    }

    if (
      copiedFingerprint !==
      buildCopiedLessonFingerprint(
        lesson
      )
    ) {
      this.copiedLessonFingerprints.delete(
        lesson.id
      )

      throw new Error(
        'Este sumário foi alterado desde a última cópia. Copie-o novamente antes de o marcar como submetido no GIAE.'
      )
    }
  }

  async initialize() {
    await openMAProfessorDatabase()
  }

  async getWorkspace(
    academicYearId: EntityId,
    filters?: Partial<GIAEWorkspaceFilters>,
    requestedReferenceDate?: ISODate
  ): Promise<GIAEWorkspaceSnapshot> {
    await this.initialize()

    const data =
      await loadWorkspaceData(
        academicYearId
      )

    const referenceDate =
      clampReferenceDate(
        data.academicYear,
        requestedReferenceDate
      )

    const normalizedFilters =
      normalizeFilters(filters)

    const groupById = new Map(
      data.groups.map((group) => [
        group.id,
        group
      ])
    )

    const subjectById = new Map(
      data.subjects.map((subject) => [
        subject.id,
        subject
      ])
    )

    const assignmentById = new Map(
      data.assignments.map(
        (assignment) => [
          assignment.id,
          assignment
        ]
      )
    )

    const moduleById = new Map(
      data.modules.map((module) => [
        module.id,
        module
      ])
    )

    const allRows = sortRows(
      data.lessons
        .map((lesson) =>
          buildRow(
            lesson,
            assignmentById,
            groupById,
            subjectById,
            moduleById,
            referenceDate
          )
        )
        .filter(
          (
            row
          ): row is GIAEWorkspaceRow =>
            Boolean(row)
        )
    )

    const rows = applyFilters(
      allRows,
      normalizedFilters
    )

    const groupIds = new Set(
      allRows.map((row) => row.group.id)
    )

    const assignmentIds = new Set(
      allRows.map(
        (row) => row.assignment.id
      )
    )

    const moduleIds = new Set(
      allRows.map((row) => row.module.id)
    )

    const groups = sortLabels(
      data.groups
        .filter((group) =>
          groupIds.has(group.id)
        )
        .map((group) => ({
          id: group.id,
          label: group.name
        }))
    )

    const assignments = sortLabels(
      data.assignments
        .filter((assignment) =>
          assignmentIds.has(
            assignment.id
          )
        )
        .map((assignment) => {
          const group = groupById.get(
            assignment.groupId
          )

          const subject = subjectById.get(
            assignment.subjectId
          )

          return {
            id: assignment.id,
            groupId: assignment.groupId,
            subjectId:
              assignment.subjectId,
            label:
              assignment.displayName.trim() ||
              [
                group?.name,
                subject?.shortName ||
                  subject?.name
              ]
                .filter(Boolean)
                .join(' · ')
          }
        })
    )

    const modules = sortLabels(
      data.modules
        .filter((module) =>
          moduleIds.has(module.id)
        )
        .map((module) => ({
          id: module.id,
          teachingAssignmentId:
            module.teachingAssignmentId,
          label: [
            module.code,
            module.name
          ]
            .filter(Boolean)
            .join(' · ')
        }))
    )

    return {
      academicYear:
        data.academicYear,
      referenceDate,
      generatedAt: now(),
      filters:
        normalizedFilters,
      totals:
        buildTotals(allRows),
      visibleTotals:
        buildTotals(rows),
      groups,
      assignments,
      modules,
      rows
    }
  }

  async markSubmitted(
    lessonId: EntityId
  ) {
    await this.initialize()

    return maProfessorDb.transaction(
      'rw',
      maProfessorDb.lessons,
      async () => {
        const lesson =
          await maProfessorDb.lessons.get(
            lessonId
          )

        if (!lesson) {
          throw new Error(
            'A aula indicada não existe.'
          )
        }

        this.assertCopiedVersion(
          lesson
        )

        const updated =
          await lessonRepository.markGIAESubmitted(
            lessonId
          )

        this.copiedLessonFingerprints.delete(
          lessonId
        )

        return updated
      }
    )
  }

  async markPending(
    lessonId: EntityId
  ) {
    await this.initialize()

    return maProfessorDb.transaction(
      'rw',
      maProfessorDb.lessons,
      async () => {
        const updated =
          await lessonRepository.markGIAEPending(
            lessonId
          )

        this.copiedLessonFingerprints.delete(
          lessonId
        )

        return updated
      }
    )
  }

  async markManySubmitted(
    lessonIds: EntityId[]
  ) {
    await this.initialize()

    const uniqueLessonIds =
      Array.from(
        new Set(
          lessonIds
        )
      )

    return maProfessorDb.transaction(
      'rw',
      maProfessorDb.lessons,
      async () => {
        for (
          const lessonId of
          uniqueLessonIds
        ) {
          const lesson =
            await maProfessorDb.lessons.get(
              lessonId
            )

          if (!lesson) {
            throw new Error(
              'Uma das aulas indicadas não existe.'
            )
          }

          this.assertCopiedVersion(
            lesson
          )
        }

        const updated =
          await lessonRepository.markManyGIAESubmitted(
            uniqueLessonIds
          )

        uniqueLessonIds.forEach(
          (
            lessonId
          ) =>
            this.copiedLessonFingerprints.delete(
              lessonId
            )
        )

        return updated
      }
    )
  }
}

export const giaeWorkspaceRepository =
  new GIAEWorkspaceRepository()