import { maProfessorDb, openMAProfessorDatabase } from '../db'
import { completionDateFromLessons } from '../assessments/ufcdCompletionDate'
import { studentAssessmentProfile } from '../assessments/assessmentProfiles'
import type { Student } from '../types'

// The optional fields need no schema/index migration. Existing students remain general.
// The change and the reset of this student's grades in unfinished units commit
// together. Finished units, lesson summaries, attendance and other students are preserved.
export async function persistStudentsWithAssessmentProfiles(
  records: Student[], requestedProfiles: (boolean | undefined)[]
): Promise<Student[]> {
  await openMAProfessorDatabase()
  return maProfessorDb.transaction('rw', [maProfessorDb.students, maProfessorDb.modules,
    maProfessorDb.lessons, maProfessorDb.teachingAssignments, maProfessorDb.moduleFinalGrades,
    maProfessorDb.lessonAssessments, maProfessorDb.assessmentResults], async () => {
    const saved: Student[] = []
    for (let index = 0; index < records.length; index++) {
      const record = records[index]
      const current = await maProfessorDb.students.get(record.id)
      const requested = requestedProfiles[index]
      let next: Student = { ...record }
      // Re-importing a roster without an explicit ACS choice preserves the existing choice.
      if (current) {
        next.usesAcs = current.usesAcs
        next.acsEnabledAt = current.acsEnabledAt
        next.assessmentProfilesByModule = current.assessmentProfilesByModule
      }
      if (requested !== undefined && requested !== (current?.usesAcs === true)) {
        const assignments = await maProfessorDb.teachingAssignments.where('groupId').equals(record.groupId).toArray()
        const assignmentIds = new Set(assignments.map(assignment => assignment.id))
        const modules = (await maProfessorDb.modules.where('academicYearId').equals(record.academicYearId).toArray())
          .filter(module => assignmentIds.has(module.teachingAssignmentId))
        const lessons = await maProfessorDb.lessons.where('academicYearId').equals(record.academicYearId).toArray()
        const preserved = { ...current?.assessmentProfilesByModule }
        for (const module of modules) {
          if (!module.active || completionDateFromLessons(module.plannedPeriods, lessons.filter(lesson => lesson.moduleId === module.id))) {
            preserved[module.id] = current ? studentAssessmentProfile(current, module.id) : 'general'
          }
        }
        const grades = await maProfessorDb.moduleFinalGrades.where('studentId').equals(record.id).toArray()
        const unfinishedIds = new Set(modules.filter(module => !preserved[module.id]).map(module => module.id))
        if (requested) {
          const assessments = (await maProfessorDb.lessonAssessments.where('academicYearId').equals(record.academicYearId).toArray())
            .filter(assessment => unfinishedIds.has(assessment.moduleId))
          const assessmentIds = new Set(assessments.map(assessment => assessment.id))
          const previousResults = (await maProfessorDb.assessmentResults.where('studentId').equals(record.id).toArray())
            .filter(result => assessmentIds.has(result.assessmentId))
          if (previousResults.length) await maProfessorDb.assessmentResults.bulkDelete(previousResults.map(result => result.id))
        }
        const changingGrades = grades.filter(grade => unfinishedIds.has(grade.moduleId))
        if (changingGrades.length) await maProfessorDb.moduleFinalGrades.bulkDelete(changingGrades.map(grade => grade.id))
        next = { ...next, usesAcs: requested, assessmentProfilesByModule: preserved,
          acsEnabledAt: requested ? new Date().toISOString() : current?.acsEnabledAt }
      } else if (!current && requested !== undefined) {
        next.usesAcs = requested
      }
      await maProfessorDb.students.put(next)
      saved.push(next)
    }
    return saved
  })
}
