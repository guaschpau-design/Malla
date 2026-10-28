import { deriveGroupKeys } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { openLogFile, sealLogFile } from './log-file.ts';

const KEYS = deriveGroupKeys(new Uint8Array(16).fill(1));
const OTHER = deriveGroupKeys(new Uint8Array(16).fill(2));
const EVENTS = [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5])];

describe('a log file', () => {
  it('gives back the events it was saved with', () => {
    expect(openLogFile(KEYS, sealLogFile(KEYS, EVENTS))).toEqual(EVENTS);
  });

  it('is refused by another group', () => {
    expect(openLogFile(OTHER, sealLogFile(KEYS, EVENTS))).toEqual({ kind: 'other-group' });
  });

  it('is refused when it is not a log file', () => {
    expect(openLogFile(KEYS, '{"not":"a log"}')).toEqual({ kind: 'unreadable' });
  });
});
