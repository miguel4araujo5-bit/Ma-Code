import { CLOUD_BACKUP_PRIVACY_NOTICE } from '../sync/cloudBackupPreference'

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
  MA_PROFESSOR_TERMS_VERSION,
  submitMAProfessorAccessRequest
} from './accessApi'

import {
  enrollMAProfessorOpaqueForActivation,
  loginMAProfessorOpaqueOnly
} from './opaqueAccess'

import {
  MA_PROFESSOR_ACCESS_SESSION_EVENT,
  clearMAProfessorOpaqueExportKey,
  clearMAProfessorStoredAccess,
  getOrCreateMAProfessorDeviceId,
  readMAProfessorStoredAccess,
  saveMAProfessorOpaqueExportKey,
  saveMAProfessorStoredAccess
} from './accessStorage'

import type {
  MAProfessorAccessResponse
} from './accessTypes'

type Mode =
  | 'intro'
  | 'request'
  | 'request-sent'
  | 'login'
  | 'activate'

interface MAProfessorAuthGateProps {
  children: ReactNode
}

const PERSONAL_PASSWORD_MIN_LENGTH =
  15

const PERSONAL_PASSWORD_MAX_LENGTH =
  128

function getErrorMessage(
  error: unknown
) {
  return error instanceof Error &&
    error.message.trim()
    ? error.message
    : 'Não foi possível concluir a operação.'
}

