// One simulated member of a practice: who they are on the group, what they tell about themselves
// (their persona: profile, equipment, a phone that runs down), what they are doing and where they
// are (walker.ts). Someone at the control room is a member too, who talks and is never on the
// ground. Whoever calls an SOS is hurt and stays where they are until it is over.

import { distanceMeters } from '@tesel/core';
import type {
  DutyStatus,
  Equipment,
  EventHeader,
  Identity,
  LatLon,
  NodeId,
  Profile,
} from '@tesel/protocol';
import type { Actor, ScenarioMember } from '@tesel/scenario';

import { Walker } from './walker.ts';

/** What a member tells about themselves, and how they wear out. */
export interface Persona {
  readonly profile: Profile;
  readonly equipment: readonly Equipment[];
  /** Percent of battery at the start. */
  readonly battery: number;
  /** Percent of battery the phone loses each minute. */
  readonly drain: number;
  /** Minutes on foot after which they ask for a break; they never do without. */
  readonly tires?: number;
}

/**
 * What a teammate is doing: a task, by its key; helping whoever called an SOS, by its key; or
 * something the situation has them do (taking someone found to safety, getting away from a fire),
 * which it names.
 */
export type Job =
  | { readonly kind: 'task'; readonly task: string }
  | { readonly kind: 'help'; readonly sos: string }
  | { readonly kind: 'scene'; readonly what: string };

/** At or under this, a phone saves its battery: positions now and then. */
const LOW_BATTERY = 15;
/** At or under this, a phone is as good as off: nothing more is heard of its owner. */
const FLAT_BATTERY = 3;

export class Teammate {
  readonly alias: string;
  readonly node: NodeId;
  /** The teammate coordinates the group (the user is then a member). */
  readonly coordinates: boolean;
  /** At the control room, not on the ground: they talk, and never walk or take a task. */
  readonly remote: boolean;
  readonly walker: Walker;
  readonly persona: Persona | null;
  readonly #identity: Identity;
  #seq = 0;
  #job: Job | null = null;
  /** The task left to help someone, to go back to once that is over. */
  #resume: string | null = null;
  /** The SOS the teammate called, by its key, while they are hurt. */
  #sos: string | null = null;
  #battery: number;
  #status: DutyStatus = 'active';
  /** When the teammate was last given something to do, or the run started; null while busy. */
  #idleSince: number | null = 0;

  constructor(member: ScenarioMember, identity: Identity, persona: Persona | null) {
    const start = member.route?.[0];
    if (start === undefined) throw new Error(`${member.alias} has nowhere to be`);
    this.alias = member.alias;
    this.node = identity.nodeId;
    this.coordinates = member.role === 'coordinator';
    this.remote = member.hidden === true;
    this.walker = new Walker(start, member.speed);
    this.persona = persona;
    this.#identity = identity;
    this.#battery = persona?.battery ?? 100;
  }

  get actor(): Actor {
    return { alias: this.alias, publicKey: this.#identity.publicKey };
  }

  get job(): Job | null {
    return this.#job;
  }

  /** The task to go back to, now that helping is over. */
  get resume(): string | null {
    return this.#resume;
  }

  /** The SOS the teammate called, by its key, while they are hurt; null when they are well. */
  get sos(): string | null {
    return this.#sos;
  }

  get hurt(): boolean {
    return this.#sos !== null;
  }

  /** On the ground and able to do something: not at the control room, not hurt. */
  get onFoot(): boolean {
    return !this.remote && !this.hurt;
  }

  /** Free to take something on: on foot, not resting, and doing nothing else. */
  get free(): boolean {
    return this.onFoot && this.#status === 'active' && this.#job === null;
  }

  /** Whether the teammate is on a task, by its key: doing it, or meaning to go back to it. */
  isOn(task: string): boolean {
    return (this.#job?.kind === 'task' && this.#job.task === task) || this.#resume === task;
  }

  /** Since when, in milliseconds, the teammate has had nothing to do; null while busy. */
  get idleSince(): number | null {
    return this.#job === null ? this.#idleSince : null;
  }

  get battery(): number {
    return Math.max(0, Math.round(this.#battery));
  }

  /** The phone is saving its battery: positions now and then. */
  get saving(): boolean {
    return this.#battery <= LOW_BATTERY;
  }

  /** The phone is flat: nothing more is heard of its owner. */
  get silent(): boolean {
    return this.#battery <= FLAT_BATTERY;
  }

  get status(): DutyStatus {
    return this.#status;
  }

  /** The phone runs down by `minutes` of use. */
  drain(minutes: number): void {
    this.#battery -= (this.persona?.drain ?? 0) * minutes;
  }

  rest(status: DutyStatus): void {
    this.#status = status;
  }

  /** The header of the teammate's next event. */
  nextHeader(): EventHeader {
    this.#seq += 1;
    return { origin: this.node, seq: this.#seq, time: Math.floor(Date.now() / 1000) };
  }

  /**
   * Sets off at `now` along `way` for a job, at their pace or `speed`; going to help someone
   * leaves a task to go back to. Returns when the teammate arrives, in milliseconds.
   */
  go(job: Job, way: readonly LatLon[], now: number, speed?: number): number {
    if (job.kind !== 'task' && this.#job?.kind === 'task') this.#resume = this.#job.task;
    if (job.kind === 'task') this.#resume = null;
    this.#job = job;
    return this.walker.go(way, now, speed);
  }

  /** The job is over, and with it any task left for it: the teammate stops where they are. */
  stop(now: number): void {
    this.#job = null;
    this.#resume = null;
    this.#idleSince = now;
    this.walker.stop(now);
  }

  /** The teammate has called an SOS, by its key: they stop and do nothing more until it is over. */
  injure(sos: string, now: number): void {
    this.#sos = sos;
    this.stop(now);
  }

  /** The teammate's SOS is over: they are well again, and free. */
  recover(now: number): void {
    this.#sos = null;
    this.#idleSince = now;
  }

  at(now: number): LatLon {
    return this.walker.at(now);
  }

  distanceTo(at: LatLon, now: number): number {
    return distanceMeters(this.walker.at(now), at);
  }

  has(item: Equipment): boolean {
    return this.persona?.equipment.includes(item) === true;
  }
}
