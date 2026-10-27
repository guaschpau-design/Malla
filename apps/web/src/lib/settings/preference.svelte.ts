// A preference of this device: one value, remembered in the settings store, read back with a
// fallback when it was never set or no longer makes sense (a choice a later version dropped).

import type { AppDb, SettingKey } from '../storage/app-db.ts';

export interface PreferenceSpec<T> {
  readonly key: SettingKey;
  readonly fallback: T;
  /** The stored value if it is a valid one, undefined otherwise. */
  read(stored: unknown): T | undefined;
}

/** One of a fixed set of choices. */
export function choice<const T extends string>(
  key: SettingKey,
  choices: readonly T[],
  fallback: NoInfer<T>,
): PreferenceSpec<T> {
  return { key, fallback, read: (stored) => choices.find((option) => option === stored) };
}

/** On or off. */
export function flag(key: SettingKey, fallback: boolean): PreferenceSpec<boolean> {
  return { key, fallback, read: (stored) => (typeof stored === 'boolean' ? stored : undefined) };
}

/** Some of a fixed set of choices; unknown ones are dropped. */
export function subset<const T extends string>(
  key: SettingKey,
  choices: readonly T[],
  fallback: readonly NoInfer<T>[],
): PreferenceSpec<readonly T[]> {
  return {
    key,
    fallback,
    read: (stored) =>
      Array.isArray(stored) ? choices.filter((option) => stored.includes(option)) : undefined,
  };
}

async function loadPreference<T>(db: AppDb, spec: PreferenceSpec<T>): Promise<T> {
  return spec.read(await db.get('settings', spec.key)) ?? spec.fallback;
}

async function savePreference<T>(db: AppDb, spec: PreferenceSpec<T>, value: T): Promise<void> {
  await db.put('settings', value, spec.key);
}

/** A preference the interface reads and changes: `value` is reactive, `set` remembers it. */
export class Preference<T> {
  value: T = $state.raw() as T;

  readonly #db: AppDb;
  readonly #spec: PreferenceSpec<T>;

  private constructor(db: AppDb, spec: PreferenceSpec<T>, value: T) {
    this.#db = db;
    this.#spec = spec;
    this.value = value;
  }

  static async load<T>(db: AppDb, spec: PreferenceSpec<T>): Promise<Preference<T>> {
    return new Preference(db, spec, await loadPreference(db, spec));
  }

  /**
   * Takes effect at once and is stored for the next start. Storing seldom fails; when it does,
   * the choice holds until the app closes, which is better than refusing a switch the user tapped.
   */
  async set(value: T): Promise<void> {
    this.value = value;
    try {
      await savePreference(this.#db, this.#spec, value);
    } catch (error) {
      console.warn('A preference could not be stored', error);
    }
  }
}
