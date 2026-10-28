// A practice playing on this device: the simulated members of a scenario, each with an identity
// of its own, send their events into the practice group when their moment comes, and answer
// what the user does that calls for an answer: a roll call, an SOS. Nothing leaves the device.

import { openSosCalls, type GroupState } from '@tesel/core';
import {
  encodeEvent,
  eventRefKey,
  generateIdentity,
  type EventRef,
  type Identity,
  type NodeId,
} from '@tesel/protocol';
import {
  plan,
  ScenarioPerformer,
  type EventDraft,
  type PlannedEvent,
  type Scenario,
} from '@tesel/scenario';

/** Where the run hands each event, as if a member had sent it: the practice group's feed. */
export type PracticeSink = (bytes: Uint8Array) => Promise<void>;

/** Seconds between position reports of each simulated member. */
const POSITION_EVERY_S = 10;
/** The first answer to a roll call, and the time between one member's answer and the next. */
const ROLL_CALL_ANSWER_S = 4;
const ROLL_CALL_STAGGER_S = 3;
/** How long the first member takes to acknowledge the user's SOS. */
const SOS_ANSWER_S = 8;

export interface PracticeReplies {
  /** What the member who acknowledges an SOS says in the chat. */
  readonly onTheWay: string;
}

interface SimulatedMember {
  readonly alias: string;
  readonly identity: Identity;
  seq: number;
}

export class PracticeRun {
  readonly #plan: readonly PlannedEvent[];
  readonly #members: ReadonlyMap<string, SimulatedMember>;
  readonly #sink: PracticeSink;
  readonly #replies: PracticeReplies;
  readonly #performer = new ScenarioPerformer();
  /** Roll calls and SOS calls already answered, by event key. */
  readonly #answered = new Set<string>();
  readonly #timers = new Set<ReturnType<typeof setTimeout>>();
  #next = 0;
  #startMs = 0;
  #stopped = false;
  /** Planned events go out one batch after another, so later ones find the objects they name. */
  #sending: Promise<void> = Promise.resolve();

  constructor(scenario: Scenario, sink: PracticeSink, replies: PracticeReplies) {
    this.#plan = plan(scenario, { positionEvery: POSITION_EVERY_S });
    this.#members = new Map(
      scenario.members.map((member) => [
        member.alias,
        { alias: member.alias, identity: generateIdentity(), seq: 0 },
      ]),
    );
    this.#sink = sink;
    this.#replies = replies;
  }

  start(): void {
    this.#startMs = Date.now();
    this.#playDue();
  }

  /** Stops the run; events on their way are dropped, so none outlives the practice group. */
  stop(): void {
    this.#stopped = true;
    for (const timer of this.#timers) clearTimeout(timer);
    this.#timers.clear();
  }

  /** Answers what the user (`self`) has done that the members would answer. */
  react(state: GroupState, self: NodeId): void {
    const call = state.rollCall;
    if (call !== null && call.origin === self) {
      const key = eventRefKey(call);
      this.#once(key, () => {
        [...this.#members.values()].forEach((member, index) => {
          this.#after(ROLL_CALL_ANSWER_S + index * ROLL_CALL_STAGGER_S, async () => {
            await this.#send(member, (header) => ({ ...header, type: 'ack', target: call }));
          });
        });
      });
    }
    for (const [key, sos] of openSosCalls(state)) {
      if (sos.origin !== self) continue;
      const [first] = this.#members.values();
      if (first === undefined) return;
      this.#once(key, () => {
        this.#after(SOS_ANSWER_S, async () => {
          await this.#send(first, (header) => ({ ...header, type: 'ack', target: sos }));
          await this.#send(first, (header) => ({
            ...header,
            type: 'chat',
            text: this.#replies.onTheWay,
          }));
        });
      });
    }
  }

  /** Sends every planned event whose moment has come, then waits for the next one. */
  #playDue(): void {
    const elapsed = (Date.now() - this.#startMs) / 1000;
    const due: PlannedEvent[] = [];
    let event = this.#plan[this.#next];
    while (event !== undefined && event.at <= elapsed) {
      due.push(event);
      this.#next += 1;
      event = this.#plan[this.#next];
    }
    this.#sending = this.#sending.then(() => this.#sendInOrder(due));
    if (event !== undefined) {
      this.#after(event.at - elapsed, () => {
        this.#playDue();
      });
    }
  }

  async #sendInOrder(events: readonly PlannedEvent[]): Promise<void> {
    for (const event of events) {
      const member = this.#members.get(event.by);
      if (member === undefined) throw new Error(`no member ${event.by} in the scenario`);
      const actor = { alias: member.alias, publicKey: member.identity.publicKey };
      await this.#performer.perform(event, actor, (draft) => this.#send(member, draft));
    }
  }

  async #send(member: SimulatedMember, draft: EventDraft): Promise<EventRef> {
    member.seq += 1;
    const header = {
      origin: member.identity.nodeId,
      seq: member.seq,
      time: Math.floor(Date.now() / 1000),
    };
    const bytes = encodeEvent(draft(header));
    if (bytes.ok && !this.#stopped) await this.#sink(bytes.value);
    return { origin: header.origin, seq: header.seq };
  }

  #once(key: string, run: () => void): void {
    if (this.#answered.has(key)) return;
    this.#answered.add(key);
    run();
  }

  #after(seconds: number, run: () => void | Promise<void>): void {
    const timer = setTimeout(
      () => {
        this.#timers.delete(timer);
        void run();
      },
      Math.max(0, seconds * 1000),
    );
    this.#timers.add(timer);
  }
}
