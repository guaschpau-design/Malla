// What the group has said: chat lines, alerts and situation reports, each in (time, origin, seq)
// order so every device shows the same order (§3.5, §3.9, §3.16).

import type { AlertEvent, ChatEvent, ReportEvent } from '@tesel/protocol';

import { insertOrdered } from '../collections.ts';
import { defineSlice } from './slice.ts';

export const chat = defineSlice({
  handles: ['chat'],
  empty: [] as readonly ChatEvent[],
  apply: insertOrdered,
});

export const reports = defineSlice({
  handles: ['report'],
  empty: [] as readonly ReportEvent[],
  apply: insertOrdered,
});

export const alerts = defineSlice({
  handles: ['alert'],
  empty: [] as readonly AlertEvent[],
  apply: insertOrdered,
});
