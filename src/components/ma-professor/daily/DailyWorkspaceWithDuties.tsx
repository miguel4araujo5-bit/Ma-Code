import {
  useCallback,
  useEffect,
  useState
} from 'react'

import DashboardDutyPendingPanel from '../dashboard/DashboardDutyPendingPanel'
import DashboardViewBase from '../dashboard/DashboardViewBase'
import {
  dashboardRepository,
  type DashboardSnapshot
} from '../dashboard/dashboardRepository'

import type {
  EntityId,
  ISODate
} from '../types'

import DailyUfcdProgressNotice from './DailyUfcdProgressNotice'
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

function getErrorMessage(
  error: unknown
) {
  return error instanceof Error &&
    error.message.trim()
    ? error.message
    : 'Não foi possível atualizar o painel do ano letivo.'
}

function runtimeDate() {
  if (
    typeof window !==
    'undefined'
  ) {
    const override =
      new URLSearchParams(
        window.location.search
      ).get(
        'maProfessorNow'
      )

    if (
      override &&
      /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}$/.test(
        override
      )
    ) {
      const simulated =
        new Date(
          override
        )

      if (
        !Number.isNaN(
          simulated.getTime()
        )
      ) {
        return simulated
      }
    }
  }

  return new Date()
}

function todayISO(): ISODate {
  const date = runtimeDate()

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
  const [
    dashboardSnapshot,
    setDashboardSnapshot
  ] = useState<DashboardSnapshot | null>(
    null
  )
  const [
    dashboardLoading,
    setDashboardLoading
  ] = useState(false)
  const [
    dashboardError,
    setDashboardError
  ] = useState('')
  const [
    dashboardRefreshToken,
    setDashboardRefreshToken
  ] = useState(0)

  const loadDashboard =
    useCallback(
      async () => {
        setDashboardLoading(true)
        setDashboardError('')

        try {
          const nextSnapshot =
            await dashboardRepository.getDashboard(
              academicYearId
            )

          setDashboardSnapshot(
            nextSnapshot
          )
        } catch (error) {
          setDashboardError(
            getErrorMessage(
              error
            )
          )
        } finally {
          setDashboardLoading(false)
        }
      },
      [
        academicYearId
      ]
    )

  useEffect(() => {
    void loadDashboard()
  }, [
    loadDashboard
  ])

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
      setDashboardRefreshToken(
        current => current + 1
      )

      await loadDashboard()
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

      <DailyUfcdProgressNotice
        academicYearId={
          academicYearId
        }
        date={
          activeDate
        }
        lessonId={
          activeLessonId
        }
        refreshToken={
          refreshToken
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

      <div className="border-t border-white/10 pt-2">
        {dashboardError ? (
          <div className="px-3 pt-4 sm:px-5 lg:px-7">
            <div className="mx-auto flex max-w-[110rem] flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3 text-sm text-amber-50">
              <p className="leading-6">
                {dashboardError}
              </p>

              <button
                type="button"
                onClick={() =>
                  void loadDashboard()
                }
                disabled={dashboardLoading}
                className="rounded-xl border border-amber-200/20 bg-amber-200/10 px-3 py-2 text-xs font-black text-amber-50 disabled:opacity-50"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        ) : null}

        {dashboardSnapshot ? (
          <>
            <DashboardDutyPendingPanel
              academicYearId={
                dashboardSnapshot.academicYear.id
              }
              academicYearStartDate={
                dashboardSnapshot.academicYear.startDate
              }
              referenceDate={
                dashboardSnapshot.referenceDate
              }
              refreshToken={
                dashboardRefreshToken
              }
            />

            <div className="px-3 pb-8 pt-4 sm:px-5 lg:px-7">
              <DashboardViewBase
                snapshot={
                  dashboardSnapshot
                }
                refreshing={
                  dashboardLoading
                }
                onRefresh={
                  loadDashboard
                }
                showDailyWorkspace={
                  false
                }
              />
            </div>
          </>
        ) : dashboardLoading ? (
          <div className="px-3 py-6 sm:px-5 lg:px-7">
            <div className="mx-auto max-w-[110rem] rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-5 text-center text-sm font-semibold text-slate-500">
              A atualizar o painel do ano letivo…
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
