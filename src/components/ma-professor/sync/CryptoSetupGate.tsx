import {
  type ReactNode,
  useEffect,
  useState
} from 'react'

import {
  useMAProfessorAccess
} from '../access/AccessGate'

import {
  createAndStoreMAProfessorCryptoMaterial,
  deleteMAProfessorLocalCryptoMaterial,
  readMAProfessorLocalCryptoMaterial,
  unlockMAProfessorLocalMasterKey,
  type MAProfessorLocalCryptoMaterial
} from './cryptoStorage'

import {
  initializeMAProfessorSync
} from './syncApi'

import {
  ensureMAProfessorRecoveryVerifier,
  recoverMAProfessorOnNewDevice,
  type MAProfessorNewDeviceRecoveryResult
} from './deviceRecoveryService'

type ProtectionStage =
  | 'checking'
  | 'setup'
  | 'recovery'
  | 'ready'
  | 'remote-existing'
  | 'recovery-complete'
  | 'service-error'
  | 'error'

interface PendingCryptoSetup {
  recoveryCode: string

  local:
    MAProfessorLocalCryptoMaterial
}

function getErrorMessage(
  error: unknown
) {
  return error instanceof
    Error &&
    error.message.trim()
    ? error.message
    : 'Ocorreu um erro inesperado.'
}

function fallbackCopyText(
  value: string
) {
  const textarea =
    document.createElement(
      'textarea'
    )

  textarea.value =
    value

  textarea.setAttribute(
    'readonly',
    ''
  )

  textarea.style.position =
    'fixed'

  textarea.style.left =
    '-9999px'

  textarea.style.opacity =
    '0'

  document.body.appendChild(
    textarea
  )

  textarea.focus()
  textarea.select()

  textarea.setSelectionRange(
    0,
    textarea.value.length
  )

  const copied =
    document.execCommand(
      'copy'
    )

  textarea.remove()

  if (!copied) {
    throw new Error(
      'Não foi possível copiar automaticamente.'
    )
  }
}

async function copyText(
  value: string
) {
  if (
    navigator.clipboard &&
    typeof navigator.clipboard
      .writeText ===
      'function'
  ) {
    await navigator
      .clipboard
      .writeText(
        value
      )

    return
  }

  fallbackCopyText(
    value
  )
}

function ProtectionShell({
  children
}: {
  children:
    ReactNode
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white sm:px-6">
      <section className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/95 shadow-2xl shadow-cyan-950/30">
        <div className="h-1.5 bg-gradient-to-r from-cyan-300 via-sky-300 to-violet-300" />

        <div className="p-6 sm:p-9">
          {children}
        </div>
      </section>
    </main>
  )
}

function ShieldIcon() {
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-200">
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-7 w-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3 5 6v5c0 4.6 2.7 8.2 7 10 4.3-1.8 7-5.4 7-10V6l-7-3Z" />

        <path d="m9.5 12 1.7 1.7 3.6-4" />
      </svg>
    </div>
  )
}

function ErrorMessage({
  message
}: {
  message: string
}) {
  if (!message) {
    return null
  }

  return (
    <div
      role="alert"
      className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-300/[0.07] px-4 py-3 text-sm leading-6 text-rose-100"
    >
      {message}
    </div>
  )
}

function LoadingProtection() {
  return (
    <ProtectionShell>
      <div className="text-center">
        <div className="mx-auto h-11 w-11 animate-spin rounded-full border-4 border-cyan-300/20 border-t-cyan-300" />

        <h1 className="mt-6 text-xl font-black">
          A preparar a proteção
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-400">
          Estamos a verificar este dispositivo e a sua conta.
        </p>
      </div>
    </ProtectionShell>
  )
}

