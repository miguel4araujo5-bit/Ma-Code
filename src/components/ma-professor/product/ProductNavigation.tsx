import {
  useEffect,
  useState
} from 'react'

import { useMAProfessorAccess } from '../access/AccessGate'
import { getLicenseStatusLabel } from '../access/accessTypes'
import GIAESummaryExportPageAction from '../giae/GIAESummaryExportPageAction'

import {
  menuDestinations,
  primaryNavigation,
  type ProductMenuTarget,
  type ProductWorkspace,
  type ProductSidebarDestination
} from './productNavigationModel'
export type { ProductWorkspace, ProductSidebarDestination } from './productNavigationModel'
export type ProductTheme = 'light' | 'dark'

interface ProductNavigationProps {
  workspace: ProductWorkspace
  activeDestination?: ProductMenuTarget | null
  academicYearName: string | null
  theme: ProductTheme
  onSelect: (workspace: ProductWorkspace) => void
  onOpenSidebarDestination: (destination: ProductSidebarDestination) => void
  onToggleTheme: () => void
}

interface SidebarPanelProps {
  workspace: ProductWorkspace
  activeDestination: ProductMenuTarget | null
  academicYearName: string | null
  showCloseButton: boolean
  onClose: () => void
  onOpenToday: () => void
  onOpenWorkspace: (workspace: ProductWorkspace) => void
  onOpenDestination: (destination: ProductSidebarDestination) => void
}

type SidebarItem =
  | {
      key: string
      label: string
      destination: ProductSidebarDestination
      criteriaManagement?: boolean
    }
  | {
      key: string
      label: string
      workspace: ProductWorkspace
    }

const sidebarItems: SidebarItem[] = [
  { key: 'calendar', workspace: 'calendar', label: 'Calendário' },
  ...menuDestinations.flatMap(item => {
    const destination: SidebarItem = { key: item.id, destination: item.id, label: item.label }
    return item.id === 'assessments'
      ? [destination, { key: 'assessment-criteria', destination: 'assessments' as const, label: 'Critérios de avaliação', criteriaManagement: true }]
      : [destination]
  })
]

function scrollToCriteriaManagement() {
  let attempts = 0

  const tryScroll = () => {
    const target =
      document.getElementById(
        'ma-professor-criteria-management'
      )

    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      })
      return
    }

    attempts += 1

    if (attempts < 30) {
      window.setTimeout(
        tryScroll,
        100
      )
    }
  }

  window.setTimeout(
    tryScroll,
    0
  )
}

