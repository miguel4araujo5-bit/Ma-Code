import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useState
} from 'react'

import {
  getAdminSession,
  loginAdmin,
  logoutAdmin,
  type AdminSessionState
} from '../../lib/admin/adminApi'

export type AdminSection =
  | 'dashboard'
  | 'ma-professor'
  | 'redezero'

interface AdminShellProps {
  activeSection: AdminSection
  eyebrow: string
  title: string
  description: string
  children: ReactNode
}

interface AdminNavigationItem {
  section: AdminSection
  href: string
  label: string
  shortLabel: string
  description: string
}

const navigationItems:
  AdminNavigationItem[] = [
    {
      section: 'dashboard',
      href: '/admin',
      label: 'Dashboard',
      shortLabel: 'MA',
      description:
        'Visão geral da administração'
    },
    {
      section: 'ma-professor',
      href: '/admin/ma-professor',
      label: 'MA-Professor',
      shortLabel: 'MP',
      description:
        'Acessos, licenças e utilizadores'
    },
    {
      section: 'redezero',
      href: '/admin/redezero',
      label: 'RedeZero',
      shortLabel: 'RZ',
      description:
        'Administração do jogo'
    }
  ]

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
  if (
    error instanceof Error &&
    error.message
  ) {
    return error.message
  }

  return 'Ocorreu um erro inesperado na administração MA-CODE.'
}

function formatSessionExpiry(
  value: string | null
) {
  if (!value) {
    return null
  }

  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null
  }

  return new Intl.DateTimeFormat(
    'pt-PT',
    {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }
  ).format(date)
}

function NavigationItem({
  item,
  active
}: {
  item: AdminNavigationItem
  active: boolean
}) {
  return (
    <a
      href={item.href}
      aria-current={
        active
          ? 'page'
          : undefined
      }
      className={[
        'group flex items-center gap-3 rounded-2xl border px-3 py-3 transition',
        active
          ? 'border-cyan-300/25 bg-cyan-300/10 text-white'
          : 'border-transparent text-slate-400 hover:border-white/10 hover:bg-white/[0.035] hover:text-white'
      ].join(' ')}
    >
      <span
        className={[
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-[0.7rem] font-black tracking-wide transition',
          active
            ? 'border-cyan-300/30 bg-cyan-300/10 text-cyan-200'
            : 'border-white/10 bg-slate-900 text-slate-500 group-hover:text-slate-300'
        ].join(' ')}
      >
        {item.shortLabel}
      </span>

      <span className="min-w-0">
        <span className="block text-sm font-black">
          {item.label}
        </span>

        <span className="mt-0.5 block truncate text-xs text-slate-500">
          {item.description}
        </span>
      </span>
    </a>
  )
}

