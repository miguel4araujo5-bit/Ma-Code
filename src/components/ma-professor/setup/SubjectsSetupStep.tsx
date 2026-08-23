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
  onSnapshotChange: (snapshot: SetupSnapshot) => void
  onCompleted: (snapshot: SetupSnapshot) => void
}

type SubjectFormState = {
  name: string
  shortName: string
  code: string
  groupIds: EntityId[]
}

type SubjectSuggestion = {
  name: string
  shortName: string
}

const subjectSuggestions: SubjectSuggestion[] = [
  {
    name: 'Área de Expressões',
    shortName: 'AE'
  },
  {
    name: 'Animação Sociocultural',
    shortName: 'ASC'
  },
  {
    name: 'Português',
    shortName: 'PORT'
  },
  {
    name: 'Inglês',
    shortName: 'ING'
  },
  {
    name: 'Área de Integração',
    shortName: 'AI'
  },
  {
    name: 'Tecnologias da Informação e Comunicação',
    shortName: 'TIC'
  },
  {
    name: 'Educação Física',
    shortName: 'EF'
  },
  {
    name: 'Psicologia',
    shortName: 'PSI'
  },
  {
    name: 'Sociologia',
    shortName: 'SOC'
  }
]

const emptyForm: SubjectFormState = {
  name: '',
  shortName: '',
  code: '',
  groupIds: []
}

const inputClassName =
  'w-full rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10'

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Ocorreu um erro inesperado.'
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.025] p-5 text-center">
      <p className="font-bold text-slate-200">
        Ainda não existem disciplinas.
      </p>

      <p className="mt-2 text-sm leading-6 text-slate-500">
        Escolha uma sugestão ou carregue em “Outra disciplina”.
      </p>
    </div>
  )
}

