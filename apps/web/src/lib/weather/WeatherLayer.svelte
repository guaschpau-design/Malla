<!-- The regions under an official weather warning, beneath everything else on the map. They are
     drawn unlike the group's own areas, which are filled flat with a thick edge: hatched in the
     colour of their level, with a thin edge and a cloud on a rounded square, the sign of official
     warnings (map/style/glyph-images.ts). Dashes are left to what is being drawn. -->
<script lang="ts">
  import type { Map as MapLibreMap } from 'maplibre-gl';

  import { addGlyphImage, addHatchImage } from '../map/style/glyph-images.ts';
  import { useOverlay } from '../map/overlay.svelte.ts';
  import { GLYPHS } from '../ui/glyphs.ts';
  import { toneColor, toneExpression } from '../ui/theme.ts';
  import { regionFeatures, WARNING_LOOKS, type ActiveRegion } from './weather-warnings.ts';

  interface Props {
    map: MapLibreMap;
    regions: readonly ActiveRegion[];
    visible: boolean;
  }

  let { map, regions, visible }: Props = $props();

  const SOURCE = 'tesel-weather';
  const HATCH = 'tesel-weather-hatch-';
  const ICON = 'tesel-weather-icon-';
  const tones = Object.values(WARNING_LOOKS).map((look) => look.tone);

  useOverlay(() => map, {
    level: 'weather',
    data: { [SOURCE]: () => regionFeatures(regions) },
    visible: () => visible,
    prepare: () => {
      for (const tone of tones) {
        addHatchImage(map, `${HATCH}${tone}`, toneColor(tone));
        addGlyphImage(map, `${ICON}${tone}`, {
          glyph: GLYPHS.cloud,
          colour: toneColor(tone),
          shape: 'square',
        });
      }
    },
    layers: () => [
      {
        id: 'tesel-weather-fill',
        type: 'fill',
        source: SOURCE,
        paint: { 'fill-pattern': ['concat', HATCH, ['get', 'tone']] },
      },
      {
        id: 'tesel-weather-line',
        type: 'line',
        source: SOURCE,
        paint: { 'line-color': toneExpression(), 'line-width': 1.5, 'line-opacity': 0.9 },
      },
      {
        id: 'tesel-weather-icon',
        type: 'symbol',
        source: SOURCE,
        layout: { 'icon-image': ['concat', ICON, ['get', 'tone']], 'icon-size': 0.9 },
      },
    ],
  });
</script>
