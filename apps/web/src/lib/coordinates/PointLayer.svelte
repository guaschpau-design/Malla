<!-- Marks the point being looked at in the point panel, as a target (map/target-layers.ts). -->
<script lang="ts">
  import type { LatLon } from '@tesel/protocol';
  import type { FeatureCollection } from 'geojson';
  import type { Map as MapLibreMap } from 'maplibre-gl';

  import { toPosition } from '../map/geometry.ts';
  import { useOverlay } from '../map/overlay.svelte.ts';
  import { targetLayers } from '../map/target-layers.ts';

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
    layers: () => targetLayers(SOURCE),
  });
</script>
