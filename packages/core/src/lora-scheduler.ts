// What to send over LoRa, and when (ARCHITECTURE.md §4.2–4.3, protocol §3.8).
//
// LoRa is slow and EU law allows a transmitter at most 10 % airtime in the 869.4–869.65 MHz
// sub-band. The scheduler queues events, sends the most urgent first, keeps a rolling one-hour
// airtime budget, thins positions, repeats an own SOS until someone acknowledges it, and applies
// the bridging rules to events that came from the server. It is pure: time and randomness are
// passed in, and the caller does the sending: it takes one packet with `next`, then reports
// `sent` or `retry`.

import {
  eventRefKey,
  type EventHeader,
  type LatLon,
  type NodeId,
  type TeselEvent,
} from '@tesel/protocol';

import { eventAirtimeMs } from './airtime.ts';
import { distanceMeters } from './geo.ts';
import { URGENCY, urgencyOf } from './urgency.ts';

/** Where an event came from: this device, or the server (this device is bridging it). */
export type LoraSource = 'own' | 'bridged';

/**
 * An event of a type this version does not know: only its header can be read. Bridges still
 * carry it, de-duplicated by the header (protocol §3.1).
 */
export interface OpaqueEvent extends EventHeader {
  readonly type: null;
}

export type LoraEvent = TeselEvent | OpaqueEvent;

export interface LoraPacket {
  readonly event: LoraEvent;
  readonly bytes: Uint8Array;
}

const MINUTE = 60_000;

export const LIMITS = {
  /** The duty-cycle window. */
  windowMs: 60 * MINUTE,
  /** Tesel uses half the legal 10 %, leaving room for repeaters and other traffic... */
  normalBudgetMs: 0.05 * 60 * MINUTE,
  /** ...except for the most urgent events, which may use all of it. */
  urgentBudgetMs: 0.1 * 60 * MINUTE,
  /** Own positions: at most one every 2 minutes, and only after moving 50 m or 10 minutes. */
  ownPositionMinMs: 2 * MINUTE,
  ownPositionMinMeters: 50,
  ownPositionMaxMs: 10 * MINUTE,
  /** Positions from the server: at most one every 5 minutes per member. */
  bridgedPositionMs: 5 * MINUTE,
  /** Events from the server older than this are history, not news: they are not bridged. */
  bridgeMaxAgeMs: 10 * MINUTE,
  /** Bridged events wait up to this long, so several bridges do not all repeat them. */
  bridgeDelayMs: 10_000,
  /** An ACK over LoRa waits 2–30 s and is dropped if another member's ACK is heard first. */
  ackDelayMinMs: 2_000,
  ackDelayMaxMs: 30_000,
  /** Own SOS repeats: first after 30 s, doubling up to 5 minutes, this many after the first send. */
  sosFirstRepeatMs: 30_000,
  sosMaxRepeatMs: 5 * MINUTE,
  sosMaxRepeats: 12,
  /** A send the radio refused is retried after this long. */
  retryMs: 10_000,
} as const;

/** Events urgent enough to use the full legal budget. */
const URGENT = URGENCY.alert;

interface Pending {
  readonly key: string;
  readonly packet: LoraPacket;
  readonly source: LoraSource;
  readonly dueAt: number;
  /** For an own SOS: how many times it has been sent. */
  readonly sends: number;
}

export class LoraScheduler {
  readonly #random: () => number;
  readonly #airtimeMs: (bytes: number) => number;
  readonly #pending = new Map<string, Pending>();
  /** Event keys sent by us or heard on LoRa, with when: never put on the air again. */
  readonly #onAir = new Map<string, number>();
  /** Own SOS calls still waiting for an acknowledgement or a cancellation. */
  readonly #openSos = new Set<string>();
  readonly #spent: { readonly at: number; readonly ms: number }[] = [];
  #lastOwnPosition: { readonly at: LatLon; readonly time: number } | null = null;
  readonly #lastBridgedPosition = new Map<NodeId, number>();
  /** The packet handed out by `next`, until the caller reports how sending it went. */
  #inFlight: { readonly pending: Pending; readonly cost: number } | null = null;

  constructor(options: { random: () => number; airtimeMs?: (bytes: number) => number }) {
    this.#random = options.random;
    this.#airtimeMs = options.airtimeMs ?? eventAirtimeMs;
  }

