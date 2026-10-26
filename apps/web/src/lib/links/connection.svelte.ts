// What the browser knows of this device's own connection: whether it believes it is online, and
// whether through WiFi or mobile data. Only hints: "online" does not guarantee that our server is
// reachable, so transports must still handle failures, and the kind of network is known only where
// the browser tells it (Chrome on Android); elsewhere it is unknown.

import type { Network } from './links.ts';

/** The Network Information API, where the browser has it. */
interface NetworkInformation extends EventTarget {
  readonly type?: string;
  readonly effectiveType?: string;
}

function information(): NetworkInformation | undefined {
  return (navigator as Navigator & { connection?: NetworkInformation }).connection;
}

function currentNetwork(): Network {
  const info = information();
  return { type: info?.type, effectiveType: info?.effectiveType };
}

export const connection = $state({ online: navigator.onLine, network: currentNetwork() });

export function watchConnection(): () => void {
  const update = () => {
    connection.online = navigator.onLine;
    connection.network = currentNetwork();
  };
  const info = information();
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  info?.addEventListener('change', update);
  return () => {
    window.removeEventListener('online', update);
    window.removeEventListener('offline', update);
    info?.removeEventListener('change', update);
  };
}
