export interface MAProfessorActivationLink {
  email: string
  activationPassword: string
}

const ACTIVATION_ACTION =
  'ativar'

const ACTIVATION_KEYS = [
  'acesso',
  'email',
  'senha',
  'activationPassword',
  'password'
] as const

function readHashParams(
  url: URL
) {
  const hash =
    url.hash
      .replace(/^#/, '')
      .replace(/^\?/, '')

  return new URLSearchParams(
    hash
  )
}

function firstValue(
  ...values:
    Array<string | null>
) {
  return values.find(
    value =>
      typeof value === 'string' &&
      value.trim()
  ) || ''
}

export function readMAProfessorActivationLink(
  href: string
): MAProfessorActivationLink | null {
  let url: URL

  try {
    url = new URL(
      href
    )
  } catch {
    return null
  }

  const hashParams =
    readHashParams(
      url
    )

  const action =
    firstValue(
      url.searchParams.get(
        'acesso'
      ),
      hashParams.get(
        'acesso'
      )
    )
      .trim()
      .toLowerCase()

  if (
    action !==
      ACTIVATION_ACTION
  ) {
    return null
  }

  const email =
    firstValue(
      url.searchParams.get(
        'email'
      ),
      hashParams.get(
        'email'
      )
    )
      .trim()
      .toLowerCase()

  const activationPassword =
    firstValue(
      hashParams.get(
        'senha'
      ),
      hashParams.get(
        'activationPassword'
      ),
      hashParams.get(
        'password'
      ),
      url.searchParams.get(
        'senha'
      ),
      url.searchParams.get(
        'activationPassword'
      ),
      url.searchParams.get(
        'password'
      )
    )
      .trim()
      .toUpperCase()

  if (
    !email ||
    !activationPassword
  ) {
    return null
  }

  return {
    email,
    activationPassword
  }
}

export function getMAProfessorUrlWithoutActivationData(
  href: string
) {
  let url: URL

  try {
    url = new URL(
      href
    )
  } catch {
    return href
  }

  for (
    const key of
    ACTIVATION_KEYS
  ) {
    url.searchParams.delete(
      key
    )
  }

  const hashParams =
    readHashParams(
      url
    )

  for (
    const key of
    ACTIVATION_KEYS
  ) {
    hashParams.delete(
      key
    )
  }

  const remainingHash =
    hashParams.toString()

  return [
    url.pathname,
    url.search,
    remainingHash
      ? `#${remainingHash}`
      : ''
  ].join('')
}
