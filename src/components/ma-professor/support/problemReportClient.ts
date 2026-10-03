import { readMAProfessorStoredAccess } from '../access/accessStorage'

const PROBLEM_REPORT_ENDPOINT =
  '/api/ma-professor/problem-report'

const MAX_MESSAGE_LENGTH = 800

export interface ProblemReportDraft {
  error: string
  version: string
  screen: string
  browser: string
  occurredAt: string
  device?: string
}

export interface ProblemReportPayload
  extends ProblemReportDraft {
  message?: string
  session?: { token: string; deviceId: string }
}

function normalizeText(
  value: string,
  maxLength: number
) {
  return value
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function readBundleVersion() {
  if (typeof document === 'undefined') {
    return 'desconhecida'
  }

  try {
    const moduleScripts =
      Array.from(
        document.querySelectorAll<HTMLScriptElement>(
          'script[type="module"][src]'
        )
      )

    for (const script of moduleScripts) {
      const pathname =
        new URL(
          script.src,
          window.location.href
        ).pathname

      const filename =
        pathname.split('/').pop() || ''

      if (filename) {
        return normalizeText(
          filename,
          120
        )
      }
    }
  } catch {
    // O diagnóstico continua disponível mesmo que o browser bloqueie a leitura.
  }

  return 'desconhecida'
}

function readBrowserName() {
  if (typeof navigator === 'undefined') {
    return 'Browser desconhecido'
  }

  const userAgent =
    navigator.userAgent || ''

  if (/EdgiOS|Edg\//.test(userAgent)) {
    return 'Microsoft Edge'
  }

  if (/FxiOS|Firefox\//.test(userAgent)) {
    return 'Mozilla Firefox'
  }

  if (/CriOS|Chrome\//.test(userAgent)) {
    return 'Google Chrome'
  }

  if (
    /Safari\//.test(userAgent) &&
    !/Chrome|CriOS|Chromium|Edg\//.test(userAgent)
  ) {
    return 'Safari'
  }

  return 'Outro browser'
}

export function getProblemReportScreen() {
  if (typeof window === 'undefined') {
    return '/produtos/ma-professor'
  }

  try {
    const productRoot =
      document.querySelector<HTMLElement>(
        '[data-ma-professor-screen]'
      )

    const screen =
      productRoot?.dataset
        .maProfessorScreen

    if (screen) {
      return normalizeText(
        screen,
        160
      )
    }
  } catch {
    // O pathname continua disponível como fallback sem ler dados pedagógicos.
  }

  return normalizeText(
    window.location.pathname ||
      '/produtos/ma-professor',
    160
  )
}

export function createProblemReportDraft(
  error: string,
  screen = getProblemReportScreen()
): ProblemReportDraft {
  return {
    error:
      normalizeText(
        error,
        160
      ) ||
      'Erro inesperado no MA-Professor',
    version:
      readBundleVersion(),
    screen:
      normalizeText(
        screen,
        160
      ) ||
      '/produtos/ma-professor',
    browser:
      readBrowserName(),
    occurredAt:
      new Date().toISOString(),
    device: readDeviceName()
  }
}

function readDeviceName() {
  const agent = typeof navigator === 'undefined' ? '' : navigator.userAgent
  if (/iPhone/.test(agent)) return 'iPhone'
  if (/iPad/.test(agent)) return 'iPad'
  if (/Android/.test(agent)) return 'Android'
  if (/Macintosh|Mac OS X/.test(agent)) return 'Mac'
  if (/Windows/.test(agent)) return 'Windows'
  if (/Linux/.test(agent)) return 'Linux'
  return 'Dispositivo desconhecido'
}

export async function sendProblemReport(
  draft: ProblemReportDraft,
  message: string
) {
  const normalizedMessage =
    normalizeText(
      message,
      MAX_MESSAGE_LENGTH
    )

  const payload: ProblemReportPayload = {
    error:
      draft.error,
    version:
      draft.version,
    screen:
      draft.screen,
    browser:
      draft.browser,
    occurredAt:
      draft.occurredAt,
    device: draft.device || 'Dispositivo desconhecido',
    ...(normalizedMessage
      ? {
          message:
            normalizedMessage
        }
      : {})
  }

  const access = readMAProfessorStoredAccess()
  if (access?.token && access.deviceId) {
    payload.session = { token: access.token, deviceId: access.deviceId }
  }

  const response =
    await fetch(
      PROBLEM_REPORT_ENDPOINT,
      {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type':
            'application/json',
          Accept:
            'application/json'
        },
        body:
          JSON.stringify(
            payload
          )
      }
    )

  if (response.ok) {
    return
  }

  let messageFromServer = ''

  try {
    const body =
      await response.json() as {
        message?: unknown
      }

    if (
      typeof body.message ===
        'string'
    ) {
      messageFromServer =
        normalizeText(
          body.message,
          240
        )
    }
  } catch {
    // A mensagem genérica abaixo evita propagar um erro de parsing para a app.
  }

  throw new Error(
    messageFromServer ||
      'Não foi possível enviar o relatório. Tente novamente mais tarde.'
  )
}
