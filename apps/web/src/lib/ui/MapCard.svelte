<!-- A card at the top of the map for what is going on now: an incident, drawing, measuring,
     navigating. The workspace stacks them (.map-card in app.css). Each card is a region named by
     what it is about, which screen readers can jump to; none speaks up by itself: alarms are
     announced once, by incidents/SosAlarm.svelte. -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    /** What the card is about, as screen readers name it. */
    label: string;
    /** A colour of meaning for its edge, e.g. `var(--info)`; none by default. */
    edge?: string | undefined;
    children: Snippet;
  }

  let { label, edge, children }: Props = $props();
</script>

<section class={['map-card', edge && 'edged']} style:--edge={edge} aria-label={label}>
  {@render children()}
</section>
