// The elevation reader, set once by the app instead of passed down through every panel. The
// climbs shown on their own (FromHere, the guidance card) read it; it is null while the relief is
// off, so that nothing asks for elevation tiles by itself.

import { createContext } from 'svelte';

import type { ElevationReader } from './elevation.ts';

export interface Terrain {
  readonly reader: ElevationReader | null;
}

export const [terrainContext, provideTerrain] = createContext<Terrain>();