  /** Queues an event for LoRa. Repeated offers of the same event change nothing. */
  offer(packet: LoraPacket, source: LoraSource, now: number): void {
    const { event } = packet;
    const key = eventRefKey(event);
    this.observe(event);
    if (this.#onAir.has(key) || this.#pending.has(key)) return;
    if (source === 'bridged' && now - event.time * 1000 > LIMITS.bridgeMaxAgeMs) return;
    if (event.type === 'position' || event.type === 'position-hidden') {
      // Only the newest position of a member is worth sending, and none once it is hidden.
      for (const [otherKey, other] of this.#pending) {
        if (other.packet.event.type === 'position' && other.packet.event.origin === event.origin) {
          this.#pending.delete(otherKey);
        }
      }
    }
    if (event.type === 'sos' && source === 'own') this.#openSos.add(key);
    this.#pending.set(key, {
      key,
      packet,
      source,
      dueAt: now + this.#delay(event, source),
      sends: 0,
    });
  }

  /** An event arrived over LoRa: it is on the air already, so it is not sent again. */
  heard(event: LoraEvent, now: number): void {
    const key = eventRefKey(event);
    this.#onAir.set(key, now);
    this.#pending.delete(key);
    this.observe(event);
    if (event.type === 'ack') {
      // Another member acknowledged: our own ACK for the same event would only add noise.
      const target = eventRefKey(event.target);
      for (const [pendingKey, pending] of this.#pending) {
        const queued = pending.packet.event;
        if (queued.type === 'ack' && eventRefKey(queued.target) === target) {
          this.#pending.delete(pendingKey);
        }
      }
    }
  }

  /** An event arrived over any transport: acknowledgements and cancellations end SOS repeats. */
  observe(event: LoraEvent): void {
    if (event.type === 'ack') this.#closeSos(eventRefKey(event.target));
    if (event.type === 'sos-cancel') this.#closeSos(eventRefKey(event.sos));
  }

  /**
   * Forgets the traffic of the group the radio carried until now, when it changes to another
   * group's channel: nothing queued for one group may go out on another's. The airtime spent
   * stays, since the budget belongs to the radio.
   */
  changeGroup(): void {
    this.#pending.clear();
    this.#onAir.clear();
    this.#openSos.clear();
    this.#lastOwnPosition = null;
    this.#lastBridgedPosition.clear();
    this.#inFlight = null;
  }

  /**
   * The next packet to send now, if any fits the airtime budget. One packet at a time: the
   * caller reports `sent` or `retry` before asking again.
   */
  next(now: number): LoraPacket | null {
    if (this.#inFlight !== null) return null;
    this.#forgetBefore(now - LIMITS.windowMs);
    const due = [...this.#pending.values()]
      .filter((pending) => pending.dueAt <= now && this.#eligible(pending, now))
      .sort(
        (a, b) =>
          urgencyOf(a.packet.event.type) - urgencyOf(b.packet.event.type) || a.dueAt - b.dueAt,
      );
    const spent = this.#spent.reduce((total, entry) => total + entry.ms, 0);
    for (const pending of due) {
      const cost = this.#airtimeMs(pending.packet.bytes.length);
      const budget =
        urgencyOf(pending.packet.event.type) <= URGENT
          ? LIMITS.urgentBudgetMs
          : LIMITS.normalBudgetMs;
      if (spent + cost > budget) continue;
      this.#pending.delete(pending.key);
      this.#inFlight = { pending, cost };
      return pending.packet;
    }
    return null;
  }

  /** The packet from `next` went on the air. */
  sent(now: number): void {
    const inFlight = this.#inFlight;
    if (inFlight === null) return;
    this.#inFlight = null;
    this.#markSent(inFlight.pending, inFlight.cost, now);
  }

  /** The radio refused the packet from `next`: try it again a little later. */
  retry(now: number): void {
    const inFlight = this.#inFlight;
    if (inFlight === null) return;
    this.#inFlight = null;
    const { pending } = inFlight;
    // Heard from someone else meanwhile, or superseded by a newer position: let it go.
    if (this.#onAir.has(pending.key) || this.#pending.has(pending.key)) return;
    this.#pending.set(pending.key, { ...pending, dueAt: now + LIMITS.retryMs });
  }

  /** Airtime used in the current window, in milliseconds. */
  spentMs(now: number): number {
    this.#forgetBefore(now - LIMITS.windowMs);
    return this.#spent.reduce((total, entry) => total + entry.ms, 0);
  }

  #delay(event: LoraEvent, source: LoraSource): number {
    if (source === 'bridged') return this.#random() * LIMITS.bridgeDelayMs;
    if (event.type === 'ack') {
      return LIMITS.ackDelayMinMs + this.#random() * (LIMITS.ackDelayMaxMs - LIMITS.ackDelayMinMs);
    }
    return 0;
  }

  #eligible(pending: Pending, now: number): boolean {
    const { event } = pending.packet;
    if (event.type !== 'position') return true;
    if (pending.source === 'bridged') {
      const last = this.#lastBridgedPosition.get(event.origin);
      return last === undefined || now - last >= LIMITS.bridgedPositionMs;
    }
    const last = this.#lastOwnPosition;
    if (last === null) return true;
    const elapsed = now - last.time;
    if (elapsed < LIMITS.ownPositionMinMs) return false;
    return (
      elapsed >= LIMITS.ownPositionMaxMs ||
      distanceMeters(last.at, event) >= LIMITS.ownPositionMinMeters
    );
  }

  #markSent(pending: Pending, cost: number, now: number): void {
    const { event } = pending.packet;
    this.#spent.push({ at: now, ms: cost });
    this.#onAir.set(pending.key, now);
    if (event.type === 'position') {
      if (pending.source === 'own') this.#lastOwnPosition = { at: event, time: now };
      else this.#lastBridgedPosition.set(event.origin, now);
    }
    const sends = pending.sends + 1;
    if (this.#openSos.has(pending.key) && sends <= LIMITS.sosMaxRepeats) {
      // Repeats are byte-identical, so receivers de-duplicate them (protocol §3.8).
      const wait = Math.min(LIMITS.sosFirstRepeatMs * 2 ** (sends - 1), LIMITS.sosMaxRepeatMs);
      this.#pending.set(pending.key, { ...pending, dueAt: now + wait, sends });
    }
  }

  #closeSos(key: string): void {
    if (!this.#openSos.delete(key)) return;
    const pending = this.#pending.get(key);
    if (pending !== undefined && pending.sends > 0) this.#pending.delete(key);
  }

  #forgetBefore(time: number): void {
    while (this.#spent[0] !== undefined && this.#spent[0].at < time) this.#spent.shift();
    for (const [key, at] of this.#onAir) if (at < time) this.#onAir.delete(key);
  }
}
