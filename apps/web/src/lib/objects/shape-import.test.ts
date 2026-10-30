import { describe, expect, it } from 'vitest';

import { SHAPE_MAX_POINTS } from '@tesel/protocol';
import { importShape, MAX_SHAPE_FILE_BYTES } from './shape-import.ts';

function gpx(points: number, name = ''): string {
  const track = Array.from(
    { length: points },
    // A zigzag, so no point can go without changing the shape.
    (_, index) =>
      `<trkpt lat="${String(42.5 + (index % 2) / 10_000)}" lon="${String(1.5 + index / 10_000)}"/>`,
  ).join('');
  return `<gpx><trk>${name ? `<name>${name}</name>` : ''}<trkseg>${track}</trkseg></trk></gpx>`;
}

describe('importing a route or an area', () => {
  it('thins a long track to the points a route may have, and says how far it strays', async () => {
    const result = await importShape(new File([gpx(500, 'Ronda')], 'ronda.gpx'), 'route');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe('Ronda');
    expect(result.value.read).toBe(500);
    expect(result.value.points).toHaveLength(SHAPE_MAX_POINTS);
    expect(result.value.deviation).toBeGreaterThan(5);
  });

  it('names a route without a name after its file, and leaves out repeated points', async () => {
    const twice = gpx(3).replace('<trkseg>', '<trkseg><trkpt lat="42.5" lon="1.5"/>');
    const result = await importShape(new File([twice], 'Camino viejo.gpx'), 'route');
    expect(result.ok && result.value).toMatchObject({
      name: 'Camino viejo',
      read: 3,
      deviation: 0,
    });
  });

  it('refuses a file too big to be a route, without reading it', async () => {
    const big = new File([new Uint8Array(MAX_SHAPE_FILE_BYTES + 1)], 'big.gpx');
    expect(await importShape(big, 'route')).toEqual({ ok: false, error: 'too-big' });
  });

  it('refuses a file of a single point', async () => {
    const result = await importShape(new File([gpx(1)], 'one.gpx'), 'route');
    expect(result).toEqual({ ok: false, error: 'no-line' });
  });

  it('reads an area, thinned like a route, and says so when the file has none', async () => {
    const kml = `<kml><Placemark><name>Sector</name><Polygon><outerBoundaryIs><LinearRing>
      <coordinates>1,42 1.01,42 1.01,42.01 1,42</coordinates>
    </LinearRing></outerBoundaryIs></Polygon></Placemark></kml>`;
    const result = await importShape(new File([kml], 'sector.kml'), 'area');
    expect(result.ok && result.value).toMatchObject({ kind: 'area', name: 'Sector', read: 3 });
    expect(await importShape(new File([gpx(5)], 'ronda.gpx'), 'area')).toEqual({
      ok: false,
      error: 'no-area',
    });
  });
});
