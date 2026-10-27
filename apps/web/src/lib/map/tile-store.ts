// Offline storage of map tiles and of the areas they were downloaded for (IndexedDB).
//
// Each tile is stored under its source and coordinates. Areas may overlap, so each tile records
// which areas need it; deleting an area only removes tiles that no remaining area uses.

import {
  openDB,
  type DBSchema,
  type IDBPDatabase,
  type IDBPTransaction,
  type StoreNames,
} from 'idb';

import { tileKey, tilesInBounds, type Bounds, type TileCoord } from './tile-math.ts';
import type { TileSourceId } from './tile-sources.ts';

/** One source of an area and the zoom up to which its tiles were downloaded. */
export interface AreaLayer {
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

export interface StoredTile {
  readonly tile: TileCoord;
  readonly data: ArrayBuffer;
}

export interface TileStore {
  getTile(source: TileSourceId, tile: TileCoord): Promise<ArrayBuffer | undefined>;
  /** Stores tiles of one source for an area in one transaction. */
  putTiles(areaId: string, source: TileSourceId, tiles: readonly StoredTile[]): Promise<void>;
  saveArea(area: OfflineArea): Promise<void>;
  listAreas(): Promise<OfflineArea[]>;
  deleteArea(area: OfflineArea): Promise<void>;
}

interface MapDb extends DBSchema {
  tiles: { key: string; value: { data: ArrayBuffer; areas: string[] } };
  areas: { key: string; value: OfflineArea };
}

const DB_NAME = 'tesel-map';
const DB_VERSION = 4;

/** Where a tile is kept: its source, then z/x/y. */
function storageKey(source: TileSourceId, tile: TileCoord): string {
  return `${source}/${tileKey(tile)}`;
}

export async function openTileStore(name: string = DB_NAME): Promise<TileStore> {
  const db = await openDB<MapDb>(name, DB_VERSION, {
    upgrade(database, oldVersion, _newVersion, transaction) {
      if (oldVersion < 1) {
        database.createObjectStore('tiles');
        database.createObjectStore('areas', { keyPath: 'id' });
      }
      // The upgrade transaction stays open while its requests run; openDB resolves after.
      if (oldVersion === 1) void keyBySource(transaction);
      if (oldVersion === 2 || oldVersion === 3) void renameSources(transaction);
    },
  });
  return new IndexedDbTileStore(db);
}

/**
 * Version 1 had one source, the base map: its tiles were keyed z/x/y and its areas had one
 * maxZoom. They become the base map's, under the keys and layers of version 2.
 */
async function keyBySource(
  transaction: IDBPTransaction<MapDb, StoreNames<MapDb>[], 'versionchange'>,
): Promise<void> {
  const tiles = transaction.objectStore('tiles');
  for (let cursor = await tiles.openCursor(); cursor; cursor = await cursor.continue()) {
    const key = cursor.key;
    if (!/^\d+\/\d+\/\d+$/.test(key)) continue;
    await tiles.put(cursor.value, `basemap/${key}`);
    await cursor.delete();
  }
  const areas = transaction.objectStore('areas');
  for (let cursor = await areas.openCursor(); cursor; cursor = await cursor.continue()) {
    const old = cursor.value as OfflineArea & { maxZoom?: number };
    if (old.maxZoom === undefined) continue;
    const { maxZoom, ...rest } = old;
    await cursor.update({ ...rest, layers: [{ source: 'basemap', maxZoom }] });
  }
}

/**
 * What became of the sources of versions 2 and 3: a new name, or nothing where their tiles cannot be
 * drawn as the source of that name is now.
 */
const FORMER_SOURCES: Readonly<Record<string, TileSourceId | null>> = {
  // Scanned topographic sheets; the topographic map is drawn from vector data (ADR-0034).
  'ign-topo': null,
  // IGN's vector map, read now only for the names of the terrain (ADR-0037).
  'ign-contours': 'ign-names',
  // Spain's orthophotos, now joined with Portugal's and France's (ADR-0037).
  'ign-ortho': 'ortho',
  // Elevation in other encodings and sizes than Mapterhorn's (ADR-0037).
  'ign-relief': null,
  terrain: null,
};

/** Moves the tiles of former sources to their new names, drops the rest, and updates the areas. */
async function renameSources(
  transaction: IDBPTransaction<MapDb, StoreNames<MapDb>[], 'versionchange'>,
): Promise<void> {
  const tiles = transaction.objectStore('tiles');
  for (const [former, current] of Object.entries(FORMER_SOURCES)) {
    const range = IDBKeyRange.bound(`${former}/`, `${former}/\uffff`);
    for (let cursor = await tiles.openCursor(range); cursor; cursor = await cursor.continue()) {
      if (current !== null) {
        await tiles.put(cursor.value, `${current}${cursor.key.slice(former.length)}`);
      }
      await cursor.delete();
    }
  }
  const areas = transaction.objectStore('areas');
  for (let cursor = await areas.openCursor(); cursor; cursor = await cursor.continue()) {
    const area = cursor.value;
    const layers = area.layers.flatMap((layer) => {
      const current = FORMER_SOURCES[layer.source];
      if (current === undefined) return [layer];
      return current === null ? [] : [{ ...layer, source: current }];
    });
    await cursor.update({ ...area, layers });
  }
}

class IndexedDbTileStore implements TileStore {
  private readonly db: IDBPDatabase<MapDb>;

  constructor(db: IDBPDatabase<MapDb>) {
    this.db = db;
  }

  async getTile(source: TileSourceId, tile: TileCoord): Promise<ArrayBuffer | undefined> {
    return (await this.db.get('tiles', storageKey(source, tile)))?.data;
  }

  async putTiles(
    areaId: string,
    source: TileSourceId,
    tiles: readonly StoredTile[],
  ): Promise<void> {
    const tx = this.db.transaction('tiles', 'readwrite');
    await Promise.all(
      tiles.map(async ({ tile, data }) => {
        const key = storageKey(source, tile);
        const existing = await tx.store.get(key);
        const areas = existing ? [...new Set([...existing.areas, areaId])] : [areaId];
        await tx.store.put({ data, areas }, key);
      }),
    );
    await tx.done;
  }

  async saveArea(area: OfflineArea): Promise<void> {
    await this.db.put('areas', area);
  }

  async listAreas(): Promise<OfflineArea[]> {
    const areas = await this.db.getAll('areas');
    return areas.sort((a, b) => b.createdAt - a.createdAt);
  }

  async deleteArea(area: OfflineArea): Promise<void> {
    const tx = this.db.transaction(['tiles', 'areas'], 'readwrite');
    const tiles = tx.objectStore('tiles');
    for (const { source, maxZoom } of area.layers) {
      for (const coord of tilesInBounds(area.bounds, area.minZoom, maxZoom)) {
        const key = storageKey(source, coord);
        const existing = await tiles.get(key);
        if (!existing) continue;
        const areas = existing.areas.filter((id) => id !== area.id);
        if (areas.length === 0) await tiles.delete(key);
        else await tiles.put({ data: existing.data, areas }, key);
      }
    }
    await tx.objectStore('areas').delete(area.id);
    await tx.done;
  }
}
