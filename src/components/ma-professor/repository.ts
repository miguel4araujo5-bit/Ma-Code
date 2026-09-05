import {
  ensureDefaultMAProfessorSettings,
  maProfessorDb,
  openMAProfessorDatabase
} from './db'

import {
  createInitialStudentMembership,
  getLocalISODate
} from './students/studentMembership'

import type {
  AcademicYear,
  AssessmentCriterion,
  AssessmentScheme,
  ClassGroup,
  EntityId,
  MAProfessorSettings,
  ModuleUnit,
  Planification,
  PlanificationItem,
  SetupProgress,
  SetupStepId,
  Student,
  Subject,
  TeacherLocalProfile,
  TeachingAssignment,
  WeeklyScheduleSlot
} from './types'

type PersistentEntity = {
  id: EntityId
  createdAt: string
  updatedAt: string
}

export type CreateEntityInput<T extends PersistentEntity> = Omit<
  T,
  'id' | 'createdAt' | 'updatedAt'
>

export type UpdateEntityInput<T extends PersistentEntity> = Partial<
  Omit<T, 'id' | 'createdAt' | 'updatedAt'>
>

export interface StudentDraft {
  number: string
  name: string
  notes?: string
}

export interface AssessmentCriterionDraft {
  name: string
  description?: string
  weightPercent: number
  order?: number
  active?: boolean
}

export interface AssessmentSchemeDraft {
  academicYearId: EntityId
  teachingAssignmentId: EntityId
  moduleId: EntityId | null
  scope: AssessmentScheme['scope']
  name: string
  active?: boolean
}

export interface PlanificationItemDraft {
  content: string
  activity?: string
  objectives?: string
  suggestedSummary?: string
}

export interface PlanificationDraft {
  academicYearId: EntityId
  teachingAssignmentId: EntityId
  moduleId: EntityId
  title: string
  description?: string
  active?: boolean
}

export interface SetupSnapshot {
  academicYear: AcademicYear
  progress: SetupProgress | null
  groups: ClassGroup[]
  subjects: Subject[]
  teachingAssignments: TeachingAssignment[]
  modules: ModuleUnit[]
  students: Student[]
  assessmentSchemes: AssessmentScheme[]
  assessmentCriteria: AssessmentCriterion[]
  planifications: Planification[]
  planificationItems: PlanificationItem[]
  weeklyScheduleSlots: WeeklyScheduleSlot[]
}

const TEACHER_PROFILE_ID = 'local-profile'
const SCORE_MIN = 0
const SCORE_MAX = 20
const WEIGHT_TOLERANCE = 0.001

const SETUP_STEPS: SetupStepId[] = [
  'academic_year',
  'groups',
  'subjects',
  'modules',
  'weekly_schedule',
  'assessment_criteria',
  'planifications',
  'students',
  'confirmation'
]

function now() {
  return new Date().toISOString()
}

