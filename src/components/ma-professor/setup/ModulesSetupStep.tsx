import {
  type FormEvent,
  useMemo,
  useState
} from 'react'

import {
  maProfessorRepository,
  type SetupSnapshot
} from '../repository'

import type {
  EntityId
} from '../types'

type ModulesSetupStepProps = {
  snapshot: SetupSnapshot
  onSnapshotChange: (
    snapshot: SetupSnapshot
  ) => void
  onCompleted: (
    snapshot: SetupSnapshot
  ) => void
}

type ModuleFormState = {
  teachingAssignmentId: EntityId
  code: string
  name: string
  plannedPeriods: string
  order: string
  plannedStartDate: string
  plannedEndDate: string
}

const emptyForm: ModuleFormState = {
  teachingAssignmentId: '',
  code: '',
  name: '',
  plannedPeriods: '',
  order: '',
  plannedStartDate: '',
  plannedEndDate: ''
}

const inputClassName =
  'w-full rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10'

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

function getPeriodLabel(
  value: number
) {
  return value === 1
    ? '1 tempo'
    : `${value} tempos`
}

export default function ModulesSetupStep({
  snapshot,
  onSnapshotChange,
  onCompleted
}: ModulesSetupStepProps) {
  const [
    form,
    setForm
  ] =
    useState<ModuleFormState>(
      emptyForm
    )

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

  const groupById =
    useMemo(
      () =>
        new Map(
          snapshot.groups.map(
            (
              group
            ) => [
              group.id,
              group
            ]
          )
        ),
      [
        snapshot.groups
      ]
    )

  const subjectById =
    useMemo(
      () =>
        new Map(
          snapshot.subjects.map(
            (
              subject
            ) => [
              subject.id,
              subject
            ]
          )
        ),
      [
        snapshot.subjects
      ]
    )

  const assignments =
    useMemo(
      () =>
        snapshot.teachingAssignments
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
        snapshot.teachingAssignments
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

      snapshot.modules.forEach(
        (
          module
        ) => {
          const modules =
            result.get(
              module.teachingAssignmentId
            ) ??
            []

          modules.push(
            module
          )

          result.set(
            module.teachingAssignmentId,
            modules
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

  const selectedAssignment =
    useMemo(
      () =>
        assignments.find(
          (
            assignment
          ) =>
            assignment.id ===
            form.teachingAssignmentId
        ) ??
        null,
      [
        assignments,
        form.teachingAssignmentId
      ]
    )

  const assignmentsWithoutModules =
    useMemo(
      () =>
        assignments.filter(
          (
            assignment
          ) =>
            (
              modulesByAssignment.get(
                assignment.id
              ) ??
              []
            ).length ===
            0
        ),
      [
        assignments,
        modulesByAssignment
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

  function getNextOrder(
    teachingAssignmentId:
      EntityId
  ) {
    const modules =
      modulesByAssignment.get(
        teachingAssignmentId
      ) ??
      []

    if (
      modules.length ===
      0
    ) {
      return 1
    }

    return (
      Math.max(
        ...modules.map(
          (
            module
          ) =>
            module.order
        )
      ) +
      1
    )
  }

  function selectAssignment(
    teachingAssignmentId:
      EntityId
  ) {
    setForm(
      (
        current
      ) => ({
        ...current,
        teachingAssignmentId,
        order:
          String(
            getNextOrder(
              teachingAssignmentId
            )
          )
      })
    )

    setError('')
    setSuccess('')
  }

  function resetForm(
    preserveAssignment =
      true
  ) {
    const teachingAssignmentId =
      preserveAssignment
        ? form.teachingAssignmentId
        : ''

    setForm({
      ...emptyForm,
      teachingAssignmentId,
      order:
        teachingAssignmentId
          ? String(
              getNextOrder(
                teachingAssignmentId
              )
            )
          : ''
    })
  }

  function validateForm() {
    if (
      !form.teachingAssignmentId
    ) {
      throw new Error(
        'Selecione a turma e a disciplina da UFCD ou módulo.'
      )
    }

    const plannedPeriods =
      Number(
        form.plannedPeriods
      )

    if (
      !Number.isInteger(
        plannedPeriods
      ) ||
      plannedPeriods <=
        0
    ) {
      throw new Error(
        'A carga horária deve ser um número inteiro superior a zero.'
      )
    }

    const order =
      Number(
        form.order
      )

    if (
      !Number.isInteger(
        order
      ) ||
      order <=
        0
    ) {
      throw new Error(
        'A ordem deve ser um número inteiro superior a zero.'
      )
    }

    const hasStartDate =
      Boolean(
        form.plannedStartDate
      )

    const hasEndDate =
      Boolean(
        form.plannedEndDate
      )

    if (
      hasStartDate !==
      hasEndDate
    ) {
      throw new Error(
        'Indique as duas datas previstas ou deixe ambas vazias.'
      )
    }

    if (
      hasStartDate &&
      hasEndDate &&
      form.plannedStartDate >
        form.plannedEndDate
    ) {
      throw new Error(
        'A data prevista de início não pode ser posterior à data prevista de conclusão.'
      )
    }

    if (
      form.plannedStartDate &&
      form.plannedStartDate <
        snapshot.academicYear.startDate
    ) {
      throw new Error(
        'A data prevista de início não pode ser anterior ao início do ano letivo.'
      )
    }

    if (
      form.plannedEndDate &&
      form.plannedEndDate >
        snapshot.academicYear.endDate
    ) {
      throw new Error(
        'A data prevista de conclusão não pode ser posterior ao fim do ano letivo.'
      )
    }

    return {
      plannedPeriods,
      order
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
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
      const {
        plannedPeriods,
        order
      } =
        validateForm()

      await maProfessorRepository.createModule(
        {
          academicYearId:
            snapshot.academicYear.id,
          teachingAssignmentId:
            form.teachingAssignmentId,
          code:
            form.code,
          name:
            form.name,
          plannedPeriods,
          order,
          plannedStartDate:
            form.plannedStartDate ||
            null,
          plannedEndDate:
            form.plannedEndDate ||
            null,
          active: true
        }
      )

      const nextSnapshot =
        await refreshSnapshot()

      const nextModules =
        nextSnapshot.modules.filter(
          (
            module
          ) =>
            module.teachingAssignmentId ===
            form.teachingAssignmentId
        )

      setForm({
        ...emptyForm,
        teachingAssignmentId:
          form.teachingAssignmentId,
        order:
          String(
            nextModules.length >
              0
              ? Math.max(
                  ...nextModules.map(
                    (
                      module
                    ) =>
                      module.order
                  )
                ) +
                1
              : 1
          )
      })

      setSuccess(
        'UFCD ou módulo adicionado com sucesso.'
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
      snapshot.modules.length ===
      0
    ) {
      setError(
        'Adicione pelo menos uma UFCD ou módulo antes de continuar.'
      )

      return
    }

    if (
      assignmentsWithoutModules.length >
      0
    ) {
      setError(
        `Ainda existem turmas e disciplinas sem UFCD ou módulos: ${assignmentsWithoutModules
          .map(
            (
              assignment
            ) =>
              assignment.displayName
          )
          .join(', ')}.`
      )

      return
    }

    setBusy(true)
    setError('')
    setSuccess('')

    try {
      await maProfessorRepository.completeSetupStep(
        snapshot.academicYear.id,
        'modules'
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
    <div className="grid gap-6 xl:grid-cols-[1fr_1.05fr]">
      <form
        onSubmit={
          handleSubmit
        }
        className="rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-black/20 sm:p-6"
      >
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
          Passo 4 de 9
        </p>

        <h2 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
          UFCD ou módulos
        </h2>

        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
          Introduza as UFCD ou módulos pela ordem em que serão
          lecionados. A carga horária será utilizada para calcular os
          tempos dados, os tempos em falta e a previsão de conclusão.
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

          {selectedAssignment ? (
            <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.055] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-200">
                Seleção atual
              </p>

              <p className="mt-2 font-black text-white">
                {
                  selectedAssignment.displayName
                }
              </p>

              <p className="mt-1 text-xs leading-6 text-slate-400">
                Turma:{' '}
                {groupById.get(
                  selectedAssignment.groupId
                )?.name ??
                  '—'}

                {' · '}

                Disciplina:{' '}
                {subjectById.get(
                  selectedAssignment.subjectId
                )?.name ??
                  '—'}
              </p>
            </div>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-[0.65fr_1.35fr]">
            <label className="block">
              <FieldLabel optional>
                Código
              </FieldLabel>

              <input
                type="text"
                value={
                  form.code
                }
                onChange={(
                  event
                ) =>
                  setForm(
                    (
                      current
                    ) => ({
                      ...current,
                      code:
                        event
                          .target
                          .value
                    })
                  )
                }
                placeholder="10389"
                autoComplete="off"
                className={
                  inputClassName
                }
              />
            </label>

            <label className="block">
              <FieldLabel>
                Nome da UFCD ou módulo
              </FieldLabel>

              <input
                type="text"
                value={
                  form.name
                }
                onChange={(
                  event
                ) =>
                  setForm(
                    (
                      current
                    ) => ({
                      ...current,
                      name:
                        event
                          .target
                          .value
                    })
                  )
                }
                placeholder="Processos de envelhecimento"
                autoComplete="off"
                required
                className={
                  inputClassName
                }
              />
            </label>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block">
              <FieldLabel>
                Carga horária em tempos
              </FieldLabel>

              <input
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={
                  form.plannedPeriods
                }
                onChange={(
                  event
                ) =>
                  setForm(
                    (
                      current
                    ) => ({
                      ...current,
                      plannedPeriods:
                        event
                          .target
                          .value
                    })
                  )
                }
                placeholder="25"
                required
                className={
                  inputClassName
                }
              />
            </label>

            <label className="block">
              <FieldLabel>
                Ordem
              </FieldLabel>

              <input
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={
                  form.order
                }
                onChange={(
                  event
                ) =>
                  setForm(
                    (
                      current
                    ) => ({
                      ...current,
                      order:
                        event
                          .target
                          .value
                    })
                  )
                }
                placeholder="1"
                required
                className={
                  inputClassName
                }
              />
            </label>
          </div>

          <fieldset className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <legend className="px-2 text-sm font-bold text-slate-200">
              Datas previstas
            </legend>

            <p className="mt-1 text-xs leading-6 text-slate-500">
              São opcionais e poderão ser reajustadas posteriormente
              conforme o progresso real da turma.
            </p>

            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <label className="block">
                <FieldLabel optional>
                  Início
                </FieldLabel>

                <input
                  type="date"
                  min={
                    snapshot.academicYear.startDate
                  }
                  max={
                    snapshot.academicYear.endDate
                  }
                  value={
                    form.plannedStartDate
                  }
                  onChange={(
                    event
                  ) =>
                    setForm(
                      (
                        current
                      ) => ({
                        ...current,
                        plannedStartDate:
                          event
                            .target
                            .value
                      })
                    )
                  }
                  className={
                    inputClassName
                  }
                />
              </label>

              <label className="block">
                <FieldLabel optional>
                  Conclusão
                </FieldLabel>

                <input
                  type="date"
                  min={
                    form.plannedStartDate ||
                    snapshot.academicYear.startDate
                  }
                  max={
                    snapshot.academicYear.endDate
                  }
                  value={
                    form.plannedEndDate
                  }
                  onChange={(
                    event
                  ) =>
                    setForm(
                      (
                        current
                      ) => ({
                        ...current,
                        plannedEndDate:
                          event
                            .target
                            .value
                      })
                    )
                  }
                  className={
                    inputClassName
                  }
                />
              </label>
            </div>
          </fieldset>
        </div>

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
              busy
            }
            className="inline-flex flex-1 items-center justify-center rounded-2xl border border-cyan-200/30 bg-gradient-to-r from-cyan-300 to-sky-300 px-5 py-3.5 text-sm font-black text-slate-950 shadow-lg shadow-cyan-950/25 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-55"
          >
            {busy
              ? 'A guardar...'
              : 'Adicionar UFCD ou módulo'}
          </button>

          <button
            type="button"
            disabled={
              busy
            }
            onClick={() =>
              resetForm(
                false
              )
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
              UFCD e módulos adicionados
            </h3>
          </div>

          <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-black text-cyan-100">
            {
              snapshot.modules.length
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
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
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
                    </div>

                    {modules.length ===
                    0 ? (
                      <span className="rounded-full border border-amber-300/20 bg-amber-300/[0.08] px-3 py-1.5 text-xs font-bold text-amber-100">
                        Em falta
                      </span>
                    ) : (
                      <span className="rounded-full border border-emerald-300/20 bg-emerald-300/[0.08] px-3 py-1.5 text-xs font-bold text-emerald-100">
                        Configurado
                      </span>
                    )}
                  </div>

                  {modules.length ===
                  0 ? (
                    <button
                      type="button"
                      onClick={() =>
                        selectAssignment(
                          assignment.id
                        )
                      }
                      className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-3 text-xs font-bold text-slate-400 transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.05] hover:text-cyan-100"
                    >
                      Adicionar a primeira UFCD
                    </button>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {modules.map(
                        (
                          module
                        ) => (
                          <div
                            key={
                              module.id
                            }
                            className="rounded-xl border border-white/10 bg-slate-950/55 p-4"
                          >
                            <div className="flex items-start gap-3">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-xs font-black text-cyan-100">
                                {
                                  module.order
                                }
                              </span>

                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  {module.code ? (
                                    <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-2 py-1 text-[0.65rem] font-bold text-violet-100">
                                      {
                                        module.code
                                      }
                                    </span>
                                  ) : null}

                                  <span className="text-xs font-bold text-slate-400">
                                    {getPeriodLabel(
                                      module.plannedPeriods
                                    )}
                                  </span>
                                </div>

                                <p className="mt-2 font-bold leading-6 text-white">
                                  {
                                    module.name
                                  }
                                </p>

                                {module.plannedStartDate &&
                                module.plannedEndDate ? (
                                  <p className="mt-2 text-xs text-slate-500">
                                    Prevista de{' '}
                                    {
                                      module.plannedStartDate
                                    }{' '}
                                    a{' '}
                                    {
                                      module.plannedEndDate
                                    }
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        )
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          selectAssignment(
                            assignment.id
                          )
                        }
                        className="inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-xs font-bold text-slate-300 transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.07] hover:text-cyan-100"
                      >
                        Adicionar outra UFCD
                      </button>
                    </div>
                  )}
                </article>
              )
            }
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-violet-300/15 bg-violet-300/[0.055] p-4">
          <p className="text-sm font-bold text-violet-100">
            Cada turma e disciplina deve ter pelo menos uma UFCD ou
            módulo.
          </p>

          <p className="mt-2 text-xs leading-6 text-violet-100/65">
            A ordem indicada será utilizada para identificar
            automaticamente a UFCD atual quando as aulas começarem a
            ser registadas.
          </p>
        </div>

        <button
          type="button"
          disabled={
            busy ||
            snapshot.modules.length ===
              0 ||
            assignmentsWithoutModules.length >
              0
          }
          onClick={() =>
            void handleContinue()
          }
          className="mt-6 inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.055] px-5 py-3.5 text-sm font-black text-white transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.09] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Guardar UFCD e continuar
        </button>
      </section>
    </div>
  )
}
