import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  base64UrlToUint8Array,
  formatBtcAlertsDateTime,
  formatPercent,
  formatUsd,
  getBtcAlertsStatus,
  getExistingPushSubscription,
  isSnoozed,
  registerBtcAlertsServiceWorker,
  resumeBtcAlerts,
  sendBtcAlertsTest,
  snoozeBtcAlerts,
  subscribeToBtcAlerts,
  unsubscribeFromBtcAlerts,
  type BtcAlertsStatus,
} from '../lib/maBtcAlerts'

const siteUrl = 'https://ma-code.pt'
const productPath = '/produtos/ma-btc-alertas'

type BusyAction =
  | 'activate'
  | 'deactivate'
  | 'snooze'
  | 'resume'
  | 'test'
  | 'refresh'
  | 'install'
  | null

type Notice = {
  message: string
  error?: boolean
} | null

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
}

const buttonBase =
  'inline-flex min-h-11 items-center justify-center rounded-2xl border px-4 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50'

function updateMeta(name: string, content: string) {
  let meta = document.querySelector<HTMLMetaElement>(
    `meta[name="${name}"]`,
  )

  if (!meta) {
    meta = document.createElement('meta')
    meta.name = name
    document.head.appendChild(meta)
  }

  meta.content = content
}

function updatePropertyMeta(property: string, content: string) {
  let meta = document.querySelector<HTMLMetaElement>(
    `meta[property="${property}"]`,
  )

  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('property', property)
    document.head.appendChild(meta)
  }

  meta.content = content
}

function updateCanonical(href: string) {
  let link = document.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]',
  )

  if (!link) {
    link = document.createElement('link')
    link.rel = 'canonical'
    document.head.appendChild(link)
  }

  link.href = href
}

function updateManifest(href: string) {
  let link = document.querySelector<HTMLLinkElement>(
    'link[rel="manifest"]',
  )

  if (!link) {
    link = document.createElement('link')
    link.rel = 'manifest'
    document.head.appendChild(link)
  }

  link.href = href
}

function getPermission(): NotificationPermission | 'unsupported' {
  return 'Notification' in window
    ? Notification.permission
    : 'unsupported'
}

function isInstalledApp() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    Boolean(
      (navigator as Navigator & {
        standalone?: boolean
      }).standalone,
    )
  )
}

