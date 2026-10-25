<!-- Draws the group's markers, shapes and active SOS calls, and reports taps on objects. -->
<script lang="ts">
  import type { GroupState } from '@teselia/core';
  import type { GeoJSONSource, Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl';
  import { onMount } from 'svelte';

  import { keepInstalled } from '../map/overlay.ts';
  import { mapObjects } from './object-features.ts';
  import { addSymbolImages } from './symbol-images.ts';

  interface Props {
    map: MapLibreMap;
    groupState: GroupState;
    /** False while drawing, so taps go to the drawing instead. */
    interactive: boolean;
    onselect: (key: string) => void;
  }

  let { map, groupState, interactive, onselect }: Props = $props();

  const MARKERS = 'teselia-markers';
  const SHAPES = 'teselia-shapes';
  const SOS = 'teselia-sos';
  const TAPPABLE = [`${MARKERS}-icon`, `${SHAPES}-fill`, `${SHAPES}-line`];
  const LAYERS = [
    `${SHAPES}-fill`,
    `${SHAPES}-line`,
    `${SHAPES}-label`,
    `${MARKERS}-icon`,
    `${SOS}-halo`,
    `${SOS}-dot`,
    `${SOS}-label`,
  ];

  const data = $derived(mapObjects(groupState));

  function install(): void {
    addSymbolImages(map);
    if (map.getSource(SHAPES) !== undefined) return;
    map.addSource(SHAPES, { type: 'geojson', data: data.shapes });
    map.addSource(MARKERS, { type: 'geojson', data: data.markers });
    map.addSource(SOS, { type: 'geojson', data: data.sos });
    map.addLayer({
      id: `${SHAPES}-fill`,
      type: 'fill',
      source: SHAPES,
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.18 },
    });
    map.addLayer({
      id: `${SHAPES}-line`,
      type: 'line',
      source: SHAPES,
      paint: { 'line-color': ['get', 'color'], 'line-width': 3 },
    });
    map.addLayer({
      id: `${SHAPES}-label`,
      type: 'symbol',
      source: SHAPES,
      layout: {
        'text-field': ['get', 'label'],
        'text-font': ['Noto Sans Medium'],
        'text-size': 12,
        'symbol-placement': 'point',
      },
      paint: {
        'text-color': ['get', 'color'],
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.5,
      },
    });
    map.addLayer({
      id: `${MARKERS}-icon`,
      type: 'symbol',
      source: MARKERS,
      layout: {
        'icon-image': ['get', 'icon'],
        'icon-allow-overlap': true,
        'text-field': ['get', 'label'],
        'text-font': ['Noto Sans Medium'],
        'text-size': 12,
        'text-offset': [0, 1.6],
        'text-anchor': 'top',
        'text-optional': true,
      },
      paint: { 'text-color': '#0f172a', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 },
    });
    map.addLayer({
      id: `${SOS}-halo`,
      type: 'circle',
      source: SOS,
      paint: { 'circle-radius': 22, 'circle-color': '#dc2626', 'circle-opacity': 0.25 },
    });
    map.addLayer({
      id: `${SOS}-dot`,
      type: 'circle',
      source: SOS,
      paint: {
        'circle-radius': 10,
        'circle-color': '#dc2626',
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff',
      },
    });
    map.addLayer({
      id: `${SOS}-label`,
      type: 'symbol',
      source: SOS,
      layout: {
        'text-field': ['concat', 'SOS · ', ['get', 'label']],
        'text-font': ['Noto Sans Medium'],
        'text-size': 13,
        'text-offset': [0, 1.6],
        'text-anchor': 'top',
        'text-allow-overlap': true,
      },
      paint: { 'text-color': '#dc2626', 'text-halo-color': '#ffffff', 'text-halo-width': 2 },
    });
  }

  function onClick(event: MapMouseEvent): void {
    if (!interactive) return;
    const layers = TAPPABLE.filter((id) => map.getLayer(id) !== undefined);
    const [hit] = map.queryRenderedFeatures(event.point, { layers });
    const key: unknown = hit?.properties['key'];
    if (typeof key === 'string') onselect(key);
  }

  onMount(() => {
    const stopInstalling = keepInstalled(map, install);
    map.on('click', onClick);
    return () => {
      stopInstalling();
      map.off('click', onClick);
      for (const id of LAYERS) if (map.getLayer(id)) map.removeLayer(id);
      for (const source of [SHAPES, MARKERS, SOS])
        if (map.getSource(source)) map.removeSource(source);
    };
  });

  // Read `data` first, so the effect depends on it even before the sources exist.
  $effect(() => {
    const { shapes, markers, sos } = data;
    void map.getSource<GeoJSONSource>(SHAPES)?.setData(shapes);
    void map.getSource<GeoJSONSource>(MARKERS)?.setData(markers);
    void map.getSource<GeoJSONSource>(SOS)?.setData(sos);
  });
</script>
