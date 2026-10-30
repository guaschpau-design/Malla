// What the teammates send, fitted to the protocol's limits.

import {
  CHAT_MAX_BYTES,
  MARKER_LABEL_MAX_BYTES,
  REPORT_NOTE_MAX_BYTES,
  SHAPE_LABEL_MAX_BYTES,
  SOS_TEXT_MAX_BYTES,
  TASK_TEXT_MAX_BYTES,
} from '@tesel/protocol';
import type { ScenarioAction } from '@tesel/scenario';

import { fitBytes } from '../text.ts';

/**
 * An action whose texts fit the fields of the protocol: a sentence that names a long street is cut
 * short, rather than not sent at all.
 */
export function fitted(action: ScenarioAction): ScenarioAction {
  switch (action.type) {
    case 'chat':
      return { ...action, text: fitBytes(action.text, CHAT_MAX_BYTES) };
    case 'task':
      return { ...action, text: fitBytes(action.text, TASK_TEXT_MAX_BYTES) };
    case 'marker':
      return { ...action, label: fitBytes(action.label, MARKER_LABEL_MAX_BYTES) };
    case 'shape':
      return { ...action, label: fitBytes(action.label, SHAPE_LABEL_MAX_BYTES) };
    case 'sos':
      return { ...action, text: fitBytes(action.text, SOS_TEXT_MAX_BYTES) };
    case 'report':
      return { ...action, note: fitBytes(action.note, REPORT_NOTE_MAX_BYTES) };
    case 'ack':
    case 'cancel-sos':
    case 'state':
    case 'team':
    case 'task-status':
    case 'sweep':
      return action;
  }
}
