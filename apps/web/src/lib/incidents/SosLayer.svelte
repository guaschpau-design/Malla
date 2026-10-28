<!-- Draws the SOS calls still open, where each caller is. They are never hidden. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import type { Map as MapLibreMap } from 'maplibre-gl';

  import { useOverlay } from '../map/overlay.svelte.ts';
  import { themeColor } from '../ui/theme.ts';
  import { sosFeatures } from './sos-features.ts';

  interface Props {
    map: MapLibreMap;
    sos: GroupState['sos'];
    sosCancels: GroupState['sosCancels'];
    members: GroupState['members'];
    positions: GroupState['positions'];
  }

  let { map, sos, sosCancels, members, positions }: Props = $props();

  const SOURCE = 'tesel-sos';

  // Through getters, the calls are worked out again on a new position only while a call follows
  // its sender's position: sosFeatures reads the positions only then.
  const slices = {
    get sos() {
      return sos;
    },
    get sosCancels() {
      return sosCancels;
    },
    get members() {
      return members;
    },
    get positions() {
      return positions;
    },
  };

  useOverlay(() => map, {
    level: 'sos',
    data: { [SOURCE]: () => sosFeatures(slices) },
    layers: () => {
      const danger = themeColor('danger');
      const halo = themeColor('map-halo');
      return [
        {
          id: `${SOURCE}-halo`,
          type: 'circle',
          source: SOURCE,
          paint: { 'circle-radius': 22, 'circle-color': danger, 'circle-opacity': 0.25 },
        },
        {
          id: `${SOURCE}-dot`,
          type: 'circle',
          source: SOURCE,
          paint: {
            'circle-radius': 10,
            'circle-color': danger,
            'circle-stroke-width': 3,
            'circle-stroke-color': halo,
          },
        },
        {
          id: `${SOURCE}-label`,
          type: 'symbol',
          source: SOURCE,
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
</script>
