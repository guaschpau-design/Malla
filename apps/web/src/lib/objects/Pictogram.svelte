<!-- A pictogram of glyphs.ts on its own, in the colour of the text around it. -->
<script lang="ts">
  import type { GlyphName } from './glyphs.ts';
  import GlyphPaths from './GlyphPaths.svelte';

  interface Props {
    name: GlyphName;
    /** Size in CSS pixels. */
    size?: number;
  }

  let { name, size = 16 }: Props = $props();
</script>

<svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
  <GlyphPaths {name} />
</svg>

<style>
  svg {
    display: block;
    flex-shrink: 0;
  }
</style>
