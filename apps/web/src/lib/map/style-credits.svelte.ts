// The credits the map's data asks for: the attribution of each source of the current style, read
// again whenever the style changes (base map, relief, overlays). They are shown briefly over the map
// when it opens or its base map changes (MapCredits.svelte), and always in the layers panel, as
// OpenStreetMap's attribution guidelines allow (ADR-0039).

import type { Map as MapLibreMap } from 'maplibre-gl';
import { untrack } from 'svelte';

/** Each source's attribution once, in the order of the style's sources. */
export function styleCredits(map: MapLibreMap): string[] {
  const sources = Object.values(map.getStyle().sources);
  const credits = sources.flatMap((source) =>
    'attribution' in source && typeof source.attribution === 'string' ? [source.attribution] : [],
  );
  return credits.filter((credit, index) => credits.indexOf(credit) === index);
}

/**
 * The credits of the map's style, kept up to date while the calling component lives: read whenever
 * the map settles, which it does after every change of style.
 */
export function useStyleCredits(map: () => MapLibreMap): { readonly list: readonly string[] } {
  let list: readonly string[] = $state([]);
  $effect(() => {
    const target = map();
    const update = () => {
      if (!target.isStyleLoaded()) return;
      const next = styleCredits(target);
      if (next.join('\n') !== list.join('\n')) list = next;
    };
    untrack(update);
    target.on('idle', update);
    return () => {
      target.off('idle', update);
    };
  });
  return {
    get list() {
      return list;
    },
  };
}
