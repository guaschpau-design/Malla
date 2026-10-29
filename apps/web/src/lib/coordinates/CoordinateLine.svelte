<!-- A point's coordinates, in the format chosen in Me, on one line that copies them with a tap. -->
<script lang="ts">
  import type { LatLon } from '@tesel/protocol';

  import type { Translate } from '../i18n/index.ts';
  import type { Preference } from '../settings/preference.svelte.ts';
  import { Copier } from '../ui/copier.svelte.ts';
  import { formatCoordinate, type CoordinateFormat } from './coordinates.ts';

  interface Props {
    t: Translate;
    at: LatLon;
    format: Preference<CoordinateFormat>;
  }

  let { t, at, format }: Props = $props();

  const text = $derived(formatCoordinate(at, format.value));
  const copier = new Copier();
</script>

{#if text === null}
  <p class="hint">{t('formatOutOfRange')}</p>
{:else}
  {@const written = text}
  <button
    class="coordinate"
    aria-label="{t('copy')}: {written}"
    onclick={() => {
      copier.copy(written, t('copyFailed'));
    }}
  >
    <output>{written}</output>
    <span class="hint">{copier.copied ? t('copied') : t('copy')}</span>
  </button>
{/if}

<style>
  .coordinate {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 0.6rem;
    align-items: baseline;
    justify-content: space-between;
    min-height: 0;
    padding: 0.35rem 0.6rem;
    text-align: left;
    border-color: var(--border);
  }

  output {
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    font-variant-numeric: tabular-nums;
  }

  .hint {
    font-size: var(--text-small);
  }
</style>
