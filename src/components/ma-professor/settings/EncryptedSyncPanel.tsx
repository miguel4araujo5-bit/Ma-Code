import CloudBackupPreferencePanel from '../sync/CloudBackupPreferencePanel'
import CloudBackupReauthentication from '../sync/CloudBackupReauthentication'
import {
  useCloudBackupPreference
} from '../sync/cloudBackupPreference'

import {
  MA_PROFESSOR_OPAQUE_KEY_EVENT,
  readMAProfessorOpaqueExportKey
} from '../access/accessStorage'

import {
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react'

import {
  useMAProfessorAccess
} from '../access/AccessGate'

import {
  inspectMAProfessorCloudBackup,
  MA_PROFESSOR_BACKUP_AUTH_REQUIRED_EVENT,
  MAProfessorCloudBackupAuthenticationRequiredError,
  uploadAndVerifyCompatibleMAProfessorCloudBackup,
  type MAProfessorCloudBackupAuthenticationRequiredDetail,
  type MAProfessorCloudBackupStatus
} from '../sync/cloudBackupService'

import {
  writeMAProfessorCloudBackupTrust,
  useMAProfessorAutomaticBackupError
} from '../sync/cloudBackupTrust'

import type {
  MAProfessorBackup
} from '../types'

import {
  createMAProfessorBackup
} from './backupRepository'

type FeedbackTone =
  | 'success'
  | 'error'

interface Feedback {
  tone: FeedbackTone
  message: string
}

function getErrorMessage(
  error: unknown
) {
  return error instanceof Error &&
    error.message.trim()
    ? error.message
    : 'Não foi possível concluir a operação.'
}

function formatDateTime(
  value: string | null
) {
  if (!value) {
    return 'Ainda sem cópia'
  }

  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '—'
  }

  return new Intl.DateTimeFormat(
    'pt-PT',
    {
      dateStyle: 'medium',
      timeStyle: 'short'
    }
  ).format(date)
}

