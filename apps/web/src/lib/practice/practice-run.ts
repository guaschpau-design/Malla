// A practice playing on this device (ADR-0031, ADR-0066). The simulated teammates of a scenario,
// each with an identity of its own, send its steps into the practice group when their moment
// comes, and behave as people would about what happens in the group, whoever starts it: they
// report where they are as they walk, take the tasks given to them or their team, walk to them and
// along them, and say when they are done; they answer roll calls and alerts, go to whoever calls
// an SOS and stay until it is over, and answer what the user says and does. They keep to the
// streets of the map (@tesel/scenario's WalkNetwork). Nothing leaves the device.

import { EMPTY_STATE, openSosCalls, type GroupState } from '@tesel/core';
import {
  encodeEvent,
  eventRefKey,
  generateIdentity,
  ShapeStyleCode,
  type EventRef,
  type LatLon,
  type NodeId,
  type TaskEvent,
} from '@tesel/protocol';
import {
  onFoot,
  plan,
  ScenarioPerformer,
  YOU,
  type EventDraft,
  type PlannedEvent,
  type Scenario,
  type WalkNetwork,
} from '@tesel/scenario';

import type { Translate } from '../i18n/index.ts';
import { aliasOf } from '../members/alias.ts';
import { areasToClear } from '../objects/sweeps.ts';
import { doersOf, errandPoints, wayThrough } from './errands.ts';
import { Teammate } from './teammate.ts';

/** Where the run hands each event, as if a teammate had sent it: the practice group's feed. */
type PracticeSink = (bytes: Uint8Array) => Promise<void>;

export interface PracticeOptions {
  readonly sink: PracticeSink;
  /** The user's node ID, whom the scenario names `YOU`. */
  readonly self: NodeId;
  readonly t: Translate;
  /** The streets the teammates keep to; null where the map has none, and they walk straight. */
  readonly network: WalkNetwork | null;
}

/** Seconds between the position reports of each teammate. */
const POSITION_EVERY_S = 10;
/** The first answer to a roll call or an alert, and the time between one teammate's and the next. */
const ANSWER_S = 4;
const ANSWER_STAGGER_S = 3;
/** How long a teammate takes to answer the user's SOS. */
const SOS_ANSWER_S = 8;
/** How long a teammate takes to take a task given to them. */
const TAKE_TASK_S = 6;
/** How long a task at one place takes once there. */
const WORK_AT_PLACE_S = 45;
/** How long a teammate stays with whoever called an SOS before it is over. */
const STAY_WITH_S = 30;
/** How long a teammate takes to answer what the user says, and the least time between answers. */
const REPLY_S = 5;
const REPLY_GAP_S = 30;

export class PracticeRun {
  readonly #plan: readonly PlannedEvent[];
  readonly #teammates: ReadonlyMap<NodeId, Teammate>;
  readonly #byAlias: ReadonlyMap<string, Teammate>;
  /** Who answers what the user says: the coordinator if one is simulated, or the first teammate. */
  readonly #spokesperson: Teammate | undefined;
  readonly #options: PracticeOptions;
  readonly #performer: ScenarioPerformer;
  /** What has been seen to, by kind and event key, so that nothing is answered twice. */
  readonly #handled = new Set<string>();
  readonly #timers = new Set<ReturnType<typeof setTimeout>>();
  #state: GroupState = EMPTY_STATE;
  #next = 0;
  #startMs = 0;
  #lastReplyMs = -Infinity;
  #stopped = false;
  /** Planned events go out one batch after another, so later ones find what they name. */
  #sending: Promise<void> = Promise.resolve();

