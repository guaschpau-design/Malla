// A practice playing on this device (ADR-0031, ADR-0066, ADR-0072): an exercise of some twenty-five
// minutes. Its simulated members, each with an identity of their own, send the opening of its
// scenario into the practice group when their moment comes; from then on, about once a second, its
// world moves on (water rises, a fire spreads), its director plays the turns of the story, and the
// members behave as people would about what happens in the group, whoever starts it (routines/).
// They report where they are as they walk the streets of the map (@tesel/scenario's WalkNetwork).
// Everything goes out through one queue, in order. At the end, it says how it went (ADR-0073).
// Nothing leaves the device.

import { EMPTY_STATE, type GroupState } from '@tesel/core';
import {
  encodeEvent,
  eventRefKey,
  generateIdentity,
  type EventRef,
  type NodeId,
  type Role,
} from '@tesel/protocol';
import {
  onFoot,
  plan,
  ScenarioPerformer,
  YOU,
  type EventDraft,
  type PlannedAction,
  type PlannedEvent,
  type ScenarioAction,
} from '@tesel/scenario';

import { aliasOf } from '../members/alias.ts';
import { debriefOf, type Debrief } from './debrief/debrief.ts';
import { UserLog } from './debrief/user-log.ts';
import { Director } from './director.ts';
import { wayThrough, type Errand } from './errands.ts';
import type { Crew, Exercise, Setting, Stage, World } from './exercise.ts';
import { fitted } from './fitted.ts';
import { BodyRoutine } from './routines/body.ts';
import { SosRoutine } from './routines/sos.ts';
import { TalkRoutine } from './routines/talk.ts';
import { Roster } from './roster.ts';
import { TaskRoutine } from './routines/tasks.ts';
import { Teammate, type Job } from './teammate.ts';
import { say, type Saying } from './voice.ts';

/** Where the run hands each event, as if a teammate had sent it: the practice group's feed. */
type PracticeSink = (bytes: Uint8Array) => Promise<void>;

export interface PracticeOptions {
  readonly sink: PracticeSink;
  /** The user's node ID, whom the scenario names `YOU`. */
  readonly self: NodeId;
  readonly setting: Setting;
  /** Called once the exercise is over, with how it went. */
  readonly onfinish?: (debrief: Debrief) => void;
}

/** Seconds between the moments the world moves on and the members look round. */
const TICK_S = 1;
/** Seconds between the position reports of each teammate, and of one saving their battery. */
const POSITION_EVERY_S = 10;
const POSITION_SAVING_S = 60;

export class PracticeRun implements Stage {
  readonly crew: Crew;
  readonly #plan: readonly PlannedEvent[];
  /** Seconds the exercise lasts at most. */
  readonly #seconds: number;
  readonly #world: World;
  readonly #director: Director;
  readonly #findings: Exercise['findings'];
  /** When the user did what the report at the end weighs. */
  readonly #log = new UserLog();
  readonly #routines: readonly { tick(stage: Stage): void }[];
  readonly #options: PracticeOptions;
  readonly #performer: ScenarioPerformer;
  /** What has been seen to, by kind and key, so that nothing is done twice. */
  readonly #handled = new Set<string>();
  readonly #timers = new Set<ReturnType<typeof setTimeout>>();
  /** When each teammate last reported where they are, in milliseconds. */
  readonly #reported = new Map<Teammate, number>();
  #state: GroupState = EMPTY_STATE;
  #next = 0;
  #startMs = 0;
  #stopped = false;
  #over = false;
  /** Everything goes out one event after another, so that later ones find what they name. */
  #sending: Promise<void> = Promise.resolve();

