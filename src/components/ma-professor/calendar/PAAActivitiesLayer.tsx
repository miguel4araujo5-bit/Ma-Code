import {
  useEffect,
  useMemo,
  useState
} from 'react'

import type {
  AcademicYear,
  EntityId,
  ISODate
} from '../types'

const PAA_STORAGE_PREFIX =
  'ma-professor:paa:'

const PORTUGUESE_MONTHS: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12
}

export interface PAAActivity {
  id: EntityId
  academicYearId: EntityId
  title: string
  date: ISODate
  description: string
  source: 'manual' | 'imported'
  createdAt: string
  updatedAt: string
}

interface PAAImportPreviewRow {
  id: string
  selected: boolean
  title: string
  date: string
  description: string
  error: string
}

interface PAAActivitiesManagerProps {
  open: boolean
  academicYear: AcademicYear
  activities: PAAActivity[]
  initialSelectedActivityId?: EntityId | null
  onClose: () => void
  onChange: (activities: PAAActivity[]) => void
}

function normalizeText(
  value: string
) {
  return value
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .trim()
    .toLowerCase()
}

function createId() {
  if (
    typeof crypto !==
      'undefined' &&
    typeof crypto.randomUUID ===
      'function'
  ) {
    return crypto.randomUUID()
  }

  return (
    'paa-' +
    Date.now().toString(36) +
    '-' +
    Math.random()
      .toString(36)
      .slice(2, 10)
  )
}

function getStorageKey(
  academicYearId: EntityId
) {
  return (
    PAA_STORAGE_PREFIX +
    academicYearId
  )
}

function sortActivities(
  activities: PAAActivity[]
) {
  return [
    ...activities
  ].sort(
    (
      left,
      right
    ) =>
      left.date.localeCompare(
        right.date
      ) ||
      left.title.localeCompare(
        right.title,
        'pt-PT',
        {
          sensitivity: 'base'
        }
      )
  )
}

function isPAAActivity(
  value: unknown,
  academicYearId: EntityId
): value is PAAActivity {
  if (
    typeof value !==
      'object' ||
    value ===
      null
  ) {
    return false
  }

  const row =
    value as Record<
      string,
      unknown
    >

  return (
    typeof row.id ===
      'string' &&
    row.academicYearId ===
      academicYearId &&
    typeof row.title ===
      'string' &&
    typeof row.date ===
      'string' &&
    typeof row.description ===
      'string' &&
    (
      row.source ===
        'manual' ||
      row.source ===
        'imported'
    ) &&
    typeof row.createdAt ===
      'string' &&
    typeof row.updatedAt ===
      'string'
  )
}

export function loadPAAActivities(
  academicYearId: EntityId
): PAAActivity[] {
  if (
    typeof window ===
      'undefined'
  ) {
    return []
  }

  try {
    const raw =
      window.localStorage.getItem(
        getStorageKey(
          academicYearId
        )
      )

    if (!raw) {
      return []
    }

    const parsed =
      JSON.parse(raw)

    if (
      !Array.isArray(
        parsed
      )
    ) {
      return []
    }

    return sortActivities(
      parsed.filter(
        item =>
          isPAAActivity(
            item,
            academicYearId
          )
      )
    )
  } catch {
    return []
  }
}

function persistPAAActivities(
  academicYearId: EntityId,
  activities: PAAActivity[]
) {
  if (
    typeof window ===
      'undefined'
  ) {
    throw new Error(
      'O armazenamento local não está disponível.'
    )
  }

  window.localStorage.setItem(
    getStorageKey(
      academicYearId
    ),
    JSON.stringify(
      sortActivities(
        activities
      )
    )
  )
}

function parseISODate(
  value: ISODate
) {
  const [
    year,
    month,
    day
  ] = value
    .split('-')
    .map(Number)

  return new Date(
    year,
    month - 1,
    day
  )
}

