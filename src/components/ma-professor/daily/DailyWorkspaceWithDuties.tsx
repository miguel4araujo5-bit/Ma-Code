import type {
  EntityId,
  ISODate
} from '../types'

import DailyDutyWeekPanel from './DailyDutyWeekPanel'
import DailyWorkspaceView from './DailyWorkspaceView'

interface DailyWorkspaceWithDutiesProps {
  academicYearId: EntityId
  initialDate?: ISODate
  initialLessonId?: EntityId
  onSaved?: () =>
    | void
    | Promise<void>
  onNavigationGuardChange?: (
    guard:
      | (() => Promise<boolean>)
      | null
  ) => void
}

export default function DailyWorkspaceWithDuties({
  academicYearId,
  initialDate,
  initialLessonId,
  onSaved,
  onNavigationGuardChange
}: DailyWorkspaceWithDutiesProps) {
  return (
    <>
      <DailyDutyWeekPanel
        academicYearId={
          academicYearId
        }
        initialDate={
          initialDate
        }
        onSaved={
          onSaved
        }
      />

      <DailyWorkspaceView
        academicYearId={
          academicYearId
        }
        initialDate={
          initialDate
        }
        initialLessonId={
          initialLessonId
        }
        onSaved={
          onSaved
        }
        onNavigationGuardChange={
          onNavigationGuardChange
        }
      />
    </>
  )
}
