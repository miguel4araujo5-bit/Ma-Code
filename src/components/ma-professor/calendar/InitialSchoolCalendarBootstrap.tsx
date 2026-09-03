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
        () =>
          maProfessorRepository.getActiveAcademicYear()
      ).subscribe({
        next: academicYear => {
          if (
            disposed ||
            !academicYear?.setupCompletedAt
          ) {
            return
          }

          void ensureInitialSchoolCalendar2026_2027(
            academicYear.id
          ).catch(error => {
            console.error(
              'Não foi possível preparar automaticamente o calendário escolar inicial do MA-Professor.',
              error
            )
          })
        },
        error: error => {
          console.error(
            'Não foi possível acompanhar o ano letivo ativo do MA-Professor.',
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