function Shell({
  children
}: {
  children: ReactNode
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
  response:
    MAProfessorAccessResponse,
  deviceId: string,
  fallbackEmail: string
) {
  const responseEmail =
    (
      response.email ||
      response.license?.email ||
      fallbackEmail
    )
      .trim()
      .toLowerCase()

  if (!responseEmail) {
    throw new Error(
      'A sessão foi criada, mas não foi possível identificar a conta.'
    )
  }

  saveMAProfessorStoredAccess({
    token: response.token,
    email: responseEmail,
    deviceId,
    license: response.license
  })
}

function PasswordWarningIcon() {
  return (
    <span
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-200/50 bg-amber-300/15 shadow-lg shadow-amber-950/20"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-9 w-9 text-amber-300"
        fill="none"
      >
        <path
          d="M12 2.75 22 20.25H2L12 2.75Z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinejoin="round"
        />
        <path
          d="M12 8V13.2"
          stroke="#0f172a"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <circle
          cx="12"
          cy="16.65"
          r="1.2"
          fill="#0f172a"
        />
      </svg>
    </span>
  )
}

export default function MAProfessorAuthGate({
  children
}: MAProfessorAuthGateProps) {
  const [
    storedAccess,
    setStoredAccess
  ] = useState(
    () => readMAProfessorStoredAccess()
  )

  const [
    mode,
    setMode
  ] = useState<Mode>('intro')

  const [
    email,
    setEmail
  ] = useState('')

  const [
    personalPassword,
    setPersonalPassword
  ] = useState('')

  const [
    personalPasswordConfirm,
    setPersonalPasswordConfirm
  ] = useState('')

  const [
    passwordNoticeConfirmed,
    setPasswordNoticeConfirmed
  ] = useState(false)

  const [
    activationPassword,
    setActivationPassword
  ] = useState('')

  const [
    message,
    setMessage
  ] = useState('')

  const [
    error,
    setError
  ] = useState('')

  const [
    busy,
    setBusy
  ] = useState(false)

  const [
    copied,
    setCopied
  ] = useState(false)

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

  useEffect(
    () => {
      if (storedAccess) {
        return
      }

      const url =
        new URL(
          window.location.href
        )

      if (
        url.searchParams.get(
          'acesso'
        ) !== 'ativar'
      ) {
        return
      }

      const linkedEmail =
        (
          url.searchParams.get(
            'email'
          ) || ''
        )
          .trim()
          .toLowerCase()

      const hashParams =
        new URLSearchParams(
          url.hash.startsWith('#')
            ? url.hash.slice(1)
            : url.hash
        )

      const linkedPassword =
        (
          hashParams.get(
            'senha'
          ) || ''
        )
          .trim()
          .toUpperCase()

      if (linkedEmail) {
        setEmail(linkedEmail)
      }

      if (linkedPassword) {
        setActivationPassword(
          linkedPassword
        )
      }

      setPersonalPassword('')
      setPersonalPasswordConfirm('')
      setPasswordNoticeConfirmed(false)
      setMessage('')
      setError('')
      setCopied(false)
      setMode('activate')

      url.searchParams.delete(
        'acesso'
      )
      url.searchParams.delete(
        'email'
      )
      url.hash = ''

      window.history.replaceState(
        window.history.state,
        '',
        `${url.pathname}${url.search}`
      )
    },
    [storedAccess]
  )

  if (storedAccess) {
    return <>{children}</>
  }

  const resetFeedback =
    () => {
      setError('')
      setMessage('')
      setCopied(false)
    }

  const clearPersonalPassword =
    () => {
      setPersonalPassword('')
      setPersonalPasswordConfirm('')
      setPasswordNoticeConfirmed(false)
    }

  const goLogin =
    () => {
      resetFeedback()
      setActivationPassword('')
      clearPersonalPassword()
      setMode('login')
    }

  const goActivate =
    () => {
      resetFeedback()
      clearPersonalPassword()
      setMode('activate')
    }

  const handleCopyActivationPassword =
    async () => {
      const password =
        activationPassword
          .trim()
          .toUpperCase()

      if (!password) {
        return
      }

      try {
        await navigator
          .clipboard
          .writeText(password)

        setCopied(true)
      } catch {
        setCopied(false)
        setError(
          'Não foi possível copiar automaticamente. Selecione a senha e copie-a manualmente.'
        )
      }
    }

  const handleRequest =
    async (
      event: FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault()
      resetFeedback()

      if (!normalizedEmail) {
        setError(
          'Introduza o seu email.'
        )
        return
      }

      if (
        personalPassword.length <
          PERSONAL_PASSWORD_MIN_LENGTH ||
        personalPassword.length >
          PERSONAL_PASSWORD_MAX_LENGTH
      ) {
        setError(
          `A password pessoal deve ter entre ${PERSONAL_PASSWORD_MIN_LENGTH} e ${PERSONAL_PASSWORD_MAX_LENGTH} caracteres.`
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

      if (!passwordNoticeConfirmed) {
        setError(
          'Confirme que guardou a sua password e leu a informação de privacidade e os Termos do MA-Professor.'
        )
        return
      }

      setBusy(true)

      try {
        const response =
          await submitMAProfessorAccessRequest(
            normalizedEmail
          )

        if (response.canActivate) {
          setMessage(
            response.message ||
            'O seu pedido já está aprovado. Utilize a senha de ativação recebida.'
          )
          setMode('activate')
          return
        }

        setMessage(
          response.message ||
          'Pedido recebido.'
        )
        setMode('request-sent')
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
      event: FormEvent<HTMLFormElement>
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

        const {
          response,
          exportKey
        } =
          await loginMAProfessorOpaqueOnly(
            normalizedEmail,
            personalPassword,
            deviceId
          )

        saveResponse(
          response,
          deviceId,
          normalizedEmail
        )

        saveMAProfessorOpaqueExportKey(
          normalizedEmail,
          exportKey
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
      event: FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault()
      resetFeedback()

      if (!normalizedEmail) {
        setError(
          'Introduza o seu email.'
        )
        return
      }

      if (
        !activationPassword.trim()
      ) {
        setError(
          'Introduza a senha de ativação recebida.'
        )
        return
      }

      if (
        personalPassword.length <
          PERSONAL_PASSWORD_MIN_LENGTH ||
        personalPassword.length >
          PERSONAL_PASSWORD_MAX_LENGTH
      ) {
        setError(
          `A password pessoal deve ter entre ${PERSONAL_PASSWORD_MIN_LENGTH} e ${PERSONAL_PASSWORD_MAX_LENGTH} caracteres.`
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

      if (!passwordNoticeConfirmed) {
        setError(
          'Confirme que leu o aviso, os termos e as regras aplicáveis à utilização de dados reais de alunos.'
        )
        return
      }

      setBusy(true)

      try {
        const deviceId =
          getOrCreateMAProfessorDeviceId()

        const {
          exportKey
        } =
          await enrollMAProfessorOpaqueForActivation(
            normalizedEmail,
            personalPassword,
            activationPassword.trim(),
            deviceId
          )

        const response =
          await activateMAProfessorAccessPeriod(
            normalizedEmail,
            activationPassword.trim(),
            deviceId,
            MA_PROFESSOR_TERMS_VERSION
          )

        if (!response.license) {
          throw new Error(
            'A ativação foi concluída sem uma licença válida. Contacte a MA-CODE.'
          )
        }

        saveResponse(
          response,
          deviceId,
          normalizedEmail
        )

        saveMAProfessorOpaqueExportKey(
          normalizedEmail,
          exportKey
        )

        clearPersonalPassword()

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

  if (mode === 'intro') {
    return (
      <ProductIntroPanel
        onRequestAccess={() => {
          resetFeedback()
          setActivationPassword('')
          clearPersonalPassword()
          setMode('request')
        }}
        onAlreadyHasAccess={
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
          setActivationPassword('')
          clearPersonalPassword()
          setMode('intro')
        }}
        className="mb-6 text-xs font-black uppercase tracking-[0.14em] text-slate-400 transition hover:text-white"
      >
        ← Voltar
      </button>

      {mode === 'request' ? (
        <>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
            Fase piloto
          </p>

          <h1 className="mt-3 text-2xl font-black tracking-tight text-white">
            Pedir acesso
          </h1>

          <p className="mt-3 text-sm leading-7 text-slate-300">
            Introduza o seu email e escolha a password pessoal que irá utilizar para entrar na sua conta MA-Professor. A password é tratada apenas no seu dispositivo e nunca é enviada nem guardada pela MA-CODE.
          </p>

          <form
            onSubmit={handleRequest}
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
                      event.target.value
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
                value={personalPassword}
                onChange={
                  event =>
                    setPersonalPassword(
                      event.target.value
                    )
                }
                autoComplete="new-password"
                minLength={PERSONAL_PASSWORD_MIN_LENGTH}
                maxLength={PERSONAL_PASSWORD_MAX_LENGTH}
                required
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
              />
            </label>
            <p className="-mt-2 text-[0.7rem] leading-5 text-slate-500">
              Use pelo menos 15 caracteres. Uma frase-passe longa é recomendada; não são exigidas combinações específicas de maiúsculas, números ou símbolos.
            </p>

            <label className="block">
              <span className="text-xs font-bold text-slate-300">
                Confirmar password pessoal
              </span>
              <input
                type="password"
                value={personalPasswordConfirm}
                onChange={
                  event =>
                    setPersonalPasswordConfirm(
                      event.target.value
                    )
                }
                autoComplete="new-password"
                minLength={PERSONAL_PASSWORD_MIN_LENGTH}
                maxLength={PERSONAL_PASSWORD_MAX_LENGTH}
                required
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
              />
            </label>

            <div className="rounded-2xl border border-amber-300/35 bg-amber-300/[0.08] p-4 text-sm text-amber-50 shadow-lg shadow-amber-950/10">
              <div className="flex items-start gap-4">
                <PasswordWarningIcon />
                <div className="min-w-0">
                  <p className="font-black leading-6 text-amber-100">
                    Importante: guarde esta password num local seguro.
                  </p>

                  <div className="mt-2 space-y-2 text-xs leading-6 text-amber-50/90">
                    <p>
                      A sua password permanece no seu dispositivo: não é enviada nem guardada pela MA-CODE. Por esse motivo, não conseguimos recuperá-la se a esquecer.
                    </p>

                    <p>
                      Na ativação e no início de sessão, a password é processada localmente pelo protocolo OPAQUE. A MA-CODE recebe apenas os dados criptográficos necessários ao processo de autenticação, nunca a sua password.
                    </p>

                    <p>
                      Se ativar as cópias online, os dados escolares da cópia são cifrados no seu dispositivo antes de serem enviados. Nas cópias com proteção v3, a MA-CODE não guarda no servidor o material necessário para decifrar esses dados.
                    </p>

                    <p className="font-bold text-amber-100">
                      Se perder a password, os dados que permanecem neste dispositivo não são apagados, mas deixará de conseguir iniciar uma nova sessão ou restaurar uma cópia online protegida.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-xs leading-6 text-slate-400">
              Ao enviar o pedido, a MA-CODE trata o seu email e os dados técnicos necessários para gerir o acesso e proteger o serviço. Consulte a{' '}
              <a
                href="/privacidade/ma-professor"
                className="font-bold text-cyan-200 underline decoration-cyan-300/40 underline-offset-4 transition hover:text-cyan-100"
              >
                informação de privacidade
              </a>{' '}
              e os{' '}
              <a
                href="/termos/ma-professor"
                className="font-bold text-cyan-200 underline decoration-cyan-300/40 underline-offset-4 transition hover:text-cyan-100"
              >
                Termos do MA-Professor
              </a>.
            </p>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm leading-6 text-slate-200 transition hover:border-amber-300/30">
              <input
                type="checkbox"
                checked={passwordNoticeConfirmed}
                onChange={
                  event =>
                    setPasswordNoticeConfirmed(
                      event.target.checked
                    )
                }
                required
                className="mt-1 h-4 w-4 shrink-0 accent-amber-300"
              />
              <span>
                Confirmo que guardei a minha password, li a{' '}
                <a
                  href="/privacidade/ma-professor"
                  className="font-bold text-cyan-200 underline decoration-cyan-300/40 underline-offset-4"
                >
                  informação de privacidade
                </a>{' '}
                e os{' '}
                <a
                  href="/termos/ma-professor"
                  className="font-bold text-cyan-200 underline decoration-cyan-300/40 underline-offset-4"
                >
                  Termos do MA-Professor
                </a>.
              </span>
            </label>

            {error ? (
              <p className="rounded-xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={
                busy ||
                !passwordNoticeConfirmed
              }
              className="w-full rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy
                ? 'A enviar...'
                : 'Pedir acesso'}
            </button>
          </form>
        </>
      ) : null}

      {mode === 'request-sent' ? (
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
          <p className="mt-3 text-xs leading-6 text-slate-400">
            A password que escolheu não foi enviada à MA-CODE. Guarde-a: quando receber a senha de ativação poderá ter de a introduzir novamente para concluir a ativação protegida.
          </p>
          <button
            type="button"
            onClick={goLogin}
            className="mt-6 w-full rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/5"
          >
            Entrar na minha conta
          </button>
        </>
      ) : null}

      {mode === 'login' ? (
        <>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
            Entrar
          </p>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-white">
            Aceder à sua conta MA-Professor
          </h1>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            Entre com o seu email e a password pessoal que definiu. A entrada na conta é independente do estado da licença.
          </p>
          <p className="mt-3 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.06] px-4 py-3 text-xs leading-6 text-cyan-100">
            A senha que começa por <strong>MP-</strong> não é utilizada para entrar. Serve apenas para ativar um período de acesso às ferramentas.
          </p>

          <form
            onSubmit={handleLogin}
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
                      event.target.value
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
                value={personalPassword}
                onChange={
                  event =>
                    setPersonalPassword(
                      event.target.value
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
            onClick={goActivate}
            className="mt-4 w-full rounded-xl border border-violet-300/20 bg-violet-300/[0.05] px-4 py-3 text-sm font-black text-violet-200 transition hover:bg-violet-300/10"
          >
            Tenho uma senha de ativação
          </button>
        </>
      ) : null}

      {mode === 'activate' ? (
        <>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">
            Ativação
          </p>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-white">
            Ativar período de acesso
          </h1>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            Utilize aqui a senha de ativação <strong>MP-...</strong> recebida da MA-CODE.
          </p>

          {email && activationPassword ? (
            <p className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.07] px-4 py-3 text-xs leading-6 text-emerald-100">
              O email e a senha de ativação foram preenchidos automaticamente a partir do link recebido.
            </p>
          ) : (
            <p className="mt-3 rounded-xl border border-violet-300/15 bg-violet-300/[0.06] px-4 py-3 text-xs leading-6 text-violet-100">
              A senha de ativação serve apenas para autorizar este período. Introduza a password pessoal que escolheu quando pediu acesso. Se chegou diretamente a esta etapa, pode escolhê-la agora. A password não é enviada nem guardada pela MA-CODE.
            </p>
          )}

          <form
            onSubmit={handleActivation}
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
                      event.target.value
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

              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={activationPassword}
                  onChange={
                    event => {
                      setActivationPassword(
                        event.target.value
                          .toUpperCase()
                      )
                      setCopied(false)
                    }
                  }
                  autoCapitalize="characters"
                  spellCheck={false}
                  placeholder="MP-XXXX-XXXX-XXXX-XXXX"
                  required
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 font-mono text-sm uppercase tracking-wide text-white outline-none transition focus:border-violet-300/50"
                />

                <button
                  type="button"
                  disabled={
                    !activationPassword.trim()
                  }
                  onClick={
                    () =>
                      void handleCopyActivationPassword()
                  }
                  title="Copiar senha de ativação"
                  aria-label="Copiar senha de ativação"
                  className="shrink-0 rounded-xl border border-violet-300/25 bg-violet-300/[0.08] px-4 font-black text-violet-100 transition hover:bg-violet-300/[0.14] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {copied ? '✓' : '▣'}
                </button>
              </div>

              <span className="mt-2 block text-[0.7rem] leading-5 text-slate-500">
                {copied
                  ? 'Senha copiada.'
                  : 'O botão com os dois quadrados copia a senha.'}
              </span>
            </label>

            <label className="block">
              <span className="text-xs font-bold text-slate-300">
                Password pessoal
              </span>
              <input
                type="password"
                value={personalPassword}
                onChange={
                  event =>
                    setPersonalPassword(
                      event.target.value
                    )
                }
                autoComplete="current-password"
                minLength={PERSONAL_PASSWORD_MIN_LENGTH}
                maxLength={PERSONAL_PASSWORD_MAX_LENGTH}
                required
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-violet-300/50"
              />
            </label>
            <p className="-mt-2 text-[0.7rem] leading-5 text-slate-500">
              Introduza a password que escolheu quando pediu acesso. Se chegou diretamente a esta etapa, pode escolhê-la agora. Mínimo de 15 caracteres.
            </p>

            <label className="block">
              <span className="text-xs font-bold text-slate-300">
                Confirmar password pessoal
              </span>
              <input
                type="password"
                value={personalPasswordConfirm}
                onChange={
                  event =>
                    setPersonalPasswordConfirm(
                      event.target.value
                    )
                }
                autoComplete="new-password"
                minLength={PERSONAL_PASSWORD_MIN_LENGTH}
                maxLength={PERSONAL_PASSWORD_MAX_LENGTH}
                required
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-violet-300/50"
              />
            </label>

            <div className="rounded-2xl border border-amber-300/35 bg-amber-300/[0.08] p-4 text-sm text-amber-50 shadow-lg shadow-amber-950/10">
              <div className="flex items-start gap-4">
                <PasswordWarningIcon />
                <div className="min-w-0">
                  <p className="font-black leading-6 text-amber-100">
                    Importante: guarde esta password num local seguro.
                  </p>
                  <p className="mt-2 text-xs leading-6 text-amber-50/90">
                    A password é utilizada localmente pelo protocolo de autenticação protegido e <strong>não é enviada nem guardada pela MA-CODE</strong>. Se a esquecer, não a conseguimos recuperar. Os dados que continuarem neste dispositivo não são apagados por isso, mas uma cópia online v3 deixa de poder ser restaurada quando a chave OPAQUE já não estiver disponível no dispositivo.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-slate-950/45 px-4 py-3 text-xs leading-6 text-slate-300">
              <p>{CLOUD_BACKUP_PRIVACY_NOTICE}</p>
              <p className="mt-2">A cópia automática é opcional e só começa depois de a ativar no MA-Professor. Pode desativá-la em Segurança e recuperação.</p>
              <a
                href="/privacidade/ma-professor"
                className="mt-2 inline-block font-bold text-cyan-200 underline decoration-cyan-300/40 underline-offset-4 transition hover:text-cyan-100"
              >
                Informação de privacidade do MA-Professor
              </a>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm leading-6 text-slate-200 transition hover:border-amber-300/30">
              <input
                type="checkbox"
                checked={passwordNoticeConfirmed}
                onChange={
                  event =>
                    setPasswordNoticeConfirmed(
                      event.target.checked
                    )
                }
                required
                className="mt-1 h-4 w-4 shrink-0 accent-amber-300"
              />
              <span>
                Confirmo que guardei a minha password, li a{' '}
                <a
                  href="/privacidade/ma-professor"
                  className="font-bold text-cyan-200 underline decoration-cyan-300/40 underline-offset-4"
                >
                  informação de privacidade
                </a>{' '}
                e os{' '}
                <a
                  href="/termos/ma-professor"
                  className="font-bold text-cyan-200 underline decoration-cyan-300/40 underline-offset-4"
                >
                  Termos do MA-Professor
                </a>. Se introduzir dados reais de alunos, confirmo que a utilização da ferramenta está autorizada pela entidade responsável no meu contexto profissional.
              </span>
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
              disabled={
                busy ||
                !passwordNoticeConfirmed
              }
              className="w-full rounded-xl bg-violet-300 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-violet-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy
                ? 'A ativar...'
                : 'Ativar período'}
            </button>
          </form>

          <button
            type="button"
            onClick={goLogin}
            className="mt-4 w-full rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-slate-300 transition hover:bg-white/5 hover:text-white"
          >
            Entrar com a minha password pessoal
          </button>
        </>
      ) : null}
    </Shell>
  )
}
