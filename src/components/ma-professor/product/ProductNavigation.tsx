import { useMAProfessorAccess } from '../access/AccessGate'
import { getLicenseStatusLabel } from '../access/accessTypes'

export type ProductWorkspace =
  | 'application'
  | 'attendance'
  | 'schedule'
  | 'settings'

interface ProductNavigationProps {
  workspace: ProductWorkspace
  academicYearName: string | null
  onSelect: (workspace: ProductWorkspace) => void
}

const items: Array<{
  id: ProductWorkspace
  label: string
  shortLabel: string
  icon: string
}> = [
  {
    id: 'application',
    label: 'Aplicação',
    shortLabel: 'Início',
    icon: '⌂'
  },
  {
    id: 'attendance',
    label: 'Faltas',
    shortLabel: 'Faltas',
    icon: '✓'
  },
  {
    id: 'schedule',
    label: 'Horários',
    shortLabel: 'Horário',
    icon: '▦'
  },
  {
    id: 'settings',
    label: 'Definições',
    shortLabel: 'Definições',
    icon: '⚙'
  }
]

export function ProductNavigation({
  workspace,
  academicYearName,
  onSelect
}: ProductNavigationProps) {
  const { session } = useMAProfessorAccess()

  return (
    <header className="sticky top-0 z-[70] border-b border-white/10 bg-slate-950/95 text-white shadow-xl shadow-black/20 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1800px] items-center gap-3 px-3 py-2 sm:px-5">
        <button
          type="button"
          onClick={() => onSelect('application')}
          className="hidden min-w-0 items-center gap-3 rounded-2xl px-2 py-1.5 text-left sm:flex"
          aria-label="Abrir aplicação principal"
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

        <nav className="grid min-w-0 flex-1 grid-cols-4 gap-1 rounded-2xl border border-white/10 bg-slate-900/80 p-1">
          {items.map(item => {
            const active = workspace === item.id

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`min-w-0 rounded-xl px-2 py-2 text-center text-xs font-black transition sm:px-3 ${
                  active
                    ? 'bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-950/30'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="mr-1 hidden sm:inline" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="sm:hidden">{item.shortLabel}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            )
          })}
        </nav>

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
