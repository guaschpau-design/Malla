// The diary of an operation: what happened in the group, line by line, in the order every device
// agrees on, written out in the user's language from the journal (core/state/journal.ts).

import type { GroupState, JournalEvent } from '@tesel/core';
import { eventRefKey, type LatLon, type MarkerEvent, type ShapeEvent } from '@tesel/protocol';

import type { Translate } from '../i18n/index.ts';
import { ROLE_LABELS } from '../groups/role-label.ts';
import { aliasOf } from '../incidents/incidents.ts';
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
      case 'sos-cancel':
        return t('diarySosCancelled', { name: authorOf(eventRefKey(event.sos)) });
      case 'ack': {
        const target = eventRefKey(event.target);
        if (state.sos.has(target)) return t('diaryAckSos', { name: authorOf(target) });
        return t('diaryAckAlert', { name: authorOf(target) });
      }
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
    }
  }

  function objectName(object: MarkerEvent | ShapeEvent): string {
    const kind = t(objectKind(object));
    return object.label ? `${kind} «${object.label}»` : kind;
  }

  /** Who sent an SOS or an alert, by its reference key. */
  function authorOf(key: string): string {
    const event = state.sos.get(key) ?? state.alerts.find((alert) => eventRefKey(alert) === key);
    return event ? aliasOf(state, event.origin) : '?';
  }
}

function withText(sentence: string, text: string): string {
  return text ? `${sentence} «${text}»` : sentence;
}

function placeOf(event: JournalEvent): LatLon | null {
  if (event.type === 'marker' || event.type === 'sos') return { lat: event.lat, lon: event.lon };
  if (event.type === 'shape' && event.geometry.kind === 'circle') return event.geometry.center;
  return null;
}
