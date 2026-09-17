import {
  isDutyEvent
} from '../calendar/dutyEvent'
import {
  markDashboardDataDirty
} from '../dashboard/dashboardRefreshSignal'
import {
  maProfessorDb,
  openMAProfessorDatabase
} from '../db'
import type {
  EntityId
} from '../types'

function now() {
  return new Date().toISOString()
}

export async function resetScheduleImportForSetup(
  academicYearId: EntityId
) {
  await openMAProfessorDatabase()

  const result =
    await maProfessorDb.transaction(
      'rw',
      [
        maProfessorDb.academicYears,
        maProfessorDb.setupProgress,
        maProfessorDb.weeklyScheduleSlots,
        maProfessorDb.schoolCalendarEvents,
        maProfessorDb.lessons,
        maProfessorDb.summarySuggestions,
        maProfessorDb.lessonAttendance,
        maProfessorDb.lessonAssessments,
        maProfessorDb.assessmentResults,
        maProfessorDb.moduleFinalGrades,
        maProfessorDb.learningRecoveries,
        maProfessorDb.students,
        maProfessorDb.assessmentSchemes,
        maProfessorDb.assessmentCriteria,
        maProfessorDb.planifications,
        maProfessorDb.planificationItems
      ],
      async () => {
        const [
          academicYear,
          progress,
          slots,
          events,
          lessons,
          students,
          schemes,
          planifications,
          lessonAssessments,
          moduleFinalGrades,
          learningRecoveries
        ] = await Promise.all([
          maProfessorDb.academicYears.get(
            academicYearId
          ),
          maProfessorDb.setupProgress
            .where('academicYearId')
            .equals(academicYearId)
            .first(),
          maProfessorDb.weeklyScheduleSlots
            .where('academicYearId')
            .equals(academicYearId)
            .toArray(),
          maProfessorDb.schoolCalendarEvents
            .where('academicYearId')
            .equals(academicYearId)
            .toArray(),
          maProfessorDb.lessons
            .where('academicYearId')
            .equals(academicYearId)
            .toArray(),
          maProfessorDb.students
            .where('academicYearId')
            .equals(academicYearId)
            .toArray(),
          maProfessorDb.assessmentSchemes
            .where('academicYearId')
            .equals(academicYearId)
            .toArray(),
          maProfessorDb.planifications
            .where('academicYearId')
            .equals(academicYearId)
            .toArray(),
          maProfessorDb.lessonAssessments
            .where('academicYearId')
            .equals(academicYearId)
            .toArray(),
          maProfessorDb.moduleFinalGrades
            .where('academicYearId')
            .equals(academicYearId)
            .toArray(),
          maProfessorDb.learningRecoveries
            .where('academicYearId')
            .equals(academicYearId)
            .toArray()
        ])

        if (!academicYear || !progress) {
          throw new Error(
            'Não foi possível encontrar a configuração deste ano letivo.'
          )
        }

        const timestamp = now()
        const slotIds =
          slots.map(slot => slot.id)
        const lessonIds =
          lessons.map(lesson => lesson.id)
        const studentIds =
          students.map(student => student.id)
        const schemeIds =
          schemes.map(scheme => scheme.id)
        const planificationIds =
          planifications.map(planification =>
            planification.id
          )
        const assessmentIds =
          lessonAssessments.map(
            assessment => assessment.id
          )

        const [
          criteria,
          planificationItems,
          summarySuggestions,
          lessonAttendance,
          assessmentResults
        ] = await Promise.all([
          schemeIds.length > 0
            ? maProfessorDb.assessmentCriteria
                .where('schemeId')
                .anyOf(schemeIds)
                .toArray()
            : [],
          planificationIds.length > 0
            ? maProfessorDb.planificationItems
                .where('planificationId')
                .anyOf(planificationIds)
                .toArray()
            : [],
          lessonIds.length > 0
            ? maProfessorDb.summarySuggestions
                .where('lessonId')
                .anyOf(lessonIds)
                .toArray()
            : [],
          lessonIds.length > 0
            ? maProfessorDb.lessonAttendance
                .where('lessonId')
                .anyOf(lessonIds)
                .toArray()
            : [],
          assessmentIds.length > 0
            ? maProfessorDb.assessmentResults
                .where('assessmentId')
                .anyOf(assessmentIds)
                .toArray()
            : []
        ])

        const dutyEvents =
          events.filter(event =>
            isDutyEvent(event)
          )
        const dutyEventIds =
          dutyEvents.map(event => event.id)

        if (assessmentResults.length > 0) {
          await maProfessorDb.assessmentResults.bulkDelete(
            assessmentResults.map(result => result.id)
          )
        }

        if (lessonAssessments.length > 0) {
          await maProfessorDb.lessonAssessments.bulkDelete(
            assessmentIds
          )
        }

        if (lessonAttendance.length > 0) {
          await maProfessorDb.lessonAttendance.bulkDelete(
            lessonAttendance.map(record => record.id)
          )
        }

        if (summarySuggestions.length > 0) {
          await maProfessorDb.summarySuggestions.bulkDelete(
            summarySuggestions.map(suggestion => suggestion.id)
          )
        }

        if (moduleFinalGrades.length > 0) {
          await maProfessorDb.moduleFinalGrades.bulkDelete(
            moduleFinalGrades.map(grade => grade.id)
          )
        }

        if (learningRecoveries.length > 0) {
          await maProfessorDb.learningRecoveries.bulkDelete(
            learningRecoveries.map(recovery => recovery.id)
          )
        }

        if (planificationItems.length > 0) {
          await maProfessorDb.planificationItems.bulkDelete(
            planificationItems.map(item => item.id)
          )
        }

        if (planifications.length > 0) {
          await maProfessorDb.planifications.bulkDelete(
            planificationIds
          )
        }

        if (criteria.length > 0) {
          await maProfessorDb.assessmentCriteria.bulkDelete(
            criteria.map(criterion => criterion.id)
          )
        }

        if (schemes.length > 0) {
          await maProfessorDb.assessmentSchemes.bulkDelete(
            schemeIds
          )
        }

        if (lessonIds.length > 0) {
          await maProfessorDb.lessons.bulkDelete(
            lessonIds
          )
        }

        if (studentIds.length > 0) {
          await maProfessorDb.students.bulkDelete(
            studentIds
          )
        }

        if (slotIds.length > 0) {
          await maProfessorDb.weeklyScheduleSlots.bulkDelete(
            slotIds
          )
        }

        if (dutyEventIds.length > 0) {
          await maProfessorDb.schoolCalendarEvents.bulkDelete(
            dutyEventIds
          )
        }

        await maProfessorDb.academicYears.put({
          ...academicYear,
          setupCompletedAt: null,
          updatedAt: timestamp
        })

        await maProfessorDb.setupProgress.put({
          ...progress,
          currentStep: 'weekly_schedule',
          completedSteps:
            progress.completedSteps.filter(
              step =>
                step !== 'weekly_schedule' &&
                step !== 'planifications' &&
                step !== 'assessment_criteria' &&
                step !== 'students' &&
                step !== 'confirmation'
            ),
          completedAt: null,
          updatedAt: timestamp
        })

        return {
          removedScheduleSlots:
            slotIds.length,
          removedDutyEvents:
            dutyEventIds.length,
          removedLessons:
            lessons.length,
          removedSummarySuggestions:
            summarySuggestions.length,
          removedLessonAttendance:
            lessonAttendance.length,
          removedLessonAssessments:
            lessonAssessments.length,
          removedAssessmentResults:
            assessmentResults.length,
          removedModuleFinalGrades:
            moduleFinalGrades.length,
          removedLearningRecoveries:
            learningRecoveries.length,
          removedStudents:
            students.length,
          removedAssessmentSchemes:
            schemes.length,
          removedAssessmentCriteria:
            criteria.length,
          removedPlanifications:
            planifications.length,
          removedPlanificationItems:
            planificationItems.length
        }
      }
    )

  if (
    Object.values(result).some(
      value => value > 0
    )
  ) {
    markDashboardDataDirty()
  }

  return result
}
