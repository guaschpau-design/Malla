import { describe, expect, it } from 'vitest';

import type { TileArchive } from '../map/area-download.ts';
import type { TileArchives } from '../map/tile-source.ts';
import type { OfflineArea } from '../map/tile-store.ts';
import { RELIEF_MAX_ZOOM, TERRAIN_MAX_ZOOM } from '../map/tile-sources.ts';
import { areaContents, downloadLayers } from './offline-maps.ts';

const archive: TileArchive = { getTile: () => Promise.resolve(undefined) };
const archives: TileArchives = {
  basemap: archive,
  'ign-contours': archive,
  'ign-ortho': archive,
  'ign-relief': archive,
  terrain: archive,
};

describe('offline maps', () => {
  it('downloads each extra from its sources, each to the zoom it needs', () => {
    const layers = downloadLayers(archives, 14, ['topo', 'aerial', 'relief']);
    expect(layers.map(({ source, maxZoom }) => [source, maxZoom])).toEqual([
      ['basemap', 14],
      ['ign-contours', 14],
      ['ign-ortho', 17],
      ['ign-relief', RELIEF_MAX_ZOOM],
      ['terrain', TERRAIN_MAX_ZOOM],
    ]);
  });

  it('names what an area holds once, whatever the sources behind it', () => {
    const area: OfflineArea = {
      id: 'a',
      name: 'a',
      bounds: { west: 0, south: 0, east: 1, north: 1 },
      minZoom: 0,
      layers: downloadLayers(archives, 14, ['relief']).map(({ source, maxZoom }) => ({
        source,
        maxZoom,
      })),
      storedTiles: 0,
      bytes: 0,
      createdAt: 0,
      complete: true,
    };
    expect(areaContents(area)).toEqual(['baseMapStreets', 'layerRelief']);
  });
});
