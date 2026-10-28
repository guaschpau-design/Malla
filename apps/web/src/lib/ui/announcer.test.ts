import { describe, expect, it } from 'vitest';

import { announcer } from './announcer.svelte.ts';

describe('announcer', () => {
  it('numbers each announcement, so the same words are read again', () => {
    announcer.say('SOS · Ana. Médica');
    const first = announcer.last;
    announcer.say('SOS · Ana. Médica');
    expect(announcer.last?.text).toBe('SOS · Ana. Médica');
    expect(announcer.last?.id).toBe((first?.id ?? 0) + 1);
  });
});
