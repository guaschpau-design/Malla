<!-- A side panel on wide screens and a bottom sheet on phones. Only one is open at a time. -->
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
    z-index: 2;
    right: 0;
    bottom: 0;
    left: 0;
    max-height: 75dvh;
    overflow-y: auto;
    padding: 1rem 1rem calc(1rem + env(safe-area-inset-bottom));
    background: var(--surface);
    color: var(--fg);
    border-radius: 1rem 1rem 0 0;
    box-shadow: 0 -4px 24px rgb(0 0 0 / 25%);
  }

  @media (min-width: 48rem) {
    .panel {
      top: 4rem;
      right: 1rem;
      bottom: auto;
      left: auto;
      width: 24rem;
      max-height: calc(100dvh - 6rem);
      border-radius: 1rem;
    }
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  h2 {
    margin: 0;
    font-size: 1.15rem;
  }
</style>
