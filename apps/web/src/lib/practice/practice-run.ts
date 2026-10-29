// A practice playing on this device (ADR-0031, ADR-0066). The simulated teammates of a scenario,
// each with an identity of its own, send its steps into the practice group when their moment
// comes, and behave as people would about what happens in the group, whoever starts it: they
// report where they are as they walk, take the tasks given to them or their team, one at a time,
// walk to them and along them, and say when they are done; they go to whoever calls an SOS and
// stay until it is over, and answer what the user says and does. They keep to the streets of the
// map (@tesel/scenario's WalkNetwork). Nothing leaves the device.

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
  type PlannedAction,
  type PlannedEvent,
  type Scenario,
  type WalkNetwork,
} from '@tesel/scenario';

import type { Translate } from '../i18n/index.ts';
import { aliasOf } from '../members/alias.ts';
import { areasToClear } from '../objects/sweeps.ts';
import { doersOf, errandOf, wayThrough, type Errand } from './errands.ts';
import { Teammate, type Job } from './teammate.ts';

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
  /**
   * Teammates' SOS calls, by key, that a helper has stayed with long enough: each ends once the
   * user has acknowledged it too, so that answering it is always there to practise.
   */
  readonly #attended = new Map<string, { readonly helper: Teammate; readonly called: Teammate }>();
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
    this.#goToSosCalls();
    this.#endAttendedSosCalls();
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

  /** Sends planned events one after another: one that cannot be sent is told of and left out. */
  async #sendInOrder(events: readonly PlannedEvent[]): Promise<void> {
    for (const event of events) await this.#attempt(() => this.#perform(event));
  }

  async #perform(event: PlannedEvent): Promise<void> {
    const teammate = this.#byAlias.get(event.by);
    if (teammate === undefined) throw new Error(`no teammate ${event.by} in the scenario`);
    const { action } = event;
    // An SOS or a report goes from where the teammate is now, wherever their tasks took them.
    const placed =
      action.type === 'sos' || action.type === 'report'
        ? { ...action, where: teammate.walker.at(Date.now()) }
        : action;
    await this.#act(teammate, placed);
  }

  #reportPositions(): void {
    const now = Date.now();
    for (const teammate of this.#teammates.values()) {
      const where = teammate.walker.at(now);
      void this.#attempt(() => this.#act(teammate, { type: 'position', where }));
    }
    this.#after(POSITION_EVERY_S, () => {
      this.#reportPositions();
    });
  }

  /**
   * Whoever acknowledges a teammate's SOS goes to them, and the nearest teammate acknowledges the
   * user's, if it is still open by then, and goes to the user, who ends it.
   */
  #goToSosCalls(): void {
    for (const [key, sos] of openSosCalls(this.#state)) {
      const at = { lat: sos.lat, lon: sos.lon };
      const called = this.#teammates.get(sos.origin);
      if (called === undefined) {
        if (!this.#first(`sos ${key}`)) continue;
        this.#after(SOS_ANSWER_S, async () => {
          const helper = this.#nearestOnFoot(at);
          if (helper === undefined || this.#state.sosCancels.has(key)) return;
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

  /** Sends `helper` to an SOS and, if a teammate called it, stays with them a while. */
  #help(helper: Teammate, sos: string, at: LatLon, called: Teammate | null): void {
    const now = Date.now();
    const arrival = helper.go({ kind: 'help', sos }, this.#way(helper, place(at), now), now);
    if (called === null) return;
    this.#after((arrival - now) / 1000 + STAY_WITH_S, () => {
      this.#attended.set(sos, { helper, called });
      this.#endAttendedSosCalls();
    });
  }

  /** A teammate's SOS that a helper has stayed with, and the user has acknowledged, ends. */
  #endAttendedSosCalls(): void {
    for (const [key, { helper, called }] of this.#attended) {
      const call = this.#state.sos.get(key);
      const over = call === undefined || this.#state.sosCancels.has(key);
      if (!over && this.#state.acks.get(key)?.has(this.#options.self) !== true) continue;
      this.#attended.delete(key);
      if (over) continue;
      void this.#attempt(async () => {
        await this.#say(helper, this.#options.t('practiceSosAttended', { name: called.alias }));
        await this.#send(called, (header) => ({ ...header, type: 'sos-cancel', sos: call }));
      });
    }
  }

  /**
   * Teammates leave what is over: a task done, cancelled or no longer theirs, an SOS ended.
   * Whoever called an SOS that has ended is well again, and whoever left a task to help goes back
   * to it, if it is still theirs.
   */
  #dropFinishedJobs(): void {
    const now = Date.now();
    for (const teammate of this.#teammates.values()) {
      if (teammate.sos !== null && this.#state.sosCancels.has(teammate.sos)) teammate.recover();
      const { job, resume } = teammate;
      if (job?.kind === 'task' && !this.#isFor(job.task, teammate)) teammate.rest(now);
      if (job?.kind === 'help' && this.#state.sosCancels.has(job.sos)) {
        teammate.rest(now);
        if (resume !== null && this.#isFor(resume, teammate)) this.#work(teammate, resume);
      }
    }
  }

  /** Whether a task, by its key, is still to do and for a teammate, or their team. */
  #isFor(key: string, teammate: Teammate): boolean {
    const task = this.#state.tasks.get(key);
    return (
      (task?.status === 'open' || task?.status === 'in-progress') &&
      this.#doers(task).includes(teammate)
    );
  }

  /** The teammates a task is for: the one it names, or those in the team it names. */
  #doers(task: TaskEvent): Teammate[] {
    return doersOf(task, this.#state.teams, new Set(this.#teammates.keys())).flatMap(
      (node) => this.#teammates.get(node) ?? [],
    );
  }

  /**
   * Tasks to do for teammates, or their teams, that none of them is on are taken by those free to
   * do them, who are on it from then: a moment later, the first of them marks it taken if it is
   * open, and all of them set off.
   */
  #takeTasks(): void {
    const now = Date.now();
    for (const [key, task] of this.#state.tasks) {
      if (task.status !== 'open' && task.status !== 'in-progress') continue;
      const doers = this.#doers(task);
      const free = doers.filter((doer) => doer.free);
      if (free.length === 0 || doers.some((doer) => doer.isOn(key))) continue;
      const taking: Job = { kind: 'task', task: key };
      for (const doer of free) doer.go(taking, [], now);
      this.#after(TAKE_TASK_S, async () => {
        // Those still on it: not hurt or gone to help meanwhile.
        const ready = free.filter((doer) => doer.job === taking);
        const latest = this.#state.tasks.get(key);
        const [lead] = ready;
        if (lead === undefined) return;
        if (latest === undefined || eventRefKey(latest) !== eventRefKey(task)) {
          // Changed meanwhile: it is taken afresh as it now is, if it is still theirs.
          for (const doer of ready) doer.rest(Date.now());
          return;
        }
        if (latest.status === 'open') {
          await this.#send(lead, (header) => ({ ...latest, ...header, status: 'in-progress' }));
        }
        for (const doer of ready) this.#work(doer, key);
      });
    }
  }

  /**
   * Sets a teammate off through a task and, once through it, has them say it is done, if they are
   * still on it then and nobody has said so.
   */
  #work(teammate: Teammate, key: string): void {
    const task = this.#state.tasks.get(key);
    if (task === undefined) return;
    const now = Date.now();
    const errand = errandOf(task, this.#state.objects);
    const job: Job = { kind: 'task', task: key };
    const arrival = teammate.go(job, this.#way(teammate, errand, now), now);
    // Along a line, an area or a strip, the walk is the work; at one place, there is work there.
    const workS = errand.points.length > 1 ? 0 : WORK_AT_PLACE_S;
    this.#after((arrival - now) / 1000 + workS, async () => {
      const latest = this.#state.tasks.get(key);
      if (teammate.job !== job || latest === undefined || !this.#isFor(key, teammate)) return;
      if (!this.#first(`done ${eventRefKey(latest)}`)) return;
      await this.#send(teammate, (header) => ({ ...latest, ...header, status: 'done' }));
      await this.#say(teammate, this.#options.t('practiceTaskDone', { task: latest.text }));
    });
  }

  /** A search area whose sweep a teammate finished is marked cleared by that teammate. */
  #clearSweptAreas(): void {
    for (const teammate of this.#teammates.values()) {
      for (const area of areasToClear(this.#state, teammate.node)) {
        if (!this.#first(`clear ${eventRefKey(area.object)}`)) continue;
        const style = ShapeStyleCode.SEARCH_CLEARED;
        void this.#attempt(() => this.#send(teammate, (header) => ({ ...area, ...header, style })));
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

  /** The way a teammate takes from where they are now through an errand, along the streets. */
  #way(teammate: Teammate, errand: Errand, now: number): LatLon[] {
    return wayThrough(teammate.walker.at(now), errand, this.#options.network);
  }

  /** The teammate nearest to a place who is not hurt, whatever they are doing. */
  #nearestOnFoot(at: LatLon): Teammate | undefined {
    const now = Date.now();
    return [...this.#teammates.values()]
      .filter((teammate) => !teammate.hurt)
      .sort((a, b) => a.distanceTo(at, now) - b.distanceTo(at, now))[0];
  }

  /** True the first time it is asked about `key`. */
  #first(key: string): boolean {
    if (this.#handled.has(key)) return false;
    this.#handled.add(key);
    return true;
  }

  async #say(teammate: Teammate, text: string): Promise<void> {
    await this.#act(teammate, { type: 'chat', text });
  }

  /** A teammate does one of a scenario's actions now, as its steps are done. */
  async #act(teammate: Teammate, action: PlannedAction): Promise<void> {
    const at = (Date.now() - this.#startMs) / 1000;
    await this.#performer.perform({ at, by: teammate.alias, action }, teammate.actor, (draft) =>
      this.#send(teammate, draft),
    );
  }

  /** Sends a teammate's event; whoever calls an SOS is hurt, and stops, until it is over. */
  async #send(teammate: Teammate, draft: EventDraft): Promise<EventRef> {
    const header = teammate.nextHeader();
    const event = draft(header);
    if (event.type === 'sos') teammate.injure(eventRefKey(header), Date.now());
    const bytes = encodeEvent(event);
    if (bytes.ok && !this.#stopped) await this.#options.sink(bytes.value);
    return { origin: header.origin, seq: header.seq };
  }

  /** Runs `run` in `seconds`, unless the run has stopped by then. */
  #after(seconds: number, run: () => unknown): void {
    if (this.#stopped) return;
    const timer = setTimeout(
      () => {
        this.#timers.delete(timer);
        void this.#attempt(run);
      },
      Math.max(0, seconds * 1000),
    );
    this.#timers.add(timer);
  }

  /** Does something of the run's, telling of a failure rather than leaving it unhandled. */
  async #attempt(run: () => unknown): Promise<void> {
    try {
      await run();
    } catch (error) {
      console.warn('A practice teammate could not act:', error);
    }
  }
}

/** An acknowledgement of an event. */
function ack(target: EventRef): EventDraft {
  const { origin, seq } = target;
  return (header) => ({ ...header, type: 'ack', target: { origin, seq } });
}

/** The errand of going to one place. */
function place(at: LatLon): Errand {
  return { points: [at], across: false };
}
