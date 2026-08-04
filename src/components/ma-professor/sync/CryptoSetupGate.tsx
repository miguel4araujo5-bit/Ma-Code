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

type ProtectionStage =
  | 'checking'
  | 'setup'
  | 'recovery'
  | 'ready'
  | 'remote-existing'
  | 'service-error'
  | 'error'

interface PendingCryptoSetup {
  recoveryCode: string
  local: MAProfessorLocalCryptoMaterial
}

function getErrorMessage(
  error: unknown
) {
  return error instanceof Error &&
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

  textarea.value = value

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
      .writeText === 'function'
  ) {
    await navigator.clipboard.writeText(
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
  children: ReactNode
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

export function CryptoSetupGate({
  children
}: {
  children: ReactNode
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
    let cancelled = false

    if (
      pendingSetup ||
      protectionReady
    ) {
      return () => {
        cancelled = true
      }
    }

    async function inspectProtection() {
      if (syncChecking) {
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

        if (cancelled) {
          return
        }

        if (syncStatus) {
          if (
            syncStatus.profileExists
          ) {
            if (!local) {
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

            if (cancelled) {
              return
            }

            setError('')

            setStage(
              'ready'
            )

            return
          }

          if (local) {
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

          if (cancelled) {
            return
          }

          setError('')

          setStage(
            'setup'
          )

          return
        }

        if (syncError) {
          /*
           * Uma falha temporária do serviço não deve impedir o
           * professor de utilizar uma proteção local já válida.
           */
          if (local) {
            await unlockMAProfessorLocalMasterKey(
              session.email,
              session.deviceId
            )

            if (cancelled) {
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
        if (cancelled) {
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
      cancelled = true
    }
  }, [
    pendingSetup,
    protectionReady,
    retryNonce,
    session.deviceId,
    session.email,
    syncChecking,
    syncError,
    syncStatus
  ])

  const handleRetry =
    () => {
      setError('')

      setStage(
        'checking'
      )

      setRetryNonce(
        current =>
          current + 1
      )

      void refreshSyncStatus()
    }

  const handleCreateProtection =
    async () => {
      if (
        creating ||
        completing
      ) {
        return
      }

      setCreating(true)
      setError('')
      setRecoveryAction('')

      try {
        const existing =
          await readMAProfessorLocalCryptoMaterial(
            session.email,
            session.deviceId
          )

        if (existing) {
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
        setCreating(false)
      }
    }

  const handleCopyRecoveryCode =
    async () => {
      if (!pendingSetup) {
        return
      }

      setError('')
      setRecoveryAction('')

      try {
        await copyText(
          pendingSetup.recoveryCode
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
      if (!pendingSetup) {
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
          'Esta chave é diferente da palavra-passe da sua conta.',
          'A MA-CODE não guarda esta chave de recuperação e não conseguirá recuperá-la ou criá-la novamente por si.',
          'Se perder a chave e deixar de ter acesso a todos os dispositivos autorizados, poderá perder o acesso aos dados sincronizados.',
          '',
          'Guarde este ficheiro num local seguro e não partilhe a chave de recuperação.',
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

        anchor.href = url

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

      setCompleting(true)
      setError('')
      setRecoveryAction('')

      try {
        await initializeMAProfessorSync(
          session.token,
          session.deviceId,
          pendingSetup.local.profile,
          pendingSetup.local.device
        )

        /*
         * Impede que o efeito interprete o estado antigo de /status
         * como um perfil ainda inexistente enquanto a atualização do
         * contexto está a decorrer.
         */
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
        setCompleting(false)
      }
    }

  if (
    stage === 'ready' ||
    protectionReady
  ) {
    return children
  }

  if (
    stage === 'checking'
  ) {
    return (
      <LoadingProtection />
    )
  }

  if (
    stage === 'setup'
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
              Organize aulas, turmas e avaliações com tranquilidade. Antes de serem guardados online, os seus dados são protegidos no seu dispositivo.
            </p>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/55">
          <div className="flex items-start gap-4 border-b border-white/10 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-300/10 text-sm font-black text-cyan-200">
              1
            </span>

            <div>
              <p className="text-sm font-black text-white">
                Protegidos antes do envio
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-400 sm:text-sm">
                Nomes de alunos, sumários, faltas e avaliações são protegidos antes de saírem do seu telemóvel ou computador.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 border-b border-white/10 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-300/10 text-sm font-black text-violet-200">
              2
            </span>

            <div>
              <p className="text-sm font-black text-white">
                Privados também online
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-400 sm:text-sm">
                A MA-CODE não recebe nomes, sumários, faltas ou avaliações em formato legível.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-300/10 text-sm font-black text-emerald-200">
              3
            </span>

            <div>
              <p className="text-sm font-black text-white">
                A chave fica consigo
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-400 sm:text-sm">
                No próximo passo receberá uma chave única, necessária para recuperar a sua cópia noutro dispositivo.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-amber-300/25 bg-amber-300/[0.07] p-4">
          <div className="flex items-start gap-3">
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
                Importante: guarde a sua chave de recuperação
              </p>

              <p className="mt-1.5 text-xs leading-5 text-amber-100/80 sm:text-sm">
                No próximo passo vai receber uma chave única. Guarde-a num local seguro: a MA-CODE não a guarda e não poderá recuperá-la por si.
              </p>

              <p className="mt-2 text-xs leading-5 text-amber-100/80 sm:text-sm">
                Se a perder e deixar de ter acesso a todos os dispositivos autorizados, poderá perder o acesso aos dados sincronizados.
              </p>
            </div>
          </div>
        </div>

        <ErrorMessage
          message={error}
        />

        <button
          type="button"
          disabled={creating}
          onClick={() =>
            void handleCreateProtection()
          }
          className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-300 to-sky-300 px-5 py-4 text-sm font-black text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
        >
          {creating
            ? 'A preparar a sua proteção…'
            : 'Proteger os meus dados e continuar'}
        </button>

        <button
          type="button"
          disabled={creating}
          onClick={() =>
            void signOut()
          }
          className="mt-2 w-full rounded-xl px-4 py-2 text-xs font-bold text-slate-500 transition hover:text-white disabled:opacity-50"
        >
          Entrar com outra conta
        </button>

        <p className="mt-3 text-center text-xs leading-5 text-slate-500">
          Este passo demora apenas alguns segundos e não envia dados pedagógicos.
        </p>

        <p className="mt-3 border-t border-white/10 pt-3 text-center text-[11px] leading-5 text-slate-600">
          Ao continuar, confirma que utiliza apenas dados que está autorizado a tratar. O MA-Professor é uma ferramenta de apoio e não substitui os sistemas oficiais da sua instituição.
        </p>
      </ProtectionShell>
    )
  }

  if (
    stage === 'recovery' &&
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
            Esta chave é necessária para recuperar a sua cópia protegida noutro dispositivo. É diferente da palavra-passe da conta: a MA-CODE não a guarda e não consegue criá-la novamente.
          </p>
        </div>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-cyan-300/25 bg-slate-950 p-4 text-center shadow-inner">
          <code className="whitespace-nowrap font-mono text-sm font-black tracking-wider text-cyan-200 sm:text-base">
            {pendingSetup.recoveryCode}
          </code>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={completing}
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
            disabled={completing}
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
            Importante
          </p>

          <p className="mt-2 text-xs leading-6 text-amber-100/80">
            A palavra-passe da conta pode ser redefinida. Esta chave de recuperação não. Sem a chave e sem acesso a um dispositivo já autorizado, os dados sincronizados poderão ficar inacessíveis.
          </p>
        </div>

        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/55 p-4 transition hover:border-white/20">
          <input
            type="checkbox"
            checked={
              recoveryAcknowledged
            }
            onChange={event =>
              setRecoveryAcknowledged(
                event.target.checked
              )
            }
            disabled={completing}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-slate-950 text-cyan-300 accent-cyan-300"
          />

          <span className="text-xs leading-5 text-slate-300">
            Compreendo que a MA-CODE não guarda a minha chave de recuperação e não poderá recuperá-la por mim. Se a perder e deixar de ter acesso a todos os dispositivos autorizados, poderei perder o acesso aos dados sincronizados.
          </span>
        </label>

        <ErrorMessage
          message={error}
        />

        <button
          type="button"
          disabled={!canComplete}
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
                ? 'Assinale a confirmação para continuar'
                : 'Ativar proteção e continuar'}
        </button>

        <p className="mt-4 text-center text-xs leading-5 text-slate-500">
          Recomenda-se guardar a chave fora deste dispositivo.
        </p>
      </ProtectionShell>
    )
  }

  if (
    stage === 'remote-existing'
  ) {
    return (
      <ProtectionShell>
        <ShieldIcon />

        <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-violet-300">
          Dispositivo novo
        </p>

        <h1 className="mt-2 text-2xl font-black">
          Esta conta já está protegida
        </h1>

        <p className="mt-3 text-sm leading-7 text-slate-400">
          Este dispositivo ainda não possui a chave necessária para abrir os dados cifrados. A autorização através da chave de recuperação será adicionada antes da disponibilização da sincronização na versão beta.
        </p>

        <p className="mt-4 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.06] p-4 text-sm leading-6 text-emerald-100">
          Nenhum dado existente foi eliminado ou substituído.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={
              handleRetry
            }
            className="flex-1 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950"
          >
            Verificar novamente
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
        message={error}
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
