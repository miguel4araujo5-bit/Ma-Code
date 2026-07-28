import {
  type FormEvent,
  useMemo,
  useState
} from 'react'

import {
  maProfessorRepository,
  type PlanificationItemDraft,
  type SetupSnapshot
} from '../repository'

import type {
  EntityId
} from '../types'

type PlanificationsSetupStepProps = {
  snapshot: SetupSnapshot
  onSnapshotChange: (
    snapshot: SetupSnapshot
  ) => void
  onCompleted: (
    snapshot: SetupSnapshot
  ) => void
}

type PlanificationFormState = {
  teachingAssignmentId: EntityId
  moduleId: EntityId
  title: string
  description: string
}

type PlanificationItemForm = {
  localId: string
  content: string
  activity: string
  objectives: string
  suggestedSummary: string
}

const emptyForm: PlanificationFormState = {
  teachingAssignmentId: '',
  moduleId: '',
  title: '',
  description: ''
}

const inputClassName =
  'w-full rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10'

const textareaClassName =
  'min-h-28 w-full resize-y rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3.5 text-sm leading-6 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10'

function createLocalId() {
  const uuid =
    globalThis.crypto
      ?.randomUUID?.()

  if (uuid) {
    return uuid
  }

  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`
}

function createEmptyItem():
  PlanificationItemForm {
  return {
    localId:
      createLocalId(),
    content: '',
    activity: '',
    objectives: '',
    suggestedSummary: ''
  }
}

function getErrorMessage(
  error: unknown
) {
  if (
    error instanceof Error
  ) {
    return error.message
  }

  return 'Ocorreu um erro inesperado.'
}

function normalizeComparisonText(
  value: string
) {
  return value
    .trim()
    .replace(
      /\s+/g,
      ' '
    )
    .toLocaleLowerCase(
      'pt-PT'
    )
}

function getModuleLabel(
  code: string,
  name: string
) {
  return code
    ? `${code} — ${name}`
    : name
}

function getDefaultPlanificationTitle(
  code: string,
  name: string
) {
  return `Planificação — ${getModuleLabel(
    code,
    name
  )}`
}

function FieldLabel({
  children,
  optional = false
}: {
  children: string
  optional?: boolean
}) {
  return (
    <span className="mb-2 flex items-center justify-between gap-3 text-sm font-bold text-slate-200">
      <span>
        {children}
      </span>

      {optional ? (
        <span className="text-xs font-medium text-slate-500">
          Opcional
        </span>
      ) : null}
    </span>
  )
}

function PlanificationStatus({
  configured
}: {
  configured: boolean
}) {
  return (
    <span
      className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
        configured
          ? 'border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-100'
          : 'border-amber-300/20 bg-amber-300/[0.08] text-amber-100'
      }`}
    >
      {configured
        ? 'Configurada'
        : 'Em falta'}
    </span>
  )
}

