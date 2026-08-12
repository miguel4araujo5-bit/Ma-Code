import {
  ACTIVE_END_HOUR,
  ACTIVE_START_HOUR,
  ALERT_THRESHOLD_PERCENT,
  MA_BTC_ALERTS_API_PREFIX,
  MAX_SUBSCRIBERS,
  PAIR,
  PRODUCT_NAME,
  SNOOZE_DURATION_MS,
  STORAGE_KEY,
  TIME_ZONE,
  createInitialState,
  errorMessage,
  fetchBtcUsdPrice,
  formatPercent,
  formatUsd,
  getBody,
  getChangePercent,
  hashEndpoint,
  isActiveHour,
  isBtcAlertsApiPath,
  isExpiredSubscription,
  isSnoozedSubscriber,
  isValidEndpoint,
  json,
  normalizeSubscription,
  securityHeaders,
  sendPushNotification,
  toIso,
  type BtcAlertsEnv,
  type DurableObjectStateLike,
  type JsonBody,
  type StoredState
} from './maBTCAlertsSupport'

export {
  isBtcAlertsApiPath,
  type BtcAlertsEnv
}

const PUSH_BATCH_SIZE = 35

const PUSH_BATCH_DELAY_MS =
  5_000

type PendingAlertDelivery = {
  subscriberIds: string[]
  nextIndex: number
  title: string
  body: string
  price: number
  direction:
    | 'up'
    | 'down'
  changePercent: number
  triggeredAt: number
  failedDeliveries: number
}

type StoredStateWithPendingAlert =
  StoredState & {
    pendingAlert?:
      PendingAlertDelivery | null
  }

type AlarmStorageLike =
  DurableObjectStateLike['storage'] & {
    setAlarm(
      scheduledTime:
        number | Date
    ): Promise<void>
  }

const normalizeOrigin = (
  value: string
) => {
  try {
    return new URL(value).origin
  } catch {
    return ''
  }
}

const isAllowedOrigin = (
  request: Request
) => {
  const requestOrigin =
    new URL(request.url).origin

  const origin = normalizeOrigin(
    request.headers.get('Origin') || ''
  )

  const referer = normalizeOrigin(
    request.headers.get('Referer') || ''
  )

  const candidate =
    origin || referer

  if (!candidate) {
    return false
  }

  const allowed = new Set([
    requestOrigin,
    'https://ma-code.pt',
    'https://www.ma-code.pt'
  ])

  try {
    const hostname =
      new URL(candidate).hostname

    if (
      [
        'localhost',
        '127.0.0.1',
        '0.0.0.0'
      ].includes(hostname)
    ) {
      return true
    }
  } catch {
    return false
  }

  return allowed.has(candidate)
}

const getDurableObject = (
  env: BtcAlertsEnv
) => {
  const id =
    env.BTC_ALERTS.idFromName(
      'ma-btc-alertas-global'
    )

  return env.BTC_ALERTS.get(id)
}

export const handleBtcAlertsApiRequest =
  async (
    request: Request,
    env: BtcAlertsEnv
  ) => {
    const origin = normalizeOrigin(
      request.headers.get('Origin') || ''
    )

    const corsHeaders:
      Record<string, string> = {}

    if (
      origin &&
      isAllowedOrigin(request)
    ) {
      corsHeaders[
        'Access-Control-Allow-Origin'
      ] = origin

      corsHeaders.Vary = 'Origin'
    }

    if (
      request.method === 'OPTIONS'
    ) {
      if (!isAllowedOrigin(request)) {
        return json(
          {
            success: false,
            message:
              'Pedido bloqueado por origem inválida.'
          },
          403
        )
      }

      return new Response(
        null,
        {
          status: 204,
          headers: {
            ...securityHeaders,
            ...corsHeaders,
            'Access-Control-Allow-Headers':
              'Content-Type',
            'Access-Control-Allow-Methods':
              'POST, OPTIONS',
            'Access-Control-Max-Age':
              '86400'
          }
        }
      )
    }

    if (
      request.method !== 'POST'
    ) {
      return json(
        {
          success: false,
          message:
            'Método não permitido.'
        },
        405,
        {
          ...corsHeaders,
          Allow: 'POST, OPTIONS'
        }
      )
    }

    if (!isAllowedOrigin(request)) {
      return json(
        {
          success: false,
          message:
            'Pedido bloqueado por origem inválida.'
        },
        403
      )
    }

    const response =
      await getDurableObject(
        env
      ).fetch(request)

    const headers =
      new Headers(
        response.headers
      )

    Object.entries(
      corsHeaders
    ).forEach(
      ([name, value]) => {
        headers.set(name, value)
      }
    )

    return new Response(
      response.body,
      {
        status: response.status,
        statusText:
          response.statusText,
        headers
      }
    )
  }

