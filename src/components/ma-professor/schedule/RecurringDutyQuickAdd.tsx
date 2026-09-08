import {
  type FormEvent,
  useRef,
  useState
} from 'react'

import {
  useMAProfessorUnsavedWorkspaceProtection
} from '../navigation/useUnsavedWorkspaceProtection'
import {
  maProfessorRepository
} from '../repository'
import type {
  AcademicYear,
  Weekday
} from '../types'
import {
  createRecurringDutySchedule
} from './recurringDutySchedule'

type Props = {
  academicYear: AcademicYear
  disabled?: boolean
  onCreated?: () => Promise<void> | void
}

type DutyFormState = {
  name: string
  weekday: Weekday
  startTime: string
  endTime: string
}

const fieldClass =
  'w-full rounded-xl border border-white/10 bg-slate-950/75 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-violet-300/50 focus:ring-4 focus:ring-violet-300/10 disabled:cursor-wait disabled:opacity-60'

const weekdays: Array<{
  value: Weekday
  label: string
}> = [
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
  { value: 7, label: 'Domingo' }
]

function createInitialForm(): DutyFormState {
  return {
    name: '',
    weekday: 1,
    startTime: '09:00',
    endTime: '09:50'
  }
}

function formsEqual(
  left: DutyFormState,
  right: DutyFormState
) {
  return (
    left.name === right.name &&
    left.weekday === right.weekday &&
    left.startTime === right.startTime &&
    left.endTime === right.endTime
  )
}

function getErrorMessage(
  error: unknown
) {
  return error instanceof Error
    ? error.message
    : 'Não foi possível programar o cargo.'
}

