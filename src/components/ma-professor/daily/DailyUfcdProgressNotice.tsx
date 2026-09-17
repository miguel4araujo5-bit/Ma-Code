import {
  useEffect,
  useRef,
  useState
} from 'react'
import {
  createPortal
} from 'react-dom'

import {
  maProfessorDb,
  openMAProfessorDatabase
} from '../db'
import {
  buildUfcdModuleProgress,
  compareLessonsChronologically,
  todayISO
} from '../lessons/ufcdProgress'
import {
  ufcdProgressRepository
} from '../lessons/ufcdProgressRepository'
import type {
  EntityId,
  ISODate,
  Lesson
} from '../types'

interface DailyUfcdProgressNoticeProps {
  academicYearId: EntityId
  date: ISODate
  lessonId?: EntityId | null
  refreshToken?: number
}

interface DailyUfcdProgressSnapshot {
  moduleCode: string
  moduleName: string
  periodsTaught: number
  plannedPeriods: number
  periodsRemaining: number
}

function getCurrentTime() {
  return new Intl.DateTimeFormat(
    'pt-PT',
    {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }
  ).format(new Date())
}

async function resolveLesson(
  academicYearId: EntityId,
  date: ISODate,
  requestedLessonId: EntityId | null
): Promise<Lesson | null> {
  if (requestedLessonId) {
    const requestedLesson =
      await maProfessorDb.lessons.get(
        requestedLessonId
      )

    if (
      requestedLesson &&
      requestedLesson.academicYearId ===
        academicYearId
    ) {
      return requestedLesson
    }
  }

  const lessons =
    await maProfessorDb.lessons
      .where('academicYearId')
      .equals(academicYearId)
      .toArray()

  const dayLessons =
    lessons
      .filter(
        lesson =>
          lesson.date === date &&
          lesson.status !== 'cancelled'
      )
      .sort(
        compareLessonsChronologically
      )

  if (dayLessons.length === 0) {
    return null
  }

  if (date === todayISO()) {
    const currentTime =
      getCurrentTime()

    return (
      dayLessons.find(
        lesson =>
          lesson.startTime <=
            currentTime &&
          lesson.endTime >=
            currentTime
      ) ??
      dayLessons[0]
    )
  }

  return dayLessons[0]
}

async function loadProgressSnapshot(
  academicYearId: EntityId,
  date: ISODate,
  requestedLessonId: EntityId | null
): Promise<DailyUfcdProgressSnapshot | null> {
  await openMAProfessorDatabase()

  let lesson =
    await resolveLesson(
      academicYearId,
      date,
      requestedLessonId
    )

  if (!lesson) {
    return null
  }

  await ufcdProgressRepository
    .ensureLessonUsesCurrentUfcd(
      lesson.id
    )

  lesson =
    await maProfessorDb.lessons.get(
      lesson.id
    ) ?? null

  if (!lesson) {
    return null
  }

  const [
    modules,
    lessons
  ] = await Promise.all([
    maProfessorDb.modules
      .where('teachingAssignmentId')
      .equals(
        lesson.teachingAssignmentId
      )
      .toArray(),
    maProfessorDb.lessons
      .where('teachingAssignmentId')
      .equals(
        lesson.teachingAssignmentId
      )
      .toArray()
  ])

  const module =
    modules.find(
      candidate =>
        candidate.id === lesson.moduleId
    )

  if (
    !module ||
    module.plannedPeriods <= 0
  ) {
    return null
  }

  const progress =
    buildUfcdModuleProgress(
      modules,
      lessons,
      todayISO()
    ).find(
      row =>
        row.moduleId === module.id
    )

  const periodsTaught =
    progress?.periodsTaught ?? 0

  return {
    moduleCode: module.code,
    moduleName: module.name,
    periodsTaught,
    plannedPeriods:
      module.plannedPeriods,
    periodsRemaining:
      Math.max(
        0,
        module.plannedPeriods -
          periodsTaught
      )
  }
}

