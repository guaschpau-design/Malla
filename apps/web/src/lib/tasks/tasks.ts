// The team's tasks as the app shows them (protocol §3.11, ADR-0025): the list, what a tap on a
// task's main button does, and which tasks were just handed to this device.

import type { GroupState } from '@tesel/core';
import {
  eventRefKey,
  type EventRef,
  type LatLon,
  type NodeId,
  type TaskEvent,
  type TaskStatus,
} from '@tesel/protocol';

import { aliasOf } from '../incidents/incidents.ts';

/** What a task holds besides its reference: what the form edits and the feed sends. */
export interface TaskFields {
  readonly status: TaskStatus;
  readonly assignee: NodeId | null;
  readonly place: LatLon | null;
  readonly text: string;
}

export interface TaskRow {
  /** The task reference's key. */
  readonly key: string;
  readonly task: EventRef;
  readonly fields: TaskFields;
  /** Assigned to this device. */
  readonly mine: boolean;
  /** Who should do it, or null for anyone. */
  readonly assigneeName: string | null;
  /** Who changed it last, and when (seconds). */
  readonly changedBy: string;
  readonly changedAt: number;
}

export interface TaskList {
  /** Open and in progress: this device's first, then those in progress, then oldest first. */
  readonly pending: readonly TaskRow[];
  /** Done, most recently finished first. Cancelled tasks are only in the diary. */
  readonly done: readonly TaskRow[];
}

export function fieldsOf(event: TaskEvent): TaskFields {
  return {
    status: event.status,
    assignee: event.assignee,
    place: event.place,
    text: event.text,
  };
}

export function isPending(status: TaskStatus): boolean {
  return status === 'open' || status === 'in-progress';
}

export function taskList(state: GroupState, self: NodeId): TaskList {
  const created = creationTimes(state);
  const rows = [...state.tasks.entries()].map(([key, event]) => rowOf(state, self, key, event));
  const pending = rows
    .filter((row) => isPending(row.fields.status))
    .sort(
      (a, b) =>
        Number(b.mine) - Number(a.mine) ||
        Number(b.fields.status === 'in-progress') - Number(a.fields.status === 'in-progress') ||
        (created.get(a.key) ?? 0) - (created.get(b.key) ?? 0) ||
        a.key.localeCompare(b.key),
    );
  const done = rows
    .filter((row) => row.fields.status === 'done')
    .sort((a, b) => b.changedAt - a.changedAt || a.key.localeCompare(b.key));
  return { pending, done };
}

/** Tasks for this device still to do: the number on the dock. */
export function myPendingCount(state: GroupState, self: NodeId): number {
  let count = 0;
  for (const task of state.tasks.values()) {
    if (task.assignee === self && isPending(task.status)) count++;
  }
  return count;
}

/**
 * The task after its main button: start it (taking it if it was for anyone), finish it, or open it
 * again.
 */
export function advance(fields: TaskFields, self: NodeId): TaskFields {
  switch (fields.status) {
    case 'open':
      return { ...fields, status: 'in-progress', assignee: fields.assignee ?? self };
    case 'in-progress':
      return { ...fields, status: 'done' };
    case 'done':
    case 'cancelled':
      return { ...fields, status: 'open' };
  }
}

/** Pending tasks of this device, by key: compared before and after to notice new ones. */
export function assignedTo(
  state: Pick<GroupState, 'tasks'>,
  self: NodeId,
): ReadonlyMap<string, TaskEvent> {
  const mine = new Map<string, TaskEvent>();
  for (const [key, task] of state.tasks) {
    if (task.assignee === self && isPending(task.status)) mine.set(key, task);
  }
  return mine;
}

/** Tasks someone else has just handed to this device: pending for it now and not before. */
export function newlyAssigned(
  before: ReadonlyMap<string, TaskEvent>,
  after: ReadonlyMap<string, TaskEvent>,
  self: NodeId,
): TaskEvent[] {
  return [...after.entries()]
    .filter(([key, task]) => !before.has(key) && task.origin !== self)
    .map(([, task]) => task);
}

function rowOf(state: GroupState, self: NodeId, key: string, event: TaskEvent): TaskRow {
  return {
    key,
    task: event.task,
    fields: fieldsOf(event),
    mine: event.assignee === self,
    assigneeName: event.assignee === null ? null : aliasOf(state, event.assignee),
    changedBy: aliasOf(state, event.origin),
    changedAt: event.time,
  };
}

/** When each task was created: its first event in the journal, which is in time order. */
function creationTimes(state: GroupState): Map<string, number> {
  const times = new Map<string, number>();
  for (const event of state.journal) {
    if (event.type !== 'task') continue;
    const key = eventRefKey(event.task);
    if (!times.has(key)) times.set(key, event.time);
  }
  return times;
}
