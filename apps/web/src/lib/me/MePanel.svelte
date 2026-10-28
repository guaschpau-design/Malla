<!-- "Me": what this person tells the team (profile, status, equipment), their battery and tasks,
     and their position: one switch to share it, and where they are. The GPS runs while the panel
     is open. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import type { DutyStatus, Equipment, NodeId, Profile } from '@tesel/protocol';
  import { onMount } from 'svelte';

  import CoordinateBlock from '../coordinates/CoordinateBlock.svelte';
  import { formatDistance } from '../format.ts';
  import type { Locale, MessageKey, Translate } from '../i18n/index.ts';
  import MemberSheet from '../members/MemberSheet.svelte';
  import { accuracyQuality } from '../position/accuracy.ts';
  import { deviceLocation } from '../position/device-location.svelte.ts';
  import type { PositionSharing } from '../position/position-sharing.svelte.ts';
  import type { Preferences } from '../settings/preferences.ts';
  import { pendingFor } from '../tasks/tasks.ts';
  import Panel from '../ui/Panel.svelte';
  import StatusDot from '../ui/StatusDot.svelte';
  import Switch from '../ui/Switch.svelte';
  import type { StatusTone } from '../ui/status-tone.ts';
  import { deviceBattery } from './battery.svelte.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    preferences: Preferences;
    /** The active group and this device in it; null without one. */
    group: {
      readonly state: GroupState;
      readonly self: NodeId;
      readonly sharing: PositionSharing;
    } | null;
    onclose: () => void;
  }

  let { t, locale, preferences, group, onclose }: Props = $props();

  const QUALITY: Readonly<Record<StatusTone, MessageKey>> = {
    good: 'accuracyGood',
    fair: 'accuracyFair',
    poor: 'accuracyPoor',
  };

  const sharing = $derived(group?.sharing ?? null);
  const positionSummary = $derived.by(() => {
    if (sharing === null) return t('positionNoGroup');
    return sharing.mode === 'sharing' ? t('positionSharing') : t('positionNotShared');
  });

  onMount(() => deviceLocation.use());
</script>

<Panel title={t('me')} closeLabel={t('close')} {onclose}>
  <div class="section">
    <MemberSheet
      {t}
      state={{
        profile: preferences.profile.value,
        status: preferences.dutyStatus.value,
        battery: deviceBattery.percent,
        equipment: preferences.equipment.value,
      }}
      edits={{
        onprofile: (profile: Profile) => void preferences.profile.set(profile),
        onstatus: (status: DutyStatus) => void preferences.dutyStatus.set(status),
        onequipment: (equipment: readonly Equipment[]) => void preferences.equipment.set(equipment),
      }}
      batteryNote={deviceBattery.supported ? undefined : t('batteryUnsupported')}
      tasks={group ? pendingFor(group.state, group.self, group.self) : null}
      {positionSummary}
    >
      {#snippet position()}
        {#if sharing}
          {@const current = sharing}
          <button
            class="toggle"
            role="switch"
            aria-checked={current.mode === 'sharing'}
            onclick={() => void current.setMode(current.mode === 'sharing' ? 'paused' : 'sharing')}
          >
            {t('shareMyPosition')}
            <Switch on={current.mode === 'sharing'} />
          </button>
          {#if current.mode !== 'sharing'}
            <button
              class="toggle"
              role="switch"
              aria-checked={current.mode === 'hidden'}
              onclick={() => void current.setMode(current.mode === 'hidden' ? 'paused' : 'hidden')}
            >
              {t('hideLastPosition')}
              <Switch on={current.mode === 'hidden'} />
            </button>
            <p class="hint">
              {current.mode === 'hidden' ? t('positionHiddenHint') : t('positionNotSharedHint')}
            </p>
          {/if}
        {/if}
        {#if deviceLocation.fix}
          <CoordinateBlock {t} at={deviceLocation.fix.at} format={preferences.coordinateFormat} />
          {#if deviceLocation.fix.accuracy !== null}
            {@const quality = accuracyQuality(deviceLocation.fix.accuracy)}
            <p class="accuracy">
              <StatusDot tone={quality} />
              {t('accuracyWithin', {
                distance: formatDistance(deviceLocation.fix.accuracy, locale),
              })}
              · {t(QUALITY[quality])}
            </p>
          {/if}
        {:else if deviceLocation.problem}
          <p class="warning">
            {deviceLocation.problem === 'denied' ? t('locationDenied') : t('locationUnavailable')}
          </p>
        {:else}
          <p class="hint">{t('navigationWaitingFix')}</p>
        {/if}
      {/snippet}
    </MemberSheet>
  </div>
</Panel>

<style>
  .toggle {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    text-align: left;
  }

  .accuracy {
    display: flex;
    gap: 0.45rem;
    align-items: center;
    margin: 0;
  }
</style>