export const runBtcAlertsScheduled =
  async (
    env: BtcAlertsEnv
  ) => {
    await getDurableObject(
      env
    ).fetch(
      new Request(
        'https://ma-btc-alertas.internal/internal/cron',
        {
          method: 'POST'
        }
      )
    )
  }

export class BtcAlertsDurableObject {
  private readonly state:
    DurableObjectStateLike

  private storedState:
    StoredStateWithPendingAlert | null =
      null

  private operation:
    Promise<void>

  constructor(
    state: DurableObjectStateLike,
    _env: BtcAlertsEnv
  ) {
    this.state = state

    this.operation =
      this.state.blockConcurrencyWhile(
        async () => {
          this.storedState =
            (
              await this.state.storage.get<
                StoredStateWithPendingAlert
              >(STORAGE_KEY)
            ) ||
            createInitialState()

          await this.save()
        }
      )
  }

  fetch(
    request: Request
  ): Promise<Response> {
    const response =
      this.operation.then(
        () =>
          this.handleRequest(
            request
          )
      )

    this.operation =
      response.then(
        () => undefined,
        () => undefined
      )

    return response
  }

  alarm(): Promise<void> {
    const response =
      this.operation.then(
        () =>
          this.processPendingAlertBatch()
      )

    this.operation =
      response.then(
        () => undefined,
        () => undefined
      )

    return response
  }

  private async getState() {
    if (!this.storedState) {
      this.storedState =
        (
          await this.state.storage.get<
            StoredStateWithPendingAlert
          >(STORAGE_KEY)
        ) ||
        createInitialState()
    }

    return this.storedState
  }

  private async save() {
    if (this.storedState) {
      await this.state.storage.put(
        STORAGE_KEY,
        this.storedState
      )
    }
  }

  private async schedulePendingAlertContinuation() {
    const storage =
      this.state
        .storage as
        AlarmStorageLike

    await storage.setAlarm(
      Date.now() +
        PUSH_BATCH_DELAY_MS
    )
  }

  private completePendingAlert(
    state:
      StoredStateWithPendingAlert,
    pending:
      PendingAlertDelivery
  ) {
    state.referencePrice =
      pending.price

    state.lastAlertAt =
      pending.triggeredAt

    state.lastAlertDirection =
      pending.direction

    state.lastAlertPercent =
      Math.abs(
        pending.changePercent
      )

    state.lastError =
      pending.failedDeliveries > 0
        ? `${pending.failedDeliveries} notificação${
            pending.failedDeliveries === 1
              ? ''
              : 'ões'
          } não ${
            pending.failedDeliveries === 1
              ? 'foi entregue'
              : 'foram entregues'
          }.`
        : null

    state.pendingAlert =
      null
  }

