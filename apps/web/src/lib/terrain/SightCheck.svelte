<!-- The radio line of sight from a point to another, tapped on the map or this device: whether the
     terrain lets a LoRa signal through (line-of-sight.ts), with the height of each antenna, and the
     line on the map. Taps on the map move the other end. -->
<script lang="ts">
  import type { LatLon } from '@tesel/protocol';
  import type { Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl';
  import { onMount } from 'svelte';

  import { formatDistance } from '../format.ts';
  import type { Locale, MessageKey, Translate } from '../i18n/index.ts';
  import type { DeviceLocation } from '../position/device-location.svelte.ts';
  import MapCard from '../ui/MapCard.svelte';
  import { lineOfSight, sightSamples, type Sight, type Verdict } from './line-of-sight.ts';
  import SightLayer from './SightLayer.svelte';
  import { terrainContext } from './terrain-context.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    map: MapLibreMap;
    /** The point the check starts from. */
    from: LatLon;
    location: DeviceLocation;
    onclose: () => void;
  }

  let { t, locale, map, from, location, onclose }: Props = $props();

  /** Antenna heights to choose from, in metres: in hand, on a vehicle or a roof, on a mast. */
  const HEIGHTS = [1.5, 5, 10, 30] as const;
  const VERDICTS: Readonly<Record<Verdict, { title: MessageKey; edge: string }>> = {
    blocked: { title: 'sightBlocked', edge: 'var(--danger)' },
    marginal: { title: 'sightMarginal', edge: 'var(--warning)' },
    clear: { title: 'sightClear', edge: 'var(--tone-green)' },
  };

  const terrain = terrainContext();
  let to = $state.raw<LatLon | null>(null);
  let fromHeight: number = $state(HEIGHTS[0]);
  let toHeight: number = $state(HEIGHTS[0]);
  /** The answer, null while worked out; 'unknown' where there is no elevation data. */
  let sight = $state.raw<Sight | 'unknown' | null>(null);
  /** Only the latest request may set the answer; an older one may arrive later. */
  let latest = 0;

  $effect(() => {
    const reader = terrain.onRequest;
    if (to === null || reader === null) return;
    const a = { at: from, height: fromHeight };
    const b = { at: to, height: toHeight };
    const samples = sightSamples(a.at, b.at);
    const request = ++latest;
    sight = null;
    void reader.elevations(samples).then((ground) => {
      if (request === latest) sight = lineOfSight(a, b, samples, ground) ?? 'unknown';
    });
  });

  function onClick(event: MapMouseEvent): void {
    to = { lat: event.lngLat.lat, lon: event.lngLat.lng };
  }

  onMount(() => {
    map.on('click', onClick);
    map.getCanvas().style.cursor = 'crosshair';
    return () => {
      map.off('click', onClick);
      map.getCanvas().style.cursor = '';
    };
  });

  const known = $derived(sight !== null && sight !== 'unknown' ? sight : null);
  const metres = (value: number) => formatDistance(Math.abs(value), locale);
</script>

{#snippet heightChoice(label: string, value: number, onchange: (height: number) => void)}
  <label>
    {label}
    <select
      {value}
      onchange={(event) => {
        onchange(Number(event.currentTarget.value));
      }}
    >
      {#each HEIGHTS as height (height)}
        <option value={height}
          >{t('antennaHeight', { metres: height.toLocaleString(locale) })}</option
        >
      {/each}
    </select>
  </label>
{/snippet}

{#if to}
  <SightLayer
    {map}
    {from}
    {to}
    verdict={known?.verdict ?? null}
    worst={known && known.verdict !== 'clear' ? known.worst.at : null}
  />
{/if}

<MapCard edge={known ? VERDICTS[known.verdict].edge : undefined}>
  {#if to === null}
    <p>{t('sightPickEnd')}</p>
  {:else if sight === null}
    <p>{t('sightWorking')}</p>
  {:else if sight === 'unknown'}
    <p>{t('sightNoData')}</p>
  {:else}
    <strong>{t(VERDICTS[sight.verdict].title)} · {formatDistance(sight.distance, locale)}</strong>
    <p class="detail">
      {sight.verdict === 'blocked'
        ? t('sightBlockedBy', { metres: metres(sight.worst.clearance) })
        : sight.verdict === 'clear'
          ? t('sightClearNote')
          : sight.worst.clearance < 0
            ? t('sightMarginalTouch')
            : t('sightMarginalRoom', { metres: metres(sight.worst.clearance) })}
    </p>
  {/if}
  <div class="heights">
    {@render heightChoice(t('sightHere'), fromHeight, (height) => (fromHeight = height))}
    {@render heightChoice(t('sightThere'), toHeight, (height) => (toHeight = height))}
  </div>
  <div class="row">
    {#if location.fix}
      {@const here = location.fix.at}
      <button onclick={() => (to = here)}>{t('sightFromMe')}</button>
    {/if}
    <button onclick={onclose}>{t('close')}</button>
  </div>
</MapCard>

<style>
  .detail {
    color: var(--muted);
    font-size: var(--text-secondary);
  }

  .heights {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }
</style>
