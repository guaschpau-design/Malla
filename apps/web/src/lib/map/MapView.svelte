<script lang="ts">
  import 'maplibre-gl/dist/maplibre-gl.css';

  import { Map as MapLibreMap, setWorkerUrl } from 'maplibre-gl';
  // MapLibre loads its worker relative to its own module, which bundling breaks; give Vite
  // the worker as a separate asset instead.
  import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
  import { onMount } from 'svelte';

  import { mapAssetsUrl } from '../config.ts';
  import { buildStyle, type StyleChoice } from './style.ts';

  interface Props {
    /** What the map looks like: base map, relief, theme and the language of its names. */
    choice: StyleChoice;
    onready: (map: MapLibreMap) => void;
  }

  let { choice, onready }: Props = $props();

  let container: HTMLDivElement;
  let map: MapLibreMap | undefined = $state();
  let appliedStyle = '';
  /**
   * Whether the map is still loading, moving or drawing, until it settles: told to assistive
   * technology through aria-busy, which end-to-end tests wait on too.
   */
  let busy = $state(true);

  // Spain and Portugal, until the user's own position or areas say otherwise.
  const INITIAL_VIEW = { center: [-3.7, 40.2] as [number, number], zoom: 5 };

  onMount(() => {
    setWorkerUrl(maplibreWorkerUrl);
    appliedStyle = JSON.stringify(choice);
    const instance = new MapLibreMap({
      container,
      style: buildStyle(choice, mapAssetsUrl()),
      ...INITIAL_VIEW,
      // The credits are shown by MapCredits and in the layers panel, the scale by MapScale.
      attributionControl: false,
      // Keeps the view in the URL (#map=zoom/lat/lon), so a reload or a shared link keeps it.
      hash: 'map',
    });
    const startBusy = () => (busy = true);
    instance.on('dataloading', startBusy);
    instance.on('movestart', startBusy);
    instance.on('idle', () => (busy = false));
    map = instance;
    onready(instance);
    return () => {
      instance.remove();
    };
  });

  // Restyle when any of the choice changes.
  $effect(() => {
    const wanted = JSON.stringify(choice);
    if (map && wanted !== appliedStyle) {
      appliedStyle = wanted;
      map.setStyle(buildStyle(choice, mapAssetsUrl()));
    }
  });
</script>

<div class="map" aria-busy={busy} bind:this={container}></div>

<style>
  .map {
    position: absolute;
    inset: 0;
  }

  /* The map's controls stay clear of a notch when the phone is held sideways. */
  .map :global(.maplibregl-ctrl-top-right) {
    right: env(safe-area-inset-right);
  }
</style>
