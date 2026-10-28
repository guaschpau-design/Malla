// Keeps the active group told what this person has set in Me (profile, status, equipment) and how
// much battery the device has, in steps of 10 % so the radio is not kept busy with every percent.

import { untrack } from 'svelte';

import type { Preferences } from '../settings/preferences.ts';
import type { GroupFeed } from '../sync/group-feed.svelte.ts';
import { storageRefusals } from '../storage/storage-space.svelte.ts';
import { deviceBattery } from './battery.svelte.ts';

/** Battery is told in steps this big, in percent. */
const BATTERY_STEP = 10;

export function useSelfState(feed: () => GroupFeed | null, preferences: () => Preferences): void {
  deviceBattery.watch();
  $effect(() => {
    const current = feed();
    if (current === null) return;
    const { profile, dutyStatus, equipment } = preferences();
    const percent = deviceBattery.percent;
    const state = {
      profile: profile.value,
      status: dutyStatus.value,
      battery: percent === null ? null : Math.floor(percent / BATTERY_STEP) * BATTERY_STEP,
      equipment: equipment.value,
    };
    // Only what is set here starts a change; what the group receives does not.
    untrack(() => current.shareState(state)).catch((error: unknown) => {
      console.warn('Sharing this member’s state failed', error);
      storageRefusals.note(error);
    });
  });
}
