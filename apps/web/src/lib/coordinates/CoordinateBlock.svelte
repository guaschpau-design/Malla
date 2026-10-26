<!-- A point's coordinates in the chosen format, which can be changed here, and a button to copy
     them. -->
<script lang="ts">
  import type { LatLon } from '@tesel/protocol';

  import type { MessageKey, Translate } from '../i18n/index.ts';
  import type { Preference } from '../settings/preference.svelte.ts';
  import CopyButton from '../ui/CopyButton.svelte';
  import { COORDINATE_FORMATS, formatCoordinate, type CoordinateFormat } from './coordinates.ts';

  interface Props {
    t: Translate;
    at: LatLon;
    format: Preference<CoordinateFormat>;
  }

  let { t, at, format }: Props = $props();

  const NAMES: Readonly<Record<CoordinateFormat, MessageKey>> = {
    decimal: 'formatDecimal',
    dms: 'formatDms',
    utm: 'formatUtm',
    mgrs: 'formatMgrs',
  };

  const text = $derived(formatCoordinate(at, format.value));
</script>

<div class="coordinate">
  <div class="formats" role="radiogroup" aria-label={t('coordinateFormat')}>
    {#each COORDINATE_FORMATS as option (option)}
      <button
        role="radio"
        aria-checked={format.value === option}
        class:current={format.value === option}
        onclick={() => format.set(option)}>{t(NAMES[option])}</button
      >
    {/each}
  </div>
  <div class="row value">
    <output>{text ?? t('formatOutOfRange')}</output>
    {#if text !== null}
      <CopyButton {text} label={t('copy')} copiedLabel={t('copied')} />
    {/if}
  </div>
</div>

<style>
  .coordinate {
    display: grid;
    gap: 0.5rem;
  }

  .formats {
    display: flex;
    gap: 0.25rem;
  }

  .formats button {
    flex: 1;
    padding: 0.3rem 0.4rem;
    font-size: 0.85rem;
  }

  .formats button.current {
    font-weight: 600;
    border-color: var(--accent-line);
  }

  .value {
    align-items: center;
    justify-content: space-between;
  }

  output {
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    font-size: 1.05rem;
    font-variant-numeric: tabular-nums;
  }
</style>
