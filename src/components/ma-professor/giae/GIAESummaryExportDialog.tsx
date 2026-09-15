import {
  type ChangeEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import {
  maProfessorRepository
} from '../repository'

import {
  giaeWorkspaceRepository,
  type GIAEWorkspaceFilters,
  type GIAEWorkspaceSnapshot
} from './giaeWorkspaceRepository'

import {
  exportGIAESummariesExcel,
  exportGIAESummariesPdf
} from './giaeSummaryExport'

interface GIAESummaryExportDialogProps {
  open: boolean
  onClose: () => void
}

type ExportScope =
  | 'filtered'
  | 'all'

type ExportKind =
  | 'pdf'
  | 'excel'

const emptyFilters: GIAEWorkspaceFilters = {
  query: '',
  dateFrom: null,
  dateTo: null,
  groupId: null,
  teachingAssignmentId: null,
  moduleId: null,
  state: null
}

function getErrorMessage(
  error: unknown
) {
  return error instanceof Error &&
    error.message.trim()
    ? error.message
    : 'Não foi possível preparar a exportação dos sumários.'
}

export default function GIAESummaryExportDialog({
  open,
  onClose
}: GIAESummaryExportDialogProps) {
  const [
    snapshot,
    setSnapshot
  ] = useState<GIAEWorkspaceSnapshot | null>(
    null
  )

  const [
    filters,
    setFilters
  ] = useState<GIAEWorkspaceFilters>(
    emptyFilters
  )

  const [
    scope,
    setScope
  ] = useState<ExportScope>(
    'filtered'
  )

  const [
    loading,
    setLoading
  ] = useState(false)

  const [
    exporting,
    setExporting
  ] = useState<ExportKind | null>(
    null
  )

  const [
    error,
    setError
  ] = useState('')

  const academicYearIdRef =
    useRef<string | null>(null)

  const requestSequenceRef =
    useRef(0)

  useEffect(() => {
    if (!open) {
      return
    }

    let active = true

    setFilters(emptyFilters)
    setScope('filtered')
    setSnapshot(null)
    setError('')
    setLoading(true)
    academicYearIdRef.current = null

    void maProfessorRepository
      .getActiveAcademicYear()
      .then(async academicYear => {
        if (!academicYear) {
          throw new Error(
            'Não existe um ano letivo ativo para exportar sumários.'
          )
        }

        academicYearIdRef.current =
          academicYear.id

        return giaeWorkspaceRepository.getWorkspace(
          academicYear.id,
          emptyFilters
        )
      })
      .then(nextSnapshot => {
        if (active) {
          setSnapshot(nextSnapshot)
        }
      })
      .catch(loadError => {
        if (active) {
          setError(
            getErrorMessage(loadError)
          )
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }

    const handleKeyDown =
      (event: KeyboardEvent) => {
        if (
          event.key === 'Escape' &&
          !exporting
        ) {
          onClose()
        }
      }

    window.addEventListener(
      'keydown',
      handleKeyDown
    )

    return () => {
      window.removeEventListener(
        'keydown',
        handleKeyDown
      )
    }
  }, [
    exporting,
    onClose,
    open
  ])

  const visibleAssignments =
    useMemo(
      () => {
        if (!snapshot) {
          return []
        }

        if (!filters.groupId) {
          return snapshot.assignments
        }

        return snapshot.assignments.filter(
          assignment =>
            assignment.groupId ===
            filters.groupId
        )
      },
      [
        filters.groupId,
        snapshot
      ]
    )

  const visibleModules =
    useMemo(
      () => {
        if (!snapshot) {
          return []
        }

        if (filters.teachingAssignmentId) {
          return snapshot.modules.filter(
            module =>
              module.teachingAssignmentId ===
              filters.teachingAssignmentId
          )
        }

        if (!filters.groupId) {
          return snapshot.modules
        }

        const assignmentIds =
          new Set(
            snapshot.assignments
              .filter(
                assignment =>
                  assignment.groupId ===
                  filters.groupId
              )
              .map(
                assignment =>
                  assignment.id
              )
          )

        return snapshot.modules.filter(
          module =>
            assignmentIds.has(
              module.teachingAssignmentId
            )
        )
      },
      [
        filters.groupId,
        filters.teachingAssignmentId,
        snapshot
      ]
    )

  async function applyFilters(
    nextFilters: GIAEWorkspaceFilters
  ) {
    const academicYearId =
      academicYearIdRef.current

    setFilters(nextFilters)
    setError('')

    if (!academicYearId) {
      return
    }

    requestSequenceRef.current += 1
    const requestSequence =
      requestSequenceRef.current

    setLoading(true)

    try {
      const nextSnapshot =
        await giaeWorkspaceRepository.getWorkspace(
          academicYearId,
          nextFilters
        )

      if (
        requestSequence ===
        requestSequenceRef.current
      ) {
        setSnapshot(nextSnapshot)
      }
    } catch (filterError) {
      if (
        requestSequence ===
        requestSequenceRef.current
      ) {
        setError(
          getErrorMessage(filterError)
        )
      }
    } finally {
      if (
        requestSequence ===
        requestSequenceRef.current
      ) {
        setLoading(false)
      }
    }
  }

  function handleGroupChange(
    event: ChangeEvent<HTMLSelectElement>
  ) {
    const groupId =
      event.target.value ||
      null

    const validAssignments =
      snapshot?.assignments.filter(
        assignment =>
          !groupId ||
          assignment.groupId ===
            groupId
      ) ?? []

    const teachingAssignmentId =
      filters.teachingAssignmentId &&
      validAssignments.some(
        assignment =>
          assignment.id ===
          filters.teachingAssignmentId
      )
        ? filters.teachingAssignmentId
        : null

    const moduleId =
      filters.moduleId &&
      snapshot?.modules.some(
        module =>
          module.id ===
            filters.moduleId &&
          validAssignments.some(
            assignment =>
              assignment.id ===
              module.teachingAssignmentId
          )
      )
        ? filters.moduleId
        : null

    void applyFilters({
      ...filters,
      groupId,
      teachingAssignmentId,
      moduleId
    })
  }

  function handleAssignmentChange(
    event: ChangeEvent<HTMLSelectElement>
  ) {
    const teachingAssignmentId =
      event.target.value ||
      null

    void applyFilters({
      ...filters,
      teachingAssignmentId,
      moduleId:
        filters.moduleId &&
        snapshot?.modules.some(
          module =>
            module.id ===
              filters.moduleId &&
            module.teachingAssignmentId ===
              teachingAssignmentId
        )
          ? filters.moduleId
          : null
    })
  }

  async function runExport(
    kind: ExportKind
  ) {
    const academicYearId =
      academicYearIdRef.current

    if (
      exporting ||
      !academicYearId ||
      !snapshot
    ) {
      return
    }

    setExporting(kind)
    setError('')

    try {
      const exportSnapshot =
        scope === 'all'
          ? await giaeWorkspaceRepository.getWorkspace(
              academicYearId,
              emptyFilters
            )
          : snapshot

      if (kind === 'pdf') {
        await exportGIAESummariesPdf(
          exportSnapshot
        )
      } else {
        await exportGIAESummariesExcel(
          exportSnapshot
        )
      }
    } catch (exportError) {
      setError(
        getErrorMessage(exportError)
      )
    } finally {
      setExporting(null)
    }
  }

  if (!open) {
    return null
  }

  const controlsDisabled =
    loading ||
    Boolean(exporting) ||
    scope === 'all'

  const exportCount =
    scope === 'all'
      ? snapshot?.totals.total ?? 0
      : snapshot?.visibleTotals.total ?? 0

  return (
    <div
      className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Exportar sumários"
    >
      <button
        type="button"
        aria-label="Fechar exportação de sumários"
        onClick={onClose}
        disabled={Boolean(exporting)}
        className="absolute inset-0 cursor-default"
      />

      <section className="relative max-h-[calc(100vh-2rem)] w-full max-w-4xl overflow-y-auto rounded-[2rem] border border-cyan-300/20 bg-slate-950 p-5 text-white shadow-2xl shadow-black/60 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">
              Sumários / GIAE
            </p>
            <h2 className="mt-2 text-2xl font-black">
              Exportar sumários
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Exporte todos os registos ou apenas a seleção definida pelos filtros, em PDF ou Excel.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={Boolean(exporting)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-lg font-black text-slate-300 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-40"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setScope('all')}
            className={`rounded-2xl border p-4 text-left transition ${
              scope === 'all'
                ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-50'
                : 'border-white/10 bg-white/[0.025] text-slate-300 hover:bg-white/[0.05]'
            }`}
          >
            <span className="block text-sm font-black">
              Todos os sumários
            </span>
            <span className="mt-1 block text-xs text-slate-500">
              Ignora os filtros abaixo.
            </span>
          </button>

          <button
            type="button"
            onClick={() => setScope('filtered')}
            className={`rounded-2xl border p-4 text-left transition ${
              scope === 'filtered'
                ? 'border-violet-300/40 bg-violet-300/10 text-violet-50'
                : 'border-white/10 bg-white/[0.025] text-slate-300 hover:bg-white/[0.05]'
            }`}
          >
            <span className="block text-sm font-black">
              Apenas os filtrados
            </span>
            <span className="mt-1 block text-xs text-slate-500">
              Usa turma, disciplina, UFCD, datas, estado e pesquisa.
            </span>
          </button>
        </div>

        <div className="mt-5 grid gap-4 rounded-[1.5rem] border border-white/10 bg-white/[0.025] p-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="block md:col-span-2">
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
              Pesquisa
            </span>
            <input
              type="search"
              value={filters.query}
              onChange={event =>
                void applyFilters({
                  ...filters,
                  query: event.target.value
                })
              }
              disabled={controlsDisabled}
              placeholder="Texto, turma, disciplina ou UFCD"
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/50 disabled:opacity-45"
            />
          </label>

          <label>
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
              Desde
            </span>
            <input
              type="date"
              value={filters.dateFrom ?? ''}
              min={snapshot?.academicYear.startDate}
              max={snapshot?.academicYear.endDate}
              onChange={event =>
                void applyFilters({
                  ...filters,
                  dateFrom:
                    event.target.value ||
                    null
                })
              }
              disabled={controlsDisabled}
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/50 disabled:opacity-45"
            />
          </label>

          <label>
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
              Até
            </span>
            <input
              type="date"
              value={filters.dateTo ?? ''}
              min={snapshot?.academicYear.startDate}
              max={snapshot?.academicYear.endDate}
              onChange={event =>
                void applyFilters({
                  ...filters,
                  dateTo:
                    event.target.value ||
                    null
                })
              }
              disabled={controlsDisabled}
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/50 disabled:opacity-45"
            />
          </label>

          <label>
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
              Turma
            </span>
            <select
              value={filters.groupId ?? ''}
              onChange={handleGroupChange}
              disabled={controlsDisabled}
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/50 disabled:opacity-45"
            >
              <option value="">Todas</option>
              {snapshot?.groups.map(group => (
                <option
                  key={group.id}
                  value={group.id}
                >
                  {group.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
              Disciplina
            </span>
            <select
              value={
                filters.teachingAssignmentId ??
                ''
              }
              onChange={handleAssignmentChange}
              disabled={controlsDisabled}
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/50 disabled:opacity-45"
            >
              <option value="">Todas</option>
              {visibleAssignments.map(assignment => (
                <option
                  key={assignment.id}
                  value={assignment.id}
                >
                  {assignment.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
              UFCD / módulo
            </span>
            <select
              value={filters.moduleId ?? ''}
              onChange={event =>
                void applyFilters({
                  ...filters,
                  moduleId:
                    event.target.value ||
                    null
                })
              }
              disabled={controlsDisabled}
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/50 disabled:opacity-45"
            >
              <option value="">Todos</option>
              {visibleModules.map(module => (
                <option
                  key={module.id}
                  value={module.id}
                >
                  {module.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
              Estado
            </span>
            <select
              value={filters.state ?? ''}
              onChange={event => {
                const value =
                  event.target.value

                void applyFilters({
                  ...filters,
                  state:
                    value === 'missing_summary' ||
                    value === 'pending' ||
                    value === 'submitted'
                      ? value
                      : null
                })
              }}
              disabled={controlsDisabled}
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/50 disabled:opacity-45"
            >
              <option value="">Todos</option>
              <option value="missing_summary">Sem sumário</option>
              <option value="pending">Por submeter</option>
              <option value="submitted">Submetido</option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <span>
            {loading
              ? 'A preparar seleção…'
              : `${exportCount} ${
                  exportCount === 1
                    ? 'registo será exportado'
                    : 'registos serão exportados'
                }.`}
          </span>

          {scope === 'filtered' ? (
            <button
              type="button"
              onClick={() =>
                void applyFilters(emptyFilters)
              }
              disabled={loading || Boolean(exporting)}
              className="font-bold text-cyan-200 transition hover:text-cyan-100 disabled:opacity-40"
            >
              Limpar filtros
            </button>
          ) : null}
        </div>

        {error ? (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/[0.07] px-4 py-3 text-sm font-semibold text-rose-100"
          >
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => void runExport('pdf')}
            disabled={
              loading ||
              Boolean(exporting) ||
              exportCount === 0
            }
            className="rounded-2xl border border-rose-300/25 bg-rose-300/10 px-4 py-3 text-sm font-black text-rose-50 transition hover:bg-rose-300/15 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {exporting === 'pdf'
              ? 'A exportar PDF…'
              : 'Exportar PDF'}
          </button>

          <button
            type="button"
            onClick={() => void runExport('excel')}
            disabled={
              loading ||
              Boolean(exporting) ||
              exportCount === 0
            }
            className="rounded-2xl border border-emerald-300/25 bg-emerald-300/10 px-4 py-3 text-sm font-black text-emerald-50 transition hover:bg-emerald-300/15 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {exporting === 'excel'
              ? 'A exportar Excel…'
              : 'Exportar Excel (.xlsx)'}
          </button>
        </div>
      </section>
    </div>
  )
}