function buildISODate(
  year: number,
  month: number,
  day: number
): ISODate | null {
  const date =
    new Date(
      year,
      month - 1,
      day
    )

  if (
    date.getFullYear() !==
      year ||
    date.getMonth() !==
      month - 1 ||
    date.getDate() !==
      day
  ) {
    return null
  }

  return [
    String(year)
      .padStart(4, '0'),
    String(month)
      .padStart(2, '0'),
    String(day)
      .padStart(2, '0')
  ].join('-')
}

function isWithinAcademicYear(
  value: string,
  academicYear: AcademicYear
) {
  return (
    value >=
      academicYear.startDate &&
    value <=
      academicYear.endDate
  )
}

function inferAcademicYearDate(
  day: number,
  month: number,
  academicYear: AcademicYear
) {
  const startYear =
    Number(
      academicYear.startDate
        .slice(0, 4)
    )

  const endYear =
    Number(
      academicYear.endDate
        .slice(0, 4)
    )

  const candidates =
    Array.from(
      new Set([
        startYear,
        endYear
      ])
    )

  for (
    const year of
      candidates
  ) {
    const candidate =
      buildISODate(
        year,
        month,
        day
      )

    if (
      candidate &&
      isWithinAcademicYear(
        candidate,
        academicYear
      )
    ) {
      return candidate
    }
  }

  return null
}

function parseDateValue(
  rawValue: string,
  academicYear: AcademicYear
): ISODate | null {
  const value =
    rawValue.trim()

  if (!value) {
    return null
  }

  const isoMatch =
    value.match(
      /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/
    )

  if (isoMatch) {
    return buildISODate(
      Number(
        isoMatch[1]
      ),
      Number(
        isoMatch[2]
      ),
      Number(
        isoMatch[3]
      )
    )
  }

  const numericMatch =
    value.match(
      /\b(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2,4}))?\b/
    )

  if (numericMatch) {
    const day =
      Number(
        numericMatch[1]
      )

    const month =
      Number(
        numericMatch[2]
      )

    if (
      numericMatch[3]
    ) {
      let year =
        Number(
          numericMatch[3]
        )

      if (year < 100) {
        year +=
          year >= 70
            ? 1900
            : 2000
      }

      return buildISODate(
        year,
        month,
        day
      )
    }

    return inferAcademicYearDate(
      day,
      month,
      academicYear
    )
  }

  const normalized =
    normalizeText(
      value
    )

  const monthNames =
    Object.keys(
      PORTUGUESE_MONTHS
    ).join('|')

  const textMatch =
    normalized.match(
      new RegExp(
        '\\b(\\d{1,2})\\s+(?:de\\s+)?(' +
          monthNames +
          ')(?:\\s+(?:de\\s+)?(\\d{4}))?\\b'
      )
    )

  if (!textMatch) {
    return null
  }

  const day =
    Number(
      textMatch[1]
    )

  const month =
    PORTUGUESE_MONTHS[
      textMatch[2]
    ]

  if (
    textMatch[3]
  ) {
    return buildISODate(
      Number(
        textMatch[3]
      ),
      month,
      day
    )
  }

  return inferAcademicYearDate(
    day,
    month,
    academicYear
  )
}

function detectDelimiter(
  header: string
) {
  const delimiters = [
    '\t',
    ';',
    '|'
  ]

  let best:
    string | null = null

  let bestCount = 0

  delimiters.forEach(
    delimiter => {
      const count =
        header.split(
          delimiter
        ).length -
        1

      if (
        count >
        bestCount
      ) {
        best =
          delimiter
        bestCount =
          count
      }
    }
  )

  return best
}

function splitLine(
  line: string,
  delimiter: string | null
) {
  if (delimiter) {
    return line
      .split(
        delimiter
      )
      .map(
        cell =>
          cell.trim()
      )
  }

  return line
    .trim()
    .split(
      /\s{2,}/
    )
    .map(
      cell =>
        cell.trim()
    )
}

function getRowError(
  title: string,
  date: string,
  academicYear: AcademicYear
) {
  if (
    !title.trim()
  ) {
    return 'Falta a atividade.'
  }

  if (!date) {
    return 'Falta uma data válida.'
  }

  if (
    !isWithinAcademicYear(
      date,
      academicYear
    )
  ) {
    return 'A data fica fora do ano letivo.'
  }

  return ''
}

