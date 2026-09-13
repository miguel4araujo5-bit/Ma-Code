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
          students,
          schemes,
          planifications
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
            .toArray()
        ])

        if (!academicYear || !progress) {
          throw new Error(
            'Não foi possível encontrar a configuração deste ano letivo.'
          )
        }

        if (
          academicYear.setupCompletedAt ||
          progress.completedAt
        ) {
          throw new Error(
            'A configuração deste ano letivo já foi concluída. Para preservar o histórico, edite os blocos do horário em vez de apagar toda a importação.'
          )
        }

        const slotIds =
          slots.map(slot => slot.id)

        const linkedLessonCount =
          slotIds.length > 0
            ? await maProfessorDb.lessons
                .where('scheduleSlotId')
                .anyOf(slotIds)
                .count()
            : 0

        if (linkedLessonCount > 0) {
          throw new Error(
            'Este horário já tem aulas associadas. Para não perder histórico, edite os blocos individualmente em vez de apagar a importação.'
          )
        }

        const dutyEvents =
          events.filter(event =>
            isDutyEvent(event)
          )

        const dutyWithRecordedWork =
          dutyEvents.find(event =>
            Boolean(
              (event.description ?? '')
                .trim()
            )
          )

        if (dutyWithRecordedWork) {
          throw new Error(
            'Existem cargos deste horário com informação já registada. Para preservar esse trabalho, corrija o horário sem apagar a importação.'
          )
        }

        const schemeIds =
          schemes.map(scheme => scheme.id)
        const planificationIds =
          planifications.map(planification =>
            planification.id
          )

        const criteria =
          schemeIds.length > 0
            ? await maProfessorDb.assessmentCriteria
                .where('schemeId')
                .anyOf(schemeIds)
                .toArray()
            : []

        const planificationItems =
          planificationIds.length > 0
            ? await maProfessorDb.planificationItems
                .where('planificationId')
                .anyOf(planificationIds)
                .toArray()
            : []

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

        if (students.length > 0) {
          await maProfessorDb.students.bulkDelete(
            students.map(student => student.id)
          )
        }

        if (slotIds.length > 0) {
          await maProfessorDb.weeklyScheduleSlots.bulkDelete(
            slotIds
          )
        }

        const dutyEventIds =
          dutyEvents.map(event => event.id)

        if (dutyEventIds.length > 0) {
          await maProfessorDb.schoolCalendarEvents.bulkDelete(
            dutyEventIds
          )
        }

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
          updatedAt: now()
        })

        return {
          removedScheduleSlots:
            slotIds.length,
          removedDutyEvents:
            dutyEventIds.length,
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
