import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useState
} from 'react'

import type {
  EntityId,
  PlanificationItemStatus
} from '../types'

import type {
  PlanificationItemDraft
} from '../repository'

import {
  getPlanificationItemStatusLabel,
  type CreatePlanificationWorkspaceInput,
  type PlanificationWorkspaceFilters,
  type PlanificationWorkspaceSnapshot,
  type UpdatePlanificationItemInput,
  type UpdatePlanificationWorkspaceInput
} from './planificationWorkspaceRepository'

interface PlanificationWorkspaceViewProps {
  snapshot: PlanificationWorkspaceSnapshot
  loading?: boolean
  error?: string
  onRefresh?: () => void

  onFiltersChange: (
    filters:
      PlanificationWorkspaceFilters
  ) => void

  onCreatePlanification: (
    input:
      CreatePlanificationWorkspaceInput
  ) => Promise<void> | void

  onUpdatePlanification: (
    planificationId:
      EntityId,

    changes:
      UpdatePlanificationWorkspaceInput
  ) => Promise<void> | void

  onAddItem: (
    planificationId:
      EntityId,

    draft:
      PlanificationItemDraft
  ) => Promise<void> | void

  onUpdateItem: (
    itemId:
      EntityId,

    changes:
      UpdatePlanificationItemInput
  ) => Promise<void> | void

  onDeleteItem: (
    itemId:
      EntityId
  ) => Promise<void> | void

  onReorderItems: (
    planificationId:
      EntityId,

    orderedIds:
      EntityId[]
  ) => Promise<void> | void

  onSetItemStatus: (
    itemId:
      EntityId,

    status:
      Extract<
        PlanificationItemStatus,
        'planned' | 'skipped'
      >
  ) => Promise<void> | void

  onImportLines: (
    planificationId:
      EntityId,

    text:
      string
  ) => Promise<void> | void

  onLessonSelect?: (
    lessonId:
      EntityId
  ) => void
}

type ItemDraft =
  Required<
    PlanificationItemDraft
  >

type ItemDrafts =
  Record<
    EntityId,
    ItemDraft
  >

type Feedback =
  | {
      tone:
        | 'success'
        | 'error'

      message:
        string
    }
  | null

type CreateForm = {
  title: string
  description: string
  lines: string
}

const emptyItem:
  ItemDraft = {
  content:
    '',

  activity:
    '',

  objectives:
    '',

  suggestedSummary:
    ''
}

const fieldClass =
  'w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm leading-6 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10 disabled:cursor-wait disabled:opacity-60'

function getErrorMessage(
  error: unknown
) {
  return error instanceof Error
    ? error.message
    : 'Ocorreu um erro inesperado.'
}

function moduleLabel(
  code: string,
  name: string
) {
  return code.trim()
    ? `${code.trim()} · ${name}`
    : name
}

function defaultTitle(
  snapshot:
    PlanificationWorkspaceSnapshot
) {
  const module =
    snapshot.selectedModule

  return module
    ? `Planificação — ${moduleLabel(
        module.code,
        module.name
      )}`
    : ''
}

function initialCreateForm(
  snapshot:
    PlanificationWorkspaceSnapshot
): CreateForm {
  return {
    title:
      defaultTitle(
        snapshot
      ),

    description:
      '',

    lines:
      ''
  }
}

function itemDraftsFromSnapshot(
  snapshot:
    PlanificationWorkspaceSnapshot
): ItemDrafts {
  return Object.fromEntries(
    snapshot.items.map(
      (
        {
          item
        }
      ) => [
        item.id,
        {
          content:
            item.content,

          activity:
            item.activity,

          objectives:
            item.objectives,

          suggestedSummary:
            item.suggestedSummary
        }
      ]
    )
  ) as ItemDrafts
}

function parseLines(
  text: string
): PlanificationItemDraft[] {
  const seen =
    new Set<string>()

  return text
    .split(
      /\r?\n/
    )
    .map(
      line =>
        line
          .trim()
          .replace(
            /\s+/g,
            ' '
          )
    )
    .filter(Boolean)
    .flatMap(
      line => {
        const key =
          line.toLocaleLowerCase(
            'pt-PT'
          )

        if (
          seen.has(
            key
          )
        ) {
          return []
        }

        seen.add(
          key
        )

        return [
          {
            content:
              line,

            activity:
              '',

            objectives:
              '',

            suggestedSummary:
              line
          }
        ]
      }
    )
}

