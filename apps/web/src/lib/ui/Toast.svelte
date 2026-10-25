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
    z-index: 3;
    top: 4rem;
    left: 50%;
    display: flex;
    gap: 0.75rem;
    align-items: center;
    max-width: calc(100vw - 2rem);
    padding: 0.6rem 0.9rem;
    color: var(--fg);
    background: var(--surface);
    border-radius: 0.75rem;
    box-shadow: 0 4px 16px rgb(0 0 0 / 25%);
    transform: translateX(-50%);
  }
</style>
