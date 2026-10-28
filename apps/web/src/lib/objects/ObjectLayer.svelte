<!-- Draws the group's markers and shapes, and reports taps on them. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import type { Map as MapLibreMap } from 'maplibre-gl';
  import { onMount } from 'svelte';

  import { useOverlay } from '../map/overlay.svelte.ts';
  import { textProperty, type MapTaps } from '../map/taps.ts';
  import { themeColor, toneExpression } from '../ui/theme.ts';
  import { markerFeatures, shapeFeatures } from './object-features.ts';
  import { addSymbolImages } from './symbol-images.ts';

  interface Props {
    map: MapLibreMap;
    taps: MapTaps;
    objects: GroupState['objects'];
    /** Whether markers and shapes are shown. */
    visible: boolean;
    onselect: (key: string) => void;
  }

  let { map, taps, objects, visible, onselect }: Props = $props();

  const MARKERS = 'tesel-markers';
  const SHAPES = 'tesel-shapes';

  useOverlay(() => map, {
    level: 'objects',
    data: {
      [SHAPES]: () => shapeFeatures({ objects }),
      [MARKERS]: () => markerFeatures({ objects }),
    },
    visible: () => visible,
    prepare: () => {
      addSymbolImages(map);
    },
    layers: () => {
      const tone = toneExpression();
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
      ];
    },
  });

  onMount(() =>
    taps.onFeature([`${MARKERS}-icon`, `${SHAPES}-fill`, `${SHAPES}-line`], (feature) => {
      const key = textProperty(feature, 'key');
      if (key !== null) onselect(key);
    }),
  );
</script>
