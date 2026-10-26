<!-- The measuring tool: every tap on the map adds a point to a path whose length is shown. -->
<script lang="ts">
  import type { LatLon } from '@tesel/protocol';
  import type { Map as MapLibreMap } from 'maplibre-gl';
  import { untrack } from 'svelte';

  import type { Locale, Translate } from '../i18n/index.ts';
  import DrawLayer from '../objects/DrawLayer.svelte';
  import MeasureBar from './MeasureBar.svelte';

  interface Props {
    t: Translate;
    locale: Locale;
    map: MapLibreMap;
    /** Where measuring starts, when it starts from a point. */
    from: LatLon | null;
    onclose: () => void;
  }

  let { t, locale, map, from, onclose }: Props = $props();

  // The starting point is read once: measuring goes on from it however the props change.
  let points: readonly LatLon[] = $state.raw(untrack(() => (from ? [from] : [])));
</script>

<!-- A measured path is drawn as a line being drawn would be. -->
<DrawLayer
  {map}
  draft={{ kind: 'line', points }}
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
