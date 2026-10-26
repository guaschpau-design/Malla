<!-- While drawing or measuring: every tap on the map adds a point, and the path so far is shown. -->
<script lang="ts">
  import type { LatLon } from '@tesel/protocol';
  import type { Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl';
  import { onMount } from 'svelte';

  import { useOverlay } from '../map/overlay.svelte.ts';
  import { themeColor } from '../ui/theme.ts';
  import type { Draft } from './draft.ts';
  import { draftFeatures } from './draft-features.ts';

  interface Props {
    map: MapLibreMap;
    draft: Draft;
    onpoint: (at: LatLon) => void;
  }

  let { map, draft, onpoint }: Props = $props();

  const SOURCE = 'tesel-draft';
  const data = $derived(draftFeatures(draft));

  // A drawing in progress: an ink dashed line, with this device's lime on its points.
  useOverlay(() => map, {
    data: { [SOURCE]: () => data },
    layers: () => {
      const ink = themeColor('ink');
      return [
        {
          id: `${SOURCE}-line`,
          type: 'line',
          source: SOURCE,
          filter: ['==', ['geometry-type'], 'LineString'],
          paint: { 'line-color': ink, 'line-width': 3, 'line-dasharray': [2, 1] },
        },
        {
          id: `${SOURCE}-point`,
          type: 'circle',
          source: SOURCE,
          filter: ['==', ['geometry-type'], 'Point'],
          paint: {
            'circle-radius': 6,
            'circle-color': themeColor('self'),
            'circle-stroke-width': 2.5,
            'circle-stroke-color': ink,
          },
        },
      ];
    },
  });

  function onClick(event: MapMouseEvent): void {
    onpoint({ lat: event.lngLat.lat, lon: event.lngLat.lng });
  }

  onMount(() => {
    map.on('click', onClick);
    map.getCanvas().style.cursor = 'crosshair';
    return () => {
      map.off('click', onClick);
      map.getCanvas().style.cursor = '';
    };
  });
</script>
