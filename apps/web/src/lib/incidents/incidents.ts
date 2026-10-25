// SOS calls and alerts as the interface shows them: who, what, and who has acknowledged.

import type { GroupState } from '@teselia/core';
import {
  eventRefKey,
  type AlertEvent,
  type NodeId,
  type SosCancelEvent,
  type SosEvent,
} from '@teselia/protocol';

export interface Acknowledgement {
  /** Members who acknowledged, by alias. */
  readonly by: readonly string[];
  readonly bySelf: boolean;
}

export interface SosView extends Acknowledgement {
  readonly key: string;
  readonly event: SosEvent;
  readonly author: string;
  readonly mine: boolean;
}

export interface CancelledSos {
  readonly key: string;
  readonly author: string;
  readonly cancelledBy: string;
  readonly cancel: SosCancelEvent;
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
      ...acknowledgement(state, key, self),
    });
  }
  return views.sort((a, b) => b.event.time - a.event.time);
}

export function cancelledSos(state: GroupState): CancelledSos[] {
  const views: CancelledSos[] = [];
  for (const [key, cancel] of state.sosCancels) {
    const call = state.sos.get(key);
    if (call === undefined) continue;
    views.push({
      key,
      cancel,
      author: aliasOf(state, call.origin),
      cancelledBy: aliasOf(state, cancel.origin),
    });
  }
  return views;
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

export function aliasOf(state: GroupState, id: NodeId): string {
  return state.members.get(id)?.alias ?? id;
}

function acknowledgement(state: GroupState, key: string, self: NodeId): Acknowledgement {
  const acks = state.acks.get(key);
  if (acks === undefined) return { by: [], bySelf: false };
  return {
    by: [...acks.keys()].map((id) => aliasOf(state, id)).sort((a, b) => a.localeCompare(b)),
    bySelf: acks.has(self),
  };
}