function getModuleLabel(
  snapshot: DailyUfcdProgressSnapshot
) {
  return snapshot.moduleCode.trim()
    ? `${snapshot.moduleCode.trim()} · ${snapshot.moduleName}`
    : snapshot.moduleName
}

function findSummaryStatusTarget(
  root: HTMLElement
) {
  const summaryLabel =
    Array.from(
      root.querySelectorAll('p')
    ).find(
      element =>
        element.textContent?.trim() ===
        'Sumário'
    )

  const statusRow =
    summaryLabel?.nextElementSibling

  return statusRow instanceof HTMLElement
    ? statusRow
    : null
}

export default function DailyUfcdProgressNotice({
  academicYearId,
  date,
  lessonId = null,
  refreshToken = 0
}: DailyUfcdProgressNoticeProps) {
  const sentinelRef =
    useRef<HTMLSpanElement | null>(
      null
    )

  const [
    snapshot,
    setSnapshot
  ] =
    useState<DailyUfcdProgressSnapshot | null>(
      null
    )

  const [
    portalTarget,
    setPortalTarget
  ] = useState<HTMLElement | null>(
    null
  )

  useEffect(() => {
    let cancelled = false

    void loadProgressSnapshot(
      academicYearId,
      date,
      lessonId
    )
      .then(result => {
        if (!cancelled) {
          setSnapshot(result)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSnapshot(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [
    academicYearId,
    date,
    lessonId,
    refreshToken
  ])

  useEffect(() => {
    const sentinel =
      sentinelRef.current
    const root =
      sentinel?.closest(
        '.ma-professor-unified-daily'
      )

    if (!(root instanceof HTMLElement)) {
      setPortalTarget(null)
      return
    }

    const syncTarget = () => {
      const nextTarget =
        findSummaryStatusTarget(root)

      setPortalTarget(current =>
        current === nextTarget
          ? current
          : nextTarget
      )
    }

    syncTarget()

    const observer =
      new MutationObserver(
        syncTarget
      )

    observer.observe(
      root,
      {
        childList: true,
        subtree: true
      }
    )

    return () => {
      observer.disconnect()
    }
  }, [
    academicYearId,
    date,
    lessonId
  ])

  const badge =
    snapshot && portalTarget
      ? (() => {
          const completed =
            snapshot.periodsTaught >=
            snapshot.plannedPeriods

          const nearEnd =
            !completed &&
            snapshot.periodsRemaining <= 5

          const stateClasses =
            completed
              ? 'border-rose-300/35 bg-rose-300/10 text-rose-100'
              : nearEnd
                ? 'border-amber-300/30 bg-amber-300/10 text-amber-100'
                : 'border-cyan-300/20 bg-cyan-300/[0.07] text-cyan-100'

          return createPortal(
            <span
              role="status"
              aria-live="polite"
              title={getModuleLabel(
                snapshot
              )}
              className={`inline-flex max-w-full flex-wrap items-center gap-x-1.5 rounded-lg border px-2.5 py-1 text-[0.68rem] font-black ${stateClasses}`}
            >
              <span>
                {snapshot.periodsTaught} /{' '}
                {snapshot.plannedPeriods}{' '}
                tempos
              </span>

              {completed ? (
                <>
                  <span aria-hidden="true">
                    ·
                  </span>
                  <span>
                    Realizar auto e heteroavaliação
                  </span>
                </>
              ) : nearEnd ? (
                <>
                  <span aria-hidden="true">
                    ·
                  </span>
                  <span>
                    já tem elementos necessários para a avaliação?
                  </span>
                </>
              ) : null}
            </span>,
            portalTarget
          )
        })()
      : null

  return (
    <>
      <span
        ref={sentinelRef}
        aria-hidden="true"
        className="hidden"
      />
      {badge}
    </>
  )
}
