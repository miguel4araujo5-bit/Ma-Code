import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useState
} from 'react'

import type {
  EntityId,
  Student
} from '../types'

import type {
  StudentDraft
} from '../repository'

import type {
  CreateGroupWorkspaceInput,
  GroupsWorkspaceFilters,
  GroupsWorkspaceSnapshot,
  UpdateGroupWorkspaceInput,
  UpdateStudentWorkspaceInput
} from './groupsWorkspaceRepository'

interface GroupsWorkspaceViewProps {
  snapshot: GroupsWorkspaceSnapshot
  loading?: boolean
  error?: string
  onRefresh?: () => void

  onFiltersChange: (
    filters: GroupsWorkspaceFilters
  ) => void

  onCreateGroup: (
    input: CreateGroupWorkspaceInput
  ) => Promise<void> | void

  onUpdateGroup: (
    groupId: EntityId,
    changes: UpdateGroupWorkspaceInput
  ) => Promise<void> | void

  onSaveStudents: (
    academicYearId: EntityId,
    groupId: EntityId,
    drafts: StudentDraft[]
  ) => Promise<void> | void

  onUpdateStudent: (
    studentId: EntityId,
    changes: UpdateStudentWorkspaceInput
  ) => Promise<void> | void

  onSetStudentActive: (
    studentId: EntityId,
    active: boolean
  ) => Promise<void> | void
}

interface GroupFormState {
  name: string
  courseName: string
  gradeLevel: string
  active: boolean
}

interface StudentFormState {
  number: string
  name: string
  notes: string
}

type StudentForms = Record<
  EntityId,
  StudentFormState
>

type Feedback =
  | {
      tone: 'success' | 'error'
      message: string
    }
  | null

const fieldClass =
  'w-full rounded-xl border border-white/10 bg-slate-950/75 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10 disabled:cursor-wait disabled:opacity-60'

function getErrorMessage(
  error: unknown
) {
  return error instanceof Error
    ? error.message
    : 'Ocorreu um erro inesperado.'
}

function createEmptyGroupForm(): GroupFormState {
  return {
    name: '',
    courseName: '',
    gradeLevel: '',
    active: true
  }
}

function createGroupForm(
  snapshot: GroupsWorkspaceSnapshot
): GroupFormState {
  const group =
    snapshot.selectedGroup

  return group
    ? {
        name: group.name,
        courseName: group.courseName,
        gradeLevel: group.gradeLevel,
        active: group.active
      }
    : createEmptyGroupForm()
}

function createStudentForms(
  students: Student[]
): StudentForms {
  return Object.fromEntries(
    students.map(
      student => [
        student.id,
        {
          number: student.number,
          name: student.name,
          notes: student.notes
        }
      ]
    )
  ) as StudentForms
}

function splitStudentLine(
  line: string
) {
  if (
    line.includes('\t')
  ) {
    return line.split('\t')
  }

  if (
    line.includes(';')
  ) {
    return line.split(';')
  }

  return line.split(',')
}

