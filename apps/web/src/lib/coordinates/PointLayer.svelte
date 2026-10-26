<!-- Marks the point being looked at in the coordinates panel. -->
<script lang="ts">
  import type { LatLon } from '@tesel/protocol';
  import type { FeatureCollection } from 'geojson';
  import type { Map as MapLibreMap } from 'maplibre-gl';

  import { toPosition } from '../map/geometry.ts';
  import { useOverlay } from '../map/overlay.svelte.ts';
  import { themeColor } from '../ui/theme.ts';

  interface Props {
    map: MapLibreMap;
    point: LatLon;
  }

  let { map, point }: Props = $props();

  const SOURCE = 'tesel-point';

  function features(at: LatLon): FeatureCollection {
    const geometry = { type: 'Point' as const, coordinates: toPosition(at) };
    return { type: 'FeatureCollection', features: [{ type: 'Feature', geometry, properties: {} }] };
  }

  useOverlay(() => map, {
    level: 'point',
    data: { [SOURCE]: () => features(point) },
    layers: () => [
      {
        id: `${SOURCE}-ring`,
        type: 'circle',
        source: SOURCE,
        paint: {
          'circle-radius': 11,
          'circle-color': 'transparent',
          'circle-stroke-width': 3,
          'circle-stroke-color': themeColor('ink'),
        },
      },
      {
        id: `${SOURCE}-centre`,
        type: 'circle',
        source: SOURCE,
        paint: { 'circle-radius': 3, 'circle-color': themeColor('ink') },
      },
    ],
  });
</script>
