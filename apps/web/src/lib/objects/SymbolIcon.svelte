<!-- A map symbol as it appears on the map (symbol-images.ts), for forms and lists. -->
<script lang="ts">
  import { symbolInfo } from './catalog.ts';
  import { GLYPH_GRID, GLYPH_STROKE, GLYPHS, tilePath } from './glyphs.ts';

  interface Props {
    code: number;
    /** Height in CSS pixels. */
    size?: number;
  }

  let { code, size = 32 }: Props = $props();

  const RADIUS = 17;
  const WIDTH = Math.sqrt(3) * RADIUS + 4;
  const HEIGHT = 2 * RADIUS + 4;
  const GLYPH_SIZE = 19;
  const TILE = tilePath(WIDTH / 2, HEIGHT / 2, RADIUS);
  const GLYPH_AT = `translate(${String((WIDTH - GLYPH_SIZE) / 2)} ${String((HEIGHT - GLYPH_SIZE) / 2)}) scale(${String(GLYPH_SIZE / GLYPH_GRID)})`;

  const symbol = $derived(symbolInfo(code));
  const glyph = $derived(GLYPHS[symbol.glyph]);
</script>

<svg
  viewBox="0 0 {WIDTH} {HEIGHT}"
  height={size}
  width={(size * WIDTH) / HEIGHT}
  aria-hidden="true"
  style:--tile="var(--tone-{symbol.tone})"
>
  <path d={TILE} class="tile" />
  <g transform={GLYPH_AT}>
    {#each glyph.strokes as d (d)}
      <path {d} class="stroke" stroke-width={GLYPH_STROKE} />
    {/each}
    {#each glyph.fills as d (d)}
      <path {d} class="fill" />
    {/each}
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

  .stroke {
    fill: none;
    stroke: #fff;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .fill {
    fill: #fff;
  }
</style>
