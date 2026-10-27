// Every preference this device remembers, in one place: what it is, its choices and its default.

import { COORDINATE_FORMATS, type CoordinateFormat } from '../coordinates/coordinates.ts';
import { MAP_LAYERS, type MapLayer } from '../map/layers.ts';
import { BASE_MAPS, type BaseMap } from '../map/style.ts';
import { POSITION_MODES, type PositionMode } from '../position/position-mode.ts';
import type { AppDb } from '../storage/app-db.ts';
import { choice, flag, Preference, subset } from './preference.svelte.ts';

export const PREFERENCES = {
  /** How this device shares its position: hidden until the user chooses otherwise. */
  positionMode: choice('positionMode', POSITION_MODES, 'hidden'),
  /** How coordinates are written: decimal degrees, as phones and 112 apps share them. */
  coordinateFormat: choice('coordinateFormat', COORDINATE_FORMATS, 'decimal'),
  /** The map under everything: the street map, which covers everywhere and is the lightest. */
  baseMap: choice('baseMap', BASE_MAPS, 'streets'),
  /** Shading of the terrain: off at first, as it downloads elevation data. */
  relief: flag('relief', false),
  /** The MGRS grid over the map: off, for those who coordinate in it. */
  mgrsGrid: flag('mgrsGrid', false),
  /** The radar around this device: off, as it keeps the GPS on. */
  radar: flag('radar', false),
  /** The cadastre's parcels: off, as it asks a public service for a picture of every view. */
  cadastre: flag('cadastre', false),
  /** Map layers the user has hidden: none at first. */
  hiddenLayers: subset('hiddenLayers', MAP_LAYERS, []),
  /** Keep the screen on while the app is open: off, to spare the battery. */
  keepScreenOn: flag('keepScreenOn', false),
};

/** The preferences the interface reads and changes as the user works. */
export interface Preferences {
  readonly positionMode: Preference<PositionMode>;
  readonly coordinateFormat: Preference<CoordinateFormat>;
  readonly baseMap: Preference<BaseMap>;
  readonly relief: Preference<boolean>;
  readonly mgrsGrid: Preference<boolean>;
  readonly radar: Preference<boolean>;
  readonly cadastre: Preference<boolean>;
  readonly hiddenLayers: Preference<readonly MapLayer[]>;
  readonly keepScreenOn: Preference<boolean>;
}

export async function loadPreferences(db: AppDb): Promise<Preferences> {
  return {
    positionMode: await Preference.load(db, PREFERENCES.positionMode),
    coordinateFormat: await Preference.load(db, PREFERENCES.coordinateFormat),
    baseMap: await Preference.load(db, PREFERENCES.baseMap),
    relief: await Preference.load(db, PREFERENCES.relief),
    mgrsGrid: await Preference.load(db, PREFERENCES.mgrsGrid),
    radar: await Preference.load(db, PREFERENCES.radar),
    cadastre: await Preference.load(db, PREFERENCES.cadastre),
    hiddenLayers: await Preference.load(db, PREFERENCES.hiddenLayers),
    keepScreenOn: await Preference.load(db, PREFERENCES.keepScreenOn),
  };
}
