import {
  type FormEvent,
  useEffect,
  useState
} from 'react'

import {
  getAdminSession,
  loginAdmin,
  logoutAdmin
} from '../lib/admin/adminApi'

type AdminView =
  | 'checking'
  | 'signed-out'
  | 'signed-in'

function updateMeta(
  name: string,
  content: string
) {
  let meta =
    document.querySelector<HTMLMetaElement>(
      `meta[name="${name}"]`
    )

  if (!meta) {
    meta =
      document.createElement(
        'meta'
      )

    meta.name =
      name

    document.head.appendChild(
      meta
    )
  }

  meta.content =
    content
}

function getErrorMessage(
  error: unknown
) {
  return error instanceof
    Error
    ? error.message
    : 'Ocorreu um erro inesperado.'
}

function formatExpiry(
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

  return new Intl.DateTimeFormat(
    'pt-PT',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }
  ).format(
    date
  )
}

export default function AdminPage() {
  const [
    view,
    setView
  ] =
    useState<AdminView>(
      'checking'
    )

  const [
    password,
    setPassword
  ] =
    useState('')

  const [
    expiresAt,
    setExpiresAt
  ] =
    useState<string | null>(
      null
    )

  const [
    error,
    setError
  ] =
    useState('')

  const [
    submitting,
    setSubmitting
  ] =
    useState(false)

  useEffect(() => {
    document.title =
      'Administração | MA-CODE'

    updateMeta(
      'description',
      'Área administrativa reservada da MA-CODE.'
    )

    updateMeta(
      'robots',
      'noindex, nofollow, noarchive, nosnippet, noimageindex'
    )

    let active =
      true

    void getAdminSession()
      .then(
        session => {
          if (!active) {
            return
          }

          if (
            session.authenticated
          ) {
            setExpiresAt(
              session.expiresAt
            )

            setView(
              'signed-in'
            )

            return
          }

          setExpiresAt(null)
          setView(
            'signed-out'
          )
        }
      )
      .catch(
        sessionError => {
          if (!active) {
            return
          }

          setError(
            getErrorMessage(
              sessionError
            )
          )

          setView(
            'signed-out'
          )
        }
      )

    return () => {
      active =
        false
    }
  }, [])

  const handleLogin =
    async (
      event: FormEvent
    ) => {
      event.preventDefault()

      if (!password) {
        setError(
          'Introduza a password de administração.'
        )

        return
      }

      setSubmitting(true)
      setError('')

      try {
        const session =
          await loginAdmin(
            password
          )

        setPassword('')

        setExpiresAt(
          session.expiresAt
        )

        setView(
          'signed-in'
        )
      } catch (
        loginError
      ) {
        setPassword('')

        setError(
          getErrorMessage(
            loginError
          )
        )
      } finally {
        setSubmitting(false)
      }
    }

  const handleLogout =
    async () => {
      setSubmitting(true)
      setError('')

      try {
        await logoutAdmin()

        setPassword('')
        setExpiresAt(null)

        setView(
          'signed-out'
        )
      } catch (
        logoutError
      ) {
        setError(
          getErrorMessage(
            logoutError
          )
        )
      } finally {
        setSubmitting(false)
      }
    }

  if (
    view === 'checking'
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-cyan-300/20 border-t-cyan-300" />

          <p className="mt-4 text-sm font-semibold text-slate-400">
            A verificar a sessão
            administrativa…
          </p>
        </div>
      </main>
    )
  }

  if (
    view === 'signed-out'
  ) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-slate-950 px-4 py-8 text-white sm:px-6">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
        >
          <div className="absolute left-[-10rem] top-[-10rem] h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl" />

          <div className="absolute bottom-[-12rem] right-[-10rem] h-[28rem] w-[28rem] rounded-full bg-violet-500/10 blur-3xl" />
        </div>

        <section className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col">
          <header className="flex items-center justify-between gap-4 border-b border-white/10 pb-6">
            <a
              href="/"
              className="inline-flex items-center gap-3"
              aria-label="MA-CODE"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-sm font-black text-cyan-200 shadow-lg shadow-cyan-950/30">
                MA
              </div>

              <div>
                <p className="text-sm font-black tracking-[0.18em] text-white">
                  MA-CODE
                </p>

                <p className="text-xs font-semibold text-slate-500">
                  Administração
                </p>
              </div>
            </a>

            <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-[0.68rem] font-black uppercase tracking-[0.16em] text-amber-200">
              Acesso restrito
            </span>
          </header>

          <div className="flex flex-1 items-center justify-center py-12">
            <form
              onSubmit={
                handleLogin
              }
              className="w-full max-w-md rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/30 backdrop-blur sm:p-8"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-xl text-cyan-200">
                🔒
              </div>

              <p className="mt-6 text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
                Área privada
              </p>

              <h1 className="mt-3 text-3xl font-black tracking-tight">
                Administração
                MA-CODE
              </h1>

              <p className="mt-3 text-sm leading-6 text-slate-400">
                Introduza a password
                administrativa para aceder
                aos módulos internos da
                MA-CODE.
              </p>

              <label className="mt-7 block text-sm font-bold text-slate-200">
                Password

                <input
                  type="password"
                  autoComplete="current-password"
                  value={
                    password
                  }
                  onChange={
                    event => {
                      setPassword(
                        event.target.value
                      )

                      setError('')
                    }
                  }
                  placeholder="Password de administração"
                  disabled={
                    submitting
                  }
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-300/10 disabled:cursor-wait disabled:opacity-60"
                />
              </label>

              {error ? (
                <p
                  role="alert"
                  className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm font-semibold leading-6 text-rose-200"
                >
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={
                  submitting
                }
                className="mt-5 w-full rounded-2xl bg-cyan-300 px-5 py-3.5 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60"
              >
                {submitting
                  ? 'A validar…'
                  : 'Entrar'}
              </button>

              <p className="mt-4 text-center text-xs leading-5 text-slate-600">
                Sessão protegida no
                servidor. A password não é
                guardada neste dispositivo.
              </p>
            </form>
          </div>

          <footer className="border-t border-white/10 pt-6 text-center text-xs text-slate-700">
            MA-CODE · Área administrativa
            reservada
          </footer>
        </section>
      </main>
    )
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
      >
        <div className="absolute left-[-10rem] top-[-10rem] h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl" />

        <div className="absolute bottom-[-12rem] right-[-10rem] h-[28rem] w-[28rem] rounded-full bg-violet-500/10 blur-3xl" />
      </div>

      <section className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-8 sm:px-8 lg:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <a
            href="/"
            className="inline-flex items-center gap-3"
            aria-label="MA-CODE"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-sm font-black text-cyan-200 shadow-lg shadow-cyan-950/30">
              MA
            </div>

            <div>
              <p className="text-sm font-black tracking-[0.18em] text-white">
                MA-CODE
              </p>

              <p className="text-xs font-semibold text-slate-500">
                Administração
              </p>
            </div>
          </a>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-bold text-emerald-200">
              Sessão protegida
            </div>

            <button
              type="button"
              onClick={() =>
                void handleLogout()
              }
              disabled={
                submitting
              }
              className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-slate-300 transition hover:bg-white/5 hover:text-white disabled:cursor-wait disabled:opacity-60"
            >
              {submitting
                ? 'A sair…'
                : 'Terminar sessão'}
            </button>
          </div>
        </header>

        <div className="py-10">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
                Painel interno
              </p>

              <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
                Administração
                MA-CODE
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
                Gestão central dos produtos
                e serviços que necessitam de
                operações privadas.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-right">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-slate-500">
                Sessão válida até
              </p>

              <p className="mt-1 text-sm font-bold text-slate-200">
                {formatExpiry(
                  expiresAt
                )}
              </p>
            </div>
          </div>

          {error ? (
            <p
              role="alert"
              className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm font-semibold leading-6 text-rose-200"
            >
              {error}
            </p>
          ) : null}

          <section
            aria-labelledby="admin-modules-title"
            className="mt-8"
          >
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                Módulos
              </p>

              <h2
                id="admin-modules-title"
                className="mt-1 text-2xl font-black text-white"
              >
                Gestão MA-CODE
              </h2>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <article className="rounded-[1.75rem] border border-emerald-300/15 bg-emerald-300/[0.06] p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-xs font-black text-emerald-200">
                        MP
                      </span>

                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">
                          Primeiro módulo
                        </p>

                        <h3 className="mt-1 text-lg font-black text-white">
                          MA-Professor
                        </h3>
                      </div>
                    </div>

                    <p className="mt-4 text-sm leading-6 text-slate-400">
                      Pedidos de acesso,
                      aprovação, senhas,
                      licenças, pagamentos,
                      renovações e histórico
                      administrativo.
                    </p>
                  </div>
                </div>

                <div className="mt-5 inline-flex items-center rounded-full border border-white/10 bg-slate-950/60 px-3 py-1.5 text-xs font-bold text-slate-400">
                  Próximo passo: ativar
                  gestão de pedidos
                </div>
              </article>

              <article className="rounded-[1.75rem] border border-white/10 bg-white/[0.025] p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-300/20 bg-violet-300/10 text-lg font-black text-violet-200">
                  +
                </div>

                <h3 className="mt-4 text-lg font-black text-slate-300">
                  Outros produtos
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Novos módulos
                  administrativos podem ser
                  acrescentados aqui quando
                  forem realmente
                  necessários.
                </p>
              </article>
            </div>
          </section>
        </div>

        <footer className="mt-auto border-t border-white/10 pt-6 text-center text-xs text-slate-700">
          MA-CODE · Área administrativa
          reservada
        </footer>
      </section>
    </main>
  )
}
