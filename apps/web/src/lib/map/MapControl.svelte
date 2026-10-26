<!-- Shows its content among the map's own controls (zoom, compass), in one of the map's corners. -->
<script lang="ts">
  import type { ControlPosition, IControl, Map as MapLibreMap } from 'maplibre-gl';
  import { onMount, type Snippet } from 'svelte';

  interface Props {
    map: MapLibreMap;
    position?: ControlPosition;
    children: Snippet;
  }

  let { map, position = 'top-right', children }: Props = $props();

  let element: HTMLDivElement;

  onMount(() => {
    // MapLibre moves the element into its corner, where Svelte keeps updating it and removes it
    // when the component goes, so there is nothing to undo on removal.
    const control: IControl = { onAdd: () => element, onRemove: () => undefined };
    map.addControl(control, position);
    return () => {
      map.removeControl(control);
    };
  });
</script>

<div class="maplibregl-ctrl maplibregl-ctrl-group" bind:this={element}>
  {@render children()}
</div>

<style>
  /* Buttons sized and coloured like MapLibre's own (zoom, compass). */
  div :global(button) {
    display: grid;
    place-items: center;
    padding: 0;
    color: var(--ink);
    border: 0;
    border-radius: 0;
  }

  div :global(button + button) {
    border-top: 1px solid var(--border);
  }
</style>
