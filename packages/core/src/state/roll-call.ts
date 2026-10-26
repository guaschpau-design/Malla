// The current roll call: the newest ROLL_CALL of the group (§3.12). Its answers are ACKs, kept by
// the acks slice; older roll calls are in the journal.

import type { RollCallEvent } from '@tesel/protocol';

import { newerOf } from '../ordering.ts';
import { defineSlice } from './slice.ts';

export const rollCall = defineSlice({
  handles: ['roll-call'],
  empty: null as RollCallEvent | null,
  apply: (state, event) => (state === null ? event : newerOf(state, event)),
});
