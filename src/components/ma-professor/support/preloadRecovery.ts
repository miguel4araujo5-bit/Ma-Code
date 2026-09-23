const PRELOAD_RELOAD_KEY =
  'ma-professor-preload-reload-v1'

const PRELOAD_RELOAD_WINDOW_MS =
  60 * 1000

let installed = false

function isMAProfessorProductPath() {
  const path =
    window.location.pathname
      .replace(/\/+$/, '') ||
    '/'

  return path ===
    '/produtos/ma-professor'
}

function canReloadAfterPreloadError(
  now: number
) {
  try {
    const previous =
      Number(
        window.sessionStorage.getItem(
          PRELOAD_RELOAD_KEY
        ) || 0
      )

    if (
      Number.isFinite(previous) &&
      previous > 0 &&
      now - previous <
        PRELOAD_RELOAD_WINDOW_MS
    ) {
      return false
    }

    const value =
      String(now)

    window.sessionStorage.setItem(
      PRELOAD_RELOAD_KEY,
      value
    )

    return window.sessionStorage.getItem(
      PRELOAD_RELOAD_KEY
    ) === value
  } catch {
    /*
     * Sem sessionStorage não arriscamos um ciclo de reload.
     * O erro segue o fluxo normal e cai no ErrorBoundary.
     */
    return false
  }
}

export function installMAProfessorPreloadRecovery() {
  if (
    installed ||
    typeof window ===
      'undefined' ||
    !isMAProfessorProductPath()
  ) {
    return
  }

  installed = true

  window.addEventListener(
    'vite:preloadError',
    event => {
      if (
        !canReloadAfterPreloadError(
          Date.now()
        )
      ) {
        return
      }

      /*
       * Vite lançaria o erro depois deste evento. Na primeira falha,
       * anulamos apenas esse lançamento e recarregamos uma única vez
       * para obter o HTML e os chunks do deploy atual.
       */
      event.preventDefault()
      window.location.reload()
    }
  )
}
