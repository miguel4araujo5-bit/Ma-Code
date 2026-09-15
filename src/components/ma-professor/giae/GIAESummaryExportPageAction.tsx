import {
  useEffect,
  useState
} from 'react'
import {
  createPortal
} from 'react-dom'

import GIAESummaryExportDialog from './GIAESummaryExportDialog'

function findGIAEActionsHost() {
  const eyebrow =
    Array.from(
      document.querySelectorAll('p')
    ).find(
      element =>
        element.textContent?.trim() ===
        'Sumários / GIAE'
    )

  const headerSection =
    eyebrow?.closest('section')

  const headerRow =
    headerSection?.firstElementChild

  const actionsHost =
    headerRow?.children.item(1)

  return actionsHost instanceof HTMLElement
    ? actionsHost
    : null
}

export default function GIAESummaryExportPageAction() {
  const [
    actionsHost,
    setActionsHost
  ] = useState<HTMLElement | null>(
    null
  )
  const [
    exportOpen,
    setExportOpen
  ] = useState(false)

  useEffect(() => {
    let frame = 0

    const refreshHost = () => {
      frame = 0
      setActionsHost(
        findGIAEActionsHost()
      )
    }

    const scheduleRefresh = () => {
      if (frame) {
        return
      }

      frame = window.requestAnimationFrame(
        refreshHost
      )
    }

    refreshHost()

    const observer =
      new MutationObserver(
        scheduleRefresh
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

      if (frame) {
        window.cancelAnimationFrame(
          frame
        )
      }
    }
  }, [])

  useEffect(() => {
    if (!actionsHost) {
      setExportOpen(false)
    }
  }, [actionsHost])

  return (
    <>
      {actionsHost
        ? createPortal(
            <button
              type="button"
              onClick={() =>
                setExportOpen(true)
              }
              className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.08] px-4 py-3 text-sm font-bold text-cyan-50 transition hover:bg-cyan-300/13"
            >
              Exportar sumários
            </button>,
            actionsHost
          )
        : null}

      <GIAESummaryExportDialog
        open={exportOpen}
        onClose={() =>
          setExportOpen(false)
        }
      />
    </>
  )
}
