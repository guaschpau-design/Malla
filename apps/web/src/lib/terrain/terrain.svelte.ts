// The elevation reader, one for the device (ADR-0048): the climbs shown on their own (FromHere,
// the guidance card) read it. It is null while the relief is off, so that nothing asks for
// elevation tiles by itself; the app sets it as the relief is switched.

import type { ElevationReader } from './elevation.ts';

export const terrain = $state({ reader: null as ElevationReader | null });
