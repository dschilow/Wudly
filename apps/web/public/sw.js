/* Wudly service worker - Web Push only (no offline caching for now). */

function normalizeNotificationUrl(value) {
  const raw = typeof value === 'string' && value.length > 0 ? value : '/';
  try {
    const url = new URL(raw, self.location.origin);
    if (url.origin !== self.location.origin) return '/';

    const productQuestion = url.pathname.match(/^\/products\/([^/]+)\/questions\/([^/]+)$/);
    if (productQuestion) {
      return `/me/inbox?product=${encodeURIComponent(productQuestion[1])}&question=${encodeURIComponent(productQuestion[2])}`;
    }

    const question = url.pathname.match(/^\/questions\/([^/]+)$/);
    if (question) return `/me/inbox?question=${encodeURIComponent(question[1])}`;

    return `${url.pathname}${url.search}${url.hash}`;
  } catch (e) {
    return '/';
  }
}

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {};
  }
  const title = data.title || 'Wudly';
  const url = normalizeNotificationUrl(data.url);
  const options = {
    body: data.body || '',
    // PNG, not SVG: Chrome/Android won't render an SVG notification icon.
    icon: '/manifest-icon-192.png',
    badge: '/manifest-icon-192.png',
    // Unique tag per target so distinct questions don't silently collapse.
    tag: 'wudly-' + url,
    renotify: true,
    data: { url },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = normalizeNotificationUrl(event.notification.data && event.notification.data.url);
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
