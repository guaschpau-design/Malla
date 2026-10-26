<!-- A button for what can be done with the thing a panel shows: a pictogram and a verb. -->
<script lang="ts">
  import type { GlyphName } from './glyphs.ts';
  import Pictogram from './Pictogram.svelte';

  interface Props {
    icon: GlyphName;
    label: string;
    onclick: () => void;
  }

  let { icon, label, onclick }: Props = $props();
</script>

<button class="action" {onclick}>
  <Pictogram name={icon} size={18} />
  {label}
</button>

<style>
  .action {
    display: inline-flex;
    gap: 0.45rem;
    align-items: center;
  }
</style>
