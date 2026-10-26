import type { Scenario } from '@tesel/scenario';
import { turia } from './turia.ts';

/** Scenarios by name, for the command line. */
export const SCENARIOS: ReadonlyMap<string, Scenario> = new Map([[turia.name, turia]]);
