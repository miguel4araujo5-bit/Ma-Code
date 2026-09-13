import {
  useEffect,
  useState
} from 'react'
import {
  createPortal
} from 'react-dom'

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
  new Set(
    externalItems.map(
      item => item.label
    )
  )

export function ManagementSidebarBridge({
  onOpenAttendance,
  onOpenSchedule,
  onOpenSettings
}: ManagementSidebarBridgeProps) {
  const [target, setTarget] =
    useState<SidebarTarget | null>(null)

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
      }
    }
  }, [])

  if (!target) {
    return null
  }

  const handlers = {
    attendance: onOpenAttendance,
    schedule: onOpenSchedule,
    settings: onOpenSettings
  }

  return createPortal(
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
}
