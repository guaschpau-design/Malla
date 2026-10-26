<!-- Draws the pending tasks that have a place, and opens the one tapped. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import type { Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl';
  import { onMount } from 'svelte';

  import { useOverlay } from '../map/overlay.svelte.ts';
  import { tappedProperty } from '../map/taps.ts';
  import { themeColor } from '../ui/theme.ts';
  import { taskFeatures } from './task-features.ts';

  interface Props {
    map: MapLibreMap;
    groupState: GroupState;
    /** False while drawing or measuring, so taps go there instead. */
    interactive: boolean;
    visible: boolean;
    onselect: (key: string) => void;
  }

  let { map, groupState, interactive, visible, onselect }: Props = $props();

  const SOURCE = 'tesel-tasks';
  const data = $derived(taskFeatures(groupState));

  useOverlay(() => map, {
    level: 'tasks',
    data: { [SOURCE]: () => data },
    visible: () => visible,
    layers: () => {
      const ink = themeColor('map-text');
      const halo = themeColor('map-halo');
      const signal = themeColor('signal');
      return [
        {
          id: `${SOURCE}-dot`,
          type: 'circle',
          source: SOURCE,
          paint: {
            'circle-radius': 7,
            'circle-color': ['case', ['get', 'started'], signal, halo],
            'circle-stroke-width': 3,
            'circle-stroke-color': ink,
          },
        },
        {
          id: `${SOURCE}-label`,
          type: 'symbol',
          source: SOURCE,
          layout: {
            'text-field': ['get', 'label'],
            'text-font': ['Noto Sans Medium'],
            'text-size': 12,
            'text-offset': [0, 1.1],
            'text-anchor': 'top',
            'text-optional': true,
          },
          paint: { 'text-color': ink, 'text-halo-color': halo, 'text-halo-width': 1.5 },
        },
      ];
    },
  });

  function onClick(event: MapMouseEvent): void {
    if (!interactive) return;
    const key = tappedProperty(map, event, [`${SOURCE}-dot`], 'key');
    if (key !== null) onselect(key);
  }

  onMount(() => {
    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
    };
  });
</script>
