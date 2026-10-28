<!-- A dock button that opens a menu above the dock (ui/Menu.svelte). -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  import DockButton from './DockButton.svelte';
  import type { GlyphName } from './glyphs.ts';
  import Menu from './Menu.svelte';

  interface Props {
    icon: GlyphName;
    label: string;
    /** The items; those that do something call `close` once chosen. */
    items: Snippet<[close: () => void]>;
  }

  let { icon, label, items }: Props = $props();
</script>

<Menu {label} place="dock" {items}>
  {#snippet trigger(expanded: boolean, toggle: () => void)}
    <DockButton {icon} {label} {expanded} onclick={toggle} />
  {/snippet}
</Menu>
