import 'fake-indexeddb/auto';

import { describe, expect, it } from 'vitest';

import { openAppDb } from '../storage/app-db.ts';
import { loadRadioTexts, saveRadioText } from './radio-text-store.ts';
import { MAX_RADIO_TEXTS } from './radio-texts.ts';

const text = (n: number) => ({
  kind: 'channel' as const,
  channel: 'Public',
  sender: 'Marta',
  text: `mensaje ${String(n)}`,
  time: n,
  receivedAt: n,
});

describe('MeshCore text messages', () => {
  it('keeps the newest messages, oldest first', async () => {
    const db = await openAppDb('radio-texts-test');
    for (let n = 1; n <= MAX_RADIO_TEXTS + 3; n++) await saveRadioText(db, text(n));
    const stored = await loadRadioTexts(db);
    expect(stored).toHaveLength(MAX_RADIO_TEXTS);
    expect(stored[0]?.text).toBe('mensaje 4');
    expect(stored.at(-1)?.text).toBe(`mensaje ${String(MAX_RADIO_TEXTS + 3)}`);
  });
});