  private async processPendingAlertBatch() {
    const state =
      await this.getState()

    const pending =
      state.pendingAlert

    if (!pending) {
      return
    }

    const now =
      Date.now()

    const startIndex =
      pending.nextIndex

    const endIndex =
      Math.min(
        startIndex +
          PUSH_BATCH_SIZE,
        pending
          .subscriberIds
          .length
      )

    const subscriberIds =
      pending
        .subscriberIds
        .slice(
          startIndex,
          endIndex
        )

    for (
      const id of
      subscriberIds
    ) {
      const subscriber =
        state.subscribers[
          id
        ]

      if (!subscriber) {
        continue
      }

      if (
        isExpiredSubscription(
          subscriber,
          now
        )
      ) {
        delete state.subscribers[
          id
        ]

        continue
      }

      if (
        isSnoozedSubscriber(
          subscriber,
          now
        )
      ) {
        continue
      }

      const result =
        await sendPushNotification(
          state,
          subscriber,
          {
            title:
              pending.title,
            body:
              pending.body
          }
        )

      if (result.remove) {
        delete state.subscribers[
          id
        ]
      } else if (
        !result.delivered
      ) {
        pending
          .failedDeliveries +=
          1
      }
    }

    pending.nextIndex =
      endIndex

    if (
      pending.nextIndex >=
      pending
        .subscriberIds
        .length
    ) {
      this.completePendingAlert(
        state,
        pending
      )

      await this.save()

      return
    }

    await this.save()

    await this
      .schedulePendingAlertContinuation()
  }

  private async handleRequest(
    request: Request
  ) {
    const url =
      new URL(request.url)

    if (
      url.pathname ===
      '/internal/cron'
    ) {
      if (
        request.method !== 'POST'
      ) {
        return json(
          {
            success: false,
            message:
              'Método não permitido.'
          },
          405
        )
      }

      await this.runScheduledCheck()

      return json({
        success: true
      })
    }

    if (
      !isBtcAlertsApiPath(
        url.pathname
      )
    ) {
      return json(
        {
          success: false,
          message:
            'Endpoint não encontrado.'
        },
        404
      )
    }

    const action =
      url.pathname.slice(
        MA_BTC_ALERTS_API_PREFIX.length
      ) || '/'

    try {
      const body =
        await getBody(request)

      switch (action) {
        case '/status':
          return this.handleStatus(
            body
          )

        case '/subscribe':
          return this.handleSubscribe(
            body
          )

        case '/unsubscribe':
          return this.handleUnsubscribe(
            body
          )

        case '/snooze':
          return this.handleSnooze(
            body
          )

        case '/resume':
          return this.handleResume(
            body
          )

        case '/test':
          return this.handleTest(
            body
          )

        default:
          return json(
            {
              success: false,
              message:
                'Endpoint não encontrado.'
            },
            404
          )
      }
    } catch (error) {
      const message =
        errorMessage(
          error,
          'Não foi possível processar o pedido da MA-BTC ALERTAS.'
        )

      const status =
        message ===
        'O pedido é demasiado grande.'
          ? 413
          : message ===
              'O pedido enviado não é válido.' ||
            message.includes(
              'JSON'
            )
            ? 400
            : 500

      return json(
        {
          success: false,
          message
        },
        status
      )
    }
  }

  private async buildStatus(
    endpoint: string
  ) {
    const state =
      await this.getState()

    const now =
      Date.now()

    const id =
      isValidEndpoint(endpoint)
        ? await hashEndpoint(
            endpoint
          )
        : ''

    const subscriber =
      id
        ? state.subscribers[id]
        : undefined

    const snoozeUntil =
      subscriber?.snoozeUntil &&
      subscriber.snoozeUntil > now
        ? subscriber.snoozeUntil
        : null

    return {
      success: true as const,
      product: PRODUCT_NAME,
      pair: PAIR,
      thresholdPercent:
        ALERT_THRESHOLD_PERCENT,
      activeHours: {
        start:
          ACTIVE_START_HOUR,
        end:
          ACTIVE_END_HOUR,
        timeZone:
          TIME_ZONE
      },
      activeNow:
        isActiveHour(
          new Date(now)
        ),
      vapidPublicKey:
        state.vapidKeys.publicKey,
      currentPrice:
        state.currentPrice,
      referencePrice:
        state.referencePrice,
      changePercent:
        getChangePercent(
          state.currentPrice,
          state.referencePrice
        ),
      lastCheckedAt:
        toIso(
          state.lastCheckedAt
        ),
      lastAlertAt:
        toIso(
          state.lastAlertAt
        ),
      lastAlertDirection:
        state.lastAlertDirection,
      lastAlertPercent:
        state.lastAlertPercent,
      lastError:
        state.lastError,
      subscriberCount:
        Object.keys(
          state.subscribers
        ).length,
      subscription: {
        active:
          Boolean(subscriber),
        snoozeUntil:
          toIso(snoozeUntil)
      }
    }
  }

