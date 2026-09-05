import {
  type FormEvent,
  useMemo,
  useRef,
  useState
} from 'react'

import {
  maProfessorRepository,
  type SetupSnapshot
} from '../repository'
import {
  useMAProfessorUnsavedWorkspaceProtection
} from '../navigation/useUnsavedWorkspaceProtection'
import type {
  ClassGroup,
  EntityId
} from '../types'

type GroupsSetupStepProps = {
  snapshot: SetupSnapshot
  onSnapshotChange: (snapshot: SetupSnapshot) => void
  onCompleted: (snapshot: SetupSnapshot) => void
}

type ProfessionalGrade =
  | '10'
  | '11'
  | '12'

type GroupEditForm = {
  name: string
  courseName: string
  gradeLevel: string
}

const professionalGrades: Array<{
  id: ProfessionalGrade
  label: string
}> = [
  { id: '10', label: '10.º' },
  { id: '11', label: '11.º' },
  { id: '12', label: '12.º' }
]

const classLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

const inputClassName =
  'w-full rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10'

const DISCARD_STEP_MESSAGE =
  'Existem alterações por guardar neste passo. Se continuar, essas alterações serão perdidas. Pretende continuar?'

const DISCARD_EDIT_MESSAGE =
  'Existem alterações por guardar nesta turma. Se continuar, essas alterações serão perdidas. Pretende continuar?'

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Ocorreu um erro inesperado.'
}

function getGradeLabel(grade: ProfessionalGrade) {
  return professionalGrades.find(item => item.id === grade)?.label ?? grade
}

function getGradeFromGroupName(name: string): ProfessionalGrade | null {
  const trimmed = name.trim()

  if (trimmed.startsWith('10')) {
    return '10'
  }

  if (trimmed.startsWith('11')) {
    return '11'
  }

  if (trimmed.startsWith('12')) {
    return '12'
  }

  return null
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.025] p-5 text-center">
      <p className="font-bold text-slate-200">
        Ainda não existem turmas.
      </p>

      <p className="mt-2 text-sm leading-6 text-slate-500">
        Selecione um ou mais anos e depois as letras das turmas que leciona.
      </p>
    </div>
  )
}

