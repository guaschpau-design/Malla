<!-- One on/off choice of a list in a panel: a pictogram, what it is and its switch, all one button
     that screen readers hear as a switch. Off, the pictogram fades. -->
<script lang="ts">
  import type { GlyphName } from './glyphs.ts';
  import Pictogram from './Pictogram.svelte';
  import Switch from './Switch.svelte';

  interface Props {
    icon: GlyphName;
    label: string;
    on: boolean;
    onclick: () => void;
  }

  let { icon, label, on, onclick }: Props = $props();
</script>

<button class="switch-row" role="switch" aria-checked={on} {onclick}>
  <Pictogram name={icon} size={20} />
  <span>{label}</span>
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

  .switch-row[aria-checked='false'] :global(svg) {
    opacity: 0.45;
  }
</style>
