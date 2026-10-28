// How the strips of a sweep are drawn: a thin line along each strip's way in its team's colour,
// with its number along it. The same on the map and while a sweep is planned.

import type { LayerSpecification } from 'maplibre-gl';

import { themeColor, toneExpression } from '../ui/theme.ts';

export function stripLayers(source: string): LayerSpecification[] {
  const tone = toneExpression();
  return [
    {
      id: `${source}-line`,
      type: 'line',
      source,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': tone, 'line-width': 2.5, 'line-opacity': 0.9 },
    },
    {
      id: `${source}-label`,
      type: 'symbol',
      source,
      layout: {
        'text-field': ['get', 'label'],
        'text-font': ['Noto Sans Medium'],
        'text-size': 12,
        'symbol-placement': 'line',
        'symbol-spacing': 160,
      },
      paint: {
        'text-color': tone,
        'text-halo-color': themeColor('map-halo'),
        'text-halo-width': 2,
      },
    },
  ];
}
