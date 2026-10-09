import { maProfessorDb, openMAProfessorDatabase } from '../db'
import { buildUfcdModuleProgress, selectCurrentUfcd } from '../lessons/ufcdProgress'
import { studentAssessmentProfile, studentAssignmentAssessmentProfile } from '../assessments/assessmentProfiles'
import type { LearningRecoveryAssessmentRecord } from '../attendance/recoveryAssessmentRepository'
import type { AssessmentProfile, EntityId, Student } from '../types'

export interface StudentAssessmentProfileUpdate {
  assessmentProfilesByAssignment?: Record<EntityId, AssessmentProfile>
  assessmentProfileChangeConfirmation?: string
}

const profileTables = () => [maProfessorDb.students, maProfessorDb.modules,
  maProfessorDb.lessons, maProfessorDb.teachingAssignments, maProfessorDb.moduleFinalGrades,
  maProfessorDb.lessonAssessments, maProfessorDb.assessmentResults, maProfessorDb.learningRecoveries]

async function readProfileChange(current: Student, requested: Record<EntityId, AssessmentProfile>) {
  const changes = Object.entries(requested).filter(([id, profile]) =>
    profile !== studentAssignmentAssessmentProfile(current, id)).sort(([a], [b]) => a.localeCompare(b))
  const assignments = await maProfessorDb.teachingAssignments.where('groupId').equals(current.groupId).toArray()
  for (const [id, profile] of changes) {
    if ((profile !== 'acs' && profile !== 'general') || !assignments.some(assignment =>
      assignment.id === id && assignment.academicYearId === current.academicYearId && assignment.active)) {
      throw new Error('A disciplina escolhida para os critérios ACS não pertence à turma e ao ano letivo deste aluno.')
    }
  }
  const assignmentIds = new Set(changes.map(([id]) => id))
  const modules = (await maProfessorDb.modules.where('academicYearId').equals(current.academicYearId).toArray())
    .filter(module => assignmentIds.has(module.teachingAssignmentId))
  const moduleIds = new Set(modules.map(module => module.id))
  const lessons = (await maProfessorDb.lessons.where('academicYearId').equals(current.academicYearId).toArray())
    .filter(lesson => moduleIds.has(lesson.moduleId))
  const assessments = (await maProfessorDb.lessonAssessments.where('academicYearId').equals(current.academicYearId).toArray())
    .filter(assessment => moduleIds.has(assessment.moduleId))
  const assessmentModules = new Map(assessments.map(assessment => [assessment.id, assessment.moduleId]))
  const results = (await maProfessorDb.assessmentResults.where('studentId').equals(current.id).toArray())
    .filter(result => assessmentModules.has(result.assessmentId))
  const grades = (await maProfessorDb.moduleFinalGrades.where('studentId').equals(current.id).toArray())
    .filter(grade => moduleIds.has(grade.moduleId))
  const recoveries = (await maProfessorDb.learningRecoveries.where('studentId').equals(current.id).toArray())
    .filter(recovery => moduleIds.has(recovery.moduleId)) as LearningRecoveryAssessmentRecord[]
  const progress = buildUfcdModuleProgress(modules, lessons)
  const units = changes.map(([id, profile]) => ({
    teachingAssignmentId: id, profile,
    label: assignments.find(assignment => assignment.id === id)!.displayName,
    currentModule: selectCurrentUfcd(modules.filter(module => module.active && module.teachingAssignmentId === id), progress)
  }))
  // Recheck the exact local state in the write transaction, so another window
  // cannot expand the deletion the professor just approved.
  const ordered = <T extends { id: string }>(rows: T[]) => [...rows].sort((a, b) => a.id.localeCompare(b.id))
  const confirmation = JSON.stringify([current, changes, units.map(unit => unit.currentModule?.id ?? null),
    ordered(modules), ordered(lessons), ordered(assessments), ordered(results), ordered(grades), ordered(recoveries)])
  return { changes, units, modules, progress, results, assessmentModules, grades, recoveries, confirmation }
}

