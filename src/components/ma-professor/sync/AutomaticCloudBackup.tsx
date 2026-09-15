import Dexie from 'dexie'

import {
  useEffect
} from 'react'

import {
  useMAProfessorAccess
} from '../access/AccessGate'

import {
  MA_PROFESSOR_DATABASE_NAME
} from '../db'

import {
  createMAProfessorBackup
} from '../settings/backupRepository'

import {
  downloadMAProfessorCloudBackup,
  inspectMAProfessorCloudBackup,
  MAProfessorCloudBackupRevisionConflictError,
  uploadAndVerifyMAProfessorCloudBackup
} from './cloudBackupService'

import {
  clearMAProfessorCloudBackupTrust,
  createMAProfessorBackupContentSignature,
  markMAProfessorCloudBackupDirty,
  MA_PROFESSOR_CLOUD_BACKUP_TRUST_EVENT,
  readMAProfessorCloudBackupTrust,
  writeMAProfessorCloudBackupTrust,
  type MAProfessorCloudBackupTrust
} from './cloudBackupTrust'

const AUTO_BACKUP_DEBOUNCE_MS =
  90 * 1000

const AUTO_BACKUP_MAX_DIRTY_MS =
  5 * 60 * 1000

const AUTO_BACKUP_MIN_INTERVAL_MS =
  10 * 60 * 1000

const AUTO_BACKUP_RETRY_MS =
  5 * 60 * 1000

function readTimestamp(
  value: string | null | undefined
) {
  if (!value) {
    return 0
  }

  const timestamp =
    Date.parse(value)

  return Number.isFinite(timestamp)
    ? timestamp
    : 0
}

function isMAProfessorMutation(
  changedParts: unknown
) {
  if (
    typeof changedParts !== 'object' ||
    changedParts === null
  ) {
    return false
  }

  const prefix =
    `idb://${MA_PROFESSOR_DATABASE_NAME}/`

  return Object.keys(
    changedParts as Record<string, unknown>
  ).some(
    part =>
      part.startsWith(prefix)
  )
}

