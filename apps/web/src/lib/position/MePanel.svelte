<!-- "Me": where this device is, in the chosen coordinate format, and how it shares its position
     with the group. The GPS runs while the panel is open. -->
<script lang="ts">
  import { onMount } from 'svelte';

  import CoordinateBlock from '../coordinates/CoordinateBlock.svelte';
  import type { CoordinateFormat } from '../coordinates/coordinates.ts';
  import { formatDistance } from '../format.ts';
  import type { Locale, MessageKey, Translate } from '../i18n/index.ts';
  import type { Preference } from '../settings/preference.svelte.ts';
  import Panel from '../ui/Panel.svelte';
  import type { DeviceLocation } from './device-location.svelte.ts';
  import { POSITION_MODES, type PositionMode } from './position-mode.ts';
  import type { PositionSharing } from './position-sharing.svelte.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    location: DeviceLocation;
    format: Preference<CoordinateFormat>;
    /** How the position is shared with the active group; null without one. */
    sharing: PositionSharing | null;
    onclose: () => void;
  }

  let { t, locale, location, format, sharing, onclose }: Props = $props();

  const OPTIONS: Readonly<Record<PositionMode, { label: MessageKey; hint: MessageKey }>> = {
    sharing: { label: 'positionShare', hint: 'positionShareHint' },
    paused: { label: 'positionPause', hint: 'positionPauseHint' },
    hidden: { label: 'positionHide', hint: 'positionHideHint' },
  };

  onMount(() => location.use());
</script>

<Panel title={t('me')} closeLabel={t('close')} {onclose}>
  <section class="stack section" aria-labelledby="me-where">
    <h3 id="me-where">{t('whereYouAre')}</h3>
    {#if location.fix}
      <CoordinateBlock {t} at={location.fix.at} {format} />
      {#if location.fix.accuracy !== null}
        <p class="hint">
          {t('accuracyWithin', { distance: formatDistance(location.fix.accuracy, locale) })}
        </p>
      {/if}
    {:else if location.problem}
      <p class="warning">
        {location.problem === 'denied' ? t('locationDenied') : t('locationUnavailable')}
      </p>
    {:else}
      <p class="hint">{t('navigationWaitingFix')}</p>
    {/if}
  </section>

  {#if sharing}
    {@const current = sharing}
    <section class="stack section" aria-labelledby="me-sharing">
      <h3 id="me-sharing">{t('positionTitle')}</h3>
      <div class="options" role="radiogroup" aria-labelledby="me-sharing">
        {#each POSITION_MODES as mode (mode)}
          <button
            role="radio"
            aria-checked={current.mode === mode}
            onclick={() => current.setMode(mode)}
          >
            <strong>{t(OPTIONS[mode].label)}</strong>
            <span class="hint">{t(OPTIONS[mode].hint)}</span>
          </button>
        {/each}
      </div>
    </section>
  {/if}
</Panel>

<style>
  .options {
    display: grid;
    gap: 0.4rem;
  }

  .options button {
    display: grid;
    gap: 0.15rem;
    text-align: left;
  }

  .options button[aria-checked='true'] {
    border-color: var(--accent-line);
    box-shadow: inset 0 0 0 1px var(--accent-line);
  }
</style>
