<!-- The card at the top of the map while a tool takes the taps on it (drawing, measuring): one short
     line of what to do or what there is so far, then small buttons with pictograms (undo, what else
     the tool can do, cancel) and, when the tool ends with something made, the button that finishes
     it. Short, so the map stays in view. -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  import MapCard from './MapCard.svelte';
  import Pictogram from './Pictogram.svelte';

  interface Props {
    /** What the card is about, as screen readers name it. */
    label: string;
    undoLabel: string;
    canUndo: boolean;
    onundo: () => void;
    closeLabel: string;
    onclose: () => void;
    /** The button that ends the tool with what it made; none for a tool that only shows. */
    finish?:
      { readonly label: string; readonly disabled: boolean; readonly run: () => void } | undefined;
    /** Other small buttons of the tool, between undo and close. */
    tools?: Snippet;
    /** The line of what to do or what there is, and any warning. */
    children: Snippet;
  }

  let { label, undoLabel, canUndo, onundo, closeLabel, onclose, finish, tools, children }: Props =
    $props();
</script>

<MapCard {label}>
  <div class="text">{@render children()}</div>
  <div class="controls">
    <button
      class="icon"
      aria-label={undoLabel}
      title={undoLabel}
      disabled={!canUndo}
      onclick={onundo}
    >
      <Pictogram name="undo" size={22} />
    </button>
    {@render tools?.()}
    <button class="icon" aria-label={closeLabel} title={closeLabel} onclick={onclose}>✕</button>
    {#if finish}
      <button class="primary finish" disabled={finish.disabled} onclick={finish.run}>
        {finish.label}
      </button>
    {/if}
  </div>
</MapCard>

<style>
  .text {
    display: grid;
    gap: 0.25rem;
  }

  .text :global(p) {
    margin: 0;
  }

  .controls {
    display: flex;
    gap: 0.25rem;
    align-items: center;
  }

  /* Small buttons keep a frame, so they read as buttons on the card. */
  .controls :global(button.icon) {
    border-color: var(--border);
  }

  .finish {
    margin-left: auto;
  }
</style>