function formatDate(
  value: string
) {
  const [
    year,
    month,
    day
  ] =
    value
      .split('-')
      .map(Number)

  if (
    !year ||
    !month ||
    !day
  ) {
    return value
  }

  return new Intl.DateTimeFormat(
    'pt-PT',
    {
      day:
        '2-digit',

      month:
        'short',

      year:
        'numeric'
    }
  ).format(
    new Date(
      year,
      month -
        1,
      day
    )
  )
}

function statusClass(
  status:
    PlanificationItemStatus
) {
  if (
    status ===
    'used'
  ) {
    return 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
  }

  if (
    status ===
    'skipped'
  ) {
    return 'border-slate-300/15 bg-slate-300/[0.07] text-slate-300'
  }

  return 'border-amber-300/20 bg-amber-300/10 text-amber-100'
}

function FieldLabel({
  children,
  optional = false
}: {
  children: string
  optional?: boolean
}) {
  return (
    <span className="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-slate-300">
      <span>
        {children}
      </span>

      {optional ? (
        <span className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-slate-600">
          Opcional
        </span>
      ) : null}
    </span>
  )
}

function MetricCard({
  label,
  value,
  detail,
  className
}: {
  label: string
  value: string | number
  detail: string
  className: string
}) {
  return (
    <article
      className={`rounded-2xl border p-4 ${className}`}
    >
      <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-2xl font-black text-white">
        {value}
      </p>

      <p className="mt-1 text-xs leading-5 text-slate-500">
        {detail}
      </p>
    </article>
  )
}

