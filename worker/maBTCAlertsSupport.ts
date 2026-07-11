import webpush from 'web-push'

export const MA_BTC_ALERTS_API_PREFIX = '/api/ma-btc-alertas'
export const PRODUCT_NAME = 'MA-BTC ALERTAS' as const
export const PAIR = 'BTC/USD' as const
export const TIME_ZONE = 'Europe/Lisbon' as const
export const ACTIVE_START_HOUR = 7
export const ACTIVE_END_HOUR = 23
export const ALERT_THRESHOLD_PERCENT = 1
export const SNOOZE_DURATION_MS = 8 * 60 * 60 * 1000
export const MAX_SUBSCRIBERS = 100
export const STORAGE_KEY = 'ma-btc-alertas-state-v1'

const MAX_REQUEST_BODY_BYTES = 24_000
const COINBASE_TICKER_URL =
  'https://api.exchange.coinbase.com/products/BTC-USD/ticker'
const NOTIFICATION_URL = '/produtos/ma-btc-alertas'
const VAPID_SUBJECT = 'https://ma-code.pt'

export const securityHeaders = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow'
}

export type DurableObjectStorageLike = {
  get<T>(key: string): Promise<T | undefined>
  put<T>(key: string, value: T): Promise<void>
}

export type DurableObjectStateLike = {
  storage: DurableObjectStorageLike
  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>
}

export type DurableObjectStubLike = {
  fetch(request: Request): Promise<Response>
}

export type DurableObjectNamespaceLike = {
  idFromName(name: string): unknown
  get(id: unknown): DurableObjectStubLike
}

export interface BtcAlertsEnv {
  BTC_ALERTS: DurableObjectNamespaceLike
}

export type PushSubscriptionPayload = {
  endpoint: string
  expirationTime: number | null
  keys: {
    p256dh: string
    auth: string
  }
}

export type Subscriber = {
  id: string
  subscription: PushSubscriptionPayload
  snoozeUntil: number | null
  createdAt: number
  updatedAt: number
}

export type StoredState = {
  version: 1
  vapidKeys: {
    publicKey: string
    privateKey: string
  }
  subscribers: Record<string, Subscriber>
  currentPrice: number | null
  referencePrice: number | null
  lastCheckedAt: number | null
  lastAlertAt: number | null
  lastAlertDirection: 'up' | 'down' | null
  lastAlertPercent: number | null
  lastError: string | null
}

export type JsonBody = Record<string, unknown>

type CoinbaseTickerResponse = {
  price?: unknown
}

type PushError = Error & {
  statusCode?: number
}

export const json = (
  body: unknown,
  status = 200,
  headers: HeadersInit = {}
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...securityHeaders,
      ...headers
    }
  })

export const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message.trim()
    ? error.message.trim()
    : fallback

export const toIso = (value: number | null) =>
  value === null ? null : new Date(value).toISOString()

export const isBtcAlertsApiPath = (pathname: string) =>
  pathname === MA_BTC_ALERTS_API_PREFIX ||
  pathname.startsWith(`${MA_BTC_ALERTS_API_PREFIX}/`)

export const getLisbonHour = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    hourCycle: 'h23',
    timeZone: TIME_ZONE
  }).formatToParts(date)

  const hour = Number(parts.find((part) => part.type === 'hour')?.value)
  return Number.isInteger(hour) ? hour : -1
}

export const isActiveHour = (date = new Date()) => {
  const hour = getLisbonHour(date)
  return hour >= ACTIVE_START_HOUR && hour <= ACTIVE_END_HOUR
}

export const getChangePercent = (
  currentPrice: number | null,
  referencePrice: number | null
) => {
  if (
    currentPrice === null ||
    referencePrice === null ||
    !Number.isFinite(currentPrice) ||
    !Number.isFinite(referencePrice) ||
    referencePrice <= 0
  ) {
    return null
  }

  return ((currentPrice - referencePrice) / referencePrice) * 100
}

export const formatUsd = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value)

