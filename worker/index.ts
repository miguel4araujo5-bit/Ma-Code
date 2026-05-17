export interface Env {
  WEB3FORMS_ACCESS_KEY?: string
  WEB3FORMS_KEY?: string
  CONTACT_ALLOWED_ORIGINS?: string
}

type ContactBody = {
  name?: unknown
  email?: unknown
  message?: unknown
  phone?: unknown
  projectType?: unknown
  projectGoal?: unknown
  hasWebsite?: unknown
  pageUrl?: unknown
  botcheck?: unknown
}

type Web3FormsResponse = {
  success?: boolean
  message?: string
}

type HeaderMap = Record<string, string>

const MAX_BODY_BYTES = 25_000
const ORIGIN_BLOCKED_MESSAGE = 'Pedido bloqueado por origem inválida.'

const securityHeaders: HeaderMap = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Robots-Tag': 'noindex, nofollow'
}

const json = (body: unknown, status = 200, headers: HeaderMap = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...securityHeaders,
      ...headers
    }
  })

const normalizeOrigin = (value: string) => {
  try {
    return new URL(value).origin
  } catch {
    return ''
  }
}

const getConfiguredOrigins = (env: Env) =>
  (env.CONTACT_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => normalizeOrigin(origin.trim()))
    .filter(Boolean)

const isLocalDevelopmentOrigin = (origin: string) => {
  try {
    const { hostname } = new URL(origin)

    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0'
  } catch {
    return false
  }
}

const getDefaultAllowedOrigins = (requestOrigin: string) =>
  new Set([requestOrigin, 'https://ma-code.pt', 'https://www.ma-code.pt'])

const isAllowedOrigin = (origin: string, requestOrigin: string, env: Env) => {
  const normalizedOrigin = normalizeOrigin(origin)

  if (!normalizedOrigin) {
    return false
  }

  if (getDefaultAllowedOrigins(requestOrigin).has(normalizedOrigin)) {
    return true
  }

  if (isLocalDevelopmentOrigin(normalizedOrigin)) {
    return true
  }

  return getConfiguredOrigins(env).includes(normalizedOrigin)
}

const getRefererOrigin = (request: Request) => {
  const referer = request.headers.get('referer')

  if (!referer) {
    return ''
  }

  return normalizeOrigin(referer)
}

const getVerifiedRequestOrigin = (request: Request, requestOrigin: string, env: Env) => {
  const origin = request.headers.get('origin')

  if (origin) {
    return isAllowedOrigin(origin, requestOrigin, env) ? normalizeOrigin(origin) : ''
  }

  const refererOrigin = getRefererOrigin(request)

  if (!refererOrigin) {
    return ''
  }

  return isAllowedOrigin(refererOrigin, requestOrigin, env) ? refererOrigin : ''
}

const createCorsHeaders = (origin: string | null): HeaderMap => {
  const normalizedOrigin = origin ? normalizeOrigin(origin) : ''

  if (!normalizedOrigin) {
    return {}
  }

  return {
    'Access-Control-Allow-Origin': normalizedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin'
  }
}

const getWeb3FormsAccessKey = (env: Env) =>
  (env.WEB3FORMS_ACCESS_KEY || env.WEB3FORMS_KEY || '').trim()

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

const isContactBody = (value: unknown): value is ContactBody =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const toStringValue = (value: unknown) => (typeof value === 'string' ? value : '')

const getByteLength = (value: string) => new TextEncoder().encode(value).byteLength

const cleanText = (value: string, maxLength: number) =>
  value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)

const cleanMultilineText = (value: string, maxLength: number) =>
  value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength)