  private async handleStatus(
    body: JsonBody
  ) {
    const endpoint =
      typeof body.endpoint ===
      'string'
        ? body.endpoint
        : ''

    return json(
      await this.buildStatus(
        endpoint
      )
    )
  }

  private async handleSubscribe(
    body: JsonBody
  ) {
    const state =
      await this.getState()

    const subscription =
      normalizeSubscription(
        body.subscription
      )

    if (!subscription) {
      return json(
        {
          success: false,
          message:
            'A subscrição de notificações não é válida.'
        },
        400
      )
    }

    const id =
      await hashEndpoint(
        subscription.endpoint
      )

    const existing =
      state.subscribers[id]

    if (
      !existing &&
      Object.keys(
        state.subscribers
      ).length >=
        MAX_SUBSCRIBERS
    ) {
      return json(
        {
          success: false,
          message:
            'Foi atingido o limite de dispositivos.'
        },
        409
      )
    }

    const now =
      Date.now()

    state.subscribers[id] = {
      id,
      subscription,
      snoozeUntil:
        existing?.snoozeUntil ||
        null,
      createdAt:
        existing?.createdAt ||
        now,
      updatedAt: now
    }

    if (
      state.referencePrice ===
        null &&
      isActiveHour(
        new Date(now)
      )
    ) {
      try {
        const price =
          await fetchBtcUsdPrice()

        state.currentPrice =
          price

        state.referencePrice =
          price

        state.lastCheckedAt =
          now

        state.lastError =
          null
      } catch (error) {
        state.lastError =
          errorMessage(
            error,
            'Não foi possível obter o preço BTC/USD.'
          )
      }
    }

    await this.save()

    return json(
      await this.buildStatus(
        subscription.endpoint
      )
    )
  }

  private async handleUnsubscribe(
    body: JsonBody
  ) {
    const state =
      await this.getState()

    const endpoint =
      typeof body.endpoint ===
      'string'
        ? body.endpoint
        : ''

    if (
      isValidEndpoint(
        endpoint
      )
    ) {
      delete state.subscribers[
        await hashEndpoint(
          endpoint
        )
      ]

      await this.save()
    }

    return json(
      await this.buildStatus('')
    )
  }

  private async getSubscriberFromBody(
    body: JsonBody
  ) {
    const state =
      await this.getState()

    const endpoint =
      typeof body.endpoint ===
      'string'
        ? body.endpoint
        : ''

    if (
      !isValidEndpoint(
        endpoint
      )
    ) {
      return {
        state,
        endpoint,
        id: '',
        subscriber: null
      }
    }

    const id =
      await hashEndpoint(
        endpoint
      )

    return {
      state,
      endpoint,
      id,
      subscriber:
        state.subscribers[id] ||
        null
    }
  }

  private async handleSnooze(
    body: JsonBody
  ) {
    const {
      endpoint,
      subscriber
    } =
      await this.getSubscriberFromBody(
        body
      )

    if (!subscriber) {
      return json(
        {
          success: false,
          message:
            'Ative primeiro as notificações neste dispositivo.'
        },
        404
      )
    }

    subscriber.snoozeUntil =
      Date.now() +
      SNOOZE_DURATION_MS

    subscriber.updatedAt =
      Date.now()

    await this.save()

    return json(
      await this.buildStatus(
        endpoint
      )
    )
  }

  private async handleResume(
    body: JsonBody
  ) {
    const {
      endpoint,
      subscriber
    } =
      await this.getSubscriberFromBody(
        body
      )

    if (!subscriber) {
      return json(
        {
          success: false,
          message:
            'A subscrição deste dispositivo não foi encontrada.'
        },
        404
      )
    }

    subscriber.snoozeUntil =
      null

    subscriber.updatedAt =
      Date.now()

    await this.save()

    return json(
      await this.buildStatus(
        endpoint
      )
    )
  }

