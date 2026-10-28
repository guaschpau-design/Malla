// Map objects as GeoJSON for the map layers: markers, and the shapes drawn.

import type { GroupState } from '@tesel/core';
import type { ShapeEvent } from '@tesel/protocol';
import type { Feature, FeatureCollection, Geometry, Point } from 'geojson';

import { circleRing, toPosition } from '../map/geometry.ts';
import type { Tone } from '../ui/theme.ts';
import { styleInfo, symbolImageName } from './catalog.ts';

export interface ObjectProperties {
  /** Object reference key (protocol §3.10), used to select the object. */
  readonly key: string;
  readonly label: string;
}

export interface MarkerProperties extends ObjectProperties {
  readonly icon: string;
}

export interface ShapeProperties extends ObjectProperties {
  /** Family of colour, which the layer turns into the colour app.css gives it. */
  readonly tone: Tone;
}

export function markerFeatures(
  state: Pick<GroupState, 'objects'>,
): FeatureCollection<Point, MarkerProperties> {
  const features: Feature<Point, MarkerProperties>[] = [];
  for (const [key, record] of state.objects) {
    if (record.type !== 'marker') continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: toPosition(record) },
      properties: { key, label: record.label, icon: symbolImageName(record.symbol) },
    });
  }
  return { type: 'FeatureCollection', features };
}

export function shapeFeatures(
  state: Pick<GroupState, 'objects'>,
): FeatureCollection<Geometry, ShapeProperties> {
  const features: Feature<Geometry, ShapeProperties>[] = [];
  for (const [key, record] of state.objects) {
    if (record.type !== 'shape') continue;
    features.push({
      type: 'Feature',
      geometry: shapeGeometry(record),
      properties: { key, label: record.label, tone: styleInfo(record.style).tone },
    });
  }
  return { type: 'FeatureCollection', features };
}

function shapeGeometry(shape: ShapeEvent): Geometry {
  const { geometry } = shape;
  switch (geometry.kind) {
    case 'polyline':
      return { type: 'LineString', coordinates: geometry.points.map(toPosition) };
    case 'polygon': {
      const ring = geometry.points.map(toPosition);
      const first = ring[0];
      return { type: 'Polygon', coordinates: [first ? [...ring, first] : ring] };
    }
    case 'circle':
      return { type: 'Polygon', coordinates: [circleRing(geometry.center, geometry.radius)] };
  }
}