export async function previewStudentAssessmentProfileChanges(studentId: EntityId, requested: Record<EntityId, AssessmentProfile>) {
  await openMAProfessorDatabase()
  return maProfessorDb.transaction('r', profileTables(), async () => {
    const current = await maProfessorDb.students.get(studentId)
    if (!current) throw new Error('O aluno indicado já não existe.')
    const change = await readProfileChange(current, requested)
    return { confirmation: change.confirmation, units: change.units }
  })
}

// Optional fields preserve existing backups without a schema migration. Only the
// chosen subject's current unit is reset; finished units and other subjects stay intact.
export async function persistStudentsWithAssessmentProfiles(
  records: Student[], updates: StudentAssessmentProfileUpdate[]
): Promise<Student[]> {
  await openMAProfessorDatabase()
  return maProfessorDb.transaction('rw', profileTables(), async () => {
    const saved: Student[] = []
    for (let index = 0; index < records.length; index++) {
      const record = records[index]
      const current = await maProfessorDb.students.get(record.id)
      const update = updates[index] ?? {}
      let next: Student = { ...record }
      if (current) {
        // Roster imports and name edits preserve choices made in another view.
        next = { ...next, usesAcs: current.usesAcs, acsEnabledAt: current.acsEnabledAt,
          assessmentProfilesByModule: current.assessmentProfilesByModule,
          assessmentProfilesByAssignment: current.assessmentProfilesByAssignment,
          assessmentResetAtByModule: current.assessmentResetAtByModule }
      }
      if (update.assessmentProfilesByAssignment) {
        const previous = current ?? { ...record, usesAcs: false }
        const change = await readProfileChange(previous, update.assessmentProfilesByAssignment)
        if (change.changes.length && current && update.assessmentProfileChangeConfirmation !== change.confirmation) {
          throw new Error('Confirme novamente a alteração dos critérios ACS. Os dados do aluno ou da unidade em curso podem ter mudado.')
        }
        if (change.changes.length) {
          const preserved = { ...current?.assessmentProfilesByModule }
          const profiles = { ...current?.assessmentProfilesByAssignment }
          const resetAt = { ...current?.assessmentResetAtByModule }
          const currentIds = new Set(change.units.flatMap(unit => unit.currentModule ? [unit.currentModule.id] : []))
          const withExistingGrades = new Set([
            ...change.results.map(result => change.assessmentModules.get(result.assessmentId)!),
            ...change.grades.map(grade => grade.moduleId),
            ...change.recoveries.map(recovery => recovery.moduleId)
          ])
          const completedIds = new Set(change.progress.filter(row => row.periodsRemaining === 0).map(row => row.moduleId))
          for (const module of change.modules) {
            if (!module.active || completedIds.has(module.id) || (!currentIds.has(module.id) && withExistingGrades.has(module.id))) {
              preserved[module.id] = studentAssessmentProfile(previous, module.id, module.teachingAssignmentId)
            } else {
              delete preserved[module.id]
            }
          }
          const timestamp = new Date().toISOString()
          for (const unit of change.units) {
            profiles[unit.teachingAssignmentId] = unit.profile
            if (current && unit.currentModule) resetAt[unit.currentModule.id] = timestamp
          }
          const resetResults = change.results.filter(result => currentIds.has(change.assessmentModules.get(result.assessmentId)!))
          if (resetResults.length) await maProfessorDb.assessmentResults.bulkDelete(resetResults.map(result => result.id))
          const resetGrades = change.grades.filter(grade => currentIds.has(grade.moduleId))
          if (resetGrades.length) await maProfessorDb.moduleFinalGrades.bulkDelete(resetGrades.map(grade => grade.id))
          for (const recovery of change.recoveries.filter(row => currentIds.has(row.moduleId))) {
            // Preserve recovery/attendance history, including previously removed absences.
            await maProfessorDb.learningRecoveries.put({ ...recovery, assessmentScores: null,
              assessmentRecordedAt: null, recoveryGrade: null, updatedAt: timestamp } as LearningRecoveryAssessmentRecord)
          }
          next = { ...next, assessmentProfilesByAssignment: profiles, assessmentProfilesByModule: preserved,
            assessmentResetAtByModule: resetAt, updatedAt: timestamp }
        }
      }
      await maProfessorDb.students.put(next)
      saved.push(next)
    }
    return saved
  })
}