  private async handleTest(
    body: JsonBody
  ) {
    const {
      state,
      endpoint,
      id,
      subscriber
    } =
      await this.getSubscriberFromBody(
        body
      )

    if (!subscriber) {
      return json(
        {
          success: false,
          message:
            'Ative primeiro as notificações neste dispositivo.'
        },
        404
      )
    }

    const result =
      await sendPushNotification(
        state,
        subscriber,
        {
          title:
            '✅ MA-BTC ALERTAS ativo',
          body:
            'As notificações estão prontas.\n\nBTC/USD · Alertas ±1%\nWWW.MA-CODE.PT'
        }
      )

    if (result.remove) {
      delete state.subscribers[
        id
      ]

      await this.save()

      return json(
        {
          success: false,
          message:
            'A subscrição deixou de ser válida. Volte a ativar as notificações.'
        },
        410
      )
    }

    if (!result.delivered) {
      return json(
        {
          success: false,
          message:
            result.message ||
            'A notificação de teste falhou.'
        },
        502
      )
    }

    return json(
      await this.buildStatus(
        endpoint
      )
    )
  }

  private async runScheduledCheck() {
    const state =
      await this.getState()

    if (state.pendingAlert) {
      await this
        .processPendingAlertBatch()

      return
    }

    const now =
      Date.now()

    for (
      const [
        id,
        subscriber
      ] of Object.entries(
        state.subscribers
      )
    ) {
      if (
        isExpiredSubscription(
          subscriber,
          now
        )
      ) {
        delete state.subscribers[
          id
        ]
      }
    }

    if (
      Object.keys(
        state.subscribers
      ).length === 0 ||
      !isActiveHour(
        new Date(now)
      )
    ) {
      await this.save()
      return
    }

    try {
      const price =
        await fetchBtcUsdPrice()

      state.currentPrice =
        price

      state.lastCheckedAt =
        now

      state.lastError =
        null

      if (
        state.referencePrice ===
        null
      ) {
        state.referencePrice =
          price

        await this.save()
        return
      }

      const changePercent =
        getChangePercent(
          price,
          state.referencePrice
        )

      if (
        changePercent === null ||
        Math.abs(
          changePercent
        ) <
          ALERT_THRESHOLD_PERCENT
      ) {
        await this.save()
        return
      }

      const referencePrice =
        state.referencePrice

      const direction =
        changePercent > 0
          ? 'up'
          : 'down'

      const directionText =
        direction === 'up'
          ? 'subiu'
          : 'desceu'

      const icon =
        direction === 'up'
          ? '🚨'
          : '🔻'

      const title =
        `${icon} Bitcoin ${directionText} ${formatPercent(
          changePercent
        )}%`

      const body = [
        `Preço atual: ${formatUsd(
          price
        )}`,
        `Preço de referência: ${formatUsd(
          referencePrice
        )}`,
        '',
        'MA BTC ALERTAS',
        'WWW.MA-CODE.PT'
      ].join('\n')

      const subscriberIds =
        Object.entries(
          state.subscribers
        )
          .filter(
            (
              [
                ,
                subscriber
              ]
            ) =>
              !isSnoozedSubscriber(
                subscriber,
                now
              )
          )
          .map(
            (
              [
                id
              ]
            ) =>
              id
          )

      const pendingAlert:
        PendingAlertDelivery = {
        subscriberIds,
        nextIndex: 0,
        title,
        body,
        price,
        direction,
        changePercent,
        triggeredAt:
          now,
        failedDeliveries:
          0
      }

      if (
        subscriberIds.length ===
        0
      ) {
        this.completePendingAlert(
          state,
          pendingAlert
        )

        await this.save()

        return
      }

      state.pendingAlert =
        pendingAlert

      await this.save()

      await this
        .processPendingAlertBatch()
    } catch (error) {
      state.lastCheckedAt =
        now

      state.lastError =
        errorMessage(
          error,
          'Não foi possível obter o preço BTC/USD.'
        )

      await this.save()
    }
  }
}
