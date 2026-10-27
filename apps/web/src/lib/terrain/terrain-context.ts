// The elevation reader, set once by the app instead of passed down through every panel. The
// climbs shown on their own (FromHere, the guidance card) read `reader`, null while the relief is
// off: then nothing asks for elevation tiles by itself. What the user asks for on purpose (the
// radio line of sight) reads `onRequest`, there once the tile store is open.

import { createContext } from 'svelte';

import type { ElevationReader } from './elevation.ts';

export interface Terrain {
  readonly reader: ElevationReader | null;
  readonly onRequest: ElevationReader | null;
}

export const [terrainContext, provideTerrain] = createContext<Terrain>();
