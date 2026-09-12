import {
  useEffect,
  useState
} from 'react'

import type {
  EntityId,
  ISODate
} from '../types'

import DailyUnifiedWeekOverview from './DailyUnifiedWeekOverview'
import DailyWorkspaceView from './DailyWorkspaceView'

import './dailyUnifiedWeek.css'

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

function todayISO(): ISODate {
  const date = new Date()

  return [
    String(
      date.getFullYear()
    ).padStart(4, '0'),
    String(
      date.getMonth() + 1
    ).padStart(2, '0'),
    String(
      date.getDate()
    ).padStart(2, '0')
  ].join('-')
}

export default function DailyWorkspaceWithDuties({
  academicYearId,
  initialDate,
  initialLessonId,
  onSaved,
  onNavigationGuardChange
}: DailyWorkspaceWithDutiesProps) {
  const [
    activeDate,
    setActiveDate
  ] = useState<ISODate>(
    initialDate ?? todayISO()
  )
  const [
    activeLessonId,
    setActiveLessonId
  ] = useState<EntityId | null>(
    initialLessonId ?? null
  )
  const [
    refreshToken,
    setRefreshToken
  ] = useState(0)

  useEffect(() => {
    if (!initialDate) {
      return
    }

    setActiveDate(
      initialDate
    )
  }, [initialDate])

  useEffect(() => {
    setActiveLessonId(
      initialLessonId ?? null
    )
  }, [initialLessonId])

  const handleSaved =
    async () => {
      setRefreshToken(
        current => current + 1
      )

      await onSaved?.()
    }

  return (
    <div className="ma-professor-unified-daily bg-slate-950">
      <DailyUnifiedWeekOverview
        academicYearId={
          academicYearId
        }
        date={
          activeDate
        }
        selectedLessonId={
          activeLessonId
        }
        refreshToken={
          refreshToken
        }
        onSelectDate={
          nextDate => {
            setActiveDate(
              nextDate
            )
            setActiveLessonId(
              null
            )
          }
        }
        onSelectLesson={(
          nextDate,
          lessonId
        ) => {
          setActiveDate(
            nextDate
          )
          setActiveLessonId(
            lessonId
          )
        }}
        onSaved={
          handleSaved
        }
      />

      <DailyWorkspaceView
        key={`${activeDate}-${
          activeLessonId ?? 'auto'
        }`}
        academicYearId={
          academicYearId
        }
        initialDate={
          activeDate
        }
        initialLessonId={
          activeLessonId ?? undefined
        }
        onSaved={
          handleSaved
        }
        onNavigationGuardChange={
          onNavigationGuardChange
        }
      />
    </div>
  )
}
