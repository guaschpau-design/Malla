<!-- Draws the group's members on the map. Survives restyling (theme or language changes). -->
<script lang="ts">
  import type { GroupState } from '@teselia/core';
  import type { NodeId } from '@teselia/protocol';
  import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
  import { onMount } from 'svelte';

  import { memberFeatures } from './member-features.ts';
  import { keepInstalled } from './overlay.ts';

  interface Props {
    map: MapLibreMap;
    groupState: GroupState;
    self: NodeId;
  }

  let { map, groupState, self }: Props = $props();

  const SOURCE = 'teselia-members';
  /** Stale markers are re-evaluated this often even when no event arrives. */
  const REFRESH_MS = 30_000;
  let now = $state(Date.now() / 1000);
  const data = $derived(memberFeatures(groupState, self, now));

  function install(): void {
    if (map.getSource(SOURCE) !== undefined) return;
    map.addSource(SOURCE, { type: 'geojson', data });
    map.addLayer({
      id: `${SOURCE}-dot`,
      type: 'circle',
      source: SOURCE,
      paint: {
        'circle-radius': 8,
        'circle-color': ['case', ['get', 'self'], '#ea580c', '#2563eb'],
        'circle-opacity': ['case', ['get', 'stale'], 0.4, 1],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
      },
    });
    map.addLayer({
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
        'text-color': '#0f172a',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.5,
        'text-opacity': ['case', ['get', 'stale'], 0.6, 1],
      },
    });
  }

  onMount(() => {
    // A new style removes our layers; put them back whenever the style changes.
    const stopInstalling = keepInstalled(map, install);
    const timer = setInterval(() => (now = Date.now() / 1000), REFRESH_MS);
    return () => {
      clearInterval(timer);
      stopInstalling();
      for (const id of [`${SOURCE}-label`, `${SOURCE}-dot`]) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      if (map.getSource(SOURCE)) map.removeSource(SOURCE);
    };
  });

  // Read `data` before the source: if the source is missing, optional chaining would skip it and
  // the effect would never run again.
  $effect(() => {
    const current = data;
    void map.getSource<GeoJSONSource>(SOURCE)?.setData(current);
  });
</script>
