<!-- Draws the other members of the group on the map, and reports taps on them. This device is
     drawn by SelfLayer. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import type { NodeId } from '@tesel/protocol';
  import type { Map as MapLibreMap, SymbolLayerSpecification } from 'maplibre-gl';
  import { onMount } from 'svelte';

  import { clockEvery } from '../ui/now.svelte.ts';
  import { themeColor } from '../ui/theme.ts';
  import { memberFeatures } from './member-features.ts';
  import { useOverlay } from '../map/overlay.svelte.ts';
  import { textProperty, type MapTaps } from '../map/taps.ts';

  interface Props {
    map: MapLibreMap;
    taps: MapTaps;
    positions: GroupState['positions'];
    members: GroupState['members'];
    memberStates: GroupState['memberStates'];
    sos: GroupState['sos'];
    sosCancels: GroupState['sosCancels'];
    self: NodeId;
    visible: boolean;
    onselect: (id: NodeId) => void;
  }

  let {
    map,
    taps,
    positions,
    members,
    memberStates,
    sos,
    sosCancels,
    self,
    visible,
    onselect,
  }: Props = $props();

  const SOURCE = 'tesel-members';
  /** Stale markers are re-evaluated this often even when no event arrives. */
  const REFRESH_MS = 30_000;
  const now = clockEvery(REFRESH_MS);
  const data = $derived(
    memberFeatures({ positions, members, memberStates, sos, sosCancels }, self, now.seconds),
  );

  useOverlay(() => map, {
    level: 'members',
    data: { [SOURCE]: () => data },
    visible: () => visible,
    layers: () => {
      const halo = themeColor('map-halo');
      // Names of members close together would pile up into one unreadable word: each name tries
      // below, above and beside its dot, and is left out where none fits. A member calling for
      // help is always named, and placed first (its layer is above), so the others make room.
      const label = (calling: boolean): SymbolLayerSpecification => ({
        id: `${SOURCE}-label${calling ? '-sos' : ''}`,
        type: 'symbol',
        source: SOURCE,
        filter: ['==', ['get', 'sos'], calling],
        layout: {
          'text-field': ['get', 'label'],
          'text-font': ['Noto Sans Medium'],
          'text-size': 13,
          'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
          'text-radial-offset': 1.1,
          'text-allow-overlap': calling,
        },
        paint: {
          'text-color': themeColor('map-text'),
          'text-halo-color': halo,
          'text-halo-width': 1.5,
          'text-opacity': ['case', ['get', 'stale'], 0.6, 1],
        },
      });
      return [
        {
          id: `${SOURCE}-dot`,
          type: 'circle',
          source: SOURCE,
          paint: {
            'circle-radius': 8,
            // Someone resting or off duty is a ring in the member's colour: there, but not now.
            'circle-color': ['case', ['get', 'away'], halo, themeColor('member')],
            'circle-opacity': ['case', ['get', 'stale'], 0.4, 1],
            'circle-stroke-width': ['case', ['get', 'away'], 3, 2],
            'circle-stroke-color': ['case', ['get', 'away'], themeColor('member'), halo],
          },
        },
        label(false),
        label(true),
      ];
    },
  });

  onMount(() =>
    taps.onFeature([`${SOURCE}-dot`], (feature) => {
      const id = textProperty(feature, 'id');
      if (id !== null) onselect(id as NodeId);
    }),
  );
</script>
