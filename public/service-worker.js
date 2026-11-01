self.addEventListener('push', (event) => {
  let payload = {}

  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { body: event.data ? event.data.text() : '' }
  }

  const title =
    typeof payload.title === 'string' ? payload.title.slice(0, 160) : 'ResourceHub notification'
  const body = typeof payload.body === 'string' ? payload.body.slice(0, 1000) : ''
  const tag =
    typeof payload.id === 'string' ? `resourcehub-${payload.id.slice(0, 100)}` : 'resourcehub-notification'

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      data: { url: '/' },
      icon: '/apple-icon.png',
      badge: '/icon-light-32x32.png',
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL('/', self.location.origin)

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const windowClient of windows) {
        if (new URL(windowClient.url).origin === self.location.origin) {
          return windowClient.focus()
        }
      }

      return self.clients.openWindow(target.href)
    }),
  )
})
