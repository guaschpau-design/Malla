import type { AlertLevel, SosKind } from '@teselia/protocol';

import type { MessageKey } from '../i18n/index.ts';

export const SOS_KINDS: Readonly<Record<SosKind, MessageKey>> = {
  general: 'sosGeneral',
  medical: 'sosMedical',
  trapped: 'sosTrapped',
  fire: 'sosFire',
  security: 'sosSecurity',
};

export const ALERT_LEVELS: Readonly<Record<AlertLevel, MessageKey>> = {
  info: 'alertInfo',
  warning: 'alertWarning',
  critical: 'alertCritical',
};
