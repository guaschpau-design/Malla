import { describe, expect, it } from 'vitest';

import { initialOf, shorten } from './text.ts';

describe('text', () => {
  it('shortens long texts with an ellipsis and leaves short ones alone', () => {
    expect(shorten('Revisar el almacén', 30)).toBe('Revisar el almacén');
    expect(shorten('Revisar el almacén', 8)).toBe('Revisar…');
  });

  it('never splits a character in two', () => {
    expect(shorten('👩‍🚒👩‍🚒👩‍🚒', 2)).toBe('👩‍🚒…');
    expect(initialOf('👩‍🚒 Ana')).toBe('👩‍🚒');
  });

  it('takes the first letter of a name, in capitals', () => {
    expect(initialOf(' ángela')).toBe('Á');
    expect(initialOf('')).toBe('?');
  });
});
