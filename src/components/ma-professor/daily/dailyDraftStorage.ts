const DAILY_DRAFT_DATABASE_NAME =
  'ma-professor-daily-drafts'

const DAILY_DRAFT_DATABASE_VERSION =
  1

const DAILY_DRAFT_STORE_NAME =
  'drafts'

const DAILY_DRAFT_SCHEMA_VERSION =
  1 as const

export interface MAProfessorDailyDraftLesson {
  status:
    | 'planned'
    | 'taught'
    | 'cancelled'
  startTime: string
  endTime: string
  periodCount: string
  countTowardProgress: boolean
  plannedActivity: string
  summary: string
  summarySource:
    | 'manual'
    | 'planification'
    | 'ai'
  planificationItemIds: string[]
  notes: string
  giaeStatus:
    | 'pending'
    | 'submitted'
}

export interface MAProfessorDailyDraftAssessment {
  choice: string
  criterionId: string
  title: string
  activityType:
    | 'participation'
    | 'practical_work'
    | 'presentation'
    | 'written_work'
    | 'test'
    | 'other'
  description: string
}

export interface MAProfessorDailyDraftStudent {
  studentId: string
  attendanceStatus:
    | 'present'
    | 'absent'
  attendanceCode: string
  attendanceNote: string
  assessmentStatus:
    | 'not_evaluated'
    | 'evaluated'
    | 'absent'
    | 'exempt'
  assessmentScoreText: string
  assessmentNote: string
}

export interface MAProfessorDailyDraft {
  id: string
  schemaVersion:
    typeof DAILY_DRAFT_SCHEMA_VERSION
  accountEmail: string
  academicYearId: string
  lessonId: string
  date: string
  baseSavedSignature: string
  draftSignature: string
  assessmentIdToDelete:
    string | null
  lesson:
    MAProfessorDailyDraftLesson
  assessment:
    MAProfessorDailyDraftAssessment
  students:
    MAProfessorDailyDraftStudent[]
  updatedAt: string
}

export interface MAProfessorDailyDraftInput {
  accountEmail: string
  academicYearId: string
  lessonId: string
  date: string
  baseSavedSignature: string
  draftSignature: string
  assessmentIdToDelete:
    string | null
  lesson:
    MAProfessorDailyDraftLesson
  assessment:
    MAProfessorDailyDraftAssessment
  students:
    MAProfessorDailyDraftStudent[]
}

interface MAProfessorDailyDraftSafetyMetadata {
  baseSavedSignature: string
  draftSignature: string
}

function normalizeEmail(
  email: string
) {
  return email
    .trim()
    .toLowerCase()
}

function normalizeRequiredId(
  value: string,
  label: string
) {
  const normalized =
    value.trim()

  if (!normalized) {
    throw new Error(
      `${label} não é válido para guardar o rascunho.`
    )
  }

  return normalized
}

export function createMAProfessorDailyDraftId(
  email: string,
  academicYearId: string,
  lessonId: string
) {
  const normalizedEmail =
    normalizeEmail(
      email
    )

  if (!normalizedEmail) {
    throw new Error(
      'A conta não é válida para guardar o rascunho.'
    )
  }

  return JSON.stringify([
    normalizedEmail,
    normalizeRequiredId(
      academicYearId,
      'O ano letivo'
    ),
    normalizeRequiredId(
      lessonId,
      'A aula'
    )
  ])
}

export function shouldAutoRestoreMAProfessorDailyDraft(
  draft:
    MAProfessorDailyDraftSafetyMetadata,
  currentSavedSignature: string
) {
  return Boolean(
    draft.baseSavedSignature &&
      draft.draftSignature &&
      currentSavedSignature &&
      draft.baseSavedSignature ===
        currentSavedSignature &&
      draft.draftSignature !==
        currentSavedSignature
  )
}

function requestToPromise<T>(
  request:
    IDBRequest<T>
): Promise<T> {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      request.onsuccess =
        () => {
          resolve(
            request.result
          )
        }

      request.onerror =
        () => {
          reject(
            request.error ??
              new Error(
                'Não foi possível aceder ao rascunho local.'
              )
          )
        }
    }
  )
}

