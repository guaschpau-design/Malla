// How far this device's clock is from its group's server's (protocol §8.1): a wrong clock dates
// every event wrongly, so the user is told (device-clock.svelte.ts).

import { parseServerInfo, serverInfoUrl } from '@tesel/protocol';

import { deviceClock } from './device-clock.svelte.ts';

/** How long to wait for a server to describe itself. */
const INFO_TIMEOUT_MS = 4000;

/** Asks the server for its clock and compares it with this device's; an unreachable one says nothing. */
export async function checkServerClock(
  server: string,
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  try {
    const sentAt = Date.now();
    const response = await fetchFn(serverInfoUrl(server), {
      signal: AbortSignal.timeout(INFO_TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!response.ok) return;
    const info = parseServerInfo(await response.text());
    if (info?.time != null) deviceClock.observe(info.time, sentAt, Date.now());
  } catch {
    // No answer, no news: the next connection asks again.
  }
}
