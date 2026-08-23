import {
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  maProfessorRepository,
  type SetupSnapshot
} from '../repository'
import type {
  EntityId,
  ModuleUnit,
  TeachingAssignment
} from '../types'

type ModulesSetupStepProps = {
  snapshot: SetupSnapshot
  onSnapshotChange: (snapshot: SetupSnapshot) => void
  onCompleted: (snapshot: SetupSnapshot) => void
}

type ModuleDraft = {
  code: string
  name: string
  plannedPeriods: number
}

type EntryMode =
  | 'single'
  | 'bulk'

const inputClassName =
  'w-full rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10'

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Ocorreu um erro inesperado.'
}

function normalizeForComparison(value: string) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-PT')
}

function parsePositiveInteger(
  value: string,
  label: string
) {
  const number = Number(value)

  if (
    !Number.isInteger(number) ||
    number <= 0
  ) {
    throw new Error(
      `${label} deve ser um número inteiro superior a zero.`
    )
  }

  return number
}

function parseBulkLines(
  value: string
): ModuleDraft[] {
  const lines = value
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  if (lines.length === 0) {
    throw new Error(
      'Cole pelo menos uma UFCD ou módulo.'
    )
  }

  return lines.map((line, index) => {
    const parts = line
      .split('|')
      .map(part => part.trim())

    if (parts.length === 2) {
      const [
        name,
        periods
      ] = parts

      if (!name) {
        throw new Error(
          `Linha ${index + 1}: indique o nome da UFCD ou módulo.`
        )
      }

      return {
        code: '',
        name,
        plannedPeriods:
          parsePositiveInteger(
            periods,
            `Linha ${index + 1}: a carga horária`
          )
      }
    }

    if (parts.length === 3) {
      const [
        code,
        name,
        periods
      ] = parts

      if (!name) {
        throw new Error(
          `Linha ${index + 1}: indique o nome da UFCD ou módulo.`
        )
      }

      return {
        code,
        name,
        plannedPeriods:
          parsePositiveInteger(
            periods,
            `Linha ${index + 1}: a carga horária`
          )
      }
    }

    throw new Error(
      `Linha ${index + 1}: use “Código | Nome | Tempos” ou “Nome | Tempos”.`
    )
  })
}

function getModuleLabel(
  module: ModuleUnit
) {
  return module.code
    ? `${module.code} — ${module.name}`
    : module.name
}

