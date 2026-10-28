// What the tile database holds (store.ts), and what its upgrades (store-upgrades.ts) work on.

import type { DBSchema } from 'idb';

import type { Bounds } from './math.ts';
import type { TileSourceId } from './sources.ts';

/** One source of an area and the zoom up to which its tiles were downloaded. */
interface AreaLayer {
  readonly source: TileSourceId;
  readonly maxZoom: number;
}

export interface OfflineArea {
  readonly id: string;
  readonly name: string;
  readonly bounds: Bounds;
  readonly minZoom: number;
  readonly layers: readonly AreaLayer[];
  /** Tiles that exist in the sources; empty tiles (open sea) are not stored. */
  readonly storedTiles: number;
  readonly bytes: number;
  /** Milliseconds since the epoch. */
  readonly createdAt: number;
  /** False while downloading or if a download was interrupted. */
  readonly complete: boolean;
}

export interface MapDb extends DBSchema {
  /** Every tile, with who needs it: no one, for a tile kept only because it was seen. */
  tiles: { key: string; value: { data: ArrayBuffer; areas: string[] } };
  areas: { key: string; value: OfflineArea };
  /** Tiles kept because the map showed them: when, and their size, by the key of the tile. */
  viewed: { key: string; value: { seen: number; size: number } };
}
