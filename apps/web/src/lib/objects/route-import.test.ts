import { describe, expect, it } from 'vitest';

import { SHAPE_MAX_POINTS } from '@tesel/protocol';
import { importRoute, MAX_ROUTE_FILE_BYTES } from './route-import.ts';

function gpx(points: number, name = ''): string {
  const track = Array.from(
    { length: points },
    // A zigzag, so no point can go without changing the shape.
    (_, index) =>
      `<trkpt lat="${String(42.5 + (index % 2) / 10_000)}" lon="${String(1.5 + index / 10_000)}"/>`,
  ).join('');
  return `<gpx><trk>${name ? `<name>${name}</name>` : ''}<trkseg>${track}</trkseg></trk></gpx>`;
}

describe('importing a route', () => {
  it('thins a long track to the points a route may have, and says how far it strays', async () => {
    const result = await importRoute(new File([gpx(500, 'Ronda')], 'ronda.gpx'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe('Ronda');
    expect(result.value.read).toBe(500);
    expect(result.value.points).toHaveLength(SHAPE_MAX_POINTS);
    expect(result.value.deviation).toBeGreaterThan(5);
  });

  it('names a route without a name after its file, and leaves out repeated points', async () => {
    const twice = gpx(3).replace('<trkseg>', '<trkseg><trkpt lat="42.5" lon="1.5"/>');
    const result = await importRoute(new File([twice], 'Camino viejo.gpx'));
    expect(result.ok && result.value).toMatchObject({
      name: 'Camino viejo',
      read: 3,
      deviation: 0,
    });
  });

  it('refuses a file too big to be a route, without reading it', async () => {
    const big = new File([new Uint8Array(MAX_ROUTE_FILE_BYTES + 1)], 'big.gpx');
    expect(await importRoute(big)).toEqual({ ok: false, error: 'too-big' });
  });

  it('refuses a file of a single point', async () => {
    const result = await importRoute(new File([gpx(1)], 'one.gpx'));
    expect(result).toEqual({ ok: false, error: 'no-line' });
  });
});
