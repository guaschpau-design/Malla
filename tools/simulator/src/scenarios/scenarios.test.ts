import { plan } from '@tesel/scenario';
import { describe, expect, it } from 'vitest';

import { SCENARIOS } from './index.ts';

describe('bundled scenarios', () => {
  it('can all be planned', () => {
    for (const scenario of SCENARIOS.values()) {
      expect(plan(scenario, { positionEvery: 10 }).length).toBeGreaterThan(scenario.steps.length);
    }
  });
});
