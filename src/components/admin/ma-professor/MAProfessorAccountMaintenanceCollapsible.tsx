import type {
  MAProfessorAdminOverview
} from '../../../lib/admin/maProfessorAdminApi'

import MAProfessorAccountMaintenance from './MAProfessorAccountMaintenance'

interface MAProfessorAccountMaintenanceCollapsibleProps {
  overview:
    MAProfessorAdminOverview | null
  loading?: boolean
  onChanged:
    () => Promise<void>
}

export default function MAProfessorAccountMaintenanceCollapsible({
  overview,
  loading = false,
  onChanged
}: MAProfessorAccountMaintenanceCollapsibleProps) {
  const emails =
    new Set<string>()

  for (
    const request of
    overview?.accessRequests || []
  ) {
    emails.add(
      request.email
        .trim()
        .toLowerCase()
    )
  }

  for (
    const license of
    overview?.licenses || []
  ) {
    emails.add(
      license.email
        .trim()
        .toLowerCase()
    )
  }

  for (
    const renewal of
    overview?.renewals || []
  ) {
    emails.add(
      renewal.email
        .trim()
        .toLowerCase()
    )
  }

  const userCount =
    emails.size

  return (
    <details className="mt-7 group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-[1.5rem] border border-rose-300/15 bg-slate-900/55 px-5 py-4 transition hover:bg-slate-900/75 sm:px-6">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-300">
            Manutenção de contas
          </p>

          <p className="mt-1 text-sm font-black text-slate-200">
            Reposição, eliminação e estado operacional
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1.5 text-xs font-black text-slate-400">
            {userCount}{' '}
            {userCount === 1
              ? 'utilizador'
              : 'utilizadores'}
          </span>

          <span
            aria-hidden="true"
            className="text-lg font-black text-slate-500 transition group-open:rotate-180"
          >
            ⌄
          </span>
        </div>
      </summary>

      <MAProfessorAccountMaintenance
        overview={overview}
        loading={loading}
        onChanged={onChanged}
      />
    </details>
  )
}
