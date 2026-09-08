export type EntityId = string
export type ISODate = string
export type ISODateTime = string
export type LocalTime = string
export type Score = number
export type Percentage = number

export interface AuditFields {
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

export interface TeacherLocalProfile extends AuditFields {
  id: EntityId
  displayName: string
  schoolName: string
}

export interface AcademicYear extends AuditFields {
  id: EntityId
  name: string
  startDate: ISODate
  endDate: ISODate
  active: boolean
  setupCompletedAt: ISODateTime | null
}

export interface ClassGroup extends AuditFields {
  id: EntityId
  academicYearId: EntityId
  name: string
  courseName: string
  gradeLevel: string
  active: boolean
}

export interface Subject extends AuditFields {
  id: EntityId
  academicYearId: EntityId
  name: string
  shortName: string
  code: string
  active: boolean
}

export interface TeachingAssignment extends AuditFields {
  id: EntityId
  academicYearId: EntityId
  groupId: EntityId
  subjectId: EntityId
  displayName: string
  active: boolean
}

export interface ModuleUnit extends AuditFields {
  id: EntityId
  academicYearId: EntityId
  teachingAssignmentId: EntityId
  code: string
  name: string
  plannedPeriods: number
  order: number
  plannedStartDate: ISODate | null
  plannedEndDate: ISODate | null
  active: boolean
}

export interface StudentMembershipPeriod {
  startDate: ISODate
  endDate: ISODate | null
}

export interface Student extends AuditFields {
  id: EntityId
  academicYearId: EntityId
  groupId: EntityId
  number: string
  name: string
  active: boolean
  notes: string
  membershipPeriods?: StudentMembershipPeriod[]
}

export type AssessmentSchemeScope =
  | 'subject'
  | 'module'

export interface AssessmentScheme extends AuditFields {
  id: EntityId
  academicYearId: EntityId
  teachingAssignmentId: EntityId
  moduleId: EntityId | null
  scope: AssessmentSchemeScope
  name: string
  active: boolean
}

export interface AssessmentCriterion extends AuditFields {
  id: EntityId
  schemeId: EntityId
  name: string
  description: string
  weightPercent: Percentage
  order: number
  active: boolean
}

export interface Planification extends AuditFields {
  id: EntityId
  academicYearId: EntityId
  teachingAssignmentId: EntityId
  moduleId: EntityId
  title: string
  description: string
  active: boolean
  sourceDocumentName?: string
  sourcePages?: number[]
}

export type PlanificationItemStatus =
  | 'planned'
  | 'used'
  | 'skipped'

export interface PlanificationItem extends AuditFields {
  id: EntityId
  planificationId: EntityId
  order: number
  content: string
  activity: string
  objectives: string
  resources?: string
  evaluation?: string
  suggestedSummary: string
  sourceDocumentName?: string
  sourcePages?: number[]
  sourceImportKey?: string
  status: PlanificationItemStatus
  usedLessonId: EntityId | null
  usedAt: ISODateTime | null
}

export type Weekday =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7

export interface WeeklyScheduleSlot extends AuditFields {
  id: EntityId
  academicYearId: EntityId
  teachingAssignmentId: EntityId
  weekday: Weekday
  startTime: LocalTime
  endTime: LocalTime
  periodCount: number
  validFrom: ISODate
  validUntil: ISODate
  active: boolean
}

export type SchoolCalendarEventType =
  | 'holiday'
  | 'school_break'
  | 'strike'
  | 'field_trip'
  | 'teacher_absence'
  | 'meeting'
  | 'school_activity'
  | 'other'

export type SchoolCalendarEventScope =
  | 'all'
  | 'group'
  | 'teaching_assignment'

export interface SchoolCalendarEvent extends AuditFields {
  id: EntityId
  academicYearId: EntityId
  type: SchoolCalendarEventType
  scope: SchoolCalendarEventScope
  groupId: EntityId | null
  teachingAssignmentId: EntityId | null
  title: string
  description: string
  startDate: ISODate
  endDate: ISODate
  blocksLessons: boolean
}

export type LessonOrigin =
  | 'scheduled'
  | 'extra'

export type LessonStatus =
  | 'planned'
  | 'taught'
  | 'cancelled'

export type SummarySource =
  | 'manual'
  | 'planification'
  | 'ai'

export type GIAEStatus =
  | 'pending'
  | 'submitted'

export interface Lesson extends AuditFields {
  id: EntityId
  academicYearId: EntityId
  teachingAssignmentId: EntityId
  moduleId: EntityId
  scheduleSlotId: EntityId | null
  origin: LessonOrigin
  status: LessonStatus
  date: ISODate
  startTime: LocalTime
  endTime: LocalTime
  periodCount: number
  countTowardProgress: boolean
  plannedActivity: string
  summary: string
  summarySource: SummarySource
  planificationItemIds: EntityId[]
  giaeStatus: GIAEStatus
  giaeSubmittedAt: ISODateTime | null
  notes: string
}

export interface SummarySuggestion {
  id: EntityId
  lessonId: EntityId
  text: string
  variant:
    | 'concise'
    | 'formal'
    | 'detailed'
  generatedAt: ISODateTime
  acceptedAt: ISODateTime | null
}

export type AttendanceStatus =
  | 'present'
  | 'absent'

export interface LessonAttendance extends AuditFields {
  id: EntityId
  lessonId: EntityId
  studentId: EntityId
  status: AttendanceStatus
  code: string
  note: string
}

export type AssessmentActivityType =
  | 'participation'
  | 'practical_work'
  | 'presentation'
  | 'written_work'
  | 'test'
  | 'other'

export interface LessonAssessment extends AuditFields {
  id: EntityId
  academicYearId: EntityId
  lessonId: EntityId
  teachingAssignmentId: EntityId
  moduleId: EntityId
  criterionId: EntityId
  title: string
  activityType: AssessmentActivityType
  description: string
  absentScore: Score
  exemptScore: Score
}

export type AssessmentResultStatus =
  | 'evaluated'
  | 'absent'
  | 'exempt'

export interface AssessmentResult extends AuditFields {
  id: EntityId
  assessmentId: EntityId
  studentId: EntityId
  status: AssessmentResultStatus
  score: Score
  note: string
}

export interface ModuleFinalGrade extends AuditFields {
  id: EntityId
  academicYearId: EntityId
  teachingAssignmentId: EntityId
  moduleId: EntityId
  studentId: EntityId
  calculatedAverage: Score
  suggestedGrade: Score
  finalGrade: Score | null
  confirmedAt: ISODateTime | null
  note: string
}

export type LearningRecoveryStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'

export type LearningRecoveryOrigin =
  | 'automatic_threshold'
  | 'manual'

export interface LearningRecovery extends AuditFields {
  id: EntityId
  academicYearId: EntityId
  teachingAssignmentId: EntityId
  moduleId: EntityId
  studentId: EntityId
  triggeredAt: ISODateTime
  lessonCountAtTrigger: number
  absenceCountAtTrigger: number
  absencePercentAtTrigger: Percentage
  contents: string
  activity: string
  plannedDate: ISODate | null
  status: LearningRecoveryStatus
  result: string
  completedAt: ISODateTime | null
  origin?: LearningRecoveryOrigin
  teacherTouchedAt?: ISODateTime | null
}

export interface MAProfessorSettings extends AuditFields {
  id: EntityId
  defaultPeriodMinutes: number
  defaultAbsentAssessmentScore: Score
  defaultExemptAssessmentScore: Score
  absenceWarningPercent: Percentage
  learningRecoveryThresholdPercent: Percentage
  weekStartsOn:
    | 1
    | 7
  locale: 'pt-PT'
  theme:
    | 'dark'
    | 'system'
}

export type SetupStepId =
  | 'academic_year'
  | 'groups'
  | 'subjects'
  | 'modules'
  | 'assessment_criteria'
  | 'planifications'
  | 'weekly_schedule'
  | 'students'
  | 'confirmation'

export interface SetupProgress extends AuditFields {
  id: EntityId
  academicYearId: EntityId
  currentStep: SetupStepId
  completedSteps: SetupStepId[]
  completedAt: ISODateTime | null
}

export interface DashboardModuleProgress {
  moduleId: EntityId
  periodsTaught: number
  periodsRemaining: number
  completionPercent: Percentage
  estimatedCompletionDate: ISODate | null
}

export interface StudentAbsenceSummary {
  studentId: EntityId
  moduleId: EntityId
  lessonsTaught: number
  absences: number
  absencePercent: Percentage
  warningLevel:
    | 'regular'
    | 'warning'
    | 'recovery_required'
  recoveryId: EntityId | null
}

export interface CriterionGradeBreakdown {
  criterionId: EntityId
  criterionName: string
  weightPercent: Percentage
  assessmentCount: number
  average: Score | null
  weightedContribution: Score | null
}

export interface StudentModuleGradeSummary {
  studentId: EntityId
  moduleId: EntityId
  criteria: CriterionGradeBreakdown[]
  provisionalAverage: Score | null
  allActiveCriteriaAssessed: boolean
  suggestedGrade: Score | null
  confirmedFinalGrade: Score | null
}

export interface SearchFilters {
  query: string
  dateFrom: ISODate | null
  dateTo: ISODate | null
  groupId: EntityId | null
  subjectId: EntityId | null
  teachingAssignmentId: EntityId | null
  moduleId: EntityId | null
  studentId: EntityId | null
  giaeStatus: GIAEStatus | null
}

export interface BackupValidationIssue {
  path: string
  message: string
  severity:
    | 'error'
    | 'warning'
}

export interface BackupValidationResult {
  valid: boolean
  issues: BackupValidationIssue[]
  summary: {
    academicYears: number
    groups: number
    subjects: number
    modules: number
    students: number
    lessons: number
    assessments: number
    assessmentResults: number
  }
}

export interface MAProfessorBackupData {
  teacherProfiles: TeacherLocalProfile[]
  academicYears: AcademicYear[]
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
  schoolCalendarEvents: SchoolCalendarEvent[]
  lessons: Lesson[]
  summarySuggestions: SummarySuggestion[]
  lessonAttendance: LessonAttendance[]
  lessonAssessments: LessonAssessment[]
  assessmentResults: AssessmentResult[]
  moduleFinalGrades: ModuleFinalGrade[]
  learningRecoveries: LearningRecovery[]
  settings: MAProfessorSettings[]
  setupProgress: SetupProgress[]
}

export interface MAProfessorBackup {
  product: 'ma-professor'
  schemaVersion: 1
  exportedAt: ISODateTime
  data: MAProfessorBackupData
}

export type LicensePlan =
  | 'beta_30_days'
  | 'paid_30_days'
  | 'school_year'
  | 'courtesy_30_days'
  | 'courtesy_school_year'

export type LicenseStatus =
  | 'inactive'
  | 'active'
  | 'expiring'
  | 'renewal_pending'
  | 'expired'
  | 'revoked'

export interface LicenseSummary {
  email: string
  plan: LicensePlan | null
  status: LicenseStatus
  validFrom: ISODateTime | null
  validUntil: ISODateTime | null
  daysRemaining: number | null
  renewalRequestedAt: ISODateTime | null
  revokedAt?: ISODateTime | null
}

export type LicenseKeyStatus =
  | 'created'
  | 'activated'
  | 'expired'
  | 'revoked'

export interface LicenseKeyRecord extends AuditFields {
  id: EntityId
  email: string
  plan: LicensePlan
  status: LicenseKeyStatus
  validForDays: number | null
  validUntil: ISODateTime | null
  activatedAt: ISODateTime | null
}

export type RenewalRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'

export interface LicenseRenewalRequest extends AuditFields {
  id: EntityId
  email: string
  requestedPlan: LicensePlan
  amountCents: number
  currency: 'EUR'
  status: RenewalRequestStatus
  requestedAt: ISODateTime
  resolvedAt: ISODateTime | null
}
