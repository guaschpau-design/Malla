// Text messages of other MeshCore apps that the radio heard (see RadioText). They are kept on
// the device so they are not lost while Tesel holds the radio.

import type { RadioText } from '@tesel/meshcore/link';

export interface StoredRadioText extends RadioText {
  /** When this device received it, in milliseconds since the epoch. */
  readonly receivedAt: number;
}

/** Only the newest messages are kept. */
export const MAX_RADIO_TEXTS = 500;