  constructor(exercise: Exercise, options: PracticeOptions) {
    const { network } = options.setting.ground;
    const scenario = network ? onFoot(exercise.scenario, network) : exercise.scenario;
    this.#plan = plan(scenario, { positionEvery: null });
    const teammates = scenario.members.map(
      (member) => new Teammate(member, generateIdentity(), exercise.personas[member.alias] ?? null),
    );
    this.crew = new Roster(teammates);
    this.#seconds = exercise.seconds;
    this.#world = exercise.world;
    this.#director = new Director(exercise.injects);
    this.#findings = exercise.findings;
    this.#routines = [new SosRoutine(), new TaskRoutine(), new TalkRoutine(), new BodyRoutine()];
    this.#options = options;
    this.#performer = new ScenarioPerformer((name) =>
      name === YOU ? options.self : this.crew.byAlias(name)?.node,
    );
  }

  start(): void {
    this.#startMs = Date.now();
    // Everyone starts where they gather, with nothing to do yet.
    for (const teammate of this.crew.all) teammate.stop(this.#startMs);
    this.#playDue();
    this.#tick();
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
    this.#step();
  }

  // The stage (exercise.ts), which the world, the injects and the routines act through.

  get t(): Setting['t'] {
    return this.#options.setting.t;
  }

  get chance(): Setting['chance'] {
    return this.#options.setting.chance;
  }

  get ground(): Setting['ground'] {
    return this.#options.setting.ground;
  }

  get user(): { readonly node: NodeId; readonly role: Role; readonly name: string } {
    const { self, setting } = this.#options;
    return { node: self, role: setting.user, name: aliasOf(this.#state, self) };
  }

  get state(): GroupState {
    return this.#state;
  }

  get now(): number {
    return Date.now();
  }

  get elapsed(): number {
    return (Date.now() - this.#startMs) / 1000;
  }

  get over(): boolean {
    return this.#over;
  }

  act(by: string, action: ScenarioAction): void {
    const teammate = this.crew.byAlias(by);
    if (teammate === undefined) throw new Error(`no ${by} in the exercise`);
    const fitting = fitted(action);
    // An SOS or a report goes from where the teammate is when it goes.
    this.#queue(() => {
      const placed: PlannedAction =
        fitting.type === 'sos' || fitting.type === 'report'
          ? { ...fitting, where: teammate.at(Date.now()) }
          : fitting;
      return this.#act(teammate, placed);
    });
  }

  say(by: string, text: string): void {
    this.act(by, { type: 'chat', text });
  }

  line(saying: Saying, values?: Readonly<Record<string, string | number>>): string {
    return say(this.t, this.chance, saying, values);
  }

  list(items: readonly string[]): string {
    return new Intl.ListFormat(this.#options.setting.locale).format(items);
  }

  send(by: Teammate, draft: EventDraft): void {
    this.#queue(() => this.#send(by, draft));
  }

  walk(who: Teammate, job: Job, errand: Errand, speed?: number): number | null {
    const now = Date.now();
    const way = wayThrough(who.at(now), errand, this.ground.network, this.#world.passable(who));
    return way === null ? null : who.go(job, way, now, speed);
  }

  after(seconds: number, run: () => void): void {
    if (this.#stopped) return;
    const timer = setTimeout(
      () => {
        this.#timers.delete(timer);
        if (!this.#over) attempt(run);
      },
      Math.max(0, seconds * 1000),
    );
    this.#timers.add(timer);
  }

  once(key: string): boolean {
    if (this.#handled.has(key)) return false;
    this.#handled.add(key);
    return true;
  }

  finish(text: string): void {
    if (this.#over) return;
    this.say(this.crew.lead.alias, text);
    this.#over = true;
    this.#log.look(this.#state, this.#options.self, this.elapsed);
    this.#options.onfinish?.(debriefOf(this, this.#log, this.#findings(this)));
  }

  // The run's own work.

  /**
   * Moves the exercise on: notes what the user has done, then the routines, the world and the
   * director, then its end, if due.
   */
  #step(): void {
    if (this.#over || this.#stopped || this.#startMs === 0) return;
    this.#log.look(this.#state, this.#options.self, this.elapsed);
    for (const routine of this.#routines)
      attempt(() => {
        routine.tick(this);
      });
    attempt(() => {
      this.#world.tick(this);
    });
    attempt(() => {
      this.#director.tick(this);
    });
    // Whatever the world has said of how it ended, the exercise ends on time.
    if (this.elapsed >= this.#seconds) this.finish(this.t('practiceTimeUp'));
  }

  #tick(): void {
    this.#step();
    this.#reportPositions();
    if (!this.#over) {
      this.after(TICK_S, () => {
        this.#tick();
      });
    }
  }

  /** Sends every planned event whose moment has come, then waits for the next one. */
  #playDue(): void {
    const elapsed = this.elapsed;
    let event = this.#plan[this.#next];
    while (event !== undefined && event.at <= elapsed) {
      const due = event;
      const teammate = this.crew.byAlias(due.by);
      if (teammate === undefined) throw new Error(`no teammate ${due.by} in the scenario`);
      this.#queue(() => this.#act(teammate, due.action));
      this.#next += 1;
      event = this.#plan[this.#next];
    }
    if (event !== undefined) {
      this.after(event.at - elapsed, () => {
        this.#playDue();
      });
    }
  }

  /** Teammates on the ground say where they are, now and then; less often to save a battery. */
  #reportPositions(): void {
    const now = Date.now();
    for (const teammate of this.crew.onTheGround.concat(this.#hurt())) {
      if (teammate.silent) continue;
      const every = teammate.saving ? POSITION_SAVING_S : POSITION_EVERY_S;
      if (now - (this.#reported.get(teammate) ?? -Infinity) < every * 1000) continue;
      this.#reported.set(teammate, now);
      const where = teammate.at(now);
      this.#queue(() => this.#act(teammate, { type: 'position', where }));
    }
  }

  /** Teammates who are hurt: they stay where they are, and still say where that is. */
  #hurt(): Teammate[] {
    return this.crew.all.filter((teammate) => teammate.hurt);
  }

  /** Runs `send` once everything before it has gone; one that fails is told of and left out. */
  #queue(send: () => Promise<unknown>): void {
    this.#sending = this.#sending.then(async () => {
      if (this.#stopped) return;
      try {
        await send();
      } catch (error) {
        console.warn('A practice teammate could not act:', error);
      }
    });
  }

  /** A teammate does one of a scenario's actions now. */
  async #act(teammate: Teammate, action: PlannedAction): Promise<void> {
    await this.#performer.perform(
      { at: this.elapsed, by: teammate.alias, action },
      teammate.actor,
      (draft) => this.#send(teammate, draft),
    );
  }

  /** Sends a teammate's event; whoever calls an SOS is hurt, and stops, until it is over. */
  async #send(teammate: Teammate, draft: EventDraft): Promise<EventRef> {
    const header = teammate.nextHeader();
    const event = draft(header);
    if (event.type === 'sos') teammate.injure(eventRefKey(header), Date.now());
    const bytes = encodeEvent(event);
    if (!bytes.ok) throw new Error(`a ${event.type} that cannot be sent: ${bytes.error.detail}`);
    if (!this.#stopped) await this.#options.sink(bytes.value);
    return { origin: header.origin, seq: header.seq };
  }
}

/** Does something of the run's, telling of a failure rather than letting it stop the run. */
function attempt(run: () => void): void {
  try {
    run();
  } catch (error) {
    console.warn('A practice teammate could not act:', error);
  }
}
