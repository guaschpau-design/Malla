// One simulated teammate of a practice: who they are on the group, what they are doing (a task, or
// going to whoever called an SOS) and where they are (walker.ts). Whoever calls an SOS is hurt and
// stays where they are until it is over.

import { distanceMeters } from '@tesel/core';
import type { EventHeader, Identity, LatLon, NodeId } from '@tesel/protocol';
import type { Actor, ScenarioMember } from '@tesel/scenario';

import { Walker } from './walker.ts';

/** What a teammate is doing: a task, by its key, or helping whoever called an SOS, by its key. */
export type Job =
  | { readonly kind: 'task'; readonly task: string }
  | { readonly kind: 'help'; readonly sos: string };

export class Teammate {
  readonly alias: string;
  readonly node: NodeId;
  /** The teammate coordinates the group (the user is then a member). */
  readonly coordinates: boolean;
  readonly walker: Walker;
  readonly #identity: Identity;
  #seq = 0;
  #job: Job | null = null;
  /** The task left to help someone, to go back to once that is over. */
  #resume: string | null = null;
  /** The SOS the teammate called, by its key, while they are hurt. */
  #sos: string | null = null;

  constructor(member: ScenarioMember, identity: Identity) {
    const start = member.route?.[0];
    if (start === undefined) throw new Error(`${member.alias} has nowhere to be`);
    this.alias = member.alias;
    this.node = identity.nodeId;
    this.coordinates = member.role === 'coordinator';
    this.walker = new Walker(start, member.speed);
    this.#identity = identity;
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

  /** Free to take a task: not hurt, and doing nothing else. */
  get free(): boolean {
    return !this.hurt && this.#job === null;
  }

  /** Whether the teammate is on a task, by its key: doing it, or meaning to go back to it. */
  isOn(task: string): boolean {
    return (this.#job?.kind === 'task' && this.#job.task === task) || this.#resume === task;
  }

  /** The header of the teammate's next event. */
  nextHeader(): EventHeader {
    this.#seq += 1;
    return { origin: this.node, seq: this.#seq, time: Math.floor(Date.now() / 1000) };
  }

  /**
   * Sets off at `now` along `way` for a job; going to help someone leaves a task to go back to.
   * Returns when the teammate arrives, in milliseconds.
   */
  go(job: Job, way: readonly LatLon[], now: number): number {
    if (job.kind === 'help' && this.#job?.kind === 'task') this.#resume = this.#job.task;
    if (job.kind === 'task') this.#resume = null;
    this.#job = job;
    return this.walker.go(way, now);
  }

  /** The job is over, and with it any task left for it: the teammate stops where they are. */
  rest(now: number): void {
    this.#job = null;
    this.#resume = null;
    this.walker.stop(now);
  }

  /** The teammate has called an SOS, by its key: they stop and do nothing more until it is over. */
  injure(sos: string, now: number): void {
    this.#sos = sos;
    this.rest(now);
  }

  /** The teammate's SOS is over: they are well again, and free. */
  recover(): void {
    this.#sos = null;
  }

  distanceTo(at: LatLon, now: number): number {
    return distanceMeters(this.walker.at(now), at);
  }
}
