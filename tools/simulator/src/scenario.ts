// A staged operation as data, and the plan of events it produces. Planning is pure: the same
// scenario always gives the same plan, which the runner (play.ts) then sends over the relay.

import { distanceMeters } from '@tesel/core';
import type { AlertLevel, LatLon, Role, ShapeGeometry, SosKind } from '@tesel/protocol';

export interface ScenarioMember {
  readonly alias: string;
  /** Members are members unless they coordinate. */
  readonly role?: Role;
  /**
   * Where the member is: one point to stay put, several to walk them in order and back, as on a
   * search sector. Absent for a member who never shares a position.
   */
  readonly route?: readonly LatLon[];
  /** Metres per second along the route; walking pace by default. */
  readonly speed?: number;
  /** True for a member who does not share their position: the route only places their SOS. */
  readonly hidden?: boolean;
}

/** What a member does at a moment of the scenario. Objects and SOS calls are named by `id`. */
export type ScenarioAction =
  | { readonly type: 'chat'; readonly text: string }
  | { readonly type: 'alert'; readonly level: AlertLevel; readonly text: string }
  | {
      readonly type: 'marker';
      readonly id: string;
      readonly symbol: number;
      readonly label: string;
      readonly where: LatLon;
    }
  | {
      readonly type: 'shape';
      readonly id: string;
      readonly style: number;
      readonly label: string;
      readonly geometry: ShapeGeometry;
    }
  /** An SOS from where the member is at that moment. */
  | { readonly type: 'sos'; readonly id: string; readonly kind: SosKind; readonly text: string }
  | { readonly type: 'ack'; readonly of: string }
  | { readonly type: 'cancel-sos'; readonly of: string };

export interface ScenarioStep {
  /** Seconds from the start of the scenario. */
  readonly at: number;
  /** Alias of the member who acts. */
  readonly by: string;
  readonly action: ScenarioAction;
}

export interface Scenario {
  readonly name: string;
  readonly description: string;
  /** Where the map should look to see it. */
  readonly center: LatLon;
  /** Seconds the scenario lasts; members keep walking until then. */
  readonly duration: number;
  readonly members: readonly ScenarioMember[];
  readonly steps: readonly ScenarioStep[];
}

/**
 * One thing to send: a member's announcement, a position or a step of the scenario, with an SOS
 * placed where its sender is at that moment.
 */
export type PlannedAction =
  | { readonly type: 'announce'; readonly role: Role }
  | { readonly type: 'position'; readonly where: LatLon }
  | Exclude<ScenarioAction, { readonly type: 'sos' }>
  | (Extract<ScenarioAction, { readonly type: 'sos' }> & { readonly where: LatLon });

export interface PlannedEvent {
  readonly at: number;
  readonly by: string;
  readonly action: PlannedAction;
}

export interface PlanOptions {
  /** Seconds between position reports of each member. */
  readonly positionEvery: number;
}

/** Walking pace, in metres per second. */
const WALKING_SPEED = 1.2;

/**
 * Every event of the scenario in time order. Members announce themselves first, positions follow
 * their routes, and SOS calls take the position of their sender at that moment.
 */
export function plan(scenario: Scenario, options: PlanOptions): PlannedEvent[] {
  const members = new Map(scenario.members.map((member) => [member.alias, member]));
  const steps = scenario.steps.map((step): PlannedEvent => {
    const member = members.get(step.by);
    if (member === undefined) throw new Error(`step at ${String(step.at)}s: no member ${step.by}`);
    const { action } = step;
    return action.type === 'sos'
      ? { ...step, action: { ...action, where: whereAt(member, step.at) } }
      : { ...step, action };
  });
  const planned: PlannedEvent[] = scenario.members.map((member) => ({
    at: 0,
    by: member.alias,
    action: { type: 'announce', role: member.role ?? 'member' },
  }));
  for (const member of scenario.members) {
    if (member.route === undefined || member.hidden === true) continue;
    for (let at = 0; at <= scenario.duration; at += options.positionEvery) {
      planned.push({
        at,
        by: member.alias,
        action: { type: 'position', where: whereAt(member, at) },
      });
    }
  }
  planned.push(...steps);
  // A stable sort keeps announcements before positions, and positions before steps, at a tie.
  return planned.sort((a, b) => a.at - b.at);
}

/** Where a member is after `seconds`: walking their route back and forth, or standing still. */
export function whereAt(member: ScenarioMember, seconds: number): LatLon {
  const route = member.route ?? [];
  const first = route[0];
  if (first === undefined) throw new Error(`${member.alias} has no route`);
  if (route.length === 1) return first;
  const legs = route.slice(1).map((to, index) => ({ from: route[index] ?? first, to }));
  const lengths = legs.map(({ from, to }) => distanceMeters(from, to));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  // Out and back: the walk repeats every two lengths of the route.
  const travelled = (seconds * (member.speed ?? WALKING_SPEED)) % (2 * total);
  let along = travelled <= total ? travelled : 2 * total - travelled;
  for (const [index, leg] of legs.entries()) {
    const length = lengths[index] ?? 0;
    if (along <= length || index === legs.length - 1) {
      const fraction = length === 0 ? 0 : Math.min(along / length, 1);
      return {
        lat: leg.from.lat + (leg.to.lat - leg.from.lat) * fraction,
        lon: leg.from.lon + (leg.to.lon - leg.from.lon) * fraction,
      };
    }
    along -= length;
  }
  return first;
}
