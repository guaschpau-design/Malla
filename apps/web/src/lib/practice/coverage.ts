// Where the mobile network fails during an exercise (ADR-0076), and what it does to the teammates
// in that area. An outage is an area without coverage for a while, or with the network so busy
// that everything comes late. Inside an area without coverage, whoever carries a LoRa radio keeps
// in touch by radio; whoever does not is cut off: nothing of theirs goes out until coverage comes
// back, and they hear nothing new, unless a teammate with a radio is beside them to pass it on.
// The control room draws the area when it fails and says when coverage is back. What each
// teammate sends travels as their link allows (airwaves.ts), and so do their positions: every ten
// seconds through the network, every two minutes by radio, none while cut off.

import { offsetMeters } from '@tesel/core';
import { ShapeStyleCode, type LatLon } from '@tesel/protocol';

import { insideRing, toPosition } from '../map/geometry.ts';
import { Airwaves, type Deliver, type Link } from './airwaves.ts';
import { doersOf } from './errands.ts';
import type { Outage, Stage } from './exercise.ts';
import type { Teammate } from './teammate.ts';

/** Teammates this close to someone on the radio hear what it brings: they pass it on by voice. */
const BESIDE_M = 30;
/** Seconds between a teammate's positions: through the network, saving battery, by radio. */
const POSITION_EVERY_S = 10;
const POSITION_SAVING_S = 60;
const POSITION_RADIO_S = 120;

/** How the outages went, for the report. */
export interface CoverageTally {
  /** Teammates cut off at some point, and the longest any was, in seconds. */
  readonly cut: number;
  readonly longestS: number;
  /** The user's tasks given to teammates who could not hear them, and how long they waited. */
  readonly stranded: number;
  readonly strandedWaitS: number;
  /** The user's tasks given during an outage to teammates who heard them. */
  readonly reached: number;
}

export class Coverage {
  readonly #outages: readonly Outage[];
  readonly #room: string;
  readonly #airwaves: Airwaves;
  /** Seconds each teammate has spent cut off, by alias. */
  readonly #cutFor = new Map<string, number>();
  /** Each teammate's link at the last look, by alias. */
  readonly #links = new Map<string, Link>();
  /** The user's tasks none of whose doers heard them when given, by key. */
  readonly #stranded = new Map<string, { readonly since: number; waited: number | null }>();
  readonly #seenTasks = new Set<string>();
  #reached = 0;
  #last = 0;

  constructor(outages: readonly Outage[], room: string, deliver: Deliver, random: () => number) {
    this.#outages = outages;
    this.#room = room;
    this.#airwaves = new Airwaves(deliver, random);
  }

  /** A teammate sends an event, which goes as their link allows. */
  send(stage: Stage, who: Teammate, bytes: Uint8Array): void {
    this.#airwaves.send(who.alias, bytes, this.linkOf(who, stage.now, stage.elapsed), stage.now);
  }

  /** Everything still on its way arrives: the exercise is over. */
  flush(): void {
    this.#airwaves.flush();
  }

  /** Seconds between a teammate's positions now; null while nothing of theirs goes out. */
  positionEvery(stage: Stage, who: Teammate): number | null {
    const link = this.linkOf(who, stage.now, stage.elapsed);
    if (link === 'cut') return null;
    if (link === 'radio') return POSITION_RADIO_S;
    return who.saving ? POSITION_SAVING_S : POSITION_EVERY_S;
  }

  /** How a teammate reaches the group at `elapsed` seconds into the exercise. */
  linkOf(who: Teammate, now: number, elapsed: number): Link {
    if (who.remote) return 'net';
    const outage = this.#outageAt(who.at(now), elapsed);
    if (outage === null) return 'net';
    if (outage.kind === 'busy') return 'busy';
    return who.has('lora') ? 'radio' : 'cut';
  }

  /** Whether a teammate hears what the group says now: by network or radio, or beside a radio. */
  hears(stage: Stage, who: Teammate): boolean {
    if (this.linkOf(who, stage.now, stage.elapsed) !== 'cut') return true;
    return stage.crew.onTheGround.some(
      (other) =>
        other !== who &&
        this.linkOf(other, stage.now, stage.elapsed) === 'radio' &&
        other.distanceTo(who.at(stage.now), stage.now) <= BESIDE_M,
    );
  }