function parsePAAImportText(
  text: string,
  academicYear: AcademicYear
): PAAImportPreviewRow[] {
  const lines =
    text
      .split(/\r?\n/)
      .map(
        line =>
          line.trim()
      )
      .filter(Boolean)

  if (
    lines.length <
      2
  ) {
    throw new Error(
      'Cole uma tabela com cabeçalho e pelo menos uma atividade.'
    )
  }

  const delimiter =
    detectDelimiter(
      lines[0]
    )

  const headers =
    splitLine(
      lines[0],
      delimiter
    )

  const normalizedHeaders =
    headers.map(
      normalizeText
    )

  const dateIndex =
    normalizedHeaders.findIndex(
      header =>
        header ===
          'data' ||
        header.startsWith(
          'data '
        )
    )

  if (
    dateIndex ===
      -1
  ) {
    throw new Error(
      'Não foi encontrada uma coluna chamada “Data”.'
    )
  }

  const titleHeaderNames =
    new Set([
      'atividade',
      'atividade/projeto',
      'atividade projeto',
      'designacao',
      'titulo',
      'nome',
      'acao'
    ])

  let titleIndex =
    normalizedHeaders.findIndex(
      header =>
        titleHeaderNames.has(
          header
        )
    )

  if (
    titleIndex ===
      -1
  ) {
    titleIndex =
      headers.findIndex(
        (
          _,
          index
        ) =>
          index !==
          dateIndex
      )
  }

  return lines
    .slice(1)
    .map(
      (
        line,
        index
      ) => {
        const cells =
          splitLine(
            line,
            delimiter
          )

        const rawDate =
          cells[
            dateIndex
          ] ?? ''

        const date =
          parseDateValue(
            rawDate,
            academicYear
          ) ?? ''

        const title =
          (
            cells[
              titleIndex
            ] ?? ''
          ).trim()

        const description =
          cells
            .map(
              (
                cell,
                cellIndex
              ) => ({
                cell:
                  cell.trim(),
                cellIndex
              })
            )
            .filter(
              item =>
                item.cell &&
                item.cellIndex !==
                  dateIndex &&
                item.cellIndex !==
                  titleIndex
            )
            .map(
              item =>
                item.cell
            )
            .join(' · ')

        return {
          id:
            'preview-' +
            index +
            '-' +
            createId(),
          selected: true,
          title,
          date,
          description,
          error:
            getRowError(
              title,
              date,
              academicYear
            )
        }
      }
    )
}

function formatDate(
  value: ISODate
) {
  return new Intl.DateTimeFormat(
    'pt-PT',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }
  ).format(
    parseISODate(
      value
    )
  )
}

