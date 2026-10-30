import { describe, expect, it } from 'vitest';

import { Director } from './director.ts';
import type { Inject, Stage } from './exercise.ts';

/** A stage at `elapsed` seconds, with nothing else in it. */
const at = (elapsed: number) => ({ elapsed }) as Stage;

describe('the director of an exercise', () => {
  it('plays each inject once, at its moment and once its condition holds', () => {
    const played: string[] = [];
    let ready = false;
    const injects: Inject[] = [
      { at: 10, run: () => played.push('call') },
      { at: 5, when: () => ready, run: () => played.push('order') },
    ];
    const director = new Director(injects);
    director.tick(at(4));
    expect(played).toEqual([]);
    director.tick(at(6));
    expect(played).toEqual([]);
    ready = true;
    director.tick(at(7));
    director.tick(at(11));
    director.tick(at(30));
    expect(played).toEqual(['order', 'call']);
  });
});
