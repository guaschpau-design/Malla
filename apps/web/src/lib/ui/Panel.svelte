<!-- A side panel on wide screens and a sheet above the dock on phones, which leaves the SOS button
     in reach. Only one is open at a time. Opening it takes the keyboard's focus into it, Escape
     closes it, and closing gives the focus back to what had it before, such as the button that
     opened it. -->
<script lang="ts">
  import { onMount, type Snippet } from 'svelte';

  interface Props {
    title: string;
    closeLabel: string;
    onclose: () => void;
    children: Snippet;
  }

  let { title, closeLabel, onclose, children }: Props = $props();

  const titleId = `panel-${crypto.randomUUID()}`;
  let panel: HTMLElement;

  onMount(() => {
    const opener = document.activeElement;
    // A field the panel focuses by itself (autofocus) keeps the focus.
    if (!panel.contains(opener)) panel.focus();
    return () => {
      // Only while the focus is still here, or was lost with the panel: when another panel opens
      // in its place, the focus is already where it should be.
      const focused = document.activeElement;
      const lost = focused === null || focused === document.body || panel.contains(focused);
      if (lost && opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  });
</script>

<!-- Escape from any control inside reaches the panel: the panel itself is no control. -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section
  class="panel"
  aria-labelledby={titleId}
  tabindex="-1"
  bind:this={panel}
  onkeydown={(event: KeyboardEvent) => {
    if (event.key === 'Escape') onclose();
  }}
>
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
    right: max(0.5rem, env(safe-area-inset-right));
    bottom: var(--dock-clearance);
    left: max(0.5rem, env(safe-area-inset-left));
    max-height: min(75dvh, calc(100% - var(--dock-clearance) - 0.5rem));
    overflow-y: auto;
    padding: 1rem;
    background: var(--surface);
    color: var(--fg);
    border-radius: var(--radius-sheet);
    box-shadow: var(--shadow-sheet);
  }

  /* The panel takes the focus only to hand it on: the ring is for what can be used. */
  .panel:focus {
    outline: none;
  }

  @media (min-width: 48rem) {
    .panel {
      top: 4rem;
      right: max(1rem, env(safe-area-inset-right));
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
