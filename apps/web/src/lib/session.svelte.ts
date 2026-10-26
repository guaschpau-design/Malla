// Reactive view of who this device is and which groups it belongs to. Components read it and
// call its methods; the rules live in identity/ and groups/, persistence in storage/.

import type { Invitation } from '@tesel/protocol';

import type { JoinOutcome, StoredGroup } from './groups/group.ts';
import { getActiveGroupId, listGroups, setActiveGroupId } from './groups/group-store.ts';
import { joinGroup, leaveGroup, startGroup, startPractice } from './groups/membership.ts';
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
  /** The group that was active before a practice started, to go back to when it ends. */
  #beforePractice: string | undefined;

  private constructor(db: AppDb) {
    this.#db = db;
  }

  static async load(db: AppDb): Promise<Session> {
    const session = new Session(db);
    session.identity = await loadIdentity(db);
    // A practice lasts while the app is open: one left from before is over.
    for (const group of await listGroups(db)) {
      if (group.practice) await leaveGroup(db, group.id);
    }
    await session.#refreshGroups();
    return session;
  }

  async createIdentity(alias: string): Promise<void> {
    const identity = createLocalIdentity(alias, Date.now());
    await saveIdentity(this.#db, identity);
    this.identity = identity;
  }

  async createGroup(name: string, server: string | null): Promise<StoredGroup> {
    const group = await startGroup(this.#db, name, server, Date.now());
    await this.#refreshGroups();
    return group;
  }

  /** Starts a practice in a new practice group, which becomes the active group. */
  async startPractice(name: string): Promise<void> {
    await this.endPractice();
    this.#beforePractice = this.activeGroupId;
    await startPractice(this.#db, name, Date.now());
    await this.#refreshGroups();
  }

  /** Ends the practice, if there is one: its group is forgotten and the one before is active again. */
  async endPractice(): Promise<void> {
    const practice = this.groups.find((group) => group.practice);
    if (practice === undefined) return;
    await leaveGroup(this.#db, practice.id);
    if (this.#beforePractice !== undefined) await setActiveGroupId(this.#db, this.#beforePractice);
    this.#beforePractice = undefined;
    await this.#refreshGroups();
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
    await leaveGroup(this.#db, id);
    await this.#refreshGroups();
  }

  async #refreshGroups(): Promise<void> {
    this.groups = await listGroups(this.#db);
    this.activeGroupId = await getActiveGroupId(this.#db);
  }
}
