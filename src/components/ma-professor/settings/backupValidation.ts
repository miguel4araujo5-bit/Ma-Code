import type {
  BackupValidationIssue,
  MAProfessorBackupData
} from '../types'

const MAX_ISSUES = 150

const ISO_DATE_PATTERN =
  /^\d{4}-\d{2}-\d{2}$/

const LOCAL_TIME_PATTERN =
  /^(?:[01]\d|2[0-3]):[0-5]\d$/

const SETUP_STEPS = new Set([
  'academic_year',
  'groups',
  'subjects',
  'modules',
  'assessment_criteria',
  'planifications',
  'weekly_schedule',
  'students',
  'confirmation'
])

type DataKey =
  keyof MAProfessorBackupData

type RecordValue =
  Record<string, unknown>

type IndexedCollection = {
  records: Array<{
    index: number
    value: RecordValue
  }>
  byId: Map<string, RecordValue>
}

function isRecord(
  value: unknown
): value is RecordValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function isNonEmptyString(
  value: unknown
): value is string {
  return (
    typeof value === 'string' &&
    Boolean(value.trim())
  )
}

function isIsoDate(
  value: unknown
): value is string {
  if (
    typeof value !== 'string' ||
    !ISO_DATE_PATTERN.test(value)
  ) {
    return false
  }

  const date = new Date(
    `${value}T00:00:00.000Z`
  )

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) ===
      value
  )
}

function isIsoDateTime(
  value: unknown
): value is string {
  return (
    typeof value === 'string' &&
    Boolean(value.trim()) &&
    !Number.isNaN(
      Date.parse(value)
    )
  )
}

function isScore(
  value: unknown
) {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 20
  )
}

function isPercentage(
  value: unknown
) {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 100
  )
}

function isPositiveInteger(
  value: unknown
) {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value > 0
  )
}

function createIssueCollector() {
  const issues:
    BackupValidationIssue[] = []
  let truncated = false

  const add = (
    path: string,
    message: string,
    severity:
      | 'error'
      | 'warning' = 'error'
  ) => {
    if (
      issues.length >=
      MAX_ISSUES
    ) {
      truncated = true
      return
    }

    issues.push({
      path,
      message,
      severity
    })
  }

  const finish = () => {
    if (
      truncated &&
      issues.length <
        MAX_ISSUES + 1
    ) {
      issues.push({
        path: 'data',
        message:
          'Foram encontrados mais problemas do que os apresentados. Corrija os erros indicados e volte a validar o ficheiro.',
        severity: 'warning'
      })
    }

    return issues
  }

  return {
    add,
    finish
  }
}

function indexCollection(
  data: Partial<MAProfessorBackupData>,
  key: DataKey,
  addIssue:
    (
      path: string,
      message: string,
      severity?:
        | 'error'
        | 'warning'
    ) => void
): IndexedCollection {
  const raw = data[key]

  if (!Array.isArray(raw)) {
    return {
      records: [],
      byId:
        new Map()
    }
  }

  const records:
    IndexedCollection['records'] = []

  const byId =
    new Map<string, RecordValue>()

  raw.forEach(
    (
      item,
      index
    ) => {
      const path =
        `data.${key}[${index}]`

      if (!isRecord(item)) {
        addIssue(
          path,
          'O registo tem de ser um objeto.'
        )
        return
      }

      records.push({
        index,
        value: item
      })

      if (
        !isNonEmptyString(
          item.id
        )
      ) {
        addIssue(
          `${path}.id`,
          'O identificador está em falta ou é inválido.'
        )
      } else if (
        byId.has(
          item.id
        )
      ) {
        addIssue(
          `${path}.id`,
          `O identificador “${item.id}” está duplicado nesta coleção.`
        )
      } else {
        byId.set(
          item.id,
          item
        )
      }

      for (
        const field of
        ['createdAt', 'updatedAt']
      ) {
        if (
          !isIsoDateTime(
            item[field]
          )
        ) {
          addIssue(
            `${path}.${field}`,
            'A data de auditoria está em falta ou é inválida.',
            'warning'
          )
        }
      }
    }
  )

  return {
    records,
    byId
  }
}

