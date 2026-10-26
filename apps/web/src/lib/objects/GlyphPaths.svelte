<!-- The paths of a pictogram (glyphs.ts) in the colour of the text, inside an <svg> on its grid. -->
<svelte:options namespace="svg" />

<script lang="ts">
  import { GLYPH_STROKE, GLYPHS, type GlyphName } from './glyphs.ts';

  interface Props {
    name: GlyphName;
  }

  let { name }: Props = $props();

  const glyph = $derived(GLYPHS[name]);
</script>

{#each glyph.strokes as d (d)}
  <path
    {d}
    fill="none"
    stroke="currentColor"
    stroke-width={GLYPH_STROKE}
    stroke-linecap="round"
    stroke-linejoin="round"
  />
{/each}
{#each glyph.fills as d (d)}
  <path {d} fill="currentColor" />
{/each}
