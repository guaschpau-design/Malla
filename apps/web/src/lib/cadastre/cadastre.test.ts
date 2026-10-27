import { describe, expect, it } from 'vitest';

import { cadastreImage } from './cadastre.ts';

const VALENCIA = { west: -0.38, south: 39.46, east: -0.37, north: 39.47 };

describe('cadastre', () => {
  it('asks for one picture of the view in Web Mercator, and puts it at the view’s corners', () => {
    const image = cadastreImage(VALENCIA, 800, 600);
    const query = new URL(image.url).searchParams;
    expect(query.get('SRS')).toBe('EPSG:3857');
    expect(query.get('LAYERS')).toBe('Catastro');
    expect([query.get('WIDTH'), query.get('HEIGHT')]).toEqual(['800', '600']);
    const [west, south, east, north] = (query.get('BBOX') ?? '').split(',').map(Number);
    expect(west).toBeCloseTo(-42_301, 0);
    expect(north ?? 0).toBeGreaterThan(south ?? 0);
    expect(east ?? 0).toBeGreaterThan(west ?? 0);
    expect(image.coordinates).toEqual([
      [-0.38, 39.47],
      [-0.37, 39.47],
      [-0.37, 39.46],
      [-0.38, 39.46],
    ]);
  });

  it('keeps the picture within the largest the service draws, in proportion', () => {
    const query = new URL(cadastreImage(VALENCIA, 4096, 1024).url).searchParams;
    expect([query.get('WIDTH'), query.get('HEIGHT')]).toEqual(['2048', '512']);
  });
});