export default function PlanificationWorkspaceView({
  snapshot,
  loading = false,
  error = '',
  onRefresh,
  onFiltersChange,
  onCreatePlanification,
  onUpdatePlanification,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onReorderItems,
  onSetItemStatus,
  onImportLines,
  onLessonSelect
}: PlanificationWorkspaceViewProps) {
  const [
    createForm,
    setCreateForm
  ] =
    useState<CreateForm>(
      () =>
        initialCreateForm(
          snapshot
        )
    )

  const [
    metadataTitle,
    setMetadataTitle
  ] =
    useState(
      snapshot.planification
        ?.title ??
      ''
    )

  const [
    metadataDescription,
    setMetadataDescription
  ] =
    useState(
      snapshot.planification
        ?.description ??
      ''
    )

  const [
    itemDrafts,
    setItemDrafts
  ] =
    useState<ItemDrafts>(
      () =>
        itemDraftsFromSnapshot(
          snapshot
        )
    )

  const [
    newItem,
    setNewItem
  ] =
    useState<ItemDraft>(
      emptyItem
    )

  const [
    importText,
    setImportText
  ] =
    useState('')

  const [
    busyAction,
    setBusyAction
  ] =
    useState<
      string | null
    >(
      null
    )

  const [
    feedback,
    setFeedback
  ] =
    useState<Feedback>(
      null
    )

  useEffect(() => {
    setCreateForm(
      initialCreateForm(
        snapshot
      )
    )

    setMetadataTitle(
      snapshot.planification
        ?.title ??
      ''
    )

    setMetadataDescription(
      snapshot.planification
        ?.description ??
      ''
    )

    setItemDrafts(
      itemDraftsFromSnapshot(
        snapshot
      )
    )

    setNewItem(
      emptyItem
    )

    setImportText(
      ''
    )
  }, [
    snapshot.generatedAt
  ])

  const selectedModuleLabel =
    useMemo(
      () => {
        const module =
          snapshot.selectedModule

        return module
          ? moduleLabel(
              module.code,
              module.name
            )
          : 'Sem UFCD selecionada'
      },
      [
        snapshot.selectedModule
      ]
    )

  const busy =
    loading ||
    Boolean(
      busyAction
    )

  async function runAction(
    actionId:
      string,

    action:
      () =>
        Promise<void> |
        void,

    successMessage:
      string
  ) {
    if (
      busyAction
    ) {
      return
    }

    setBusyAction(
      actionId
    )

    setFeedback(
      null
    )

    try {
      await action()

      setFeedback({
        tone:
          'success',

        message:
          successMessage
      })
    } catch (
      actionError
    ) {
      setFeedback({
        tone:
          'error',

        message:
          getErrorMessage(
            actionError
          )
      })
    } finally {
      setBusyAction(
        null
      )
    }
  }

  function updateDraft(
    itemId:
      EntityId,

    changes:
      Partial<ItemDraft>
  ) {
    setItemDrafts(
      current => ({
        ...current,

        [itemId]: {
          ...(
            current[
              itemId
            ] ??
            emptyItem
          ),

          ...changes
        }
      })
    )
  }

  async function createPlanification(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    const assignmentId =
      snapshot.selectedAssignment
        ?.id

    const moduleId =
      snapshot.selectedModule
        ?.id

    if (
      !assignmentId ||
      !moduleId
    ) {
      setFeedback({
        tone:
          'error',

        message:
          'Selecione uma turma, disciplina e UFCD válidas.'
      })

      return
    }

    const items =
      parseLines(
        createForm.lines
      )

    if (
      !createForm.title.trim()
    ) {
      setFeedback({
        tone:
          'error',

        message:
          'Indique o título da planificação.'
      })

      return
    }

    if (
      !items.length
    ) {
      setFeedback({
        tone:
          'error',

        message:
          'Cole pelo menos um conteúdo, um por linha.'
      })

      return
    }

    await runAction(
      'create',
      () =>
        onCreatePlanification({
          academicYearId:
            snapshot.academicYear.id,

          teachingAssignmentId:
            assignmentId,

          moduleId,

          title:
            createForm.title,

          description:
            createForm.description,

          items
        }),
      'A planificação foi criada.'
    )
  }

  async function saveMetadata(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (
      !snapshot.planification
    ) {
      return
    }

    await runAction(
      'metadata',
      () =>
        onUpdatePlanification(
          snapshot.planification!.id,
          {
            title:
              metadataTitle,

            description:
              metadataDescription
          }
        ),
      'A identificação da planificação foi guardada.'
    )
  }

  async function addItem(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (
      !snapshot.planification
    ) {
      return
    }

    await runAction(
      'add-item',
      async () => {
        await onAddItem(
          snapshot.planification!.id,
          newItem
        )

        setNewItem(
          emptyItem
        )
      },
      'O novo item foi adicionado.'
    )
  }

  async function saveItem(
    itemId:
      EntityId
  ) {
    const draft =
      itemDrafts[
        itemId
      ]

    if (
      !draft
    ) {
      return
    }

    await runAction(
      `item-${itemId}`,
      () =>
        onUpdateItem(
          itemId,
          draft
        ),
      'O item foi guardado.'
    )
  }

  async function deleteItem(
    itemId:
      EntityId,

    label:
      string
  ) {
    const confirmed =
      window.confirm(
        `Eliminar o item “${label || 'Sem título'}”?`
      )

    if (
      !confirmed
    ) {
      return
    }

    await runAction(
      `delete-${itemId}`,
      () =>
        onDeleteItem(
          itemId
        ),
      'O item foi eliminado.'
    )
  }

  async function changeStatus(
    itemId:
      EntityId,

    status:
      Extract<
        PlanificationItemStatus,
        'planned' | 'skipped'
      >
  ) {
    await runAction(
      `status-${itemId}`,
      () =>
        onSetItemStatus(
          itemId,
          status
        ),
      status ===
        'skipped'
        ? 'O item foi marcado como ignorado.'
        : 'O item voltou a ficar planeado.'
    )
  }

  async function moveItem(
    itemId:
      EntityId,

    direction:
      | 'up'
      | 'down'
  ) {
    if (
      !snapshot.planification
    ) {
      return
    }

    const orderedIds =
      snapshot.items.map(
        row =>
          row.item.id
      )

    const index =
      orderedIds.indexOf(
        itemId
      )

    const target =
      direction ===
      'up'
        ? index -
          1
        : index +
          1

    if (
      index <
        0 ||
      target <
        0 ||
      target >=
        orderedIds.length
    ) {
      return
    }

    const next = [
      ...orderedIds
    ]

    const [
      moved
    ] =
      next.splice(
        index,
        1
      )

    next.splice(
      target,
      0,
      moved
    )

    await runAction(
      `move-${itemId}`,
      () =>
        onReorderItems(
          snapshot.planification!.id,
          next
        ),
      'A ordem foi atualizada.'
    )
  }

  async function importLines(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (
      !snapshot.planification
    ) {
      return
    }

    await runAction(
      'import',
      async () => {
        await onImportLines(
          snapshot.planification!.id,
          importText
        )

        setImportText(
          ''
        )
      },
      'Os novos itens foram importados.'
    )
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-cyan-300/15 bg-slate-950/75 shadow-2xl shadow-cyan-950/10 backdrop-blur-xl">
        <div className="border-b border-white/10 px-5 py-6 sm:px-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.14em] text-cyan-100">
                  Planificações
                </span>

                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[0.65rem] font-bold text-slate-400">
                  {snapshot.academicYear.name}
                </span>
              </div>

              <h1 className="mt-4 text-2xl font-black tracking-tight text-white sm:text-3xl">
                Conteúdos por UFCD
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
                Organize os conteúdos pela ordem em que pretende lecioná-los e acompanhe o que já foi utilizado.
              </p>
            </div>

            <button
              type="button"
              onClick={
                onRefresh
              }
              disabled={
                busy ||
                !onRefresh
              }
              className="rounded-2xl border border-white/10 bg-white/[0.045] px-5 py-3 text-sm font-black text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-wait disabled:opacity-50"
            >
              {loading
                ? 'A atualizar...'
                : 'Atualizar'}
            </button>
          </div>
        </div>

        <div className="grid gap-5 px-5 py-6 sm:px-7 xl:grid-cols-2">
          <label>
            <span className="mb-2 block text-sm font-bold text-slate-200">
              Turma e disciplina
            </span>

            <select
              value={
                snapshot.filters
                  .teachingAssignmentId ??
                ''
              }
              onChange={(
                event:
                  ChangeEvent<HTMLSelectElement>
              ) =>
                onFiltersChange({
                  teachingAssignmentId:
                    event.target.value ||
                    null,

                  moduleId:
                    null
                })
              }
              disabled={
                busy ||
                !snapshot
                  .assignmentOptions
                  .length
              }
              className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
            >
              {!snapshot
                .assignmentOptions
                .length ? (
                <option value="">
                  Sem turmas disponíveis
                </option>
              ) : null}

              {snapshot.assignmentOptions.map(
                option => (
                  <option
                    key={
                      option.assignment.id
                    }
                    value={
                      option.assignment.id
                    }
                  >
                    {option.label}
                  </option>
                )
              )}
            </select>
          </label>

          <label>
            <span className="mb-2 block text-sm font-bold text-slate-200">
              UFCD ou módulo
            </span>

            <select
              value={
                snapshot.filters
                  .moduleId ??
                ''
              }
              onChange={(
                event:
                  ChangeEvent<HTMLSelectElement>
              ) =>
                onFiltersChange({
                  teachingAssignmentId:
                    snapshot.filters
                      .teachingAssignmentId,

                  moduleId:
                    event.target.value ||
                    null
                })
              }
              disabled={
                busy ||
                !snapshot
                  .moduleOptions
                  .length
              }
              className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
            >
              {!snapshot
                .moduleOptions
                .length ? (
                <option value="">
                  Sem UFCD disponíveis
                </option>
              ) : null}

              {snapshot.moduleOptions.map(
                option => (
                  <option
                    key={
                      option.module.id
                    }
                    value={
                      option.module.id
                    }
                  >
                    {option.label}
                  </option>
                )
              )}
            </select>
          </label>
        </div>
      </section>

      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-rose-300/20 bg-rose-300/[0.07] p-4 text-sm leading-6 text-rose-100"
        >
          {error}
        </div>
      ) : null}

      {feedback ? (
        <div
          role="status"
          className={`rounded-2xl border p-4 text-sm leading-6 ${
            feedback.tone ===
            'success'
              ? 'border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-50'
              : 'border-rose-300/20 bg-rose-300/[0.07] text-rose-50'
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      {!snapshot.selectedAssignment ||
      !snapshot.selectedModule ? (
        <section className="rounded-[2rem] border border-dashed border-white/15 bg-slate-950/60 p-8 text-center">
          <p className="text-lg font-black text-white">
            Ainda não existem turmas e UFCD disponíveis.
          </p>

          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-500">
            Confirme a configuração inicial antes de criar uma planificação.
          </p>
        </section>
      ) : !snapshot.planification ? (
        <form
          onSubmit={
            createPlanification
          }
          className="rounded-[2rem] border border-amber-300/15 bg-slate-950/70 p-5 shadow-xl shadow-black/20 sm:p-7"
        >
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-200">
            Nova planificação
          </p>

          <h2 className="mt-3 text-xl font-black text-white">
            {selectedModuleLabel}
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            Cole os conteúdos, um por linha, para criar a sequência inicial.
          </p>

          <div className="mt-6 grid gap-5">
            <label>
              <FieldLabel>
                Título
              </FieldLabel>

              <input
                type="text"
                value={
                  createForm.title
                }
                onChange={(
                  event:
                    ChangeEvent<HTMLInputElement>
                ) =>
                  setCreateForm(
                    current => ({
                      ...current,

                      title:
                        event.target.value
                    })
                  )
                }
                disabled={
                  busy
                }
                required
                className={
                  fieldClass
                }
              />
            </label>

            <label>
              <FieldLabel optional>
                Descrição
              </FieldLabel>

              <textarea
                value={
                  createForm.description
                }
                onChange={(
                  event:
                    ChangeEvent<HTMLTextAreaElement>
                ) =>
                  setCreateForm(
                    current => ({
                      ...current,

                      description:
                        event.target.value
                    })
                  )
                }
                disabled={
                  busy
                }
                rows={
                  3
                }
                className={
                  fieldClass
                }
              />
            </label>

            <label>
              <FieldLabel>
                Conteúdos, um por linha
              </FieldLabel>

              <textarea
                value={
                  createForm.lines
                }
                onChange={(
                  event:
                    ChangeEvent<HTMLTextAreaElement>
                ) =>
                  setCreateForm(
                    current => ({
                      ...current,

                      lines:
                        event.target.value
                    })
                  )
                }
                disabled={
                  busy
                }
                rows={
                  10
                }
                placeholder={
                  'Introdução à UFCD\nConceitos fundamentais\nAplicação prática'
                }
                className={
                  fieldClass
                }
              />
            </label>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={
                busy
              }
              className="rounded-2xl border border-amber-200/30 bg-gradient-to-r from-amber-300 to-yellow-300 px-6 py-3 text-sm font-black text-slate-950 transition hover:brightness-110 disabled:opacity-60"
            >
              {busyAction ===
              'create'
                ? 'A criar...'
                : 'Criar planificação'}
            </button>
          </div>
        </form>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              label="Progresso"
              value={`${snapshot.totals.completionPercent}%`}
              detail="Utilizados ou ignorados."
              className="border-cyan-300/15 bg-cyan-300/[0.035]"
            />

            <MetricCard
              label="Total"
              value={
                snapshot.totals
                  .itemCount
              }
              detail="Itens da planificação."
              className="border-violet-300/15 bg-violet-300/[0.035]"
            />

            <MetricCard
              label="Planeados"
              value={
                snapshot.totals
                  .plannedCount
              }
              detail="Ainda por utilizar."
              className="border-amber-300/15 bg-amber-300/[0.035]"
            />

            <MetricCard
              label="Utilizados"
              value={
                snapshot.totals
                  .usedCount
              }
              detail="Ligados a aulas."
              className="border-emerald-300/15 bg-emerald-300/[0.035]"
            />

            <MetricCard
              label="Ignorados"
              value={
                snapshot.totals
                  .skippedCount
              }
              detail="Fora da sequência."
              className="border-slate-300/15 bg-slate-300/[0.035]"
            />
          </section>

          <form
            onSubmit={
              saveMetadata
            }
            className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-5 sm:p-7"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">
                  Identificação
                </p>

                <h2 className="mt-3 text-xl font-black text-white">
                  {selectedModuleLabel}
                </h2>

                <p className="mt-2 text-sm text-slate-400">
                  {snapshot.selectedGroup
                    ?.name}{' '}
                  ·{' '}
                  {snapshot.selectedSubject
                    ?.shortName
                    .trim() ||
                    snapshot.selectedSubject
                      ?.name}
                </p>
              </div>

              <button
                type="submit"
                disabled={
                  busy
                }
                className="rounded-xl border border-cyan-200/25 bg-cyan-300/10 px-4 py-2.5 text-xs font-black text-cyan-50 disabled:opacity-60"
              >
                {busyAction ===
                'metadata'
                  ? 'A guardar...'
                  : 'Guardar identificação'}
              </button>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <label>
                <FieldLabel>
                  Título
                </FieldLabel>

                <input
                  type="text"
                  value={
                    metadataTitle
                  }
                  onChange={(
                    event:
                      ChangeEvent<HTMLInputElement>
                  ) =>
                    setMetadataTitle(
                      event.target.value
                    )
                  }
                  disabled={
                    busy
                  }
                  className={
                    fieldClass
                  }
                />
              </label>

              <label>
                <FieldLabel optional>
                  Descrição
                </FieldLabel>

                <textarea
                  value={
                    metadataDescription
                  }
                  onChange={(
                    event:
                      ChangeEvent<HTMLTextAreaElement>
                  ) =>
                    setMetadataDescription(
                      event.target.value
                    )
                  }
                  disabled={
                    busy
                  }
                  rows={
                    3
                  }
                  className={
                    fieldClass
                  }
                />
              </label>
            </div>
          </form>

          <form
            onSubmit={
              importLines
            }
            className="rounded-[2rem] border border-violet-300/15 bg-violet-300/[0.035] p-5 sm:p-7"
          >
            <div className="grid gap-5 xl:grid-cols-[1fr_auto] xl:items-end">
              <label>
                <FieldLabel>
                  Importar mais conteúdos, um por linha
                </FieldLabel>

                <textarea
                  value={
                    importText
                  }
                  onChange={(
                    event:
                      ChangeEvent<HTMLTextAreaElement>
                  ) =>
                    setImportText(
                      event.target.value
                    )
                  }
                  disabled={
                    busy
                  }
                  rows={
                    4
                  }
                  placeholder="As linhas repetidas serão ignoradas."
                  className={
                    fieldClass
                  }
                />
              </label>

              <button
                type="submit"
                disabled={
                  busy ||
                  !importText.trim()
                }
                className="rounded-2xl border border-violet-200/25 bg-violet-300/10 px-5 py-3 text-sm font-black text-violet-50 disabled:opacity-45"
              >
                {busyAction ===
                'import'
                  ? 'A importar...'
                  : 'Importar linhas'}
              </button>
            </div>
          </form>

          <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-5 sm:p-7">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-200">
              Sequência de conteúdos
            </p>

            <h2 className="mt-3 text-xl font-black text-white">
              Itens da planificação
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              Os itens utilizados ficam ligados à aula correspondente. Os restantes podem ser editados, reordenados ou ignorados.
            </p>

            <div className="mt-5 space-y-4">
              {snapshot.items.map(
                (
                  {
                    item,
                    usedLesson
                  },
                  index
                ) => {
                  const draft =
                    itemDrafts[
                      item.id
                    ] ??
                    emptyItem

                  const used =
                    item.status ===
                    'used'

                  return (
                    <article
                      key={
                        item.id
                      }
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5"
                    >
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-slate-950/55 text-xs font-black text-slate-300">
                            {index +
                              1}
                          </span>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-white">
                              {draft.content ||
                                draft.activity ||
                                draft.suggestedSummary ||
                                'Item sem título'}
                            </p>

                            {usedLesson ? (
                              <p className="mt-1 text-xs text-emerald-200/75">
                                Utilizado em{' '}
                                {formatDate(
                                  usedLesson.date
                                )}{' '}
                                ·{' '}
                                {
                                  usedLesson.startTime
                                }
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full border px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.08em] ${statusClass(
                              item.status
                            )}`}
                          >
                            {getPlanificationItemStatusLabel(
                              item.status
                            )}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              void moveItem(
                                item.id,
                                'up'
                              )
                            }
                            disabled={
                              busy ||
                              index ===
                                0
                            }
                            aria-label="Mover item para cima"
                            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-slate-300 disabled:opacity-35"
                          >
                            ↑
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void moveItem(
                                item.id,
                                'down'
                              )
                            }
                            disabled={
                              busy ||
                              index ===
                                snapshot.items.length -
                                  1
                            }
                            aria-label="Mover item para baixo"
                            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-slate-300 disabled:opacity-35"
                          >
                            ↓
                          </button>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-4 lg:grid-cols-2">
                        {(
                          [
                            [
                              'content',
                              'Conteúdo'
                            ],
                            [
                              'activity',
                              'Atividade'
                            ],
                            [
                              'objectives',
                              'Objetivos'
                            ],
                            [
                              'suggestedSummary',
                              'Sugestão de sumário'
                            ]
                          ] as const
                        ).map(
                          (
                            [
                              key,
                              label
                            ]
                          ) => (
                            <label
                              key={
                                key
                              }
                            >
                              <FieldLabel optional>
                                {label}
                              </FieldLabel>

                              <textarea
                                value={
                                  draft[
                                    key
                                  ]
                                }
                                onChange={(
                                  event:
                                    ChangeEvent<HTMLTextAreaElement>
                                ) =>
                                  updateDraft(
                                    item.id,
                                    {
                                      [key]:
                                        event.target.value
                                    }
                                  )
                                }
                                disabled={
                                  busy
                                }
                                rows={
                                  3
                                }
                                className={
                                  fieldClass
                                }
                              />
                            </label>
                          )
                        )}
                      </div>

                      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap gap-2">
                          {used &&
                          usedLesson &&
                          onLessonSelect ? (
                            <button
                              type="button"
                              onClick={() =>
                                onLessonSelect(
                                  usedLesson.id
                                )
                              }
                              disabled={
                                busy
                              }
                              className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.07] px-3 py-2 text-xs font-black text-emerald-100"
                            >
                              Abrir aula
                            </button>
                          ) : null}

                          {!used ? (
                            <button
                              type="button"
                              onClick={() =>
                                void changeStatus(
                                  item.id,
                                  item.status ===
                                    'skipped'
                                    ? 'planned'
                                    : 'skipped'
                                )
                              }
                              disabled={
                                busy
                              }
                              className="rounded-xl border border-slate-300/15 bg-slate-300/[0.06] px-3 py-2 text-xs font-black text-slate-300"
                            >
                              {item.status ===
                              'skipped'
                                ? 'Voltar a planear'
                                : 'Marcar como ignorado'}
                            </button>
                          ) : null}

                          {!used ? (
                            <button
                              type="button"
                              onClick={() =>
                                void deleteItem(
                                  item.id,
                                  draft.content
                                )
                              }
                              disabled={
                                busy
                              }
                              className="rounded-xl border border-rose-300/20 bg-rose-300/[0.07] px-3 py-2 text-xs font-black text-rose-100"
                            >
                              Eliminar
                            </button>
                          ) : null}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            void saveItem(
                              item.id
                            )
                          }
                          disabled={
                            busy
                          }
                          className="rounded-xl border border-amber-200/25 bg-amber-300/10 px-4 py-2.5 text-xs font-black text-amber-50 disabled:opacity-60"
                        >
                          {busyAction ===
                          `item-${item.id}`
                            ? 'A guardar...'
                            : 'Guardar item'}
                        </button>
                      </div>
                    </article>
                  )
                }
              )}
            </div>
          </section>

          <form
            onSubmit={
              addItem
            }
            className="rounded-[2rem] border border-emerald-300/15 bg-emerald-300/[0.035] p-5 sm:p-7"
          >
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">
              Adicionar item
            </p>

            <h2 className="mt-3 text-xl font-black text-white">
              Novo conteúdo da sequência
            </h2>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {(
                [
                  [
                    'content',
                    'Conteúdo'
                  ],
                  [
                    'activity',
                    'Atividade'
                  ],
                  [
                    'objectives',
                    'Objetivos'
                  ],
                  [
                    'suggestedSummary',
                    'Sugestão de sumário'
                  ]
                ] as const
              ).map(
                (
                  [
                    key,
                    label
                  ]
                ) => (
                  <label
                    key={
                      key
                    }
                  >
                    <FieldLabel optional>
                      {label}
                    </FieldLabel>

                    <textarea
                      value={
                        newItem[
                          key
                        ]
                      }
                      onChange={(
                        event:
                          ChangeEvent<HTMLTextAreaElement>
                      ) =>
                        setNewItem(
                          current => ({
                            ...current,

                            [key]:
                              event.target.value
                          })
                        )
                      }
                      disabled={
                        busy
                      }
                      rows={
                        3
                      }
                      className={
                        fieldClass
                      }
                    />
                  </label>
                )
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="submit"
                disabled={
                  busy ||
                  !(
                    newItem.content.trim() ||
                    newItem.activity.trim() ||
                    newItem.objectives.trim() ||
                    newItem.suggestedSummary.trim()
                  )
                }
                className="rounded-2xl border border-emerald-200/30 bg-gradient-to-r from-emerald-300 to-teal-300 px-6 py-3 text-sm font-black text-slate-950 disabled:opacity-45"
              >
                {busyAction ===
                'add-item'
                  ? 'A adicionar...'
                  : 'Adicionar item'}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  )
}
