<!-- Draws the other members of the group on the map, and reports taps on them. This device is
     drawn by SelfLayer. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import type { NodeId } from '@tesel/protocol';
  import type { Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl';
  import { onMount } from 'svelte';

  import { themeColor } from '../ui/theme.ts';
  import { memberFeatures } from './member-features.ts';
  import { useOverlay } from './overlay.svelte.ts';
  import { tappedProperty } from './taps.ts';

  interface Props {
    map: MapLibreMap;
    groupState: GroupState;
    self: NodeId;
    /** False while drawing or measuring, so taps go there instead. */
    interactive: boolean;
    visible: boolean;
    onselect: (id: NodeId) => void;
  }

  let { map, groupState, self, interactive, visible, onselect }: Props = $props();

  const SOURCE = 'tesel-members';
  /** Stale markers are re-evaluated this often even when no event arrives. */
  const REFRESH_MS = 30_000;
  let now = $state(Date.now() / 1000);
  const data = $derived(memberFeatures(groupState, self, now));

  useOverlay(() => map, {
    data: { [SOURCE]: () => data },
    visible: () => visible,
    layers: () => {
      const halo = themeColor('map-halo');
      return [
        {
          id: `${SOURCE}-dot`,
          type: 'circle',
          source: SOURCE,
          paint: {
            'circle-radius': 8,
            'circle-color': themeColor('member'),
            'circle-opacity': ['case', ['get', 'stale'], 0.4, 1],
            'circle-stroke-width': 2,
            'circle-stroke-color': halo,
          },
        },
        {
          id: `${SOURCE}-label`,
          type: 'symbol',
          source: SOURCE,
          layout: {
            'text-field': ['get', 'label'],
            'text-font': ['Noto Sans Medium'],
            'text-size': 13,
            'text-offset': [0, 1.3],
            'text-anchor': 'top',
            'text-allow-overlap': true,
          },
          paint: {
            'text-color': themeColor('map-text'),
            'text-halo-color': halo,
            'text-halo-width': 1.5,
            'text-opacity': ['case', ['get', 'stale'], 0.6, 1],
          },
        },
      ];
    },
  });

  function onClick(event: MapMouseEvent): void {
    if (!interactive) return;
    const id = tappedProperty(map, event, [`${SOURCE}-dot`], 'id');
    if (id !== null) onselect(id as NodeId);
  }

  onMount(() => {
    const timer = setInterval(() => (now = Date.now() / 1000), REFRESH_MS);
    map.on('click', onClick);
    return () => {
      clearInterval(timer);
      map.off('click', onClick);
    };
  });
</script>
