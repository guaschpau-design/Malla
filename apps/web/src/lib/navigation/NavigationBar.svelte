<!-- While navigating: where the target is from here, with an arrow that points to it on the map. -->
<script lang="ts">
  import type { LatLon } from '@tesel/protocol';
  import type { Map as MapLibreMap } from 'maplibre-gl';
  import { onMount } from 'svelte';

  import { formatBearing, formatDistance } from '../format.ts';
  import type { Locale, Translate } from '../i18n/index.ts';
  import type { DeviceFix } from '../position/device-location.svelte.ts';
  import MapCard from '../ui/MapCard.svelte';
  import Pictogram from '../ui/Pictogram.svelte';
  import ClimbLine from '../terrain/ClimbLine.svelte';
  import { terrainContext } from '../terrain/terrain-context.ts';
  import { legBetween } from './leg.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    map: MapLibreMap;
    name: string;
    /** Where the target is now; null once it has left the map. */
    target: LatLon | null;
    fix: DeviceFix | null;
    onstop: () => void;
  }

  let { t, locale, map, name, target, fix, onstop }: Props = $props();

  const terrain = terrainContext();

  /** The map may be turned; the arrow points the way on the map as it is shown. */
  let mapBearing = $state(0);
  const leg = $derived(fix && target && legBetween(fix.at, target, fix.accuracy));

  onMount(() => {
    const turned = () => {
      mapBearing = map.getBearing();
    };
    turned();
    map.on('rotate', turned);
    return () => {
      map.off('rotate', turned);
    };
  });
</script>

<MapCard label={t('navigatingTo', { name })}>
  <div class="navigation">
    {#if leg && !leg.arrived}
      <span class="arrow" style:rotate="{leg.bearing - mapBearing}deg">
        <Pictogram name="heading" size={28} />
      </span>
    {/if}
    <div class="what">
      <p class="name">{t('navigatingTo', { name })}</p>
      <p class="hint">
        {#if target === null}
          {t('navigationTargetGone')}
        {:else if leg === null}
          {t('navigationWaitingFix')}
        {:else if leg.arrived}
          {t('navigationArrived')}
        {:else}
          <strong>{formatDistance(leg.metres, locale)}</strong> · {formatBearing(
            leg.bearing,
            locale,
          )}
        {/if}
      </p>
      {#if terrain.reader && fix && target && leg && !leg.arrived}
        <div class="hint"><ClimbLine {t} from={fix.at} to={target} terrain={terrain.reader} /></div>
      {/if}
    </div>
    <button onclick={onstop}>{t('navigationStop')}</button>
  </div>
</MapCard>

<style>
  .navigation {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }

  .arrow {
    display: grid;
    place-items: center;
    color: var(--accent-line);
    transition: rotate 0.3s;
  }

  .what {
    flex: 1;
    min-width: 0;
  }

  .name {
    overflow: hidden;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .hint {
    font-variant-numeric: tabular-nums;
  }
</style>
