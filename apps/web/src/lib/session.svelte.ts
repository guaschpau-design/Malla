// Reactive view of who this device is and which groups it belongs to. Components read it and
// call its methods; the rules live in identity/ and groups/, persistence in storage/.

import type { Invitation } from '@malla/protocol';

import type { JoinOutcome, StoredGroup } from './groups/group.ts';
import {
  deleteGroup,
  getActiveGroupId,
  listGroups,
  setActiveGroupId,
} from './groups/group-store.ts';
import { joinGroup, startGroup } from './groups/membership.ts';
import {
  createLocalIdentity,
  loadIdentity,
  saveIdentity,
  type LocalIdentity,
} from './identity/identity.ts';
import type { AppDb } from './storage/app-db.ts';

export class Session {
  // Raw state: these values are stored in IndexedDB, which cannot clone Svelte's proxies.
  identity: LocalIdentity | undefined = $state.raw();
  groups: readonly StoredGroup[] = $state.raw([]);
  activeGroupId: string | undefined = $state();

  readonly activeGroup: StoredGroup | undefined = $derived(
    this.groups.find((group) => group.id === this.activeGroupId),
  );

  readonly #db: AppDb;

  private constructor(db: AppDb) {
    this.#db = db;
  }

  static async load(db: AppDb): Promise<Session> {
    const session = new Session(db);
    session.identity = await loadIdentity(db);
    await session.#refreshGroups();
    return session;
  }

  async createIdentity(alias: string): Promise<void> {
    const identity = createLocalIdentity(alias, Date.now());
    await saveIdentity(this.#db, identity);
    this.identity = identity;
  }

  async createGroup(name: string): Promise<StoredGroup> {
    const group = await startGroup(this.#db, name, Date.now());
    await this.#refreshGroups();
    return group;
  }

  async join(invitation: Invitation): Promise<JoinOutcome> {
    const { outcome } = await joinGroup(this.#db, invitation, Date.now());
    await this.#refreshGroups();
    return outcome;
  }

  async activate(id: string): Promise<void> {
    await setActiveGroupId(this.#db, id);
    this.activeGroupId = id;
  }

  async leave(id: string): Promise<void> {
    await deleteGroup(this.#db, id);
    await this.#refreshGroups();
  }

  async #refreshGroups(): Promise<void> {
    this.groups = await listGroups(this.#db);
    this.activeGroupId = await getActiveGroupId(this.#db);
  }
}
