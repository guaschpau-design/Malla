<script lang="ts">
  import 'maplibre-gl/dist/maplibre-gl.css';

  import { Map as MapLibreMap, NavigationControl, ScaleControl, setWorkerUrl } from 'maplibre-gl';
  // MapLibre loads its worker relative to its own module, which bundling breaks; give Vite
  // the worker as a separate asset instead.
  import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
  import { onMount } from 'svelte';

  import { mapAssetsUrl } from '../config.ts';
  import { buildStyle, type MapTheme } from './style.ts';

  interface Props {
    theme: MapTheme;
    lang: string;
    onready: (map: MapLibreMap) => void;
  }

  let { theme, lang, onready }: Props = $props();

  let container: HTMLDivElement;
  let map: MapLibreMap | undefined = $state();
  let appliedStyle = '';

  // Spain and Portugal, until the user's own position or areas say otherwise.
  const INITIAL_VIEW = { center: [-3.7, 40.2] as [number, number], zoom: 5 };

  onMount(() => {
    setWorkerUrl(maplibreWorkerUrl);
    appliedStyle = `${theme}/${lang}`;
    const instance = new MapLibreMap({
      container,
      style: buildStyle(theme, lang, mapAssetsUrl()),
      ...INITIAL_VIEW,
      attributionControl: { compact: true },
      // Keeps the view in the URL (#map=zoom/lat/lon), so a reload or a shared link keeps it.
      hash: 'map',
    });
    instance.addControl(new NavigationControl({ showCompass: true }), 'top-right');
    instance.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left');
    map = instance;
    onready(instance);
    return () => {
      instance.remove();
    };
  });

  // Restyle when the theme or the label language changes.
  $effect(() => {
    const wanted = `${theme}/${lang}`;
    if (map && wanted !== appliedStyle) {
      appliedStyle = wanted;
      map.setStyle(buildStyle(theme, lang, mapAssetsUrl()));
    }
  });
</script>

<div class="map" bind:this={container}></div>

<style>
  .map {
    position: absolute;
    inset: 0;
  }
</style>
