<!-- While measuring: the length of the path tapped so far and, from three points, the area it
     would enclose. -->
<script lang="ts">
  import { areaSquareMeters, pathMeters } from '@tesel/core';
  import type { LatLon } from '@tesel/protocol';

  import { formatArea, formatDistance } from '../format.ts';
  import type { Locale, Translate } from '../i18n/index.ts';
  import MapCard from '../ui/MapCard.svelte';

  interface Props {
    t: Translate;
    locale: Locale;
    points: readonly LatLon[];
    onundo: () => void;
    onclose: () => void;
  }

  let { t, locale, points, onundo, onclose }: Props = $props();
</script>

<MapCard>
  {#if points.length < 2}
    <p>{t('measureHint')}</p>
  {:else}
    <p class="measures">
      <strong>{formatDistance(pathMeters(points), locale)}</strong>
      {#if points.length > 2}
        · {t('measureArea', { area: formatArea(areaSquareMeters(points), locale) })}
      {/if}
    </p>
  {/if}
  <div class="row">
    <button onclick={onundo} disabled={points.length === 0}>{t('undo')}</button>
    <button onclick={onclose}>{t('close')}</button>
  </div>
</MapCard>

<style>
  .measures {
    font-variant-numeric: tabular-nums;
  }
</style>