export default function PlanificationsSetupStep({
  snapshot,
  onSnapshotChange,
  onCompleted
}: PlanificationsSetupStepProps) {
  const [
    form,
    setForm
  ] =
    useState<PlanificationFormState>(
      emptyForm
    )

  const [
    items,
    setItems
  ] =
    useState<
      PlanificationItemForm[]
    >([
      createEmptyItem()
    ])

  const [
    importText,
    setImportText
  ] =
    useState('')

  const [
    busy,
    setBusy
  ] =
    useState(false)

  const [
    error,
    setError
  ] =
    useState('')

  const [
    success,
    setSuccess
  ] =
    useState('')

  const assignments =
    useMemo(
      () =>
        snapshot
          .teachingAssignments
          .filter(
            (
              assignment
            ) =>
              assignment.active
          )
          .sort(
            (
              left,
              right
            ) =>
              left.displayName.localeCompare(
                right.displayName,
                'pt-PT',
                {
                  numeric: true,
                  sensitivity:
                    'base'
                }
              )
          ),
      [
        snapshot
          .teachingAssignments
      ]
    )

  const assignmentById =
    useMemo(
      () =>
        new Map(
          assignments.map(
            (
              assignment
            ) => [
              assignment.id,
              assignment
            ]
          )
        ),
      [
        assignments
      ]
    )

  const moduleById =
    useMemo(
      () =>
        new Map(
          snapshot.modules.map(
            (
              module
            ) => [
              module.id,
              module
            ]
          )
        ),
      [
        snapshot.modules
      ]
    )

  const modulesByAssignment =
    useMemo(() => {
      const result =
        new Map<
          EntityId,
          typeof snapshot.modules
        >()

      assignments.forEach(
        (
          assignment
        ) => {
          result.set(
            assignment.id,
            []
          )
        }
      )

      snapshot.modules
        .filter(
          (
            module
          ) =>
            module.active
        )
        .forEach(
          (
            module
          ) => {
            const current =
              result.get(
                module.teachingAssignmentId
              ) ??
              []

            current.push(
              module
            )

            result.set(
              module.teachingAssignmentId,
              current
            )
          }
        )

      result.forEach(
        (
          modules
        ) => {
          modules.sort(
            (
              left,
              right
            ) =>
              left.order -
              right.order
          )
        }
      )

      return result
    }, [
      assignments,
      snapshot.modules
    ])

  const activePlanifications =
    useMemo(
      () =>
        snapshot.planifications.filter(
          (
            planification
          ) =>
            planification.active
        ),
      [
        snapshot.planifications
      ]
    )

  const planificationByModule =
    useMemo(
      () =>
        new Map(
          activePlanifications.map(
            (
              planification
            ) => [
              planification.moduleId,
              planification
            ]
          )
        ),
      [
        activePlanifications
      ]
    )

  const itemsByPlanification =
    useMemo(() => {
      const result =
        new Map<
          EntityId,
          typeof snapshot.planificationItems
        >()

      snapshot.planificationItems.forEach(
        (
          item
        ) => {
          const current =
            result.get(
              item.planificationId
            ) ??
            []

          current.push(
            item
          )

          result.set(
            item.planificationId,
            current
          )
        }
      )

      result.forEach(
        (
          planificationItems
        ) => {
          planificationItems.sort(
            (
              left,
              right
            ) =>
              left.order -
              right.order
          )
        }
      )

      return result
    }, [
      snapshot
        .planificationItems
    ])

  const uncoveredModules =
    useMemo(
      () =>
        snapshot.modules.filter(
          (
            module
          ) =>
            module.active &&
            !planificationByModule.has(
              module.id
            )
        ),
      [
        snapshot.modules,
        planificationByModule
      ]
    )

  const selectedAssignment =
    useMemo(
      () =>
        assignmentById.get(
          form.teachingAssignmentId
        ) ??
        null,
      [
        assignmentById,
        form.teachingAssignmentId
      ]
    )

  const selectedAssignmentModules =
    useMemo(
      () =>
        modulesByAssignment.get(
          form.teachingAssignmentId
        ) ??
        [],
      [
        modulesByAssignment,
        form.teachingAssignmentId
      ]
    )

  const selectedModule =
    useMemo(
      () =>
        moduleById.get(
          form.moduleId
        ) ??
        null,
      [
        moduleById,
        form.moduleId
      ]
    )

  const selectedModulePlanification =
    form.moduleId
      ? planificationByModule.get(
          form.moduleId
        ) ??
        null
      : null

  const meaningfulItems =
    useMemo(
      () =>
        items.filter(
          (
            item
          ) =>
            Boolean(
              item.content.trim() ||
              item.activity.trim() ||
              item.objectives.trim() ||
              item.suggestedSummary.trim()
            )
        ),
      [
        items
      ]
    )

  async function refreshSnapshot() {
    const nextSnapshot =
      await maProfessorRepository.getSetupSnapshot(
        snapshot.academicYear.id
      )

    onSnapshotChange(
      nextSnapshot
    )

    return nextSnapshot
  }

  function clearMessages() {
    setError('')
    setSuccess('')
  }

  function resetItems() {
    setItems([
      createEmptyItem()
    ])

    setImportText('')
  }

  function resetForm() {
    setForm(
      emptyForm
    )

    resetItems()
    clearMessages()
  }

  function selectAssignment(
    teachingAssignmentId:
      EntityId
  ) {
    const assignmentModules =
      modulesByAssignment.get(
        teachingAssignmentId
      ) ??
      []

    const firstUncoveredModule =
      assignmentModules.find(
        (
          module
        ) =>
          !planificationByModule.has(
            module.id
          )
      )

    setForm({
      teachingAssignmentId,
      moduleId:
        firstUncoveredModule
          ?.id ??
        '',
      title:
        firstUncoveredModule
          ? getDefaultPlanificationTitle(
              firstUncoveredModule.code,
              firstUncoveredModule.name
            )
          : '',
      description: ''
    })

    resetItems()
    clearMessages()
  }

  function selectModule(
    moduleId:
      EntityId
  ) {
    const module =
      moduleById.get(
        moduleId
      )

    setForm(
      (
        current
      ) => ({
        ...current,
        moduleId,
        title:
          module
            ? getDefaultPlanificationTitle(
                module.code,
                module.name
              )
            : ''
      })
    )

    resetItems()
    clearMessages()
  }

  function selectModuleFromList(
    moduleId:
      EntityId
  ) {
    const module =
      moduleById.get(
        moduleId
      )

    if (!module) {
      return
    }

    setForm({
      teachingAssignmentId:
        module.teachingAssignmentId,
      moduleId:
        module.id,
      title:
        getDefaultPlanificationTitle(
          module.code,
          module.name
        ),
      description: ''
    })

    resetItems()
    clearMessages()

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  }

  function updateItem(
    localId: string,
    changes: Partial<
      Omit<
        PlanificationItemForm,
        'localId'
      >
    >
  ) {
    setItems(
      (
        current
      ) =>
        current.map(
          (
            item
          ) =>
            item.localId ===
            localId
              ? {
                  ...item,
                  ...changes
                }
              : item
        )
    )

    clearMessages()
  }

  function addItem() {
    setItems(
      (
        current
      ) => [
        ...current,
        createEmptyItem()
      ]
    )

    clearMessages()
  }

  function removeItem(
    localId: string
  ) {
    if (
      items.length ===
      1
    ) {
      setItems([
        createEmptyItem()
      ])

      return
    }

    setItems(
      (
        current
      ) =>
        current.filter(
          (
            item
          ) =>
            item.localId !==
            localId
        )
    )

    clearMessages()
  }

  function moveItem(
    localId: string,
    direction:
      | 'up'
      | 'down'
  ) {
    setItems(
      (
        current
      ) => {
        const index =
          current.findIndex(
            (
              item
            ) =>
              item.localId ===
              localId
          )

        if (
          index ===
          -1
        ) {
          return current
        }

        const targetIndex =
          direction ===
          'up'
            ? index -
              1
            : index +
              1

        if (
          targetIndex <
            0 ||
          targetIndex >=
            current.length
        ) {
          return current
        }

        const reordered = [
          ...current
        ]

        const [
          movedItem
        ] =
          reordered.splice(
            index,
            1
          )

        reordered.splice(
          targetIndex,
          0,
          movedItem
        )

        return reordered
      }
    )

    clearMessages()
  }

  function importLines() {
    const lines =
      importText
        .split(
          /\r?\n/
        )
        .map(
          (
            line
          ) =>
            line.trim()
        )
        .filter(Boolean)

    if (
      lines.length ===
      0
    ) {
      setError(
        'Cole pelo menos uma linha antes de importar.'
      )

      return
    }

    const existingValues =
      new Set(
        meaningfulItems.flatMap(
          (
            item
          ) => [
            normalizeComparisonText(
              item.content
            ),
            normalizeComparisonText(
              item.suggestedSummary
            )
          ]
        )
      )

    const importedItems =
      lines
        .filter(
          (
            line
          ) =>
            !existingValues.has(
              normalizeComparisonText(
                line
              )
            )
        )
        .map(
          (
            line
          ): PlanificationItemForm => ({
            localId:
              createLocalId(),
            content:
              line,
            activity: '',
            objectives: '',
            suggestedSummary:
              line
          })
        )

    if (
      importedItems.length ===
      0
    ) {
      setError(
        'As linhas coladas já existem na planificação.'
      )

      return
    }

    setItems(
      (
        current
      ) => {
        const hasOnlyEmptyItem =
          current.length ===
            1 &&
          !current[0]
            .content
            .trim() &&
          !current[0]
            .activity
            .trim() &&
          !current[0]
            .objectives
            .trim() &&
          !current[0]
            .suggestedSummary
            .trim()

        return hasOnlyEmptyItem
          ? importedItems
          : [
              ...current,
              ...importedItems
            ]
      }
    )

    setImportText('')

    setSuccess(
      `${importedItems.length} ${
        importedItems.length ===
        1
          ? 'item importado'
          : 'itens importados'
      } com sucesso.`
    )

    setError('')
  }

  function buildItemDrafts():
    PlanificationItemDraft[] {
    const drafts =
      meaningfulItems.map(
        (
          item
        ) => ({
          content:
            item.content,
          activity:
            item.activity,
          objectives:
            item.objectives,
          suggestedSummary:
            item.suggestedSummary
        })
      )

    if (
      drafts.length ===
      0
    ) {
      throw new Error(
        'Adicione pelo menos um conteúdo, atividade, objetivo ou proposta de sumário.'
      )
    }

    return drafts
  }

  function validateForm() {
    if (
      !form.teachingAssignmentId
    ) {
      throw new Error(
        'Selecione a turma e a disciplina.'
      )
    }

    if (
      !form.moduleId
    ) {
      throw new Error(
        'Selecione a UFCD ou módulo.'
      )
    }

    if (
      !form.title.trim()
    ) {
      throw new Error(
        'Indique o título da planificação.'
      )
    }

    const module =
      moduleById.get(
        form.moduleId
      )

    if (
      !module ||
      module.teachingAssignmentId !==
        form.teachingAssignmentId
    ) {
      throw new Error(
        'A UFCD selecionada não pertence à turma e disciplina indicadas.'
      )
    }

    if (
      planificationByModule.has(
        form.moduleId
      )
    ) {
      throw new Error(
        'Esta UFCD já possui uma planificação.'
      )
    }

    return buildItemDrafts()
  }

  async function selectNextMissingModule(
    nextSnapshot:
      SetupSnapshot
  ) {
    const configuredModuleIds =
      new Set(
        nextSnapshot.planifications
          .filter(
            (
              planification
            ) =>
              planification.active
          )
          .map(
            (
              planification
            ) =>
              planification.moduleId
          )
      )

    const nextModule =
      nextSnapshot.modules
        .filter(
          (
            module
          ) =>
            module.active &&
            !configuredModuleIds.has(
              module.id
            )
        )
        .sort(
          (
            left,
            right
          ) => {
            if (
              left.teachingAssignmentId !==
              right.teachingAssignmentId
            ) {
              const leftAssignment =
                nextSnapshot
                  .teachingAssignments
                  .find(
                    (
                      assignment
                    ) =>
                      assignment.id ===
                      left.teachingAssignmentId
                  )

              const rightAssignment =
                nextSnapshot
                  .teachingAssignments
                  .find(
                    (
                      assignment
                    ) =>
                      assignment.id ===
                      right.teachingAssignmentId
                  )

              return (
                leftAssignment
                  ?.displayName ??
                ''
              ).localeCompare(
                rightAssignment
                  ?.displayName ??
                  '',
                'pt-PT',
                {
                  numeric: true,
                  sensitivity:
                    'base'
                }
              )
            }

            return (
              left.order -
              right.order
            )
          }
        )[0]

    if (
      !nextModule
    ) {
      setForm(
        emptyForm
      )

      resetItems()

      return
    }

    setForm({
      teachingAssignmentId:
        nextModule.teachingAssignmentId,
      moduleId:
        nextModule.id,
      title:
        getDefaultPlanificationTitle(
          nextModule.code,
          nextModule.name
        ),
      description: ''
    })

    resetItems()
  }

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (
      busy
    ) {
      return
    }

    setBusy(true)
    setError('')
    setSuccess('')

    try {
      const itemDrafts =
        validateForm()

      await maProfessorRepository.createPlanification(
        {
          academicYearId:
            snapshot.academicYear.id,
          teachingAssignmentId:
            form.teachingAssignmentId,
          moduleId:
            form.moduleId,
          title:
            form.title,
          description:
            form.description,
          active: true
        },
        itemDrafts
      )

      const nextSnapshot =
        await refreshSnapshot()

      await selectNextMissingModule(
        nextSnapshot
      )

      setSuccess(
        'Planificação guardada com sucesso.'
      )
    } catch (
      submitError
    ) {
      setError(
        getErrorMessage(
          submitError
        )
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleContinue() {
    if (
      busy
    ) {
      return
    }

    if (
      activePlanifications.length ===
      0
    ) {
      setError(
        'Adicione as planificações antes de continuar.'
      )

      return
    }

    if (
      uncoveredModules.length >
      0
    ) {
      setError(
        `Ainda faltam planificações para ${uncoveredModules.length} ${
          uncoveredModules.length ===
          1
            ? 'UFCD ou módulo'
            : 'UFCD ou módulos'
        }.`
      )

      return
    }

    setBusy(true)
    setError('')
    setSuccess('')

    try {
      await maProfessorRepository.completeSetupStep(
        snapshot.academicYear.id,
        'planifications'
      )

      const nextSnapshot =
        await maProfessorRepository.getSetupSnapshot(
          snapshot.academicYear.id
        )

      onSnapshotChange(
        nextSnapshot
      )

      onCompleted(
        nextSnapshot
      )
    } catch (
      continueError
    ) {
      setError(
        getErrorMessage(
          continueError
        )
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
      <form
        onSubmit={
          handleSubmit
        }
        className="rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-black/20 sm:p-6"
      >
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
          Passo 6 de 9
        </p>

        <h2 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
          Planificações
        </h2>

        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
          Organize os conteúdos, atividades, objetivos e propostas de
          sumário de cada UFCD. Estes dados serão utilizados mais tarde
          para ajudar a sugerir o sumário de cada aula.
        </p>

        <div className="mt-7 space-y-5">
          <label className="block">
            <FieldLabel>
              Turma e disciplina
            </FieldLabel>

            <select
              value={
                form.teachingAssignmentId
              }
              onChange={(
                event
              ) =>
                selectAssignment(
                  event.target.value
                )
              }
              required
              className={
                inputClassName
              }
            >
              <option value="">
                Selecione uma turma e disciplina
              </option>

              {assignments.map(
                (
                  assignment
                ) => (
                  <option
                    key={
                      assignment.id
                    }
                    value={
                      assignment.id
                    }
                  >
                    {
                      assignment.displayName
                    }
                  </option>
                )
              )}
            </select>
          </label>

          <label className="block">
            <FieldLabel>
              UFCD ou módulo
            </FieldLabel>

            <select
              value={
                form.moduleId
              }
              onChange={(
                event
              ) =>
                selectModule(
                  event.target.value
                )
              }
              disabled={
                !form
                  .teachingAssignmentId
              }
              required
              className={
                inputClassName
              }
            >
              <option value="">
                Selecione a UFCD ou módulo
              </option>

              {selectedAssignmentModules.map(
                (
                  module
                ) => {
                  const configured =
                    planificationByModule.has(
                      module.id
                    )

                  return (
                    <option
                      key={
                        module.id
                      }
                      value={
                        module.id
                      }
                      disabled={
                        configured
                      }
                    >
                      {getModuleLabel(
                        module.code,
                        module.name
                      )}

                      {configured
                        ? ' — já configurada'
                        : ''}
                    </option>
                  )
                }
              )}
            </select>
          </label>

          {selectedAssignment &&
          selectedModule ? (
            <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.055] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-200">
                Seleção atual
              </p>

              <p className="mt-2 font-black text-white">
                {
                  selectedAssignment.displayName
                }
              </p>

              <p className="mt-1 text-sm leading-6 text-slate-300">
                {getModuleLabel(
                  selectedModule.code,
                  selectedModule.name
                )}
              </p>

              <p className="mt-2 text-xs text-slate-500">
                Carga horária:{' '}
                {
                  selectedModule.plannedPeriods
                }{' '}
                {selectedModule.plannedPeriods ===
                1
                  ? 'tempo'
                  : 'tempos'}
              </p>
            </div>
          ) : null}

          {selectedModulePlanification ? (
            <div
              role="alert"
              className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.07] p-4 text-sm leading-6 text-amber-100"
            >
              Esta UFCD já possui uma planificação. Selecione outra
              UFCD para continuar.
            </div>
          ) : null}

          <label className="block">
            <FieldLabel>
              Título da planificação
            </FieldLabel>

            <input
              type="text"
              value={
                form.title
              }
              onChange={(
                event
              ) =>
                setForm(
                  (
                    current
                  ) => ({
                    ...current,
                    title:
                      event
                        .target
                        .value
                  })
                )
              }
              placeholder="Planificação — Processos de envelhecimento"
              required
              className={
                inputClassName
              }
            />
          </label>

          <label className="block">
            <FieldLabel optional>
              Descrição geral
            </FieldLabel>

            <textarea
              value={
                form.description
              }
              onChange={(
                event
              ) =>
                setForm(
                  (
                    current
                  ) => ({
                    ...current,
                    description:
                      event
                        .target
                        .value
                  })
                )
              }
              placeholder="Enquadramento geral, objetivos principais ou observações sobre a organização desta UFCD."
              className={
                textareaClassName
              }
            />
          </label>
        </div>

        <section className="mt-8 border-t border-white/10 pt-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Estrutura da UFCD
              </p>

              <h3 className="mt-2 text-xl font-black text-white">
                Conteúdos e atividades
              </h3>
            </div>

            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-black text-cyan-100">
              {
                meaningfulItems.length
              }{' '}
              {meaningfulItems.length ===
              1
                ? 'item'
                : 'itens'}
            </span>
          </div>

          <p className="mt-3 text-sm leading-7 text-slate-400">
            Não precisa de preencher todos os campos. Introduza apenas
            os elementos que existirem na sua planificação.
          </p>

          <div className="mt-5 space-y-4">
            {items.map(
              (
                item,
                index
              ) => (
                <article
                  key={
                    item.localId
                  }
                  className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-xs font-black text-cyan-100">
                        {index +
                          1}
                      </span>

                      <p className="text-sm font-black text-white">
                        Item da planificação
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={
                          index ===
                          0
                        }
                        onClick={() =>
                          moveItem(
                            item.localId,
                            'up'
                          )
                        }
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-sm font-black text-slate-300 transition hover:border-cyan-300/25 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-25"
                        aria-label="Mover item para cima"
                      >
                        ↑
                      </button>

                      <button
                        type="button"
                        disabled={
                          index ===
                          items.length -
                            1
                        }
                        onClick={() =>
                          moveItem(
                            item.localId,
                            'down'
                          )
                        }
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-sm font-black text-slate-300 transition hover:border-cyan-300/25 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-25"
                        aria-label="Mover item para baixo"
                      >
                        ↓
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          removeItem(
                            item.localId
                          )
                        }
                        className="rounded-xl border border-rose-300/15 bg-rose-300/[0.05] px-3 py-2 text-xs font-bold text-rose-200 transition hover:bg-rose-300/10"
                      >
                        Remover
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    <label className="block">
                      <FieldLabel optional>
                        Conteúdos
                      </FieldLabel>

                      <textarea
                        value={
                          item.content
                        }
                        onChange={(
                          event
                        ) =>
                          updateItem(
                            item.localId,
                            {
                              content:
                                event
                                  .target
                                  .value
                            }
                          )
                        }
                        placeholder="Conceito de envelhecimento e principais alterações físicas."
                        className={
                          textareaClassName
                        }
                      />
                    </label>

                    <label className="block">
                      <FieldLabel optional>
                        Atividades
                      </FieldLabel>

                      <textarea
                        value={
                          item.activity
                        }
                        onChange={(
                          event
                        ) =>
                          updateItem(
                            item.localId,
                            {
                              activity:
                                event
                                  .target
                                  .value
                            }
                          )
                        }
                        placeholder="Apresentação dos conteúdos, análise de casos e trabalho de grupo."
                        className={
                          textareaClassName
                        }
                      />
                    </label>

                    <label className="block">
                      <FieldLabel optional>
                        Objetivos
                      </FieldLabel>

                      <textarea
                        value={
                          item.objectives
                        }
                        onChange={(
                          event
                        ) =>
                          updateItem(
                            item.localId,
                            {
                              objectives:
                                event
                                  .target
                                  .value
                            }
                          )
                        }
                        placeholder="Identificar as principais alterações associadas ao processo de envelhecimento."
                        className={
                          textareaClassName
                        }
                      />
                    </label>

                    <label className="block">
                      <FieldLabel optional>
                        Proposta de sumário
                      </FieldLabel>

                      <textarea
                        value={
                          item.suggestedSummary
                        }
                        onChange={(
                          event
                        ) =>
                          updateItem(
                            item.localId,
                            {
                              suggestedSummary:
                                event
                                  .target
                                  .value
                            }
                          )
                        }
                        placeholder="Abordagem ao conceito de envelhecimento e análise das principais alterações físicas."
                        className={
                          textareaClassName
                        }
                      />
                    </label>
                  </div>
                </article>
              )
            )}
          </div>

          <button
            type="button"
            onClick={
              addItem
            }
            className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-dashed border-cyan-300/25 bg-cyan-300/[0.04] px-5 py-3.5 text-sm font-bold text-cyan-100 transition hover:border-cyan-300/40 hover:bg-cyan-300/[0.08]"
          >
            Adicionar outro item
          </button>
        </section>

        <section className="mt-7 rounded-2xl border border-violet-300/15 bg-violet-300/[0.045] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-200">
            Importação rápida
          </p>

          <h3 className="mt-2 text-lg font-black text-white">
            Um sumário por linha
          </h3>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            Cole uma lista existente. Cada linha será criada como um
            novo item e ficará também disponível como proposta de
            sumário.
          </p>

          <textarea
            value={
              importText
            }
            onChange={(
              event
            ) =>
              setImportText(
                event.target.value
              )
            }
            placeholder={`Apresentação da UFCD e dos objetivos gerais.
Conceito de envelhecimento e principais alterações físicas.
Análise de situações práticas relacionadas com o envelhecimento.
Realização de trabalho de grupo.`}
            className={`${textareaClassName} mt-4 min-h-40`}
          />

          <button
            type="button"
            onClick={
              importLines
            }
            className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-violet-300/20 bg-violet-300/[0.08] px-5 py-3.5 text-sm font-black text-violet-100 transition hover:border-violet-300/35 hover:bg-violet-300/[0.12]"
          >
            Importar linhas
          </button>
        </section>

        {error ? (
          <div
            role="alert"
            className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-300/[0.07] p-4 text-sm leading-6 text-rose-100"
          >
            {error}
          </div>
        ) : null}

        {success ? (
          <div
            role="status"
            className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.07] p-4 text-sm leading-6 text-emerald-100"
          >
            {success}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            disabled={
              busy ||
              Boolean(
                selectedModulePlanification
              )
            }
            className="inline-flex flex-1 items-center justify-center rounded-2xl border border-cyan-200/30 bg-gradient-to-r from-cyan-300 to-sky-300 px-5 py-3.5 text-sm font-black text-slate-950 shadow-lg shadow-cyan-950/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {busy
              ? 'A guardar...'
              : 'Guardar planificação'}
          </button>

          <button
            type="button"
            disabled={
              busy
            }
            onClick={
              resetForm
            }
            className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.045] px-5 py-3.5 text-sm font-bold text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08] disabled:opacity-50"
          >
            Limpar
          </button>
        </div>
      </form>

      <section className="rounded-[1.75rem] border border-white/10 bg-slate-950/55 p-5 shadow-xl shadow-black/15 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Ano letivo
            </p>

            <h3 className="mt-2 text-xl font-black text-white">
              Planificações adicionadas
            </h3>
          </div>

          <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-black text-cyan-100">
            {
              activePlanifications.length
            }
            /
            {
              snapshot.modules.filter(
                (
                  module
                ) =>
                  module.active
              ).length
            }
          </span>
        </div>

        <div className="mt-5 space-y-5">
          {assignments.map(
            (
              assignment
            ) => {
              const modules =
                modulesByAssignment.get(
                  assignment.id
                ) ??
                []

              return (
                <article
                  key={
                    assignment.id
                  }
                  className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"
                >
                  <p className="font-black text-white">
                    {
                      assignment.displayName
                    }
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {
                      modules.length
                    }{' '}
                    {modules.length ===
                    1
                      ? 'UFCD ou módulo'
                      : 'UFCD ou módulos'}
                  </p>

                  <div className="mt-4 space-y-3">
                    {modules.map(
                      (
                        module
                      ) => {
                        const planification =
                          planificationByModule.get(
                            module.id
                          )

                        const planificationItems =
                          planification
                            ? itemsByPlanification.get(
                                planification.id
                              ) ??
                              []
                            : []

                        return (
                          <div
                            key={
                              module.id
                            }
                            className="rounded-xl border border-white/10 bg-slate-950/55 p-4"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-xs font-black text-cyan-100">
                                    {
                                      module.order
                                    }
                                  </span>

                                  {module.code ? (
                                    <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-2 py-1 text-[0.65rem] font-bold text-violet-100">
                                      {
                                        module.code
                                      }
                                    </span>
                                  ) : null}
                                </div>

                                <p className="mt-3 font-bold leading-6 text-white">
                                  {
                                    module.name
                                  }
                                </p>

                                {planification ? (
                                  <>
                                    <p className="mt-2 text-sm leading-6 text-slate-400">
                                      {
                                        planification.title
                                      }
                                    </p>

                                    <p className="mt-2 text-xs text-slate-500">
                                      {
                                        planificationItems.length
                                      }{' '}
                                      {planificationItems.length ===
                                      1
                                        ? 'item'
                                        : 'itens'}
                                    </p>
                                  </>
                                ) : (
                                  <p className="mt-2 text-xs text-amber-200">
                                    Planificação ainda não adicionada.
                                  </p>
                                )}
                              </div>

                              <PlanificationStatus
                                configured={
                                  Boolean(
                                    planification
                                  )
                                }
                              />
                            </div>

                            {!planification ? (
                              <button
                                type="button"
                                onClick={() =>
                                  selectModuleFromList(
                                    module.id
                                  )
                                }
                                className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/[0.025] px-4 py-3 text-xs font-bold text-slate-400 transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.06] hover:text-cyan-100"
                              >
                                Criar planificação
                              </button>
                            ) : null}
                          </div>
                        )
                      }
                    )}
                  </div>
                </article>
              )
            }
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-violet-300/15 bg-violet-300/[0.055] p-4">
          <p className="text-sm font-bold text-violet-100">
            Cada UFCD deve ter uma planificação.
          </p>

          <p className="mt-2 text-xs leading-6 text-violet-100/65">
            A aplicação utilizará estes conteúdos em conjunto com a
            indicação do professor para sugerir o sumário de cada aula.
          </p>
        </div>

        {uncoveredModules.length >
        0 ? (
          <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4">
            <p className="text-sm font-bold text-amber-100">
              Ainda faltam{' '}
              {
                uncoveredModules.length
              }{' '}
              {uncoveredModules.length ===
              1
                ? 'planificação'
                : 'planificações'}
              .
            </p>
          </div>
        ) : null}

        <button
          type="button"
          disabled={
            busy ||
            activePlanifications.length ===
              0 ||
            uncoveredModules.length >
              0
          }
          onClick={() =>
            void handleContinue()
          }
          className="mt-6 inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.055] px-5 py-3.5 text-sm font-black text-white transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.09] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Guardar planificações e continuar
        </button>
      </section>
    </div>
  )
}
