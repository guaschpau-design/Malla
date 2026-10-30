// How what the teammates send reaches the user's device (coverage.ts): through the network at
// once; late when the network is busy; by radio a packet at a time, positions only every couple of
// minutes, as the app's radio scheduler sends them; and, from someone cut off, not at all until
// they have coverage again, when everything they held goes out together.

import type { Channel } from '../links/heard.ts';

/** How a teammate reaches the group now: the network, a busy one, the radio, or not at all. */
export type Link = 'net' | 'busy' | 'radio' | 'cut';

/** A busy network delays each event by this many seconds, at least and at most. */
const BUSY_DELAY_S = [20, 60] as const;
/** Seconds between two packets of the same teammate on the radio. */
const RADIO_GAP_S = 4;

/** Where an event is handed over, by the channel it came by. */
export type Deliver = (bytes: Uint8Array, channel: Channel) => void;

interface Held {
  readonly bytes: Uint8Array;
  /** When it may go, in milliseconds; for a cut-off teammate, once they are not. */
  readonly due: number;
}

export class Airwaves {
  readonly #deliver: Deliver;
  readonly #random: () => number;
  /** What each teammate has waiting to go, in order, by alias. */
  readonly #waiting = new Map<string, Held[]>();
  /** When each teammate's radio may send its next packet, in milliseconds. */
  readonly #radioFree = new Map<string, number>();

  constructor(deliver: Deliver, random: () => number) {
    this.#deliver = deliver;
    this.#random = random;
  }

  /** A teammate sends an event over the link they have now. */
  send(alias: string, bytes: Uint8Array, link: Link, now: number): void {
    const queue = this.#waiting.get(alias) ?? [];
    if (link === 'net' && queue.length === 0) {
      this.#deliver(bytes, 'internet');
      return;
    }
    const [least, most] = BUSY_DELAY_S;
    const due = link === 'busy' ? now + (least + this.#random() * (most - least)) * 1000 : now;
    queue.push({ bytes, due });
    this.#waiting.set(alias, queue);
  }

  /** Lets go of what each teammate may now send, over the link each has now. */
  tick(linkOf: (alias: string) => Link, now: number): void {
    for (const [alias, queue] of this.#waiting) {
      const link = linkOf(alias);
      if (link === 'cut') continue;
      while (queue.length > 0) {
        const [next] = queue;
        if (next === undefined || next.due > now) break;
        if (link === 'radio') {
          if ((this.#radioFree.get(alias) ?? 0) > now) break;
          this.#radioFree.set(alias, now + RADIO_GAP_S * 1000);
        }
        queue.shift();
        this.#deliver(next.bytes, link === 'radio' ? 'radio' : 'internet');
      }
    }
  }

  /** Lets go of everything still waiting, as if the network were back: the exercise is over. */
  flush(): void {
    for (const queue of this.#waiting.values()) {
      for (const held of queue.splice(0)) this.#deliver(held.bytes, 'internet');
    }
  }
}