export default function RecurringDutyQuickAdd({
  academicYear,
  disabled = false,
  onCreated
}: Props) {
  const rootRef =
    useRef<HTMLDivElement>(null)
  const baselineRef =
    useRef<DutyFormState>(
      createInitialForm()
    )

  const [open, setOpen] =
    useState(false)
  const [form, setForm] =
    useState<DutyFormState>(
      baselineRef.current
    )
  const [busy, setBusy] =
    useState(false)
  const [error, setError] =
    useState('')
  const [success, setSuccess] =
    useState('')

  const hasUnsavedChanges =
    open &&
    !formsEqual(
      form,
      baselineRef.current
    )

  useMAProfessorUnsavedWorkspaceProtection(
    hasUnsavedChanges || busy,
    rootRef,
    busy
      ? 'Está a ser programado um cargo no calendário. Se continuar agora, a operação pode ficar incompleta. Pretende continuar?'
      : 'Existe um cargo por guardar. Se sair deste ecrã, essas alterações serão perdidas. Pretende continuar?'
  )

  function resetForm() {
    const next =
      createInitialForm()

    baselineRef.current = next
    setForm(next)
  }

  function requestToggle() {
    if (
      disabled ||
      busy
    ) {
      return
    }

    if (
      open &&
      hasUnsavedChanges &&
      !window.confirm(
        'Existe um cargo por guardar. Se fechar agora, essas alterações serão perdidas. Pretende continuar?'
      )
    ) {
      return
    }

    if (open) {
      resetForm()
      setOpen(false)
      setError('')
      return
    }

    resetForm()
    setOpen(true)
    setError('')
    setSuccess('')
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (
      busy ||
      disabled
    ) {
      return
    }

    setBusy(true)
    setError('')
    setSuccess('')

    try {
      const profile =
        await maProfessorRepository.getTeacherProfile()

      const result =
        await createRecurringDutySchedule(
          academicYear,
          {
            ...form,
            schoolName:
              profile?.schoolName?.trim() ??
              ''
          }
        )

      if (onCreated) {
        await onCreated()
      }

      resetForm()
      setOpen(false)
      setSuccess(
        result.createdCount === 0
          ? 'Este cargo já estava programado nas datas aplicáveis.'
          : `${result.createdCount} ocorrência${result.createdCount === 1 ? '' : 's'} do cargo programada${result.createdCount === 1 ? '' : 's'} no calendário.`
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

  return (
    <div
      ref={rootRef}
      className="mb-6 rounded-[2rem] border border-violet-300/15 bg-slate-950/70 p-5 shadow-xl shadow-black/15 sm:p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-200">
            Ajustes após importação
          </p>

          <h2 className="mt-2 text-xl font-black text-white">
            Cargos / componente não letiva
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Acrescente um cargo semanal em qualquer altura. Para acrescentar uma aula ou alterar uma hora letiva, utilize «+ Bloco de horário» no painel abaixo.
          </p>
        </div>

        <button
          type="button"
          onClick={requestToggle}
          disabled={disabled || busy}
          className="shrink-0 rounded-2xl border border-violet-200/25 bg-violet-300/10 px-5 py-3 text-sm font-black text-violet-50 transition hover:bg-violet-300/15 disabled:opacity-50"
        >
          {open
            ? 'Fechar cargo'
            : '+ Cargo / componente não letiva'}
        </button>
      </div>

      {open ? (
        <form
          onSubmit={handleSubmit}
          className="mt-5 rounded-2xl border border-violet-300/15 bg-violet-300/[0.035] p-4 sm:p-5"
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="md:col-span-2 xl:col-span-1">
              <span className="mb-2 block text-xs font-bold text-slate-300">
                Cargo / atividade
              </span>

              <input
                value={form.name}
                onChange={event =>
                  setForm(
                    current => ({
                      ...current,
                      name:
                        event.target.value
                    })
                  )
                }
                disabled={busy}
                placeholder="Ex.: Co PCE"
                autoFocus
                className={fieldClass}
              />
            </label>

            <label>
              <span className="mb-2 block text-xs font-bold text-slate-300">
                Dia da semana
              </span>

              <select
                value={form.weekday}
                onChange={event =>
                  setForm(
                    current => ({
                      ...current,
                      weekday:
                        Number(
                          event.target.value
                        ) as Weekday
                    })
                  )
                }
                disabled={busy}
                className={fieldClass}
              >
                {weekdays.map(day => (
                  <option
                    key={day.value}
                    value={day.value}
                  >
                    {day.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-2 block text-xs font-bold text-slate-300">
                Início
              </span>

              <input
                type="time"
                value={form.startTime}
                onChange={event =>
                  setForm(
                    current => ({
                      ...current,
                      startTime:
                        event.target.value
                    })
                  )
                }
                disabled={busy}
                className={fieldClass}
              />
            </label>

            <label>
              <span className="mb-2 block text-xs font-bold text-slate-300">
                Fim
              </span>

              <input
                type="time"
                value={form.endTime}
                onChange={event =>
                  setForm(
                    current => ({
                      ...current,
                      endTime:
                        event.target.value
                    })
                  )
                }
                disabled={busy}
                className={fieldClass}
              />
            </label>
          </div>

          <p className="mt-4 text-xs leading-5 text-slate-500">
            O MA-Professor programa automaticamente as ocorrências deste cargo nas datas aplicáveis do calendário escolar. Não altera aulas, turmas, UFCD ou avaliações.
          </p>

          {error ? (
            <p
              role="alert"
              className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/[0.07] p-3 text-sm leading-6 text-rose-100"
            >
              {error}
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={requestToggle}
              disabled={busy}
              className="rounded-xl border border-white/10 bg-white/[0.035] px-4 py-2.5 text-sm font-bold text-slate-300 disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={busy}
              className="rounded-xl border border-violet-200/30 bg-gradient-to-r from-violet-300 to-fuchsia-300 px-5 py-2.5 text-sm font-black text-slate-950 transition hover:brightness-110 disabled:opacity-60"
            >
              {busy
                ? 'A programar…'
                : 'Adicionar cargo ao horário'}
            </button>
          </div>
        </form>
      ) : null}

      {success ? (
        <p
          role="status"
          className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.07] p-3 text-sm leading-6 text-emerald-100"
        >
          {success}
        </p>
      ) : null}
    </div>
  )
}