export default function SubjectsSetupStep({
  snapshot,
  onSnapshotChange,
  onCompleted
}: SubjectsSetupStepProps) {
  const [form, setForm] = useState<SubjectFormState>(emptyForm)

  const [editingSubjectId, setEditingSubjectId] =
    useState<EntityId | null>(null)

  const [customMode, setCustomMode] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const activeGroups = useMemo(
    () => snapshot.groups.filter(group => group.active),
    [snapshot.groups]
  )

  const activeSubjects = useMemo(
    () => snapshot.subjects.filter(subject => subject.active),
    [snapshot.subjects]
  )

  const assignmentsBySubject = useMemo(() => {
    const result = new Map<EntityId, Set<EntityId>>()

    snapshot.teachingAssignments.forEach(assignment => {
      if (!assignment.active) {
        return
      }

      const groupIds =
        result.get(assignment.subjectId) ??
        new Set<EntityId>()

      groupIds.add(assignment.groupId)

      result.set(
        assignment.subjectId,
        groupIds
      )
    })

    return result
  }, [snapshot.teachingAssignments])

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

  async function refreshSnapshot() {
    const nextSnapshot = await maProfessorRepository.getSetupSnapshot(
      snapshot.academicYear.id
    )

    onSnapshotChange(nextSnapshot)

    return nextSnapshot
  }

  function resetForm() {
    setForm(emptyForm)
    setEditingSubjectId(null)
    setCustomMode(false)
  }

  function chooseSuggestion(
    suggestion: SubjectSuggestion
  ) {
    setEditingSubjectId(null)
    setCustomMode(false)
    setError('')
    setSuccess('')

    setForm({
      name: suggestion.name,
      shortName: suggestion.shortName,
      code: '',
      groupIds: activeGroups.map(group => group.id)
    })
  }

  function chooseCustomSubject() {
    setEditingSubjectId(null)
    setCustomMode(true)
    setError('')
    setSuccess('')

    setForm({
      ...emptyForm,
      groupIds: activeGroups.map(group => group.id)
    })
  }

  function toggleGroup(groupId: EntityId) {
    const existingAssignments = editingSubjectId
      ? assignmentsBySubject.get(editingSubjectId) ??
        new Set<EntityId>()
      : new Set<EntityId>()

    if (existingAssignments.has(groupId)) {
      return
    }

    setForm(current => ({
      ...current,
      groupIds: current.groupIds.includes(groupId)
        ? current.groupIds.filter(id => id !== groupId)
        : [...current.groupIds, groupId]
    }))
  }

  function startEditing(subject: Subject) {
    const assignedGroupIds = Array.from(
      assignmentsBySubject.get(subject.id) ?? []
    )

    setEditingSubjectId(subject.id)
    setCustomMode(true)

    setForm({
      name: subject.name,
      shortName: subject.shortName,
      code: subject.code,
      groupIds: assignedGroupIds
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
      assignmentsBySubject.get(subjectId) ??
      new Set<EntityId>()

    const missingGroupIds = groupIds.filter(
      groupId => !existingGroupIds.has(groupId)
    )

    for (const groupId of missingGroupIds) {
      const group = groupById.get(groupId)

      if (!group) {
        throw new Error(
          'Uma das turmas selecionadas já não existe.'
        )
      }

      await maProfessorRepository.createTeachingAssignment({
        academicYearId: snapshot.academicYear.id,
        groupId,
        subjectId,
        displayName: `${
          shortName.trim() ||
          subjectName.trim()
        } · ${group.name}`,
        active: true
      })
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (busy) {
      return
    }

    if (!form.name.trim()) {
      setError(
        'Escolha uma disciplina ou indique o nome em “Outra disciplina”.'
      )

      return
    }

    if (form.groupIds.length === 0) {
      setError(
        'Selecione pelo menos uma turma para esta disciplina.'
      )

      return
    }

    setBusy(true)
    setError('')
    setSuccess('')

    try {
      if (editingSubjectId) {
        const updatedSubject =
          await maProfessorRepository.updateSubject(
            editingSubjectId,
            {
              name: form.name,
              shortName: form.shortName,
              code: form.code
            }
          )

        await createMissingAssignments(
          updatedSubject.id,
          form.groupIds,
          updatedSubject.name,
          updatedSubject.shortName
        )

        setSuccess(
          'Disciplina atualizada.'
        )
      } else {
        const subject =
          await maProfessorRepository.createSubject({
            academicYearId: snapshot.academicYear.id,
            name: form.name,
            shortName: form.shortName,
            code: form.code,
            active: true
          })

        await createMissingAssignments(
          subject.id,
          form.groupIds,
          subject.name,
          subject.shortName
        )

        setSuccess(
          'Disciplina adicionada.'
        )
      }

      await refreshSnapshot()
      resetForm()
    } catch (submitError) {
      setError(
        getErrorMessage(submitError)
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
      activeSubjects.length === 0 ||
      snapshot.teachingAssignments.filter(
        assignment => assignment.active
      ).length === 0
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

      onSnapshotChange(nextSnapshot)
      onCompleted(nextSnapshot)
    } catch (continueError) {
      setError(
        getErrorMessage(continueError)
      )
    } finally {
      setBusy(false)
    }
  }

  const showForm = Boolean(
    form.name ||
    customMode ||
    editingSubjectId
  )

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-black/20 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
          Passo 3 de 9
        </p>

        <h2 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
          Que disciplinas leciona?
        </h2>

        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
          Crie cada disciplina apenas uma vez. Depois selecione todas as turmas onde a leciona.
        </p>

        {!editingSubjectId ? (
          <div className="mt-7">
            <p className="text-sm font-black text-slate-200">
              Sugestões rápidas
            </p>

            <p className="mt-2 text-xs leading-5 text-slate-500">
              A lista é apenas um atalho. Se a sua disciplina não aparecer, escolha “Outra disciplina”.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {subjectSuggestions.map(suggestion => {
                const selected =
                  form.name === suggestion.name &&
                  !customMode

                return (
                  <button
                    key={suggestion.name}
                    type="button"
                    onClick={() =>
                      chooseSuggestion(suggestion)
                    }
                    className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
                      selected
                        ? 'border-cyan-300/40 bg-cyan-300/15 text-cyan-50'
                        : 'border-white/10 bg-white/[0.035] text-slate-300 hover:border-cyan-300/25 hover:bg-cyan-300/[0.06]'
                    }`}
                  >
                    {suggestion.name}
                  </button>
                )
              })}

              <button
                type="button"
                onClick={chooseCustomSubject}
                className={`rounded-xl border px-3 py-2.5 text-sm font-black transition ${
                  customMode &&
                  !editingSubjectId
                    ? 'border-violet-300/40 bg-violet-300/15 text-violet-50'
                    : 'border-violet-300/20 bg-violet-300/[0.06] text-violet-200 hover:bg-violet-300/[0.1]'
                }`}
              >
                + Outra disciplina
              </button>
            </div>
          </div>
        ) : null}

        {showForm ? (
          <form
            onSubmit={handleSubmit}
            className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-black text-white">
                {editingSubjectId
                  ? 'Editar disciplina'
                  : form.name ||
                    'Outra disciplina'}
              </p>

              {!editingSubjectId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs font-bold text-slate-500 transition hover:text-white"
                >
                  Limpar
                </button>
              ) : null}
            </div>

            <div className="mt-5 space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-200">
                  Nome da disciplina
                </span>

                <input
                  type="text"
                  value={form.name}
                  onChange={event =>
                    setForm(current => ({
                      ...current,
                      name: event.target.value
                    }))
                  }
                  placeholder="Nome da disciplina"
                  required
                  className={inputClassName}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-200">
                    Sigla{' '}
                    <span className="font-medium text-slate-500">
                      · opcional
                    </span>
                  </span>

                  <input
                    type="text"
                    value={form.shortName}
                    onChange={event =>
                      setForm(current => ({
                        ...current,
                        shortName: event.target.value
                      }))
                    }
                    placeholder="AE"
                    className={inputClassName}
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-200">
                    Código{' '}
                    <span className="font-medium text-slate-500">
                      · opcional
                    </span>
                  </span>

                  <input
                    type="text"
                    value={form.code}
                    onChange={event =>
                      setForm(current => ({
                        ...current,
                        code: event.target.value
                      }))
                    }
                    placeholder="Opcional"
                    className={inputClassName}
                  />
                </label>
              </div>

              <fieldset>
                <legend className="text-sm font-bold text-slate-200">
                  Em que turmas leciona esta disciplina?
                </legend>

                <div className="mt-3 flex flex-wrap gap-2">
                  {activeGroups.map(group => {
                    const existingAssignment =
                      editingSubjectId
                        ? assignmentsBySubject
                            .get(editingSubjectId)
                            ?.has(group.id) ??
                          false
                        : false

                    const selected =
                      form.groupIds.includes(group.id)

                    return (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() =>
                          toggleGroup(group.id)
                        }
                        className={`rounded-xl border px-3 py-2.5 text-sm font-black transition ${
                          selected
                            ? 'border-cyan-300/40 bg-cyan-300/15 text-cyan-50'
                            : 'border-white/10 bg-slate-900/70 text-slate-400 hover:border-cyan-300/25'
                        } ${
                          existingAssignment
                            ? 'cursor-default'
                            : ''
                        }`}
                        title={
                          existingAssignment
                            ? 'Associação já guardada'
                            : undefined
                        }
                      >
                        {selected ? '✓ ' : ''}
                        {group.name}
                      </button>
                    )
                  })}
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

            <div className="mt-5 flex gap-3">
              <button
                type="submit"
                disabled={busy}
                className="flex-1 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:opacity-50"
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
                  disabled={busy}
                  onClick={resetForm}
                  className="rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-slate-300"
                >
                  Cancelar
                </button>
              ) : null}
            </div>
          </form>
        ) : null}

        {!showForm && error ? (
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
      </section>

      <section className="rounded-[1.75rem] border border-white/10 bg-slate-950/55 p-5 shadow-xl shadow-black/15 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Estrutura criada
            </p>

            <h3 className="mt-2 text-xl font-black text-white">
              Disciplinas adicionadas
            </h3>
          </div>

          <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-black text-cyan-100">
            {activeSubjects.length}
          </span>
        </div>

        <div className="mt-5 space-y-3">
          {activeSubjects.length === 0 ? (
            <EmptyState />
          ) : (
            activeSubjects.map(subject => {
              const assignedGroupIds = Array.from(
                assignmentsBySubject.get(subject.id) ?? []
              )

              return (
                <article
                  key={subject.id}
                  className={`rounded-2xl border p-4 transition ${
                    editingSubjectId === subject.id
                      ? 'border-cyan-300/35 bg-cyan-300/[0.08]'
                      : 'border-white/10 bg-white/[0.035]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-black text-white">
                        {subject.name}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {assignedGroupIds.map(groupId => {
                          const group =
                            groupById.get(groupId)

                          return group ? (
                            <span
                              key={groupId}
                              className="rounded-full border border-white/10 bg-slate-950/60 px-2.5 py-1 text-[0.68rem] font-bold text-slate-300"
                            >
                              {group.name}
                            </span>
                          ) : null
                        })}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        startEditing(subject)
                      }
                      className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-300 transition hover:border-cyan-300/25 hover:text-cyan-100"
                    >
                      Editar
                    </button>
                  </div>
                </article>
              )
            })
          )}
        </div>

        <button
          type="button"
          disabled={
            busy ||
            activeSubjects.length === 0
          }
          onClick={() =>
            void handleContinue()
          }
          className="mt-6 inline-flex w-full items-center justify-center rounded-2xl border border-violet-300/25 bg-violet-300/10 px-5 py-3.5 text-sm font-black text-violet-50 transition hover:bg-violet-300/15 disabled:cursor-not-allowed disabled:opacity-45"
        >
          Continuar para UFCD / módulos
        </button>
      </section>
    </div>
  )
}