function RecoveryResultCard({
  result
}: {
  result:
    MAProfessorNewDeviceRecoveryResult
}) {
  const restored =
    result.dataStatus ===
      'restored'

  const alreadyCurrent =
    result.dataStatus ===
      'already-current'

  const warning =
    result.dataStatus ===
      'manual-restore-required' ||
    result.dataStatus ===
      'restore-deferred'

  return (
    <div
      className={`mt-5 rounded-2xl border p-4 ${
        warning
          ? 'border-amber-300/20 bg-amber-300/[0.06]'
          : 'border-emerald-300/20 bg-emerald-300/[0.06]'
      }`}
    >
      <p
        className={`text-sm font-black ${
          warning
            ? 'text-amber-100'
            : 'text-emerald-100'
        }`}
      >
        {restored
          ? '✓ Cópia recuperada'
          : alreadyCurrent
            ? '✓ Dados confirmados'
            : warning
              ? 'Dispositivo autorizado'
              : '✓ Dispositivo autorizado'}
      </p>

      <p className="mt-2 text-sm leading-6 text-slate-300">
        {result.message}
      </p>
    </div>
  )
}

export function CryptoSetupGate({
  children
}: {
  children:
    ReactNode
}) {
  const {
    session,
    syncStatus,
    syncChecking,
    syncError,
    refreshSyncStatus,
    signOut
  } =
    useMAProfessorAccess()

  const [
    stage,
    setStage
  ] =
    useState<ProtectionStage>(
      'checking'
    )

  const [
    pendingSetup,
    setPendingSetup
  ] =
    useState<PendingCryptoSetup | null>(
      null
    )

  const [
    creating,
    setCreating
  ] =
    useState(false)

  const [
    completing,
    setCompleting
  ] =
    useState(false)

  const [
    setupAcknowledged,
    setSetupAcknowledged
  ] =
    useState(false)

  const [
    recoverySaved,
    setRecoverySaved
  ] =
    useState(false)

  const [
    recoveryAcknowledged,
    setRecoveryAcknowledged
  ] =
    useState(false)

  const [
    recoveryAction,
    setRecoveryAction
  ] =
    useState('')

  const [
    recoveryCodeInput,
    setRecoveryCodeInput
  ] =
    useState('')

  const [
    recoveringDevice,
    setRecoveringDevice
  ] =
    useState(false)

  const [
    recoveredDeviceResult,
    setRecoveredDeviceResult
  ] =
    useState<MAProfessorNewDeviceRecoveryResult | null>(
      null
    )

  const [
    error,
    setError
  ] =
    useState('')

  const [
    protectionReady,
    setProtectionReady
  ] =
    useState(false)

  const [
    retryNonce,
    setRetryNonce
  ] =
    useState(0)

  useEffect(() => {
    let cancelled =
      false

    if (
      pendingSetup ||
      protectionReady ||
      stage ===
        'recovery-complete'
    ) {
      return () => {
        cancelled =
          true
      }
    }

    async function inspectProtection() {
      if (
        syncChecking
      ) {
        setStage(
          'checking'
        )

        return
      }

      try {
        const local =
          await readMAProfessorLocalCryptoMaterial(
            session.email,
            session.deviceId
          )

        if (
          cancelled
        ) {
          return
        }

        if (
          syncStatus
        ) {
          if (
            syncStatus
              .profileExists
          ) {
            if (
              !local
            ) {
              setError('')

              setStage(
                'remote-existing'
              )

              return
            }

            await unlockMAProfessorLocalMasterKey(
              session.email,
              session.deviceId
            )

            /*
             * Perfis criados antes desta versão ainda podem não ter
             * a prova necessária para autorizar um novo dispositivo.
             *
             * Prepará-la não bloqueia a utilização normal da app.
             */
            try {
              await ensureMAProfessorRecoveryVerifier(
                session.token,
                session.email,
                session.deviceId
              )
            } catch {
              /*
               * O professor continua a poder trabalhar localmente.
               * A preparação será tentada novamente numa visita futura.
               */
            }

            if (
              cancelled
            ) {
              return
            }

            setError('')

            setStage(
              'ready'
            )

            return
          }

          if (
            local
          ) {
            /*
             * Não existe perfil no servidor.
             *
             * Uma chave local que tenha ficado de uma tentativa
             * interrompida não pode ser reutilizada porque o código
             * de recuperação nunca é guardado.
             */
            await deleteMAProfessorLocalCryptoMaterial(
              session.email,
              session.deviceId
            )
          }

          if (
            cancelled
          ) {
            return
          }

          setError('')

          setStage(
            'setup'
          )

          return
        }

        if (
          syncError
        ) {
          /*
           * Uma falha temporária do serviço não deve impedir o
           * professor de utilizar uma proteção local já válida.
           */
          if (
            local
          ) {
            await unlockMAProfessorLocalMasterKey(
              session.email,
              session.deviceId
            )

            if (
              cancelled
            ) {
              return
            }

            setError('')

            setStage(
              'ready'
            )

            return
          }

          setError(
            syncError
          )

          setStage(
            'service-error'
          )

          return
        }

        setStage(
          'checking'
        )
      } catch (
        inspectionError
      ) {
        if (
          cancelled
        ) {
          return
        }

        setError(
          getErrorMessage(
            inspectionError
          )
        )

        setStage(
          'error'
        )
      }
    }

    void inspectProtection()

    return () => {
      cancelled =
        true
    }
  }, [
    pendingSetup,
    protectionReady,
    retryNonce,
    session.deviceId,
    session.email,
    session.token,
    stage,
    syncChecking,
    syncError,
    syncStatus
  ])

  const handleRetry =
    () => {
      setError('')
      setRecoveredDeviceResult(
        null
      )
      setRecoveryCodeInput('')

      setStage(
        'checking'
      )

      setRetryNonce(
        current =>
          current +
          1
      )

      void refreshSyncStatus()
    }

  const handleCreateProtection =
    async () => {
      if (
        creating ||
        completing ||
        !setupAcknowledged
      ) {
        return
      }

      setCreating(
        true
      )

      setError('')
      setRecoveryAction('')

      try {
        const existing =
          await readMAProfessorLocalCryptoMaterial(
            session.email,
            session.deviceId
          )

        if (
          existing
        ) {
          await deleteMAProfessorLocalCryptoMaterial(
            session.email,
            session.deviceId
          )
        }

        const generated =
          await createAndStoreMAProfessorCryptoMaterial(
            session.email,
            session.deviceId
          )

        /*
         * A chave principal não é colocada no estado React.
         * Mantemos apenas o código que deve ser apresentado e os
         * envelopes já cifrados que podem ser enviados ao Worker.
         */
        setPendingSetup({
          recoveryCode:
            generated.recoveryCode,

          local:
            generated.local
        })

        setRecoverySaved(
          false
        )

        setRecoveryAcknowledged(
          false
        )

        setStage(
          'recovery'
        )
      } catch (
        creationError
      ) {
        setError(
          getErrorMessage(
            creationError
          )
        )

        setStage(
          'setup'
        )
      } finally {
        setCreating(
          false
        )
      }
    }

  const handleCopyRecoveryCode =
    async () => {
      if (
        !pendingSetup
      ) {
        return
      }

      setError('')
      setRecoveryAction('')

      try {
        await copyText(
          pendingSetup
            .recoveryCode
        )

        setRecoverySaved(
          true
        )

        setRecoveryAction(
          'Chave copiada.'
        )
      } catch (
        copyError
      ) {
        setError(
          getErrorMessage(
            copyError
          )
        )
      }
    }

  const handleDownloadRecoveryCode =
    () => {
      if (
        !pendingSetup
      ) {
        return
      }

      setError('')
      setRecoveryAction('')

      try {
        const content = [
          'MA-PROFESSOR',
          'CHAVE DE RECUPERAÇÃO',
          '',
          pendingSetup.recoveryCode,
          '',
          'INFORMAÇÃO IMPORTANTE',
          '',
          'Esta chave permite autorizar outro dispositivo e recuperar a cópia cifrada dos seus dados.',
          'A chave não é guardada pela MA-CODE e não pode ser reconstruída a partir dos elementos armazenados no servidor.',
          'Redefinir a palavra-passe da conta não recupera esta chave nem permite desencriptar a cópia.',
          'Se perder esta chave e deixar de ter acesso a todos os dispositivos autorizados, poderá perder definitivamente o acesso aos dados sincronizados.',
          '',
          'Guarde este ficheiro num local seguro e não partilhe a chave.',
          '',
          `Conta: ${session.email}`
        ].join(
          '\n'
        )

        const blob =
          new Blob(
            [
              content
            ],
            {
              type:
                'text/plain;charset=utf-8'
            }
          )

        const url =
          URL.createObjectURL(
            blob
          )

        const anchor =
          document.createElement(
            'a'
          )

        anchor.href =
          url

        anchor.download =
          'ma-professor-chave-recuperacao.txt'

        document.body.appendChild(
          anchor
        )

        anchor.click()
        anchor.remove()

        URL.revokeObjectURL(
          url
        )

        setRecoverySaved(
          true
        )

        setRecoveryAction(
          'Ficheiro guardado.'
        )
      } catch (
        downloadError
      ) {
        setError(
          getErrorMessage(
            downloadError
          )
        )
      }
    }

  const handleCompleteProtection =
    async () => {
      if (
        !pendingSetup ||
        !recoverySaved ||
        !recoveryAcknowledged ||
        completing
      ) {
        return
      }

      setCompleting(
        true
      )

      setError('')
      setRecoveryAction('')

      try {
        await initializeMAProfessorSync(
          session.token,
          session.deviceId,
          pendingSetup
            .local
            .profile,
          pendingSetup
            .local
            .device
        )

        /*
         * Prepara imediatamente a prova necessária para recuperar
         * esta conta num dispositivo novo.
         *
         * Uma falha temporária aqui não bloqueia a conta: um
         * dispositivo autorizado voltará a tentar automaticamente.
         */
        try {
          await ensureMAProfessorRecoveryVerifier(
            session.token,
            session.email,
            session.deviceId
          )
        } catch {
          // A utilização normal da aplicação continua disponível.
        }

        setProtectionReady(
          true
        )

        setPendingSetup(
          null
        )

        setStage(
          'ready'
        )

        void refreshSyncStatus()
      } catch (
        initializationError
      ) {
        setError(
          getErrorMessage(
            initializationError
          )
        )

        setStage(
          'recovery'
        )
      } finally {
        setCompleting(
          false
        )
      }
    }

  const handleRecoverDevice =
    async () => {
      if (
        recoveringDevice ||
        !recoveryCodeInput
          .trim()
      ) {
        return
      }

      setRecoveringDevice(
        true
      )

      setError('')
      setRecoveredDeviceResult(
        null
      )

      try {
        const result =
          await recoverMAProfessorOnNewDevice(
            session.token,
            session.email,
            session.deviceId,
            recoveryCodeInput
          )

        setRecoveredDeviceResult(
          result
        )

        setRecoveryCodeInput('')

        setStage(
          'recovery-complete'
        )

        await refreshSyncStatus()
      } catch (
        recoveryError
      ) {
        setError(
          getErrorMessage(
            recoveryError
          )
        )

        setStage(
          'remote-existing'
        )
      } finally {
        setRecoveringDevice(
          false
        )
      }
    }

  const handleEnterAfterRecovery =
    () => {
      setProtectionReady(
        true
      )

      setStage(
        'ready'
      )
    }

  if (
    stage ===
      'ready' ||
    protectionReady
  ) {
    return children
  }

  if (
    stage ===
      'checking'
  ) {
    return (
      <LoadingProtection />
    )
  }

  if (
    stage ===
      'setup'
  ) {
    return (
      <ProtectionShell>
        <div className="flex items-start gap-4">
          <ShieldIcon />

          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
              Privacidade
            </p>

            <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
              Os seus dados escolares são só seus
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-300 sm:text-base">
              Organize aulas, turmas e avaliações com tranquilidade. Os seus dados são protegidos no seu dispositivo antes de serem guardados online.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3">
          <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/55 p-4">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-300/10 text-cyan-200">
              ✓
            </span>

            <div>
              <p className="text-sm font-black text-white">
                Protegidos desde o seu dispositivo
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-400 sm:text-sm">
                Nomes de alunos, sumários, faltas e avaliações são protegidos antes de serem guardados online.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/55 p-4">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-300/10 text-violet-200">
              ✓
            </span>

            <div>
              <p className="text-sm font-black text-white">
                Privacidade também na cópia online
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-400 sm:text-sm">
                A MA-CODE não possui a chave necessária para abrir ou consultar os seus dados escolares.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-amber-300/25 bg-amber-300/[0.07]">
          <div className="flex items-start gap-3 p-4">
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="mt-0.5 h-5 w-5 shrink-0 text-amber-200"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle
                cx="12"
                cy="12"
                r="9"
              />

              <path d="M12 11v5" />

              <path d="M12 8h.01" />
            </svg>

            <div>
              <p className="text-sm font-black text-amber-100">
                Guarde a sua chave de recuperação
              </p>

              <p className="mt-1.5 text-xs leading-5 text-amber-100/80 sm:text-sm">
                Vai recebê-la no próximo passo. Guarde-a num local seguro. Sem essa chave e sem acesso a um dispositivo autorizado, poderá perder o acesso aos dados sincronizados.
              </p>
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-3 border-t border-amber-200/15 bg-slate-950/20 p-4 transition hover:bg-slate-950/30">
            <input
              type="checkbox"
              checked={
                setupAcknowledged
              }
              onChange={
                event =>
                  setSetupAcknowledged(
                    event.target
                      .checked
                  )
              }
              disabled={
                creating
              }
              className="mt-0.5 h-5 w-5 shrink-0 rounded border-white/20 bg-slate-950 accent-cyan-300"
            />

            <span className="text-sm leading-6 text-amber-50/90">
              Compreendo que a MA-CODE não guarda nem consegue recuperar a minha chave de recuperação.
            </span>
          </label>
        </div>

        <ErrorMessage
          message={
            error
          }
        />

        <button
          type="button"
          disabled={
            creating ||
            !setupAcknowledged
          }
          onClick={() =>
            void handleCreateProtection()
          }
          className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-300 to-sky-300 px-5 py-4 text-sm font-black text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {creating
            ? 'A preparar a sua proteção…'
            : 'Proteger os meus dados e continuar'}
        </button>

        <button
          type="button"
          disabled={
            creating
          }
          onClick={() =>
            void signOut()
          }
          className="mt-2 w-full rounded-xl px-4 py-2 text-xs font-bold text-slate-500 transition hover:text-white disabled:opacity-50"
        >
          Entrar com outra conta
        </button>

        <p className="mt-3 text-center text-xs leading-5 text-slate-400">
          Este passo demora apenas alguns segundos e não envia dados pedagógicos.
        </p>

        <p className="mt-3 border-t border-white/10 pt-3 text-center text-[11px] leading-5 text-slate-500">
          Ao continuar, confirma que está autorizado a tratar os dados introduzidos. O MA-Professor é uma ferramenta de apoio e não substitui os sistemas oficiais da sua instituição.
        </p>
      </ProtectionShell>
    )
  }

  if (
    stage ===
      'recovery' &&
    pendingSetup
  ) {
    const canComplete =
      recoverySaved &&
      recoveryAcknowledged &&
      !completing

    return (
      <ProtectionShell>
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-300/25 bg-violet-300/10 text-violet-200">
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-7 w-7"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle
                cx="8"
                cy="15"
                r="4"
              />

              <path d="m11 12 8-8" />

              <path d="m15 8 2 2" />

              <path d="m17 6 2 2" />
            </svg>
          </div>

          <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-violet-300">
            Chave de recuperação
          </p>

          <h1 className="mt-2 text-2xl font-black sm:text-3xl">
            Guarde-a antes de continuar
          </h1>

          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-400">
            Esta chave permite autorizar outro dispositivo e recuperar a cópia cifrada. Não é uma palavra-passe e não pode ser reconstruída pela MA-CODE.
          </p>
        </div>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-cyan-300/25 bg-slate-950 p-4 text-center shadow-inner">
          <code className="whitespace-nowrap font-mono text-sm font-black tracking-wider text-cyan-200 sm:text-base">
            {pendingSetup
              .recoveryCode}
          </code>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={
              completing
            }
            onClick={() =>
              void handleCopyRecoveryCode()
            }
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-3 text-sm font-black text-cyan-100 transition hover:bg-cyan-300/15 disabled:opacity-50"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect
                x="9"
                y="9"
                width="11"
                height="11"
                rx="2"
              />

              <path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" />
            </svg>

            Copiar chave
          </button>

          <button
            type="button"
            disabled={
              completing
            }
            onClick={
              handleDownloadRecoveryCode
            }
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-violet-300/25 bg-violet-300/10 px-4 py-3 text-sm font-black text-violet-100 transition hover:bg-violet-300/15 disabled:opacity-50"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3v12" />

              <path d="m7 10 5 5 5-5" />

              <path d="M5 21h14" />
            </svg>

            Guardar ficheiro
          </button>
        </div>

        {recoveryAction ? (
          <p
            role="status"
            className="mt-4 text-center text-sm font-bold text-emerald-300"
          >
            ✓ {recoveryAction}
          </p>
        ) : null}

        <div className="mt-5 rounded-2xl border border-amber-300/25 bg-amber-300/[0.07] p-4">
          <p className="text-sm font-black text-amber-100">
            Consequência da perda da chave
          </p>

          <p className="mt-2 text-xs leading-6 text-amber-100/80">
            Redefinir a palavra-passe da conta não recupera esta chave. Sem a chave e sem acesso a um dispositivo já autorizado, a cópia cifrada poderá ficar definitivamente inacessível.
          </p>
        </div>

        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/55 p-4 transition hover:border-white/20">
          <input
            type="checkbox"
            checked={
              recoveryAcknowledged
            }
            onChange={
              event =>
                setRecoveryAcknowledged(
                  event.target
                    .checked
                )
            }
            disabled={
              completing
            }
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-slate-950 text-cyan-300 accent-cyan-300"
          />

          <span className="text-xs leading-5 text-slate-300">
            Confirmo que guardei a chave de recuperação num local seguro e compreendo que a MA-CODE não a poderá recuperar por mim.
          </span>
        </label>

        <ErrorMessage
          message={
            error
          }
        />

        <button
          type="button"
          disabled={
            !canComplete
          }
          onClick={() =>
            void handleCompleteProtection()
          }
          className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-300 to-sky-300 px-5 py-4 text-sm font-black text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {completing
            ? 'A ativar proteção…'
            : !recoverySaved
              ? 'Copie ou guarde a chave primeiro'
              : !recoveryAcknowledged
                ? 'Confirme que guardou a chave'
                : 'Ativar proteção e continuar'}
        </button>

        <p className="mt-4 text-center text-xs leading-5 text-slate-500">
          Recomenda-se guardar a chave fora deste dispositivo.
        </p>
      </ProtectionShell>
    )
  }

  if (
    stage ===
      'remote-existing'
  ) {
    return (
      <ProtectionShell>
        <div className="flex items-start gap-4">
          <ShieldIcon />

          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">
              Novo dispositivo
            </p>

            <h1 className="mt-2 text-2xl font-black sm:text-3xl">
              Recupere os seus dados
            </h1>

            <p className="mt-3 text-sm leading-7 text-slate-400">
              Esta conta já está protegida. Introduza a chave de recuperação que guardou quando ativou o MA-Professor.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-violet-300/20 bg-violet-300/[0.05] p-4">
          <p className="text-sm font-black text-violet-100">
            A sua chave fica neste dispositivo
          </p>

          <p className="mt-2 text-xs leading-5 text-slate-400">
            A chave é usada no browser para recuperar a proteção da conta. A chave de recuperação não é enviada para a MA-CODE.
          </p>
        </div>

        <label className="mt-5 block">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
            Chave de recuperação
          </span>

          <input
            type="text"
            value={
              recoveryCodeInput
            }
            onChange={
              event =>
                setRecoveryCodeInput(
                  event.target
                    .value
                )
            }
            onKeyDown={
              event => {
                if (
                  event.key ===
                    'Enter' &&
                  recoveryCodeInput
                    .trim() &&
                  !recoveringDevice
                ) {
                  event.preventDefault()

                  void handleRecoverDevice()
                }
              }
            }
            disabled={
              recoveringDevice
            }
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="MA-PROF-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3.5 font-mono text-sm font-bold tracking-wide text-white outline-none transition placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-600 focus:border-violet-300/50 disabled:cursor-wait disabled:opacity-60"
          />
        </label>

        <ErrorMessage
          message={
            error
          }
        />

        <button
          type="button"
          disabled={
            recoveringDevice ||
            !recoveryCodeInput
              .trim()
          }
          onClick={() =>
            void handleRecoverDevice()
          }
          className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-violet-300 to-cyan-300 px-5 py-4 text-sm font-black text-slate-950 shadow-lg shadow-violet-950/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {recoveringDevice
            ? 'A verificar a chave e recuperar…'
            : 'Recuperar neste dispositivo'}
        </button>

        <button
          type="button"
          disabled={
            recoveringDevice
          }
          onClick={() =>
            void signOut()
          }
          className="mt-3 w-full rounded-xl px-4 py-2 text-xs font-bold text-slate-500 transition hover:text-white disabled:opacity-50"
        >
          Entrar com outra conta
        </button>

        <p className="mt-4 text-center text-xs leading-5 text-slate-500">
          Nenhum dado local é substituído sem uma verificação prévia.
        </p>
      </ProtectionShell>
    )
  }

  if (
    stage ===
      'recovery-complete' &&
    recoveredDeviceResult
  ) {
    const needsAttention =
      recoveredDeviceResult
        .dataStatus ===
        'manual-restore-required' ||
      recoveredDeviceResult
        .dataStatus ===
        'restore-deferred'

    return (
      <ProtectionShell>
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-300/25 bg-emerald-300/10 text-emerald-200">
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-7 w-7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle
                cx="12"
                cy="12"
                r="9"
              />

              <path d="m8 12 2.5 2.5L16 9" />
            </svg>
          </div>

          <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
            Dispositivo autorizado
          </p>

          <h1 className="mt-2 text-2xl font-black sm:text-3xl">
            {recoveredDeviceResult
              .dataStatus ===
              'restored'
              ? 'Os seus dados estão de volta'
              : 'Este dispositivo está pronto'}
          </h1>

          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-400">
            A sua chave de recuperação foi validada neste dispositivo sem ser enviada para a MA-CODE.
          </p>
        </div>

        <RecoveryResultCard
          result={
            recoveredDeviceResult
          }
        />

        {needsAttention ? (
          <div className="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.05] p-4">
            <p className="text-sm font-black text-cyan-100">
              Os dados existentes foram preservados
            </p>

            <p className="mt-2 text-xs leading-5 text-slate-400">
              Entre no MA-Professor e abra Definições → Dados e cópias para comparar e escolher a versão que pretende manter.
            </p>
          </div>
        ) : null}

        <button
          type="button"
          onClick={
            handleEnterAfterRecovery
          }
          className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-300 to-sky-300 px-5 py-4 text-sm font-black text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:brightness-110"
        >
          Entrar no MA-Professor
        </button>

        <p className="mt-4 text-center text-xs leading-5 text-slate-500">
          Este dispositivo passa a ter a sua própria chave local protegida.
        </p>
      </ProtectionShell>
    )
  }

  return (
    <ProtectionShell>
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-300/25 bg-rose-300/10 text-2xl font-black text-rose-200">
        !
      </div>

      <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-rose-300">
        Proteção indisponível
      </p>

      <h1 className="mt-2 text-2xl font-black">
        Não foi possível preparar a conta
      </h1>

      <p className="mt-3 text-sm leading-7 text-slate-400">
        Os seus dados locais não foram eliminados. Verifique a ligação e tente novamente.
      </p>

      <ErrorMessage
        message={
          error
        }
      />

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={
            handleRetry
          }
          className="flex-1 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950"
        >
          Tentar novamente
        </button>

        <button
          type="button"
          onClick={() =>
            void signOut()
          }
          className="flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-white"
        >
          Usar outra conta
        </button>
      </div>
    </ProtectionShell>
  )
}

export default CryptoSetupGate
