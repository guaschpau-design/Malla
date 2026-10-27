<!-- The MGRS grid over the map, worked out again for the view each time the map stops moving:
     thin lines with their digits, the 100 km squares named, and the edges of UTM zones. -->
<script lang="ts">
  import type { FeatureCollection } from 'geojson';
  import type { Map as MapLibreMap } from 'maplibre-gl';
  import { onMount } from 'svelte';

  import { useOverlay } from '../map/overlay.svelte.ts';
  import { themeColor } from '../ui/theme.ts';
  import { mgrsGrid } from './mgrs-grid.ts';

  interface Props {
    map: MapLibreMap;
  }

  let { map }: Props = $props();

  const SOURCE = 'tesel-mgrs';
  let grid: FeatureCollection = $state.raw({ type: 'FeatureCollection', features: [] });

  function update(): void {
    const bounds = map.getBounds();
    grid = mgrsGrid({
      west: bounds.getWest(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      north: bounds.getNorth(),
      zoom: map.getZoom(),
    });
  }

  onMount(() => {
    update();
    map.on('moveend', update);
    return () => {
      map.off('moveend', update);
    };
  });

  useOverlay(() => map, {
    level: 'grid',
    data: { [SOURCE]: () => grid },
    layers: () => {
      const text = themeColor('map-text');
      const halo = themeColor('map-halo');
      const labels = {
        'text-color': text,
        'text-halo-color': halo,
        'text-halo-width': 1.5,
      };
      return [
        {
          id: `${SOURCE}-lines`,
          type: 'line',
          source: SOURCE,
          filter: ['==', ['get', 'kind'], 'line'],
          paint: { 'line-color': text, 'line-width': 1, 'line-opacity': 0.45 },
        },
        {
          id: `${SOURCE}-zones`,
          type: 'line',
          source: SOURCE,
          filter: ['==', ['get', 'kind'], 'zone'],
          paint: { 'line-color': text, 'line-width': 2, 'line-opacity': 0.7 },
        },
        {
          id: `${SOURCE}-line-labels`,
          type: 'symbol',
          source: SOURCE,
          filter: ['all', ['==', ['get', 'kind'], 'line'], ['!=', ['get', 'label'], '']],
          layout: {
            'symbol-placement': 'line',
            'symbol-spacing': 300,
            'text-field': ['get', 'label'],
            'text-font': ['Noto Sans Medium'],
            'text-size': 11,
          },
          paint: labels,
        },
        {
          id: `${SOURCE}-squares`,
          type: 'symbol',
          source: SOURCE,
          filter: ['==', ['get', 'kind'], 'square'],
          layout: {
            'text-field': ['get', 'label'],
            'text-font': ['Noto Sans Medium'],
            'text-size': 14,
          },
          paint: { ...labels, 'text-opacity': 0.8 },
        },
      ];
    },
  });
</script>
