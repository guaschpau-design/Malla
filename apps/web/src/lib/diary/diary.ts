// The diary of an operation: what happened in the group, line by line, in the order every device
// agrees on, written out in the user's language from the journal (core/state/journal.ts).

import type { GroupState, JournalEvent } from '@tesel/core';
import {
  eventRefKey,
  sosPlace,
  type LatLon,
  type MarkerEvent,
  type ShapeEvent,
  type TaskEvent,
  type TaskStatus,
} from '@tesel/protocol';

import type { MessageKey, Translate } from '../i18n/index.ts';
import { ROLE_LABELS } from '../groups/role-label.ts';
import { aliasOf } from '../members/alias.ts';
import { ALERT_LEVELS, SOS_KINDS } from '../incidents/sos-kinds.ts';
import { objectKind } from '../objects/catalog.ts';

export interface DiaryLine {
  /** The event's reference key. */
  readonly key: string;
  /** Seconds since the epoch, as the author's device recorded it. */
  readonly time: number;
  readonly author: string;
  readonly text: string;
  /** Where it happened, when it happened somewhere: a marker, a circle, an SOS. */
  readonly at: LatLon | null;
}

/** Every line of the diary, oldest first. */
export function diaryLines(state: GroupState, t: Translate): DiaryLine[] {
  const introduced = new Set<string>();
  const objects = new Map<string, MarkerEvent | ShapeEvent>();
  const tasks = new Map<string, TaskEvent>();
  // Answers can be stamped before their roll call by a device whose clock runs early.
  const rollCalls = new Set(
    state.journal.flatMap((event) => (event.type === 'roll-call' ? [eventRefKey(event)] : [])),
  );
  return state.journal.flatMap((event) => {
    const text = describe(event);
    if (text === null) return [];
    return [
      {
        key: eventRefKey(event),
        time: event.time,
        author: aliasOf(state, event.origin),
        text,
        at: placeOf(event),
      },
    ];
  });

  function describe(event: JournalEvent): string | null {
    switch (event.type) {
      case 'member-info': {
        const role = t(ROLE_LABELS[event.role]);
        if (introduced.has(event.origin))
          return t('diaryMemberChanged', { name: event.alias, role });
        introduced.add(event.origin);
        return t('diaryJoined', { role });
      }
      case 'position-hidden':
        return t('diaryStoppedSharing');
      case 'chat':
        return t('diaryChat', { text: event.text });
      case 'alert':
        return t('diaryAlert', { level: t(ALERT_LEVELS[event.level]), text: event.text });
      case 'sos':
        return withText(t('diarySos', { kind: t(SOS_KINDS[event.kind]) }), event.text);
      case 'sos-cancel': {
        const sos = state.sos.get(eventRefKey(event.sos));
        return sos ? t('diarySosCancelled', { name: aliasOf(state, sos.origin) }) : null;
      }
      case 'ack': {
        // What was received, once it has arrived here too; until then the line waits.
        const target = eventRefKey(event.target);
        const sos = state.sos.get(target);
        if (sos) return t('diaryAckSos', { name: aliasOf(state, sos.origin) });
        const alert = state.alerts.find((item) => eventRefKey(item) === target);
        if (alert) return t('diaryAckAlert', { name: aliasOf(state, alert.origin) });
        if (rollCalls.has(target)) return t('diaryAnsweredRollCall');
        return null;
      }
      case 'roll-call':
        return withText(t('diaryRollCall'), event.text);
      case 'marker':
      case 'shape': {
        const key = eventRefKey(event.object);
        const known = objects.has(key);
        objects.set(key, event);
        return t(known ? 'diaryChanged' : 'diaryCreated', { object: objectName(event) });
      }
      case 'object-delete': {
        const last = objects.get(eventRefKey(event.object));
        return last ? t('diaryDeleted', { object: objectName(last) }) : null;
      }
      case 'task': {
        const key = eventRefKey(event.task);
        const before = tasks.get(key);
        tasks.set(key, event);
        return describeTask(before, event);
      }
    }
  }

  /** The most telling change of a task: its status, then who should do it, then the rest. */
  function describeTask(before: TaskEvent | undefined, task: TaskEvent): string {
    const vars = {
      text: task.text,
      name: task.assignee === null ? t('anyone') : aliasOf(state, task.assignee),
    };
    if (before === undefined) {
      return t(task.assignee === null ? 'diaryTaskCreated' : 'diaryTaskCreatedFor', vars);
    }
    if (before.status !== task.status) return t(TASK_STATUS_LINES[task.status], vars);
    if (before.assignee !== task.assignee) return t('diaryTaskAssigned', vars);
    return t('diaryTaskChanged', vars);
  }

  function objectName(object: MarkerEvent | ShapeEvent): string {
    const kind = t(objectKind(object));
    return object.label ? `${kind} «${object.label}»` : kind;
  }
}

const TASK_STATUS_LINES = {
  open: 'diaryTaskReopened',
  'in-progress': 'diaryTaskStarted',
  done: 'diaryTaskDone',
  cancelled: 'diaryTaskCancelled',
} as const satisfies Readonly<Record<TaskStatus, MessageKey>>;

function withText(sentence: string, text: string): string {
  return text ? `${sentence} «${text}»` : sentence;
}

function placeOf(event: JournalEvent): LatLon | null {
  if (event.type === 'marker') return { lat: event.lat, lon: event.lon };
  if (event.type === 'sos') return sosPlace(event);
  if (event.type === 'shape' && event.geometry.kind === 'circle') return event.geometry.center;
  if (event.type === 'task') return event.place;
  return null;
}
