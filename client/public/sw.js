/* eslint-disable no-restricted-globals */
self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: data.icon || '/icon-192x192.png',
      badge: '/badge-72x72.png',
      vibrate: [100, 50, 100],
      data: {
        url: data.data?.url || '/'
      },
      actions: [
        { action: 'open', title: 'Ver Mensaje' }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );

    // Comunicar a los clientes abiertos
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'PUSH_NOTIFICATION',
          data: data
        });
      });
    });

    // Actualizar el Badge si es compatible
    if (navigator.setAppBadge && data.unreadCount !== undefined) {
      navigator.setAppBadge(data.unreadCount);
    }
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(event.notification.data.url);
      }
    })
  );
});
