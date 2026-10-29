// Calling for help (protocol §3.8), the same way whoever calls: the SOS dialog or the safety
// check-in. A call sent with no place is followed by this device's position as soon as the GPS
// has it.

import type { LatLon, SosKind } from '@tesel/protocol';

import { deviceLocation } from '../position/device-location.svelte.ts';
import type { GroupFeed } from '../sync/group-feed.svelte.ts';

/** Calls for help from `place`, or with no place if the device has none yet. */
export async function callForHelp(
  feed: GroupFeed,
  kind: SosKind,
  place: { readonly at: LatLon; readonly accuracy: number | null } | null,
  text: string,
): Promise<void> {
  await feed.sendSos(kind, place?.at ?? null, place?.accuracy ?? null, text);
  if (place === null) followWithPosition(feed);
}

/** Shares the device's first fix from now, which places a call sent without one. */
function followWithPosition(feed: GroupFeed): void {
  let shared = false;
  const release = deviceLocation.use((fix) => {
    if (shared) return;
    shared = true;
    // Called at once if a fix is already known, before `release` is assigned.
    queueMicrotask(() => {
      release();
    });
    feed.sharePosition(fix).catch((error: unknown) => {
      console.warn('The position after a call for help could not be shared', error);
    });
  });
}
