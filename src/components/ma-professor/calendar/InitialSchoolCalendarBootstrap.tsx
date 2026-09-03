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

export default function InitialSchoolCalendarBootstrap({
  children
}: {
  children: ReactNode
}) {
  useEffect(() => {
    let disposed = false

    const subscription = liveQuery(
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

    return () => {
      disposed = true
      subscription.unsubscribe()
    }
  }, [])

  return children
}
