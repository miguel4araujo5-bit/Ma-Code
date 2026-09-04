import {
  liveQuery
} from 'dexie'

import {
  type ReactNode,
  useEffect
} from 'react'

import {
  maProfessorRepository
} from '../repository'

import {
  isMAProfessorOperationallyReady
} from '../setup/setupReadiness'

import {
  ensureInitialSchoolCalendar2026_2027
} from './initialSchoolCalendar2026_2027'

function protectedWorkspaceIsMounted() {
  return (
    typeof document !== 'undefined' &&
    Boolean(
      document.querySelector(
        '.ma-professor-product'
      )
    )
  )
}

export default function InitialSchoolCalendarBootstrap({
  children
}: {
  children: ReactNode
}) {
  useEffect(() => {
    let disposed = false
    let subscription: {
      unsubscribe: () => void
    } | null = null
    let observer: MutationObserver | null = null

    function start() {
      if (
        disposed ||
        subscription ||
        !protectedWorkspaceIsMounted()
      ) {
        return
      }

      subscription = liveQuery(
        async () => {
          const academicYear =
            await maProfessorRepository.getActiveAcademicYear()

          if (!academicYear) {
            return null
          }

          return maProfessorRepository.getSetupSnapshot(
            academicYear.id
          )
        }
      ).subscribe({
        next: snapshot => {
          if (
            disposed ||
            !snapshot ||
            !isMAProfessorOperationallyReady(
              snapshot
            )
          ) {
            return
          }

          void ensureInitialSchoolCalendar2026_2027(
            snapshot.academicYear.id
          ).catch(error => {
            console.error(
              'Não foi possível preparar automaticamente o calendário escolar inicial do MA-Professor.',
              error
            )
          })
        },
        error: error => {
          console.error(
            'Não foi possível acompanhar a configuração operacional do MA-Professor.',
            error
          )
        }
      })

      observer?.disconnect()
      observer = null
    }

    start()

    if (
      !subscription &&
      typeof MutationObserver !== 'undefined' &&
      typeof document !== 'undefined'
    ) {
      observer = new MutationObserver(
        start
      )

      observer.observe(
        document.body,
        {
          childList: true,
          subtree: true
        }
      )
    }

    return () => {
      disposed = true
      observer?.disconnect()
      subscription?.unsubscribe()
    }
  }, [])

  return children
}