export default function PAAActivitiesManager({
  open,
  academicYear,
  activities,
  initialSelectedActivityId = null,
  onClose,
  onChange
}: PAAActivitiesManagerProps) {
  const [
    selectedIds,
    setSelectedIds
  ] =
    useState<Set<EntityId>>(
      () =>
        new Set()
    )

  const [
    editorOpen,
    setEditorOpen
  ] =
    useState(false)

  const [
    editingId,
    setEditingId
  ] =
    useState<EntityId | null>(
      null
    )

  const [
    draftTitle,
    setDraftTitle
  ] =
    useState('')

  const [
    draftDate,
    setDraftDate
  ] =
    useState('')

  const [
    draftDescription,
    setDraftDescription
  ] =
    useState('')

  const [
    importOpen,
    setImportOpen
  ] =
    useState(false)

  const [
    importText,
    setImportText
  ] =
    useState('')

  const [
    importRows,
    setImportRows
  ] =
    useState<PAAImportPreviewRow[]>(
      []
    )

  const [
    importError,
    setImportError
  ] =
    useState('')

  const [
    actionError,
    setActionError
  ] =
    useState('')

  const selectedCount =
    selectedIds.size

  const allSelected =
    activities.length >
      0 &&
    selectedIds.size ===
      activities.length

  const validImportCount =
    useMemo(
      () =>
        importRows.filter(
          row =>
            row.selected &&
            !row.error
        ).length,
      [
        importRows
      ]
    )

  useEffect(() => {
    if (!open) {
      return
    }

    setSelectedIds(
      new Set()
    )
    setActionError('')

    if (
      initialSelectedActivityId
    ) {
      const selected =
        activities.find(
          activity =>
            activity.id ===
            initialSelectedActivityId
        )

      if (selected) {
        setEditingId(
          selected.id
        )
        setDraftTitle(
          selected.title
        )
        setDraftDate(
          selected.date
        )
        setDraftDescription(
          selected.description
        )
        setEditorOpen(true)
        return
      }
    }

    setEditorOpen(false)
    setEditingId(null)
  }, [
    open,
    initialSelectedActivityId
  ])

  if (!open) {
    return null
  }

  function applyActivities(
    nextActivities: PAAActivity[]
  ) {
    const sorted =
      sortActivities(
        nextActivities
      )

    persistPAAActivities(
      academicYear.id,
      sorted
    )

    onChange(
      sorted
    )
  }

  function openNewActivity() {
    const today =
      new Date()

    const todayISO =
      [
        String(
          today.getFullYear()
        ).padStart(
          4,
          '0'
        ),
        String(
          today.getMonth() +
            1
        ).padStart(
          2,
          '0'
        ),
        String(
          today.getDate()
        ).padStart(
          2,
          '0'
        )
      ].join('-')

    setEditingId(null)
    setDraftTitle('')
    setDraftDate(
      isWithinAcademicYear(
        todayISO,
        academicYear
      )
        ? todayISO
        : academicYear.startDate
    )
    setDraftDescription('')
    setEditorOpen(true)
    setImportOpen(false)
    setActionError('')
  }

  function openEditActivity(
    activity: PAAActivity
  ) {
    setEditingId(
      activity.id
    )
    setDraftTitle(
      activity.title
    )
    setDraftDate(
      activity.date
    )
    setDraftDescription(
      activity.description
    )
    setEditorOpen(true)
    setImportOpen(false)
    setActionError('')
  }

  function saveEditor() {
    const error =
      getRowError(
        draftTitle,
        draftDate,
        academicYear
      )

    if (error) {
      setActionError(
        error
      )
      return
    }

    try {
      const timestamp =
        new Date()
          .toISOString()

      if (editingId) {
        applyActivities(
          activities.map(
            activity =>
              activity.id ===
                editingId
                ? {
                    ...activity,
                    title:
                      draftTitle.trim(),
                    date:
                      draftDate as ISODate,
                    description:
                      draftDescription.trim(),
                    updatedAt:
                      timestamp
                  }
                : activity
          )
        )
      } else {
        applyActivities([
          ...activities,
          {
            id:
              createId(),
            academicYearId:
              academicYear.id,
            title:
              draftTitle.trim(),
            date:
              draftDate as ISODate,
            description:
              draftDescription.trim(),
            source:
              'manual',
            createdAt:
              timestamp,
            updatedAt:
              timestamp
          }
        ])
      }

      setEditorOpen(false)
      setEditingId(null)
      setActionError('')
    } catch {
      setActionError(
        'Não foi possível guardar a atividade do PAA no armazenamento local.'
      )
    }
  }

  function deleteActivity(
    activityId: EntityId
  ) {
    if (
      !window.confirm(
        'Apagar esta atividade do PAA?'
      )
    ) {
      return
    }

    try {
      applyActivities(
        activities.filter(
          activity =>
            activity.id !==
            activityId
        )
      )

      setSelectedIds(
        current => {
          const next =
            new Set(
              current
            )
          next.delete(
            activityId
          )
          return next
        }
      )

      if (
        editingId ===
          activityId
      ) {
        setEditorOpen(false)
        setEditingId(null)
      }
    } catch {
      setActionError(
        'Não foi possível apagar a atividade.'
      )
    }
  }

  function deleteSelected() {
    if (
      selectedIds.size ===
        0
    ) {
      return
    }

    if (
      !window.confirm(
        'Apagar as ' +
          selectedIds.size +
          ' atividades selecionadas do PAA?'
      )
    ) {
      return
    }

    try {
      applyActivities(
        activities.filter(
          activity =>
            !selectedIds.has(
              activity.id
            )
        )
      )
      setSelectedIds(
        new Set()
      )
      setEditorOpen(false)
      setEditingId(null)
    } catch {
      setActionError(
        'Não foi possível apagar as atividades selecionadas.'
      )
    }
  }

  function analyzeImport() {
    setImportError('')

    try {
      const rows =
        parsePAAImportText(
          importText,
          academicYear
        )

      setImportRows(
        rows
      )
    } catch (
      error
    ) {
      setImportRows([])
      setImportError(
        error instanceof
          Error
          ? error.message
          : 'Não foi possível analisar o texto.'
      )
    }
  }

  function updateImportRow(
    rowId: string,
    patch: Partial<
      Pick<
        PAAImportPreviewRow,
        | 'selected'
        | 'title'
        | 'date'
        | 'description'
      >
    >
  ) {
    setImportRows(
      current =>
        current.map(
          row => {
            if (
              row.id !==
                rowId
            ) {
              return row
            }

            const next = {
              ...row,
              ...patch
            }

            return {
              ...next,
              error:
                getRowError(
                  next.title,
                  next.date,
                  academicYear
                )
            }
          }
        )
    )
  }

  function saveImport() {
    const rows =
      importRows.filter(
        row =>
          row.selected &&
          !row.error
      )

    if (
      rows.length ===
        0
    ) {
      setImportError(
        'Selecione pelo menos uma linha válida para gravar.'
      )
      return
    }

    const existingKeys =
      new Set(
        activities.map(
          activity =>
            activity.date +
            '|' +
            normalizeText(
              activity.title
            )
        )
      )

    const timestamp =
      new Date()
        .toISOString()

    const imported:
      PAAActivity[] = []

    rows.forEach(
      row => {
        const key =
          row.date +
          '|' +
          normalizeText(
            row.title
          )

        if (
          existingKeys.has(
            key
          )
        ) {
          return
        }

        existingKeys.add(
          key
        )

        imported.push({
          id:
            createId(),
          academicYearId:
            academicYear.id,
          title:
            row.title.trim(),
          date:
            row.date as ISODate,
          description:
            row.description.trim(),
          source:
            'imported',
          createdAt:
            timestamp,
          updatedAt:
            timestamp
        })
      }
    )

    if (
      imported.length ===
        0
    ) {
      setImportError(
        'As linhas selecionadas já existem no PAA.'
      )
      return
    }

    try {
      applyActivities([
        ...activities,
        ...imported
      ])
      setImportRows([])
      setImportText('')
      setImportError('')
      setImportOpen(false)
    } catch {
      setImportError(
        'Não foi possível gravar as atividades importadas.'
      )
    }
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-sm sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ma-professor-paa-title"
    >
      <section className="max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-[2rem] border border-fuchsia-300/20 bg-slate-950 p-5 text-white shadow-2xl shadow-black/60 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-fuchsia-200">
              Calendário · camada informativa
            </p>

            <h2
              id="ma-professor-paa-title"
              className="mt-3 text-2xl font-black sm:text-3xl"
            >
              Plano Anual de Atividades (PAA)
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Estas atividades aparecem apenas na vista mensal do Calendário. Não criam aulas e não alteram horários, sumários nem planificações.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-lg font-black text-slate-300 transition hover:bg-white/[0.08]"
          >
            ×
          </button>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={openNewActivity}
            className="rounded-xl border border-fuchsia-200/25 bg-fuchsia-300/10 px-4 py-2.5 text-sm font-black text-fuchsia-50 transition hover:bg-fuchsia-300/15"
          >
            + Adicionar atividade
          </button>

          <button
            type="button"
            onClick={() => {
              setImportOpen(
                current =>
                  !current
              )
              setEditorOpen(false)
              setActionError('')
            }}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-slate-200 transition hover:bg-white/[0.08]"
          >
            Importar por texto
          </button>
        </div>

        {actionError ? (
          <p className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/[0.07] p-3 text-sm text-rose-100">
            {actionError}
          </p>
        ) : null}

        {editorOpen ? (
          <section className="mt-6 rounded-[1.5rem] border border-fuchsia-300/15 bg-fuchsia-300/[0.035] p-4 sm:p-5">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-black">
                {editingId
                  ? 'Editar atividade'
                  : 'Nova atividade'}
              </h3>

              <button
                type="button"
                onClick={() => {
                  setEditorOpen(false)
                  setEditingId(null)
                  setActionError('')
                }}
                className="text-sm font-bold text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[14rem_1fr]">
              <label>
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                  Data
                </span>

                <input
                  type="date"
                  min={academicYear.startDate}
                  max={academicYear.endDate}
                  value={draftDate}
                  onChange={event =>
                    setDraftDate(
                      event.target.value
                    )
                  }
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm text-white outline-none focus:border-fuchsia-300/40"
                />
              </label>

              <label>
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                  Atividade
                </span>

                <input
                  value={draftTitle}
                  onChange={event =>
                    setDraftTitle(
                      event.target.value
                    )
                  }
                  placeholder="Nome da atividade"
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-fuchsia-300/40"
                />
              </label>
            </div>

            <label className="mt-4 block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                Informação adicional
              </span>

              <textarea
                rows={3}
                value={draftDescription}
                onChange={event =>
                  setDraftDescription(
                    event.target.value
                  )
                }
                placeholder="Opcional"
                className="w-full resize-y rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-fuchsia-300/40"
              />
            </label>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={saveEditor}
                className="rounded-xl bg-fuchsia-200 px-5 py-2.5 text-sm font-black text-slate-950 transition hover:brightness-110"
              >
                Guardar atividade
              </button>
            </div>
          </section>
        ) : null}

        {importOpen ? (
          <section className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/[0.025] p-4 sm:p-5">
            <h3 className="text-lg font-black">
              Importar PAA por texto
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              Cole a tabela do PAA. O importador procura a coluna chamada “Data”, identifica a atividade e mostra uma revisão antes de gravar.
            </p>

            <textarea
              rows={8}
              value={importText}
              onChange={event =>
                setImportText(
                  event.target.value
                )
              }
              placeholder={"Data\tAtividade\tObservações\n18/09/2026\tReceção aos alunos\tAuditório"}
              className="mt-4 w-full resize-y rounded-xl border border-white/10 bg-slate-900 px-3 py-3 font-mono text-xs leading-6 text-white outline-none placeholder:text-slate-600 focus:border-fuchsia-300/40"
            />

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={analyzeImport}
                className="rounded-xl border border-fuchsia-200/25 bg-fuchsia-300/10 px-4 py-2.5 text-sm font-black text-fuchsia-50 transition hover:bg-fuchsia-300/15"
              >
                Analisar texto
              </button>

              {importRows.length > 0 ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setImportRows(
                        current =>
                          current.map(
                            row => ({
                              ...row,
                              selected:
                                true
                            })
                          )
                      )
                    }
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-bold text-slate-300"
                  >
                    Selecionar todas
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setImportRows(
                        current =>
                          current.map(
                            row => ({
                              ...row,
                              selected:
                                false
                            })
                          )
                      )
                    }
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-bold text-slate-300"
                  >
                    Desmarcar todas
                  </button>
                </>
              ) : null}
            </div>

            {importError ? (
              <p className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/[0.07] p-3 text-sm text-rose-100">
                {importError}
              </p>
            ) : null}

            {importRows.length > 0 ? (
              <div className="mt-5 space-y-3">
                {importRows.map(
                  row => (
                    <div
                      key={row.id}
                      className="grid gap-3 rounded-xl border border-white/10 bg-slate-900/70 p-3 lg:grid-cols-[2rem_10rem_1fr_1fr]"
                    >
                      <label className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={event =>
                            updateImportRow(
                              row.id,
                              {
                                selected:
                                  event.target.checked
                              }
                            )
                          }
                          className="h-4 w-4 accent-fuchsia-300"
                        />
                      </label>

                      <input
                        type="date"
                        min={academicYear.startDate}
                        max={academicYear.endDate}
                        value={row.date}
                        onChange={event =>
                          updateImportRow(
                            row.id,
                            {
                              date:
                                event.target.value
                            }
                          )
                        }
                        className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white outline-none"
                      />

                      <input
                        value={row.title}
                        onChange={event =>
                          updateImportRow(
                            row.id,
                            {
                              title:
                                event.target.value
                            }
                          )
                        }
                        className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white outline-none"
                      />

                      <div>
                        <input
                          value={row.description}
                          onChange={event =>
                            updateImportRow(
                              row.id,
                              {
                                description:
                                  event.target.value
                              }
                            )
                          }
                          placeholder="Informação adicional"
                          className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white outline-none placeholder:text-slate-600"
                        />

                        {row.error ? (
                          <p className="mt-1 text-[0.68rem] font-bold text-rose-200">
                            {row.error}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  )
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <p className="text-xs text-slate-500">
                    {validImportCount} linha(s) válida(s) selecionada(s).
                  </p>

                  <button
                    type="button"
                    onClick={saveImport}
                    disabled={validImportCount === 0}
                    className="rounded-xl bg-fuchsia-200 px-5 py-2.5 text-sm font-black text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Gravar selecionadas
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="mt-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-black">
                Atividades gravadas
              </h3>

              <p className="mt-1 text-xs text-slate-500">
                {activities.length} atividade(s) neste ano letivo.
              </p>
            </div>

            {activities.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedIds(
                      allSelected
                        ? new Set()
                        : new Set(
                            activities.map(
                              activity =>
                                activity.id
                            )
                          )
                    )
                  }
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-300"
                >
                  {allSelected
                    ? 'Desmarcar todas'
                    : 'Selecionar todas'}
                </button>

                <button
                  type="button"
                  onClick={deleteSelected}
                  disabled={selectedCount === 0}
                  className="rounded-xl border border-rose-300/20 bg-rose-300/[0.06] px-3 py-2 text-xs font-black text-rose-100 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  Apagar selecionadas ({selectedCount})
                </button>
              </div>
            ) : null}
          </div>

          {activities.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">
              Ainda não existem atividades do PAA.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {activities.map(
                activity => (
                  <article
                    key={activity.id}
                    className="flex flex-col gap-3 rounded-xl border border-fuchsia-300/10 bg-fuchsia-300/[0.025] p-4 lg:flex-row lg:items-center"
                  >
                    <label className="flex shrink-0 items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(
                          activity.id
                        )}
                        onChange={event =>
                          setSelectedIds(
                            current => {
                              const next =
                                new Set(
                                  current
                                )

                              if (
                                event.target.checked
                              ) {
                                next.add(
                                  activity.id
                                )
                              } else {
                                next.delete(
                                  activity.id
                                )
                              }

                              return next
                            }
                          )
                        }
                        className="h-4 w-4 accent-fuchsia-300"
                      />

                      <span className="w-24 text-xs font-black uppercase tracking-[0.08em] text-fuchsia-200">
                        {formatDate(
                          activity.date
                        )}
                      </span>
                    </label>

                    <div className="min-w-0 flex-1">
                      <p className="font-black text-white">
                        {activity.title}
                      </p>

                      {activity.description ? (
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {activity.description}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          openEditActivity(
                            activity
                          )
                        }
                        className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-200"
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          deleteActivity(
                            activity.id
                          )
                        }
                        className="rounded-lg border border-rose-300/15 bg-rose-300/[0.05] px-3 py-2 text-xs font-bold text-rose-100"
                      >
                        Apagar
                      </button>
                    </div>
                  </article>
                )
              )}
            </div>
          )}
        </section>
      </section>
    </div>
  )
}