const cleanPageUrl = (value: unknown, fallback: string, env: Env) => {
  const cleaned = cleanText(toStringValue(value), 300)

  if (!cleaned) {
    return fallback
  }

  try {
    const parsedUrl = new URL(cleaned)

    if (
      (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') &&
      isAllowedOrigin(parsedUrl.origin, normalizeOrigin(fallback), env)
    ) {
      return parsedUrl.toString().slice(0, 300)
    }

    return fallback
  } catch {
    return fallback
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const requestOrigin = url.origin
    const origin = request.headers.get('origin')
    const verifiedOrigin = getVerifiedRequestOrigin(request, requestOrigin, env)
    const corsHeaders = origin && verifiedOrigin ? createCorsHeaders(verifiedOrigin) : {}
    const respond = (body: unknown, status = 200, headers: HeaderMap = {}) =>
      json(body, status, { ...corsHeaders, ...headers })

    if (url.pathname !== '/api/contact') {
      return respond({ success: false, message: 'Endpoint não encontrado.' }, 404)
    }

    if (!verifiedOrigin) {
      return respond({ success: false, message: ORIGIN_BLOCKED_MESSAGE }, 403)
    }

    if (request.method === 'OPTIONS') {
      const headers: HeaderMap = {
        Allow: 'POST, OPTIONS',
        ...securityHeaders,
        ...corsHeaders
      }

      if (origin) {
        headers['Access-Control-Max-Age'] = '86400'
      }

      return new Response(null, { status: 204, headers })
    }

    if (request.method !== 'POST') {
      return respond(
        { success: false, message: 'Método não permitido.' },
        405,
        { Allow: 'POST, OPTIONS' }
      )
    }

    const accessKey = getWeb3FormsAccessKey(env)

    if (!accessKey) {
      return respond(
        { success: false, message: 'A configuração do formulário não está disponível neste momento.' },
        500
      )
    }

    const contentType = request.headers.get('content-type') || ''

    if (!contentType.toLowerCase().includes('application/json')) {
      return respond({ success: false, message: 'Formato de pedido inválido.' }, 415)
    }

    const contentLengthHeader = request.headers.get('content-length')
    const contentLength = contentLengthHeader ? Number(contentLengthHeader) : 0

    if (contentLengthHeader && (!Number.isFinite(contentLength) || contentLength < 0)) {
      return respond({ success: false, message: 'Formato de pedido inválido.' }, 400)
    }

    if (contentLength > MAX_BODY_BYTES) {
      return respond(
        { success: false, message: 'O pedido é demasiado longo. Reduza a mensagem e tente novamente.' },
        413
      )
    }

    let rawBody = ''

    try {
      rawBody = await request.text()
    } catch {
      return respond(
        { success: false, message: 'Não foi possível ler os dados do formulário. Tente novamente.' },
        400
      )
    }

    if (getByteLength(rawBody) > MAX_BODY_BYTES) {
      return respond(
        { success: false, message: 'O pedido é demasiado longo. Reduza a mensagem e tente novamente.' },
        413
      )
    }

    let parsedBody: unknown

    try {
      parsedBody = JSON.parse(rawBody)
    } catch {
      return respond(
        { success: false, message: 'Não foi possível ler os dados do formulário. Tente novamente.' },
        400
      )
    }

    if (!isContactBody(parsedBody)) {
      return respond({ success: false, message: 'Os dados do formulário são inválidos.' }, 400)
    }

    const body = parsedBody

    if (toStringValue(body.botcheck).trim()) {
      return respond({ success: true, message: 'Pedido enviado com sucesso.' })
    }

    const name = cleanText(toStringValue(body.name), 120)
    const email = cleanText(toStringValue(body.email), 180).toLowerCase()
    const phone = cleanText(toStringValue(body.phone), 80)
    const projectType = cleanText(toStringValue(body.projectType), 120)
    const projectGoal = cleanText(toStringValue(body.projectGoal), 120)
    const hasWebsite = cleanText(toStringValue(body.hasWebsite), 120)
    const pageUrl = cleanPageUrl(body.pageUrl, requestOrigin, env)
    const message = cleanMultilineText(toStringValue(body.message), 5000)

    if (!name || !email || !message) {
      return respond({ success: false, message: 'Preencha todos os campos obrigatórios.' }, 400)
    }

    if (name.length < 2) {
      return respond({ success: false, message: 'Indique um nome válido.' }, 400)
    }

    if (!isValidEmail(email)) {
      return respond({ success: false, message: 'Indique um email válido.' }, 400)
    }

    if (message.length < 10) {
      return respond(
        { success: false, message: 'Descreva o projeto com um pouco mais de detalhe.' },
        400
      )
    }

    const timestamp = new Date().toISOString()

    const fullMessage = [
      'Novo pedido recebido através do site MA-Code.',
      '',
      `Nome: ${name}`,
      `Email: ${email}`,
      phone ? `Telefone/WhatsApp: ${phone}` : 'Telefone/WhatsApp: não indicado',
      projectType ? `Tipo de projeto: ${projectType}` : 'Tipo de projeto: não indicado',
      projectGoal ? `Objetivo principal: ${projectGoal}` : 'Objetivo principal: não indicado',
      hasWebsite ? `Já tem site: ${hasWebsite}` : 'Já tem site: não indicado',
      '',
      'Mensagem:',
      message,
      '',
      `Página de origem: ${pageUrl}`,
      `Data: ${timestamp}`
    ].join('\n')

    const subject = cleanText(
      ['Pedido de proposta - MA-Code', projectType || null, name].filter(Boolean).join(' | '),
      180
    )

    try {
      const web3Response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          access_key: accessKey,
          subject,
          from_name: 'MA-Code Website',
          name,
          email,
          replyto: email,
          phone,
          project_type: projectType,
          project_goal: projectGoal,
          has_website: hasWebsite,
          message: fullMessage,
          page: pageUrl,
          timestamp
        })
      })

      let data: Web3FormsResponse = {}

      try {
        data = (await web3Response.json()) as Web3FormsResponse
      } catch {
        return respond(
          { success: false, message: 'Não foi possível confirmar o envio do formulário. Tente novamente.' },
          502
        )
      }

      if (!web3Response.ok || !data.success) {
        return respond(
          { success: false, message: data.message || 'Não foi possível enviar o pedido. Tente novamente.' },
          400
        )
      }

      return respond({ success: true, message: 'Pedido enviado com sucesso.' })
    } catch {
      return respond(
        { success: false, message: 'Erro ao comunicar com o serviço de envio. Tente novamente.' },
        502
      )
    }
  }
}
