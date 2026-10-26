// What a planned action becomes on the wire: an event of the member who acts, still without its
// header, which the sending device fills in with its own origin, sequence number and time.

import type { EventHeader, EventRef, Identity, TeselEvent } from '@tesel/protocol';

import type { PlannedAction } from './scenario.ts';

/** An event without its header. */
export type EventDraft = (header: EventHeader) => TeselEvent;

/** The member who acts, as the events they send name them. */
export interface Actor {
  readonly alias: string;
  readonly publicKey: Identity['publicKey'];
}

/** Accuracy the simulated members report with every position and SOS, in metres. */
const ACCURACY_M = 6;

/**
 * The event of a planned action. `named` holds the references of the objects and SOS calls sent
 * so far, by the `id` the scenario gives them; an action that refers to one not sent yet is an
 * error in the scenario.
 */
export function eventDraft(
  action: PlannedAction,
  actor: Actor,
  named: ReadonlyMap<string, EventRef>,
): EventDraft {
  const ref = (id: string): EventRef => {
    const found = named.get(id);
    if (found === undefined) throw new Error(`${action.type} refers to ${id}, not sent yet`);
    return found;
  };
  switch (action.type) {
    case 'announce':
      return (header) => ({
        ...header,
        type: 'member-info',
        role: action.role,
        publicKey: actor.publicKey,
        alias: actor.alias,
      });
    case 'position':
      return (header) => ({
        ...header,
        type: 'position',
        ...action.where,
        accuracy: ACCURACY_M,
        heading: null,
        speed: null,
      });
    case 'chat':
      return (header) => ({ ...header, type: 'chat', text: action.text });
    case 'alert':
      return (header) => ({ ...header, type: 'alert', level: action.level, text: action.text });
    case 'marker':
      return (header) => ({
        ...header,
        type: 'marker',
        object: { origin: header.origin, seq: header.seq },
        symbol: action.symbol,
        label: action.label,
        ...action.where,
      });
    case 'shape':
      return (header) => ({
        ...header,
        type: 'shape',
        object: { origin: header.origin, seq: header.seq },
        style: action.style,
        label: action.label,
        geometry: action.geometry,
      });
    case 'sos':
      return (header) => ({
        ...header,
        type: 'sos',
        kind: action.kind,
        ...action.where,
        accuracy: ACCURACY_M,
        text: action.text,
      });
    case 'ack': {
      const target = ref(action.of);
      return (header) => ({ ...header, type: 'ack', target });
    }
    case 'cancel-sos': {
      const sos = ref(action.of);
      return (header) => ({ ...header, type: 'sos-cancel', sos });
    }
  }
}