function createEntityId(prefix: string): EntityId {
  const uuid = globalThis.crypto?.randomUUID?.()

  if (uuid) {
    return `${prefix}-${uuid}`
  }

  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 12)}`
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function normalizeForComparison(value: string) {
  return normalizeText(value).toLocaleLowerCase('pt-PT')
}

function requireText(value: string, label: string) {
  const normalized = normalizeText(value)

  if (!normalized) {
    throw new Error(`${label} é obrigatório.`)
  }

  return normalized
}

function assertDateRange(
  startDate: string,
  endDate: string,
  label: string
) {
  if (!startDate || !endDate) {
    throw new Error(
      `${label}: indique as datas de início e de fim.`
    )
  }

  if (startDate > endDate) {
    throw new Error(
      `${label}: a data de início não pode ser posterior à data de fim.`
    )
  }
}

function assertTimeRange(
  startTime: string,
  endTime: string
) {
  if (!startTime || !endTime) {
    throw new Error(
      'Indique as horas de início e de fim.'
    )
  }

  if (startTime >= endTime) {
    throw new Error(
      'A hora de início deve ser anterior à hora de fim.'
    )
  }
}

function assertPositiveInteger(
  value: number,
  label: string
) {
  if (
    !Number.isInteger(value) ||
    value <= 0
  ) {
    throw new Error(
      `${label} deve ser um número inteiro superior a zero.`
    )
  }
}

function assertScore(
  value: number,
  label: string
) {
  if (
    !Number.isFinite(value) ||
    value < SCORE_MIN ||
    value > SCORE_MAX
  ) {
    throw new Error(
      `${label} deve estar entre ${SCORE_MIN} e ${SCORE_MAX} valores.`
    )
  }
}

function createRecord<
  T extends PersistentEntity
>(
  prefix: string,
  input: CreateEntityInput<T>
): T {
  const timestamp = now()

  return {
    ...input,
    id: createEntityId(prefix),
    createdAt: timestamp,
    updatedAt: timestamp
  } as T
}

function updateRecord<
  T extends PersistentEntity
>(
  current: T,
  changes: UpdateEntityInput<T>
): T {
  return {
    ...current,
    ...changes,
    id: current.id,
    createdAt: current.createdAt,
    updatedAt: now()
  }
}

function sortByName<
  T extends {
    name: string
  }
>(
  records: T[]
) {
  return records.sort(
    (
      left,
      right
    ) =>
      left.name.localeCompare(
        right.name,
        'pt-PT',
        {
          numeric: true,
          sensitivity: 'base'
        }
      )
  )
}

function validateCriteria(
  criteria: AssessmentCriterionDraft[]
) {
  const activeCriteria =
    criteria.filter(
      (
        criterion
      ) =>
        criterion.active !==
        false
    )

  if (
    activeCriteria.length === 0
  ) {
    throw new Error(
      'Adicione pelo menos um critério de avaliação ativo.'
    )
  }

  const names =
    new Set<string>()

  activeCriteria.forEach(
    (
      criterion
    ) => {
      const name =
        requireText(
          criterion.name,
          'O nome do critério'
        )

      const normalizedName =
        normalizeForComparison(
          name
        )

      if (
        names.has(
          normalizedName
        )
      ) {
        throw new Error(
          `O critério “${name}” está repetido.`
        )
      }

      if (
        !Number.isFinite(
          criterion.weightPercent
        ) ||
        criterion.weightPercent <=
          0
      ) {
        throw new Error(
          'Cada critério ativo deve ter uma ponderação superior a 0%.'
        )
      }

      names.add(
        normalizedName
      )
    }
  )

  const total =
    activeCriteria.reduce(
      (
        sum,
        criterion
      ) =>
        sum +
        criterion.weightPercent,
      0
    )

  if (
    Math.abs(
      total -
        100
    ) >
    WEIGHT_TOLERANCE
  ) {
    throw new Error(
      `Os critérios ativos devem totalizar 100%. Total atual: ${total}%.`
    )
  }
}

export class MAProfessorRepository {
  async initialize() {
    await openMAProfessorDatabase()

    await ensureDefaultMAProfessorSettings()
  }

  async getSettings() {
    await this.initialize()

    return ensureDefaultMAProfessorSettings()
  }

  async updateSettings(
    changes: Partial<
      Omit<
        MAProfessorSettings,
        | 'id'
        | 'createdAt'
        | 'updatedAt'
      >
    >
  ) {
    const current =
      await this.getSettings()

    const next =
      updateRecord(
        current,
        changes
      )

    assertPositiveInteger(
      next.defaultPeriodMinutes,
      'A duração do tempo letivo'
    )

    assertScore(
      next.defaultAbsentAssessmentScore,
      'A nota atribuída à falta'
    )

    assertScore(
      next.defaultExemptAssessmentScore,
      'A nota atribuída à dispensa'
    )

    if (
      next.absenceWarningPercent <
        0 ||
      next.absenceWarningPercent >
        100 ||
      next.learningRecoveryThresholdPercent <
        0 ||
      next.learningRecoveryThresholdPercent >
        100
    ) {
      throw new Error(
        'As percentagens de faltas devem estar entre 0% e 100%.'
      )
    }

    if (
      next.absenceWarningPercent >
      next.learningRecoveryThresholdPercent
    ) {
      throw new Error(
        'O aviso preventivo não pode ser superior ao limite da recuperação de aprendizagens.'
      )
    }

    await maProfessorDb.settings.put(
      next
    )

    return next
  }

  async getTeacherProfile() {
    await this.initialize()

    return maProfessorDb.teacherProfiles.get(
      TEACHER_PROFILE_ID
    )
  }

  async saveTeacherProfile(
    input: {
      displayName: string
      schoolName: string
    }
  ) {
    await this.initialize()

    const existing =
      await maProfessorDb.teacherProfiles.get(
        TEACHER_PROFILE_ID
      )

    const timestamp =
      now()

    const profile:
      TeacherLocalProfile =
      existing
        ? {
            ...existing,
            displayName:
              normalizeText(
                input.displayName
              ),
            schoolName:
              normalizeText(
                input.schoolName
              ),
            updatedAt:
              timestamp
          }
        : {
            id:
              TEACHER_PROFILE_ID,
            displayName:
              normalizeText(
                input.displayName
              ),
            schoolName:
              normalizeText(
                input.schoolName
              ),
            createdAt:
              timestamp,
            updatedAt:
              timestamp
          }

    await maProfessorDb.teacherProfiles.put(
      profile
    )

    return profile
  }

  async listAcademicYears() {
    await this.initialize()

    const years =
      await maProfessorDb.academicYears.toArray()

    return years.sort(
      (
        left,
        right
      ) =>
        right.startDate.localeCompare(
          left.startDate
        )
    )
  }

  async getAcademicYear(
    id: EntityId
  ) {
    await this.initialize()

    return maProfessorDb.academicYears.get(
      id
    )
  }

  async getActiveAcademicYear() {
    const years =
      await this.listAcademicYears()

    return years.find(
      (
        year
      ) =>
        year.active
    )
  }

  async createAcademicYear(
    input: {
      name: string
      startDate: string
      endDate: string
      active?: boolean
    }
  ) {
    await this.initialize()

    const name =
      requireText(
        input.name,
        'O nome do ano letivo'
      )

    const existingYears =
      await maProfessorDb.academicYears.toArray()

    assertDateRange(
      input.startDate,
      input.endDate,
      'Ano letivo'
    )

    if (
      existingYears.some(
        (
          year
        ) =>
          normalizeForComparison(
            year.name
          ) ===
          normalizeForComparison(
            name
          )
      )
    ) {
      throw new Error(
        'Já existe um ano letivo com este nome.'
      )
    }

    const active =
      input.active ??
      existingYears.length ===
        0

    const academicYear =
      createRecord<AcademicYear>(
        'year',
        {
          name,
          startDate:
            input.startDate,
          endDate:
            input.endDate,
          active,
          setupCompletedAt:
            null
        }
      )

    const progress =
      createRecord<SetupProgress>(
        'setup',
        {
          academicYearId:
            academicYear.id,
          currentStep:
            'groups',
          completedSteps: [
            'academic_year'
          ],
          completedAt:
            null
        }
      )

    await maProfessorDb.transaction(
      'rw',
      maProfessorDb.academicYears,
      maProfessorDb.setupProgress,
      async () => {
        if (
          active
        ) {
          const timestamp =
            now()

          await Promise.all(
            existingYears
              .filter(
                (
                  year
                ) =>
                  year.active
              )
              .map(
                (
                  year
                ) =>
                  maProfessorDb.academicYears.put(
                    {
                      ...year,
                      active:
                        false,
                      updatedAt:
                        timestamp
                    }
                  )
              )
          )
        }

        await maProfessorDb.academicYears.add(
          academicYear
        )

        await maProfessorDb.setupProgress.add(
          progress
        )
      }
    )

    return academicYear
  }

  async updateAcademicYear(
    id: EntityId,
    changes:
      UpdateEntityInput<AcademicYear>
  ) {
    await this.initialize()

    const current =
      await maProfessorDb.academicYears.get(
        id
      )

    if (
      !current
    ) {
      throw new Error(
        'O ano letivo indicado não existe.'
      )
    }

    const next =
      updateRecord(
        current,
        {
          ...changes,
          name:
            changes.name ===
            undefined
              ? current.name
              : requireText(
                  changes.name,
                  'O nome do ano letivo'
                )
        }
      )

    assertDateRange(
      next.startDate,
      next.endDate,
      'Ano letivo'
    )

    await maProfessorDb.academicYears.put(
      next
    )

    if (
      next.active &&
      !current.active
    ) {
      return this.setActiveAcademicYear(
        next.id
      )
    }

    return next
  }

  async setActiveAcademicYear(
    id: EntityId
  ) {
    await this.initialize()

    const selected =
      await maProfessorDb.academicYears.get(
        id
      )

    if (
      !selected
    ) {
      throw new Error(
        'O ano letivo indicado não existe.'
      )
    }

    const years =
      await maProfessorDb.academicYears.toArray()

    const timestamp =
      now()

    await maProfessorDb.transaction(
      'rw',
      maProfessorDb.academicYears,
      async () => {
        await Promise.all(
          years.map(
            (
              year
            ) =>
              maProfessorDb.academicYears.put(
                {
                  ...year,
                  active:
                    year.id ===
                    id,
                  updatedAt:
                    timestamp
                }
              )
          )
        )
      }
    )

    return {
      ...selected,
      active: true,
      updatedAt:
        timestamp
    }
  }

  async getSetupProgress(
    academicYearId:
      EntityId
  ) {
    await this.initialize()

    return maProfessorDb.setupProgress
      .where(
        'academicYearId'
      )
      .equals(
        academicYearId
      )
      .first()
  }

  async completeSetupStep(
    academicYearId:
      EntityId,
    step: SetupStepId
  ) {
    await this.initialize()

    const progress =
      await this.getSetupProgress(
        academicYearId
      )

    if (
      !progress
    ) {
      throw new Error(
        'Não foi encontrado o progresso da configuração inicial.'
      )
    }

    const completedSteps =
      Array.from(
        new Set([
          ...progress.completedSteps,
          step
        ])
      )

    const stepIndex =
      SETUP_STEPS.indexOf(
        step
      )

    const currentStep =
      SETUP_STEPS[
        Math.min(
          stepIndex +
            1,
          SETUP_STEPS.length -
            1
        )
      ]

    const next:
      SetupProgress = {
      ...progress,
      currentStep,
      completedSteps,
      updatedAt:
        now()
    }

    await maProfessorDb.setupProgress.put(
      next
    )

    return next
  }

  async finishSetup(
    academicYearId:
      EntityId
  ) {
    await this.initialize()

    const [
      academicYear,
      progress
    ] =
      await Promise.all([
        maProfessorDb.academicYears.get(
          academicYearId
        ),
        this.getSetupProgress(
          academicYearId
        )
      ])

    if (
      !academicYear ||
      !progress
    ) {
      throw new Error(
        'Não foi possível concluir a configuração deste ano letivo.'
      )
    }

    const timestamp =
      now()

    const completedYear:
      AcademicYear = {
      ...academicYear,
      setupCompletedAt:
        timestamp,
      updatedAt:
        timestamp
    }

    const completedProgress:
      SetupProgress = {
      ...progress,
      currentStep:
        'confirmation',
      completedSteps: [
        ...SETUP_STEPS
      ],
      completedAt:
        timestamp,
      updatedAt:
        timestamp
    }

    await maProfessorDb.transaction(
      'rw',
      maProfessorDb.academicYears,
      maProfessorDb.setupProgress,
      async () => {
        await maProfessorDb.academicYears.put(
          completedYear
        )

        await maProfessorDb.setupProgress.put(
          completedProgress
        )
      }
    )

    return completedYear
  }

  async listGroups(
    academicYearId:
      EntityId,
    includeInactive =
      false
  ) {
    await this.initialize()

    const groups =
      await maProfessorDb.groups
        .where(
          'academicYearId'
        )
        .equals(
          academicYearId
        )
        .toArray()

    return sortByName(
      includeInactive
        ? groups
        : groups.filter(
            (
              group
            ) =>
              group.active
          )
    )
  }

  async createGroup(
    input:
      CreateEntityInput<ClassGroup>
  ) {
    await this.initialize()

    const name =
      requireText(
        input.name,
        'O nome da turma'
      )

    const groups =
      await this.listGroups(
        input.academicYearId,
        true
      )

    if (
      groups.some(
        (
          group
        ) =>
          normalizeForComparison(
            group.name
          ) ===
          normalizeForComparison(
            name
          )
      )
    ) {
      throw new Error(
        'Já existe uma turma com este nome neste ano letivo.'
      )
    }

    const record =
      createRecord<ClassGroup>(
        'group',
        {
          ...input,
          name,
          courseName:
            normalizeText(
              input.courseName
            ),
          gradeLevel:
            normalizeText(
              input.gradeLevel
            )
        }
      )

    await maProfessorDb.groups.add(
      record
    )

    return record
  }

  async updateGroup(
    id: EntityId,
    changes:
      UpdateEntityInput<ClassGroup>
  ) {
    await this.initialize()

    const current =
      await maProfessorDb.groups.get(
        id
      )

    if (
      !current
    ) {
      throw new Error(
        'A turma indicada não existe.'
      )
    }

    const next =
      updateRecord(
        current,
        {
          ...changes,
          name:
            changes.name ===
            undefined
              ? current.name
              : requireText(
                  changes.name,
                  'O nome da turma'
                ),
          courseName:
            changes.courseName ===
            undefined
              ? current.courseName
              : normalizeText(
                  changes.courseName
                ),
          gradeLevel:
            changes.gradeLevel ===
            undefined
              ? current.gradeLevel
              : normalizeText(
                  changes.gradeLevel
                )
        }
      )

    await maProfessorDb.groups.put(
      next
    )

    return next
  }

  async listSubjects(
    academicYearId:
      EntityId,
    includeInactive =
      false
  ) {
    await this.initialize()

    const subjects =
      await maProfessorDb.subjects
        .where(
          'academicYearId'
        )
        .equals(
          academicYearId
        )
        .toArray()

    return sortByName(
      includeInactive
        ? subjects
        : subjects.filter(
            (
              subject
            ) =>
              subject.active
          )
    )
  }

  async createSubject(
    input:
      CreateEntityInput<Subject>
  ) {
    await this.initialize()

    const name =
      requireText(
        input.name,
        'O nome da disciplina'
      )

    const subjects =
      await this.listSubjects(
        input.academicYearId,
        true
      )

    if (
      subjects.some(
        (
          subject
        ) =>
          normalizeForComparison(
            subject.name
          ) ===
          normalizeForComparison(
            name
          )
      )
    ) {
      throw new Error(
        'Já existe uma disciplina com este nome neste ano letivo.'
      )
    }

    const record =
      createRecord<Subject>(
        'subject',
        {
          ...input,
          name,
          shortName:
            normalizeText(
              input.shortName
            ),
          code:
            normalizeText(
              input.code
            )
        }
      )

    await maProfessorDb.subjects.add(
      record
    )

    return record
  }

  async updateSubject(
    id: EntityId,
    changes:
      UpdateEntityInput<Subject>
  ) {
    await this.initialize()

    const current =
      await maProfessorDb.subjects.get(
        id
      )

    if (
      !current
    ) {
      throw new Error(
        'A disciplina indicada não existe.'
      )
    }

    const next =
      updateRecord(
        current,
        {
          ...changes,
          name:
            changes.name ===
            undefined
              ? current.name
              : requireText(
                  changes.name,
                  'O nome da disciplina'
                ),
          shortName:
            changes.shortName ===
            undefined
              ? current.shortName
              : normalizeText(
                  changes.shortName
                ),
          code:
            changes.code ===
            undefined
              ? current.code
              : normalizeText(
                  changes.code
                )
        }
      )

    await maProfessorDb.subjects.put(
      next
    )

    return next
  }

  async listTeachingAssignments(
    academicYearId:
      EntityId,
    includeInactive =
      false
  ) {
    await this.initialize()

    const records =
      await maProfessorDb.teachingAssignments
        .where(
          'academicYearId'
        )
        .equals(
          academicYearId
        )
        .toArray()

    return records
      .filter(
        (
          record
        ) =>
          includeInactive ||
          record.active
      )
      .sort(
        (
          left,
          right
        ) =>
          left.displayName.localeCompare(
            right.displayName,
            'pt-PT',
            {
              numeric: true,
              sensitivity:
                'base'
            }
          )
      )
  }

  async createTeachingAssignment(
    input:
      CreateEntityInput<TeachingAssignment>
  ) {
    await this.initialize()

    const [
      group,
      subject
    ] =
      await Promise.all([
        maProfessorDb.groups.get(
          input.groupId
        ),
        maProfessorDb.subjects.get(
          input.subjectId
        )
      ])

    if (
      !group ||
      !subject
    ) {
      throw new Error(
        'A turma ou a disciplina indicada não existe.'
      )
    }

    if (
      group.academicYearId !==
        input.academicYearId ||
      subject.academicYearId !==
        input.academicYearId
    ) {
      throw new Error(
        'A turma e a disciplina devem pertencer ao mesmo ano letivo.'
      )
    }

    const existing =
      await this.listTeachingAssignments(
        input.academicYearId,
        true
      )

    if (
      existing.some(
        (
          record
        ) =>
          record.groupId ===
            input.groupId &&
          record.subjectId ===
            input.subjectId
      )
    ) {
      throw new Error(
        'Esta disciplina já está associada à turma indicada.'
      )
    }

    const displayName =
      normalizeText(
        input.displayName
      ) ||
      `${
        subject.shortName ||
        subject.name
      } · ${group.name}`

    const record =
      createRecord<TeachingAssignment>(
        'assignment',
        {
          ...input,
          displayName
        }
      )

    await maProfessorDb.teachingAssignments.add(
      record
    )

    return record
  }

  async listModules(
    teachingAssignmentId:
      EntityId,
    includeInactive =
      false
  ) {
    await this.initialize()

    const modules =
      await maProfessorDb.modules
        .where(
          'teachingAssignmentId'
        )
        .equals(
          teachingAssignmentId
        )
        .toArray()

    return modules
      .filter(
        (
          module
        ) =>
          includeInactive ||
          module.active
      )
      .sort(
        (
          left,
          right
        ) =>
          left.order -
          right.order
      )
  }

  async createModule(
    input:
      CreateEntityInput<ModuleUnit>
  ) {
    await this.initialize()

    const assignment =
      await maProfessorDb.teachingAssignments.get(
        input.teachingAssignmentId
      )

    if (
      !assignment ||
      assignment.academicYearId !==
        input.academicYearId
    ) {
      throw new Error(
        'A turma e disciplina indicadas não pertencem a este ano letivo.'
      )
    }

    assertPositiveInteger(
      input.plannedPeriods,
      'A carga horária'
    )

    if (
      input.plannedStartDate &&
      input.plannedEndDate
    ) {
      assertDateRange(
        input.plannedStartDate,
        input.plannedEndDate,
        'UFCD ou módulo'
      )
    }

    const existing =
      await this.listModules(
        input.teachingAssignmentId,
        true
      )

    const code =
      normalizeText(
        input.code
      )

    if (
      code &&
      existing.some(
        (
          module
        ) =>
          normalizeForComparison(
            module.code
          ) ===
          normalizeForComparison(
            code
          )
      )
    ) {
      throw new Error(
        'Já existe uma UFCD ou módulo com este código.'
      )
    }

    const record =
      createRecord<ModuleUnit>(
        'module',
        {
          ...input,
          code,
          name:
            requireText(
              input.name,
              'O nome da UFCD ou módulo'
            )
        }
      )

    await maProfessorDb.modules.add(
      record
    )

    return record
  }

  async saveStudentsForGroup(
    academicYearId:
      EntityId,
    groupId:
      EntityId,
    drafts:
      StudentDraft[]
  ) {
    await this.initialize()

    const [
      group,
      academicYear
    ] =
      await Promise.all([
        maProfessorDb.groups.get(
          groupId
        ),
        maProfessorDb.academicYears.get(
          academicYearId
        )
      ])

    if (
      !group ||
      group.academicYearId !==
        academicYearId ||
      !academicYear
    ) {
      throw new Error(
        'A turma indicada não pertence ao ano letivo selecionado.'
      )
    }

    const [
      assignments,
      lessons
    ] =
      await Promise.all([
        maProfessorDb.teachingAssignments
          .where(
            'academicYearId'
          )
          .equals(
            academicYearId
          )
          .toArray(),
        maProfessorDb.lessons
          .where(
            'academicYearId'
          )
          .equals(
            academicYearId
          )
          .toArray()
      ])

    const groupAssignmentIds =
      new Set(
        assignments
          .filter(
            assignment =>
              assignment.groupId ===
                groupId
          )
          .map(
            assignment =>
              assignment.id
          )
      )

    const hasTaughtLesson =
      lessons.some(
        lesson =>
          lesson.status ===
            'taught' &&
          groupAssignmentIds.has(
            lesson.teachingAssignmentId
          )
      )

    const localToday =
      getLocalISODate()

    const membershipStartDate =
      hasTaughtLesson
        ? localToday <
          academicYear.startDate
          ? academicYear.startDate
          : localToday >
            academicYear.endDate
            ? academicYear.endDate
            : localToday
        : academicYear.startDate

    const cleanedDrafts =
      drafts.map(
        (
          draft
        ) => ({
          number:
            requireText(
              draft.number,
              'O número do aluno'
            ),
          name:
            requireText(
              draft.name,
              'O nome do aluno'
            ),
          notes:
            normalizeText(
              draft.notes ??
                ''
            )
        })
      )

    const duplicateNumbers =
      new Set<string>()

    const seenNumbers =
      new Set<string>()

    cleanedDrafts.forEach(
      (
        draft
      ) => {
        const number =
          normalizeForComparison(
            draft.number
          )

        if (
          seenNumbers.has(
            number
          )
        ) {
          duplicateNumbers.add(
            draft.number
          )
        }

        seenNumbers.add(
          number
        )
      }
    )

    if (
      duplicateNumbers.size >
      0
    ) {
      throw new Error(
        `Existem números de aluno repetidos: ${Array.from(
          duplicateNumbers
        ).join(', ')}.`
      )
    }

    const existing =
      await maProfessorDb.students
        .where(
          'groupId'
        )
        .equals(
          groupId
        )
        .toArray()

    const existingByNumber =
      new Map(
        existing.map(
          (
            student
          ) => [
            normalizeForComparison(
              student.number
            ),
            student
          ]
        )
      )

    const records =
      cleanedDrafts.map(
        (
          draft
        ) => {
          const current =
            existingByNumber.get(
              normalizeForComparison(
                draft.number
              )
            )

          if (
            current
          ) {
            return {
              ...current,
              name:
                draft.name,
              notes:
                draft.notes,
              active: true,
              updatedAt:
                now()
            }
          }

          return createRecord<Student>(
            'student',
            {
              academicYearId,
              groupId,
              number:
                draft.number,
              name:
                draft.name,
              active: true,
              notes:
                draft.notes,
              membershipPeriods:
                createInitialStudentMembership(
                  membershipStartDate
                )
            }
          )
        }
      )

    await maProfessorDb.students.bulkPut(
      records
    )

    return records
  }

  async listStudents(
    groupId:
      EntityId,
    includeInactive =
      false
  ) {
    await this.initialize()

    const students =
      await maProfessorDb.students
        .where(
          'groupId'
        )
        .equals(
          groupId
        )
        .toArray()

    return students
      .filter(
        (
          student
        ) =>
          includeInactive ||
          student.active
      )
      .sort(
        (
          left,
          right
        ) =>
          left.number.localeCompare(
            right.number,
            'pt-PT',
            {
              numeric: true,
              sensitivity:
                'base'
            }
          )
      )
  }

  async createAssessmentScheme(
    input:
      AssessmentSchemeDraft,
    criteria:
      AssessmentCriterionDraft[]
  ) {
    await this.initialize()

    validateCriteria(
      criteria
    )

    const assignment =
      await maProfessorDb.teachingAssignments.get(
        input.teachingAssignmentId
      )

    if (
      !assignment ||
      assignment.academicYearId !==
        input.academicYearId
    ) {
      throw new Error(
        'A disciplina e turma indicadas não pertencem ao ano letivo.'
      )
    }

    if (
      input.scope ===
        'module' &&
      !input.moduleId
    ) {
      throw new Error(
        'Selecione a UFCD ou módulo destes critérios.'
      )
    }

    if (
      input.scope ===
        'subject' &&
      input.moduleId
    ) {
      throw new Error(
        'Os critérios gerais da disciplina não podem ficar ligados a uma UFCD.'
      )
    }

    if (
      input.moduleId
    ) {
      const module =
        await maProfessorDb.modules.get(
          input.moduleId
        )

      if (
        !module ||
        module.teachingAssignmentId !==
          input.teachingAssignmentId
      ) {
        throw new Error(
          'A UFCD indicada não pertence a esta turma e disciplina.'
        )
      }
    }

    const scheme =
      createRecord<AssessmentScheme>(
        'scheme',
        {
          academicYearId:
            input.academicYearId,
          teachingAssignmentId:
            input.teachingAssignmentId,
          moduleId:
            input.moduleId,
          scope:
            input.scope,
          name:
            requireText(
              input.name,
              'O nome do conjunto de critérios'
            ),
          active:
            input.active ??
            true
        }
      )

    const criterionRecords =
      criteria.map(
        (
          criterion,
          index
        ) =>
          createRecord<AssessmentCriterion>(
            'criterion',
            {
              schemeId:
                scheme.id,
              name:
                requireText(
                  criterion.name,
                  'O nome do critério'
                ),
              description:
                normalizeText(
                  criterion.description ??
                    ''
                ),
              weightPercent:
                criterion.weightPercent,
              order:
                criterion.order ??
                index +
                  1,
              active:
                criterion.active ??
                true
            }
          )
      )

    await maProfessorDb.transaction(
      'rw',
      maProfessorDb.assessmentSchemes,
      maProfessorDb.assessmentCriteria,
      async () => {
        await maProfessorDb.assessmentSchemes.add(
          scheme
        )

        await maProfessorDb.assessmentCriteria.bulkAdd(
          criterionRecords
        )
      }
    )

    return {
      scheme,
      criteria:
        criterionRecords
    }
  }

  async listAssessmentSchemes(
    teachingAssignmentId:
      EntityId
  ) {
    await this.initialize()

    return maProfessorDb.assessmentSchemes
      .where(
        'teachingAssignmentId'
      )
      .equals(
        teachingAssignmentId
      )
      .toArray()
  }

  async listAssessmentCriteria(
    schemeId:
      EntityId
  ) {
    await this.initialize()

    const criteria =
      await maProfessorDb.assessmentCriteria
        .where(
          'schemeId'
        )
        .equals(
          schemeId
        )
        .toArray()

    return criteria.sort(
      (
        left,
        right
      ) =>
        left.order -
        right.order
    )
  }

  async createPlanification(
    input:
      PlanificationDraft,
    items:
      PlanificationItemDraft[]
  ) {
    await this.initialize()

    const module =
      await maProfessorDb.modules.get(
        input.moduleId
      )

    if (
      !module ||
      module.academicYearId !==
        input.academicYearId ||
      module.teachingAssignmentId !==
        input.teachingAssignmentId
    ) {
      throw new Error(
        'A UFCD indicada não pertence à turma e disciplina selecionadas.'
      )
    }

    const planification =
      createRecord<Planification>(
        'plan',
        {
          academicYearId:
            input.academicYearId,
          teachingAssignmentId:
            input.teachingAssignmentId,
          moduleId:
            input.moduleId,
          title:
            requireText(
              input.title,
              'O título da planificação'
            ),
          description:
            normalizeText(
              input.description ??
                ''
            ),
          active:
            input.active ??
            true
        }
      )

    const itemRecords =
      items
        .filter(
          (
            item
          ) =>
            Boolean(
              normalizeText(
                item.content ||
                  item.activity ||
                  item.objectives ||
                  item.suggestedSummary ||
                  ''
              )
            )
        )
        .map(
          (
            item,
            index
          ) =>
            createRecord<PlanificationItem>(
              'plan-item',
              {
                planificationId:
                  planification.id,
                order:
                  index +
                  1,
                content:
                  normalizeText(
                    item.content
                  ),
                activity:
                  normalizeText(
                    item.activity ??
                      ''
                  ),
                objectives:
                  normalizeText(
                    item.objectives ??
                      ''
                  ),
                suggestedSummary:
                  normalizeText(
                    item.suggestedSummary ??
                      ''
                  ),
                status:
                  'planned',
                usedLessonId:
                  null,
                usedAt:
                  null
              }
            )
        )

    await maProfessorDb.transaction(
      'rw',
      maProfessorDb.planifications,
      maProfessorDb.planificationItems,
      async () => {
        await maProfessorDb.planifications.add(
          planification
        )

        if (
          itemRecords.length >
          0
        ) {
          await maProfessorDb.planificationItems.bulkAdd(
            itemRecords
          )
        }
      }
    )

    return {
      planification,
      items:
        itemRecords
    }
  }

  async listPlanificationItems(
    planificationId:
      EntityId
  ) {
    await this.initialize()

    const items =
      await maProfessorDb.planificationItems
        .where(
          'planificationId'
        )
        .equals(
          planificationId
        )
        .toArray()

    return items.sort(
      (
        left,
        right
      ) =>
        left.order -
        right.order
    )
  }

  async reorderPlanificationItems(
    planificationId:
      EntityId,
    orderedIds:
      EntityId[]
  ) {
    const items =
      await this.listPlanificationItems(
        planificationId
      )

    const availableIds =
      new Set(
        items.map(
          (
            item
          ) =>
            item.id
        )
      )

    if (
      orderedIds.length !==
        items.length ||
      orderedIds.some(
        (
          id
        ) =>
          !availableIds.has(
            id
          )
      )
    ) {
      throw new Error(
        'A nova ordem não corresponde aos itens desta planificação.'
      )
    }

    const byId =
      new Map(
        items.map(
          (
            item
          ) => [
            item.id,
            item
          ]
        )
      )

    const timestamp =
      now()

    const reordered =
      orderedIds.map(
        (
          id,
          index
        ) => ({
          ...byId.get(
            id
          )!,
          order:
            index +
            1,
          updatedAt:
            timestamp
        })
      )

    await maProfessorDb.planificationItems.bulkPut(
      reordered
    )

    return reordered
  }

  async createWeeklyScheduleSlot(
    input:
      CreateEntityInput<WeeklyScheduleSlot>
  ) {
    await this.initialize()

    assertTimeRange(
      input.startTime,
      input.endTime
    )

    assertDateRange(
      input.validFrom,
      input.validUntil,
      'Vigência do horário'
    )

    assertPositiveInteger(
      input.periodCount,
      'O número de tempos'
    )

    const assignment =
      await maProfessorDb.teachingAssignments.get(
        input.teachingAssignmentId
      )

    if (
      !assignment ||
      assignment.academicYearId !==
        input.academicYearId
    ) {
      throw new Error(
        'A turma e disciplina indicadas não pertencem ao ano letivo.'
      )
    }

    const record =
      createRecord<WeeklyScheduleSlot>(
        'schedule',
        input
      )

    await maProfessorDb.weeklyScheduleSlots.add(
      record
    )

    return record
  }

  async listWeeklyScheduleSlots(
    academicYearId:
      EntityId
  ) {
    await this.initialize()

    const slots =
      await maProfessorDb.weeklyScheduleSlots
        .where(
          'academicYearId'
        )
        .equals(
          academicYearId
        )
        .toArray()

    return slots.sort(
      (
        left,
        right
      ) => {
        if (
          left.weekday !==
          right.weekday
        ) {
          return (
            left.weekday -
            right.weekday
          )
        }

        return left.startTime.localeCompare(
          right.startTime
        )
      }
    )
  }

  async getSetupSnapshot(
    academicYearId:
      EntityId
  ): Promise<SetupSnapshot> {
    await this.initialize()

    const academicYear =
      await maProfessorDb.academicYears.get(
        academicYearId
      )

    if (
      !academicYear
    ) {
      throw new Error(
        'O ano letivo indicado não existe.'
      )
    }

    const [
      progress,
      groups,
      subjects,
      teachingAssignments,
      modules,
      students,
      assessmentSchemes,
      planifications,
      weeklyScheduleSlots
    ] =
      await Promise.all([
        this.getSetupProgress(
          academicYearId
        ),
        this.listGroups(
          academicYearId,
          true
        ),
        this.listSubjects(
          academicYearId,
          true
        ),
        this.listTeachingAssignments(
          academicYearId,
          true
        ),
        maProfessorDb.modules
          .where(
            'academicYearId'
          )
          .equals(
            academicYearId
          )
          .toArray(),
        maProfessorDb.students
          .where(
            'academicYearId'
          )
          .equals(
            academicYearId
          )
          .toArray(),
        maProfessorDb.assessmentSchemes
          .where(
            'academicYearId'
          )
          .equals(
            academicYearId
          )
          .toArray(),
        maProfessorDb.planifications
          .where(
            'academicYearId'
          )
          .equals(
            academicYearId
          )
          .toArray(),
        maProfessorDb.weeklyScheduleSlots
          .where(
            'academicYearId'
          )
          .equals(
            academicYearId
          )
          .toArray()
      ])

    const [
      assessmentCriteria,
      planificationItems
    ] =
      await Promise.all([
        assessmentSchemes.length >
        0
          ? maProfessorDb.assessmentCriteria
              .where(
                'schemeId'
              )
              .anyOf(
                assessmentSchemes.map(
                  (
                    scheme
                  ) =>
                    scheme.id
                )
              )
              .toArray()
          : Promise.resolve(
              [] as AssessmentCriterion[]
            ),
        planifications.length >
        0
          ? maProfessorDb.planificationItems
              .where(
                'planificationId'
              )
              .anyOf(
                planifications.map(
                  (
                    planification
                  ) =>
                    planification.id
                )
              )
              .toArray()
          : Promise.resolve(
              [] as PlanificationItem[]
            )
      ])

    return {
      academicYear,
      progress:
        progress ??
        null,
      groups,
      subjects,
      teachingAssignments,
      modules:
        modules.sort(
          (
            left,
            right
          ) =>
            left.order -
            right.order
        ),
      students:
        students.sort(
          (
            left,
            right
          ) =>
            left.number.localeCompare(
              right.number,
              'pt-PT',
              {
                numeric: true
              }
            )
        ),
      assessmentSchemes,
      assessmentCriteria:
        assessmentCriteria.sort(
          (
            left,
            right
          ) =>
            left.order -
            right.order
        ),
      planifications,
      planificationItems:
        planificationItems.sort(
          (
            left,
            right
          ) =>
            left.order -
            right.order
        ),
      weeklyScheduleSlots:
        weeklyScheduleSlots.sort(
          (
            left,
            right
          ) => {
            if (
              left.weekday !==
              right.weekday
            ) {
              return (
                left.weekday -
                right.weekday
              )
            }

            return left.startTime.localeCompare(
              right.startTime
            )
          }
        )
    }
  }
}

export const maProfessorRepository =
  new MAProfessorRepository()
