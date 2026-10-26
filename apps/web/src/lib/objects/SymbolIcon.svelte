<!-- A map symbol as it appears on the map (symbol-images.ts), for forms and lists. -->
<script lang="ts">
  import { symbolInfo } from './catalog.ts';
  import { GLYPH_GRID, TILE_GLYPH_SIZE, TILE_RADIUS, tilePath } from './glyphs.ts';
  import GlyphPaths from './GlyphPaths.svelte';

  interface Props {
    code: number;
    /** Height in CSS pixels. */
    size?: number;
  }

  let { code, size = 32 }: Props = $props();

  const WIDTH = Math.sqrt(3) * TILE_RADIUS + 4;
  const HEIGHT = 2 * TILE_RADIUS + 4;
  const TILE = tilePath(WIDTH / 2, HEIGHT / 2, TILE_RADIUS);
  const GLYPH_AT = `translate(${String((WIDTH - TILE_GLYPH_SIZE) / 2)} ${String((HEIGHT - TILE_GLYPH_SIZE) / 2)}) scale(${String(TILE_GLYPH_SIZE / GLYPH_GRID)})`;

  const symbol = $derived(symbolInfo(code));
</script>

<svg
  viewBox="0 0 {WIDTH} {HEIGHT}"
  height={size}
  width={(size * WIDTH) / HEIGHT}
  aria-hidden="true"
  style:--tile="var(--tone-{symbol.tone})"
>
  <path d={TILE} class="tile" />
  <g transform={GLYPH_AT} class="glyph">
    <GlyphPaths name={symbol.glyph} />
  </g>
</svg>

<style>
  svg {
    display: block;
    flex-shrink: 0;
  }

  .tile {
    fill: var(--tile);
    stroke: #fff;
    stroke-width: 2;
    stroke-linejoin: round;
  }

  /* The pictogram is white on every family's colour, as on the map. */
  .glyph {
    color: #fff;
  }
</style>
