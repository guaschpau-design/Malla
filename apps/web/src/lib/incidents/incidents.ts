// SOS calls, alerts and the roll call as the interface shows them: who, what, and who has
// acknowledged or answered.

import type { GroupState } from '@tesel/core';
import {
  eventRefKey,
  sosPlace,
  type AlertEvent,
  type LatLon,
  type NodeId,
  type RollCallEvent,
  type SosEvent,
} from '@tesel/protocol';

import { aliasOf } from '../members/alias.ts';

interface Acknowledgement {
  /** Members who acknowledged, by alias. */
  readonly by: readonly string[];
  readonly bySelf: boolean;
}

/**
 * Where the caller of an SOS is: where they called from; or, for a call made without a position,
 * the position they shared since; or nowhere known yet.
 */
export type SosWhere =
  | { readonly kind: 'called'; readonly at: LatLon }
  | { readonly kind: 'shared'; readonly at: LatLon; readonly time: number }
  | { readonly kind: 'unknown' };

export interface SosView extends Acknowledgement {
  readonly key: string;
  readonly event: SosEvent;
  readonly author: string;
  readonly mine: boolean;
  readonly where: SosWhere;
}

export function whereSos(state: Pick<GroupState, 'positions'>, event: SosEvent): SosWhere {
  const called = sosPlace(event);
  if (called !== null) return { kind: 'called', at: called };
  const shared = state.positions.get(event.origin);
  return shared?.type === 'position'
    ? { kind: 'shared', at: { lat: shared.lat, lon: shared.lon }, time: shared.time }
    : { kind: 'unknown' };
}

export interface AlertView extends Acknowledgement {
  readonly key: string;
  readonly event: AlertEvent;
  readonly author: string;
  readonly mine: boolean;
}

/** SOS calls not cancelled yet, newest first. */
export function activeSos(state: GroupState, self: NodeId): SosView[] {
  const views: SosView[] = [];
  for (const [key, event] of state.sos) {
    if (state.sosCancels.has(key)) continue;
    views.push({
      key,
      event,
      author: aliasOf(state, event.origin),
      mine: event.origin === self,
      where: whereSos(state, event),
      ...acknowledgement(state, key, self),
    });
  }
  return views.sort((a, b) => b.event.time - a.event.time);
}

/** Alerts sent at or after `since` (seconds), newest first. */
export function recentAlerts(state: GroupState, self: NodeId, since: number): AlertView[] {
  return state.alerts
    .filter((event) => event.time >= since)
    .map((event) => {
      const key = eventRefKey(event);
      return {
        key,
        event,
        author: aliasOf(state, event.origin),
        mine: event.origin === self,
        ...acknowledgement(state, key, self),
      };
    })
    .reverse();
}

/** A roll call is open for answers this long, in seconds; then it is history (§3.12). */
export const ROLL_CALL_OPEN_S = 30 * 60;

export interface RollCallView {
  readonly key: string;
  readonly event: RollCallEvent;
  readonly caller: string;
  /** This device called it. */
  readonly mine: boolean;
  readonly answeredBySelf: boolean;
  /** Everyone the group knows but the caller, by alias: who said they are well, and who not yet. */
  readonly answered: readonly string[];
  readonly pending: readonly string[];
}

/** The current roll call while it is open at `now` (seconds), or null. */
export function openRollCall(state: GroupState, self: NodeId, now: number): RollCallView | null {
  const event = state.rollCall;
  if (event === null || now - event.time > ROLL_CALL_OPEN_S) return null;
  const key = eventRefKey(event);
  const acks = state.acks.get(key);
  const answered: string[] = [];
  const pending: string[] = [];
  for (const id of state.members.keys()) {
    if (id === event.origin) continue;
    (acks?.has(id) ? answered : pending).push(aliasOf(state, id));
  }
  const byName = (a: string, b: string) => a.localeCompare(b);
  return {
    key,
    event,
    caller: aliasOf(state, event.origin),
    mine: event.origin === self,
    answeredBySelf: acks?.has(self) ?? false,
    answered: answered.sort(byName),
    pending: pending.sort(byName),
  };
}

function acknowledgement(state: GroupState, key: string, self: NodeId): Acknowledgement {
  const acks = state.acks.get(key);
  if (acks === undefined) return { by: [], bySelf: false };
  return {
    by: [...acks.keys()].map((id) => aliasOf(state, id)).sort((a, b) => a.localeCompare(b)),
    bySelf: acks.has(self),
  };
}
