<!-- A dock button that opens a menu above the dock, aligned with the dock's right edge so it stays
     on screen. The menu closes when an item that does something calls `close`, when the user taps
     elsewhere or presses Escape; a switch in it leaves it open, so its change is seen. -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  import DockButton from './DockButton.svelte';
  import type { GlyphName } from './glyphs.ts';

  interface Props {
    icon: GlyphName;
    label: string;
    /** The items; those that do something call `close` once chosen. */
    items: Snippet<[close: () => void]>;
  }

  let { icon, label, items }: Props = $props();

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

<div class="dock-menu" bind:this={root}>
  {#if open}
    <div class="menu" role="menu" aria-label={label}>
      {@render items(close)}
    </div>
  {/if}
  <DockButton {icon} {label} expanded={open} onclick={() => (open = !open)} />
</div>

<style>
  /* Not positioned: the menu places itself against the dock. */
  .dock-menu {
    display: flex;
    flex: 1;
  }

  .menu {
    position: absolute;
    z-index: 3;
    right: 0;
    bottom: calc(100% + 0.75rem);
    display: grid;
    gap: 0.25rem;
    width: min(18rem, calc(100vw - 2rem));
    padding: 0.4rem;
    color: var(--fg);
    background: var(--surface);
    border-radius: 0.75rem;
    box-shadow: 0 4px 16px rgb(0 0 0 / 30%);
  }

  /* Items are buttons with a pictogram, a name and, for a choice, its switch. */
  .menu :global(button) {
    display: grid;
    grid-template-columns: auto 1fr;
    grid-auto-flow: column;
    gap: 0.15rem 0.7rem;
    align-items: center;
    text-align: left;
    border-color: transparent;
  }
</style>
