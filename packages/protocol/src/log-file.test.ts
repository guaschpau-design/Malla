import { describe, expect, it } from 'vitest';

import { LOG_FILE_VERSION } from './constants.ts';
import { deriveGroupKeys, openEnvelope, sealEnvelope } from './crypto.ts';
import { encodeLogFile, parseLogFile } from './log-file.ts';

const keys = deriveGroupKeys(new Uint8Array(16).fill(7));
const event = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);

describe('log files', () => {
  it('carries sealed events that only the group can open', () => {
    const text = encodeLogFile({ groupId: keys.groupId, envelopes: [sealEnvelope(keys, event)] });
    expect(text).not.toContain('AQIDBAUGBwgJCgsMDQ4'); // the event in base64url
    const file = parseLogFile(text);
    if (!file.ok) throw new Error(file.error.detail);
    expect(file.value.groupId).toEqual(keys.groupId);
    const [envelope] = file.value.envelopes;
    expect(envelope && openEnvelope(keys, envelope)).toEqual(event);
  });

  it('skips envelopes that cannot be one, and keeps the rest', () => {
    const text = JSON.stringify({
      tesel: 'log',
      version: LOG_FILE_VERSION,
      group: encodeLogFile({ groupId: keys.groupId, envelopes: [] }).match(
        /"group":"([^"]+)"/,
      )?.[1],
      envelopes: ['!!', 42, 'AQID'],
    });
    const file = parseLogFile(text);
    expect(file.ok && file.value.envelopes).toEqual([new Uint8Array([1, 2, 3])]);
  });

  it('refuses what is not a log file of a version it knows', () => {
    const codes = ['nonsense', '{"tesel":"invitation"}', '{"tesel":"log","version":2}'].map(
      (text) => {
        const file = parseLogFile(text);
        return file.ok ? 'ok' : file.error.code;
      },
    );
    expect(codes).toEqual(['invalid-value', 'invalid-value', 'unsupported-version']);
  });
});
