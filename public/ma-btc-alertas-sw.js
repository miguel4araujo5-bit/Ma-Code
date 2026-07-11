const APP_PATH =
  '/produtos/ma-btc-alertas'

const DEFAULT_ICON =
  '/ma-btc-alertas.svg'

self.addEventListener(
  'install',
  () => {
    self.skipWaiting()
  }
)

self.addEventListener(
  'activate',
  (event) => {
    event.waitUntil(
      self.clients.claim()
    )
  }
)

self.addEventListener(
  'push',
  (event) => {
    let payload = {}

    try {
      payload =
        event.data
          ? event.data.json()
          : {}
    } catch {
      payload = {
        title:
          'MA-BTC ALERTAS',
        body:
          event.data
            ? event.data.text()
            : 'Existe um novo alerta BTC/USD.'
      }
    }

    const title =
      payload.title ||
      'MA-BTC ALERTAS'

    const options = {
      body:
        payload.body ||
        'Existe um novo alerta BTC/USD.',
      icon:
        payload.icon ||
        DEFAULT_ICON,
      badge:
        payload.badge ||
        DEFAULT_ICON,
      tag:
        payload.tag ||
        'ma-btc-alertas-price',
      renotify: true,
      data: {
        url: APP_PATH
      }
    }

    event.waitUntil(
      self.registration.showNotification(
        title,
        options
      )
    )
  }
)

self.addEventListener(
  'notificationclick',
  (event) => {
    event.notification.close()

    event.waitUntil(
      self.clients
        .matchAll({
          type: 'window',
          includeUncontrolled: true
        })
        .then(
          async (
            windowClients
          ) => {
            for (
              const client of
              windowClients
            ) {
              const clientUrl =
                new URL(
                  client.url
                )

              if (
                clientUrl.pathname ===
                APP_PATH
              ) {
                return client.focus()
              }
            }

            for (
              const client of
              windowClients
            ) {
              if (
                'navigate' in
                client
              ) {
                await client.navigate(
                  APP_PATH
                )

                return client.focus()
              }
            }

            return self.clients.openWindow(
              APP_PATH
            )
          }
        )
    )
  }
)
