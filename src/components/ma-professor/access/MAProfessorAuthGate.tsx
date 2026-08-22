import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState
} from 'react'

import ProductIntroPanel from './ProductIntroPanel'

import {
  activateMAProfessorAccessPeriod,
  loginMAProfessorAccess,
  requestMAProfessorAccess
} from './accessApi'

import {
  MA_PROFESSOR_ACCESS_SESSION_EVENT,
  clearMAProfessorStoredAccess,
  getOrCreateMAProfessorDeviceId,
  readMAProfessorStoredAccess,
  saveMAProfessorStoredAccess
} from './accessStorage'

import type {
  LicenseSummary
} from '../types'

type Mode =
  | 'intro'
  | 'request'
  | 'request-sent'
  | 'login'
  | 'activate'

interface MAProfessorAuthGateProps {
  children:
    ReactNode
}

function getErrorMessage(
  error: unknown
) {
  return error instanceof
      Error &&
    error.message.trim()
    ? error.message
    : 'Não foi possível concluir a operação.'
}

function getInitialMode(): Mode {
  if (
    typeof window ===
    'undefined'
  ) {
    return 'intro'
  }

  const params =
    new URLSearchParams(
      window.location.search
    )

  return params.get(
    'acesso'
  ) === 'ativar'
    ? 'activate'
    : 'intro'
}

function clearActivationDeepLink() {
  if (
    typeof window ===
    'undefined'
  ) {
    return
  }

  const url =
    new URL(
      window.location.href
    )

  if (
    !url.searchParams.has(
      'acesso'
    )
  ) {
    return
  }

  url.searchParams.delete(
    'acesso'
  )

  window.history.replaceState(
    window.history.state,
    '',
    `${url.pathname}${url.search}${url.hash}`
  )
}

function Shell({
  children
}: {
  children:
    ReactNode
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white sm:px-6">
      <section className="w-full max-w-xl overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/95 shadow-2xl shadow-cyan-950/30">
        <div className="h-1.5 bg-gradient-to-r from-cyan-300 via-sky-300 to-violet-300" />

        <div className="p-6 sm:p-9">
          {children}
        </div>
      </section>
    </main>
  )
}

function saveResponse(
  response: {
    token: string
    license:
      LicenseSummary
  },
  deviceId: string
) {
  saveMAProfessorStoredAccess({
    token:
      response.token,
    email:
      response.license.email,
    deviceId,
    license:
      response.license
  })
}