export default function ModulesSetupStep({
  snapshot,
  onSnapshotChange,
  onCompleted
}: ModulesSetupStepProps) {
  const activeSubjects = useMemo(
    () =>
      snapshot.subjects.filter(
        subject => subject.active
      ),
    [snapshot.subjects]
  )

  const activeAssignments = useMemo(
    () =>
      snapshot.teachingAssignments.filter(
        assignment => assignment.active
      ),
    [snapshot.teachingAssignments]
  )

  const activeModules = useMemo(
    () =>
      snapshot.modules.filter(
        module => module.active
      ),
    [snapshot.modules]
  )

  const groupById = useMemo(
    () =>
      new Map(
        snapshot.groups.map(group => [
          group.id,
          group
        ])
      ),
    [snapshot.groups]
  )

  const subjectById = useMemo(
    () =>
      new Map(
        snapshot.subjects.map(subject => [
          subject.id,
          subject
        ])
      ),
    [snapshot.subjects]
  )

  const assignmentsBySubject = useMemo(() => {
    const result =
      new Map<
        EntityId,
        TeachingAssignment[]
      >()

    activeSubjects.forEach(subject => {
      result.set(
        subject.id,
        []
      )
    })

    activeAssignments.forEach(assignment => {
      const assignments =
        result.get(
          assignment.subjectId
        ) ??
        []

      assignments.push(
        assignment
      )

      result.set(
        assignment.subjectId,
        assignments
      )
    })

    result.forEach(assignments => {
      assignments.sort(
        (
          left,
          right
        ) => {
          const leftGroup =
            groupById.get(left.groupId)?.name ??
            left.displayName

          const rightGroup =
            groupById.get(right.groupId)?.name ??
            right.displayName

          return leftGroup.localeCompare(
            rightGroup,
            'pt-PT',
            {
              numeric: true,
              sensitivity: 'base'
            }
          )
        }
      )
    })

    return result
  }, [
    activeAssignments,
    activeSubjects,
    groupById
  ])

  const modulesByAssignment = useMemo(() => {
    const result =
      new Map<
        EntityId,
        ModuleUnit[]
      >()

    activeAssignments.forEach(assignment => {
      result.set(
        assignment.id,
        []
      )
    })

    activeModules.forEach(module => {
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
    })

    result.forEach(modules => {
      modules.sort(
        (
          left,
          right
        ) =>
          left.order -
          right.order
      )
    })

    return result
  }, [
    activeAssignments,
    activeModules
  ])

  const [
    selectedSubjectId,
    setSelectedSubjectId
  ] =
    useState<EntityId>(
      activeSubjects[0]?.id ??
      ''
    )

  const [
    selectedAssignmentIds,
    setSelectedAssignmentIds
  ] =
    useState<EntityId[]>([])

  const [
    entryMode,
    setEntryMode
  ] =
    useState<EntryMode>(
      'single'
    )

  const [
    code,
    setCode
  ] =
    useState('')

  const [
    name,
    setName
  ] =
    useState('')

  const [
    plannedPeriods,
    setPlannedPeriods
  ] =
    useState('')

  const [
    bulkText,
    setBulkText
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

  const selectedSubject =
    selectedSubjectId
      ? subjectById.get(
          selectedSubjectId
        ) ??
        null
      : null

  const selectedAssignments = useMemo(
    () =>
      assignmentsBySubject.get(
        selectedSubjectId
      ) ??
      [],
    [
      assignmentsBySubject,
      selectedSubjectId
    ]
  )

  const assignmentsWithoutModules =
    useMemo(
      () =>
        activeAssignments.filter(
          assignment =>
            (
              modulesByAssignment.get(
                assignment.id
              ) ??
              []
            ).length === 0
        ),
      [
        activeAssignments,
        modulesByAssignment
      ]
    )

  useEffect(() => {
    if (
      selectedSubjectId &&
      activeSubjects.some(
        subject =>
          subject.id ===
          selectedSubjectId
      )
    ) {
      return
    }

    setSelectedSubjectId(
      activeSubjects[0]?.id ??
      ''
    )
  }, [
    activeSubjects,
    selectedSubjectId
  ])

  useEffect(() => {
    setSelectedAssignmentIds(
      (
        assignmentsBySubject.get(
          selectedSubjectId
        ) ??
        []
      ).map(
        assignment =>
          assignment.id
      )
    )

    setError('')
    setSuccess('')
  }, [
    assignmentsBySubject,
    selectedSubjectId
  ])

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

  function toggleAssignment(
    assignmentId: EntityId
  ) {
    setSelectedAssignmentIds(current =>
      current.includes(assignmentId)
        ? current.filter(
            id =>
              id !== assignmentId
          )
        : [
            ...current,
            assignmentId
          ]
    )

    setError('')
    setSuccess('')
  }

  function getDrafts(): ModuleDraft[] {
    if (
      entryMode ===
      'bulk'
    ) {
      return parseBulkLines(
        bulkText
      )
    }

    if (
      !name.trim()
    ) {
      throw new Error(
        'Indique o nome da UFCD ou módulo.'
      )
    }

    return [
      {
        code:
          code.trim(),
        name:
          name.trim(),
        plannedPeriods:
          parsePositiveInteger(
            plannedPeriods,
            'A carga horária'
          )
      }
    ]
  }

  function validateDuplicates(
    assignmentIds:
      EntityId[],
    drafts:
      ModuleDraft[]
  ) {
    for (
      const assignmentId of
      assignmentIds
    ) {
      const seenCodes =
        new Set(
          snapshot.modules
            .filter(
              module =>
                module.teachingAssignmentId ===
                assignmentId
            )
            .map(module =>
              normalizeForComparison(
                module.code
              )
            )
            .filter(Boolean)
        )

      for (
        const draft of
        drafts
      ) {
        const normalizedCode =
          normalizeForComparison(
            draft.code
          )

        if (!normalizedCode) {
          continue
        }

        if (
          seenCodes.has(
            normalizedCode
          )
        ) {
          const assignment =
            activeAssignments.find(
              item =>
                item.id ===
                assignmentId
            )

          const groupName =
            assignment
              ? groupById.get(
                  assignment.groupId
                )?.name ??
                assignment.displayName
              : 'uma das turmas'

          throw new Error(
            `A UFCD ou módulo com o código “${draft.code}” já existe em ${groupName}.`
          )
        }

        seenCodes.add(
          normalizedCode
        )
      }
    }
  }

  async function handleAddModules() {
    if (busy) {
      return
    }

    if (!selectedSubject) {
      setError(
        'Selecione uma disciplina.'
      )

      return
    }

    if (
      selectedAssignmentIds.length ===
      0
    ) {
      setError(
        'Selecione pelo menos uma turma onde esta UFCD ou módulo se aplica.'
      )

      return
    }

    let drafts:
      ModuleDraft[]

    try {
      drafts =
        getDrafts()

      validateDuplicates(
        selectedAssignmentIds,
        drafts
      )
    } catch (
      validationError
    ) {
      setError(
        getErrorMessage(
          validationError
        )
      )

      return
    }

    setBusy(true)
    setError('')
    setSuccess('')

    try {
      const nextOrderByAssignment =
        new Map<
          EntityId,
          number
        >()

      for (
        const assignmentId of
        selectedAssignmentIds
      ) {
        const currentModules =
          snapshot.modules.filter(
            module =>
              module.teachingAssignmentId ===
              assignmentId
          )

        const nextOrder =
          currentModules.length >
          0
            ? Math.max(
                ...currentModules.map(
                  module =>
                    module.order
                )
              ) +
              1
            : 1

        nextOrderByAssignment.set(
          assignmentId,
          nextOrder
        )
      }

      for (
        const assignmentId of
        selectedAssignmentIds
      ) {
        let nextOrder =
          nextOrderByAssignment.get(
            assignmentId
          ) ??
          1

        for (
          const draft of
          drafts
        ) {
          await maProfessorRepository.createModule({
            academicYearId:
              snapshot.academicYear.id,

            teachingAssignmentId:
              assignmentId,

            code:
              draft.code,

            name:
              draft.name,

            plannedPeriods:
              draft.plannedPeriods,

            order:
              nextOrder,

            plannedStartDate:
              null,

            plannedEndDate:
              null,

            active:
              true
          })

          nextOrder +=
            1
        }
      }

      await refreshSnapshot()

      setCode('')
      setName('')
      setPlannedPeriods('')
      setBulkText('')

      setSuccess(
        drafts.length ===
        1
          ? `UFCD ou módulo aplicado a ${selectedAssignmentIds.length} ${
              selectedAssignmentIds.length ===
              1
                ? 'turma'
                : 'turmas'
            }.`
          : `${drafts.length} UFCD/módulos aplicados a ${selectedAssignmentIds.length} ${
              selectedAssignmentIds.length ===
              1
                ? 'turma'
                : 'turmas'
            }.`
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
    if (busy) {
      return
    }

    if (
      activeModules.length ===
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
        `Ainda existem disciplinas sem UFCD ou módulos em: ${assignmentsWithoutModules
          .map(assignment => {
            const group =
              groupById.get(
                assignment.groupId
              )

            const subject =
              subjectById.get(
                assignment.subjectId
              )

            return `${
              subject?.name ??
              'Disciplina'
            } · ${
              group?.name ??
              'Turma'
            }`
          })
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
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-black/20 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
          Passo 4 de 9
        </p>

        <h2 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
          UFCD / módulos
        </h2>

        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
          Escolha a disciplina, introduza a UFCD uma vez e deixe selecionadas todas as turmas onde ela se aplica. Só altera as turmas quando houver uma exceção.
        </p>

        <div className="mt-7">
          <p className="text-sm font-black text-slate-200">
            1. Disciplina
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {activeSubjects.map(subject => (
              <button
                key={subject.id}
                type="button"
                onClick={() =>
                  setSelectedSubjectId(
                    subject.id
                  )
                }
                className={`rounded-xl border px-3 py-2.5 text-sm font-black transition ${
                  selectedSubjectId ===
                  subject.id
                    ? 'border-cyan-300/40 bg-cyan-300/15 text-cyan-50'
                    : 'border-white/10 bg-white/[0.035] text-slate-300 hover:border-cyan-300/25'
                }`}
              >
                {subject.name}
              </button>
            ))}
          </div>
        </div>

        {selectedSubject ? (
          <>
            <div className="mt-7">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-200">
                    2. Turmas onde se aplica
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Por defeito ficam selecionadas todas as turmas onde leciona {selectedSubject.name}.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedAssignmentIds(
                      selectedAssignments.map(
                        assignment =>
                          assignment.id
                      )
                    )
                  }
                  className="text-xs font-bold text-cyan-200 transition hover:text-cyan-100"
                >
                  Selecionar todas
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {selectedAssignments.map(
                  assignment => {
                    const group =
                      groupById.get(
                        assignment.groupId
                      )

                    const selected =
                      selectedAssignmentIds.includes(
                        assignment.id
                      )

                    return (
                      <button
                        key={
                          assignment.id
                        }
                        type="button"
                        onClick={() =>
                          toggleAssignment(
                            assignment.id
                          )
                        }
                        className={`rounded-xl border px-3 py-2.5 text-sm font-black transition ${
                          selected
                            ? 'border-emerald-300/35 bg-emerald-300/10 text-emerald-100'
                            : 'border-white/10 bg-slate-900/70 text-slate-500 hover:border-white/20'
                        }`}
                      >
                        {selected
                          ? '✓ '
                          : ''}
                        {group?.name ??
                          assignment.displayName}
                      </button>
                    )
                  }
                )}
              </div>
            </div>

            <div className="mt-7">
              <p className="text-sm font-black text-slate-200">
                3. Introduza as UFCD / módulos
              </p>

              <div className="mt-3 inline-flex rounded-xl border border-white/10 bg-slate-900/70 p-1">
                <button
                  type="button"
                  onClick={() =>
                    setEntryMode(
                      'single'
                    )
                  }
                  className={`rounded-lg px-3 py-2 text-xs font-black transition ${
                    entryMode ===
                    'single'
                      ? 'bg-cyan-300 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Uma de cada vez
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setEntryMode(
                      'bulk'
                    )
                  }
                  className={`rounded-lg px-3 py-2 text-xs font-black transition ${
                    entryMode ===
                    'bulk'
                      ? 'bg-cyan-300 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Colar várias
                </button>
              </div>

              {entryMode ===
              'single' ? (
                <div className="mt-4 space-y-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                  <div className="grid gap-4 sm:grid-cols-[0.65fr_1.35fr]">
                    <label className="block">
                      <span className="mb-2 block text-xs font-bold text-slate-300">
                        Código · opcional
                      </span>

                      <input
                        type="text"
                        value={
                          code
                        }
                        onChange={
                          event =>
                            setCode(
                              event
                                .target
                                .value
                            )
                        }
                        placeholder="10389"
                        className={
                          inputClassName
                        }
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-xs font-bold text-slate-300">
                        Nome da UFCD ou módulo
                      </span>

                      <input
                        type="text"
                        value={
                          name
                        }
                        onChange={
                          event =>
                            setName(
                              event
                                .target
                                .value
                            )
                        }
                        placeholder="Nome da UFCD ou módulo"
                        className={
                          inputClassName
                        }
                      />
                    </label>
                  </div>

                  <label className="block max-w-xs">
                    <span className="mb-2 block text-xs font-bold text-slate-300">
                      Carga horária / tempos
                    </span>

                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={
                        plannedPeriods
                      }
                      onChange={
                        event =>
                          setPlannedPeriods(
                            event
                              .target
                              .value
                          )
                      }
                      placeholder="25"
                      className={
                        inputClassName
                      }
                    />
                  </label>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                  <label className="block">
                    <span className="mb-2 block text-xs font-bold text-slate-300">
                      Uma UFCD por linha
                    </span>

                    <textarea
                      rows={8}
                      value={
                        bulkText
                      }
                      onChange={
                        event =>
                          setBulkText(
                            event
                              .target
                              .value
                          )
                      }
                      placeholder={
                        '10389 | Expressão dramática | 25\n10390 | Expressão musical | 25\nExpressão plástica | 50'
                      }
                      className={`${inputClassName} resize-y font-mono text-xs leading-6`}
                    />
                  </label>

                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    Formatos aceites: “Código | Nome | Tempos” ou “Nome | Tempos”. Todas as linhas serão aplicadas às turmas selecionadas acima.
                  </p>
                </div>
              )}
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

            <button
              type="button"
              disabled={
                busy ||
                selectedAssignmentIds.length ===
                  0
              }
              onClick={() =>
                void handleAddModules()
              }
              className="mt-6 inline-flex w-full items-center justify-center rounded-2xl border border-cyan-200/30 bg-gradient-to-r from-cyan-300 to-sky-300 px-5 py-3.5 text-sm font-black text-slate-950 shadow-lg shadow-cyan-950/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {busy
                ? 'A guardar...'
                : selectedAssignmentIds.length >
                    1
                  ? `Adicionar às ${selectedAssignmentIds.length} turmas selecionadas`
                  : 'Adicionar UFCD / módulo'}
            </button>
          </>
        ) : (
          <p className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-sm text-amber-100">
            Não existem disciplinas disponíveis. Volte ao passo anterior e adicione pelo menos uma disciplina.
          </p>
        )}
      </section>

      <section className="rounded-[1.75rem] border border-white/10 bg-slate-950/55 p-5 shadow-xl shadow-black/15 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Estrutura criada
            </p>

            <h3 className="mt-2 text-xl font-black text-white">
              UFCD / módulos por turma
            </h3>
          </div>

          <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-black text-cyan-100">
            {activeModules.length}
          </span>
        </div>

        {selectedSubject ? (
          <div className="mt-5 space-y-3">
            {selectedAssignments.map(
              assignment => {
                const group =
                  groupById.get(
                    assignment.groupId
                  )

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
                    className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-300">
                          {group?.name ??
                            assignment.displayName}
                        </p>

                        <p className="mt-1 font-black text-white">
                          {selectedSubject.name}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-2.5 py-1 text-[0.68rem] font-black ${
                          modules.length >
                          0
                            ? 'bg-emerald-300/10 text-emerald-200'
                            : 'bg-amber-300/10 text-amber-200'
                        }`}
                      >
                        {modules.length}
                      </span>
                    </div>

                    {modules.length >
                    0 ? (
                      <div className="mt-3 space-y-2">
                        {modules.map(
                          module => (
                            <div
                              key={
                                module.id
                              }
                              className="rounded-xl border border-white/[0.07] bg-slate-950/55 px-3 py-2.5"
                            >
                              <p className="text-sm font-bold leading-5 text-slate-200">
                                {getModuleLabel(
                                  module
                                )}
                              </p>

                              <p className="mt-1 text-[0.68rem] text-slate-500">
                                {
                                  module.plannedPeriods
                                }{' '}
                                tempos
                              </p>
                            </div>
                          )
                        )}
                      </div>
                    ) : (
                      <p className="mt-3 text-xs leading-5 text-amber-200/80">
                        Ainda sem UFCD ou módulos.
                      </p>
                    )}
                  </article>
                )
              }
            )}
          </div>
        ) : null}

        {assignmentsWithoutModules.length >
        0 ? (
          <div className="mt-5 rounded-2xl border border-amber-300/15 bg-amber-300/[0.05] p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-200">
              Ainda falta configurar
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {assignmentsWithoutModules.map(
                assignment => {
                  const group =
                    groupById.get(
                      assignment.groupId
                    )

                  const subject =
                    subjectById.get(
                      assignment.subjectId
                    )

                  return (
                    <span
                      key={
                        assignment.id
                      }
                      className="rounded-full border border-amber-300/15 bg-slate-950/40 px-2.5 py-1 text-[0.68rem] font-bold text-amber-100"
                    >
                      {subject?.name ??
                        'Disciplina'}{' '}
                      ·{' '}
                      {group?.name ??
                        'Turma'}
                    </span>
                  )
                }
              )}
            </div>
          </div>
        ) : null}

        <button
          type="button"
          disabled={
            busy ||
            activeModules.length ===
              0
          }
          onClick={() =>
            void handleContinue()
          }
          className="mt-6 inline-flex w-full items-center justify-center rounded-2xl border border-violet-300/25 bg-violet-300/10 px-5 py-3.5 text-sm font-black text-violet-50 transition hover:bg-violet-300/15 disabled:cursor-not-allowed disabled:opacity-45"
        >
          Continuar para critérios de avaliação
        </button>
      </section>
    </div>
  )
}
