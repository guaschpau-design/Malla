// Whether the browser believes it is online. Only a hint: "online" does not guarantee that our
// server is reachable, so transports must still handle failures.

export const connection = $state({ online: navigator.onLine });

export function watchConnection(): () => void {
  const update = () => {
    connection.online = navigator.onLine;
  };
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  return () => {
    window.removeEventListener('online', update);
    window.removeEventListener('offline', update);
  };
}
