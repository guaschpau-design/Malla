<!-- A short message at the top of the screen. -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();
</script>

<div class="toast" role="status">
  {@render children()}
</div>

<style>
  .toast {
    position: absolute;
    z-index: var(--layer-popup);
    top: 4rem;
    left: 50%;
    display: flex;
    gap: 0.75rem;
    align-items: center;
    max-width: calc(100vw - 2rem);
    padding: 0.6rem 0.9rem;
    color: var(--fg);
    background: var(--surface);
    border-radius: var(--radius-card);
    box-shadow: var(--shadow-float);
    transform: translateX(-50%);
  }
</style>
