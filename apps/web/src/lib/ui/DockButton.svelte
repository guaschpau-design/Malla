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
    /** A number to point out, such as the tasks waiting for this device; none when 0. */
    count?: number;
    onclick: () => void;
  }

  let { icon, label, ariaLabel, on = false, expanded, count = 0, onclick }: Props = $props();
</script>

<button class="dock-button" class:on aria-expanded={expanded} aria-label={ariaLabel} {onclick}>
  <span class="icon">
    <Pictogram name={icon} size={22} />
    {#if count > 0}<span class="count" aria-hidden="true">{count}</span>{/if}
  </span>
  <span>{label}</span>
</button>

<style>
  .dock-button {
    display: grid;
    flex: 1;
    gap: 0.15rem;
    place-items: center;
    min-width: 3rem;
    padding: 0.45rem 0.15rem 0.4rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: inherit;
    border: 0;
    border-radius: 0.9rem;
  }

  .dock-button[aria-expanded='true'] {
    background: rgb(230 235 232 / 14%);
  }

  .icon {
    position: relative;
    display: grid;
  }

  .count {
    position: absolute;
    top: -0.35rem;
    right: -0.6rem;
    min-width: 1.05rem;
    padding: 0 0.2rem;
    font-size: 0.7rem;
    font-weight: 800;
    line-height: 1.05rem;
    color: var(--on-accent);
    text-align: center;
    background: var(--signal);
    border-radius: 999px;
  }

  .dock-button.on :global(svg) {
    color: var(--signal);
  }
</style>
