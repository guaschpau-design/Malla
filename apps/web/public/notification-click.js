// Loaded into the service worker (vite.config.ts, workbox.importScripts): a tap on one of the
// app's alarm notifications (incidents/alarm.ts) brings the app to the front, opening it if it
// was closed.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const app = new URL('./', self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => client.url.startsWith(app));
      return open ? open.focus() : self.clients.openWindow(app);
    }),
  );
});
