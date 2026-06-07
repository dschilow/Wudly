/* Wudly service worker — Web Push only (no offline caching for now). */

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {};
  }
  const title = data.title || 'Wudly';
  const options = {
    body: data.body || '',
    // PNG, not SVG: Chrome/Android won't render an SVG notification icon.
    icon: '/manifest-icon-192.png',
    badge: '/manifest-icon-192.png',
    // Unique tag per target so distinct questions don't silently collapse.
    tag: 'wudly-' + (data.url || '/'),
    renotify: true,
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
