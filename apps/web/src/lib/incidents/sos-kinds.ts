import type { SosKind } from '@tesel/protocol';

import type { MessageKey } from '../i18n/index.ts';

export const SOS_KINDS: Readonly<Record<SosKind, MessageKey>> = {
  general: 'sosGeneral',
  medical: 'sosMedical',
  trapped: 'sosTrapped',
  fire: 'sosFire',
  security: 'sosSecurity',
};
