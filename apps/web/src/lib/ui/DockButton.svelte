<!-- One button of the dock at the bottom of the map: a pictogram over a short label. -->
<script lang="ts">
  import type { GlyphName } from './glyphs.ts';
  import Pictogram from './Pictogram.svelte';

  interface Props {
    icon: GlyphName;
    label: string;
    /** A longer name for screen readers, when the label alone is not enough. */
    ariaLabel?: string;
    /** Lime, for a button whose state is on (sharing the position). */
    on?: boolean;
    /** Whether the panel or menu it opens is open. */
    expanded: boolean;
    onclick: () => void;
  }

  let { icon, label, ariaLabel, on = false, expanded, onclick }: Props = $props();
</script>

<button class="dock-button" class:on aria-expanded={expanded} aria-label={ariaLabel} {onclick}>
  <Pictogram name={icon} size={22} />
  <span>{label}</span>
</button>

<style>
  .dock-button {
    display: grid;
    flex: 1;
    gap: 0.15rem;
    place-items: center;
    min-width: 3.6rem;
    padding: 0.45rem 0.25rem 0.4rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: inherit;
    border: 0;
    border-radius: 0.9rem;
  }

  .dock-button[aria-expanded='true'] {
    background: rgb(230 235 232 / 14%);
  }

  .dock-button.on :global(svg) {
    color: var(--signal);
  }
</style>
