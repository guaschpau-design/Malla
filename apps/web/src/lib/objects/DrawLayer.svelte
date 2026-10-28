<!-- While drawing or measuring: every tap on the map adds a point, and the path so far is shown. -->
<script lang="ts">
  import type { LatLon } from '@tesel/protocol';
  import type { Map as MapLibreMap } from 'maplibre-gl';
  import { onMount } from 'svelte';

  import { useOverlay } from '../map/overlay.svelte.ts';
  import type { MapTaps } from '../map/taps.ts';
  import { targetLayers } from '../map/target-layers.ts';
  import { themeColor } from '../ui/theme.ts';
  import { draftFeatures } from './draft-features.ts';

  interface Props {
    map: MapLibreMap;
    taps: MapTaps;
    /** The points tapped so far. */
    points: readonly LatLon[];
    /** Whether the path closes on itself, as an area's does. */
    closed: boolean;
    onpoint: (at: LatLon) => void;
  }

  let { map, taps, points, closed, onpoint }: Props = $props();

  const SOURCE = 'tesel-draft';
  const data = $derived(draftFeatures(points, closed));

  // A drawing in progress: a dashed line, and each point as a target (map/target-layers.ts).
  useOverlay(() => map, {
    level: 'draft',
    data: { [SOURCE]: () => data },
    layers: () => [
      {
        id: `${SOURCE}-line`,
        type: 'line',
        source: SOURCE,
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: {
          'line-color': themeColor('map-text'),
          'line-width': 2,
          'line-dasharray': [3, 1.5],
        },
      },
      ...targetLayers(SOURCE, ['==', ['geometry-type'], 'Point']),
    ],
  });

  onMount(() => {
    const release = taps.takeAll((at) => {
      onpoint(at);
    });
    map.getCanvas().style.cursor = 'crosshair';
    return () => {
      release();
      map.getCanvas().style.cursor = '';
    };
  });
</script>
