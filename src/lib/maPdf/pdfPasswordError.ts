export const PDF_PASSWORD_ERROR_MESSAGE =
  'Este PDF está protegido por palavra-passe. Remova a proteção antes de utilizar a ferramenta.'

export const PDF_PASSWORD_REQUIRED_MESSAGE =
  'Este PDF está protegido por palavra-passe. Introduza a palavra-passe para continuar:'

export const PDF_PASSWORD_INCORRECT_MESSAGE =
  'A palavra-passe está incorreta. Tente novamente ou cancele:'

export const PDF_PASSWORD_CANCELLED_MESSAGE =
  'A abertura do PDF protegido foi cancelada.'

type PdfPasswordLoadingTask = {
  onPassword?: unknown
  destroy: () => Promise<void> | void
}

type PdfPasswordPrompt = (
  message: string
) => string | null

function isPdfPasswordError(
  error: unknown
) {
  if (
    !error ||
    typeof error !== 'object'
  ) {
    return false
  }

  return (
    'name' in error &&
    (error as { name?: unknown }).name ===
      'PasswordException'
  )
}

function browserPasswordPrompt(
  message: string
): string | null {
  if (
    typeof window === 'undefined' ||
    typeof window.prompt !== 'function'
  ) {
    return null
  }

  return window.prompt(message)
}

export function normalizePdfPasswordError(
  error: unknown
): unknown {
  return isPdfPasswordError(error)
    ? new Error(
        PDF_PASSWORD_ERROR_MESSAGE
      )
    : error
}

export function configurePdfPasswordPrompt(
  loadingTask: PdfPasswordLoadingTask,
  requestPassword: PdfPasswordPrompt =
    browserPasswordPrompt
) {
  let promptCount = 0
  let cancelled = false

  loadingTask.onPassword = (
    updatePassword: (password: string) => void
  ) => {
    const password = requestPassword(
      promptCount === 0
        ? PDF_PASSWORD_REQUIRED_MESSAGE
        : PDF_PASSWORD_INCORRECT_MESSAGE
    )

    promptCount += 1

    if (password === null) {
      cancelled = true

      try {
        void Promise.resolve(
          loadingTask.destroy()
        ).catch(() => undefined)
      } catch {
        // O cancelamento deve continuar a ser reportado mesmo que
        // a limpeza do worker falhe de forma síncrona.
      }

      return
    }

    // A palavra-passe é entregue diretamente ao PDF.js. Não é guardada,
    // registada nem devolvida por este controlador.
    updatePassword(password)
  }

  return {
    normalizeError(error: unknown) {
      return cancelled
        ? new Error(
            PDF_PASSWORD_CANCELLED_MESSAGE
          )
        : normalizePdfPasswordError(
            error
          )
    }
  }
}
