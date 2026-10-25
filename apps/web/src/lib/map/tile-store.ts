// Offline storage of map tiles and of the areas they were downloaded for (IndexedDB).
//
// Areas may overlap, so each tile records which areas need it; deleting an area only removes
// tiles that no remaining area uses.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

import { tileKey, tilesInBounds, type Bounds } from './tile-math.ts';

export interface OfflineArea {
  readonly id: string;
  readonly name: string;
  readonly bounds: Bounds;
  readonly minZoom: number;
  readonly maxZoom: number;
  /** Tiles that exist in the source; empty tiles (open sea) are not stored. */
  readonly storedTiles: number;
  readonly bytes: number;
  /** Milliseconds since the epoch. */
  readonly createdAt: number;
  /** False while downloading or if a download was interrupted. */
  readonly complete: boolean;
}

export interface StoredTile {
  readonly key: string;
  readonly data: ArrayBuffer;
}

export interface TileStore {
  getTile(key: string): Promise<ArrayBuffer | undefined>;
  /** Stores tiles for an area in one transaction. */
  putTiles(areaId: string, tiles: readonly StoredTile[]): Promise<void>;
  saveArea(area: OfflineArea): Promise<void>;
  listAreas(): Promise<OfflineArea[]>;
  deleteArea(area: OfflineArea): Promise<void>;
}

interface MapDb extends DBSchema {
  tiles: { key: string; value: { data: ArrayBuffer; areas: string[] } };
  areas: { key: string; value: OfflineArea };
}

const DB_NAME = 'malla-map';
const DB_VERSION = 1;

export async function openTileStore(name: string = DB_NAME): Promise<TileStore> {
  const db = await openDB<MapDb>(name, DB_VERSION, {
    upgrade(database) {
      database.createObjectStore('tiles');
      database.createObjectStore('areas', { keyPath: 'id' });
    },
  });
  return new IndexedDbTileStore(db);
}

class IndexedDbTileStore implements TileStore {
  private readonly db: IDBPDatabase<MapDb>;

  constructor(db: IDBPDatabase<MapDb>) {
    this.db = db;
  }

  async getTile(key: string): Promise<ArrayBuffer | undefined> {
    return (await this.db.get('tiles', key))?.data;
  }

  async putTiles(areaId: string, tiles: readonly StoredTile[]): Promise<void> {
    const tx = this.db.transaction('tiles', 'readwrite');
    await Promise.all(
      tiles.map(async ({ key, data }) => {
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
    for (const coord of tilesInBounds(area.bounds, area.minZoom, area.maxZoom)) {
      const key = tileKey(coord);
      const existing = await tiles.get(key);
      if (!existing) continue;
      const areas = existing.areas.filter((id) => id !== area.id);
      if (areas.length === 0) await tiles.delete(key);
      else await tiles.put({ data: existing.data, areas }, key);
    }
    await tx.objectStore('areas').delete(area.id);
    await tx.done;
  }
}