export default function GroupsSetupStep({
  snapshot,
  onSnapshotChange,
  onCompleted
}: GroupsSetupStepProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [selectedYears, setSelectedYears] = useState<ProfessionalGrade[]>([])
  const [selectedGroupNames, setSelectedGroupNames] = useState<string[]>([])
  const [editingGroupId, setEditingGroupId] = useState<EntityId | null>(null)

  const [editForm, setEditForm] = useState<GroupEditForm>({
    name: '',
    courseName: '',
    gradeLevel: ''
  })

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const activeGroups = useMemo(
    () => snapshot.groups.filter(group => group.active),
    [snapshot.groups]
  )

  const existingNames = useMemo(
    () =>
      new Set(
        snapshot.groups.map(group =>
          group.name.trim().toLocaleLowerCase('pt-PT')
        )
      ),
    [snapshot.groups]
  )

  const editingGroup = editingGroupId
    ? snapshot.groups.find(group => group.id === editingGroupId) ?? null
    : null

  const hasPendingGroupSelection = selectedGroupNames.length > 0

  const hasDirtyGroupEdit = Boolean(
    editingGroup &&
    (
      editForm.name !== editingGroup.name ||
      editForm.courseName !== editingGroup.courseName ||
      editForm.gradeLevel !== editingGroup.gradeLevel
    )
  )

  const hasUnsavedGroupSetupChanges =
    hasPendingGroupSelection || hasDirtyGroupEdit

  useMAProfessorUnsavedWorkspaceProtection(
    hasUnsavedGroupSetupChanges,
    rootRef,
    DISCARD_STEP_MESSAGE
  )

  async function refreshSnapshot() {
    const nextSnapshot = await maProfessorRepository.getSetupSnapshot(
      snapshot.academicYear.id
    )

    onSnapshotChange(nextSnapshot)

    return nextSnapshot
  }

  function toggleYear(grade: ProfessionalGrade) {
    setError('')
    setSuccess('')

    setSelectedYears(current => {
      if (current.includes(grade)) {
        const prefix = `${getGradeLabel(grade)} `

        setSelectedGroupNames(groups =>
          groups.filter(groupName => !groupName.startsWith(prefix))
        )

        return current.filter(item => item !== grade)
      }

      return [...current, grade]
    })
  }

  function toggleGroup(
    grade: ProfessionalGrade,
    letter: string
  ) {
    const groupName = `${getGradeLabel(grade)} ${letter}`

    setError('')
    setSuccess('')

    setSelectedGroupNames(current =>
      current.includes(groupName)
        ? current.filter(item => item !== groupName)
        : [...current, groupName]
    )
  }

  async function handleAddSelected() {
    if (busy) {
      return
    }

    if (selectedYears.length === 0) {
      setError('Selecione pelo menos um ano: 10.º, 11.º ou 12.º.')
      return
    }

    if (selectedGroupNames.length === 0) {
      setError('Selecione pelo menos uma turma.')
      return
    }

    const newGroupNames = selectedGroupNames.filter(
      name => !existingNames.has(name.toLocaleLowerCase('pt-PT'))
    )

    if (newGroupNames.length === 0) {
      setError('As turmas selecionadas já estão adicionadas.')
      return
    }

    setBusy(true)
    setError('')
    setSuccess('')

    try {
      for (const name of newGroupNames) {
        const grade = getGradeFromGroupName(name)

        await maProfessorRepository.createGroup({
          academicYearId: snapshot.academicYear.id,
          name,
          courseName: '',
          gradeLevel: grade
            ? `${getGradeLabel(grade)} ano`
            : '',
          active: true
        })
      }

      await refreshSnapshot()

      setSelectedGroupNames([])

      setSuccess(
        newGroupNames.length === 1
          ? 'Turma adicionada.'
          : `${newGroupNames.length} turmas adicionadas.`
      )
    } catch (submitError) {
      setError(getErrorMessage(submitError))
    } finally {
      setBusy(false)
    }
  }

  function startEditing(group: ClassGroup) {
    setEditingGroupId(group.id)

    setEditForm({
      name: group.name,
      courseName: group.courseName,
      gradeLevel: group.gradeLevel
    })

    setError('')
    setSuccess('')
  }

  function confirmDiscardDirtyGroupEdit() {
    return !hasDirtyGroupEdit || window.confirm(DISCARD_EDIT_MESSAGE)
  }

  function requestStartEditing(group: ClassGroup) {
    if (
      group.id !== editingGroupId &&
      !confirmDiscardDirtyGroupEdit()
    ) {
      return
    }

    startEditing(group)
  }

  function cancelEditing() {
    setEditingGroupId(null)

    setEditForm({
      name: '',
      courseName: '',
      gradeLevel: ''
    })
  }

  function requestCancelEditing() {
    if (!confirmDiscardDirtyGroupEdit()) {
      return
    }

    cancelEditing()
  }

  async function handleEditSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (!editingGroupId || busy) {
      return
    }

    setBusy(true)
    setError('')
    setSuccess('')

    try {
      await maProfessorRepository.updateGroup(
        editingGroupId,
        {
          name: editForm.name,
          courseName: editForm.courseName,
          gradeLevel: editForm.gradeLevel
        }
      )

      await refreshSnapshot()
      cancelEditing()
      setSuccess('Turma atualizada.')
    } catch (submitError) {
      setError(getErrorMessage(submitError))
    } finally {
      setBusy(false)
    }
  }

  async function handleContinue() {
    if (busy) {
      return
    }

    if (hasUnsavedGroupSetupChanges) {
      setError(
        'Existem alterações por guardar neste passo. Adicione as turmas selecionadas ou guarde/cancele a edição em curso antes de continuar.'
      )
      return
    }

    if (activeGroups.length === 0) {
      setError('Adicione pelo menos uma turma antes de continuar.')
      return
    }

    setBusy(true)
    setError('')
    setSuccess('')

    try {
      await maProfessorRepository.completeSetupStep(
        snapshot.academicYear.id,
        'groups'
      )

      const nextSnapshot = await maProfessorRepository.getSetupSnapshot(
        snapshot.academicYear.id
      )

      onSnapshotChange(nextSnapshot)
      onCompleted(nextSnapshot)
    } catch (continueError) {
      setError(getErrorMessage(continueError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      ref={rootRef}
      className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]"
    >
      <section className="rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-black/20 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
          Passo 2 de 9
        </p>

        <h2 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
          Que turmas leciona?
        </h2>

        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
          No ensino profissional trabalhamos apenas com 10.º, 11.º e 12.º. Pode selecionar vários anos e várias turmas de uma só vez.
        </p>

        <div className="mt-7">
          <p className="text-sm font-black text-slate-200">
            1. Selecione os anos
          </p>

          <div className="mt-3 grid grid-cols-3 gap-3">
            {professionalGrades.map(grade => {
              const selected = selectedYears.includes(grade.id)

              return (
                <button
                  key={grade.id}
                  type="button"
                  onClick={() => toggleYear(grade.id)}
                  className={`rounded-2xl border px-4 py-4 text-center text-lg font-black transition ${
                    selected
                      ? 'border-cyan-300/45 bg-cyan-300/15 text-cyan-50'
                      : 'border-white/10 bg-white/[0.035] text-slate-300 hover:border-cyan-300/25 hover:bg-cyan-300/[0.06]'
                  }`}
                >
                  {selected ? '✓ ' : ''}
                  {grade.label}
                </button>
              )
            })}
          </div>
        </div>

        {selectedYears.length > 0 ? (
          <div className="mt-7 space-y-6">
            <p className="text-sm font-black text-slate-200">
              2. Selecione as turmas
            </p>

            {selectedYears.map(grade => (
              <div
                key={grade}
                className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"
              >
                <p className="font-black text-white">
                  {getGradeLabel(grade)} ano
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {classLetters.map(letter => {
                    const groupName = `${getGradeLabel(grade)} ${letter}`

                    const selected =
                      selectedGroupNames.includes(groupName)

                    const alreadyAdded = existingNames.has(
                      groupName.toLocaleLowerCase('pt-PT')
                    )

                    return (
                      <button
                        key={letter}
                        type="button"
                        disabled={alreadyAdded}
                        onClick={() => toggleGroup(grade, letter)}
                        className={`h-10 min-w-10 rounded-xl border px-3 text-sm font-black transition ${
                          alreadyAdded
                            ? 'cursor-default border-emerald-300/15 bg-emerald-300/[0.05] text-emerald-300/60'
                            : selected
                              ? 'border-cyan-300/45 bg-cyan-300/15 text-cyan-50'
                              : 'border-white/10 bg-slate-900/70 text-slate-300 hover:border-cyan-300/25'
                        }`}
                        title={
                          alreadyAdded
                            ? 'Turma já adicionada'
                            : undefined
                        }
                      >
                        {alreadyAdded ? '✓' : letter}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {selectedGroupNames.length > 0 ? (
          <div className="mt-6 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-200">
              A adicionar
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {selectedGroupNames
                .slice()
                .sort((left, right) =>
                  left.localeCompare(
                    right,
                    'pt-PT',
                    {
                      numeric: true
                    }
                  )
                )
                .map(name => (
                  <span
                    key={name}
                    className="rounded-full border border-cyan-300/20 bg-slate-950/50 px-3 py-1.5 text-xs font-black text-cyan-100"
                  >
                    {name}
                  </span>
                ))}
            </div>
          </div>
        ) : null}

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
          disabled={busy || selectedGroupNames.length === 0}
          onClick={() => void handleAddSelected()}
          className="mt-6 inline-flex w-full items-center justify-center rounded-2xl border border-cyan-200/30 bg-gradient-to-r from-cyan-300 to-sky-300 px-5 py-3.5 text-sm font-black text-slate-950 shadow-lg shadow-cyan-950/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {busy
            ? 'A guardar...'
            : selectedGroupNames.length > 1
              ? `Adicionar ${selectedGroupNames.length} turmas`
              : 'Adicionar turma'}
        </button>
      </section>

      <section className="rounded-[1.75rem] border border-white/10 bg-slate-950/55 p-5 shadow-xl shadow-black/15 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Ensino profissional
            </p>

            <h3 className="mt-2 text-xl font-black text-white">
              Turmas adicionadas
            </h3>
          </div>

          <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-black text-cyan-100">
            {activeGroups.length}
          </span>
        </div>

        <div className="mt-5 space-y-3">
          {activeGroups.length === 0 ? (
            <EmptyState />
          ) : (
            activeGroups.map(group => (
              <article
                key={group.id}
                className={`rounded-2xl border p-4 transition ${
                  editingGroupId === group.id
                    ? 'border-cyan-300/35 bg-cyan-300/[0.08]'
                    : 'border-white/10 bg-white/[0.035]'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-black text-white">
                      {group.name}
                    </p>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {group.courseName ||
                        group.gradeLevel ||
                        'Ensino profissional'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => requestStartEditing(group)}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-300 transition hover:border-cyan-300/25 hover:text-cyan-100"
                  >
                    Editar
                  </button>
                </div>
              </article>
            ))
          )}
        </div>

        {editingGroupId ? (
          <form
            onSubmit={handleEditSubmit}
            className="mt-5 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.045] p-4"
          >
            <p className="text-sm font-black text-white">
              Editar turma
            </p>

            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-bold text-slate-300">
                  Nome da turma
                </span>

                <input
                  type="text"
                  value={editForm.name}
                  onChange={event =>
                    setEditForm(current => ({
                      ...current,
                      name: event.target.value
                    }))
                  }
                  required
                  className={inputClassName}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold text-slate-300">
                  Curso ou área · opcional
                </span>

                <input
                  type="text"
                  value={editForm.courseName}
                  onChange={event =>
                    setEditForm(current => ({
                      ...current,
                      courseName: event.target.value
                    }))
                  }
                  placeholder="Técnico de Apoio Psicossocial"
                  className={inputClassName}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold text-slate-300">
                  Ano de escolaridade
                </span>

                <input
                  type="text"
                  value={editForm.gradeLevel}
                  onChange={event =>
                    setEditForm(current => ({
                      ...current,
                      gradeLevel: event.target.value
                    }))
                  }
                  className={inputClassName}
                />
              </label>
            </div>

            <div className="mt-4 flex gap-3">
              <button
                type="submit"
                disabled={busy}
                className="flex-1 rounded-xl bg-cyan-300 px-4 py-2.5 text-xs font-black text-slate-950 disabled:opacity-50"
              >
                Guardar alterações
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={requestCancelEditing}
                className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-bold text-slate-300"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : null}

        <div className="mt-6 border-t border-white/10 pt-5">
          <p className="text-xs leading-5 text-slate-500">
            Não precisa de indicar já o curso. Se quiser, pode acrescentá-lo numa turma através de “Editar”.
          </p>

          <button
            type="button"
            disabled={busy || activeGroups.length === 0}
            onClick={() => void handleContinue()}
            className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-violet-300/25 bg-violet-300/10 px-5 py-3.5 text-sm font-black text-violet-50 transition hover:bg-violet-300/15 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Continuar para as disciplinas
          </button>
        </div>
      </section>
    </div>
  )
}