function validateReference(
  record: RecordValue,
  path: string,
  field: string,
  target:
    IndexedCollection,
  targetLabel: string,
  addIssue:
    (
      path: string,
      message: string,
      severity?:
        | 'error'
        | 'warning'
    ) => void,
  optional = false
) {
  const value =
    record[field]

  if (
    optional &&
    (
      value === null ||
      value === undefined ||
      value === ''
    )
  ) {
    return
  }

  if (!isNonEmptyString(value)) {
    addIssue(
      `${path}.${field}`,
      'A referência está em falta ou é inválida.'
    )
    return
  }

  if (!target.byId.has(value)) {
    addIssue(
      `${path}.${field}`,
      `A referência “${value}” não existe em ${targetLabel}.`
    )
  }
}

function validateEnum(
  value: unknown,
  allowed:
    readonly string[],
  path: string,
  addIssue:
    (
      path: string,
      message: string,
      severity?:
        | 'error'
        | 'warning'
    ) => void
) {
  if (
    typeof value !== 'string' ||
    !allowed.includes(value)
  ) {
    addIssue(
      path,
      `Valor inválido. Valores permitidos: ${allowed.join(', ')}.`
    )
  }
}

function validateDateRange(
  record: RecordValue,
  path: string,
  startField: string,
  endField: string,
  addIssue:
    (
      path: string,
      message: string,
      severity?:
        | 'error'
        | 'warning'
    ) => void
) {
  const start =
    record[startField]
  const end =
    record[endField]

  if (!isIsoDate(start)) {
    addIssue(
      `${path}.${startField}`,
      'A data deve usar o formato AAAA-MM-DD e representar uma data válida.'
    )
  }

  if (!isIsoDate(end)) {
    addIssue(
      `${path}.${endField}`,
      'A data deve usar o formato AAAA-MM-DD e representar uma data válida.'
    )
  }

  if (
    isIsoDate(start) &&
    isIsoDate(end) &&
    start > end
  ) {
    addIssue(
      path,
      'A data inicial não pode ser posterior à data final.'
    )
  }
}

function validateUniquePair(
  collection:
    IndexedCollection,
  fields:
    [string, string],
  label: string,
  key: DataKey,
  addIssue:
    (
      path: string,
      message: string,
      severity?:
        | 'error'
        | 'warning'
    ) => void
) {
  const seen =
    new Set<string>()

  for (
    const {
      index,
      value
    } of collection.records
  ) {
    const left =
      value[fields[0]]
    const right =
      value[fields[1]]

    if (
      !isNonEmptyString(left) ||
      !isNonEmptyString(right)
    ) {
      continue
    }

    const pair =
      `${left}\u0000${right}`

    if (seen.has(pair)) {
      addIssue(
        `data.${key}[${index}]`,
        `Existe mais do que um registo para ${label}.`
      )
    } else {
      seen.add(pair)
    }
  }
}

