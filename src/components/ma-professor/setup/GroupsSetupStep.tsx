import {
  type FormEvent,
  useState
} from 'react'

import {
  maProfessorRepository,
  type SetupSnapshot
} from '../repository'

import type {
  ClassGroup,
  EntityId
} from '../types'

type GroupsSetupStepProps = {
  snapshot: SetupSnapshot
  onSnapshotChange: (
    snapshot: SetupSnapshot
  ) => void
  onCompleted: (
    snapshot: SetupSnapshot
  ) => void
}

type GroupFormState = {
  name: string
  courseName: string
  gradeLevel: string
}

const emptyForm: GroupFormState = {
  name: '',
  courseName: '',
  gradeLevel: ''
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
  children
}: {
  children: string
}) {
  return (
    <span className="mb-2 block text-sm font-bold text-slate-200">
      {children}
    </span>
  )
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.025] p-5 text-center">
      <p className="font-bold text-slate-200">
        Ainda não existem turmas.
      </p>

      <p className="mt-2 text-sm leading-6 text-slate-500">
        Adicione pelo menos uma turma para continuar a configuração.
      </p>
    </div>
  )
}

export default function GroupsSetupStep({
  snapshot,
  onSnapshotChange,
  onCompleted
}: GroupsSetupStepProps) {
  const [
    form,
    setForm
  ] =
    useState<GroupFormState>(
      emptyForm
    )

  const [
    editingGroupId,
    setEditingGroupId
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

    setEditingGroupId(
      null
    )
  }

  function startEditing(
    group: ClassGroup
  ) {
    setEditingGroupId(
      group.id
    )

    setForm({
      name:
        group.name,
      courseName:
        group.courseName,
      gradeLevel:
        group.gradeLevel
    })

    setError('')
    setSuccess('')
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
      if (
        editingGroupId
      ) {
        await maProfessorRepository.updateGroup(
          editingGroupId,
          {
            name:
              form.name,
            courseName:
              form.courseName,
            gradeLevel:
              form.gradeLevel
          }
        )

        setSuccess(
          'Turma atualizada com sucesso.'
        )
      } else {
        await maProfessorRepository.createGroup(
          {
            academicYearId:
              snapshot.academicYear.id,
            name:
              form.name,
            courseName:
              form.courseName,
            gradeLevel:
              form.gradeLevel,
            active: true
          }
        )

        setSuccess(
          'Turma adicionada com sucesso.'
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
      snapshot.groups.length ===
      0
    ) {
      setError(
        'Adicione pelo menos uma turma antes de continuar.'
      )

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
    <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
      <form
        onSubmit={
          handleSubmit
        }
        className="rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-black/20 sm:p-6"
      >
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
          Passo 2 de 9
        </p>

        <h2 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
          Turmas
        </h2>

        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
          Crie cada turma uma única vez. As disciplinas, UFCD, alunos,
          horários, avaliações e faltas ficarão associados a esta
          estrutura.
        </p>

        <div className="mt-7 space-y-5">
          <label className="block">
            <FieldLabel>
              Nome da turma
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
              placeholder="11.º D"
              autoComplete="off"
              required
              className={
                inputClassName
              }
            />
          </label>

          <label className="block">
            <FieldLabel>
              Curso ou área
            </FieldLabel>

            <input
              type="text"
              value={
                form.courseName
              }
              onChange={(
                event
              ) =>
                setForm(
                  (
                    current
                  ) => ({
                    ...current,
                    courseName:
                      event
                        .target
                        .value
                  })
                )
              }
              placeholder="Técnico de Apoio Psicossocial"
              autoComplete="off"
              className={
                inputClassName
              }
            />
          </label>

          <label className="block">
            <FieldLabel>
              Ano de escolaridade
            </FieldLabel>

            <input
              type="text"
              value={
                form.gradeLevel
              }
              onChange={(
                event
              ) =>
                setForm(
                  (
                    current
                  ) => ({
                    ...current,
                    gradeLevel:
                      event
                        .target
                        .value
                  })
                )
              }
              placeholder="11.º ano"
              autoComplete="off"
              className={
                inputClassName
              }
            />
          </label>
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
              : editingGroupId
                ? 'Guardar alterações'
                : 'Adicionar turma'}
          </button>

          {editingGroupId ? (
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
              Turmas adicionadas
            </h3>
          </div>

          <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-black text-cyan-100">
            {snapshot.groups.length}
          </span>
        </div>

        <div className="mt-5 space-y-3">
          {snapshot.groups.length ===
          0 ? (
            <EmptyState />
          ) : (
            snapshot.groups.map(
              (
                group
              ) => (
                <article
                  key={
                    group.id
                  }
                  className={`rounded-2xl border p-4 transition ${
                    editingGroupId ===
                    group.id
                      ? 'border-cyan-300/35 bg-cyan-300/[0.08]'
                      : 'border-white/10 bg-white/[0.035]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-black text-white">
                        {group.name}
                      </p>

                      <p className="mt-1 text-sm leading-6 text-slate-400">
                        {group.courseName ||
                          'Curso não indicado'}

                        {group.gradeLevel
                          ? ` · ${group.gradeLevel}`
                          : ''}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={
                        busy
                      }
                      onClick={() =>
                        startEditing(
                          group
                        )
                      }
                      className="shrink-0 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-300 transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.07] hover:text-cyan-100 disabled:opacity-50"
                    >
                      Editar
                    </button>
                  </div>
                </article>
              )
            )
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-violet-300/15 bg-violet-300/[0.055] p-4">
          <p className="text-sm font-bold text-violet-100">
            Pode adicionar todas as turmas antes de continuar.
          </p>

          <p className="mt-2 text-xs leading-6 text-violet-100/65">
            Posteriormente continuará a poder criar ou editar turmas nas
            definições do MA-Professor.
          </p>
        </div>

        <button
          type="button"
          disabled={
            busy ||
            snapshot.groups.length ===
              0
          }
          onClick={() =>
            void handleContinue()
          }
          className="mt-6 inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.055] px-5 py-3.5 text-sm font-black text-white transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.09] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Guardar turmas e continuar
        </button>
      </section>
    </div>
  )
}
