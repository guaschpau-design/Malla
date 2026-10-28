import { readFileSync } from 'node:fs';

import { distanceMeters, offsetMeters } from '@tesel/core';
import { WalkNetwork } from '@tesel/scenario';
import { PMTiles, type RangeResponse, type Source } from 'pmtiles';
import { describe, expect, it } from 'vitest';

import { walkwaysAround } from './walkways.ts';

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

describe('the walkways of the base map', () => {
  it('reads the streets and paths round a point', async () => {
    const lines = await walkwaysAround(CENTRE, 400, tileOf);
    const network = WalkNetwork.from(lines);
    // The streets meet every 100 m: a point in the middle of a block is 50 m from the nearest.
    // This block is south-east of the centre, away from the footpath that crosses the others.
    const inABlock = offsetMeters(CENTRE, -50, 150);
    const stepped = network?.snap(inABlock) ?? inABlock;
    expect(distanceMeters(stepped, inABlock)).toBeCloseTo(50, 0);
  });

  it('leaves out the motorway', async () => {
    const lines = await walkwaysAround(CENTRE, 600, tileOf);
    // The motorway runs east–west 350 m north of the centre, half-way between two streets.
    const motorway = offsetMeters(CENTRE, 350, 0);
    const nearest = Math.min(
      ...lines
        .flat()
        .map((point) => Math.abs(distanceMeters(point, { ...point, lat: motorway.lat }))),
    );
    expect(nearest).toBeGreaterThan(40);
  });

  it('gives nothing where the tiles cannot be had', async () => {
    expect(await walkwaysAround(CENTRE, 400, () => Promise.resolve(undefined))).toEqual([]);
  });
});
