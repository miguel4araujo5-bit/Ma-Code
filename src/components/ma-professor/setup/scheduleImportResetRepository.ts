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
      maProfessorDb.academicYears,
      maProfessorDb.setupProgress,
      maProfessorDb.weeklyScheduleSlots,
      maProfessorDb.schoolCalendarEvents,
      maProfessorDb.lessons,
      async () => {
        const [
          academicYear,
          progress,
          slots,
          events
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
                step !== 'weekly_schedule'
            ),
          updatedAt: now()
        })

        return {
          removedScheduleSlots:
            slotIds.length,
          removedDutyEvents:
            dutyEventIds.length
        }
      }
    )

  if (
    result.removedScheduleSlots > 0 ||
    result.removedDutyEvents > 0
  ) {
    markDashboardDataDirty()
  }

  return result
}