  constructor(scenario: Scenario, options: PracticeOptions) {
    const walked = options.network ? onFoot(scenario, options.network) : scenario;
    this.#plan = plan(walked, { positionEvery: null });
    const teammates = walked.members.map((member) => new Teammate(member, generateIdentity()));
    this.#teammates = new Map(teammates.map((teammate) => [teammate.node, teammate]));
    this.#byAlias = new Map(teammates.map((teammate) => [teammate.alias, teammate]));
    this.#spokesperson = teammates.find((teammate) => teammate.coordinates) ?? teammates[0];
    this.#options = options;
    this.#performer = new ScenarioPerformer((name) =>
      name === YOU ? options.self : this.#byAlias.get(name)?.node,
    );
  }

  start(): void {
    this.#startMs = Date.now();
    this.#playDue();
    this.#reportPositions();
  }

  /** Stops the run; events on their way are dropped, so none outlives the practice group. */
  stop(): void {
    this.#stopped = true;
    for (const timer of this.#timers) clearTimeout(timer);
    this.#timers.clear();
  }

  /** Behaves about the group as it now is. */
  react(state: GroupState): void {
    this.#state = state;
    this.#answerRollCall();
    this.#answerAlerts();
    this.#goToSosCalls();
    this.#dropFinishedJobs();
    this.#takeTasks();
    this.#clearSweptAreas();
    this.#answerUser();
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
      const teammate = this.#byAlias.get(event.by);
      if (teammate === undefined) throw new Error(`no teammate ${event.by} in the scenario`);
      const { action } = event;
      const now = Date.now();
      // An SOS or a report goes from where the teammate is now, wherever their tasks took them;
      // whoever calls an SOS stops there.
      const placed =
        action.type === 'sos' || action.type === 'report'
          ? { ...event, action: { ...action, where: teammate.walker.at(now) } }
          : event;
      if (action.type === 'sos') teammate.injure(now);
      await this.#performer.perform(placed, teammate.actor, (draft) => this.#send(teammate, draft));
    }
  }

  #reportPositions(): void {
    const now = Date.now();
    for (const teammate of this.#teammates.values()) {
      const where = teammate.walker.at(now);
      void this.#send(teammate, (header) => ({
        ...header,
        type: 'position',
        ...where,
        accuracy: Teammate.ACCURACY_M,
        heading: null,
        speed: null,
      }));
    }
    this.#after(POSITION_EVERY_S, () => {
      this.#reportPositions();
    });
  }

  /** Every teammate but whoever called it answers the newest roll call, one after another. */
  #answerRollCall(): void {
    const call = this.#state.rollCall;
    if (call === null || !this.#first(`roll-call ${eventRefKey(call)}`)) return;
    this.#inTurn(call.origin, (teammate) => this.#send(teammate, ack(call)));
  }

  /** Every teammate but whoever sent it acknowledges each alert, one after another. */
  #answerAlerts(): void {
    for (const alert of this.#state.alerts) {
      if (!this.#first(`alert ${eventRefKey(alert)}`)) continue;
      this.#inTurn(alert.origin, (teammate) => this.#send(teammate, ack(alert)));
    }
  }

  /**
   * Whoever acknowledges a teammate's SOS goes to them, and the nearest teammate acknowledges the
   * user's and goes to the user: once there, the teammate stays a while and the SOS is over (the
   * user ends their own).
   */
  #goToSosCalls(): void {
    for (const [key, sos] of openSosCalls(this.#state)) {
      const at = { lat: sos.lat, lon: sos.lon };
      const called = this.#teammates.get(sos.origin);
      if (called === undefined) {
        if (!this.#first(`sos ${key}`)) continue;
        this.#after(SOS_ANSWER_S, async () => {
          const helper = this.#nearestOnFoot(at);
          if (helper === undefined) return;
          await this.#send(helper, ack(sos));
          await this.#say(helper, this.#options.t('practiceOnTheWay'));
          this.#help(helper, key, at, null);
        });
        continue;
      }
      for (const helper of this.#teammates.values()) {
        const acknowledged = this.#state.acks.get(key)?.has(helper.node) === true;
        if (!acknowledged || !this.#first(`help ${key} ${helper.node}`)) continue;
        this.#help(helper, key, at, called);
      }
    }
  }

  /** Sends `helper` to an SOS and, if a teammate called it, ends it once they have been there a while. */
  #help(helper: Teammate, sos: string, at: LatLon, called: Teammate | null): void {
    const now = Date.now();
    const arrival = helper.go({ kind: 'help', sos }, this.#way(helper, [at], now), now);
    if (called === null) return;
    this.#after((arrival - now) / 1000 + STAY_WITH_S, async () => {
      const call = this.#state.sos.get(sos);
      if (call === undefined || this.#state.sosCancels.has(sos)) return;
      await this.#say(helper, this.#options.t('practiceSosAttended', { name: called.alias }));
      await this.#send(called, (header) => ({ ...header, type: 'sos-cancel', sos: call }));
    });
  }

  /**
   * Teammates leave what is over: a task taken from them or finished, an SOS ended. Whoever left a
   * task to help goes back to it, if it is still theirs.
   */
  #dropFinishedJobs(): void {
    const now = Date.now();
    for (const teammate of this.#teammates.values()) {
      const { job } = teammate;
      if (job === null) continue;
      if (job.kind === 'task' && !this.#stillDoing(this.#state.tasks.get(job.task), teammate)) {
        teammate.rest(now);
      }
      if (job.kind === 'help' && this.#state.sosCancels.has(job.sos)) {
        const resume = teammate.resume;
        const task = resume === null ? undefined : this.#state.tasks.get(resume);
        teammate.rest(now);
        if (resume !== null && task !== undefined && this.#stillDoing(task, teammate)) {
          const points = errandPoints(task, this.#state.objects);
          teammate.go({ kind: 'task', task: resume }, this.#way(teammate, points, now), now);
        }
      }
    }
  }

  #stillDoing(task: TaskEvent | undefined, teammate: Teammate): boolean {
    return (
      task?.status === 'in-progress' &&
      doersOf(task, this.#state.teams, new Set(this.#teammates.keys())).includes(teammate.node)
    );
  }

  /**
   * Open tasks for teammates, or their teams, are taken by those free to do them: the first of
   * them marks it taken, all walk to it and along it, and the first says when it is done.
   */
  #takeTasks(): void {
    const simulated = new Set(this.#teammates.keys());
    for (const [key, task] of this.#state.tasks) {
      if (task.status !== 'open') continue;
      const doers = doersOf(task, this.#state.teams, simulated)
        .map((node) => this.#teammates.get(node))
        .filter((teammate): teammate is Teammate => teammate?.free === true);
      const [lead] = doers;
      if (lead === undefined || !this.#first(`take ${eventRefKey(task)}`)) continue;
      this.#after(TAKE_TASK_S, async () => {
        const latest = this.#state.tasks.get(key);
        if (latest === undefined || eventRefKey(latest) !== eventRefKey(task)) return;
        await this.#send(lead, (header) => ({ ...task, ...header, status: 'in-progress' }));
        this.#doTask(key, task, doers);
      });
    }
  }

  #doTask(key: string, task: TaskEvent, doers: readonly Teammate[]): void {
    const now = Date.now();
    const points = errandPoints(task, this.#state.objects);
    const arrivals = doers.map((doer) =>
      doer.go({ kind: 'task', task: key }, this.#way(doer, points, now), now),
    );
    // Along a line, an area or a strip, the walk is the work; at one place, there is work there.
    const workS = points.length > 1 ? 0 : WORK_AT_PLACE_S;
    const [lead] = doers;
    if (lead === undefined) return;
    this.#after((Math.max(now, ...arrivals) - now) / 1000 + workS, async () => {
      const latest = this.#state.tasks.get(key);
      if (latest === undefined || !this.#stillDoing(latest, lead)) return;
      await this.#send(lead, (header) => ({ ...latest, ...header, status: 'done' }));
      await this.#say(lead, this.#options.t('practiceTaskDone', { task: latest.text }));
    });
  }

  /** A search area whose sweep a teammate finished is marked cleared by that teammate. */
  #clearSweptAreas(): void {
    for (const teammate of this.#teammates.values()) {
      for (const area of areasToClear(this.#state, teammate.node)) {
        if (!this.#first(`clear ${eventRefKey(area.object)}`)) continue;
        const { object, label, geometry } = area;
        const style = ShapeStyleCode.SEARCH_CLEARED;
        void this.#send(teammate, (header) => ({
          ...header,
          type: 'shape',
          object,
          style,
          label,
          geometry,
        }));
      }
    }
  }

  /**
   * Someone answers what the user says in the chat and the reports they send, now and then, and
   * whoever gave the user a task thanks them for doing it.
   */
  #answerUser(): void {
    const { self, t } = this.#options;
    const said = [
      ...this.#state.chat.map((event) => [event, t('practiceHeard')] as const),
      ...this.#state.reports.map((event) => [event, t('practiceReportHeard')] as const),
    ];
    for (const [event, answer] of said) {
      if (event.origin !== self || !this.#first(`answer ${eventRefKey(event)}`)) continue;
      const speaker = this.#spokesperson;
      if (speaker === undefined || Date.now() - this.#lastReplyMs < REPLY_GAP_S * 1000) continue;
      this.#lastReplyMs = Date.now();
      this.#after(REPLY_S, () => this.#say(speaker, answer));
    }
    for (const task of this.#state.tasks.values()) {
      const giver = this.#teammates.get(task.task.origin);
      if (task.status !== 'done' || task.origin !== self || giver === undefined) continue;
      if (!this.#first(`thanks ${eventRefKey(task.task)}`)) continue;
      const name = aliasOf(this.#state, self);
      this.#after(REPLY_S, () => this.#say(giver, t('practiceThanks', { name })));
    }
  }

  /** The way a teammate takes from where they are now through `points`, along the streets. */
  #way(teammate: Teammate, points: readonly LatLon[], now: number): LatLon[] {
    return wayThrough(teammate.walker.at(now), points, this.#options.network);
  }

  /** The teammate nearest to a place who is not hurt, whatever they are doing. */
  #nearestOnFoot(at: LatLon): Teammate | undefined {
    const now = Date.now();
    return [...this.#teammates.values()]
      .filter((teammate) => !teammate.hurt)
      .sort((a, b) => a.distanceTo(at, now) - b.distanceTo(at, now))[0];
  }

  /** Every teammate but `except`, one after another, does something. */
  #inTurn(except: NodeId, run: (teammate: Teammate) => Promise<unknown>): void {
    [...this.#teammates.values()]
      .filter((teammate) => teammate.node !== except)
      .forEach((teammate, index) => {
        this.#after(ANSWER_S + index * ANSWER_STAGGER_S, () => run(teammate));
      });
  }

  /** True the first time it is asked about `key`. */
  #first(key: string): boolean {
    if (this.#handled.has(key)) return false;
    this.#handled.add(key);
    return true;
  }

  async #say(teammate: Teammate, text: string): Promise<void> {
    await this.#send(teammate, (header) => ({ ...header, type: 'chat', text }));
  }

  async #send(teammate: Teammate, draft: EventDraft): Promise<EventRef> {
    const header = teammate.nextHeader();
    const bytes = encodeEvent(draft(header));
    if (bytes.ok && !this.#stopped) await this.#options.sink(bytes.value);
    return { origin: header.origin, seq: header.seq };
  }

  #after(seconds: number, run: () => unknown): void {
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

/** An acknowledgement of an event. */
function ack(target: EventRef): EventDraft {
  const { origin, seq } = target;
  return (header) => ({ ...header, type: 'ack', target: { origin, seq } });
}
