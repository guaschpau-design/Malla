// How good a GPS fix is, in three steps anyone reads at a glance: good enough to find someone,
// fair, or poor (indoors, or the GPS still settling).

import type { StatusTone } from '../ui/status-tone.ts';

/** Up to this many metres, a fix is good: a person is found at sight. */
const GOOD_M = 10;
/** Up to this many metres, a fix is fair: the right building or the right stretch of path. */
const FAIR_M = 30;

export function accuracyQuality(metres: number): StatusTone {
  if (metres <= GOOD_M) return 'good';
  if (metres <= FAIR_M) return 'fair';
  return 'poor';
}
