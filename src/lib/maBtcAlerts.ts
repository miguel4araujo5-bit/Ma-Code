export const BTC_ALERTS_ROUTE =
  '/produtos/ma-btc-alertas'

const API_BASE =
  '/api/ma-btc-alertas'

export type BtcAlertsSubscriptionStatus = {
  active: boolean
  snoozeUntil: string | null
}

export type BtcAlertsStatus = {
  success: true
  product: 'MA-BTC ALERTAS'
  pair: 'BTC/USD'
  thresholdPercent: number
  activeHours: {
    start: number
    end: number
    timeZone: 'Europe/Lisbon'
  }
  activeNow: boolean
  vapidPublicKey: string
  currentPrice: number | null
  referencePrice: number | null
  changePercent: number | null
  lastCheckedAt: string | null
  lastAlertAt: string | null
  lastAlertDirection:
    | 'up'
    | 'down'
    | null
  lastAlertPercent:
    number | null
  lastError:
    string | null
  subscriberCount: number
  subscription:
    BtcAlertsSubscriptionStatus
}

type ApiErrorBody = {
  success?: false
  message?: string
}

const readJson = async <T>(
  response: Response
): Promise<T> => {
  const body =
    (
      await response
        .json()
        .catch(
          () => null
        )
    ) as
      | T
      | ApiErrorBody
      | null

  if (!response.ok) {
    const message =
      body &&
      typeof body ===
        'object' &&
      'message' in body &&
      typeof body.message ===
        'string'
        ? body.message
        : 'Não foi possível comunicar com a MA-BTC ALERTAS.'

    throw new Error(message)
  }

  return body as T
}

const post = async <T>(
  path: string,
  body: unknown
): Promise<T> => {
  const response =
    await fetch(
      `${API_BASE}${path}`,
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json'
        },
        body:
          JSON.stringify(
            body
          ),
        credentials:
          'same-origin'
      }
    )

  return readJson<T>(
    response
  )
}

export const getBtcAlertsStatus = (
  endpoint = ''
) =>
  post<BtcAlertsStatus>(
    '/status',
    {
      endpoint
    }
  )

export const subscribeToBtcAlerts = (
  subscription:
    PushSubscriptionJSON
) =>
  post<BtcAlertsStatus>(
    '/subscribe',
    {
      subscription
    }
  )

export const unsubscribeFromBtcAlerts = (
  endpoint: string
) =>
  post<BtcAlertsStatus>(
    '/unsubscribe',
    {
      endpoint
    }
  )

export const snoozeBtcAlerts = (
  endpoint: string
) =>
  post<BtcAlertsStatus>(
    '/snooze',
    {
      endpoint
    }
  )

export const resumeBtcAlerts = (
  endpoint: string
) =>
  post<BtcAlertsStatus>(
    '/resume',
    {
      endpoint
    }
  )

export const sendBtcAlertsTest = (
  endpoint: string
) =>
  post<BtcAlertsStatus>(
    '/test',
    {
      endpoint
    }
  )

export const registerBtcAlertsServiceWorker =
  async () => {
    if (
      !(
        'serviceWorker' in
        navigator
      )
    ) {
      throw new Error(
        'Este browser não suporta notificações web.'
      )
    }

    const registration =
      await navigator.serviceWorker.register(
        '/ma-btc-alertas-sw.js',
        {
          scope: '/'
        }
      )

    await navigator
      .serviceWorker
      .ready

    return registration
  }

export const getExistingPushSubscription =
  async () => {
    if (
      !(
        'serviceWorker' in
        navigator
      )
    ) {
      return null
    }

    const registration =
      await navigator.serviceWorker.getRegistration(
        '/'
      )

    if (!registration) {
      return null
    }

    return registration.pushManager.getSubscription()
  }

export const base64UrlToUint8Array = (
  value: string
) => {
  const padding =
    '='.repeat(
      (
        4 -
        (
          value.length %
          4
        )
      ) %
        4
    )

  const base64 =
    (
      value +
      padding
    )
      .replace(
        /-/g,
        '+'
      )
      .replace(
        /_/g,
        '/'
      )

  const raw =
    window.atob(
      base64
    )

  const output =
    new Uint8Array(
      raw.length
    )

  for (
    let index = 0;
    index < raw.length;
    index += 1
  ) {
    output[index] =
      raw.charCodeAt(
        index
      )
  }

  return output
}

export const formatUsd = (
  value: number | null
) => {
  if (
    value === null ||
    !Number.isFinite(value)
  ) {
    return '—'
  }

  return new Intl.NumberFormat(
    'en-US',
    {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }
  ).format(value)
}

export const formatPercent = (
  value: number | null
) => {
  if (
    value === null ||
    !Number.isFinite(value)
  ) {
    return '—'
  }

  const sign =
    value > 0
      ? '+'
      : ''

  return `${sign}${value.toLocaleString(
    'pt-PT',
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }
  )}%`
}

export const formatBtcAlertsDateTime = (
  value: string | null
) => {
  if (!value) {
    return '—'
  }

  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '—'
  }

  return new Intl.DateTimeFormat(
    'pt-PT',
    {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone:
        'Europe/Lisbon'
    }
  ).format(date)
}

export const isSnoozed = (
  status:
    BtcAlertsStatus | null
) => {
  if (
    !status?.subscription
      .snoozeUntil
  ) {
    return false
  }

  return (
    new Date(
      status.subscription.snoozeUntil
    ).getTime() >
    Date.now()
  )
}
