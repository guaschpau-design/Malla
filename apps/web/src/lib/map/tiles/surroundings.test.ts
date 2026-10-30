import { readFileSync } from 'node:fs';

import { distanceMeters, offsetMeters } from '@tesel/core';
import { WalkNetwork } from '@tesel/scenario';
import { PMTiles, type RangeResponse, type Source } from 'pmtiles';
import { describe, expect, it, vi } from 'vitest';

import { surroundingsAround } from './surroundings.ts';

/** The end-to-end tests' synthetic base map: streets every 100 m round Valencia's centre. */
const FIXTURE = readFileSync(
  new URL('../../../../e2e/fixtures/test-basemap.pmtiles', import.meta.url),
);
const CENTRE = { lat: 39.4699, lon: -0.3763 };

/** The fixture as an archive, read from memory. */
class Bytes implements Source {
  getKey(): string {
    return 'test-basemap';
  }

  getBytes(offset: number, length: number): Promise<RangeResponse> {
    const slice = FIXTURE.subarray(offset, offset + length);
    return Promise.resolve({
      data: slice.buffer.slice(slice.byteOffset, slice.byteOffset + slice.byteLength),
    });
  }
}

const archive = new PMTiles(new Bytes());
const tileOf = async ({ z, x, y }: { z: number; x: number; y: number }) =>
  (await archive.getZxy(z, x, y))?.data;

describe('the surroundings of a point on the base map', () => {
  it('reads the streets and paths round a point', async () => {
    const { ways } = await surroundingsAround(CENTRE, 400, tileOf);
    const network = WalkNetwork.from(ways.map((way) => way.points));
    // The streets meet every 100 m: a point in the middle of a block is 50 m from the nearest.
    // This block is south-east of the centre, away from the footpath that crosses the others.
    const inABlock = offsetMeters(CENTRE, -50, 150);
    const stepped = network?.snap(inABlock) ?? inABlock;
    expect(distanceMeters(stepped, inABlock)).toBeCloseTo(50, 0);
  });

  it('leaves out the motorway', async () => {
    const { ways } = await surroundingsAround(CENTRE, 600, tileOf);
    // The motorway runs east–west 350 m north of the centre, half-way between two streets.
    const motorway = offsetMeters(CENTRE, 350, 0);
    const nearest = Math.min(
      ...ways
        .flatMap((way) => way.points)
        .map((point) => Math.abs(distanceMeters(point, { ...point, lat: motorway.lat }))),
    );
    expect(nearest).toBeGreaterThan(40);
  });

  it('names the streets, and finds the water and the parks', async () => {
    const { ways, waterways, greens } = await surroundingsAround(CENTRE, 400, tileOf);
    // The streets through the centre are the seventh from the south and from the west.
    expect(ways.map((way) => way.name)).toEqual(
      expect.arrayContaining(['Calle 7', 'Avenida 7', null]),
    );
    expect(waterways.map((stream) => stream.name)).toContain('Barranco de Prueba');
    expect(greens.map((park) => park.name)).toContain('Parque de Prueba');
  });

  it('gives nothing where the tiles cannot be had', async () => {
    expect(await surroundingsAround(CENTRE, 400, () => Promise.resolve(undefined))).toEqual({
      ways: [],
      waterways: [],
      greens: [],
    });
  });

  it('leaves out a tile it cannot read, and only that one', async () => {
    const everyTile = (await surroundingsAround(CENTRE, 400, tileOf)).ways;
    let first = true;
    const oneCorrupt = async (tile: { z: number; x: number; y: number }) => {
      if (!first) return tileOf(tile);
      first = false;
      return new Uint8Array([0x0f, 0xff, 0xff]).buffer;
    };
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const lines = (await surroundingsAround(CENTRE, 400, oneCorrupt)).ways;
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.length).toBeLessThan(everyTile.length);
    expect(console.warn).toHaveBeenCalledOnce();
  });
});