  /** How the outages went by `elapsed` seconds into the exercise. */
  tally(elapsed: number): CoverageTally {
    const waits = [...this.#stranded.values()].map((task) => task.waited ?? elapsed - task.since);
    return {
      cut: this.#cutFor.size,
      longestS: Math.max(0, ...this.#cutFor.values()),
      stranded: waits.length,
      strandedWaitS: waits.length === 0 ? 0 : waits.reduce((a, b) => a + b, 0) / waits.length,
      reached: this.#reached,
    };
  }

  tick(stage: Stage): void {
    const passed = stage.elapsed - this.#last;
    this.#last = stage.elapsed;
    this.#outages.forEach((outage, index) => {
      this.#announce(stage, outage, `outage-${String(index)}`);
    });
    for (const who of stage.crew.onTheGround) {
      const link = this.linkOf(who, stage.now, stage.elapsed);
      const before = this.#links.get(who.alias) ?? 'net';
      this.#links.set(who.alias, link);
      if (link === 'cut') this.#cutFor.set(who.alias, (this.#cutFor.get(who.alias) ?? 0) + passed);
      // They say so as people do, once: whoever goes on the radio, and whoever is back.
      if (who.silent || link === before) continue;
      if (link === 'radio' && stage.once(`on radio ${who.alias}`)) {
        stage.say(who.alias, stage.t('practiceOnRadio'));
      }
      if (link === 'net' && before === 'cut' && stage.once(`back online ${who.alias}`)) {
        stage.say(who.alias, stage.t('practiceBackOnline'));
      }
    }
    this.#follow(stage);
    this.#airwaves.tick((alias) => {
      const who = stage.crew.byAlias(alias);
      return who === undefined ? 'net' : this.linkOf(who, stage.now, stage.elapsed);
    }, stage.now);
  }

  /** The control room draws the area when it fails, and says when coverage is back. */
  #announce(stage: Stage, outage: Outage, id: string): void {
    const draw = (style: number, label: string) => {
      stage.act(this.#room, {
        type: 'shape',
        id,
        style,
        label,
        geometry: { kind: 'polygon', points: outage.area },
      });
    };
    if (stage.elapsed >= outage.from && stage.once(`${id} from`)) {
      const label = outage.kind === 'down' ? 'practiceNoCoverage' : 'practiceBusyNetwork';
      draw(ShapeStyleCode.NEUTRAL, stage.t(label));
      stage.say(this.#room, stage.t(outage.says));
    }
    if (stage.elapsed >= outage.to && stage.once(`${id} to`)) {
      draw(ShapeStyleCode.SAFE, stage.t('practiceCoverageBack'));
      stage.say(this.#room, stage.t('practiceCoverageBackChat'));
    }
  }

  /**
   * The user's tasks given during an outage: whether some doer heard them then, and, for those
   * none heard, how long until one did.
   */
  #follow(stage: Stage): void {
    const during = this.#outages.some(
      (outage) => stage.elapsed >= outage.from && stage.elapsed < outage.to,
    );
    const simulated = new Set(stage.crew.onTheGround.map((who) => who.node));
    for (const [key, task] of stage.state.tasks) {
      if (task.task.origin !== stage.user.node) continue;
      const doers = doersOf(task, stage.state.teams, simulated).flatMap(
        (node) => stage.crew.byNode(node) ?? [],
      );
      if (doers.length === 0) continue;
      const heard = doers.some((doer) => this.hears(stage, doer));
      const stranded = this.#stranded.get(key);
      if (stranded !== undefined) {
        if (stranded.waited === null && heard) stranded.waited = stage.elapsed - stranded.since;
        continue;
      }
      if (this.#seenTasks.has(key)) continue;
      this.#seenTasks.add(key);
      if (!during) continue;
      if (heard) this.#reached += 1;
      else this.#stranded.set(key, { since: stage.elapsed, waited: null });
    }
  }

  #outageAt(at: LatLon, elapsed: number): Outage | null {
    return (
      this.#outages.find(
        (outage) =>
          elapsed >= outage.from &&
          elapsed < outage.to &&
          insideRing(outage.area.map(toPosition), at),
      ) ?? null
    );
  }
}

/** A round area, as a polygon: what an outage round a mast or over a valley covers. */
export function roundArea(centre: LatLon, radius: number): LatLon[] {
  return Array.from({ length: 24 }, (_, index) => {
    const angle = (2 * Math.PI * index) / 24;
    return offsetMeters(centre, radius * Math.cos(angle), radius * Math.sin(angle));
  });
}
