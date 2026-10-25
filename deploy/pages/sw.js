// Replaces the service worker of the app that used to live here, so phones that installed it stop
// serving the old copy and follow the redirect to teselia.eu.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.registration.unregister();
      for (const client of await self.clients.matchAll({ type: 'window' }))
        client.navigate(client.url);
    })(),
  );
});
