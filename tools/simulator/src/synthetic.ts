// A long operation compressed into a list of events, for load tests: many members who announce
// themselves and then share their position at a steady interval. Too many for the relay's limits
// to accept at once, so tests hand them to the app through a relay of their own.

import { generateIdentity, type Identity, type TeselEvent } from '@tesel/protocol';

export interface SyntheticOptions {
  readonly members: number;
  /** Total number of events, announcements included. */
  readonly events: number;
  /** Seconds between positions of each member. */
  readonly positionEvery: number;
  /** Unix time of the first event. */
  readonly start: number;
  readonly center: { readonly lat: number; readonly lon: number };
}

export function syntheticOperation(options: SyntheticOptions): {
  readonly identities: readonly Identity[];
  readonly events: readonly TeselEvent[];
} {
  const identities = Array.from({ length: options.members }, () => generateIdentity());
  const events: TeselEvent[] = identities.map((identity, index) => ({
    type: 'member-info',
    origin: identity.nodeId,
    seq: 1,
    time: options.start,
    role: 'member',
    publicKey: identity.publicKey,
    alias: `Miembro ${String(index + 1)}`,
  }));
  for (let index = 0; events.length < options.events; index++) {
    const identity = identities[index % options.members];
    if (identity === undefined) throw new Error('no members');
    const round = Math.floor(index / options.members);
    events.push({
      type: 'position',
      origin: identity.nodeId,
      seq: 2 + round,
      time: options.start + options.positionEvery * round,
      // Spread over a few hundred metres around the centre.
      lat: options.center.lat + ((index * 37) % 97) / 10_000,
      lon: options.center.lon + ((index * 53) % 89) / 10_000,
      accuracy: 8,
      heading: null,
      speed: null,
    });
  }
  return { identities, events };
}
