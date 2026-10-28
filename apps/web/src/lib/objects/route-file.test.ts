import { describe, expect, it } from 'vitest';

import { readRouteFile } from './route-file.ts';

describe('reading a route file', () => {
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
    expect(readRouteFile(gpx)).toEqual({
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
    const read = readRouteFile(gpx);
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
    const read = readRouteFile(kml);
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
    const read = readRouteFile(geojson);
    expect(read.ok && read.value.name).toBe('Barranco');
    expect(read.ok && read.value.points).toHaveLength(2);
  });

  it('leaves out points that are not coordinates', () => {
    const gpx = `<gpx><trk><trkseg><trkpt lat="95" lon="1"/><trkpt lat="x" lon="1"/>
      <trkpt lat="42.5" lon="1.5"/><trkpt lat="42.6" lon="1.5"/></trkseg></trk></gpx>`;
    const read = readRouteFile(gpx);
    expect(read.ok && read.value.points).toHaveLength(2);
  });

  it('tells a file of another format from one without a line', () => {
    expect(readRouteFile('lat,lon\n42,1')).toEqual({ ok: false, error: 'unsupported' });
    expect(readRouteFile('{ not json')).toEqual({ ok: false, error: 'unsupported' });
    expect(readRouteFile('<gpx><wpt lat="42" lon="1"/></gpx>')).toEqual({
      ok: false,
      error: 'no-line',
    });
  });
});