export const formatPercent = (value: number) =>
  Math.abs(value).toLocaleString('pt-PT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

export const isValidEndpoint = (value: unknown): value is string => {
  if (
    typeof value !== 'string' ||
    value.length < 20 ||
    value.length > 4096
  ) {
    return false
  }

  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

export const normalizeSubscription = (
  value: unknown
): PushSubscriptionPayload | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const subscription = value as {
    endpoint?: unknown
    expirationTime?: unknown
    keys?: unknown
  }

  if (!isValidEndpoint(subscription.endpoint)) {
    return null
  }

  if (!subscription.keys || typeof subscription.keys !== 'object') {
    return null
  }

  const keys = subscription.keys as {
    p256dh?: unknown
    auth?: unknown
  }

  if (
    typeof keys.p256dh !== 'string' ||
    keys.p256dh.length < 20 ||
    keys.p256dh.length > 512 ||
    typeof keys.auth !== 'string' ||
    keys.auth.length < 8 ||
    keys.auth.length > 256
  ) {
    return null
  }

  const expirationTime =
    typeof subscription.expirationTime === 'number' &&
    Number.isFinite(subscription.expirationTime)
      ? subscription.expirationTime
      : null

  return {
    endpoint: subscription.endpoint,
    expirationTime,
    keys: {
      p256dh: keys.p256dh,
      auth: keys.auth
    }
  }
}

export const getBody = async (
  request: Request
): Promise<JsonBody> => {
  const contentLength = Number(
    request.headers.get('Content-Length') || '0'
  )

  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_REQUEST_BODY_BYTES
  ) {
    throw new Error('O pedido é demasiado grande.')
  }

  const text = await request.text()

  if (
    new TextEncoder().encode(text).byteLength >
    MAX_REQUEST_BODY_BYTES
  ) {
    throw new Error('O pedido é demasiado grande.')
  }

  if (!text) {
    return {}
  }

  const parsed = JSON.parse(text) as unknown

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed)
  ) {
    throw new Error('O pedido enviado não é válido.')
  }

  return parsed as JsonBody
}

export const hashEndpoint = async (endpoint: string) => {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(endpoint)
  )

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export const fetchBtcUsdPrice = async () => {
  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    10_000
  )

  try {
    const response = await fetch(COINBASE_TICKER_URL, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'MA-BTC-ALERTAS/1.0'
      },
      signal: controller.signal
    })

    if (!response.ok) {
      throw new Error(
        `A fonte BTC/USD respondeu com o estado ${response.status}.`
      )
    }

    const data =
      (await response.json()) as CoinbaseTickerResponse

    const price = Number(data.price)

    if (!Number.isFinite(price) || price <= 0) {
      throw new Error(
        'A fonte BTC/USD devolveu um preço inválido.'
      )
    }

    return price
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error(
          'A consulta BTC/USD excedeu o tempo máximo.'
        )
      }

      if (
        error.message.startsWith(
          'A fonte BTC/USD'
        )
      ) {
        throw error
      }
    }

    throw new Error(
      'Não foi possível comunicar com a fonte BTC/USD.'
    )
  } finally {
    clearTimeout(timeout)
  }
}

export const createInitialState = (): StoredState => ({
  version: 1,
  vapidKeys: webpush.generateVAPIDKeys(),
  subscribers: {},
  currentPrice: null,
  referencePrice: null,
  lastCheckedAt: null,
  lastAlertAt: null,
  lastAlertDirection: null,
  lastAlertPercent: null,
  lastError: null
})

export const isExpiredSubscription = (
  subscriber: Subscriber,
  now: number
) =>
  subscriber.subscription.expirationTime !== null &&
  subscriber.subscription.expirationTime <= now

export const isSnoozedSubscriber = (
  subscriber: Subscriber,
  now: number
) =>
  subscriber.snoozeUntil !== null &&
  subscriber.snoozeUntil > now

const getPushStatusCode = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return null
  }

  const statusCode =
    (error as PushError).statusCode

  return typeof statusCode === 'number'
    ? statusCode
    : null
}

export const sendPushNotification = async (
  state: StoredState,
  subscriber: Subscriber,
  notification: {
    title: string
    body: string
  }
) => {
  webpush.setVapidDetails(
    VAPID_SUBJECT,
    state.vapidKeys.publicKey,
    state.vapidKeys.privateKey
  )

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    icon: '/ma-btc-alertas.svg',
    badge: '/ma-btc-alertas.svg',
    tag: 'ma-btc-alertas-price',
    url: NOTIFICATION_URL
  })

  try {
    await webpush.sendNotification(
      subscriber.subscription,
      payload,
      {
        TTL: 60 * 60,
        urgency: 'high'
      }
    )

    return {
      delivered: true,
      remove: false,
      message: ''
    }
  } catch (error) {
    const statusCode =
      getPushStatusCode(error)

    return {
      delivered: false,
      remove:
        statusCode === 404 ||
        statusCode === 410,
      message: errorMessage(
        error,
        'Não foi possível entregar a notificação.'
      )
    }
  }
}