function transactionToPromise(
  transaction:
    IDBTransaction
): Promise<void> {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      transaction.oncomplete =
        () => {
          resolve()
        }

      transaction.onabort =
        () => {
          reject(
            transaction.error ??
              new Error(
                'O armazenamento do rascunho foi cancelado.'
              )
          )
        }

      transaction.onerror =
        () => {
          reject(
            transaction.error ??
              new Error(
                'Não foi possível concluir o armazenamento do rascunho.'
              )
          )
        }
    }
  )
}

function openDailyDraftDatabase():
  Promise<IDBDatabase> {
  if (
    typeof indexedDB ===
    'undefined'
  ) {
    return Promise.reject(
      new Error(
        'O armazenamento local de rascunhos não está disponível neste browser.'
      )
    )
  }

  return new Promise(
    (
      resolve,
      reject
    ) => {
      const request =
        indexedDB.open(
          DAILY_DRAFT_DATABASE_NAME,
          DAILY_DRAFT_DATABASE_VERSION
        )

      request.onupgradeneeded =
        () => {
          const database =
            request.result

          if (
            !database
              .objectStoreNames
              .contains(
                DAILY_DRAFT_STORE_NAME
              )
          ) {
            const store =
              database
                .createObjectStore(
                  DAILY_DRAFT_STORE_NAME,
                  {
                    keyPath:
                      'id'
                  }
                )

            store.createIndex(
              'accountEmail',
              'accountEmail',
              {
                unique:
                  false
              }
            )
          }
        }

      request.onsuccess =
        () => {
          const database =
            request.result

          database.onversionchange =
            () => {
              database.close()
            }

          resolve(
            database
          )
        }

      request.onerror =
        () => {
          reject(
            request.error ??
              new Error(
                'Não foi possível abrir o armazenamento local de rascunhos.'
              )
          )
        }

      request.onblocked =
        () => {
          reject(
            new Error(
              'Feche outras janelas do MA-Professor e tente novamente.'
            )
          )
        }
    }
  )
}

function isString(
  value: unknown
): value is string {
  return typeof value ===
    'string'
}

function isStringArray(
  value: unknown
): value is string[] {
  return Array.isArray(
    value
  ) &&
    value.every(
      isString
    )
}

function isDraftLesson(
  value: unknown
): value is MAProfessorDailyDraftLesson {
  if (
    !value ||
    typeof value !==
      'object'
  ) {
    return false
  }

  const lesson =
    value as Record<
      string,
      unknown
    >

  return (
    (
      lesson.status ===
        'planned' ||
      lesson.status ===
        'taught' ||
      lesson.status ===
        'cancelled'
    ) &&
    isString(
      lesson.startTime
    ) &&
    isString(
      lesson.endTime
    ) &&
    isString(
      lesson.periodCount
    ) &&
    typeof lesson.countTowardProgress ===
      'boolean' &&
    isString(
      lesson.plannedActivity
    ) &&
    isString(
      lesson.summary
    ) &&
    (
      lesson.summarySource ===
        'manual' ||
      lesson.summarySource ===
        'planification' ||
      lesson.summarySource ===
        'ai'
    ) &&
    isStringArray(
      lesson.planificationItemIds
    ) &&
    isString(
      lesson.notes
    ) &&
    (
      lesson.giaeStatus ===
        'pending' ||
      lesson.giaeStatus ===
        'submitted'
    )
  )
}

function isDraftAssessment(
  value: unknown
): value is MAProfessorDailyDraftAssessment {
  if (
    !value ||
    typeof value !==
      'object'
  ) {
    return false
  }

  const assessment =
    value as Record<
      string,
      unknown
    >

  return (
    isString(
      assessment.choice
    ) &&
    isString(
      assessment.criterionId
    ) &&
    isString(
      assessment.title
    ) &&
    (
      assessment.activityType ===
        'participation' ||
      assessment.activityType ===
        'practical_work' ||
      assessment.activityType ===
        'presentation' ||
      assessment.activityType ===
        'written_work' ||
      assessment.activityType ===
        'test' ||
      assessment.activityType ===
        'other'
    ) &&
    isString(
      assessment.description
    )
  )
}

function isDraftStudent(
  value: unknown
): value is MAProfessorDailyDraftStudent {
  if (
    !value ||
    typeof value !==
      'object'
  ) {
    return false
  }

  const student =
    value as Record<
      string,
      unknown
    >

  return (
    isString(
      student.studentId
    ) &&
    (
      student.attendanceStatus ===
        'present' ||
      student.attendanceStatus ===
        'absent'
    ) &&
    isString(
      student.attendanceCode
    ) &&
    isString(
      student.attendanceNote
    ) &&
    (
      student.assessmentStatus ===
        'not_evaluated' ||
      student.assessmentStatus ===
        'evaluated' ||
      student.assessmentStatus ===
        'absent' ||
      student.assessmentStatus ===
        'exempt'
    ) &&
    isString(
      student.assessmentScoreText
    ) &&
    isString(
      student.assessmentNote
    )
  )
}

