export const PDF_PASSWORD_ERROR_MESSAGE =
  'Este PDF está protegido por palavra-passe. Remova a proteção antes de utilizar a ferramenta.'

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

export function normalizePdfPasswordError(
  error: unknown
): unknown {
  return isPdfPasswordError(error)
    ? new Error(
        PDF_PASSWORD_ERROR_MESSAGE
      )
    : error
}
