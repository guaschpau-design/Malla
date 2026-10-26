<!-- "Me": first, how this device shows on the group's map — three buttons in a row, and one line
     on the one chosen; then where it is, with how precise the GPS is. The GPS runs while the panel
     is open. -->
<script lang="ts">
  import { onMount } from 'svelte';

  import CoordinateBlock from '../coordinates/CoordinateBlock.svelte';
  import type { CoordinateFormat } from '../coordinates/coordinates.ts';
  import { formatDistance } from '../format.ts';
  import type { Locale, MessageKey, Translate } from '../i18n/index.ts';
  import type { Preference } from '../settings/preference.svelte.ts';
  import type { GlyphName } from '../ui/glyphs.ts';
  import Panel from '../ui/Panel.svelte';
  import Pictogram from '../ui/Pictogram.svelte';
  import StatusDot from '../ui/StatusDot.svelte';
  import type { StatusTone } from '../ui/status-tone.ts';
  import { accuracyQuality } from './accuracy.ts';
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

  const MODES: Readonly<
    Record<PositionMode, { label: MessageKey; hint: MessageKey; icon: GlyphName }>
  > = {
    sharing: { label: 'positionShare', hint: 'positionShareHint', icon: 'locate' },
    paused: { label: 'positionPause', hint: 'positionPauseHint', icon: 'pause' },
    hidden: { label: 'positionHide', hint: 'positionHideHint', icon: 'hidden' },
  };

  const QUALITY: Readonly<Record<StatusTone, MessageKey>> = {
    good: 'accuracyGood',
    fair: 'accuracyFair',
    poor: 'accuracyPoor',
  };

  onMount(() => location.use());
</script>

<Panel title={t('me')} closeLabel={t('close')} {onclose}>
  {#if sharing}
    {@const current = sharing}
    <section class="stack section">
      <div class="modes" role="radiogroup" aria-label={t('positionTitle')}>
        {#each POSITION_MODES as mode (mode)}
          <button
            role="radio"
            class={mode}
            aria-checked={current.mode === mode}
            onclick={() => current.setMode(mode)}
          >
            <Pictogram name={MODES[mode].icon} size={24} />
            {t(MODES[mode].label)}
          </button>
        {/each}
      </div>
      <p class="hint">{t(MODES[current.mode].hint)}</p>
    </section>
  {/if}

  <section class="stack section" aria-labelledby="me-where">
    <h3 id="me-where">{t('whereYouAre')}</h3>
    {#if location.fix}
      <CoordinateBlock {t} at={location.fix.at} {format} />
      {#if location.fix.accuracy !== null}
        {@const quality = accuracyQuality(location.fix.accuracy)}
        <p class="accuracy">
          <StatusDot tone={quality} />
          {t('accuracyWithin', { distance: formatDistance(location.fix.accuracy, locale) })}
          · {t(QUALITY[quality])}
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
</Panel>

<style>
  .modes {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.4rem;
  }

  .modes button {
    display: grid;
    gap: 0.3rem;
    place-items: center;
    padding: 0.7rem 0.3rem;
    font-weight: 600;
    border-width: 2px;
  }

  /* Sharing is lime, like the Me button when it is on; pause and hide are plain. */
  .modes button.sharing[aria-checked='true'] {
    color: var(--on-accent);
    background: var(--signal);
    border-color: var(--signal-deep);
  }

  .modes button[aria-checked='true'] {
    border-color: var(--accent-line);
  }

  .accuracy {
    display: flex;
    gap: 0.45rem;
    align-items: center;
    margin: 0;
  }
</style>