function parseStoredDraft(
  value: unknown,
  expectedId: string
): MAProfessorDailyDraft | null {
  if (
    !value ||
    typeof value !==
      'object'
  ) {
    return null
  }

  const draft =
    value as Record<
      string,
      unknown
    >

  if (
    draft.id !==
      expectedId ||
    draft.schemaVersion !==
      DAILY_DRAFT_SCHEMA_VERSION ||
    !isString(
      draft.accountEmail
    ) ||
    !isString(
      draft.academicYearId
    ) ||
    !isString(
      draft.lessonId
    ) ||
    !isString(
      draft.date
    ) ||
    !isString(
      draft.baseSavedSignature
    ) ||
    !isString(
      draft.draftSignature
    ) ||
    !(
      draft.assessmentIdToDelete ===
        null ||
      isString(
        draft.assessmentIdToDelete
      )
    ) ||
    !isDraftLesson(
      draft.lesson
    ) ||
    !isDraftAssessment(
      draft.assessment
    ) ||
    !Array.isArray(
      draft.students
    ) ||
    !draft.students.every(
      isDraftStudent
    ) ||
    !isString(
      draft.updatedAt
    )
  ) {
    return null
  }

  return value as
    MAProfessorDailyDraft
}

export async function readMAProfessorDailyDraft(
  accountEmail: string,
  academicYearId: string,
  lessonId: string
): Promise<MAProfessorDailyDraft | null> {
  const id =
    createMAProfessorDailyDraftId(
      accountEmail,
      academicYearId,
      lessonId
    )

  const database =
    await openDailyDraftDatabase()

  try {
    const transaction =
      database.transaction(
        DAILY_DRAFT_STORE_NAME,
        'readonly'
      )

    const value =
      await requestToPromise(
        transaction
          .objectStore(
            DAILY_DRAFT_STORE_NAME
          )
          .get(
            id
          )
      )

    return parseStoredDraft(
      value,
      id
    )
  } finally {
    database.close()
  }
}

export async function saveMAProfessorDailyDraft(
  input:
    MAProfessorDailyDraftInput
): Promise<MAProfessorDailyDraft> {
  const accountEmail =
    normalizeEmail(
      input.accountEmail
    )

  const academicYearId =
    normalizeRequiredId(
      input.academicYearId,
      'O ano letivo'
    )

  const lessonId =
    normalizeRequiredId(
      input.lessonId,
      'A aula'
    )

  const draft:
    MAProfessorDailyDraft = {
    ...input,
    id:
      createMAProfessorDailyDraftId(
        accountEmail,
        academicYearId,
        lessonId
      ),
    schemaVersion:
      DAILY_DRAFT_SCHEMA_VERSION,
    accountEmail,
    academicYearId,
    lessonId,
    updatedAt:
      new Date()
        .toISOString()
  }

  const database =
    await openDailyDraftDatabase()

  try {
    const transaction =
      database.transaction(
        DAILY_DRAFT_STORE_NAME,
        'readwrite'
      )

    const completed =
      transactionToPromise(
        transaction
      )

    await requestToPromise(
      transaction
        .objectStore(
          DAILY_DRAFT_STORE_NAME
        )
        .put(
          draft
        )
    )

    await completed

    return draft
  } finally {
    database.close()
  }
}

export async function deleteMAProfessorDailyDraft(
  accountEmail: string,
  academicYearId: string,
  lessonId: string
): Promise<void> {
  const id =
    createMAProfessorDailyDraftId(
      accountEmail,
      academicYearId,
      lessonId
    )

  const database =
    await openDailyDraftDatabase()

  try {
    const transaction =
      database.transaction(
        DAILY_DRAFT_STORE_NAME,
        'readwrite'
      )

    const completed =
      transactionToPromise(
        transaction
      )

    await requestToPromise(
      transaction
        .objectStore(
          DAILY_DRAFT_STORE_NAME
        )
        .delete(
          id
        )
    )

    await completed
  } finally {
    database.close()
  }
}
