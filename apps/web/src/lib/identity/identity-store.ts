// Where this device keeps its identity (identity.ts): one record of the app's database.

import type { AppDb } from '../storage/app-db.ts';
import type { LocalIdentity } from './identity.ts';

export async function loadIdentity(db: AppDb): Promise<LocalIdentity | undefined> {
  return db.get('identity', 'self');
}

export async function saveIdentity(db: AppDb, identity: LocalIdentity): Promise<void> {
  await db.put('identity', identity, 'self');
}
