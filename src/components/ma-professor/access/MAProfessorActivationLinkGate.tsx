import {
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import {
  activateMAProfessorAccessLink,
  MAProfessorAccessApiError
} from './accessApi'

import {
  readMAProfessorStoredAccess,
  saveMAProfessorStoredAccess
} from './accessStorage'

import {
  isLicenseUsable
} from './accessTypes'

import {
  getMAProfessorUrlWithoutActivationData,
  readMAProfessorActivationLink
} from './activationLink'

function getErrorMessage(
  error: unknown
) {
  return error instanceof Error &&
    error.message.trim()
    ? error.message
    : 'Não foi possível ativar o acesso automaticamente.'
}

export default function MAProfessorActivationLinkGate({
  children,
  onLoginRequested
}: {
  children: ReactNode
  onLoginRequested?: (email: string) => void
}) {
  const activationLink =
    useMemo(
      () =>
        typeof window === 'undefined'
          ? null
          : readMAProfessorActivationLink(
              window.location.href
            ),
      []
    )

  const [
    state,
    setState
  ] = useState<
    | 'idle'
    | 'activating'
    | 'activated'
    | 'failed'
  >(
    activationLink
      ? 'activating'
      : 'idle'
  )

  const [
    error,
    setError
  ] = useState('')

  const [activationConflict, setActivationConflict] = useState(false)

  const started =
    useRef(false)

  const storedAccess = readMAProfessorStoredAccess()
  const hasMatchingSession = Boolean(
    activationLink && storedAccess &&
    storedAccess.email.trim().toLowerCase() === activationLink.email
  )

  const continueToAccount = () => {
    const stored = readMAProfessorStoredAccess()
    if (
      activationLink &&
      (!stored || stored.email.trim().toLowerCase() !== activationLink.email)
    ) {
      onLoginRequested?.(activationLink.email)
    }
    setState('idle')
  }

  const activate =
    async () => {
      if (
        !activationLink ||
        started.current
      ) {
        return
      }

      started.current =
        true

      setState('activating')
      setError('')
      setActivationConflict(false)

      try {
        const response =
          await activateMAProfessorAccessLink(
            activationLink.email,
            activationLink.activationPassword
          )

        if (!isLicenseUsable(response.license)) {
          throw new Error(
            'A ativação foi concluída sem uma licença válida. Contacte a MA-CODE.'
          )
        }

        const stored = readMAProfessorStoredAccess()

        if (
          stored &&
          stored.email.trim().toLowerCase() === activationLink.email
        ) {
          saveMAProfessorStoredAccess({
            ...stored,
            license: response.license,
            checkedAt: new Date().toISOString()
          })
        }

        setState('activated')
      } catch (
        activationError
      ) {
        started.current =
          false
        const conflict = activationError instanceof MAProfessorAccessApiError &&
          activationError.status === 409
        setActivationConflict(conflict)
        setError(
          conflict
            ? 'Se já ativou este acesso, entre com o seu email e a sua password.'
            : getErrorMessage(activationError)
        )
        setState('failed')
      }
    }

  useEffect(
    () => {
      if (
        !activationLink
      ) {
        return
      }

      const cleanUrl =
        getMAProfessorUrlWithoutActivationData(
          window.location.href
        )

      window.history.replaceState(
        window.history.state,
        '',
        cleanUrl
      )

      void activate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      activationLink
    ])

  if (
    !activationLink ||
    state === 'idle'
  ) {
    return <>{children}</>
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white sm:px-6">
      <section className="w-full max-w-xl overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/95 shadow-2xl shadow-cyan-950/30">
        <div className="h-1.5 bg-gradient-to-r from-cyan-300 via-sky-300 to-violet-300" />

        <div className="p-6 text-center sm:p-9">
          {state === 'activating' ? (
            <>
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-cyan-300/20 border-t-cyan-300" />
              <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
                A ativar acesso
              </p>
              <h1 className="mt-3 text-2xl font-black tracking-tight text-white">
                Só um momento…
              </h1>
              <p className="mt-3 text-sm leading-7 text-slate-400">
                Estamos a validar o código recebido por email e a ativar o acesso da sua conta.
              </p>
            </>
          ) : state === 'activated' ? (
            <>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
                MA-Professor
              </p>
              <h1 className="mt-3 text-2xl font-black tracking-tight text-white">
                Acesso ativado
              </h1>
              <p className="mt-3 text-sm leading-7 text-slate-400">
                O acesso da sua conta está ativo. Pode entrar no MA-Professor com o seu email e a password que definiu na inscrição.
              </p>
              <button
                type="button"
                onClick={continueToAccount}
                className="mt-6 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200"
              >
                {hasMatchingSession ? 'Abrir o MA-Professor' : 'Entrar'}
              </button>
            </>
          ) : (
            <>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-300">
                {activationConflict ? 'MA-Professor' : 'Não foi possível ativar automaticamente'}
              </p>
              <h1 className="mt-3 text-2xl font-black tracking-tight text-white">
                {activationConflict
                  ? 'Não foi possível confirmar a ativação.'
                  : 'O link foi reconhecido, mas a ativação falhou.'}
              </h1>
              <p className="mt-3 text-sm leading-7 text-slate-400">
                {error}
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                {activationConflict ? (
                  <button
                    type="button"
                    onClick={continueToAccount}
                    className="rounded-xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200"
                  >
                    {hasMatchingSession ? 'Abrir o MA-Professor' : 'Entrar'}
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => {
                    void activate()
                  }}
                  className="rounded-xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200"
                >
                  Tentar novamente
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setState('idle')
                  }
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-slate-200 transition hover:bg-white/[0.08]"
                >
                  Continuar para ativação manual
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