export function validateMAProfessorBackupDataIntegrity(
  data: Partial<MAProfessorBackupData>
): BackupValidationIssue[] {
  const collector =
    createIssueCollector()

  const addIssue =
    collector.add

  const keys:
    DataKey[] = [
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

  const collections =
    Object.fromEntries(
      keys.map(
        key => [
          key,
          indexCollection(
            data,
            key,
            addIssue
          )
        ]
      )
    ) as Record<
      DataKey,
      IndexedCollection
    >

  for (
    const {
      index,
      value
    } of collections.academicYears.records
  ) {
    validateDateRange(
      value,
      `data.academicYears[${index}]`,
      'startDate',
      'endDate',
      addIssue
    )
  }

  const referenceRules: Array<{
    key: DataKey
    field: string
    target: DataKey
    label: string
    optional?: boolean
  }> = [
    { key: 'groups', field: 'academicYearId', target: 'academicYears', label: 'anos letivos' },
    { key: 'subjects', field: 'academicYearId', target: 'academicYears', label: 'anos letivos' },
    { key: 'teachingAssignments', field: 'academicYearId', target: 'academicYears', label: 'anos letivos' },
    { key: 'teachingAssignments', field: 'groupId', target: 'groups', label: 'turmas' },
    { key: 'teachingAssignments', field: 'subjectId', target: 'subjects', label: 'disciplinas' },
    { key: 'modules', field: 'academicYearId', target: 'academicYears', label: 'anos letivos' },
    { key: 'modules', field: 'teachingAssignmentId', target: 'teachingAssignments', label: 'atribuições letivas' },
    { key: 'students', field: 'academicYearId', target: 'academicYears', label: 'anos letivos' },
    { key: 'students', field: 'groupId', target: 'groups', label: 'turmas' },
    { key: 'assessmentSchemes', field: 'academicYearId', target: 'academicYears', label: 'anos letivos' },
    { key: 'assessmentSchemes', field: 'teachingAssignmentId', target: 'teachingAssignments', label: 'atribuições letivas' },
    { key: 'assessmentSchemes', field: 'moduleId', target: 'modules', label: 'módulos', optional: true },
    { key: 'assessmentCriteria', field: 'schemeId', target: 'assessmentSchemes', label: 'esquemas de avaliação' },
    { key: 'planifications', field: 'academicYearId', target: 'academicYears', label: 'anos letivos' },
    { key: 'planifications', field: 'teachingAssignmentId', target: 'teachingAssignments', label: 'atribuições letivas' },
    { key: 'planifications', field: 'moduleId', target: 'modules', label: 'módulos' },
    { key: 'planificationItems', field: 'planificationId', target: 'planifications', label: 'planificações' },
    { key: 'planificationItems', field: 'usedLessonId', target: 'lessons', label: 'aulas', optional: true },
    { key: 'weeklyScheduleSlots', field: 'academicYearId', target: 'academicYears', label: 'anos letivos' },
    { key: 'weeklyScheduleSlots', field: 'teachingAssignmentId', target: 'teachingAssignments', label: 'atribuições letivas' },
    { key: 'schoolCalendarEvents', field: 'academicYearId', target: 'academicYears', label: 'anos letivos' },
    { key: 'schoolCalendarEvents', field: 'groupId', target: 'groups', label: 'turmas', optional: true },
    { key: 'schoolCalendarEvents', field: 'teachingAssignmentId', target: 'teachingAssignments', label: 'atribuições letivas', optional: true },
    { key: 'lessons', field: 'academicYearId', target: 'academicYears', label: 'anos letivos' },
    { key: 'lessons', field: 'teachingAssignmentId', target: 'teachingAssignments', label: 'atribuições letivas' },
    { key: 'lessons', field: 'moduleId', target: 'modules', label: 'módulos' },
    { key: 'lessons', field: 'scheduleSlotId', target: 'weeklyScheduleSlots', label: 'blocos de horário', optional: true },
    { key: 'summarySuggestions', field: 'lessonId', target: 'lessons', label: 'aulas' },
    { key: 'lessonAttendance', field: 'lessonId', target: 'lessons', label: 'aulas' },
    { key: 'lessonAttendance', field: 'studentId', target: 'students', label: 'alunos' },
    { key: 'lessonAssessments', field: 'academicYearId', target: 'academicYears', label: 'anos letivos' },
    { key: 'lessonAssessments', field: 'lessonId', target: 'lessons', label: 'aulas' },
    { key: 'lessonAssessments', field: 'teachingAssignmentId', target: 'teachingAssignments', label: 'atribuições letivas' },
    { key: 'lessonAssessments', field: 'moduleId', target: 'modules', label: 'módulos' },
    { key: 'lessonAssessments', field: 'criterionId', target: 'assessmentCriteria', label: 'critérios de avaliação' },
    { key: 'assessmentResults', field: 'assessmentId', target: 'lessonAssessments', label: 'avaliações' },
    { key: 'assessmentResults', field: 'studentId', target: 'students', label: 'alunos' },
    { key: 'moduleFinalGrades', field: 'academicYearId', target: 'academicYears', label: 'anos letivos' },
    { key: 'moduleFinalGrades', field: 'teachingAssignmentId', target: 'teachingAssignments', label: 'atribuições letivas' },
    { key: 'moduleFinalGrades', field: 'moduleId', target: 'modules', label: 'módulos' },
    { key: 'moduleFinalGrades', field: 'studentId', target: 'students', label: 'alunos' },
    { key: 'learningRecoveries', field: 'academicYearId', target: 'academicYears', label: 'anos letivos' },
    { key: 'learningRecoveries', field: 'teachingAssignmentId', target: 'teachingAssignments', label: 'atribuições letivas' },
    { key: 'learningRecoveries', field: 'moduleId', target: 'modules', label: 'módulos' },
    { key: 'learningRecoveries', field: 'studentId', target: 'students', label: 'alunos' },
    { key: 'setupProgress', field: 'academicYearId', target: 'academicYears', label: 'anos letivos' }
  ]

  for (
    const rule of
    referenceRules
  ) {
    for (
      const {
        index,
        value
      } of collections[
        rule.key
      ].records
    ) {
      validateReference(
        value,
        `data.${rule.key}[${index}]`,
        rule.field,
        collections[
          rule.target
        ],
        rule.label,
        addIssue,
        rule.optional
      )
    }
  }

  for (
    const {
      index,
      value
    } of collections.assessmentSchemes.records
  ) {
    validateEnum(
      value.scope,
      ['subject', 'module'],
      `data.assessmentSchemes[${index}].scope`,
      addIssue
    )
  }

  for (
    const {
      index,
      value
    } of collections.assessmentCriteria.records
  ) {
    if (
      !isPercentage(
        value.weightPercent
      )
    ) {
      addIssue(
        `data.assessmentCriteria[${index}].weightPercent`,
        'O peso do critério deve estar entre 0 e 100.'
      )
    }
  }

  for (
    const {
      index,
      value
    } of collections.planificationItems.records
  ) {
    validateEnum(
      value.status,
      ['planned', 'used', 'skipped'],
      `data.planificationItems[${index}].status`,
      addIssue
    )
  }

  for (
    const {
      index,
      value
    } of collections.weeklyScheduleSlots.records
  ) {
    const path =
      `data.weeklyScheduleSlots[${index}]`

    if (
      typeof value.weekday !== 'number' ||
      !Number.isInteger(value.weekday) ||
      value.weekday < 1 ||
      value.weekday > 7
    ) {
      addIssue(
        `${path}.weekday`,
        'O dia da semana deve estar entre 1 e 7.'
      )
    }

    if (
      typeof value.startTime !== 'string' ||
      !LOCAL_TIME_PATTERN.test(
        value.startTime
      )
    ) {
      addIssue(
        `${path}.startTime`,
        'A hora inicial deve usar o formato HH:MM.'
      )
    }

    if (
      typeof value.endTime !== 'string' ||
      !LOCAL_TIME_PATTERN.test(
        value.endTime
      )
    ) {
      addIssue(
        `${path}.endTime`,
        'A hora final deve usar o formato HH:MM.'
      )
    }

    if (
      typeof value.startTime === 'string' &&
      typeof value.endTime === 'string' &&
      LOCAL_TIME_PATTERN.test(
        value.startTime
      ) &&
      LOCAL_TIME_PATTERN.test(
        value.endTime
      ) &&
      value.startTime >=
        value.endTime
    ) {
      addIssue(
        path,
        'A hora inicial do bloco deve ser anterior à hora final.'
      )
    }

    if (!isPositiveInteger(value.periodCount)) {
      addIssue(
        `${path}.periodCount`,
        'O número de tempos deve ser um inteiro superior a zero.'
      )
    }

    validateDateRange(
      value,
      path,
      'validFrom',
      'validUntil',
      addIssue
    )
  }

  for (
    const {
      index,
      value
    } of collections.schoolCalendarEvents.records
  ) {
    const path =
      `data.schoolCalendarEvents[${index}]`

    validateEnum(
      value.type,
      [
        'holiday',
        'school_break',
        'strike',
        'field_trip',
        'teacher_absence',
        'meeting',
        'school_activity',
        'other'
      ],
      `${path}.type`,
      addIssue
    )

    validateEnum(
      value.scope,
      [
        'all',
        'group',
        'teaching_assignment'
      ],
      `${path}.scope`,
      addIssue
    )

    validateDateRange(
      value,
      path,
      'startDate',
      'endDate',
      addIssue
    )

    if (
      value.scope === 'group' &&
      !isNonEmptyString(
        value.groupId
      )
    ) {
      addIssue(
        `${path}.groupId`,
        'Um evento de turma tem de indicar a turma.'
      )
    }

    if (
      value.scope ===
        'teaching_assignment' &&
      !isNonEmptyString(
        value.teachingAssignmentId
      )
    ) {
      addIssue(
        `${path}.teachingAssignmentId`,
        'Um evento de disciplina/turma tem de indicar a atribuição letiva.'
      )
    }
  }

  for (
    const {
      index,
      value
    } of collections.lessons.records
  ) {
    const path =
      `data.lessons[${index}]`

    validateEnum(
      value.origin,
      ['scheduled', 'extra'],
      `${path}.origin`,
      addIssue
    )
    validateEnum(
      value.status,
      ['planned', 'taught', 'cancelled'],
      `${path}.status`,
      addIssue
    )
    validateEnum(
      value.summarySource,
      ['manual', 'planification', 'ai'],
      `${path}.summarySource`,
      addIssue
    )
    validateEnum(
      value.giaeStatus,
      ['pending', 'submitted'],
      `${path}.giaeStatus`,
      addIssue
    )

    if (!isIsoDate(value.date)) {
      addIssue(
        `${path}.date`,
        'A data da aula é inválida.'
      )
    }

    if (
      typeof value.startTime !== 'string' ||
      !LOCAL_TIME_PATTERN.test(
        value.startTime
      ) ||
      typeof value.endTime !== 'string' ||
      !LOCAL_TIME_PATTERN.test(
        value.endTime
      ) ||
      (
        typeof value.startTime === 'string' &&
        typeof value.endTime === 'string' &&
        value.startTime >=
          value.endTime
      )
    ) {
      addIssue(
        `${path}.startTime`,
        'O intervalo horário da aula é inválido.'
      )
    }

    if (!isPositiveInteger(value.periodCount)) {
      addIssue(
        `${path}.periodCount`,
        'O número de tempos deve ser um inteiro superior a zero.'
      )
    }

    if (
      value.status === 'taught' &&
      !isNonEmptyString(
        value.summary
      )
    ) {
      addIssue(
        `${path}.summary`,
        'Uma aula dada tem de ter sumário.'
      )
    }

    if (!Array.isArray(value.planificationItemIds)) {
      addIssue(
        `${path}.planificationItemIds`,
        'A lista de itens de planificação é inválida.'
      )
    } else {
      const seen =
        new Set<string>()

      value.planificationItemIds.forEach(
        (
          itemId,
          itemIndex
        ) => {
          if (!isNonEmptyString(itemId)) {
            addIssue(
              `${path}.planificationItemIds[${itemIndex}]`,
              'O identificador do item de planificação é inválido.'
            )
            return
          }

          if (
            !collections.planificationItems.byId.has(
              itemId
            )
          ) {
            addIssue(
              `${path}.planificationItemIds[${itemIndex}]`,
              `O item de planificação “${itemId}” não existe.`
            )
          }

          if (seen.has(itemId)) {
            addIssue(
              `${path}.planificationItemIds[${itemIndex}]`,
              `O item de planificação “${itemId}” está repetido na aula.`
            )
          }

          seen.add(itemId)
        }
      )
    }
  }

  for (
    const {
      index,
      value
    } of collections.summarySuggestions.records
  ) {
    validateEnum(
      value.variant,
      ['concise', 'formal', 'detailed'],
      `data.summarySuggestions[${index}].variant`,
      addIssue
    )
  }

  for (
    const {
      index,
      value
    } of collections.lessonAttendance.records
  ) {
    validateEnum(
      value.status,
      ['present', 'absent'],
      `data.lessonAttendance[${index}].status`,
      addIssue
    )
  }

  for (
    const {
      index,
      value
    } of collections.lessonAssessments.records
  ) {
    const path =
      `data.lessonAssessments[${index}]`

    validateEnum(
      value.activityType,
      [
        'participation',
        'practical_work',
        'presentation',
        'written_work',
        'test',
        'other'
      ],
      `${path}.activityType`,
      addIssue
    )

    if (!isScore(value.absentScore)) {
      addIssue(
        `${path}.absentScore`,
        'A classificação por falta deve estar entre 0 e 20.'
      )
    }

    if (!isScore(value.exemptScore)) {
      addIssue(
        `${path}.exemptScore`,
        'A classificação por dispensa deve estar entre 0 e 20.'
      )
    }
  }

  for (
    const {
      index,
      value
    } of collections.assessmentResults.records
  ) {
    const path =
      `data.assessmentResults[${index}]`

    validateEnum(
      value.status,
      ['evaluated', 'absent', 'exempt'],
      `${path}.status`,
      addIssue
    )

    if (!isScore(value.score)) {
      addIssue(
        `${path}.score`,
        'A classificação deve estar entre 0 e 20.'
      )
    }
  }

  for (
    const {
      index,
      value
    } of collections.moduleFinalGrades.records
  ) {
    const path =
      `data.moduleFinalGrades[${index}]`

    if (!isScore(value.calculatedAverage)) {
      addIssue(
        `${path}.calculatedAverage`,
        'A média calculada deve estar entre 0 e 20.'
      )
    }

    if (!isScore(value.suggestedGrade)) {
      addIssue(
        `${path}.suggestedGrade`,
        'A nota sugerida deve estar entre 0 e 20.'
      )
    }

    if (
      value.finalGrade !== null &&
      !isScore(value.finalGrade)
    ) {
      addIssue(
        `${path}.finalGrade`,
        'A nota final deve estar entre 0 e 20 ou ser nula.'
      )
    }
  }

  for (
    const {
      index,
      value
    } of collections.learningRecoveries.records
  ) {
    const path =
      `data.learningRecoveries[${index}]`

    validateEnum(
      value.status,
      ['pending', 'in_progress', 'completed'],
      `${path}.status`,
      addIssue
    )

    if (
      !isPercentage(
        value.absencePercentAtTrigger
      )
    ) {
      addIssue(
        `${path}.absencePercentAtTrigger`,
        'A percentagem de faltas deve estar entre 0 e 100.'
      )
    }
  }

  for (
    const {
      index,
      value
    } of collections.settings.records
  ) {
    const path =
      `data.settings[${index}]`

    if (!isPositiveInteger(value.defaultPeriodMinutes)) {
      addIssue(
        `${path}.defaultPeriodMinutes`,
        'A duração predefinida do tempo deve ser um inteiro superior a zero.'
      )
    }

    for (
      const field of
      [
        'defaultAbsentAssessmentScore',
        'defaultExemptAssessmentScore'
      ]
    ) {
      if (!isScore(value[field])) {
        addIssue(
          `${path}.${field}`,
          'A classificação predefinida deve estar entre 0 e 20.'
        )
      }
    }

    for (
      const field of
      [
        'absenceWarningPercent',
        'learningRecoveryThresholdPercent'
      ]
    ) {
      if (!isPercentage(value[field])) {
        addIssue(
          `${path}.${field}`,
          'A percentagem deve estar entre 0 e 100.'
        )
      }
    }

    if (
      value.weekStartsOn !== 1 &&
      value.weekStartsOn !== 7
    ) {
      addIssue(
        `${path}.weekStartsOn`,
        'O primeiro dia da semana deve ser 1 ou 7.'
      )
    }

    if (value.locale !== 'pt-PT') {
      addIssue(
        `${path}.locale`,
        'A configuração regional suportada é pt-PT.'
      )
    }

    validateEnum(
      value.theme,
      ['dark', 'system'],
      `${path}.theme`,
      addIssue
    )
  }

  for (
    const {
      index,
      value
    } of collections.setupProgress.records
  ) {
    const path =
      `data.setupProgress[${index}]`

    if (
      typeof value.currentStep !== 'string' ||
      !SETUP_STEPS.has(
        value.currentStep
      )
    ) {
      addIssue(
        `${path}.currentStep`,
        'O passo atual da configuração é inválido.'
      )
    }

    if (!Array.isArray(value.completedSteps)) {
      addIssue(
        `${path}.completedSteps`,
        'A lista de passos concluídos é inválida.'
      )
    } else {
      value.completedSteps.forEach(
        (
          step,
          stepIndex
        ) => {
          if (
            typeof step !== 'string' ||
            !SETUP_STEPS.has(step)
          ) {
            addIssue(
              `${path}.completedSteps[${stepIndex}]`,
              'O passo concluído é inválido.'
            )
          }
        }
      )
    }
  }

  validateUniquePair(
    collections.lessonAttendance,
    ['lessonId', 'studentId'],
    'a mesma aula e o mesmo aluno',
    'lessonAttendance',
    addIssue
  )

  validateUniquePair(
    collections.assessmentResults,
    ['assessmentId', 'studentId'],
    'a mesma avaliação e o mesmo aluno',
    'assessmentResults',
    addIssue
  )

  validateUniquePair(
    collections.moduleFinalGrades,
    ['moduleId', 'studentId'],
    'o mesmo módulo e o mesmo aluno',
    'moduleFinalGrades',
    addIssue
  )

  return collector.finish()
}
