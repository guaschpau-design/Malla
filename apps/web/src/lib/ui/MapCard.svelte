<!-- A card at the top of the map for what is going on now: drawing, measuring, navigating. The
     workspace stacks it with the incident banners, which share its look (.map-card in app.css). -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    /** A colour of meaning for its edge, e.g. `var(--info)`; none by default. */
    edge?: string | undefined;
    children: Snippet;
  }

  let { edge, children }: Props = $props();
</script>

<div class={['map-card', edge && 'edged']} style:--edge={edge} role="status">
  {@render children()}
</div>
