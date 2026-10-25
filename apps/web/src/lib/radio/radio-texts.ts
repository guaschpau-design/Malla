// Text messages of other MeshCore apps that the radio heard (see RadioText). They are kept on
// the device so they are not lost while Teselia holds the radio.

import type { RadioText } from '@teselia/meshcore';

import type { AppDb } from '../storage/app-db.ts';

export interface StoredRadioText extends RadioText {
  /** When this device received it, in milliseconds since the epoch. */
  readonly receivedAt: number;
}

/** Only the newest messages are kept. */
export const MAX_RADIO_TEXTS = 500;

export async function loadRadioTexts(db: AppDb): Promise<StoredRadioText[]> {
  return db.getAll('radioTexts');
}

/** Stores a message and drops the oldest ones beyond the limit. */
export async function saveRadioText(db: AppDb, text: StoredRadioText): Promise<void> {
  const tx = db.transaction('radioTexts', 'readwrite');
  await tx.store.add(text);
  const keys = await tx.store.getAllKeys();
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_RADIO_TEXTS))) {
    await tx.store.delete(key);
  }
  await tx.done;
}
