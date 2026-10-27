// Where an SOS was called from (protocol §3.8). A sender without a position still calls for help
// at once: it sends 0, 0 with an unknown accuracy, which receivers read as "no place", and its
// position follows as soon as it has one.

import type { LatLon, SosEvent } from './events.ts';

/** The place an SOS carries when its sender has no position. */
export const NO_SOS_PLACE: LatLon & { readonly accuracy: null } = {
  lat: 0,
  lon: 0,
  accuracy: null,
};

/** Where an SOS was called from, or null if its sender had no position. */
export function sosPlace(event: Pick<SosEvent, 'lat' | 'lon' | 'accuracy'>): LatLon | null {
  return event.lat === 0 && event.lon === 0 && event.accuracy === null
    ? null
    : { lat: event.lat, lon: event.lon };
}
