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

      {activeDate === todayISO() ? (
        <div className="px-3 pt-1 sm:px-5 lg:px-7">
          <p className="mx-auto max-w-[1600px] rounded-xl border border-amber-200/10 bg-amber-200/[0.035] px-3 py-2 text-[0.68rem] font-semibold text-slate-400">
            Para maior segurança, faça regularmente uma cópia de segurança — sobretudo em navegação privada ou se surgir algum erro.
          </p>
        </div>
      ) : null}

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
