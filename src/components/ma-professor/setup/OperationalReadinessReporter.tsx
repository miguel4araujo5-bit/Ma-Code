import {
  liveQuery
} from 'dexie'

import {
  useEffect
} from 'react'

import {
  reportMAProfessorOperationalState
} from '../access/accessApi'

import {
  readMAProfessorStoredAccess
} from '../access/accessStorage'

import {
  maProfessorRepository
} from '../repository'

import {
  getMAProfessorSetupReadiness
} from './setupReadiness'

interface ReportableReadiness {
  operationalReady: boolean
  fullSetupCompleted: boolean
}

export default function OperationalReadinessReporter() {
  useEffect(() => {
    let disposed =
      false

    let lastAttempt =
      ''

    const subscription =
      liveQuery(
        async (): Promise<ReportableReadiness> => {
          const academicYear =
            await maProfessorRepository.getActiveAcademicYear()

          if (!academicYear) {
            return {
              operationalReady:
                false,
              fullSetupCompleted:
                false
            }
          }

          const snapshot =
            await maProfessorRepository.getSetupSnapshot(
              academicYear.id
            )

          const readiness =
            getMAProfessorSetupReadiness(
              snapshot
            )

          return {
            operationalReady:
              readiness.operationalReady,
            fullSetupCompleted:
              readiness.fullSetupCompleted
          }
        }
      ).subscribe({
        next: readiness => {
          if (disposed) {
            return
          }

          const access =
            readMAProfessorStoredAccess()

          if (
            !access?.token ||
            !access.deviceId
          ) {
            return
          }

          const fingerprint =
            [
              access.email,
              readiness.operationalReady
                ? 'ready'
                : 'not-ready',
              readiness.fullSetupCompleted
                ? 'complete'
                : 'incomplete'
            ].join('|')

          if (
            fingerprint ===
              lastAttempt
          ) {
            return
          }

          /*
           * Este reporte é apenas observabilidade administrativa.
           * Nunca pode bloquear o trabalho local do professor.
           */
          lastAttempt =
            fingerprint

          void reportMAProfessorOperationalState(
            access.token,
            access.deviceId,
            readiness.operationalReady,
            readiness.fullSetupCompleted
          ).catch(() => {
            // Uma falha de rede não altera nem bloqueia o estado local.
          })
        },
        error: error => {
          console.error(
            'Não foi possível observar o estado operacional local do MA-Professor.',
            error
          )
        }
      })

    return () => {
      disposed =
        true
      subscription.unsubscribe()
    }
  }, [])

  return null
}
