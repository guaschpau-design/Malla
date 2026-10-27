// Map objects and active SOS calls as GeoJSON for the map layers.

import type { GroupState } from '@tesel/core';
import type { LatLon, ShapeEvent } from '@tesel/protocol';
import type { Feature, FeatureCollection, Geometry, Point } from 'geojson';

import { aliasOf, whereSos } from '../incidents/incidents.ts';
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

export interface SosProperties {
  readonly key: string;
  readonly label: string;
}

export interface MapObjects {
  readonly markers: FeatureCollection<Point, MarkerProperties>;
  readonly shapes: FeatureCollection<Geometry, ShapeProperties>;
  readonly sos: FeatureCollection<Point, SosProperties>;
}

export function mapObjects(state: GroupState): MapObjects {
  const markers: Feature<Point, MarkerProperties>[] = [];
  const shapes: Feature<Geometry, ShapeProperties>[] = [];
  for (const [key, record] of state.objects) {
    if (record.type === 'marker') {
      markers.push(
        point(record, { key, label: record.label, icon: symbolImageName(record.symbol) }),
      );
    } else if (record.type === 'shape') {
      shapes.push({
        type: 'Feature',
        geometry: shapeGeometry(record),
        properties: { key, label: record.label, tone: styleInfo(record.style).tone },
      });
    }
  }
  const sos: Feature<Point, SosProperties>[] = [];
  for (const [key, call] of state.sos) {
    if (state.sosCancels.has(key)) continue;
    const where = whereSos(state, call);
    if (where.kind === 'unknown') continue;
    sos.push(point(where.at, { key, label: aliasOf(state, call.origin) }));
  }
  return {
    markers: { type: 'FeatureCollection', features: markers },
    shapes: { type: 'FeatureCollection', features: shapes },
    sos: { type: 'FeatureCollection', features: sos },
  };
}

function point<P>(at: LatLon, properties: P): Feature<Point, P> {
  return { type: 'Feature', geometry: { type: 'Point', coordinates: toPosition(at) }, properties };
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
