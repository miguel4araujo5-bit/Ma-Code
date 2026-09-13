import {
  useEffect,
  useState
} from 'react'

import { useMAProfessorAccess } from '../access/AccessGate'
import { getLicenseStatusLabel } from '../access/accessTypes'

export type ProductWorkspace = 'daily' | 'calendar' | 'backup' | 'menu'
export type ProductTheme = 'light' | 'dark'
export type ProductSidebarDestination =
  | 'dashboard'
  | 'calendar'
  | 'giae'
  | 'assessments'
  | 'planifications'
  | 'groups'
  | 'attendance'
  | 'schedule'
  | 'settings'

interface ProductNavigationProps {
  workspace: ProductWorkspace
  academicYearName: string | null
  theme: ProductTheme
  onSelect: (workspace: ProductWorkspace) => void
  onOpenSidebarDestination: (destination: ProductSidebarDestination) => void
  onToggleTheme: () => void
}

const items: Array<{
  id: ProductWorkspace
  label: string
  icon: string
}> = [
  {
    id: 'daily',
    label: 'Hoje',
    icon: '▤'
  },
  {
    id: 'calendar',
    label: 'Calendário',
    icon: '▦'
  },
  {
    id: 'backup',
    label: 'Cópia',
    icon: '⇩'
  },
  {
    id: 'menu',
    label: 'Menu',
    icon: '☰'
  }
]

const sidebarItems: Array<{
  id: ProductSidebarDestination
  label: string
}> = [
  { id: 'dashboard', label: 'Painel' },
  { id: 'calendar', label: 'Calendário' },
  { id: 'giae', label: 'Sumários / GIAE' },
  { id: 'assessments', label: 'Avaliações' },
  { id: 'planifications', label: 'Planificações' },
  { id: 'groups', label: 'Turmas e alunos' },
  { id: 'attendance', label: 'Faltas e recuperações' },
  { id: 'schedule', label: 'Horários' },
  { id: 'settings', label: 'Definições' }
]

export function ProductNavigation({
  workspace,
  academicYearName,
  theme,
  onSelect,
  onOpenSidebarDestination,
  onToggleTheme
}: ProductNavigationProps) {
  const { session } = useMAProfessorAccess()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const nextThemeLabel =
    theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'

  useEffect(() => {
    if (!sidebarOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSidebarOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [sidebarOpen])

  function openDestination(destination: ProductSidebarDestination) {
    setSidebarOpen(false)
    onOpenSidebarDestination(destination)
  }

  return (
    <>
      <header className="sticky top-0 z-[70] border-b border-white/10 bg-slate-950/95 text-white shadow-xl shadow-black/20 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1800px] items-center gap-2 px-2 py-2 sm:gap-3 sm:px-5">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="flex shrink-0 items-center gap-2 rounded-2xl px-1 py-1.5 text-left transition hover:bg-white/[0.04] sm:gap-3 sm:px-2"
            aria-label="Abrir navegação completa do MA-Professor"
            aria-expanded={sidebarOpen}
          >
            <img
              src="/ma-code.png"
              alt=""
              aria-hidden="true"
              className="h-9 w-9 rounded-xl object-contain"
            />

            <span className="hidden min-w-0 xl:block">
              <span className="block truncate text-sm font-black">
                MA-Professor
              </span>

              <span className="block truncate text-[0.65rem] font-semibold text-slate-500">
                {academicYearName || 'Configuração inicial'}
              </span>
            </span>
          </button>

          <nav className="grid min-w-0 flex-1 grid-cols-4 gap-1 rounded-2xl border border-white/10 bg-slate-900/80 p-1">
            {items.map(item => {
              const active = workspace === item.id

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`min-w-0 rounded-xl px-1.5 py-2 text-center text-[0.68rem] font-black transition sm:px-4 sm:text-xs ${
                    active
                      ? 'bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-950/30'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="mr-1 sm:mr-1.5" aria-hidden="true">
                    {item.icon}
                  </span>

                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={nextThemeLabel}
            aria-pressed={theme === 'light'}
            title={nextThemeLabel}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-base font-black text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
          >
            <span aria-hidden="true">
              {theme === 'dark' ? '☀' : '☾'}
            </span>
          </button>

          <div className="hidden min-w-0 text-right lg:block">
            <p className="max-w-48 truncate text-xs font-bold text-slate-300">
              {session.email}
            </p>

            <p className="text-[0.65rem] font-semibold text-emerald-300">
              {getLicenseStatusLabel(session.license.status)}
              {session.license.daysRemaining !== null
                ? ` · ${session.license.daysRemaining} dias`
                : ''}
            </p>
          </div>
        </div>
      </header>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-[120]">
          <button
            type="button"
            aria-label="Fechar navegação"
            onClick={() => setSidebarOpen(false)}
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
          />

          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Navegação completa do MA-Professor"
            className="absolute inset-y-0 left-0 flex w-[min(20rem,calc(100vw-2rem))] flex-col overflow-y-auto border-r border-white/10 bg-slate-950 p-5 text-white shadow-2xl shadow-black/60"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src="/ma-code.png"
                  alt="MA-Code"
                  className="h-11 w-11 rounded-xl object-contain"
                />
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    MA-Code
                  </p>
                  <p className="font-black text-white">
                    MA-Professor
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                aria-label="Fechar navegação"
                className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-lg font-black text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
              >
                ×
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setSidebarOpen(false)
                onSelect('daily')
              }}
              className="mt-7 flex w-full items-center gap-3 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] px-3 py-3 text-left text-sm font-black text-cyan-100 transition hover:bg-cyan-300/10"
            >
              <span className="grid h-7 w-7 place-items-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-xs">
                ▤
              </span>
              Hoje
            </button>

            <nav className="mt-3 space-y-1.5" aria-label="Áreas do MA-Professor">
              {sidebarItems.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openDestination(item.id)}
                  className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-3 text-left text-sm font-semibold text-slate-300 transition hover:border-white/10 hover:bg-white/[0.04] hover:text-white"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.035] text-[0.65rem] font-black">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>

            <div className="mt-auto pt-6">
              <p className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.05] p-4 text-xs leading-6 text-slate-400">
                O menu fica acessível pelo logótipo mesmo quando uma área ocupa o ecrã completo.
              </p>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  )
}
