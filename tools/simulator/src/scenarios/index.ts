import type { Scenario } from '../scenario.ts';
import { turia } from './turia.ts';

/** Scenarios by name, for the command line. */
export const SCENARIOS: ReadonlyMap<string, Scenario> = new Map([[turia.name, turia]]);
