// How the tile store's earlier versions become the current one (store.ts): each step runs
// inside the upgrade transaction, which stays open while its requests run.

import type { IDBPTransaction, StoreNames } from 'idb';

import type { MapDb, OfflineArea } from './store-schema.ts';
import type { TileSourceId } from './sources.ts';

type Upgrade = IDBPTransaction<MapDb, StoreNames<MapDb>[], 'versionchange'>;

/**
 * Version 1 had one source, the base map: its tiles were keyed z/x/y and its areas had one
 * maxZoom. They become the base map's, under the keys and layers of version 2.
 */
export async function keyBySource(transaction: Upgrade): Promise<void> {
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
export async function renameSources(transaction: Upgrade): Promise<void> {
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
