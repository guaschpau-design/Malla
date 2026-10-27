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
const DB_VERSION = 3;

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
      if (oldVersion === 2) void dropScannedTopo(transaction);
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

/** The topographic map of version 2, scanned sheets, which version 3 draws from vector contours. */
const SCANNED_TOPO = 'ign-topo';

/**
 * Version 2 downloaded the scanned topographic map. Its tiles cannot be drawn as the topographic map
 * of version 3 (ADR-0034), so they go, and areas no longer list them.
 */
async function dropScannedTopo(
  transaction: IDBPTransaction<MapDb, StoreNames<MapDb>[], 'versionchange'>,
): Promise<void> {
  const tiles = transaction.objectStore('tiles');
  const scanned = IDBKeyRange.bound(`${SCANNED_TOPO}/`, `${SCANNED_TOPO}/\uffff`);
  for (let cursor = await tiles.openCursor(scanned); cursor; cursor = await cursor.continue()) {
    await cursor.delete();
  }
  const areas = transaction.objectStore('areas');
  for (let cursor = await areas.openCursor(); cursor; cursor = await cursor.continue()) {
    const area = cursor.value;
    const layers = area.layers.filter((layer) => (layer.source as string) !== SCANNED_TOPO);
    if (layers.length < area.layers.length) await cursor.update({ ...area, layers });
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
