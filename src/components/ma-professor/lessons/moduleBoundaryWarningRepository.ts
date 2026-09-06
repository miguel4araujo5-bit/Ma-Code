import {
  maProfessorDb,
  openMAProfessorDatabase
} from '../db'
import type {
  EntityId
} from '../types'
import {
  detectModuleBoundaryWarnings,
  type ModuleBoundaryWarning
} from './moduleBoundaryWarnings'

export class ModuleBoundaryWarningRepository {
  async listWarnings(
    academicYearId: EntityId
  ): Promise<ModuleBoundaryWarning[]> {
    await openMAProfessorDatabase()

    const [
      modules,
      lessons
    ] = await Promise.all([
      maProfessorDb.modules
        .where('academicYearId')
        .equals(academicYearId)
        .toArray(),
      maProfessorDb.lessons
        .where('academicYearId')
        .equals(academicYearId)
        .toArray()
    ])

    return detectModuleBoundaryWarnings({
      modules,
      lessons
    })
  }
}

export const moduleBoundaryWarningRepository =
  new ModuleBoundaryWarningRepository()
