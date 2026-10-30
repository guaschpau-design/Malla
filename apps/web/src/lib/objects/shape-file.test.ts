import { describe, expect, it } from 'vitest';

import { readShapeFile } from './shape-file.ts';

describe('reading a route from a file', () => {
  it('reads the tracks of a GPX file, segments joined, under their name', () => {
    const gpx = `<?xml version="1.0"?>
      <gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
        <metadata><name>Salida</name></metadata>
        <wpt lat="42.0" lon="1.0"><name>Fuente</name></wpt>
        <trk>
          <name>Camí &amp; <![CDATA[Font]]></name>
          <trkseg>
            <trkpt lat="42.5" lon="1.5"><ele>1200</ele></trkpt>
            <trkpt lon='1.51' lat='42.51'/>
          </trkseg>
          <trkseg><trkpt lat="42.52" lon="1.52"></trkpt></trkseg>
        </trk>
      </gpx>`;
    expect(readShapeFile(gpx, 'route')).toEqual({
      ok: true,
      value: {
        name: 'Camí & Font',
        points: [
          { lat: 42.5, lon: 1.5 },
          { lat: 42.51, lon: 1.51 },
          { lat: 42.52, lon: 1.52 },
        ],
      },
    });
  });

  it('reads the routes of a GPX file and keeps the longest line', () => {
    const gpx = `<gpx><trk><trkseg><trkpt lat="42.5" lon="1.5"/><trkpt lat="42.5001" lon="1.5"/></trkseg></trk>
      <rte><name>Larga</name><rtept lat="42.5" lon="1.5"/><rtept lat="42.6" lon="1.5"/></rte></gpx>`;
    const read = readShapeFile(gpx, 'route');
    expect(read.ok && read.value.name).toBe('Larga');
  });

  it('reads the line strings and tracks of KML placemarks', () => {
    const kml = `<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">
      <Document><Placemark><name>Pista</name><LineString><coordinates>
        1.5,42.5,1200 1.51,42.51,1210
        1.52,42.52
      </coordinates></LineString></Placemark>
      <Placemark><name>Corta</name><gx:Track><gx:coord>1.5 42.5 0</gx:coord><gx:coord>1.5 42.5001 0</gx:coord></gx:Track></Placemark>
      </Document></kml>`;
    const read = readShapeFile(kml, 'route');
    expect(read.ok && read.value).toEqual({
      name: 'Pista',
      points: [
        { lat: 42.5, lon: 1.5 },
        { lat: 42.51, lon: 1.51 },
        { lat: 42.52, lon: 1.52 },
      ],
    });
  });

  it('reads line strings and multi-line strings of GeoJSON, with their feature name', () => {
    const geojson = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [1, 42] } },
        {
          type: 'Feature',
          properties: { name: 'Barranco' },
          geometry: {
            type: 'MultiLineString',
            coordinates: [
              [
                [1.5, 42.5],
                [1.5, 42.7],
              ],
              [
                [1.5, 42.5],
                [1.5, 42.51],
              ],
            ],
          },
        },
      ],
    });
    const read = readShapeFile(geojson, 'route');
    expect(read.ok && read.value.name).toBe('Barranco');
    expect(read.ok && read.value.points).toHaveLength(2);
  });

  it('leaves out points that are not coordinates', () => {
    const gpx = `<gpx><trk><trkseg><trkpt lat="95" lon="1"/><trkpt lat="x" lon="1"/>
      <trkpt lat="42.5" lon="1.5"/><trkpt lat="42.6" lon="1.5"/></trkseg></trk></gpx>`;
    const read = readShapeFile(gpx, 'route');
    expect(read.ok && read.value.points).toHaveLength(2);
  });

  it('tells a file of another format from one without a line', () => {
    expect(readShapeFile('lat,lon\n42,1', 'route')).toEqual({ ok: false, error: 'unsupported' });
    expect(readShapeFile('{ not json', 'route')).toEqual({ ok: false, error: 'unsupported' });
    expect(readShapeFile('<gpx><wpt lat="42" lon="1"/></gpx>', 'route')).toEqual({
      ok: false,
      error: 'no-line',
    });
  });
});

describe('reading an area from a file', () => {
  it('takes the largest polygon of a KML file, without repeating its first corner', () => {
    const ring = (size: number) =>
      `<Polygon><outerBoundaryIs><LinearRing><coordinates>
        1,42,0 ${String(1 + size)},42,0 ${String(1 + size)},${String(42 + size)},0 1,42,0
      </coordinates></LinearRing></outerBoundaryIs></Polygon>`;
    const kml = `<kml><Document>
      <Placemark><name>Pequeña</name>${ring(0.001)}</Placemark>
      <Placemark><name>Zona de búsqueda</name>${ring(0.01)}</Placemark>
    </Document></kml>`;
    expect(readShapeFile(kml, 'area')).toEqual({
      ok: true,
      value: {
        name: 'Zona de búsqueda',
        points: [
          { lat: 42, lon: 1 },
          { lat: 42, lon: 1.01 },
          { lat: 42.01, lon: 1.01 },
        ],
      },
    });
  });

  it('takes the outer ring of a GeoJSON polygon', () => {
    const geojson = JSON.stringify({
      type: 'Feature',
      properties: { name: 'Sector 1' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [1, 42],
            [1.01, 42],
            [1.01, 42.01],
            [1, 42],
          ],
          [
            [1.002, 42.002],
            [1.003, 42.002],
            [1.003, 42.003],
            [1.002, 42.002],
          ],
        ],
      },
    });
    const read = readShapeFile(geojson, 'area');
    expect(read.ok && read.value).toMatchObject({ name: 'Sector 1' });
    expect(read.ok && read.value.points).toHaveLength(3);
  });

  it('takes a track that goes round a place and closes, and refuses one that does not', () => {
    const track = (points: readonly [number, number][]) =>
      `<gpx><trk><trkseg>${points
        .map(([lat, lon]) => `<trkpt lat="${String(lat)}" lon="${String(lon)}"/>`)
        .join('')}</trkseg></trk></gpx>`;
    const round: [number, number][] = [
      [42, 1],
      [42, 1.01],
      [42.01, 1.01],
      [42.0001, 1.0001],
    ];
    const read = readShapeFile(track(round), 'area');
    expect(read.ok && read.value.points).toHaveLength(4);
    const open: [number, number][] = [
      [42, 1],
      [42, 1.01],
      [42.01, 1.01],
      [42.01, 1],
    ];
    expect(readShapeFile(track(open), 'area')).toEqual({ ok: false, error: 'no-area' });
  });
});
