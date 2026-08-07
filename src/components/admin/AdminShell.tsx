import {
  type ReactNode,
  useEffect
} from 'react'

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
                    item={item}
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
            <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.05] p-4">
              <p className="text-xs font-black text-amber-200">
                Estrutura em preparação
              </p>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                Ainda não existem dados
                administrativos nem ações
                reais ligadas ao backend.
              </p>
            </div>

            <a
              href="/"
              className="mt-3 flex items-center justify-center rounded-xl border border-white/10 px-4 py-2.5 text-xs font-bold text-slate-400 transition hover:bg-white/5 hover:text-white"
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

              <div className="ml-auto flex items-center gap-3">
                <span className="rounded-full border border-amber-300/15 bg-amber-300/[0.06] px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.14em] text-amber-200">
                  Sem dados reais
                </span>
              </div>
            </div>

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
                      {
                        item.label
                      }
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
