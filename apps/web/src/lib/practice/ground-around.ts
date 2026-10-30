// What a practice reads of the place before it starts (ground.ts): the base map's streets, water
// and parks round it and, for a situation that needs it, the lie of the land.

import type { LatLon } from '@tesel/protocol';

import type { Locale } from '../i18n/index.ts';
import { surroundingsAround, type BasemapTile } from '../map/tiles/surroundings.ts';
import { Ground } from './ground.ts';
import { HeightGrid, type HeightsOf } from './heights.ts';

/** Metres round the place that are read: as far as the exercises reach, and some. */
const REACH_M = 700;
/** Metres between the points whose heights are read. */
const HEIGHTS_EVERY_M = 20;
/** How long the heights may take to read: past this, on a slow network, the practice goes without. */
const HEIGHTS_WAIT_MS = 6000;

/**
 * The ground round `centre`, with the lie of the land if `heightsOf` is given and the heights
 * can be had.
 */
export async function groundAround(
  centre: LatLon,
  locale: Locale,
  basemap: BasemapTile,
  heightsOf: HeightsOf | null,
): Promise<Ground> {
  const [surroundings, heights] = await Promise.all([
    surroundingsAround(centre, REACH_M, basemap),
    heightsOf ? within(HeightGrid.around(centre, REACH_M, HEIGHTS_EVERY_M, heightsOf)) : null,
  ]);
  return new Ground(surroundings, heights, locale);
}

/** What `reading` gives, or null if it takes too long. */
function within(reading: Promise<HeightGrid | null>): Promise<HeightGrid | null> {
  return Promise.race([
    reading,
    new Promise<null>((resolve) => {
      setTimeout(() => {
        resolve(null);
      }, HEIGHTS_WAIT_MS);
    }),
  ]);
}
