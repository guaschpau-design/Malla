<!-- The measuring tool: every tap on the map adds a point to a path whose length is shown. -->
<script lang="ts">
  import type { LatLon } from '@tesel/protocol';
  import type { Map as MapLibreMap } from 'maplibre-gl';

  import type { Locale, Translate } from '../i18n/index.ts';
  import type { MapTaps } from '../map/taps.ts';
  import DrawLayer from '../objects/DrawLayer.svelte';
  import MeasureBar from './MeasureBar.svelte';

  interface Props {
    t: Translate;
    locale: Locale;
    map: MapLibreMap;
    taps: MapTaps;
    onclose: () => void;
  }

  let { t, locale, map, taps, onclose }: Props = $props();

  let points: readonly LatLon[] = $state.raw([]);
</script>

<DrawLayer
  {map}
  {taps}
  {points}
  closed={false}
  onpoint={(at: LatLon) => {
    points = [...points, at];
  }}
/>
<MeasureBar
  {t}
  {locale}
  {points}
  onundo={() => {
    points = points.slice(0, -1);
  }}
  {onclose}
/>
