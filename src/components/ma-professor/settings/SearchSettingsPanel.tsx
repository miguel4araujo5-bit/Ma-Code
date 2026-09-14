import {
  type FormEvent,
  useEffect,
  useState
} from 'react'

import type { EntityId } from '../types'
import {
  searchMAProfessor,
  type MAProfessorSearchKind,
  type MAProfessorSearchResult
} from './searchRepository'

interface SearchSettingsPanelProps {
  academicYearId: EntityId | null
}

const kindLabels: Record<MAProfessorSearchKind, string> = {
  student: 'Aluno',
  lesson: 'Aula ou sumário',
  module: 'UFCD ou módulo',
  planification: 'Planificação',
  assessment: 'Avaliação',
  recovery: 'Recuperação',
  grade: 'Classificação'
}

function formatDate(value: string | null) {
  if (!value) {
    return ''
  }

  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(`${value}T12:00:00`))
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Não foi possível pesquisar.'
}

export function SearchSettingsPanel({
  academicYearId
}: SearchSettingsPanelProps) {
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<MAProfessorSearchKind | 'all'>(
    'all'
  )
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [results, setResults] = useState<MAProfessorSearchResult[]>([])
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const runSearch = async () => {
    setLoading(true)
    setError('')

    try {
      const nextResults = await searchMAProfessor({
        query,
        academicYearId,
        kind,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null
      })
      setResults(nextResults)
      setSearched(true)
    } catch (searchError) {
      setError(getErrorMessage(searchError))
      setSearched(true)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    void runSearch()
  }

  useEffect(() => {
    let cancelled = false

    setQuery('')
    setKind('all')
    setDateFrom('')
    setDateTo('')
    setResults([])
    setSearched(false)
    setLoading(true)
    setError('')

    void searchMAProfessor({
      query: '',
      academicYearId,
      kind: 'all',
      dateFrom: null,
      dateTo: null
    })
      .then(nextResults => {
        if (cancelled) {
          return
        }

        setResults(nextResults)
        setSearched(true)
      })
      .catch(searchError => {
        if (cancelled) {
          return
        }

        setError(getErrorMessage(searchError))
        setSearched(true)
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [academicYearId])

  const hasActiveFilters =
    Boolean(query.trim()) ||
    kind !== 'all' ||
    Boolean(dateFrom) ||
    Boolean(dateTo)

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
          Pesquisa global
        </p>
        <h2 className="mt-2 text-xl font-black text-white">
          Encontre qualquer registo
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Pesquise alunos, sumários, UFCD, conteúdos de planificações,
          avaliações, classificações e recuperações do ano letivo ativo.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-5 grid gap-3 lg:grid-cols-[minmax(220px,1fr)_200px_160px_160px_auto]"
        >
          <input
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Nome, número, UFCD, sumário, conteúdo…"
            aria-label="Texto a pesquisar"
            className="rounded-xl border border-white/10 bg-slate-950/75 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/50"
          />

          <select
            value={kind}
            onChange={event =>
              setKind(
                event.target.value as MAProfessorSearchKind | 'all'
              )
            }
            aria-label="Tipo de registo"
            className="rounded-xl border border-white/10 bg-slate-950/75 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/50"
          >
            <option value="all">Todos os tipos</option>
            {Object.entries(kindLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={dateFrom}
            onChange={event => setDateFrom(event.target.value)}
            aria-label="Data inicial"
            className="rounded-xl border border-white/10 bg-slate-950/75 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/50"
          />

          <input
            type="date"
            value={dateTo}
            onChange={event => setDateTo(event.target.value)}
            aria-label="Data final"
            className="rounded-xl border border-white/10 bg-slate-950/75 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/50"
          />

          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60"
          >
            {loading ? 'A pesquisar…' : 'Pesquisar'}
          </button>
        </form>

        <p className="mt-3 text-xs leading-5 text-slate-500">
          Pode escrever várias palavras por qualquer ordem. Sem filtros,
          são mostrados automaticamente os registos mais recentes.
        </p>
      </section>

      {error ? (
        <p className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-200">
          {error}
        </p>
      ) : null}

      {loading && !searched ? (
        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 sm:p-6">
          <p className="text-sm font-semibold text-slate-300">
            A carregar os registos do ano letivo…
          </p>
        </section>
      ) : null}

      {searched ? (
        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                Resultados
              </p>
              <h2 className="mt-1 text-xl font-black text-white">
                {results.length}{' '}
                {results.length === 1
                  ? 'registo encontrado'
                  : 'registos encontrados'}
              </h2>
            </div>
            {results.length === 150 ? (
              <p className="text-xs font-semibold text-amber-300">
                Mostrados os primeiros 150 resultados.
              </p>
            ) : null}
          </div>

          {results.length > 0 ? (
            <div className="mt-5 space-y-3">
              {results.map(result => (
                <article
                  key={result.id}
                  className="rounded-2xl border border-white/10 bg-slate-950/65 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-cyan-300/10 px-2.5 py-1 text-[0.65rem] font-black uppercase tracking-[0.12em] text-cyan-200">
                          {kindLabels[result.kind]}
                        </span>
                        {result.date ? (
                          <span className="text-xs font-semibold text-slate-500">
                            {formatDate(result.date)}
                          </span>
                        ) : null}
                      </div>
                      <h3 className="mt-2 break-words text-base font-black text-white">
                        {result.title}
                      </h3>
                      <p className="mt-1 text-xs font-semibold text-slate-400">
                        {result.subtitle}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-400">
                    {result.detail}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-white/10 px-5 py-10 text-center">
              <p className="text-sm font-bold text-slate-300">
                {hasActiveFilters
                  ? 'Não foram encontrados registos com estes filtros.'
                  : 'Não existem registos pesquisáveis no ano letivo ativo.'}
              </p>
              {hasActiveFilters ? (
                <p className="mt-1 text-xs text-slate-500">
                  Altere o texto, o tipo ou o intervalo de datas.
                </p>
              ) : null}
            </div>
          )}
        </section>
      ) : null}
    </div>
  )
}
