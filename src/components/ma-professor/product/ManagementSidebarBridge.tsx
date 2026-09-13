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

interface ManagementSidebarBridgeProps {
  onOpenAttendance: () => void
  onOpenSchedule: () => void
  onOpenSettings: () => void
}

interface SidebarTarget {
  nav: HTMLElement
  hiddenButtons: HTMLButtonElement[]
}

const NAVIGATION_SELECTOR =
  'nav[aria-label="Navegação do MA-Professor"]'

const externalItems = [
  {
    id: 'attendance',
    number: '07',
    label: 'Faltas e recuperações'
  },
  {
    id: 'schedule',
    number: '08',
    label: 'Horários'
  },
  {
    id: 'settings',
    number: '09',
    label: 'Definições'
  }
] as const

const externalLabels =
  new Set<string>(
    externalItems.map(
      item => item.label
    )
  )

const RESET_SCHEDULE_CONFIRMATION =
  '⚠️ Atenção: ao apagar o horário, irá perder também as planificações, os critérios de avaliação e os alunos já configurados. Deseja mesmo apagar tudo e começar de novo?'

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

export function ManagementSidebarBridge({
  onOpenAttendance,
  onOpenSchedule,
  onOpenSettings
}: ManagementSidebarBridgeProps) {
  const [target, setTarget] =
    useState<SidebarTarget | null>(null)

  const [scheduleActionTarget, setScheduleActionTarget] =
    useState<HTMLElement | null>(null)

  const [editingAcademicYearId, setEditingAcademicYearId] =
    useState<string | null>(null)

  const [scheduleActionBusy, setScheduleActionBusy] =
    useState(false)

  const [scheduleActionError, setScheduleActionError] =
    useState('')

  useEffect(() => {
    let observer: MutationObserver | null = null
    let currentTarget: SidebarTarget | null = null

    const connect = () => {
      const nav =
        document.querySelector<HTMLElement>(
          NAVIGATION_SELECTOR
        )

      if (!nav) {
        return false
      }

      const hiddenButtons =
        Array.from(
          nav.querySelectorAll<HTMLButtonElement>(
            'button[title="Em breve"]'
          )
        ).filter(button =>
          externalLabels.has(
            button.textContent
              ?.replace(/\d+/g, '')
              .trim() ?? ''
          )
        )

      for (const button of hiddenButtons) {
        button.hidden = true
        button.style.setProperty(
          'display',
          'none',
          'important'
        )
      }

      currentTarget = {
        nav,
        hiddenButtons
      }
      setTarget(currentTarget)

      return true
    }

    if (!connect()) {
      observer = new MutationObserver(() => {
        if (connect()) {
          observer?.disconnect()
          observer = null
        }
      })

      observer.observe(
        document.body,
        {
          childList: true,
          subtree: true
        }
      )
    }

    return () => {
      observer?.disconnect()

      for (
        const button of
        currentTarget?.hiddenButtons ?? []
      ) {
        button.hidden = false
        button.style.removeProperty(
          'display'
        )
      }
    }
  }, [])

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

  async function handleResetSavedSchedule() {
    if (
      scheduleActionBusy ||
      !window.confirm(
        RESET_SCHEDULE_CONFIRMATION
      )
    ) {
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
      setScheduleActionBusy(false)
    }
  }

  const handlers = {
    attendance: onOpenAttendance,
    schedule: onOpenSchedule,
    settings: onOpenSettings
  }

  return (
    <>
      {target
        ? createPortal(
            <>
              {externalItems.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={handlers[item.id]}
                  data-management-external-nav={item.id}
                  className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-3 text-left text-sm font-semibold text-slate-400 transition hover:border-white/10 hover:bg-white/[0.04] hover:text-white"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.035] text-[0.65rem] font-black">
                    {item.number}
                  </span>

                  <span>
                    {item.label}
                  </span>
                </button>
              ))}
            </>,
            target.nav
          )
        : null}

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
                  onClick={() =>
                    void handleResetSavedSchedule()
                  }
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
