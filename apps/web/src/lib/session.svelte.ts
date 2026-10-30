// Reactive view of who this device is and which groups it belongs to. Components read it and
// call its methods; the rules live in identity/ and groups/, persistence in storage/.

import type { Invitation, Role } from '@tesel/protocol';

import { deleteLeftovers } from './events/event-log.ts';
import type { JoinOutcome, StoredGroup } from './groups/group.ts';
import {
  getActiveGroupId,
  getGroup,
  listGroups,
  rememberBeforePractice,
  setActiveGroupId,
  takeBeforePractice,
} from './groups/group-store.ts';
import { joinGroup, leaveGroup, startGroup, startPractice } from './groups/membership.ts';
import { createLocalIdentity, type LocalIdentity } from './identity/identity.ts';
import type { Situation } from './practice/situations.ts';
import { loadIdentity, saveIdentity } from './identity/identity-store.ts';
import type { AppDb } from './storage/app-db.ts';
import { keepStorage } from './storage/storage-space.svelte.ts';

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
    // A practice lasts while the app is open: one left from before is over, and the group used
    // before it is in use again.
    await session.#endPractice();
    await session.#refreshGroups();
    await deleteLeftovers(
      db,
      session.groups.map((group) => group.id),
    );
    return session;
  }

  /**
   * Creates this device's identity. From then on the device holds what cannot be had again, so
   * the browser is asked to keep its storage; and again on joining a group, as the browser may
   * have said no the first time and say yes once the app is used more.
   */
  async createIdentity(alias: string): Promise<void> {
    const identity = createLocalIdentity(alias, Date.now());
    await saveIdentity(this.#db, identity);
    this.identity = identity;
    await keepStorage();
  }

  /** This device goes by another name. Each group learns it as it is next opened (MEMBER_INFO). */
  async renameIdentity(alias: string): Promise<void> {
    if (this.identity === undefined) return;
    const identity = { ...this.identity, alias };
    await saveIdentity(this.#db, identity);
    this.identity = identity;
  }

  async createGroup(name: string, server: string | null): Promise<StoredGroup> {
    const group = await startGroup(this.#db, name, server, Date.now());
    await this.#refreshGroups();
    await keepStorage();
    return group;
  }

  /**
   * Starts a practice of a situation in a new practice group, which becomes the active group, with
   * the user as a member or as its coordinator.
   */
  async startPractice(name: string, situation: Situation, role: Role): Promise<void> {
    await this.endPractice();
    await rememberBeforePractice(this.#db, this.activeGroupId);
    await startPractice(this.#db, name, { situation, role }, Date.now());
    await this.#refreshGroups();
  }

  /** Ends the practice, if there is one: its group is forgotten and the one before is active again. */
  async endPractice(): Promise<void> {
    await this.#endPractice();
    await this.#refreshGroups();
  }

  async #endPractice(): Promise<void> {
    const practices = (await listGroups(this.#db)).filter((group) => group.practice);
    if (practices.length === 0) return;
    for (const practice of practices) await leaveGroup(this.#db, practice.id);
    const before = await takeBeforePractice(this.#db);
    if (before !== undefined && (await getGroup(this.#db, before))) {
      await setActiveGroupId(this.#db, before);
    }
  }

  async join(invitation: Invitation): Promise<JoinOutcome> {
    const { outcome } = await joinGroup(this.#db, invitation, Date.now());
    await this.#refreshGroups();
    await keepStorage();
    return outcome;
  }

  async activate(id: string): Promise<void> {
    await setActiveGroupId(this.#db, id);
    await this.#refreshGroups();
  }

  async leave(id: string): Promise<void> {
    await leaveGroup(this.#db, id);
    await this.#refreshGroups();
  }

  /**
   * Reads the groups again. A practice lasts while its group is the one in use: once another is,
   * the practice is over and forgotten, so that its teammates never start it over.
   */
  async #refreshGroups(): Promise<void> {
    const active = await getActiveGroupId(this.#db);
    for (const group of await listGroups(this.#db)) {
      if (group.practice === undefined || group.id === active) continue;
      await leaveGroup(this.#db, group.id);
      await rememberBeforePractice(this.#db, undefined);
    }
    this.groups = await listGroups(this.#db);
    this.activeGroupId = active;
  }
}