function SidebarPanel({
  workspace,
  activeDestination,
  academicYearName,
  showCloseButton,
  onClose,
  onOpenToday,
  onOpenWorkspace,
  onOpenDestination
}: SidebarPanelProps) {
  function openSidebarItem(
    item: SidebarItem
  ) {
    if (
      'workspace' in item
    ) {
      onOpenWorkspace(
        item.workspace
      )
      return
    }

    onOpenDestination(
      item.destination
    )

    if (item.criteriaManagement) {
      scrollToCriteriaManagement()
    }
  }

  const isActive = (item: SidebarItem) => 'workspace' in item
    ? workspace === item.workspace
    : workspace === 'menu' && activeDestination === item.destination && !item.criteriaManagement

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <img
            src="/ma-code.png"
            alt="MA-Code"
            className="h-11 w-11 shrink-0 rounded-xl object-contain"
          />

          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              MA-Code
            </p>
            <p className="truncate font-black text-white">
              MA-Professor
            </p>
            <p className="truncate text-[0.65rem] font-semibold text-slate-500">
              {academicYearName || 'Configuração inicial'}
            </p>
          </div>
        </div>

        {showCloseButton ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar navegação"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-lg font-black text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
          >
            ×
          </button>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onOpenToday}
        aria-current={workspace === 'daily' ? 'page' : undefined}
        className={`mt-7 flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm font-black transition ${workspace === 'daily' ? 'border-cyan-300/20 bg-cyan-300/[0.07] text-cyan-100' : 'border-transparent text-slate-300 hover:bg-white/[0.04]'}`}
      >
        <span className="grid h-7 w-7 place-items-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-xs">
          ▤
        </span>
        Hoje
      </button>

      <nav className="mt-3 space-y-1.5" aria-label="Áreas do MA-Professor">
        {sidebarItems.map((item, index) => (
          <button
            key={item.key}
            type="button"
            onClick={() =>
              openSidebarItem(
                item
              )
            }
            aria-current={isActive(item) ? 'page' : undefined}
            className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm font-semibold transition ${isActive(item) ? 'border-cyan-300/20 bg-cyan-300/[0.07] text-cyan-100' : 'border-transparent text-slate-300 hover:border-white/10 hover:bg-white/[0.04] hover:text-white'}`}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.035] text-[0.65rem] font-black">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <a href="/" className="mt-5 px-3 py-3 text-sm font-semibold text-slate-400 hover:text-white">
        Voltar à MA-Code
      </a>
    </>
  )
}

export function ProductNavigation({
  workspace,
  activeDestination = null,
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

  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 1280px)')

    const handleDesktopChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setSidebarOpen(false)
      }
    }

    desktopQuery.addEventListener('change', handleDesktopChange)

    return () => {
      desktopQuery.removeEventListener('change', handleDesktopChange)
    }
  }, [])

  function openToday() {
    setSidebarOpen(false)
    onSelect('daily')
  }

  function openWorkspace(
    destination: ProductWorkspace
  ) {
    setSidebarOpen(false)
    onSelect(destination)
  }

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
            className="flex shrink-0 items-center gap-2 rounded-2xl px-1 py-1.5 text-left transition hover:bg-white/[0.04] sm:gap-3 sm:px-2 xl:hidden"
            aria-label="Abrir navegação completa do MA-Professor"
            aria-expanded={sidebarOpen}
          >
            <img
              src="/ma-code.png"
              alt=""
              aria-hidden="true"
              className="h-9 w-9 rounded-xl object-contain"
            />

            <span className="hidden min-w-0 sm:block">
              <span className="block truncate text-sm font-black">
                MA-Professor
              </span>

              <span className="block truncate text-[0.65rem] font-semibold text-slate-500">
                {academicYearName || 'Configuração inicial'}
              </span>
            </span>
          </button>

          <nav aria-label="Navegação principal do MA-Professor" className="grid min-w-0 flex-1 grid-cols-4 gap-1 rounded-2xl border border-white/10 bg-slate-900/80 p-1">
            {primaryNavigation.map(item => {
              const active = workspace === item.id

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`min-w-0 rounded-xl px-0.5 py-2 text-center text-[0.625rem] font-black transition sm:px-4 sm:text-xs ${
                    active
                      ? 'bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-950/30'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="hidden sm:mr-1.5 sm:inline" aria-hidden="true">
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

      <aside
        aria-label="Navegação completa do MA-Professor"
        className="fixed inset-y-0 left-0 z-[110] hidden w-80 flex-col overflow-y-auto border-r border-white/10 bg-slate-950 p-5 text-white shadow-2xl shadow-black/30 xl:flex"
      >
        <SidebarPanel
          workspace={workspace}
          activeDestination={activeDestination}
          academicYearName={academicYearName}
          showCloseButton={false}
          onClose={() => setSidebarOpen(false)}
          onOpenToday={openToday}
          onOpenWorkspace={openWorkspace}
          onOpenDestination={openDestination}
        />
      </aside>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-[120] xl:hidden">
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
            <SidebarPanel
              workspace={workspace}
              activeDestination={activeDestination}
              academicYearName={academicYearName}
              showCloseButton
              onClose={() => setSidebarOpen(false)}
              onOpenToday={openToday}
              onOpenWorkspace={openWorkspace}
              onOpenDestination={openDestination}
            />
          </aside>
        </div>
      ) : null}

      <GIAESummaryExportPageAction />
    </>
  )
}
