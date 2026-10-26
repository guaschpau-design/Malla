<!-- The regions under an official weather warning, tinted and outlined in the colour of their
     level, beneath everything else on the map. -->
<script lang="ts">
  import type { Map as MapLibreMap } from 'maplibre-gl';

  import { useOverlay } from '../map/overlay.svelte.ts';
  import { toneExpression } from '../ui/theme.ts';
  import { regionFeatures, type ActiveRegion } from './weather-warnings.ts';

  interface Props {
    map: MapLibreMap;
    regions: readonly ActiveRegion[];
    visible: boolean;
  }

  let { map, regions, visible }: Props = $props();

  const SOURCE = 'tesel-weather';

  useOverlay(() => map, {
    level: 'weather',
    data: { [SOURCE]: () => regionFeatures(regions) },
    visible: () => visible,
    layers: () => [
      {
        id: 'tesel-weather-fill',
        type: 'fill',
        source: SOURCE,
        paint: { 'fill-color': toneExpression(), 'fill-opacity': 0.12 },
      },
      {
        id: 'tesel-weather-line',
        type: 'line',
        source: SOURCE,
        paint: { 'line-color': toneExpression(), 'line-width': 1.5, 'line-opacity': 0.8 },
      },
    ],
  });
</script>
