<!-- While navigating: a straight line from this device to the target, and the target ringed. -->
<script lang="ts">
  import type { LatLon } from '@tesel/protocol';
  import type { Feature, FeatureCollection } from 'geojson';
  import type { Map as MapLibreMap } from 'maplibre-gl';

  import { toPosition } from '../map/geometry.ts';
  import { useOverlay } from '../map/overlay.svelte.ts';
  import { themeColor } from '../ui/theme.ts';

  interface Props {
    map: MapLibreMap;
    from: LatLon | null;
    to: LatLon | null;
  }

  let { map, from, to }: Props = $props();

  const SOURCE = 'tesel-navigation';

  function features(start: LatLon | null, end: LatLon | null): FeatureCollection {
    const list: Feature[] = [];
    if (end === null) return { type: 'FeatureCollection', features: list };
    if (start !== null) {
      const coordinates = [toPosition(start), toPosition(end)];
      list.push({ type: 'Feature', geometry: { type: 'LineString', coordinates }, properties: {} });
    }
    list.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: toPosition(end) },
      properties: {},
    });
    return { type: 'FeatureCollection', features: list };
  }

  useOverlay(() => map, {
    data: { [SOURCE]: () => features(from, to) },
    layers: () => {
      const ink = themeColor('ink');
      return [
        {
          id: `${SOURCE}-line`,
          type: 'line',
          source: SOURCE,
          filter: ['==', ['geometry-type'], 'LineString'],
          layout: { 'line-cap': 'round' },
          paint: { 'line-color': ink, 'line-width': 3, 'line-dasharray': [0.5, 2] },
        },
        {
          id: `${SOURCE}-target`,
          type: 'circle',
          source: SOURCE,
          filter: ['==', ['geometry-type'], 'Point'],
          paint: {
            'circle-radius': 14,
            'circle-color': 'transparent',
            'circle-stroke-width': 3,
            'circle-stroke-color': themeColor('accent-line'),
          },
        },
      ];
    },
  });
</script>