export default function MAProfessorAuthGate({
  children
}: MAProfessorAuthGateProps) {
  const [
    storedAccess,
    setStoredAccess
  ] = useState(
    () =>
      readMAProfessorStoredAccess()
  )

  const [
    mode,
    setMode
  ] =
    useState<Mode>(
      getInitialMode
    )

  const [
    email,
    setEmail
  ] =
    useState('')

  const [
    personalPassword,
    setPersonalPassword
  ] =
    useState('')

  const [
    personalPasswordConfirm,
    setPersonalPasswordConfirm
  ] =
    useState('')

  const [
    activationPassword,
    setActivationPassword
  ] =
    useState('')

  const [
    message,
    setMessage
  ] =
    useState('')

  const [
    error,
    setError
  ] =
    useState('')

  const [
    busy,
    setBusy
  ] =
    useState(false)

  const normalizedEmail =
    useMemo(
      () =>
        email
          .trim()
          .toLowerCase(),
      [email]
    )

  useEffect(
    () => {
      const refresh =
        () => {
          setStoredAccess(
            readMAProfessorStoredAccess()
          )
        }

      window.addEventListener(
        MA_PROFESSOR_ACCESS_SESSION_EVENT,
        refresh
      )

      window.addEventListener(
        'storage',
        refresh
      )

      return () => {
        window.removeEventListener(
          MA_PROFESSOR_ACCESS_SESSION_EVENT,
          refresh
        )

        window.removeEventListener(
          'storage',
          refresh
        )
      }
    },
    []
  )

  if (
    storedAccess &&
    mode !==
      'activate'
  ) {
    return (
      <>
        {children}
      </>
    )
  }

  const resetFeedback =
    () => {
      setError('')
      setMessage('')
    }

  const goLogin =
    () => {
      resetFeedback()
      clearActivationDeepLink()
      setActivationPassword('')
      setPersonalPassword('')
      setPersonalPasswordConfirm('')
      setMode('login')
    }

  const goActivate =
    () => {
      resetFeedback()
      setPersonalPassword('')
      setPersonalPasswordConfirm('')
      setMode('activate')
    }

  const handleRequest =
    async (
      event:
        FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault()

      resetFeedback()

      if (
        !normalizedEmail
      ) {
        setError(
          'Introduza o seu email.'
        )

        return
      }

      if (
        personalPassword.length <
          6 ||
        personalPassword.length >
          128
      ) {
        setError(
          'A password pessoal deve ter entre 6 e 128 caracteres.'
        )

        return
      }

      if (
        personalPassword !==
        personalPasswordConfirm
      ) {
        setError(
          'As duas passwords pessoais não coincidem.'
        )

        return
      }

      setBusy(true)

      try {
        const response =
          await requestMAProfessorAccess(
            normalizedEmail,
            personalPassword
          )

        setPersonalPassword('')
        setPersonalPasswordConfirm('')

        if (
          response.canActivate
        ) {
          setMessage(
            response.message ||
            'O seu pedido já está aprovado. Utilize agora a senha de ativação recebida.'
          )

          setMode(
            'activate'
          )

          return
        }

        setMessage(
          response.message ||
          'Pedido recebido.'
        )

        setMode(
          'request-sent'
        )
      } catch (
        requestError
      ) {
        setError(
          getErrorMessage(
            requestError
          )
        )
      } finally {
        setBusy(false)
      }
    }

  const handleLogin =
    async (
      event:
        FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault()

      resetFeedback()

      if (
        !normalizedEmail ||
        !personalPassword
      ) {
        setError(
          'Introduza o email e a sua password pessoal.'
        )

        return
      }

      setBusy(true)

      try {
        const deviceId =
          getOrCreateMAProfessorDeviceId()

        const response =
          await loginMAProfessorAccess(
            normalizedEmail,
            personalPassword,
            deviceId
          )

        saveResponse(
          response,
          deviceId
        )

        setStoredAccess(
          readMAProfessorStoredAccess()
        )
      } catch (
        loginError
      ) {
        clearMAProfessorStoredAccess()

        setError(
          getErrorMessage(
            loginError
          )
        )
      } finally {
        setBusy(false)
      }
    }

  const handleActivation =
    async (
      event:
        FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault()

      resetFeedback()

      if (
        !normalizedEmail
      ) {
        setError(
          'Introduza o seu email.'
        )

        return
      }

      if (
        !activationPassword
          .trim()
      ) {
        setError(
          'Introduza a senha de ativação recebida.'
        )

        return
      }

      setBusy(true)

      try {
        const deviceId =
          getOrCreateMAProfessorDeviceId()

        const response =
          await activateMAProfessorAccessPeriod(
            normalizedEmail,
            activationPassword.trim(),
            deviceId
          )

        clearActivationDeepLink()

        setMode(
          'intro'
        )

        saveResponse(
          response,
          deviceId
        )

        setStoredAccess(
          readMAProfessorStoredAccess()
        )
      } catch (
        activationError
      ) {
        setError(
          getErrorMessage(
            activationError
          )
        )
      } finally {
        setBusy(false)
      }
    }

  if (
    mode ===
    'intro'
  ) {
    return (
      <ProductIntroPanel
        onRequestAccess={() => {
          resetFeedback()
          clearActivationDeepLink()
          setActivationPassword('')
          setPersonalPassword('')
          setPersonalPasswordConfirm('')
          setMode('request')
        }}
        onExistingAccess={
          goLogin
        }
      />
    )
  }

  return (
    <Shell>
      <button
        type="button"
        onClick={() => {
          resetFeedback()
          clearActivationDeepLink()
          setActivationPassword('')
          setPersonalPassword('')
          setPersonalPasswordConfirm('')
          setMode('intro')
        }}
        className="mb-6 text-xs font-black uppercase tracking-[0.14em] text-slate-400 transition hover:text-white"
      >
        ← Voltar
      </button>

      {mode ===
      'request' ? (
        <>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
            Fase piloto
          </p>

          <h1 className="mt-3 text-2xl font-black tracking-tight text-white">
            Pedir acesso
          </h1>

          <p className="mt-3 text-sm leading-7 text-slate-300">
            Introduza o seu email e defina agora a password pessoal que irá guardar para entrar no MA-Professor.
          </p>

          <form
            onSubmit={
              handleRequest
            }
            className="mt-6 space-y-4"
          >
            <label className="block">
              <span className="text-xs font-bold text-slate-300">
                Email
              </span>

              <input
                type="email"
                value={email}
                onChange={
                  event =>
                    setEmail(
                      event
                        .target
                        .value
                    )
                }
                autoComplete="email"
                required
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold text-slate-300">
                Criar password pessoal
              </span>

              <input
                type="password"
                value={
                  personalPassword
                }
                onChange={
                  event =>
                    setPersonalPassword(
                      event
                        .target
                        .value
                    )
                }
                autoComplete="new-password"
                minLength={6}
                maxLength={128}
                required
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold text-slate-300">
                Confirmar password pessoal
              </span>

              <input
                type="password"
                value={
                  personalPasswordConfirm
                }
                onChange={
                  event =>
                    setPersonalPasswordConfirm(
                      event
                        .target
                        .value
                    )
                }
                autoComplete="new-password"
                minLength={6}
                maxLength={128}
                required
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
              />
            </label>

            <p className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] px-4 py-3 text-xs leading-6 text-cyan-100">
              <strong>
                Esta é a sua password pessoal.
              </strong>{' '}
              Guarde-a: será usada sempre que entrar no MA-Professor. A senha de ativação que começa por <strong>MP-</strong> é diferente e só será enviada após aprovação.
            </p>

            {error ? (
              <p className="rounded-xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy
                ? 'A enviar...'
                : 'Pedir acesso'}
            </button>
          </form>
        </>
      ) : null}

      {mode ===
      'request-sent' ? (
        <>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
            Pedido recebido
          </p>

          <h1 className="mt-3 text-2xl font-black tracking-tight text-white">
            O pedido foi registado
          </h1>

          <p className="mt-4 text-sm leading-7 text-slate-300">
            {message}
          </p>

          <button
            type="button"
            onClick={
              goLogin
            }
            className="mt-6 w-full rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/5"
          >
            Já tenho acesso
          </button>
        </>
      ) : null}

      {mode ===
      'login' ? (
        <>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
            Entrar
          </p>

          <h1 className="mt-3 text-2xl font-black tracking-tight text-white">
            Aceder ao MA-Professor
          </h1>

          <p className="mt-3 text-sm leading-7 text-slate-300">
            Entre com o seu email e a password pessoal que definiu.
          </p>

          <p className="mt-3 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.06] px-4 py-3 text-xs leading-6 text-cyan-100">
            A senha que começa por <strong>MP-</strong> não é utilizada para entrar. Serve apenas para ativar um período de acesso.
          </p>

          <form
            onSubmit={
              handleLogin
            }
            className="mt-6 space-y-4"
          >
            <label className="block">
              <span className="text-xs font-bold text-slate-300">
                Email
              </span>

              <input
                type="email"
                value={email}
                onChange={
                  event =>
                    setEmail(
                      event
                        .target
                        .value
                    )
                }
                autoComplete="email"
                required
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold text-slate-300">
                Password pessoal
              </span>

              <input
                type="password"
                value={
                  personalPassword
                }
                onChange={
                  event =>
                    setPersonalPassword(
                      event
                        .target
                        .value
                    )
                }
                autoComplete="current-password"
                required
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
              />
            </label>

            {error ? (
              <p className="rounded-xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy
                ? 'A entrar...'
                : 'Entrar'}
            </button>
          </form>

          <button
            type="button"
            onClick={
              goActivate
            }
            className="mt-4 w-full rounded-xl border border-violet-300/20 bg-violet-300/[0.05] px-4 py-3 text-sm font-black text-violet-200 transition hover:bg-violet-300/10"
          >
            Tenho uma senha de ativação
          </button>
        </>
      ) : null}

      {mode ===
      'activate' ? (
        <>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">
            Ativação
          </p>

          <h1 className="mt-3 text-2xl font-black tracking-tight text-white">
            Ativar acesso
          </h1>

          <p className="mt-3 text-sm leading-7 text-slate-300">
            Utilize aqui a senha de ativação <strong>MP-...</strong> recebida da MA-CODE.
          </p>

          <p className="mt-3 rounded-xl border border-violet-300/15 bg-violet-300/[0.06] px-4 py-3 text-xs leading-6 text-violet-100">
            A sua <strong>password pessoal já foi definida quando submeteu o pedido de acesso</strong>. Aqui só precisa do email e da senha de ativação.
          </p>

          <form
            onSubmit={
              handleActivation
            }
            className="mt-6 space-y-4"
          >
            <label className="block">
              <span className="text-xs font-bold text-slate-300">
                Email
              </span>

              <input
                type="email"
                value={email}
                onChange={
                  event =>
                    setEmail(
                      event
                        .target
                        .value
                    )
                }
                autoComplete="email"
                required
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-violet-300/50"
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold text-slate-300">
                Senha de ativação
              </span>

              <input
                type="text"
                value={
                  activationPassword
                }
                onChange={
                  event =>
                    setActivationPassword(
                      event
                        .target
                        .value
                        .toUpperCase()
                    )
                }
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="MP-XXXX-XXXX-XXXX-XXXX"
                required
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 font-mono text-sm uppercase tracking-wide text-white outline-none transition focus:border-violet-300/50"
              />
            </label>

            {message ? (
              <p className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-100">
                {message}
              </p>
            ) : null}

            {error ? (
              <p className="rounded-xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-violet-300 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-violet-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy
                ? 'A ativar...'
                : 'Ativar acesso'}
            </button>
          </form>

          <button
            type="button"
            onClick={
              goLogin
            }
            className="mt-4 w-full rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-slate-300 transition hover:bg-white/5 hover:text-white"
          >
            Já ativei — entrar com a minha password
          </button>
        </>
      ) : null}
    </Shell>
  )
}
