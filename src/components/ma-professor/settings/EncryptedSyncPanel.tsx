import {
  useCallback,
  useEffect,
  useState
} from 'react'

import {
  useMAProfessorAccess
} from '../access/AccessGate'

import {
  inspectMAProfessorManualSync,
  uploadAndVerifyMAProfessorManualSync,
  verifyMAProfessorManualSync,
  type MAProfessorManualSyncOverview,
  type MAProfessorManualSyncVerification
} from '../sync/manualSyncService'

type FeedbackTone =
  | 'success'
  | 'warning'
  | 'error'

interface Feedback {
  tone:
    FeedbackTone

  message:
    string
}

function getErrorMessage(
  error: unknown
) {
  return error instanceof Error &&
    error.message.trim()
    ? error.message
    : 'Não foi possível concluir a operação.'
}

function formatBytes(
  bytes: number
) {
  if (
    bytes <
      1024
  ) {
    return `${bytes} B`
  }

  if (
    bytes <
      1024 *
        1024
  ) {
    return `${(
      bytes /
      1024
    ).toFixed(
      1
    )} KB`
  }

  return `${(
    bytes /
    (
      1024 *
      1024
    )
  ).toFixed(
    1
  )} MB`
}

function formatDateTime(
  value: string | null
) {
  if (!value) {
    return '—'
  }

  const date =
    new Date(
      value
    )

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '—'
  }

  return new Intl
    .DateTimeFormat(
      'pt-PT',
      {
        dateStyle:
          'medium',

        timeStyle:
          'short'
      }
    )
    .format(
      date
    )
}

function getStatusPresentation(
  overview:
    MAProfessorManualSyncOverview
) {
  switch (
    overview.status
  ) {
    case 'synced':
      return {
        eyebrow:
          'Cópia atualizada',

        title:
          'Os dados deste dispositivo estão guardados online.',

        description:
          'A última cópia cifrada foi enviada e verificada com sucesso.',

        tone:
          'emerald' as const
      }

    case 'local-changes':
      return {
        eyebrow:
          'Alterações por guardar',

        title:
          'Existem alterações neste dispositivo.',

        description:
          'A cópia online continua segura, mas ainda não inclui as alterações mais recentes.',

        tone:
          'amber' as const
      }

    case 'remote-newer':
      return {
        eyebrow:
          'Cópia mais recente online',

        title:
          'Existe uma versão online mais recente.',

        description:
          'Por segurança, este dispositivo não pode substituir essa versão sem a verificar primeiro.',

        tone:
          'violet' as const
      }

    case 'remote-unverified':
      return {
        eyebrow:
          'Cópia online encontrada',

        title:
          'Este dispositivo ainda não confirmou a cópia online.',

        description:
          'Verifique a cópia antes de guardar uma nova versão.',

        tone:
          'violet' as const
      }

    case 'status-outdated':
      return {
        eyebrow:
          'A atualizar estado',

        title:
          'A informação do servidor precisa de ser atualizada.',

        description:
          'Atualize o estado antes de criar uma nova cópia.',

        tone:
          'amber' as const
      }

    case 'not-synced':
    default:
      return {
        eyebrow:
          'Ainda não sincronizado',

        title:
          'Ainda não existe uma cópia cifrada destes dados online.',

        description:
          'Pode criar a primeira cópia quando estiver pronto. Nada é enviado automaticamente.',

        tone:
          'cyan' as const
      }
  }
}

function getToneClasses(
  tone:
    'cyan' |
    'emerald' |
    'amber' |
    'violet'
) {
  switch (tone) {
    case 'emerald':
      return {
        border:
          'border-emerald-300/20',

        background:
          'bg-emerald-300/[0.06]',

        text:
          'text-emerald-300'
      }

    case 'amber':
      return {
        border:
          'border-amber-300/20',

        background:
          'bg-amber-300/[0.06]',

        text:
          'text-amber-300'
      }

    case 'violet':
      return {
        border:
          'border-violet-300/20',

        background:
          'bg-violet-300/[0.06]',

        text:
          'text-violet-300'
      }

    case 'cyan':
    default:
      return {
        border:
          'border-cyan-300/20',

        background:
          'bg-cyan-300/[0.06]',

        text:
          'text-cyan-300'
      }
  }
}

