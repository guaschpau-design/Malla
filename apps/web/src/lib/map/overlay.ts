// Keeping our own sources and layers on the map. A new style (theme or language change) removes
// them, and the style may still be loading tiles when a layer is created, so `install` runs on
// every style change and whenever the map settles. It must do nothing when already installed.

import type { Map as MapLibreMap } from 'maplibre-gl';

export function keepInstalled(map: MapLibreMap, install: () => void): () => void {
  map.on('styledata', install);
  map.on('idle', install);
  if (map.isStyleLoaded()) install();
  return () => {
    map.off('styledata', install);
    map.off('idle', install);
  };
}
