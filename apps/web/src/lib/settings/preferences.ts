// Every preference this device remembers, in one place: what it is, its choices and its default.

import { COORDINATE_FORMATS, type CoordinateFormat } from '../coordinates/coordinates.ts';
import { MAP_LAYERS, type MapLayer } from '../map/layers.ts';
import { POSITION_MODES } from '../position/position-mode.ts';
import type { AppDb } from '../storage/app-db.ts';
import { choice, Preference, subset } from './preference.svelte.ts';

export const PREFERENCES = {
  /** How this device shares its position: hidden until the user chooses otherwise. */
  positionMode: choice('positionMode', POSITION_MODES, 'hidden'),
  /** How coordinates are written: decimal degrees, as phones and 112 apps share them. */
  coordinateFormat: choice('coordinateFormat', COORDINATE_FORMATS, 'decimal'),
  /** Map layers the user has hidden: none at first. */
  hiddenLayers: subset('hiddenLayers', MAP_LAYERS, []),
};

/** The preferences the interface reads and changes as the user works. */
export interface Preferences {
  readonly coordinateFormat: Preference<CoordinateFormat>;
  readonly hiddenLayers: Preference<readonly MapLayer[]>;
}

export async function loadPreferences(db: AppDb): Promise<Preferences> {
  return {
    coordinateFormat: await Preference.load(db, PREFERENCES.coordinateFormat),
    hiddenLayers: await Preference.load(db, PREFERENCES.hiddenLayers),
  };
}
