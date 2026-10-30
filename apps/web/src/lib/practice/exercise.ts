// A practice is an exercise (ADR-0072): a situation that lives on its own for some twenty-five
// minutes. Each situation gives its cast and opening (a scenario), a world that moves on second by
// second (water that rises, a fire that spreads, someone lost who is found or not) and injects, the
// turns a director gives the story: a call to the control room, a change of wind, an order of the
// simulated coordinator. The run (practice-run.ts) plays them, through a stage.

import type { GroupState } from '@tesel/core';
import type { EventDraft, Passable, Scenario, ScenarioAction } from '@tesel/scenario';
import type { LatLon, NodeId, Role } from '@tesel/protocol';

import type { Locale, Translate } from '../i18n/index.ts';
import type { Chance } from './chance.ts';
import type { Findings } from './debrief/findings.ts';
import type { Errand } from './errands.ts';
import type { Ground } from './ground.ts';
import type { Job, Persona, Teammate } from './teammate.ts';
import type { Saying } from './voice.ts';

/** Where and how an exercise is played, which the situation builds it for. */
export interface Setting {
  readonly t: Translate;
  readonly locale: Locale;
  /** Where it takes place: the user's device, or the middle of the map. */
  readonly centre: LatLon;
  /** The user's part: a member of the team, or its coordinator. */
  readonly user: Role;
  readonly ground: Ground;
  readonly chance: Chance;
}

export interface Exercise {
  /** The cast and the opening: who is there, and what they do in the first seconds. */
  readonly scenario: Scenario;
  /** What each member of the cast tells about themselves, by alias; none for the control room. */
  readonly personas: Readonly<Record<string, Persona>>;
  readonly world: World;
  readonly injects: readonly Inject[];
  /** What the situation tells of how it went, for the report at the end. */
  readonly findings: (stage: Stage) => Findings;
  /** Seconds the exercise lasts at most. */
  readonly seconds: number;
}

/** What happens in the situation by itself, and what it does to whoever is in it. */
export interface World {
  /** Where `who` can walk now, as they see it: clear of the water, the smoke. */
  passable(who: Teammate): Passable;
  /** Moves on to now, and acts on what it finds. Called about once a second. */
  tick(stage: Stage): void;
}

/** A turn of the story, which happens once: at its moment, and when its condition holds. */
export interface Inject {
  /** Seconds from the start before which it cannot happen. */
  readonly at: number;
  /** What must hold for it to happen, past its moment; it happens straight away without. */
  readonly when?: (stage: Stage) => boolean;
  readonly run: (stage: Stage) => void;
}

/** What the world, the injects and the teammates' routines see and do. */
export interface Stage {
  readonly t: Translate;
  readonly chance: Chance;
  readonly ground: Ground;
  /** The user, as the group knows them. */
  readonly user: { readonly node: NodeId; readonly role: Role; readonly name: string };
  /** The group as it now is. */
  readonly state: GroupState;
  /** Milliseconds since the epoch, now. */
  readonly now: number;
  /** Seconds since the exercise began. */
  readonly elapsed: number;
  readonly crew: Crew;
  /** Whether the exercise is over. */
  readonly over: boolean;
  /** Has a member of the cast, by alias, do one of a scenario's actions, after what went before. */
  act(by: string, action: ScenarioAction): void;
  /** Has a member of the cast, by alias, say something in the chat. */
  say(by: string, text: string): void;
  /** One of the ways of saying something (voice.ts), picked at random. */
  line(saying: Saying, values?: Readonly<Record<string, string | number>>): string;
  /** Names or things in a list, as the language joins them: "Jordi, Luis y Marta". */
  list(items: readonly string[]): string;
  /** Has a teammate send an event, after what went before. */
  send(by: Teammate, draft: EventDraft): void;
  /**
   * Sets a teammate off for a job along the streets through an errand, keeping clear of what they
   * cannot cross, at their pace or `speed`. Returns when they will be through, in milliseconds;
   * null if there is no way, and they carry on with what they were doing.
   */
  walk(who: Teammate, job: Job, errand: Errand, speed?: number): number | null;
  /** Runs `run` in `seconds`, unless the exercise has stopped by then. */
  after(seconds: number, run: () => void): void;
  /** True the first time it is asked about `key`. */
  once(key: string): boolean;
  /** Ends the exercise with the last word of whoever leads it. */
  finish(text: string): void;
}

/** The people of the exercise. */
export interface Crew {
  readonly all: readonly Teammate[];
  /** Those on the ground and well: not at the control room, and not hurt. */
  readonly onTheGround: readonly Teammate[];
  byAlias(alias: string): Teammate | undefined;
  byNode(node: NodeId): Teammate | undefined;
  /** Who leads the simulated side: the coordinator, if simulated, or the control room. */
  readonly lead: Teammate;
  /** The teammate nearest to a place who is on foot and passes `can`, whatever they are doing. */
  nearest(at: LatLon, can?: (who: Teammate) => boolean): Teammate | undefined;
}
