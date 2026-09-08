import {
  maProfessorDb,
  openMAProfessorDatabase
} from './db'

import {
  assessmentRepository,
  type AssessmentResultDraft,
  type LessonAssessmentDraft
} from './assessments/assessmentRepository'

import type {
  LessonAssessment
} from './types'

export type SavedAssessmentRegister =
  Awaited<
    ReturnType<
      typeof assessmentRepository.saveAssessmentResults
    >
  >

export interface CreatedLessonAssessmentWithResults {
  assessment: LessonAssessment
  register: SavedAssessmentRegister
}

type AssessmentAtomicDb = Pick<
  typeof maProfessorDb,
  'tables' | 'transaction'
>

type AssessmentAtomicRepository = Pick<
  typeof assessmentRepository,
  'createLessonAssessment' | 'saveAssessmentResults'
>

export class AssessmentAtomicPersistenceRepository {
  constructor(
    private readonly db: AssessmentAtomicDb =
      maProfessorDb,
    private readonly repository: AssessmentAtomicRepository =
      assessmentRepository,
    private readonly initializeDatabase =
      openMAProfessorDatabase
  ) {}

  async createLessonAssessmentWithResults(
    assessmentDraft: LessonAssessmentDraft,
    entries: AssessmentResultDraft[]
  ): Promise<CreatedLessonAssessmentWithResults> {
    await this.initializeDatabase()

    return this.db.transaction(
      'rw',
      this.db.tables,
      async () => {
        const assessment =
          await this.repository.createLessonAssessment(
            assessmentDraft
          )

        const register =
          await this.repository.saveAssessmentResults(
            assessment.id,
            entries
          )

        return {
          assessment,
          register
        }
      }
    )
  }
}

export const assessmentAtomicPersistenceRepository =
  new AssessmentAtomicPersistenceRepository()