function formatBytes(
  bytes: number | null
) {
  if (bytes === null) {
    return '—'
  }

  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (
    bytes <
      1024 * 1024
  ) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`
}

function getPreparedBackupStats(
  backup: MAProfessorBackup
) {
  const data =
    backup.data

  return [
    {
      label: 'Anos letivos',
      value: data.academicYears.length
    },
    {
      label: 'Turmas',
      value: data.groups.length
    },
    {
      label: 'Disciplinas',
      value: data.subjects.length
    },
    {
      label: 'UFCD / módulos',
      value: data.modules.length
    },
    {
      label: 'Alunos',
      value: data.students.length
    },
    {
      label: 'Tempos de horário',
      value: data.weeklyScheduleSlots.length
    },
    {
      label: 'Planificações',
      value: data.planifications.length
    },
    {
      label: 'Itens de planificação',
      value: data.planificationItems.length
    },
    {
      label: 'Critérios',
      value: data.assessmentCriteria.length
    },
    {
      label: 'Aulas',
      value: data.lessons.length
    },
    {
      label: 'Sumários',
      value: data.lessons.filter(
        lesson =>
          Boolean(
            lesson.summary.trim()
          )
      ).length
    },
    {
      label: 'Faltas',
      value: data.lessonAttendance.filter(
        attendance =>
          attendance.status === 'absent'
      ).length
    },
    {
      label: 'Avaliações',
      value: data.lessonAssessments.length
    },
    {
      label: 'Resultados / notas',
      value: data.assessmentResults.length
    },
    {
      label: 'Notas finais',
      value: data.moduleFinalGrades.filter(
        grade =>
          grade.finalGrade !== null ||
          grade.qualitativeFinalGrade != null ||
          Boolean(
            grade.descriptiveAssessment?.trim()
          )
      ).length
    },
    {
      label: 'Recuperações',
      value: data.learningRecoveries.length
    }
  ]
}

export function EncryptedSyncPanel() {
  const {
    session
  } =
    useMAProfessorAccess()

  const preference =
    useCloudBackupPreference(
      session
    )

  const automaticError = useMAProfessorAutomaticBackupError(session)

  const [
    keyAvailable,
    setKeyAvailable
  ] =
    useState(
      () =>
        Boolean(
          readMAProfessorOpaqueExportKey(
            session.email
          )
        )
    )

  const [
    reauthenticationRequired,
    setReauthenticationRequired
  ] =
    useState(false)

  useEffect(() => {
    const updateKeyAvailability =
      () => {
        const available =
          Boolean(
            readMAProfessorOpaqueExportKey(
              session.email
            )
          )

        setKeyAvailable(
          available
        )

        if (available) {
          setReauthenticationRequired(
            false
          )
        }
      }

    const requireReauthentication =
      (event: Event) => {
        const detail =
          (event as CustomEvent<MAProfessorCloudBackupAuthenticationRequiredDetail>).detail

        if (
          detail.email ===
            session.email &&
          (
            detail.token ===
              undefined ||
            (
              detail.token ===
                session.token &&
              detail.deviceId ===
                session.deviceId
            )
          )
        ) {
          setReauthenticationRequired(
            true
          )
        }
      }

    updateKeyAvailability()

    window.addEventListener(
      MA_PROFESSOR_OPAQUE_KEY_EVENT,
      updateKeyAvailability
    )
    window.addEventListener(
      MA_PROFESSOR_BACKUP_AUTH_REQUIRED_EVENT,
      requireReauthentication
    )

    return () => {
      window.removeEventListener(
        MA_PROFESSOR_OPAQUE_KEY_EVENT,
        updateKeyAvailability
      )
      window.removeEventListener(
        MA_PROFESSOR_BACKUP_AUTH_REQUIRED_EVENT,
        requireReauthentication
      )
    }
  }, [
    session.deviceId,
    session.email,
    session.token
  ])

  const [
    status,
    setStatus
  ] =
    useState<MAProfessorCloudBackupStatus | null>(
      null
    )

  const [
    checking,
    setChecking
  ] =
    useState(true)

  const [
    busy,
    setBusy
  ] =
    useState(false)

  const [
    preparedBackup,
    setPreparedBackup
  ] =
    useState<MAProfessorBackup | null>(
      null
    )

  const [
    feedback,
    setFeedback
  ] =
    useState<Feedback | null>(
      null
    )

  const [
    statusError,
    setStatusError
  ] =
    useState('')

  const statusRequestId =
    useRef(0)

  const needsReauthentication =
    !keyAvailable ||
    reauthenticationRequired

  const preparedStats =
    preparedBackup
      ? getPreparedBackupStats(
          preparedBackup
        )
      : null

  const refreshStatus =
    useCallback(
      async () => {
        const requestId =
          ++statusRequestId.current

        setChecking(true)

        try {
          const nextStatus =
            await inspectMAProfessorCloudBackup(
              session
            )

          if (
            statusRequestId.current !==
              requestId
          ) {
            return
          }

          setStatus(nextStatus)
          setStatusError('')
        } catch (error) {
          if (
            statusRequestId.current !==
              requestId
          ) {
            return
          }

          setStatus(null)

          if (
            error instanceof
              MAProfessorCloudBackupAuthenticationRequiredError
          ) {
            setStatusError('')
            return
          }

          setStatusError(
            getErrorMessage(
              error
            )
          )
        } finally {
          if (
            statusRequestId.current ===
              requestId
          ) {
            setChecking(false)
          }
        }
      },
      [session]
    )

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus])

  const handlePrepareBackup =
    async () => {
      if (
        busy ||
        needsReauthentication
      ) {
        return
      }

      setBusy(true)
      setFeedback(null)

      try {
        const backup =
          await createMAProfessorBackup()

        setPreparedBackup(
          backup
        )
      } catch (error) {
        setPreparedBackup(null)
        setFeedback({
          tone: 'error',
          message:
            `Não foi possível preparar a cópia. ${getErrorMessage(error)}`
        })
      } finally {
        setBusy(false)
      }
    }

  const handleUpload =
    async () => {
      if (
        busy ||
        needsReauthentication ||
        !preparedBackup
      ) {
        return
      }

      setBusy(true)
      setFeedback(null)

      try {
        const beforeStatus =
          await inspectMAProfessorCloudBackup(
            session
          )
        const previousServerRevision =
          beforeStatus.serverRevision
        const previousRecordRevision =
          beforeStatus.backup.recordRevision ??
          0

        const result =
          await uploadAndVerifyCompatibleMAProfessorCloudBackup(
            session,
            preparedBackup,
            {
              expectedServerRevision:
                previousServerRevision
            }
          )

        if (
          result.serverRevision !==
            previousServerRevision + 1 ||
          result.recordRevision !==
            previousRecordRevision + 1
        ) {
          throw new Error(
            'O servidor não confirmou o avanço esperado da revisão.'
          )
        }

        const confirmedStatus =
          await inspectMAProfessorCloudBackup(
            session
          )

        if (
          confirmedStatus.serverRevision !==
            result.serverRevision ||
          !confirmedStatus.backup.found ||
          confirmedStatus.backup.recordRevision !==
            result.recordRevision ||
          confirmedStatus.backup.updatedAt !==
            result.updatedAt
        ) {
          throw new Error(
            'A nova revisão não pôde ser confirmada no servidor.'
          )
        }

        writeMAProfessorCloudBackupTrust(
          session,
          {
            serverRevision:
              result.serverRevision,
            recordRevision:
              result.recordRevision,
            updatedAt:
              result.updatedAt
          }
        )

        setStatus(
          confirmedStatus
        )
        setStatusError('')
        setPreparedBackup(null)
        setFeedback({
          tone: 'success',
          message:
            `Cópia de segurança cifrada, enviada e confirmada no servidor como revisão ${result.recordRevision}.`
        })
      } catch (error) {
        if (
          error instanceof
            MAProfessorCloudBackupAuthenticationRequiredError
        ) {
          setFeedback({
            tone: 'error',
            message:
              'A nova cópia não foi guardada. Confirme novamente a sua password e volte a tentar.'
          })
          return
        }

        setFeedback({
          tone: 'error',
          message:
            `Não foi possível confirmar que a nova cópia ficou guardada. Não considere a operação concluída. ${getErrorMessage(error)}`
        })

        await refreshStatus()
      } finally {
        setBusy(false)
      }
    }

  const found =
    status?.backup.found === true

  return (
    <section className="ma-professor-cloud-backup-panel h-full rounded-3xl border border-violet-300/20 bg-gradient-to-br from-slate-900 via-slate-900 to-violet-950/20 p-5 sm:p-6">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">
        Nuvem
      </p>

      <h3 className="mt-2 text-xl font-black text-white">
        Fazer cópia de segurança para a nuvem
      </h3>

      <p className="mt-2 text-sm leading-6 text-slate-400">
        Primeiro prepara uma cópia dos dados atuais para poder confirmar o que vai ser enviado. Só depois da sua confirmação é que a cópia é cifrada neste dispositivo e enviada para a nuvem.
      </p>

      {needsReauthentication ? (
        <div className="mt-4">
          <CloudBackupReauthentication
            forceRequired
            embedded
            onConfirmed={() => setFeedback({
              tone: 'success',
              message: preparedBackup
                ? 'Password confirmada. Pode agora confirmar o envio da cópia preparada.'
                : 'Password confirmada. Carregue em «Preparar cópia para a nuvem» e confirme o envio da cópia preparada.'
            })}
          />
        </div>
      ) : (
        <>
          {automaticError ? (
            <p role="alert" className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
              A última cópia online não foi concluída: {automaticError} Os dados continuam neste dispositivo. Pode voltar a tentar pelo aviso ou preparar uma cópia manual.
            </p>
          ) : null}
          <div className="mt-4">
            <CloudBackupPreferencePanel />
          </div>

          {!preparedBackup ? (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void handlePrepareBackup()
              }
              className="mt-5 w-full rounded-2xl bg-violet-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-violet-200 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
            >
              {busy
                ? 'A preparar cópia…'
                : 'Preparar cópia para a nuvem'}
            </button>
          ) : null}

          {preparedBackup && preparedStats ? (
            <div className="mt-5 rounded-2xl border border-violet-300/20 bg-slate-950/60 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-200">
                    Dados que vão ser enviados
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Cópia preparada em {formatDateTime(preparedBackup.exportedAt)}. Os números abaixo pertencem exatamente à cópia que será enviada.
                  </p>
                </div>
                <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-black text-emerald-200">
                  Ainda não enviada
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-center sm:grid-cols-3 lg:grid-cols-4">
                {preparedStats.map(
                  item => (
                    <div
                      key={item.label}
                      className="rounded-xl bg-white/[0.03] p-3"
                    >
                      <p className="text-xl font-black text-white">
                        {item.value}
                      </p>
                      <p className="text-[0.68rem] leading-4 text-slate-500">
                        {item.label}
                      </p>
                    </div>
                  )
                )}
              </div>

              <p className="mt-4 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.05] px-3 py-2 text-xs leading-5 text-cyan-100">
                Se algum destes números não corresponder aos dados atuais do MA-Professor, não envie a cópia: o problema está na preparação local e não no envio para a nuvem.
              </p>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void handleUpload()
                  }
                  className="rounded-xl bg-violet-300 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-violet-200 disabled:cursor-wait disabled:opacity-60"
                >
                  {busy
                    ? 'A cifrar, enviar e verificar…'
                    : 'Enviar esta cópia para a nuvem'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void handlePrepareBackup()
                  }
                  className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-bold text-slate-200 transition hover:bg-white/5 disabled:cursor-wait disabled:opacity-60"
                >
                  Atualizar pré-visualização
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    setPreparedBackup(null)
                  }
                  className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-400 transition hover:text-white disabled:cursor-wait disabled:opacity-60"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-5 border-t border-white/10 pt-4">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400">
              <span>
                <strong className="text-slate-200">
                  Estado:
                </strong>{' '}
                {checking
                  ? 'A verificar…'
                  : !status
                    ? 'por confirmar'
                    : found
                      ? 'cópia online disponível'
                      : 'sem cópia online'}
              </span>

              <span>
                <strong className="text-slate-200">
                  Última cópia:
                </strong>{' '}
                {checking || !status
                  ? '—'
                  : formatDateTime(
                      status.backup.updatedAt
                    )}
              </span>

              {found ? (
                <>
                  <span>
                    <strong className="text-slate-200">
                      Revisão:
                    </strong>{' '}
                    {status?.backup.recordRevision ??
                      '—'}
                  </span>
                  <span>
                    <strong className="text-slate-200">
                      Tamanho:
                    </strong>{' '}
                    {formatBytes(
                      status?.backup.ciphertextBytes ??
                        null
                    )}
                  </span>
                </>
              ) : null}
            </div>

            <p className="mt-3 text-xs leading-5 text-slate-500">
              {preference === 'enabled'
                ? 'Os lembretes estão ativos. A cópia online só é enviada quando escolhe «Sim» no aviso ou confirma uma cópia manual.'
                : 'Os lembretes estão desativados neste dispositivo. A preparação acima não envia dados até carregar em “Enviar esta cópia para a nuvem”.'}
            </p>
          </div>

          {statusError ? (
            <p
              role="alert"
              className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-300/[0.06] px-4 py-3 text-sm text-rose-200"
            >
              {statusError}
            </p>
          ) : null}
        </>
      )}

      {feedback ? (
        <p
          role={feedback.tone === 'success' ? 'status' : undefined}
          className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
            feedback.tone === 'success'
              ? 'border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-200'
              : 'border-rose-300/20 bg-rose-300/[0.06] text-rose-200'
          }`}
        >
          {feedback.message}
        </p>
      ) : null}
    </section>
  )
}
