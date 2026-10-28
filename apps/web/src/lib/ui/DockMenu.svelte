<!-- A dock button that opens a menu above the dock, aligned with the dock's right edge so it stays
     on screen. The menu closes when an item that does something calls `close`, when the user taps
     elsewhere or presses Escape; a switch in it leaves it open, so its change is seen. From the
     keyboard, the first item takes the focus, the arrow keys move between items and Escape gives
     the focus back to the button. -->
<script lang="ts">
  import { tick, type Snippet } from 'svelte';

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
  let menu: HTMLDivElement | undefined = $state();

  function close(): void {
    open = false;
  }

  async function toggle(): Promise<void> {
    open = !open;
    if (!open) return;
    await tick();
    menuItems()[0]?.focus();
  }

  function menuItems(): HTMLElement[] {
    return menu ? [...menu.querySelectorAll<HTMLElement>('[role^="menuitem"]')] : [];
  }

  /** Arrow keys go round the items; Home and End to the first and last. */
  function onMenuKey(event: KeyboardEvent): void {
    const all = menuItems();
    const at = all.findIndex((item) => item === document.activeElement);
    const to: Record<string, number> = {
      ArrowDown: (at + 1) % all.length,
      ArrowUp: (at - 1 + all.length) % all.length,
      Home: 0,
      End: all.length - 1,
    };
    const next = to[event.key];
    if (next === undefined || all.length === 0) return;
    event.preventDefault();
    all[next]?.focus();
  }

  function onPointerDown(event: PointerEvent): void {
    if (open && event.target instanceof Node && !root.contains(event.target)) close();
  }
</script>

<svelte:window
  onpointerdown={onPointerDown}
  onkeydown={(event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !open) return;
    close();
    root.querySelector<HTMLElement>(':scope > button')?.focus();
  }}
/>

<div class="dock-menu" bind:this={root}>
  {#if open}
    <div
      class="menu"
      role="menu"
      tabindex="-1"
      aria-label={label}
      bind:this={menu}
      onkeydown={onMenuKey}
    >
      {@render items(close)}
    </div>
  {/if}
  <DockButton {icon} {label} expanded={open} onclick={() => void toggle()} />
</div>

<style>
  /* Not positioned: the menu places itself against the dock. */
  .dock-menu {
    display: flex;
    flex: 1;
  }

  .menu {
    position: absolute;
    z-index: var(--layer-popup);
    right: 0;
    bottom: calc(100% + 0.75rem);
    display: grid;
    gap: 0.25rem;
    width: min(18rem, calc(100vw - 2rem));
    /* A phone held sideways has little height: the menu scrolls rather than leave the map. */
    max-height: calc(100cqh - var(--dock-clearance) - 1.5rem);
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 0.4rem;
    color: var(--fg);
    background: var(--surface);
    border-radius: var(--radius-card);
    box-shadow: var(--shadow-float);
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
