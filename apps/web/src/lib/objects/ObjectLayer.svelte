<!-- Draws the group's markers, shapes and active SOS calls, and reports taps on objects. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import type { Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl';
  import { onMount } from 'svelte';

  import { useOverlay } from '../map/overlay.svelte.ts';
  import { tappedProperty } from '../map/taps.ts';
  import { themeColor, toneExpression } from '../ui/theme.ts';
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

  const MARKERS = 'tesel-markers';
  const SHAPES = 'tesel-shapes';
  const SOS = 'tesel-sos';
  const TAPPABLE = [`${MARKERS}-icon`, `${SHAPES}-fill`, `${SHAPES}-line`];

  const data = $derived(mapObjects(groupState));

  useOverlay(() => map, {
    data: { [SHAPES]: () => data.shapes, [MARKERS]: () => data.markers, [SOS]: () => data.sos },
    prepare: () => {
      addSymbolImages(map);
    },
    layers: () => {
      const tone = toneExpression();
      const danger = themeColor('danger');
      const text = themeColor('map-text');
      const halo = themeColor('map-halo');
      return [
        {
          id: `${SHAPES}-fill`,
          type: 'fill',
          source: SHAPES,
          filter: ['==', ['geometry-type'], 'Polygon'],
          paint: { 'fill-color': tone, 'fill-opacity': 0.18 },
        },
        {
          id: `${SHAPES}-line`,
          type: 'line',
          source: SHAPES,
          paint: { 'line-color': tone, 'line-width': 3 },
        },
        {
          id: `${SHAPES}-label`,
          type: 'symbol',
          source: SHAPES,
          layout: {
            'text-field': ['get', 'label'],
            'text-font': ['Noto Sans Medium'],
            'text-size': 12,
            'symbol-placement': 'point',
          },
          paint: { 'text-color': tone, 'text-halo-color': halo, 'text-halo-width': 1.5 },
        },
        {
          id: `${MARKERS}-icon`,
          type: 'symbol',
          source: MARKERS,
          layout: {
            'icon-image': ['get', 'icon'],
            'icon-allow-overlap': true,
            'text-field': ['get', 'label'],
            'text-font': ['Noto Sans Medium'],
            'text-size': 12,
            'text-offset': [0, 1.5],
            'text-anchor': 'top',
            'text-optional': true,
          },
          paint: { 'text-color': text, 'text-halo-color': halo, 'text-halo-width': 1.5 },
        },
        {
          id: `${SOS}-halo`,
          type: 'circle',
          source: SOS,
          paint: { 'circle-radius': 22, 'circle-color': danger, 'circle-opacity': 0.25 },
        },
        {
          id: `${SOS}-dot`,
          type: 'circle',
          source: SOS,
          paint: {
            'circle-radius': 10,
            'circle-color': danger,
            'circle-stroke-width': 3,
            'circle-stroke-color': halo,
          },
        },
        {
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
          paint: { 'text-color': danger, 'text-halo-color': halo, 'text-halo-width': 2 },
        },
      ];
    },
  });

  function onClick(event: MapMouseEvent): void {
    if (!interactive) return;
    const key = tappedProperty(map, event, TAPPABLE, 'key');
    if (key !== null) onselect(key);
  }

  onMount(() => {
    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
    };
  });
</script>
