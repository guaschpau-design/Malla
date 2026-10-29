<!-- One on/off choice in a panel: a pictogram, what it is, a line on what it does if needed, and
     its switch, all one button that screen readers hear as a switch. Off, the pictogram fades. The
     one way the app draws an on/off choice. -->
<script lang="ts">
  import type { GlyphName } from './glyphs.ts';
  import Pictogram from './Pictogram.svelte';
  import Switch from './Switch.svelte';

  interface Props {
    icon: GlyphName;
    label: string;
    /** What the choice does, when its name is not enough. */
    hint?: string | undefined;
    on: boolean;
    onclick: () => void;
  }

  let { icon, label, hint, on, onclick }: Props = $props();
</script>

<button class="switch-row" role="switch" aria-checked={on} {onclick}>
  <Pictogram name={icon} size={20} />
  <span class="label">
    {label}
    {#if hint}<small>{hint}</small>{/if}
  </span>
  <Switch {on} />
</button>

<style>
  .switch-row {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 0.75rem;
    align-items: center;
    padding: 0.55rem 0.4rem;
    text-align: left;
    border-color: transparent;
  }

  .label {
    display: grid;
  }

  .label small {
    color: var(--muted);
    font-size: var(--text-small);
  }

  .switch-row[aria-checked='false'] :global(svg) {
    opacity: 0.45;
  }
</style>
