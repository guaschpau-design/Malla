// The group's safety check-in: the newest CHECK_IN_TIMER (§3.17), which says after how many
// minutes without moving or touching their device a member is asked whether they are well.

import type { CheckInTimerEvent } from '@tesel/protocol';

import { newerOf } from '../ordering.ts';
import { defineSlice } from './slice.ts';

export const checkIn = defineSlice({
  handles: ['check-in-timer'],
  empty: null as CheckInTimerEvent | null,
  apply: (state, event) => (state === null ? event : newerOf(state, event)),
});
