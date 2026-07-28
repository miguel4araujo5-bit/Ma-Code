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
  EntityId,
  Subject
} from '../types'

type SubjectsSetupStepProps = {
  snapshot: SetupSnapshot
  onSnapshotChange: (
    snapshot: SetupSnapshot
  ) => void
  onCompleted: (
    snapshot: SetupSnapshot
  ) => void
}

type SubjectFormState = {
  name: string
  shortName: string
  code: string
  groupIds: EntityId[]
}

const emptyForm: SubjectFormState = {
  name: '',
  shortName: '',
  code: '',
  groupIds: []
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

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.025] p-5 text-center">
      <p className="font-bold text-slate-200">
        Ainda não existem disciplinas.
      </p>

      <p className="mt-2 text-sm leading-6 text-slate-500">
        Adicione uma disciplina e associe-a a pelo menos uma turma.
      </p>
    </div>
  )
}

export default function SubjectsSetupStep({
  snapshot,
  onSnapshotChange,
  onCompleted
}: SubjectsSetupStepProps) {
  const [
    form,
    setForm
  ] =
    useState<SubjectFormState>(
      emptyForm
    )

  const [
    editingSubjectId,
    setEditingSubjectId
  ] =
    useState<EntityId | null>(
      null
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

  const assignmentsBySubject =
    useMemo(() => {
      const result =
        new Map<
          EntityId,
          Set<EntityId>
        >()

      snapshot.teachingAssignments.forEach(
        (
          assignment
        ) => {
          const groupIds =
            result.get(
              assignment.subjectId
            ) ??
            new Set<EntityId>()

          groupIds.add(
            assignment.groupId
          )

          result.set(
            assignment.subjectId,
            groupIds
          )
        }
      )

      return result
    }, [
      snapshot.teachingAssignments
    ])

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

  function resetForm() {
    setForm(
      emptyForm
    )

    setEditingSubjectId(
      null
    )
  }

  function toggleGroup(
    groupId: EntityId
  ) {
    const existingAssignments =
      editingSubjectId
        ? assignmentsBySubject.get(
            editingSubjectId
          ) ??
          new Set<EntityId>()
        : new Set<EntityId>()

    if (
      existingAssignments.has(
        groupId
      )
    ) {
      return
    }

    setForm(
      (
        current
      ) => {
        const selected =
          current.groupIds.includes(
            groupId
          )

        return {
          ...current,
          groupIds:
            selected
              ? current.groupIds.filter(
                  (
                    id
                  ) =>
                    id !==
                    groupId
                )
              : [
                  ...current.groupIds,
                  groupId
                ]
        }
      }
    )
  }

  function startEditing(
    subject: Subject
  ) {
    const assignedGroupIds =
      Array.from(
        assignmentsBySubject.get(
          subject.id
        ) ??
        []
      )

    setEditingSubjectId(
      subject.id
    )

    setForm({
      name:
        subject.name,
      shortName:
        subject.shortName,
      code:
        subject.code,
      groupIds:
        assignedGroupIds
    })

    setError('')
    setSuccess('')
  }

  async function createMissingAssignments(
    subjectId: EntityId,
    groupIds: EntityId[],
    subjectName: string,
    shortName: string
  ) {
    const existingGroupIds =
      assignmentsBySubject.get(
        subjectId
      ) ??
      new Set<EntityId>()

    const missingGroupIds =
      groupIds.filter(
        (
          groupId
        ) =>
          !existingGroupIds.has(
            groupId
          )
      )

    for (
      const groupId
      of missingGroupIds
    ) {
      const group =
        groupById.get(
          groupId
        )

      if (!group) {
        throw new Error(
          'Uma das turmas selecionadas já não existe.'
        )
      }

      await maProfessorRepository.createTeachingAssignment(
        {
          academicYearId:
            snapshot.academicYear.id,
          groupId,
          subjectId,
          displayName:
            `${
              shortName.trim() ||
              subjectName.trim()
            } · ${group.name}`,
          active: true
        }
      )
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

    if (
      form.groupIds.length ===
      0
    ) {
      setError(
        'Selecione pelo menos uma turma para esta disciplina.'
      )

      return
    }

    setBusy(true)
    setError('')
    setSuccess('')

    try {
      if (
        editingSubjectId
      ) {
        const updatedSubject =
          await maProfessorRepository.updateSubject(
            editingSubjectId,
            {
              name:
                form.name,
              shortName:
                form.shortName,
              code:
                form.code
            }
          )

        await createMissingAssignments(
          updatedSubject.id,
          form.groupIds,
          updatedSubject.name,
          updatedSubject.shortName
        )

        setSuccess(
          'Disciplina atualizada com sucesso.'
        )
      } else {
        const subject =
          await maProfessorRepository.createSubject(
            {
              academicYearId:
                snapshot.academicYear.id,
              name:
                form.name,
              shortName:
                form.shortName,
              code:
                form.code,
              active: true
            }
          )

        await createMissingAssignments(
          subject.id,
          form.groupIds,
          subject.name,
          subject.shortName
        )

        setSuccess(
          'Disciplina adicionada com sucesso.'
        )
      }

      await refreshSnapshot()

      resetForm()
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
      snapshot.subjects.length ===
        0 ||
      snapshot.teachingAssignments.length ===
        0
    ) {
      setError(
        'Adicione pelo menos uma disciplina associada a uma turma antes de continuar.'
      )

      return
    }

    setBusy(true)
    setError('')
    setSuccess('')

    try {
      await maProfessorRepository.completeSetupStep(
        snapshot.academicYear.id,
        'subjects'
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
    <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
      <form
        onSubmit={
          handleSubmit
        }
        className="rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-black/20 sm:p-6"
      >
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
          Passo 3 de 9
        </p>

        <h2 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
          Disciplinas
        </h2>

        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
          Crie cada disciplina uma única vez e selecione todas as turmas
          onde a leciona. As UFCD, critérios, planificações e horários
          serão configurados para cada associação entre turma e
          disciplina.
        </p>

        <div className="mt-7 space-y-5">
          <label className="block">
            <FieldLabel>
              Nome da disciplina
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
              placeholder="Área de Expressões"
              autoComplete="off"
              required
              className={
                inputClassName
              }
            />
          </label>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block">
              <FieldLabel optional>
                Sigla
              </FieldLabel>

              <input
                type="text"
                value={
                  form.shortName
                }
                onChange={(
                  event
                ) =>
                  setForm(
                    (
                      current
                    ) => ({
                      ...current,
                      shortName:
                        event
                          .target
                          .value
                    })
                  )
                }
                placeholder="AE"
                autoComplete="off"
                className={
                  inputClassName
                }
              />
            </label>

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
                placeholder="AE-01"
                autoComplete="off"
                className={
                  inputClassName
                }
              />
            </label>
          </div>

          <fieldset>
            <legend className="text-sm font-bold text-slate-200">
              Turmas onde leciona
            </legend>

            <p className="mt-2 text-xs leading-6 text-slate-500">
              Pode selecionar várias turmas para a mesma disciplina.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {snapshot.groups.map(
                (
                  group
                ) => {
                  const existingAssignment =
                    editingSubjectId
                      ? assignmentsBySubject
                          .get(
                            editingSubjectId
                          )
                          ?.has(
                            group.id
                          ) ??
                        false
                      : false

                  const selected =
                    form.groupIds.includes(
                      group.id
                    )

                  return (
                    <label
                      key={
                        group.id
                      }
                      className={`flex items-start gap-3 rounded-2xl border p-4 transition ${
                        selected
                          ? 'border-cyan-300/35 bg-cyan-300/[0.08]'
                          : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                      } ${
                        existingAssignment
                          ? 'cursor-default'
                          : 'cursor-pointer'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={
                          selected
                        }
                        disabled={
                          existingAssignment
                        }
                        onChange={() =>
                          toggleGroup(
                            group.id
                          )
                        }
                        className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-900 text-cyan-300 focus:ring-cyan-300/30"
                      />

                      <span>
                        <span className="block font-black text-white">
                          {group.name}
                        </span>

                        <span className="mt-1 block text-xs leading-5 text-slate-500">
                          {group.courseName ||
                            'Curso não indicado'}

                          {existingAssignment
                            ? ' · Já associada'
                            : ''}
                        </span>
                      </span>
                    </label>
                  )
                }
              )}
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
              : editingSubjectId
                ? 'Guardar alterações'
                : 'Adicionar disciplina'}
          </button>

          {editingSubjectId ? (
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
              Cancelar edição
            </button>
          ) : null}
        </div>
      </form>

      <section className="rounded-[1.75rem] border border-white/10 bg-slate-950/55 p-5 shadow-xl shadow-black/15 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Ano letivo
            </p>

            <h3 className="mt-2 text-xl font-black text-white">
              Disciplinas adicionadas
            </h3>
          </div>

          <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-black text-cyan-100">
            {snapshot.subjects.length}
          </span>
        </div>

        <div className="mt-5 space-y-3">
          {snapshot.subjects.length ===
          0 ? (
            <EmptyState />
          ) : (
            snapshot.subjects.map(
              (
                subject
              ) => {
                const assignedGroupIds =
                  Array.from(
                    assignmentsBySubject.get(
                      subject.id
                    ) ??
                    []
                  )

                return (
                  <article
                    key={
                      subject.id
                    }
                    className={`rounded-2xl border p-4 transition ${
                      editingSubjectId ===
                      subject.id
                        ? 'border-cyan-300/35 bg-cyan-300/[0.08]'
                        : 'border-white/10 bg-white/[0.035]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-black text-white">
                            {subject.name}
                          </p>

                          {subject.shortName ? (
                            <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-2 py-1 text-[0.65rem] font-bold text-violet-100">
                              {subject.shortName}
                            </span>
                          ) : null}
                        </div>

                        {subject.code ? (
                          <p className="mt-1 text-xs text-slate-500">
                            Código: {subject.code}
                          </p>
                        ) : null}

                        <div className="mt-3 flex flex-wrap gap-2">
                          {assignedGroupIds.length >
                          0 ? (
                            assignedGroupIds.map(
                              (
                                groupId
                              ) => {
                                const group =
                                  groupById.get(
                                    groupId
                                  )

                                return (
                                  <span
                                    key={
                                      groupId
                                    }
                                    className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-semibold text-slate-300"
                                  >
                                    {group?.name ??
                                      'Turma'}
                                  </span>
                                )
                              }
                            )
                          ) : (
                            <span className="text-xs text-amber-200">
                              Sem turma associada
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={
                          busy
                        }
                        onClick={() =>
                          startEditing(
                            subject
                          )
                        }
                        className="shrink-0 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-300 transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.07] hover:text-cyan-100 disabled:opacity-50"
                      >
                        Editar
                      </button>
                    </div>
                  </article>
                )
              }
            )
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-violet-300/15 bg-violet-300/[0.055] p-4">
          <p className="text-sm font-bold text-violet-100">
            A mesma disciplina pode ser utilizada em várias turmas.
          </p>

          <p className="mt-2 text-xs leading-6 text-violet-100/65">
            As UFCD e os restantes dados serão configurados separadamente
            para cada turma onde a disciplina é lecionada.
          </p>
        </div>

        <button
          type="button"
          disabled={
            busy ||
            snapshot.teachingAssignments.length ===
              0
          }
          onClick={() =>
            void handleContinue()
          }
          className="mt-6 inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.055] px-5 py-3.5 text-sm font-black text-white transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.09] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Guardar disciplinas e continuar
        </button>
      </section>
    </div>
  )
}