export default function AutomaticCloudBackup() {
  const {
    session
  } =
    useMAProfessorAccess()

  useEffect(() => {
    let disposed =
      false

    let timer:
      ReturnType<typeof setTimeout> | null =
      null

    let dirtySince:
      number | null =
      null

    let lastMutationAt:
      number | null =
      null

    let mutationSequence =
      0

    let running =
      false

    let blockedByDivergence =
      false

    let retryNotBefore =
      0

    const clearTimer =
      () => {
        if (!timer) {
          return
        }

        clearTimeout(timer)
        timer = null
      }

    const markTrust =
      (
        trust:
          MAProfessorCloudBackupTrust
      ) => {
        writeMAProfessorCloudBackupTrust(
          session,
          trust
        )

        blockedByDivergence =
          false
        retryNotBefore =
          0

        return trust
      }

    async function reconcileTrust() {
      const existing =
        readMAProfessorCloudBackupTrust(
          session
        )

      const status =
        await inspectMAProfessorCloudBackup(
          session
        )

      if (
        existing &&
        existing.serverRevision ===
          status.serverRevision
      ) {
        blockedByDivergence =
          false

        return existing
      }

      if (
        status.backup.found ===
          false
      ) {
        return markTrust({
          serverRevision:
            status.serverRevision,
          recordRevision:
            null,
          updatedAt:
            null
        })
      }

      const [
        remote,
        local
      ] =
        await Promise.all([
          downloadMAProfessorCloudBackup(
            session
          ),
          createMAProfessorBackup()
        ])

      if (!remote) {
        if (existing) {
          clearMAProfessorCloudBackupTrust(
            session
          )
        }

        blockedByDivergence =
          true

        return null
      }

      const matches =
        createMAProfessorBackupContentSignature(
          remote.backup
        ) ===
        createMAProfessorBackupContentSignature(
          local
        )

      if (!matches) {
        if (existing) {
          clearMAProfessorCloudBackupTrust(
            session
          )
        }

        blockedByDivergence =
          true

        return null
      }

      return markTrust({
        serverRevision:
          remote.serverRevision,
        recordRevision:
          remote.recordRevision,
        updatedAt:
          remote.updatedAt
      })
    }

    function scheduleBackup() {
      if (
        disposed ||
        running ||
        blockedByDivergence ||
        dirtySince === null
      ) {
        return
      }

      clearTimer()

      const now =
        Date.now()

      const quietDue =
        (lastMutationAt ?? now) +
        AUTO_BACKUP_DEBOUNCE_MS

      const dirtyLimit =
        dirtySince +
        AUTO_BACKUP_MAX_DIRTY_MS

      let dueAt =
        Math.min(
          quietDue,
          dirtyLimit
        )

      const trust =
        readMAProfessorCloudBackupTrust(
          session
        )

      const previousBackupAt =
        trust?.recordRevision
          ? readTimestamp(
              trust.updatedAt
            )
          : 0

      if (previousBackupAt) {
        dueAt =
          Math.max(
            dueAt,
            previousBackupAt +
              AUTO_BACKUP_MIN_INTERVAL_MS
          )
      }

      if (retryNotBefore) {
        dueAt =
          Math.max(
            dueAt,
            retryNotBefore
          )
      }

      timer =
        setTimeout(
          () => {
            timer = null
            void runBackup()
          },
          Math.max(
            0,
            dueAt - now
          )
        )
    }

    async function runBackup() {
      if (
        disposed ||
        running ||
        blockedByDivergence ||
        dirtySince === null
      ) {
        return
      }

      if (
        typeof navigator !== 'undefined' &&
        navigator.onLine === false
      ) {
        return
      }

      if (
        retryNotBefore &&
        Date.now() <
          retryNotBefore
      ) {
        scheduleBackup()
        return
      }

      running =
        true

      try {
        let trust =
          readMAProfessorCloudBackupTrust(
            session
          )

        if (!trust) {
          trust =
            await reconcileTrust()
        }

        if (
          !trust ||
          blockedByDivergence
        ) {
          return
        }

        const previousBackupAt =
          trust.recordRevision
            ? readTimestamp(
                trust.updatedAt
              )
            : 0

        if (
          previousBackupAt &&
          Date.now() <
            previousBackupAt +
              AUTO_BACKUP_MIN_INTERVAL_MS
        ) {
          return
        }

        const sequenceAtStart =
          mutationSequence

        const backup =
          await createMAProfessorBackup()

        const result =
          await uploadAndVerifyMAProfessorCloudBackup(
            session,
            backup,
            {
              expectedServerRevision:
                trust.serverRevision
            }
          )

        const changedDuringUpload =
          mutationSequence !==
          sequenceAtStart

        if (changedDuringUpload) {
          dirtySince =
            lastMutationAt ??
            Date.now()
        } else {
          dirtySince =
            null
          lastMutationAt =
            null
        }

        markTrust({
          serverRevision:
            result.serverRevision,
          recordRevision:
            result.recordRevision,
          updatedAt:
            result.updatedAt
        })
      } catch (error) {
        if (
          error instanceof
            MAProfessorCloudBackupRevisionConflictError
        ) {
          blockedByDivergence =
            true

          return
        }

        retryNotBefore =
          Date.now() +
          AUTO_BACKUP_RETRY_MS
      } finally {
        running =
          false

        if (
          dirtySince !== null &&
          !blockedByDivergence
        ) {
          scheduleBackup()
        }
      }
    }

    const handleStorageMutation =
      (changedParts: unknown) => {
        if (
          !isMAProfessorMutation(
            changedParts
          )
        ) {
          return
        }

        const now =
          Date.now()

        mutationSequence += 1
        lastMutationAt =
          now

        if (dirtySince === null) {
          dirtySince =
            now
        }

        markMAProfessorCloudBackupDirty(
          session,
          new Date(now).toISOString()
        )

        scheduleBackup()
      }

    const handleOnline =
      () => {
        retryNotBefore =
          0
        scheduleBackup()
      }

    const handleTrustChanged =
      () => {
        if (
          readMAProfessorCloudBackupTrust(
            session
          )
        ) {
          blockedByDivergence =
            false
          retryNotBefore =
            0
          scheduleBackup()
        }
      }

    Dexie.on(
      'storagemutated',
      handleStorageMutation
    )

    window.addEventListener(
      'online',
      handleOnline
    )

    window.addEventListener(
      MA_PROFESSOR_CLOUD_BACKUP_TRUST_EVENT,
      handleTrustChanged
    )

    void reconcileTrust()
      .then(trust => {
        const pendingSince =
          readTimestamp(
            trust?.dirtyAt
          )

        if (pendingSince) {
          dirtySince =
            pendingSince
          lastMutationAt =
            Date.now()
          mutationSequence += 1
        }

        scheduleBackup()
      })
      .catch(() => {
        // A cópia automática nunca bloqueia o trabalho local.
      })

    return () => {
      disposed =
        true

      clearTimer()

      Dexie.on(
        'storagemutated'
      ).unsubscribe(
        handleStorageMutation
      )

      window.removeEventListener(
        'online',
        handleOnline
      )

      window.removeEventListener(
        MA_PROFESSOR_CLOUD_BACKUP_TRUST_EVENT,
        handleTrustChanged
      )
    }
  }, [
    session.deviceId,
    session.email,
    session.token
  ])

  return null
}