function StatusPill({
  active,
  children,
}: {
  active: boolean
  children: ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] ${
        active
          ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100'
          : 'border-white/10 bg-white/[0.05] text-slate-300'
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          active
            ? 'bg-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.9)]'
            : 'bg-slate-500'
        }`}
      />

      {children}
    </span>
  )
}

function MetricCard({
  label,
  value,
  description,
  valueClassName = 'text-white',
}: {
  label: string
  value: string
  description: string
  valueClassName?: string
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>

      <p
        className={`mt-3 text-2xl font-black tracking-tight ${valueClassName}`}
      >
        {value}
      </p>

      <p className="mt-2 text-sm leading-6 text-slate-400">
        {description}
      </p>
    </div>
  )
}

export default function MABtcAlertsPage() {
  const [status, setStatus] =
    useState<BtcAlertsStatus | null>(null)

  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] =
    useState<BusyAction>(null)

  const [notice, setNotice] = useState<Notice>(null)

  const [permission, setPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() => getPermission())

  const [installPrompt, setInstallPrompt] =
    useState<InstallPromptEvent | null>(null)

  const [installed, setInstalled] = useState(
    () => isInstalledApp(),
  )

  const pushSupported =
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window

  const refreshStatus = useCallback(
    async (showSuccess = false) => {
      const subscription =
        await getExistingPushSubscription()

      const nextStatus = await getBtcAlertsStatus(
        subscription?.endpoint || '',
      )

      setStatus(nextStatus)
      setPermission(getPermission())

      if (showSuccess) {
        setNotice({
          message: 'Estado atualizado.',
        })
      }

      return nextStatus
    },
    [],
  )

  useEffect(() => {
    document.title =
      'MA-BTC ALERTAS | Alertas Bitcoin em USD'

    updateMeta(
      'description',
      'Receba alertas do preço do Bitcoin em dólares quando o BTC/USD acumular uma subida ou descida de pelo menos 1%, com consultas horárias e snooze de 8 horas.',
    )

    updateMeta(
      'keywords',
      'MA-BTC ALERTAS, alertas Bitcoin, BTC USD, notificações Bitcoin, preço Bitcoin, alerta BTC, MA-Code',
    )

    updateMeta(
      'robots',
      'index, follow, max-image-preview:large',
    )

    updateMeta('theme-color', '#f7931a')

    updatePropertyMeta('og:type', 'website')
    updatePropertyMeta('og:locale', 'pt_PT')
    updatePropertyMeta('og:site_name', 'MA-Code')
    updatePropertyMeta(
      'og:url',
      `${siteUrl}${productPath}`,
    )

    updatePropertyMeta(
      'og:title',
      'MA-BTC ALERTAS | Alertas Bitcoin em USD',
    )

    updatePropertyMeta(
      'og:description',
      'Notificações BTC/USD quando o Bitcoin sobe ou desce pelo menos 1%. Consultas horárias entre as 07:00 e as 23:00, com snooze de 8 horas.',
    )

    updatePropertyMeta(
      'og:image',
      `${siteUrl}/ma-code.png`,
    )

    updateMeta('twitter:card', 'summary_large_image')

    updateMeta(
      'twitter:title',
      'MA-BTC ALERTAS | Alertas Bitcoin em USD',
    )

    updateMeta(
      'twitter:description',
      'Alertas BTC/USD de variações acumuladas de pelo menos 1%.',
    )

    updateMeta(
      'twitter:image',
      `${siteUrl}/ma-code.png`,
    )

    updateCanonical(`${siteUrl}${productPath}`)
    updateManifest('/ma-btc-alertas.webmanifest')

    const onInstallPrompt = (event: Event) => {
      event.preventDefault()

      setInstallPrompt(
        event as InstallPromptEvent,
      )
    }

    const onInstalled = () => {
      setInstalled(true)
      setInstallPrompt(null)

      setNotice({
        message:
          'MA-BTC ALERTAS instalada neste dispositivo.',
      })
    }

    window.addEventListener(
      'beforeinstallprompt',
      onInstallPrompt,
    )

    window.addEventListener(
      'appinstalled',
      onInstalled,
    )

    void refreshStatus()
      .catch((error) => {
        setNotice({
          message:
            error instanceof Error
              ? error.message
              : 'Não foi possível carregar o estado dos alertas.',
          error: true,
        })
      })
      .finally(() => setLoading(false))

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        onInstallPrompt,
      )

      window.removeEventListener(
        'appinstalled',
        onInstalled,
      )
    }
  }, [refreshStatus])

  useEffect(() => {
    if (!notice) {
      return
    }

    const timer = window.setTimeout(
      () => setNotice(null),
      4200,
    )

    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshStatus().catch(
          () => undefined,
        )
      }
    }

    document.addEventListener(
      'visibilitychange',
      onVisibilityChange,
    )

    return () =>
      document.removeEventListener(
        'visibilitychange',
        onVisibilityChange,
      )
  }, [refreshStatus])

  const subscriptionActive = Boolean(
    status?.subscription.active,
  )

  const snoozed = isSnoozed(status)

  const notificationsReady =
    subscriptionActive &&
    permission === 'granted'

  const changeClassName = useMemo(() => {
    const change = status?.changePercent

    if (
      change === null ||
      change === undefined ||
      change === 0
    ) {
      return 'text-white'
    }

    return change > 0
      ? 'text-emerald-300'
      : 'text-rose-300'
  }, [status?.changePercent])

  const runAction = async (
    action: Exclude<BusyAction, null>,
    operation: () => Promise<void>,
  ) => {
    setBusyAction(action)
    setNotice(null)

    try {
      await operation()
    } catch (error) {
      setNotice({
        message:
          error instanceof Error
            ? error.message
            : 'Não foi possível concluir esta operação.',
        error: true,
      })
    } finally {
      setBusyAction(null)
    }
  }

  const activateNotifications = () =>
    runAction('activate', async () => {
      if (!pushSupported) {
        throw new Error(
          'Este browser não suporta notificações push. Num iPhone ou iPad, instale primeiro a aplicação no ecrã principal.',
        )
      }

      const registration =
        await registerBtcAlertsServiceWorker()

      let nextPermission =
        Notification.permission

      if (nextPermission === 'default') {
        nextPermission =
          await Notification.requestPermission()
      }

      setPermission(nextPermission)

      if (nextPermission !== 'granted') {
        throw new Error(
          'As notificações não foram autorizadas. Ative-as nas definições do browser ou do dispositivo.',
        )
      }

      let subscription =
        await registration.pushManager.getSubscription()

      const currentStatus =
        status?.vapidPublicKey
          ? status
          : await getBtcAlertsStatus(
              subscription?.endpoint || '',
            )

      if (!currentStatus.vapidPublicKey) {
        throw new Error(
          'A chave de notificações ainda não está disponível. Atualize a página e tente novamente.',
        )
      }

      if (!subscription) {
        subscription =
          await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey:
              base64UrlToUint8Array(
                currentStatus.vapidPublicKey,
              ) as BufferSource,
          })
      }

      setStatus(
        await subscribeToBtcAlerts(
          subscription.toJSON(),
        ),
      )

      setNotice({
        message:
          'Alertas ativados. Receberá uma notificação quando a variação acumulada atingir ±1%.',
      })
    })

  const deactivateNotifications = () =>
    runAction('deactivate', async () => {
      const subscription =
        await getExistingPushSubscription()

      if (subscription) {
        await unsubscribeFromBtcAlerts(
          subscription.endpoint,
        )

        await subscription.unsubscribe()
      }

      setStatus(
        await getBtcAlertsStatus(''),
      )

      setNotice({
        message:
          'Alertas desativados neste dispositivo.',
      })
    })

  const snoozeNotifications = () =>
    runAction('snooze', async () => {
      const subscription =
        await getExistingPushSubscription()

      if (!subscription) {
        throw new Error(
          'Ative primeiro as notificações neste dispositivo.',
        )
      }

      setStatus(
        await snoozeBtcAlerts(
          subscription.endpoint,
        ),
      )

      setNotice({
        message:
          'Notificações silenciadas durante 8 horas.',
      })
    })

  const resumeNotifications = () =>
    runAction('resume', async () => {
      const subscription =
        await getExistingPushSubscription()

      if (!subscription) {
        throw new Error(
          'A subscrição deste dispositivo não foi encontrada.',
        )
      }

      setStatus(
        await resumeBtcAlerts(
          subscription.endpoint,
        ),
      )

      setNotice({
        message: 'Notificações retomadas.',
      })
    })

  const sendTestNotification = () =>
    runAction('test', async () => {
      const subscription =
        await getExistingPushSubscription()

      if (!subscription) {
        throw new Error(
          'Ative primeiro as notificações neste dispositivo.',
        )
      }

      setStatus(
        await sendBtcAlertsTest(
          subscription.endpoint,
        ),
      )

      setNotice({
        message:
          'Notificação de teste enviada.',
      })
    })

  const installApplication = () =>
    runAction('install', async () => {
      if (!installPrompt) {
        throw new Error(
          'Use “Adicionar ao ecrã principal” ou “Instalar aplicação” no menu do browser.',
        )
      }

      await installPrompt.prompt()

      const choice =
        await installPrompt.userChoice

      setInstallPrompt(null)

      setNotice({
        message:
          choice.outcome === 'accepted'
            ? 'Instalação iniciada.'
            : 'A instalação foi cancelada.',
      })
    })

  const metrics = [
    {
      label: 'Preço atual',
      value: loading
        ? 'A carregar…'
        : formatUsd(
            status?.currentPrice ?? null,
          ),
      description:
        'Bitcoin apresentado sempre em dólares americanos.',
      valueClassName: 'text-orange-200',
    },
    {
      label: 'Variação acumulada',
      value: loading
        ? 'A carregar…'
        : formatPercent(
            status?.changePercent ?? null,
          ),
      description:
        'Movimento desde o último preço de referência.',
      valueClassName: changeClassName,
    },
    {
      label: 'Preço de referência',
      value: loading
        ? 'A carregar…'
        : formatUsd(
            status?.referencePrice ?? null,
          ),
      description:
        'É atualizado depois de um alerta de ±1%.',
    },
    {
      label: 'Última consulta',
      value: loading
        ? 'A carregar…'
        : formatBtcAlertsDateTime(
            status?.lastCheckedAt ?? null,
          ),
      description:
        'O Worker consulta o preço uma vez por hora.',
    },
  ]

  return (
    <main className="site-shell min-h-screen">
      <div className="site-bg-orb site-bg-orb-one" />
      <div className="site-bg-orb site-bg-orb-two" />
      <div className="site-bg-orb site-bg-orb-three" />
      <div className="site-grid" />
      <div className="site-noise" />

      <section className="relative z-10 px-5 pb-20 pt-6 sm:px-6 md:px-10 md:pt-8">
        <div className="mx-auto max-w-7xl">
          <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
            <a
              href="/"
              className="brand-mark"
              aria-label="MA-Code.pt - Página inicial"
            >
              <img
                src="/ma-code.png"
                alt="MA-Code.pt"
                className="shrink-0 object-contain"
                loading="eager"
                decoding="async"
              />
            </a>

            <nav className="flex items-center gap-2 text-sm font-semibold">
              <a
                href="/produtos"
                className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-slate-300 transition hover:border-orange-300/30 hover:bg-orange-300/10 hover:text-white"
              >
                Produtos
              </a>

              <a
                href="/contacto?tipo=ma-btc-alertas"
                className="rounded-full border border-orange-300/30 bg-[#f7931a]/15 px-4 py-2.5 text-orange-100 transition hover:bg-[#f7931a]/25"
              >
                Contacto
              </a>
            </nav>
          </header>

          <div className="grid items-start gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="pt-4 lg:pt-10">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-orange-300/25 bg-[#f7931a]/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-orange-100">
                <span className="h-2 w-2 rounded-full bg-[#f7931a] shadow-[0_0_18px_rgba(247,147,26,0.9)]" />

                Produto MA-Code · Alertas Bitcoin
              </div>

              <div className="flex items-center gap-5">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[1.75rem] border border-orange-300/30 bg-[#f7931a]/15 text-5xl font-black text-orange-100 shadow-[0_24px_70px_rgba(247,147,26,0.18)] sm:h-24 sm:w-24 sm:text-6xl">
                  ₿
                </div>

                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">
                    MA-Code
                  </p>

                  <h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-5xl">
                    MA-BTC ALERTAS
                  </h1>
                </div>
              </div>

              <p className="mt-8 max-w-3xl text-xl font-semibold leading-9 text-slate-100 sm:text-2xl">
                Saiba quando o Bitcoin acumula uma
                subida ou descida de pelo menos{' '}
                <span className="text-orange-300">
                  1%
                </span>
                .
              </p>

              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
                O preço é acompanhado em dólares
                americanos. A consulta é feita uma vez
                por hora, entre as 07:00 e as 23:00 de
                Portugal, para reduzir pedidos
                desnecessários sem perder movimentos
                relevantes.
              </p>

              <div className="mt-7 flex flex-wrap gap-2">
                {[
                  'BTC/USD',
                  'Alertas acumulados ±1%',
                  'Consulta horária',
                  'Snooze 8 horas',
                  'Sem ligar carteira',
                ].map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-2 text-xs font-semibold text-slate-200"
                  >
                    {item}
                  </span>
                ))}
              </div>

              <div className="mt-9 flex flex-wrap gap-3">
                {!subscriptionActive ? (
                  <button
                    type="button"
                    onClick={
                      activateNotifications
                    }
                    disabled={
                      busyAction !== null ||
                      loading
                    }
                    className={`${buttonBase} min-h-12 border-orange-200/70 bg-[#f7931a] px-6 py-3 text-slate-950 shadow-[0_18px_45px_rgba(247,147,26,0.24)] hover:-translate-y-0.5 hover:bg-orange-300`}
                  >
                    {busyAction === 'activate'
                      ? 'A ativar…'
                      : 'Ativar notificações'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={
                      deactivateNotifications
                    }
                    disabled={
                      busyAction !== null
                    }
                    className={`${buttonBase} min-h-12 border-white/15 bg-white/[0.06] px-6 py-3 text-slate-100 hover:border-rose-300/35 hover:bg-rose-300/10`}
                  >
                    {busyAction === 'deactivate'
                      ? 'A desativar…'
                      : 'Desativar alertas'}
                  </button>
                )}

                {!installed ? (
                  <button
                    type="button"
                    onClick={
                      installApplication
                    }
                    disabled={
                      busyAction !== null
                    }
                    className={`${buttonBase} min-h-12 border-white/15 bg-white/[0.05] px-6 py-3 text-cyan-50 hover:-translate-y-0.5 hover:border-cyan-200/40 hover:bg-cyan-300/10`}
                  >
                    {busyAction === 'install'
                      ? 'A instalar…'
                      : installPrompt
                        ? 'Instalar aplicação'
                        : 'Como instalar'}
                  </button>
                ) : (
                  <StatusPill active>
                    Aplicação instalada
                  </StatusPill>
                )}
              </div>

              {!pushSupported ? (
                <p className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/[0.08] px-4 py-3 text-sm leading-6 text-amber-100">
                  Neste browser, as notificações push
                  não estão disponíveis. Em iPhone ou
                  iPad, adicione primeiro a aplicação
                  ao ecrã principal.
                </p>
              ) : null}
            </div>

            <aside className="rounded-[2rem] border border-orange-300/15 bg-slate-950/75 p-5 shadow-[0_30px_100px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-200">
                    Painel BTC/USD
                  </p>

                  <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
                    Estado dos alertas
                  </h2>
                </div>

                <StatusPill
                  active={Boolean(
                    status?.activeNow,
                  )}
                >
                  {status?.activeNow
                    ? 'Monitorização ativa'
                    : 'Fora do horário'}
                </StatusPill>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {metrics.map((metric) => (
                  <MetricCard
                    key={metric.label}
                    {...metric}
                  />
                ))}
              </div>

              <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-white">
                      Este dispositivo
                    </p>

                    <p className="mt-1 text-sm text-slate-400">
                      {notificationsReady
                        ? snoozed
                          ? `Em pausa até ${formatBtcAlertsDateTime(
                              status?.subscription
                                .snoozeUntil ??
                                null,
                            )}`
                          : 'Pronto para receber alertas.'
                        : permission === 'denied'
                          ? 'Notificações bloqueadas nas definições.'
                          : 'Notificações ainda não ativadas.'}
                    </p>
                  </div>

                  <StatusPill
                    active={
                      notificationsReady &&
                      !snoozed
                    }
                  >
                    {notificationsReady
                      ? snoozed
                        ? 'Snooze ativo'
                        : 'Alertas ativos'
                      : 'Inativo'}
                  </StatusPill>
                </div>

                {notificationsReady ? (
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={
                        snoozed
                          ? resumeNotifications
                          : snoozeNotifications
                      }
                      disabled={
                        busyAction !== null
                      }
                      className={`${buttonBase} ${
                        snoozed
                          ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100 hover:bg-emerald-300/15'
                          : 'border-amber-300/25 bg-amber-300/10 text-amber-100 hover:bg-amber-300/15'
                      }`}
                    >
                      {busyAction === 'resume'
                        ? 'A retomar…'
                        : busyAction ===
                            'snooze'
                          ? 'A silenciar…'
                          : snoozed
                            ? 'Retomar agora'
                            : 'Snooze por 8 horas'}
                    </button>

                    <button
                      type="button"
                      onClick={
                        sendTestNotification
                      }
                      disabled={
                        busyAction !== null
                      }
                      className={`${buttonBase} border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-100 hover:bg-cyan-300/15`}
                    >
                      {busyAction === 'test'
                        ? 'A enviar…'
                        : 'Enviar teste'}
                    </button>
                  </div>
                ) : null}
              </div>

              {status?.lastError ? (
                <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-300/[0.08] px-4 py-3 text-sm leading-6 text-rose-100">
                  Último erro:{' '}
                  {status.lastError}
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
                <span>
                  Limiar:{' '}
                  {status?.thresholdPercent ??
                    1}
                  % · 07:00–23:00 · Portugal
                </span>

                <button
                  type="button"
                  onClick={() =>
                    void runAction(
                      'refresh',
                      async () => {
                        await refreshStatus(
                          true,
                        )
                      },
                    )
                  }
                  disabled={
                    busyAction !== null
                  }
                  className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 font-semibold text-slate-200 transition hover:border-orange-300/30 hover:bg-orange-300/10 hover:text-white disabled:opacity-50"
                >
                  {busyAction === 'refresh'
                    ? 'A atualizar…'
                    : 'Atualizar estado'}
                </button>
              </div>
            </aside>
          </div>

          <section className="mt-20">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-200">
              Como funciona
            </p>

            <h2 className="mt-3 max-w-3xl text-3xl font-black tracking-tight text-white sm:text-4xl">
              Simples, silencioso e sem consultas
              excessivas.
            </h2>

            <div className="mt-9 grid gap-4 md:grid-cols-3">
              {[
                [
                  '01',
                  'Ative as notificações',
                  'Autorize apenas este dispositivo. Não precisa de conta nem de ligar qualquer carteira.',
                ],
                [
                  '02',
                  'Consulta uma vez por hora',
                  'Entre as 07:00 e as 23:00 de Portugal, o sistema consulta o BTC/USD de hora a hora.',
                ],
                [
                  '03',
                  'Receba movimentos relevantes',
                  'Quando a variação acumulada chega a ±1%, recebe um alerta e começa uma nova referência.',
                ],
              ].map(
                ([number, title, text]) => (
                  <article
                    key={number}
                    className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6"
                  >
                    <span className="text-sm font-black text-orange-300">
                      {number}
                    </span>

                    <h3 className="mt-4 text-xl font-bold text-white">
                      {title}
                    </h3>

                    <p className="mt-3 text-sm leading-7 text-slate-400">
                      {text}
                    </p>
                  </article>
                ),
              )}
            </div>
          </section>

          <section className="mt-12 rounded-[2rem] border border-orange-300/15 bg-[#f7931a]/[0.07] p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-200">
              Ao abrir uma notificação
            </p>

            <h2 className="mt-3 text-2xl font-black text-white">
              Regressa diretamente à MA-BTC
              ALERTAS.
            </h2>

            <p className="mt-4 max-w-4xl text-base leading-8 text-slate-300">
              A ligação direta a gráficos e páginas
              de preço será acrescentada quando essa
              integração estiver concluída. Até lá,
              tocar no alerta abre esta página com o
              estado mais recente disponível.
            </p>
          </section>

          <footer className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 py-8 text-sm text-slate-500">
            <p>
              Ferramenta informativa. Não constitui
              aconselhamento financeiro.
            </p>

            <p>
              © {new Date().getFullYear()} MA-Code.
            </p>
          </footer>
        </div>
      </section>

      {notice ? (
        <div
          className={`fixed bottom-5 left-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-2xl border px-5 py-4 text-sm font-semibold shadow-2xl backdrop-blur-xl ${
            notice.error
              ? 'border-rose-300/30 bg-rose-950/90 text-rose-100'
              : 'border-emerald-300/25 bg-slate-950/95 text-emerald-100'
          }`}
          role="status"
          aria-live="polite"
        >
          {notice.message}
        </div>
      ) : null}
    </main>
  )
}
