import type { NodeId } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { hear, NOTHING_HEARD } from './heard.ts';

const ANA = 'a1b2c3d4' as NodeId;
const T0 = 1_761_350_400;

describe('what was heard from each member', () => {
  it('keeps the newest event time per channel', () => {
    let heard = hear(NOTHING_HEARD, 'radio', [
      { origin: ANA, time: T0 },
      { origin: ANA, time: T0 + 60 },
      { origin: ANA, time: T0 + 30 },
    ]);
    heard = hear(heard, 'internet', [{ origin: ANA, time: T0 + 10 }]);
    expect(heard.get(ANA)).toEqual({ radio: T0 + 60, internet: T0 + 10 });
  });

  it('changes nothing when nothing newer arrives', () => {
    const heard = hear(NOTHING_HEARD, 'radio', [{ origin: ANA, time: T0 }]);
    expect(hear(heard, 'radio', [{ origin: ANA, time: T0 }])).toBe(heard);
    expect(hear(heard, 'internet', [])).toBe(heard);
  });
});
