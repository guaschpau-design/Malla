// The elevation reader, for the components that show climbs (FromHere, the guidance card), set
// once by the app instead of passed down through every panel. `reader` is null while the relief
// is off: then nothing asks for elevation tiles.

import { createContext } from 'svelte';

import type { ElevationReader } from './elevation.ts';

export interface Terrain {
  readonly reader: ElevationReader | null;
}

export const [terrainContext, provideTerrain] = createContext<Terrain>();