export function EncryptedSyncPanel() {
  const {
    session,
    syncStatus,
    syncChecking,
    syncError,
    refreshSyncStatus
  } =
    useMAProfessorAccess()

  const [
    overview,
    setOverview
  ] =
    useState<MAProfessorManualSyncOverview | null>(
      null
    )

  const [
    verification,
    setVerification
  ] =
    useState<MAProfessorManualSyncVerification | null>(
      null
    )

  const [
    checking,
    setChecking
  ] =
    useState(false)

  const [
    busy,
    setBusy
  ] =
    useState<
      '' |
      'upload' |
      'verify'
    >('')

  const [
    feedback,
    setFeedback
  ] =
    useState<Feedback | null>(
      null
    )

  const refreshOverview =
    useCallback(
      async (
        revision:
          number,
        updatedAt:
          string | null
      ) => {
        setChecking(true)

        try {
          const next =
            await inspectMAProfessorManualSync({
              email:
                session.email,

              deviceId:
                session.deviceId,

              serverRevision:
                revision,

              serverUpdatedAt:
                updatedAt
            })

          setOverview(
            next
          )
        } catch (
          error
        ) {
          setFeedback({
            tone:
              'error',

            message:
              getErrorMessage(
                error
              )
          })
        } finally {
          setChecking(false)
        }
      },
      [
        session.deviceId,
        session.email
      ]
    )

  useEffect(() => {
    if (
      !syncStatus ||
      !syncStatus.profileExists
    ) {
      setOverview(
        null
      )

      return
    }

    void refreshOverview(
      syncStatus.serverRevision,
      syncStatus.updatedAt
    )
  }, [
    refreshOverview,
    syncStatus
  ])

  const handleRefresh =
    async () => {
      setFeedback(null)
      setVerification(null)

      await refreshSyncStatus()
    }

  const handleUpload =
    async () => {
      if (
        !syncStatus ||
        !syncStatus.profileExists ||
        busy
      ) {
        return
      }

      setBusy(
        'upload'
      )

      setFeedback(null)
      setVerification(null)

      try {
        const result =
          await uploadAndVerifyMAProfessorManualSync({
            token:
              session.token,

            email:
              session.email,

            deviceId:
              session.deviceId,

            serverRevision:
              syncStatus.serverRevision,

            serverUpdatedAt:
              syncStatus.updatedAt
          })

        setOverview(
          result.overview
        )

        setFeedback({
          tone:
            'success',

          message:
            'Cópia cifrada guardada e verificada com sucesso.'
        })

        await refreshSyncStatus()
      } catch (
        error
      ) {
        setFeedback({
          tone:
            'error',

          message:
            getErrorMessage(
              error
            )
        })

        await refreshSyncStatus()
      } finally {
        setBusy('')
      }
    }

  const handleVerify =
    async () => {
      if (
        !syncStatus ||
        !syncStatus.profileExists ||
        busy
      ) {
        return
      }

      setBusy(
        'verify'
      )

      setFeedback(null)
      setVerification(null)

      try {
        const result =
          await verifyMAProfessorManualSync({
            token:
              session.token,

            email:
              session.email,

            deviceId:
              session.deviceId,

            serverRevision:
              syncStatus.serverRevision,

            serverUpdatedAt:
              syncStatus.updatedAt
          })

        setVerification(
          result
        )

        if (
          result.found ===
            false
        ) {
          setFeedback({
            tone:
              'warning',

            message:
              'Não foi encontrada uma cópia cifrada dos dados deste ano no servidor.'
          })

          return
        }

        if (
          result.matchesLocal
        ) {
          setFeedback({
            tone:
              'success',

            message:
              'A cópia online foi desencriptada e corresponde exatamente aos dados deste dispositivo.'
          })

          await refreshOverview(
            result.remoteServerRevision,
            result.remoteUpdatedAt
          )
        } else {
          setFeedback({
            tone:
              'warning',

            message:
              'A cópia online é diferente dos dados atualmente guardados neste dispositivo. Nenhuma versão foi substituída.'
          })
        }

        await refreshSyncStatus()
      } catch (
        error
      ) {
        setFeedback({
          tone:
            'error',

          message:
            getErrorMessage(
              error
            )
        })
      } finally {
        setBusy('')
      }
    }

  if (
    syncChecking &&
    !syncStatus
  ) {
    return (
      <section className="rounded-3xl border border-cyan-300/15 bg-slate-900/70 p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
          Cópia cifrada online
        </p>

        <p className="mt-3 text-sm text-slate-400">
          A verificar o estado da sua cópia…
        </p>
      </section>
    )
  }

  if (
    !syncStatus ||
    !syncStatus.profileExists
  ) {
    return (
      <section className="rounded-3xl border border-amber-300/15 bg-slate-900/70 p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">
          Cópia cifrada online
        </p>

        <h2 className="mt-2 text-xl font-black text-white">
          A proteção online ainda não está disponível
        </h2>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
          Os dados continuam guardados neste dispositivo. Atualize o estado para confirmar se a proteção da conta já ficou ativa.
        </p>

        {syncError ? (
          <p className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-300/[0.06] px-4 py-3 text-sm text-rose-200">
            {syncError}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() =>
            void handleRefresh()
          }
          className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-white transition hover:border-cyan-300/30"
        >
          Atualizar estado
        </button>
      </section>
    )
  }

  const presentation =
    overview
      ? getStatusPresentation(
          overview
        )
      : null

  const toneClasses =
    presentation
      ? getToneClasses(
          presentation.tone
        )
      : getToneClasses(
          'cyan'
        )

  const canUpload =
    Boolean(
      overview &&
      (
        overview.status ===
          'not-synced' ||
        overview.status ===
          'synced' ||
        overview.status ===
          'local-changes'
      )
    )

  return (
    <section className="rounded-3xl border border-cyan-300/15 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/20 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
            Cópia cifrada online
          </p>

          <h2 className="mt-2 text-xl font-black text-white">
            Uma cópia protegida, controlada por si
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            A cópia é protegida neste dispositivo antes do envio. A MA-CODE não possui a chave necessária para abrir os dados escolares.
          </p>
        </div>

        <div className="shrink-0 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.06] px-4 py-3">
          <p className="text-xs font-black text-emerald-200">
            Proteção ativa
          </p>

          <p className="mt-1 text-[0.68rem] text-emerald-100/70">
            Envio manual
          </p>
        </div>
      </div>

      {checking ||
      !overview ? (
        <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/55 p-4">
          <p className="text-sm font-semibold text-slate-400">
            A verificar os dados deste dispositivo…
          </p>
        </div>
      ) : (
        <>
          <div
            className={`mt-5 rounded-2xl border p-4 ${toneClasses.border} ${toneClasses.background}`}
          >
            <p
              className={`text-xs font-black uppercase tracking-[0.16em] ${toneClasses.text}`}
            >
              {presentation?.eyebrow}
            </p>

            <p className="mt-2 text-base font-black text-white">
              {presentation?.title}
            </p>

            <p className="mt-1.5 text-sm leading-6 text-slate-400">
              {presentation?.description}
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
              <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-slate-500">
                Registos locais
              </p>

              <p className="mt-2 text-xl font-black text-white">
                {overview.localRecords}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
              <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-slate-500">
                Tamanho
              </p>

              <p className="mt-2 text-xl font-black text-white">
                {formatBytes(
                  overview.localBytes
                )}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
              <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-slate-500">
                Última cópia
              </p>

              <p className="mt-2 text-sm font-black leading-5 text-white">
                {formatDateTime(
                  overview.lastSyncedAt
                )}
              </p>
            </div>
          </div>
        </>
      )}

      {verification &&
      verification.found ? (
        <div
          className={`mt-4 rounded-2xl border p-4 ${
            verification.matchesLocal
              ? 'border-emerald-300/20 bg-emerald-300/[0.06]'
              : 'border-amber-300/20 bg-amber-300/[0.06]'
          }`}
        >
          <p
            className={`text-sm font-black ${
              verification.matchesLocal
                ? 'text-emerald-200'
                : 'text-amber-200'
            }`}
          >
            {verification.matchesLocal
              ? '✓ Cópia online confirmada'
              : 'A cópia online é diferente'}
          </p>

          <p className="mt-2 text-xs leading-5 text-slate-400">
            Dispositivo: {verification.localRecords} registos · Online: {verification.remoteRecords} registos
          </p>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            Cópia online atualizada em {formatDateTime(
              verification.remoteUpdatedAt
            )}.
          </p>
        </div>
      ) : null}

      {feedback ? (
        <p
          role="status"
          className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-semibold ${
            feedback.tone ===
              'success'
              ? 'border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-200'
              : feedback.tone ===
                  'warning'
                ? 'border-amber-300/20 bg-amber-300/[0.07] text-amber-200'
                : 'border-rose-300/20 bg-rose-300/[0.07] text-rose-200'
          }`}
        >
          {feedback.message}
        </p>
      ) : null}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          disabled={
            Boolean(
              busy
            ) ||
            checking ||
            !canUpload
          }
          onClick={() =>
            void handleUpload()
          }
          className="flex-1 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ===
          'upload'
            ? 'A guardar e verificar…'
            : 'Guardar cópia cifrada agora'}
        </button>

        <button
          type="button"
          disabled={
            Boolean(
              busy
            ) ||
            checking ||
            syncStatus.serverRevision ===
              0
          }
          onClick={() =>
            void handleVerify()
          }
          className="flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-white transition hover:border-violet-300/30 hover:bg-violet-300/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ===
          'verify'
            ? 'A verificar…'
            : 'Verificar cópia online'}
        </button>
      </div>

      {overview &&
      (
        overview.status ===
          'remote-newer' ||
        overview.status ===
          'remote-unverified'
      ) ? (
        <p className="mt-4 text-xs leading-5 text-amber-200/80">
          Para sua segurança, uma cópia online que este dispositivo ainda não confirmou nunca é substituída automaticamente.
        </p>
      ) : null}

      <p className="mt-4 text-xs leading-5 text-slate-500">
        A sincronização automática continua desligada nesta fase. O envio só acontece quando carrega no botão acima.
      </p>
    </section>
  )
}

export default EncryptedSyncPanel
