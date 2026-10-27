// A point placed exactly: a thin ring with a dot on the spot, haloed so it reads on any map. The
// point being looked at and the points of a drawing or a measure all look like this.

import type { CircleLayerSpecification, FilterSpecification } from 'maplibre-gl';

import { themeColor } from '../ui/theme.ts';

/** Radius of the ring, in pixels: wide enough to see, open enough to show what is under it. */
const RING_RADIUS = 8;

/** The layers that draw the points of `source` (those `filter` keeps) as targets, bottom to top. */
export function targetLayers(
  source: string,
  filter?: FilterSpecification,
): CircleLayerSpecification[] {
  const text = themeColor('map-text');
  const halo = themeColor('map-halo');
  const ring = { 'circle-radius': RING_RADIUS, 'circle-opacity': 0 };
  const where = filter === undefined ? {} : { filter };
  return [
    {
      id: `${source}-ring-halo`,
      type: 'circle',
      source,
      ...where,
      paint: {
        ...ring,
        'circle-stroke-width': 4,
        'circle-stroke-color': halo,
        'circle-stroke-opacity': 0.8,
      },
    },
    {
      id: `${source}-ring`,
      type: 'circle',
      source,
      ...where,
      paint: { ...ring, 'circle-stroke-width': 1.5, 'circle-stroke-color': text },
    },
    {
      id: `${source}-dot`,
      type: 'circle',
      source,
      ...where,
      paint: {
        'circle-radius': 1.5,
        'circle-color': text,
        'circle-stroke-width': 1,
        'circle-stroke-color': halo,
      },
    },
  ];
}
