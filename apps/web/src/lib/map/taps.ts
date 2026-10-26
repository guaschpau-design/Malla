// Which of our features a tap on the map landed on. A fingertip is wider than a dot on the map,
// so the tap counts within a few pixels of the feature.

import type { MapGeoJSONFeature, Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl';

/** How far from a feature a tap still hits it, in CSS pixels. */
const REACH_PX = 12;

/** The topmost feature of `layers` under the tap, if any. */
export function tappedFeature(
  map: MapLibreMap,
  event: MapMouseEvent,
  layers: readonly string[],
): MapGeoJSONFeature | null {
  const present = layers.filter((id) => map.getLayer(id) !== undefined);
  if (present.length === 0) return null;
  const { x, y } = event.point;
  const box: [[number, number], [number, number]] = [
    [x - REACH_PX, y - REACH_PX],
    [x + REACH_PX, y + REACH_PX],
  ];
  return map.queryRenderedFeatures(box, { layers: present })[0] ?? null;
}

/** The named property of the topmost feature of `layers` under the tap, if it is a string. */
export function tappedProperty(
  map: MapLibreMap,
  event: MapMouseEvent,
  layers: readonly string[],
  property: string,
): string | null {
  const value: unknown = tappedFeature(map, event, layers)?.properties[property];
  return typeof value === 'string' ? value : null;
}
