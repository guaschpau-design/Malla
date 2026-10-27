<!-- The line between the two ends of a radio line-of-sight check, in the colour of its verdict, and
     a target where the terrain comes closest to it. -->
<script lang="ts">
  import type { LatLon } from '@tesel/protocol';
  import type { FeatureCollection } from 'geojson';
  import type { Map as MapLibreMap } from 'maplibre-gl';

  import { toPosition } from '../map/geometry.ts';
  import { useOverlay } from '../map/overlay.svelte.ts';
  import { targetLayers } from '../map/target-layers.ts';
  import { themeColor } from '../ui/theme.ts';
  import type { Verdict } from './line-of-sight.ts';

  interface Props {
    map: MapLibreMap;
    from: LatLon;
    to: LatLon;
    /** Null while it is being worked out. */
    verdict: Verdict | null;
    /** Where the terrain comes closest, when it matters. */
    worst: LatLon | null;
  }

  let { map, from, to, verdict, worst }: Props = $props();

  const LINE = 'tesel-sight';
  const WORST = 'tesel-sight-worst';

  /** The line, carrying its verdict for the map to colour it; 'unknown' while worked out. */
  function line(a: LatLon, b: LatLon, of: Verdict | null): FeatureCollection {
    const geometry = { type: 'LineString' as const, coordinates: [toPosition(a), toPosition(b)] };
    const properties = { verdict: of ?? 'unknown' };
    return { type: 'FeatureCollection', features: [{ type: 'Feature', geometry, properties }] };
  }

  function points(list: readonly LatLon[]): FeatureCollection {
    return {
      type: 'FeatureCollection',
      features: list.map((at) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: toPosition(at) },
        properties: {},
      })),
    };
  }

  useOverlay(() => map, {
    level: 'sight',
    data: {
      [LINE]: () => line(from, to, verdict),
      [WORST]: () => points(worst ? [worst] : []),
    },
    layers: () => [
      {
        id: `${LINE}-line`,
        type: 'line',
        source: LINE,
        layout: { 'line-cap': 'round' },
        paint: {
          'line-color': [
            'match',
            ['get', 'verdict'],
            'blocked',
            themeColor('danger'),
            'marginal',
            themeColor('warning'),
            'clear',
            themeColor('tone-green'),
            themeColor('muted'),
          ],
          'line-width': 4,
        },
      },
      ...targetLayers(WORST),
    ],
  });
</script>
