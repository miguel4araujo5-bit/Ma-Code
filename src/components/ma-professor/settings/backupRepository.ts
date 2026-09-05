import {
  ensureDefaultMAProfessorSettings,
  maProfessorDb,
  openMAProfessorDatabase
} from '../db'
import type {
  BackupValidationIssue,
  BackupValidationResult,
  MAProfessorBackup,
  MAProfessorBackupData
} from '../types'

import {
  validateMAProfessorBackupDataIntegrity
} from './backupValidation'

const DATA_KEYS: Array<keyof MAProfessorBackupData> = [
  'teacherProfiles',
  'academicYears',
  'groups',
  'subjects',
  'teachingAssignments',
  'modules',
  'students',
  'assessmentSchemes',
  'assessmentCriteria',
  'planifications',
  'planificationItems',
  'weeklyScheduleSlots',
  'schoolCalendarEvents',
  'lessons',
  'summarySuggestions',
  'lessonAttendance',
  'lessonAssessments',
  'assessmentResults',
  'moduleFinalGrades',
  'learningRecoveries',
  'settings',
  'setupProgress'
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function createSummary(
  data: Partial<MAProfessorBackupData> | null
): BackupValidationResult['summary'] {
  const count = (key: keyof MAProfessorBackupData) =>
    Array.isArray(data?.[key]) ? data[key]!.length : 0

  return {
    academicYears: count('academicYears'),
    groups: count('groups'),
    subjects: count('subjects'),
    modules: count('modules'),
    students: count('students'),
    lessons: count('lessons'),
    assessments: count('lessonAssessments'),
    assessmentResults: count('assessmentResults')
  }
}

function buildValidationResult(
  issues: BackupValidationIssue[],
  data: Partial<MAProfessorBackupData> | null
): BackupValidationResult {
  return {
    valid: !issues.some(issue => issue.severity === 'error'),
    issues,
    summary: createSummary(data)
  }
}

export async function createMAProfessorBackup(): Promise<MAProfessorBackup> {
  await openMAProfessorDatabase()

  return maProfessorDb.transaction(
    'r',
    maProfessorDb.tables,
    async () => {
      const [
        teacherProfiles,
        academicYears,
        groups,
        subjects,
        teachingAssignments,
        modules,
        students,
        assessmentSchemes,
        assessmentCriteria,
        planifications,
        planificationItems,
        weeklyScheduleSlots,
        schoolCalendarEvents,
        lessons,
        summarySuggestions,
        lessonAttendance,
        lessonAssessments,
        assessmentResults,
        moduleFinalGrades,
        learningRecoveries,
        settings,
        setupProgress
      ] = await Promise.all([
        maProfessorDb.teacherProfiles.toArray(),
        maProfessorDb.academicYears.toArray(),
        maProfessorDb.groups.toArray(),
        maProfessorDb.subjects.toArray(),
        maProfessorDb.teachingAssignments.toArray(),
        maProfessorDb.modules.toArray(),
        maProfessorDb.students.toArray(),
        maProfessorDb.assessmentSchemes.toArray(),
        maProfessorDb.assessmentCriteria.toArray(),
        maProfessorDb.planifications.toArray(),
        maProfessorDb.planificationItems.toArray(),
        maProfessorDb.weeklyScheduleSlots.toArray(),
        maProfessorDb.schoolCalendarEvents.toArray(),
        maProfessorDb.lessons.toArray(),
        maProfessorDb.summarySuggestions.toArray(),
        maProfessorDb.lessonAttendance.toArray(),
        maProfessorDb.lessonAssessments.toArray(),
        maProfessorDb.assessmentResults.toArray(),
        maProfessorDb.moduleFinalGrades.toArray(),
        maProfessorDb.learningRecoveries.toArray(),
        maProfessorDb.settings.toArray(),
        maProfessorDb.setupProgress.toArray()
      ])

      return {
        product: 'ma-professor',
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        data: {
          teacherProfiles,
          academicYears,
          groups,
          subjects,
          teachingAssignments,
          modules,
          students,
          assessmentSchemes,
          assessmentCriteria,
          planifications,
          planificationItems,
          weeklyScheduleSlots,
          schoolCalendarEvents,
          lessons,
          summarySuggestions,
          lessonAttendance,
          lessonAssessments,
          assessmentResults,
          moduleFinalGrades,
          learningRecoveries,
          settings,
          setupProgress
        }
      }
    }
  )
}

export function validateMAProfessorBackup(
  value: unknown
): BackupValidationResult {
  const issues: BackupValidationIssue[] = []

  if (!isRecord(value)) {
    return buildValidationResult(
      [
        {
          path: '$',
          message: 'O ficheiro não contém um objeto JSON válido.',
          severity: 'error'
        }
      ],
      null
    )
  }

  if (value.product !== 'ma-professor') {
    issues.push({
      path: 'product',
      message: 'O ficheiro não pertence ao MA-Professor.',
      severity: 'error'
    })
  }

  if (value.schemaVersion !== 1) {
    issues.push({
      path: 'schemaVersion',
      message: 'A versão desta cópia de segurança não é suportada.',
      severity: 'error'
    })
  }

  if (
    typeof value.exportedAt !== 'string' ||
    Number.isNaN(
      Date.parse(value.exportedAt)
    )
  ) {
    issues.push({
      path: 'exportedAt',
      message: 'A data de exportação está em falta ou é inválida.',
      severity: 'warning'
    })
  }

  if (!isRecord(value.data)) {
    issues.push({
      path: 'data',
      message: 'A área de dados está em falta ou é inválida.',
      severity: 'error'
    })

    return buildValidationResult(issues, null)
  }

  const data = value.data as Partial<MAProfessorBackupData>

  for (const key of DATA_KEYS) {
    if (!Array.isArray(data[key])) {
      issues.push({
        path: `data.${key}`,
        message: `A coleção “${key}” está em falta ou é inválida.`,
        severity: 'error'
      })
    }
  }

  if (
    DATA_KEYS.every(
      key =>
        Array.isArray(
          data[key]
        )
    )
  ) {
    issues.push(
      ...validateMAProfessorBackupDataIntegrity(
        data
      )
    )
  }

  if (
    Array.isArray(data.academicYears) &&
    data.academicYears.length === 0
  ) {
    issues.push({
      path: 'data.academicYears',
      message: 'A cópia não contém qualquer ano letivo.',
      severity: 'warning'
    })
  }

  return buildValidationResult(issues, data)
}

export async function parseMAProfessorBackupFile(
  file: File
): Promise<{
  backup: MAProfessorBackup
  validation: BackupValidationResult
}> {
  if (file.size > 50 * 1024 * 1024) {
    throw new Error(
      'O ficheiro ultrapassa o limite de 50 MB.'
    )
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(await file.text())
  } catch {
    throw new Error(
      'O ficheiro não contém JSON válido.'
    )
  }

  const validation = validateMAProfessorBackup(parsed)

  return {
    backup: parsed as MAProfessorBackup,
    validation
  }
}

async function clearAllTables() {
  await Promise.all([
    maProfessorDb.teacherProfiles.clear(),
    maProfessorDb.academicYears.clear(),
    maProfessorDb.groups.clear(),
    maProfessorDb.subjects.clear(),
    maProfessorDb.teachingAssignments.clear(),
    maProfessorDb.modules.clear(),
    maProfessorDb.students.clear(),
    maProfessorDb.assessmentSchemes.clear(),
    maProfessorDb.assessmentCriteria.clear(),
    maProfessorDb.planifications.clear(),
    maProfessorDb.planificationItems.clear(),
    maProfessorDb.weeklyScheduleSlots.clear(),
    maProfessorDb.schoolCalendarEvents.clear(),
    maProfessorDb.lessons.clear(),
    maProfessorDb.summarySuggestions.clear(),
    maProfessorDb.lessonAttendance.clear(),
    maProfessorDb.lessonAssessments.clear(),
    maProfessorDb.assessmentResults.clear(),
    maProfessorDb.moduleFinalGrades.clear(),
    maProfessorDb.learningRecoveries.clear(),
    maProfessorDb.settings.clear(),
    maProfessorDb.setupProgress.clear()
  ])
}

async function putBackupData(data: MAProfessorBackupData) {
  await maProfessorDb.teacherProfiles.bulkPut(data.teacherProfiles)
  await maProfessorDb.academicYears.bulkPut(data.academicYears)
  await maProfessorDb.groups.bulkPut(data.groups)
  await maProfessorDb.subjects.bulkPut(data.subjects)
  await maProfessorDb.teachingAssignments.bulkPut(
    data.teachingAssignments
  )
  await maProfessorDb.modules.bulkPut(data.modules)
  await maProfessorDb.students.bulkPut(data.students)
  await maProfessorDb.assessmentSchemes.bulkPut(
    data.assessmentSchemes
  )
  await maProfessorDb.assessmentCriteria.bulkPut(
    data.assessmentCriteria
  )
  await maProfessorDb.planifications.bulkPut(data.planifications)
  await maProfessorDb.planificationItems.bulkPut(
    data.planificationItems
  )
  await maProfessorDb.weeklyScheduleSlots.bulkPut(
    data.weeklyScheduleSlots
  )
  await maProfessorDb.schoolCalendarEvents.bulkPut(
    data.schoolCalendarEvents
  )
  await maProfessorDb.lessons.bulkPut(data.lessons)
  await maProfessorDb.summarySuggestions.bulkPut(
    data.summarySuggestions
  )
  await maProfessorDb.lessonAttendance.bulkPut(
    data.lessonAttendance
  )
  await maProfessorDb.lessonAssessments.bulkPut(
    data.lessonAssessments
  )
  await maProfessorDb.assessmentResults.bulkPut(
    data.assessmentResults
  )
  await maProfessorDb.moduleFinalGrades.bulkPut(
    data.moduleFinalGrades
  )
  await maProfessorDb.learningRecoveries.bulkPut(
    data.learningRecoveries
  )
  await maProfessorDb.settings.bulkPut(data.settings)
  await maProfessorDb.setupProgress.bulkPut(data.setupProgress)
}

export async function restoreMAProfessorBackup(
  backup: MAProfessorBackup
) {
  const validation = validateMAProfessorBackup(backup)

  if (!validation.valid) {
    throw new Error(
      'A cópia de segurança contém erros e não pode ser restaurada.'
    )
  }

  await openMAProfessorDatabase()

  await maProfessorDb.transaction(
    'rw',
    maProfessorDb.tables,
    async () => {
      await clearAllTables()
      await putBackupData(backup.data)
    }
  )

  await ensureDefaultMAProfessorSettings()
}

export async function resetMAProfessorDatabase() {
  await openMAProfessorDatabase()

  await maProfessorDb.transaction(
    'rw',
    maProfessorDb.tables,
    async () => {
      await clearAllTables()
    }
  )

  await ensureDefaultMAProfessorSettings()
}

export function getBackupFileName(exportedAt: string) {
  const date = exportedAt.slice(0, 10)

  return `ma-professor-backup-${date}.json`
}
