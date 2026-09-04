import {
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import {
  activateMAProfessorAccessPeriod
} from './accessApi'

import {
  getOrCreateMAProfessorDeviceId,
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
  children
}: {
  children: ReactNode
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

  const started =
    useRef(false)

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

      const stored =
        readMAProfessorStoredAccess()

      if (
        stored &&
        stored.email
          .trim()
          .toLowerCase() ===
          activationLink.email &&
        isLicenseUsable(
          stored.license
        )
      ) {
        setState('idle')
        return
      }

      try {
        const deviceId =
          getOrCreateMAProfessorDeviceId()

        const response =
          await activateMAProfessorAccessPeriod(
            activationLink.email,
            activationLink.activationPassword,
            deviceId
          )

        if (!response.license) {
          throw new Error(
            'A ativação foi concluída sem uma licença válida. Contacte a MA-CODE.'
          )
        }

        saveMAProfessorStoredAccess({
          token:
            response.token,
          email:
            (
              response.email ||
              response.license.email ||
              activationLink.email
            )
              .trim()
              .toLowerCase(),
          deviceId,
          license:
            response.license,
          checkedAt:
            new Date()
              .toISOString()
        })

        setState('idle')
      } catch (
        activationError
      ) {
        started.current =
          false
        setError(
          getErrorMessage(
            activationError
          )
        )
        setState('failed')
      }
    }

  useEffect(
    () => {
      if (!activationLink) {
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
    // activationLink é calculado uma única vez a partir do URL inicial.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activationLink])

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
                Estamos a validar a senha recebida por email e a iniciar o seu período de acesso.
              </p>
            </>
          ) : (
            <>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-300">
                Não foi possível ativar automaticamente
              </p>
              <h1 className="mt-3 text-2xl font-black tracking-tight text-white">
                O link foi reconhecido, mas a ativação falhou.
              </h1>
              <p className="mt-3 text-sm leading-7 text-slate-400">
                {error}
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
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