export default function AdminShell({
  activeSection,
  eyebrow,
  title,
  description,
  children
}: AdminShellProps) {
  const [
    session,
    setSession
  ] =
    useState<AdminSessionState>({
      authenticated: false,
      expiresAt: null
    })

  const [
    checkingSession,
    setCheckingSession
  ] =
    useState(true)

  const [
    password,
    setPassword
  ] =
    useState('')

  const [
    authError,
    setAuthError
  ] =
    useState('')

  const [
    submitting,
    setSubmitting
  ] =
    useState(false)

  const [
    loggingOut,
    setLoggingOut
  ] =
    useState(false)

  useEffect(() => {
    document.title =
      `${title} | MA-CODE Admin`

    updateMeta(
      'description',
      'Área administrativa reservada da MA-CODE.'
    )

    updateMeta(
      'robots',
      'noindex, nofollow, noarchive, nosnippet, noimageindex'
    )
  }, [
    title
  ])

  useEffect(() => {
    let cancelled =
      false

    const verifySession =
      async () => {
        setCheckingSession(
          true
        )

        setAuthError('')

        try {
          const currentSession =
            await getAdminSession()

          if (cancelled) {
            return
          }

          setSession(
            currentSession
          )
        } catch (error) {
          if (cancelled) {
            return
          }

          setSession({
            authenticated:
              false,
            expiresAt:
              null
          })

          setAuthError(
            getErrorMessage(
              error
            )
          )
        } finally {
          if (
            !cancelled
          ) {
            setCheckingSession(
              false
            )
          }
        }
      }

    void verifySession()

    return () => {
      cancelled =
        true
    }
  }, [])

  const handleLogin =
    async (
      event:
        FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault()

      if (
        !password ||
        submitting
      ) {
        return
      }

      setSubmitting(
        true
      )

      setAuthError('')

      try {
        const nextSession =
          await loginAdmin(
            password
          )

        setSession(
          nextSession
        )

        setPassword('')
      } catch (error) {
        setSession({
          authenticated:
            false,
          expiresAt:
            null
        })

        setAuthError(
          getErrorMessage(
            error
          )
        )
      } finally {
        setSubmitting(
          false
        )
      }
    }

  const handleLogout =
    async () => {
      if (
        loggingOut
      ) {
        return
      }

      setLoggingOut(
        true
      )

      setAuthError('')

      try {
        await logoutAdmin()

        setSession({
          authenticated:
            false,
          expiresAt:
            null
        })

        setPassword('')
      } catch (error) {
        setAuthError(
          getErrorMessage(
            error
          )
        )
      } finally {
        setLoggingOut(
          false
        )
      }
    }

  const sessionExpiry =
    formatSessionExpiry(
      session.expiresAt
    )

  if (
    checkingSession
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute left-[-12rem] top-[-12rem] h-[30rem] w-[30rem] rounded-full bg-cyan-400/[0.07] blur-3xl" />

          <div className="absolute bottom-[-16rem] right-[-12rem] h-[34rem] w-[34rem] rounded-full bg-violet-500/[0.06] blur-3xl" />
        </div>

        <div className="relative text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.07]">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-300/25 border-t-cyan-200" />
          </div>

          <p className="mt-4 text-sm font-black text-slate-300">
            A verificar sessão
          </p>

          <p className="mt-1 text-xs text-slate-600">
            Administração MA-CODE
          </p>
        </div>
      </main>
    )
  }

  if (
    !session.authenticated
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute left-[-12rem] top-[-12rem] h-[30rem] w-[30rem] rounded-full bg-cyan-400/[0.07] blur-3xl" />

          <div className="absolute bottom-[-16rem] right-[-12rem] h-[34rem] w-[34rem] rounded-full bg-violet-500/[0.06] blur-3xl" />
        </div>

        <section className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/80 shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="border-b border-white/10 p-6 sm:p-7">
            <a
              href="/"
              className="inline-flex items-center gap-3"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-sm font-black text-cyan-200">
                MA
              </span>

              <span>
                <span className="block text-sm font-black tracking-[0.18em]">
                  MA-CODE
                </span>

                <span className="mt-0.5 block text-xs font-semibold text-slate-500">
                  Administração
                </span>
              </span>
            </a>

            <p className="mt-7 text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
              Área reservada
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight">
              Entrar no MA-ADMIN
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-400">
              Introduza a password administrativa para aceder ao backoffice MA-CODE.
            </p>
          </div>

          <form
            onSubmit={
              handleLogin
            }
            className="p-6 sm:p-7"
          >
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                Password
              </span>

              <input
                type="password"
                value={
                  password
                }
                onChange={
                  event => {
                    setPassword(
                      event.target.value
                    )

                    if (
                      authError
                    ) {
                      setAuthError('')
                    }
                  }
                }
                autoComplete="current-password"
                autoFocus
                placeholder="Password administrativa"
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/40 focus:ring-4 focus:ring-cyan-300/10"
              />
            </label>

            {authError ? (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/[0.06] px-4 py-3"
              >
                <p className="text-xs font-bold leading-5 text-rose-200">
                  {authError}
                </p>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={
                submitting ||
                !password
              }
              className="mt-5 w-full rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? 'A entrar…'
                : 'Entrar'}
            </button>

            <div className="mt-5 rounded-xl border border-white/[0.07] bg-slate-950/45 p-3">
              <p className="text-[0.7rem] leading-5 text-slate-500">
                A sessão administrativa é criada pelo servidor e guardada num cookie seguro. A password não é guardada no browser pela aplicação.
              </p>
            </div>
          </form>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-12rem] top-[-12rem] h-[30rem] w-[30rem] rounded-full bg-cyan-400/[0.07] blur-3xl" />

        <div className="absolute bottom-[-16rem] right-[-12rem] h-[34rem] w-[34rem] rounded-full bg-violet-500/[0.06] blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1600px]">
        <aside className="hidden w-72 shrink-0 border-r border-white/10 bg-slate-950/80 p-5 backdrop-blur-xl lg:flex lg:flex-col">
          <a
            href="/admin"
            className="flex items-center gap-3 rounded-2xl px-2 py-2"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-sm font-black text-cyan-200">
              MA
            </span>

            <span>
              <span className="block text-sm font-black tracking-[0.18em]">
                MA-CODE
              </span>

              <span className="mt-0.5 block text-xs font-semibold text-slate-500">
                Administração
              </span>
            </span>
          </a>

          <div className="mt-7">
            <p className="px-3 text-[0.65rem] font-black uppercase tracking-[0.2em] text-slate-600">
              Navegação
            </p>

            <nav
              aria-label="Administração MA-CODE"
              className="mt-3 space-y-1"
            >
              {navigationItems.map(
                item => (
                  <NavigationItem
                    key={
                      item.section
                    }
                    item={
                      item
                    }
                    active={
                      item.section ===
                      activeSection
                    }
                  />
                )
              )}
            </nav>
          </div>

          <div className="mt-auto pt-8">
            <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.05] p-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-300" />

                <p className="text-xs font-black text-emerald-200">
                  Sessão protegida
                </p>
              </div>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                {sessionExpiry
                  ? `Sessão válida até ${sessionExpiry}.`
                  : 'Sessão administrativa autenticada.'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                void handleLogout()
              }}
              disabled={
                loggingOut
              }
              className="mt-3 flex w-full items-center justify-center rounded-xl border border-white/10 px-4 py-2.5 text-xs font-bold text-slate-400 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loggingOut
                ? 'A terminar sessão…'
                : 'Terminar sessão'}
            </button>

            <a
              href="/"
              className="mt-2 flex items-center justify-center rounded-xl border border-white/10 px-4 py-2.5 text-xs font-bold text-slate-400 transition hover:bg-white/5 hover:text-white"
            >
              Voltar ao site MA-CODE
            </a>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="border-b border-white/10 bg-slate-950/70 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <a
                href="/admin"
                className="flex items-center gap-3 lg:hidden"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/25 bg-cyan-300/10 text-xs font-black text-cyan-200">
                  MA
                </span>

                <span>
                  <span className="block text-sm font-black tracking-[0.12em]">
                    MA-CODE
                  </span>

                  <span className="text-[0.7rem] text-slate-500">
                    Admin
                  </span>
                </span>
              </a>

              <div className="ml-auto flex items-center gap-2">
                <span className="hidden rounded-full border border-emerald-300/15 bg-emerald-300/[0.06] px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.14em] text-emerald-200 sm:inline-flex">
                  Sessão protegida
                </span>

                <button
                  type="button"
                  onClick={() => {
                    void handleLogout()
                  }}
                  disabled={
                    loggingOut
                  }
                  className="rounded-xl border border-white/10 px-3 py-2 text-[0.7rem] font-black text-slate-400 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 lg:hidden"
                >
                  Sair
                </button>
              </div>
            </div>

            {authError ? (
              <div
                role="alert"
                className="mt-3 rounded-xl border border-rose-300/15 bg-rose-300/[0.05] px-3 py-2 text-xs font-bold text-rose-200"
              >
                {authError}
              </div>
            ) : null}

            <nav
              aria-label="Módulos administrativos"
              className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:hidden"
            >
              {navigationItems.map(
                item => {
                  const active =
                    item.section ===
                    activeSection

                  return (
                    <a
                      key={
                        item.section
                      }
                      href={
                        item.href
                      }
                      aria-current={
                        active
                          ? 'page'
                          : undefined
                      }
                      className={[
                        'shrink-0 rounded-xl border px-3 py-2 text-xs font-black transition',
                        active
                          ? 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100'
                          : 'border-white/10 text-slate-400 hover:bg-white/5 hover:text-white'
                      ].join(
                        ' '
                      )}
                    >
                      {item.label}
                    </a>
                  )
                }
              )}
            </nav>
          </header>

          <section className="px-4 py-7 sm:px-6 sm:py-9 lg:px-8 lg:py-10 xl:px-10">
            <div className="mx-auto max-w-7xl">
              <div className="border-b border-white/10 pb-7">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
                  {eyebrow}
                </p>

                <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                  {title}
                </h1>

                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400 sm:text-base">
                  {description}
                </p>
              </div>

              <div className="py-7">
                {children}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
