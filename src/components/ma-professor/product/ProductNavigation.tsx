import { useMAProfessorAccess } from '../access/AccessGate'
import { getLicenseStatusLabel } from '../access/accessTypes'

export type ProductWorkspace = 'daily' | 'calendar' | 'menu'
export type ProductTheme = 'light' | 'dark'

interface ProductNavigationProps {
  workspace: ProductWorkspace
  academicYearName: string | null
  theme: ProductTheme
  onSelect: (workspace: ProductWorkspace) => void
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
    id: 'menu',
    label: 'Menu',
    icon: '☰'
  }
]

export function ProductNavigation({
  workspace,
  academicYearName,
  theme,
  onSelect,
  onToggleTheme
}: ProductNavigationProps) {
  const { session } = useMAProfessorAccess()

  const nextThemeLabel =
    theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'

  return (
    <header className="sticky top-0 z-[70] border-b border-white/10 bg-slate-950/95 text-white shadow-xl shadow-black/20 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1800px] items-center gap-2 px-2 py-2 sm:gap-3 sm:px-5">
        <button
          type="button"
          onClick={() => onSelect('daily')}
          className="hidden min-w-0 items-center gap-3 rounded-2xl px-2 py-1.5 text-left sm:flex"
          aria-label="Abrir as aulas de hoje"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyan-300 text-sm font-black text-slate-950">
            MA
          </span>

          <span className="min-w-0">
            <span className="block truncate text-sm font-black">
              MA-Professor
            </span>

            <span className="block truncate text-[0.65rem] font-semibold text-slate-500">
              {academicYearName || 'Configuração inicial'}
            </span>
          </span>
        </button>

        <nav className="grid min-w-0 flex-1 grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-slate-900/80 p-1">
          {items.map(item => {
            const active = workspace === item.id

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`min-w-0 rounded-xl px-2 py-2 text-center text-xs font-black transition sm:px-4 ${
                  active
                    ? 'bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-950/30'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="mr-1.5" aria-hidden="true">
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
  )
}
