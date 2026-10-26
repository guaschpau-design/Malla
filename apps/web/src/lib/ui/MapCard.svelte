<!-- A card at the top of the map for what is going on now: drawing, measuring, navigating. The
     workspace stacks it with the incident banners. -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();
</script>

<div class="map-card" role="status">
  {@render children()}
</div>

<style>
  .map-card {
    display: grid;
    gap: 0.5rem;
    padding: 0.75rem;
    color: var(--fg);
    background: var(--surface);
    border-radius: 0.75rem;
    pointer-events: auto;
    box-shadow: 0 4px 16px rgb(0 0 0 / 25%);
  }

  .map-card :global(p) {
    margin: 0;
  }
</style>
