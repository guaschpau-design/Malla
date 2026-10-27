<!-- A point's coordinates, large, with a button to copy them. The format (degrees, UTM…) is a small
     drop-down beside it: chosen once and remembered everywhere. -->
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
  <output>{text ?? t('formatOutOfRange')}</output>
  <div class="tools">
    <select
      aria-label={t('coordinateFormat')}
      value={format.value}
      onchange={(event) => format.set(event.currentTarget.value as CoordinateFormat)}
    >
      {#each COORDINATE_FORMATS as option (option)}
        <option value={option}>{t(NAMES[option])}</option>
      {/each}
    </select>
    {#if text !== null}
      <CopyButton {text} label={t('copy')} copiedLabel={t('copied')} />
    {/if}
  </div>
</div>

<style>
  .coordinate {
    display: grid;
    gap: 0.4rem;
  }

  output {
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    font-size: var(--text-title);
    font-variant-numeric: tabular-nums;
  }

  .tools {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  select {
    width: auto;
    padding: 0.3rem 0.5rem;
    font-size: var(--text-secondary);
  }
</style>
