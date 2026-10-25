import type { Role } from '@teselia/protocol';

import type { MessageKey } from '../i18n/index.ts';

export const ROLE_LABELS: Readonly<Record<Role, MessageKey>> = {
  member: 'roleMember',
  coordinator: 'roleCoordinator',
};
