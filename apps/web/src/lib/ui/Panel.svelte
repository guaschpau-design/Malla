<!-- A side panel on wide screens and a sheet above the dock on phones, which leaves the SOS button
     in reach. Only one is open at a time. -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    closeLabel: string;
    onclose: () => void;
    children: Snippet;
  }

  let { title, closeLabel, onclose, children }: Props = $props();

  const titleId = `panel-${crypto.randomUUID()}`;
</script>

<section class="panel" aria-labelledby={titleId}>
  <header>
    <h2 id={titleId}>{title}</h2>
    <button class="icon" onclick={onclose} aria-label={closeLabel}>✕</button>
  </header>
  {@render children()}
</section>

<style>
  .panel {
    position: absolute;
    z-index: var(--layer-panel);
    right: 0.5rem;
    bottom: var(--dock-clearance);
    left: 0.5rem;
    max-height: min(75dvh, calc(100% - var(--dock-clearance) - 0.5rem));
    overflow-y: auto;
    padding: 1rem;
    background: var(--surface);
    color: var(--fg);
    border-radius: var(--radius-sheet);
    box-shadow: var(--shadow-sheet);
  }

  @media (min-width: 48rem) {
    .panel {
      top: 4rem;
      right: 1rem;
      bottom: auto;
      left: auto;
      width: 24rem;
      max-height: calc(100dvh - 6rem);
      border-radius: var(--radius-sheet);
    }
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  h2 {
    margin: 0;
    font-size: var(--text-title);
  }
</style>
