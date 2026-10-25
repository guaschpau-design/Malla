<!-- While drawing: every tap on the map adds a point, and the drawing so far is previewed. -->
<script lang="ts">
  import type { LatLon } from '@teselia/protocol';
  import type { GeoJSONSource, Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl';
  import { onMount } from 'svelte';

  import { keepInstalled } from '../map/overlay.ts';
  import type { Draft } from './draft.ts';
  import { draftFeatures } from './draft-features.ts';

  interface Props {
    map: MapLibreMap;
    draft: Draft;
    onpoint: (at: LatLon) => void;
  }

  let { map, draft, onpoint }: Props = $props();

  const SOURCE = 'teselia-draft';
  const LAYERS = [`${SOURCE}-line`, `${SOURCE}-point`];
  const data = $derived(draftFeatures(draft));

  function install(): void {
    if (map.getSource(SOURCE) !== undefined) return;
    map.addSource(SOURCE, { type: 'geojson', data });
    map.addLayer({
      id: `${SOURCE}-line`,
      type: 'line',
      source: SOURCE,
      filter: ['==', ['geometry-type'], 'LineString'],
      paint: { 'line-color': '#ea580c', 'line-width': 3, 'line-dasharray': [2, 1] },
    });
    map.addLayer({
      id: `${SOURCE}-point`,
      type: 'circle',
      source: SOURCE,
      filter: ['==', ['geometry-type'], 'Point'],
      paint: {
        'circle-radius': 6,
        'circle-color': '#ea580c',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
      },
    });
  }

  function onClick(event: MapMouseEvent): void {
    onpoint({ lat: event.lngLat.lat, lon: event.lngLat.lng });
  }

  onMount(() => {
    const stopInstalling = keepInstalled(map, install);
    map.on('click', onClick);
    map.getCanvas().style.cursor = 'crosshair';
    return () => {
      stopInstalling();
      map.off('click', onClick);
      map.getCanvas().style.cursor = '';
      for (const id of LAYERS) if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(SOURCE)) map.removeSource(SOURCE);
    };
  });

  // Read `data` first, so the effect depends on it even before the source exists.
  $effect(() => {
    const current = data;
    void map.getSource<GeoJSONSource>(SOURCE)?.setData(current);
  });
</script>