function parseStudents(
  value: string
): StudentDraft[] {
  const drafts =
    value
      .split(/\r?\n/)
      .map(
        line =>
          line.trim()
      )
      .filter(Boolean)
      .map(
        line => {
          const [
            number = '',
            name = '',
            ...noteParts
          ] = splitStudentLine(
            line
          ).map(
            part =>
              part.trim()
          )

          return {
            number,
            name,
            notes:
              noteParts.join(' · ')
          }
        }
      )

  if (
    drafts.some(
      draft =>
        !draft.number ||
        !draft.name
    )
  ) {
    throw new Error(
      'Cada linha deve incluir o número e o nome do aluno.'
    )
  }

  return drafts
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

export default function GroupsWorkspaceView({
  snapshot,
  loading = false,
  error = '',
  onRefresh,
  onFiltersChange,
  onCreateGroup,
  onUpdateGroup,
  onSaveStudents,
  onUpdateStudent,
  onSetStudentActive
}: GroupsWorkspaceViewProps) {
  const [
    showCreateGroup,
    setShowCreateGroup
  ] =
    useState(false)

  const [
    newGroup,
    setNewGroup
  ] =
    useState<GroupFormState>(
      createEmptyGroupForm
    )

  const [
    groupForm,
    setGroupForm
  ] =
    useState<GroupFormState>(
      () =>
        createGroupForm(
          snapshot
        )
    )

  const [
    studentForms,
    setStudentForms
  ] =
    useState<StudentForms>(
      () =>
        createStudentForms(
          snapshot.students
        )
    )

  const [
    importText,
    setImportText
  ] =
    useState('')

  const [
    includeInactive,
    setIncludeInactive
  ] =
    useState(false)

  const [
    busyAction,
    setBusyAction
  ] =
    useState<string | null>(
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
    setGroupForm(
      createGroupForm(
        snapshot
      )
    )

    setStudentForms(
      createStudentForms(
        snapshot.students
      )
    )

    setImportText('')
  }, [
    snapshot.generatedAt
  ])

  const busy =
    loading ||
    Boolean(
      busyAction
    )

  const visibleStudents =
    includeInactive
      ? snapshot.students
      : snapshot.students.filter(
          student =>
            student.active
        )

  async function runAction(
    actionId: string,
    action: () => Promise<void> | void,
    successMessage: string
  ) {
    if (
      busyAction
    ) {
      return
    }

    setBusyAction(
      actionId
    )
    setFeedback(null)

    try {
      await action()

      setFeedback({
        tone: 'success',
        message: successMessage
      })
    } catch (
      actionError
    ) {
      setFeedback({
        tone: 'error',
        message:
          getErrorMessage(
            actionError
          )
      })
    } finally {
      setBusyAction(null)
    }
  }

  function updateNewGroup<
    Key extends keyof GroupFormState
  >(
    key: Key,
    value: GroupFormState[Key]
  ) {
    setNewGroup(
      current => ({
        ...current,
        [key]: value
      })
    )
  }

  function updateGroupForm<
    Key extends keyof GroupFormState
  >(
    key: Key,
    value: GroupFormState[Key]
  ) {
    setGroupForm(
      current => ({
        ...current,
        [key]: value
      })
    )
  }

  function updateStudentForm(
    studentId: EntityId,
    changes: Partial<StudentFormState>
  ) {
    setStudentForms(
      current => ({
        ...current,

        [studentId]: {
          number:
            current[studentId]
              ?.number ??
            '',

          name:
            current[studentId]
              ?.name ??
            '',

          notes:
            current[studentId]
              ?.notes ??
            '',

          ...changes
        }
      })
    )
  }

  async function createGroup(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    await runAction(
      'create-group',
      async () => {
        await onCreateGroup({
          academicYearId:
            snapshot.academicYear.id,

          name:
            newGroup.name,

          courseName:
            newGroup.courseName,

          gradeLevel:
            newGroup.gradeLevel
        })

        setNewGroup(
          createEmptyGroupForm()
        )
        setShowCreateGroup(false)
      },
      'A turma foi criada.'
    )
  }

  async function saveGroup(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (
      !snapshot.selectedGroup
    ) {
      return
    }

    await runAction(
      'save-group',
      () =>
        onUpdateGroup(
          snapshot.selectedGroup!.id,
          groupForm
        ),
      'Os dados da turma foram guardados.'
    )
  }

  async function importStudents(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    const group =
      snapshot.selectedGroup

    if (
      !group
    ) {
      return
    }

    let drafts: StudentDraft[]

    try {
      drafts =
        parseStudents(
          importText
        )
    } catch (
      parseError
    ) {
      setFeedback({
        tone: 'error',
        message:
          getErrorMessage(
            parseError
          )
      })

      return
    }

    await runAction(
      'import-students',
      async () => {
        await onSaveStudents(
          snapshot.academicYear.id,
          group.id,
          drafts
        )

        setImportText('')
      },
      drafts.length === 1
        ? 'O aluno foi guardado.'
        : `${drafts.length} alunos foram guardados.`
    )
  }

  async function saveStudent(
    student: Student
  ) {
    const form =
      studentForms[
        student.id
      ]

    if (
      !form
    ) {
      return
    }

    await runAction(
      `student-${student.id}`,
      () =>
        onUpdateStudent(
          student.id,
          form
        ),
      `Os dados de ${student.name} foram guardados.`
    )
  }

  async function toggleStudent(
    student: Student
  ) {
    await runAction(
      `toggle-${student.id}`,
      () =>
        onSetStudentActive(
          student.id,
          !student.active
        ),
      student.active
        ? `${student.name} foi marcado como inativo.`
        : `${student.name} voltou a ficar ativo.`
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
                  Turmas e alunos
                </span>

                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[0.65rem] font-bold text-slate-400">
                  {snapshot.academicYear.name}
                </span>
              </div>

              <h1 className="mt-4 text-2xl font-black tracking-tight text-white sm:text-3xl">
                Gestão das turmas
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
                Consulte a turma, atualize os alunos e acrescente novos nomes sem repetir a configuração inicial.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  setShowCreateGroup(
                    current =>
                      !current
                  )
                  setFeedback(null)
                }}
                disabled={busy}
                className="rounded-2xl border border-cyan-200/25 bg-cyan-300/10 px-5 py-3 text-sm font-black text-cyan-50 transition hover:bg-cyan-300/15 disabled:cursor-wait disabled:opacity-50"
              >
                {showCreateGroup
                  ? 'Cancelar'
                  : '+ Nova turma'}
              </button>

              <button
                type="button"
                onClick={onRefresh}
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
        </div>

        <div className="px-5 py-6 sm:px-7">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-200">
              Turma
            </span>

            <select
              value={
                snapshot.filters.groupId ??
                ''
              }
              onChange={(
                event: ChangeEvent<HTMLSelectElement>
              ) =>
                onFiltersChange({
                  groupId:
                    event.target.value ||
                    null
                })
              }
              disabled={
                busy ||
                snapshot.groups.length ===
                  0
              }
              className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {snapshot.groups.length ===
              0 ? (
                <option value="">
                  Sem turmas disponíveis
                </option>
              ) : null}

              {snapshot.groups.map(
                row => (
                  <option
                    key={
                      row.group.id
                    }
                    value={
                      row.group.id
                    }
                  >
                    {row.group.name}
                    {row.group.active
                      ? ''
                      : ' · inativa'}
                    {' · '}
                    {row.activeStudentCount}
                    {' alunos'}
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

      {showCreateGroup ? (
        <form
          onSubmit={createGroup}
          className="rounded-[2rem] border border-cyan-300/15 bg-cyan-300/[0.035] p-5 sm:p-7"
        >
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">
            Nova turma
          </p>

          <h2 className="mt-3 text-xl font-black text-white">
            Criar turma
          </h2>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <label>
              <FieldLabel>
                Nome da turma
              </FieldLabel>

              <input
                type="text"
                value={
                  newGroup.name
                }
                onChange={(
                  event: ChangeEvent<HTMLInputElement>
                ) =>
                  updateNewGroup(
                    'name',
                    event.target.value
                  )
                }
                disabled={busy}
                placeholder="Ex.: 11.º D"
                required
                className={fieldClass}
              />
            </label>

            <label>
              <FieldLabel optional>
                Curso
              </FieldLabel>

              <input
                type="text"
                value={
                  newGroup.courseName
                }
                onChange={(
                  event: ChangeEvent<HTMLInputElement>
                ) =>
                  updateNewGroup(
                    'courseName',
                    event.target.value
                  )
                }
                disabled={busy}
                placeholder="Ex.: Técnico de Apoio Psicossocial"
                className={fieldClass}
              />
            </label>

            <label>
              <FieldLabel optional>
                Ano
              </FieldLabel>

              <input
                type="text"
                value={
                  newGroup.gradeLevel
                }
                onChange={(
                  event: ChangeEvent<HTMLInputElement>
                ) =>
                  updateNewGroup(
                    'gradeLevel',
                    event.target.value
                  )
                }
                disabled={busy}
                placeholder="Ex.: 11.º"
                className={fieldClass}
              />
            </label>
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={busy}
              className="rounded-2xl border border-cyan-200/30 bg-gradient-to-r from-cyan-300 to-sky-300 px-6 py-3 text-sm font-black text-slate-950 transition hover:brightness-110 disabled:opacity-60"
            >
              {busyAction ===
              'create-group'
                ? 'A criar...'
                : 'Criar turma'}
            </button>
          </div>
        </form>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Turmas"
          value={
            snapshot.totals.groupCount
          }
          detail={`${snapshot.totals.activeGroupCount} ativas.`}
          className="border-cyan-300/15 bg-cyan-300/[0.035]"
        />

        <MetricCard
          label="Alunos ativos"
          value={
            snapshot.totals.activeStudentCount
          }
          detail="Incluídos nas aulas e avaliações."
          className="border-emerald-300/15 bg-emerald-300/[0.035]"
        />

        <MetricCard
          label="Alunos inativos"
          value={
            snapshot.totals.inactiveStudentCount
          }
          detail="Mantidos no histórico."
          className="border-slate-300/15 bg-slate-300/[0.035]"
        />

        <MetricCard
          label="Disciplinas"
          value={
            snapshot.totals.assignmentCount
          }
          detail="Associações ativas às turmas."
          className="border-violet-300/15 bg-violet-300/[0.035]"
        />

        <MetricCard
          label="UFCD"
          value={
            snapshot.totals.moduleCount
          }
          detail="UFCD ou módulos ativos."
          className="border-amber-300/15 bg-amber-300/[0.035]"
        />
      </section>

      {!snapshot.selectedGroup ? (
        <section className="rounded-[2rem] border border-dashed border-white/15 bg-slate-950/60 p-8 text-center">
          <p className="text-lg font-black text-white">
            Ainda não existem turmas.
          </p>

          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-500">
            Crie a primeira turma para depois adicionar os alunos.
          </p>
        </section>
      ) : (
        <>
          <form
            onSubmit={saveGroup}
            className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-black/20 sm:p-7"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-200">
                  Dados da turma
                </p>

                <h2 className="mt-3 text-xl font-black text-white">
                  {snapshot.selectedGroup.name}
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Alterar estes dados não elimina aulas, avaliações ou faltas já registadas.
                </p>
              </div>

              <span
                className={`rounded-full border px-3 py-1.5 text-xs font-black ${
                  groupForm.active
                    ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
                    : 'border-slate-300/15 bg-slate-300/[0.07] text-slate-300'
                }`}
              >
                {groupForm.active
                  ? 'Turma ativa'
                  : 'Turma inativa'}
              </span>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <label>
                <FieldLabel>
                  Nome da turma
                </FieldLabel>

                <input
                  type="text"
                  value={
                    groupForm.name
                  }
                  onChange={(
                    event: ChangeEvent<HTMLInputElement>
                  ) =>
                    updateGroupForm(
                      'name',
                      event.target.value
                    )
                  }
                  disabled={busy}
                  required
                  className={fieldClass}
                />
              </label>

              <label>
                <FieldLabel optional>
                  Curso
                </FieldLabel>

                <input
                  type="text"
                  value={
                    groupForm.courseName
                  }
                  onChange={(
                    event: ChangeEvent<HTMLInputElement>
                  ) =>
                    updateGroupForm(
                      'courseName',
                      event.target.value
                    )
                  }
                  disabled={busy}
                  className={fieldClass}
                />
              </label>

              <label>
                <FieldLabel optional>
                  Ano
                </FieldLabel>

                <input
                  type="text"
                  value={
                    groupForm.gradeLevel
                  }
                  onChange={(
                    event: ChangeEvent<HTMLInputElement>
                  ) =>
                    updateGroupForm(
                      'gradeLevel',
                      event.target.value
                    )
                  }
                  disabled={busy}
                  className={fieldClass}
                />
              </label>
            </div>

            <label className="mt-5 flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
              <input
                type="checkbox"
                checked={
                  groupForm.active
                }
                onChange={(
                  event: ChangeEvent<HTMLInputElement>
                ) =>
                  updateGroupForm(
                    'active',
                    event.target.checked
                  )
                }
                disabled={busy}
                className="mt-0.5 h-4 w-4 rounded border-white/20 bg-slate-900 text-cyan-300 focus:ring-cyan-300/30"
              />

              <span>
                <span className="block text-sm font-black text-white">
                  Turma ativa
                </span>

                <span className="mt-1 block text-xs leading-5 text-slate-500">
                  Desative apenas quando já não pretende utilizar a turma. O histórico será preservado.
                </span>
              </span>
            </label>

            <div className="mt-5 flex justify-end">
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl border border-violet-200/25 bg-violet-300/10 px-5 py-3 text-sm font-black text-violet-50 transition hover:bg-violet-300/15 disabled:opacity-60"
              >
                {busyAction ===
                'save-group'
                  ? 'A guardar...'
                  : 'Guardar turma'}
              </button>
            </div>
          </form>

          <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-black/20 sm:p-7">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">
              Disciplinas e UFCD
            </p>

            <h2 className="mt-3 text-xl font-black text-white">
              Organização letiva da turma
            </h2>

            {snapshot.teachingRows.length ===
            0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-5 text-sm leading-6 text-slate-500">
                Esta turma ainda não possui disciplinas associadas.
              </div>
            ) : (
              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                {snapshot.teachingRows.map(
                  row => (
                    <article
                      key={
                        row.assignment.id
                      }
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                    >
                      <p className="text-sm font-black text-white">
                        {row.label}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {row.modules.length}{' '}
                        {row.modules.length ===
                        1
                          ? 'UFCD ou módulo'
                          : 'UFCD ou módulos'}
                      </p>

                      {row.modules.length >
                      0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {row.modules.map(
                            module => (
                              <span
                                key={
                                  module.id
                                }
                                className="rounded-full border border-cyan-300/15 bg-cyan-300/[0.06] px-3 py-1.5 text-[0.68rem] font-bold text-cyan-100"
                              >
                                {module.code.trim()
                                  ? `${module.code.trim()} · ${module.name}`
                                  : module.name}
                              </span>
                            )
                          )}
                        </div>
                      ) : null}
                    </article>
                  )
                )}
              </div>
            )}
          </section>

          <form
            onSubmit={importStudents}
            className="rounded-[2rem] border border-emerald-300/15 bg-emerald-300/[0.035] p-5 sm:p-7"
          >
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">
              Adicionar alunos
            </p>

            <h2 className="mt-3 text-xl font-black text-white">
              Colar lista da turma
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              Use uma linha por aluno no formato número; nome; observação. Também pode colar colunas do Excel ou Google Sheets.
            </p>

            <label className="mt-5 block">
              <FieldLabel>
                Lista de alunos
              </FieldLabel>

              <textarea
                value={importText}
                onChange={(
                  event: ChangeEvent<HTMLTextAreaElement>
                ) =>
                  setImportText(
                    event.target.value
                  )
                }
                disabled={busy}
                rows={7}
                placeholder={'1; Ana Silva\n2; Bruno Costa\n3; Carla Sousa; apoio adicional'}
                className={`${fieldClass} resize-y`}
              />
            </label>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-slate-500">
                Um número já existente atualiza o aluno em vez de criar um duplicado.
              </p>

              <button
                type="submit"
                disabled={
                  busy ||
                  !importText.trim()
                }
                className="rounded-2xl border border-emerald-200/30 bg-gradient-to-r from-emerald-300 to-teal-300 px-6 py-3 text-sm font-black text-slate-950 transition hover:brightness-110 disabled:opacity-45"
              >
                {busyAction ===
                'import-students'
                  ? 'A guardar...'
                  : 'Guardar alunos'}
              </button>
            </div>
          </form>

          <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-black/20 sm:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-200">
                  Alunos
                </p>

                <h2 className="mt-3 text-xl font-black text-white">
                  Lista da turma
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Edite cada aluno diretamente e mantenha inativos no histórico quando necessário.
                </p>
              </div>

              <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-xs font-bold text-slate-300">
                <input
                  type="checkbox"
                  checked={
                    includeInactive
                  }
                  onChange={(
                    event: ChangeEvent<HTMLInputElement>
                  ) =>
                    setIncludeInactive(
                      event.target.checked
                    )
                  }
                  className="h-4 w-4 rounded border-white/20 bg-slate-900 text-cyan-300 focus:ring-cyan-300/30"
                />

                Mostrar inativos
              </label>
            </div>

            {visibleStudents.length ===
            0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center">
                <p className="text-sm font-black text-white">
                  A turma ainda não possui alunos ativos.
                </p>

                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Cole a lista acima para começar.
                </p>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {visibleStudents.map(
                  student => {
                    const form =
                      studentForms[
                        student.id
                      ] ?? {
                        number:
                          student.number,
                        name:
                          student.name,
                        notes:
                          student.notes
                      }

                    return (
                      <article
                        key={
                          student.id
                        }
                        className={`rounded-2xl border p-4 ${
                          student.active
                            ? 'border-white/10 bg-white/[0.03]'
                            : 'border-slate-300/10 bg-slate-300/[0.025] opacity-75'
                        }`}
                      >
                        <div className="grid gap-4 lg:grid-cols-[7rem_1fr_1fr_auto] lg:items-end">
                          <label>
                            <FieldLabel>
                              Número
                            </FieldLabel>

                            <input
                              type="text"
                              value={
                                form.number
                              }
                              onChange={(
                                event: ChangeEvent<HTMLInputElement>
                              ) =>
                                updateStudentForm(
                                  student.id,
                                  {
                                    number:
                                      event.target.value
                                  }
                                )
                              }
                              disabled={busy}
                              className={fieldClass}
                            />
                          </label>

                          <label>
                            <FieldLabel>
                              Nome
                            </FieldLabel>

                            <input
                              type="text"
                              value={
                                form.name
                              }
                              onChange={(
                                event: ChangeEvent<HTMLInputElement>
                              ) =>
                                updateStudentForm(
                                  student.id,
                                  {
                                    name:
                                      event.target.value
                                  }
                                )
                              }
                              disabled={busy}
                              className={fieldClass}
                            />
                          </label>

                          <label>
                            <FieldLabel optional>
                              Observação
                            </FieldLabel>

                            <input
                              type="text"
                              value={
                                form.notes
                              }
                              onChange={(
                                event: ChangeEvent<HTMLInputElement>
                              ) =>
                                updateStudentForm(
                                  student.id,
                                  {
                                    notes:
                                      event.target.value
                                  }
                                )
                              }
                              disabled={busy}
                              className={fieldClass}
                            />
                          </label>

                          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                            <button
                              type="button"
                              onClick={() =>
                                void saveStudent(
                                  student
                                )
                              }
                              disabled={busy}
                              className="rounded-xl border border-cyan-200/25 bg-cyan-300/10 px-4 py-2.5 text-xs font-black text-cyan-50 transition hover:bg-cyan-300/15 disabled:opacity-60"
                            >
                              {busyAction ===
                              `student-${student.id}`
                                ? 'A guardar...'
                                : 'Guardar'}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                void toggleStudent(
                                  student
                                )
                              }
                              disabled={busy}
                              className={`rounded-xl border px-4 py-2.5 text-xs font-black transition disabled:opacity-60 ${
                                student.active
                                  ? 'border-rose-300/20 bg-rose-300/[0.07] text-rose-100 hover:bg-rose-300/10'
                                  : 'border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-100 hover:bg-emerald-300/10'
                              }`}
                            >
                              {busyAction ===
                              `toggle-${student.id}`
                                ? 'A atualizar...'
                                : student.active
                                  ? 'Desativar'
                                  : 'Reativar'}
                            </button>
                          </div>
                        </div>
                      </article>
                    )
                  }
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
