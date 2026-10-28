<!-- Draws where members have been: a faint line behind each member, this device's in ink. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import type { NodeId } from '@tesel/protocol';
  import type { Map as MapLibreMap } from 'maplibre-gl';

  import { themeColor } from '../ui/theme.ts';
  import { useOverlay } from '../map/overlay.svelte.ts';
  import { trailFeatures } from './trail-features.ts';

  interface Props {
    map: MapLibreMap;
    trails: GroupState['trails'];
    self: NodeId;
    visible: boolean;
  }

  let { map, trails, self, visible }: Props = $props();

  const SOURCE = 'tesel-trails';

  useOverlay(() => map, {
    level: 'trails',
    data: { [SOURCE]: () => trailFeatures({ trails }, self) },
    visible: () => visible,
    layers: () => [
      {
        id: `${SOURCE}-line`,
        type: 'line',
        source: SOURCE,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['case', ['get', 'self'], themeColor('map-text'), themeColor('member')],
          'line-width': 3,
          'line-opacity': 0.55,
        },
      },
    ],
  });
</script>
