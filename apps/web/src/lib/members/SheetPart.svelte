<!-- One part of a member's sheet: its title over what it holds, or beside it when that fits on
     one line. Shown whole, never folded: the sheet is read at a glance. -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    /** What it holds fits beside the title. */
    inline?: boolean;
    children: Snippet;
  }

  let { title, inline = false, children }: Props = $props();
</script>

<section class="part" class:inline>
  <h3>{title}</h3>
  <div class="content">{@render children()}</div>
</section>

<style>
  .part {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.45rem;
    padding-top: 0.65rem;
    border-top: 1px solid var(--border);
  }

  .part.inline {
    grid-template-columns: 6.5rem minmax(0, 1fr);
    gap: 0.75rem;
    align-items: center;
  }

  h3 {
    color: var(--muted);
    font-size: var(--text-secondary);
    font-weight: 600;
  }

  .content {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.45rem;
  }

  .content > :global(p) {
    margin: 0;
  }
</style>
