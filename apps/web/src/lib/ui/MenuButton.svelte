<!-- A floating button that opens a menu above it. The menu closes when an item is chosen, when
     the user taps elsewhere or presses Escape. -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    /** What the button shows. */
    label: string;
    /** What the button is called for screen readers, when the label alone is not enough. */
    ariaLabel?: string;
    /** The menu's name. */
    title: string;
    /** Lime, for a button whose state is on. */
    on?: boolean;
    /** Wide menus hold items with a line of explanation each. */
    wide?: boolean;
    /** The items; each calls `close` once chosen. */
    items: Snippet<[close: () => void]>;
  }

  let { label, ariaLabel, title, on = false, wide = false, items }: Props = $props();

  let open = $state(false);
  let root: HTMLDivElement;

  function close(): void {
    open = false;
  }

  function onPointerDown(event: PointerEvent): void {
    if (open && event.target instanceof Node && !root.contains(event.target)) close();
  }
</script>

<svelte:window
  onpointerdown={onPointerDown}
  onkeydown={(event: KeyboardEvent) => {
    if (event.key === 'Escape') close();
  }}
/>

<div class="menu-button" bind:this={root}>
  {#if open}
    <div class="menu" class:wide role="menu" aria-label={title}>
      {@render items(close)}
    </div>
  {/if}
  <button
    class="fab"
    class:on
    aria-expanded={open}
    aria-label={ariaLabel}
    onclick={() => (open = !open)}
  >
    {label}
  </button>
</div>

<style>
  .menu-button {
    position: relative;
    pointer-events: auto;
  }

  .menu {
    position: absolute;
    z-index: 3; /* above the neighbouring buttons, which are positioned too */
    right: 0;
    bottom: calc(100% + 0.5rem);
    display: grid;
    gap: 0.25rem;
    min-width: 11rem;
    padding: 0.4rem;
    background: var(--surface);
    border-radius: 0.75rem;
    box-shadow: 0 4px 16px rgb(0 0 0 / 30%);
  }

  .menu.wide {
    width: min(18rem, calc(100vw - 2rem));
  }

  /* Items are buttons; the ones with a line of explanation stack it under their name. */
  .menu :global(button) {
    display: grid;
    gap: 0.15rem;
    text-align: left;
    border-color: transparent;
  }

  .menu :global(button[aria-checked='true']) {
    border-color: var(--accent-line);
  }

  .menu :global(button span) {
    color: var(--muted);
    font-size: 0.85rem;
  }
</style>
