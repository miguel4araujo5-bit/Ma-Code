import {
  useEffect,
  useState
} from 'react'
import {
  createPortal
} from 'react-dom'

import {
  maProfessorRepository
} from '../repository'
import {
  resetScheduleImportForSetup
} from '../setup/scheduleImportResetRepository'
import {
  ScheduleProductWorkspace
} from './ScheduleProductWorkspace'

const RESET_SCHEDULE_WARNING =
  'Esta operação apaga o horário importado e reinicia a configuração do ano letivo. Serão apagadas as planificações, os critérios de avaliação, os alunos e todo o trabalho já associado a este ano, incluindo aulas, presenças, avaliações, classificações e recuperações.'

function getErrorMessage(
  error: unknown
) {
  return error instanceof Error
    ? error.message
    : 'Não foi possível alterar o horário.'
}

async function getActiveAcademicYearId() {
  const academicYear =
    await maProfessorRepository.getActiveAcademicYear()

  if (!academicYear) {
    throw new Error(
      'Não foi encontrado um ano letivo ativo.'
    )
  }

  return academicYear.id
}

export function SavedScheduleActions() {
  const [scheduleActionTarget, setScheduleActionTarget] =
    useState<HTMLElement | null>(null)

  const [editingAcademicYearId, setEditingAcademicYearId] =
    useState<string | null>(null)

  const [confirmingScheduleReset, setConfirmingScheduleReset] =
    useState(false)

  const [scheduleActionBusy, setScheduleActionBusy] =
    useState(false)

  const [scheduleActionError, setScheduleActionError] =
    useState('')

  useEffect(() => {
    const findSavedScheduleActionsTarget = () => {
      const savedScheduleButton =
        Array.from(
          document.querySelectorAll<HTMLButtonElement>(
            'button'
          )
        ).find(button =>
          button.textContent
            ?.trim() ===
          'Usar horário guardado'
        )

      const nextTarget =
        savedScheduleButton
          ?.parentElement ??
        null

      setScheduleActionTarget(
        current =>
          current === nextTarget
            ? current
            : nextTarget
      )
    }

    findSavedScheduleActionsTarget()

    const observer =
      new MutationObserver(
        findSavedScheduleActionsTarget
      )

    observer.observe(
      document.body,
      {
        childList: true,
        subtree: true
      }
    )

    return () => {
      observer.disconnect()
    }
  }, [])

  async function handleEditSavedSchedule() {
    if (scheduleActionBusy) {
      return
    }

    setScheduleActionBusy(true)
    setScheduleActionError('')

    try {
      setEditingAcademicYearId(
        await getActiveAcademicYearId()
      )
    } catch (error) {
      setScheduleActionError(
        getErrorMessage(error)
      )
    } finally {
      setScheduleActionBusy(false)
    }
  }

  function handleRequestScheduleReset() {
    if (scheduleActionBusy) {
      return
    }

    setScheduleActionError('')
    setConfirmingScheduleReset(true)
  }

  async function handleConfirmScheduleReset() {
    if (scheduleActionBusy) {
      return
    }

    setScheduleActionBusy(true)
    setScheduleActionError('')

    try {
      const academicYearId =
        await getActiveAcademicYearId()

      await resetScheduleImportForSetup(
        academicYearId
      )

      window.location.reload()
    } catch (error) {
      setScheduleActionError(
        getErrorMessage(error)
      )
      setConfirmingScheduleReset(false)
      setScheduleActionBusy(false)
    }
  }

  return (
    <>
      {scheduleActionTarget
        ? createPortal(
            <div className="flex w-full flex-col gap-2 sm:w-auto">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={scheduleActionBusy}
                  onClick={() =>
                    void handleEditSavedSchedule()
                  }
                  className="rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-2.5 text-sm font-black text-cyan-50 transition hover:bg-cyan-300/15 disabled:cursor-wait disabled:opacity-50"
                >
                  Editar horário guardado
                </button>

                <button
                  type="button"
                  disabled={scheduleActionBusy}
                  onClick={handleRequestScheduleReset}
                  className="rounded-xl border border-rose-300/25 bg-rose-300/[0.07] px-4 py-2.5 text-sm font-black text-rose-100 transition hover:bg-rose-300/10 disabled:cursor-wait disabled:opacity-50"
                >
                  Apagar horário importado e importar outro
                </button>
              </div>

              {scheduleActionError ? (
                <p
                  role="alert"
                  className="max-w-2xl text-xs font-semibold leading-5 text-rose-200"
                >
                  {scheduleActionError}
                </p>
              ) : null}
            </div>,
            scheduleActionTarget
          )
        : null}

      {confirmingScheduleReset
        ? createPortal(
            <div
              className="fixed inset-0 z-[180] flex items-center justify-center bg-slate-950/85 px-4 py-8 backdrop-blur-sm"
              role="presentation"
            >
              <div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="reset-schedule-title"
                aria-describedby="reset-schedule-description"
                className="w-full max-w-xl rounded-2xl border border-rose-300/25 bg-slate-950 p-6 shadow-2xl shadow-black/50"
              >
                <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-300">
                  Atenção
                </p>

                <h2
                  id="reset-schedule-title"
                  className="mt-2 text-xl font-black text-white"
                >
                  Apagar o horário e começar de novo?
                </h2>

                <p
                  id="reset-schedule-description"
                  className="mt-3 text-sm font-semibold leading-6 text-slate-300"
                >
                  {RESET_SCHEDULE_WARNING}
                </p>

                <p className="mt-3 text-sm font-black leading-6 text-rose-200">
                  Esta ação não pode ser anulada. Se pretende apenas corrigir o horário, use “Editar horário guardado”.
                </p>

                <div className="mt-6 flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    disabled={scheduleActionBusy}
                    onClick={() =>
                      setConfirmingScheduleReset(false)
                    }
                    className="rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm font-black text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-wait disabled:opacity-50"
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    disabled={scheduleActionBusy}
                    onClick={() =>
                      void handleConfirmScheduleReset()
                    }
                    className="rounded-xl border border-rose-300/40 bg-rose-500/20 px-5 py-2.5 text-sm font-black text-rose-50 transition hover:bg-rose-500/30 disabled:cursor-wait disabled:opacity-50"
                  >
                    {scheduleActionBusy
                      ? 'A apagar…'
                      : 'APAGAR'}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {editingAcademicYearId
        ? createPortal(
            <div className="fixed inset-0 z-[150] overflow-y-auto bg-slate-950 text-white">
              <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/95 px-4 py-3 backdrop-blur-xl sm:px-6">
                <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-cyan-300">
                      Corrigir horário importado
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-300">
                      Edite, adicione ou remova os blocos necessários. As alterações são guardadas diretamente no horário atual.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      window.location.reload()
                    }
                    className="rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:brightness-110"
                  >
                    Concluir edição e voltar
                  </button>
                </div>
              </header>

              <ScheduleProductWorkspace
                academicYearId={editingAcademicYearId}
              />
            </div>,
            document.body
          )
        : null}
    </>
  )
}
