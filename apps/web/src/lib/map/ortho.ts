// The satellite map, as one source (ADR-0041): from afar, one mosaic for every country alike,
// Sentinel-2 cloudless 2024; close up, each country's newest orthophotos laid over it within its
// outline (borders-data.ts) — Spain's (IGN, PNOA), mainland Portugal's (DGT, OrtoSat 2023) and
// France's (IGN France, BD ORTHO). Where no country's photographs reach, such as Andorra, the
// mosaic stays. A tile inside one outline is that country's tile as its service gives it; a tile
// across outlines is put together on the device.

import type { TileArchive } from './area-download.ts';
import { FRANCE_SOUTH, PORTUGAL, SPAIN, type Outline } from './borders-data.ts';
import { outlineCoverage, toWebMercator } from './geometry.ts';
import { positionInTile, tileBounds, type TileCoord } from './tile-math.ts';
import { SCNE, webArchive } from './tile-sources.ts';

/** The orthophotos are drawn and downloaded up to this zoom; MapLibre enlarges them beyond it. */
export const ORTHO_MAX_ZOOM = 18;

export const ORTHO_ATTRIBUTION =
  '<a href="https://s2maps.eu" target="_blank">Sentinel-2 cloudless 2024</a> by EOX IT Services ' +
  'GmbH (contains modified Copernicus Sentinel data 2024) | ' +
  `${SCNE} · PNOA | ` +
  '<a href="https://www.dgterritorio.gov.pt" target="_blank">CC BY 4.0 DGT</a> · OrtoSat 2023 | ' +
  '<a href="https://www.ign.fr" target="_blank">© IGN</a> · BD ORTHO';

/**
 * From this zoom, about a town's view, each country's photographs are laid over the mosaic: further
 * out its 10 m are enough, and one mosaic shows the three countries alike.
 */
const NATIONAL_MIN_ZOOM = 13;
const TILE_PX = 256;
/** Tiles put together are saved as JPEG, like the services' own. */
const JPEG_QUALITY = 0.85;

/** EOX's Sentinel-2 cloudless mosaic of 2024, from its WMTS in the Web Mercator grid. */
function mosaicUrl(z: number, x: number, y: number): string {
  return `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/${String(z)}/${String(y)}/${String(x)}.jpg`;
}

/** PNOA, the newest of each place, from IGN's WMTS in the Web Mercator grid. */
function spainUrl(z: number, x: number, y: number): string {
  const query = new URLSearchParams({
    request: 'GetTile',
    service: 'WMTS',
    version: '1.0.0',
    layer: 'OI.OrthoimageCoverage',
    style: 'default',
    tilematrixset: 'GoogleMapsCompatible',
    tilematrix: String(z),
    tilerow: String(y),
    tilecol: String(x),
    format: 'image/jpeg',
  });
  return `https://www.ign.es/wmts/pnoa-ma?${query.toString()}`;
}

/** OrtoSat 2023 from DGT's WMS, one tile's square at a time. */
function portugalUrl(z: number, x: number, y: number): string {
  const { west, south, east, north } = tileBounds({ z, x, y });
  const [left, bottom] = toWebMercator({ lat: south, lon: west });
  const [right, top] = toWebMercator({ lat: north, lon: east });
  const query = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.3.0',
    REQUEST: 'GetMap',
    LAYERS: 'ortoSat2023-CorVerdadeira',
    STYLES: '',
    CRS: 'EPSG:3857',
    BBOX: [left, bottom, right, top].join(','),
    WIDTH: String(TILE_PX),
    HEIGHT: String(TILE_PX),
    FORMAT: 'image/jpeg',
  });
  return `https://ortos.dgterritorio.gov.pt/wms/ortosat2023?${query.toString()}`;
}

/** BD ORTHO from IGN France's WMTS (Géoplateforme) in the Web Mercator grid. */
function franceUrl(z: number, x: number, y: number): string {
  const query = new URLSearchParams({
    SERVICE: 'WMTS',
    REQUEST: 'GetTile',
    VERSION: '1.0.0',
    LAYER: 'ORTHOIMAGERY.ORTHOPHOTOS',
    STYLE: 'normal',
    TILEMATRIXSET: 'PM',
    TILEMATRIX: String(z),
    TILEROW: String(y),
    TILECOL: String(x),
    FORMAT: 'image/jpeg',
  });
  return `https://data.geopf.fr/wmts?${query.toString()}`;
}

/** A country's photographs and where they are laid; later ones are laid over earlier ones. */
interface Country {
  readonly outline: Outline;
  readonly archive: TileArchive;
}

export function orthoArchive(): TileArchive {
  const mosaic = webArchive(mosaicUrl);
  // Each outline reaches 150 m past its shores and borders, where its service still paints.
  const countries: readonly Country[] = [
    { outline: SPAIN, archive: webArchive(spainUrl) },
    { outline: PORTUGAL, archive: webArchive(portugalUrl) },
    { outline: FRANCE_SOUTH, archive: webArchive(franceUrl) },
  ];
  return {
    async getTile(z, x, y, signal) {
      if (z < NATIONAL_MIN_ZOOM) return mosaic.getTile(z, x, y, signal);
      const tile = { z, x, y };
      const bounds = tileBounds(tile);
      const laid = countries
        .map((country) => ({ country, coverage: outlineCoverage(country.outline, bounds) }))
        .filter(({ coverage }) => coverage !== 'none');
      // What covers the whole tile hides what is under it.
      const covering = laid.findLast(({ coverage }) => coverage === 'all');
      const base = covering?.country.archive ?? mosaic;
      const over = laid
        .slice(covering ? laid.indexOf(covering) + 1 : 0)
        .map(({ country }) => country);
      const [ground, ...photos] = await Promise.all([
        base.getTile(z, x, y, signal),
        ...over.map((country) => country.archive.getTile(z, x, y, signal)),
      ]);
      if (over.length === 0) return ground;
      return layTogether(
        tile,
        ground,
        over.map((country, index) => ({ outline: country.outline, bytes: photos[index] })),
      );
    },
  };
}

/** One JPEG tile: the ground, then each country's photographs within its outline. */
async function layTogether(
  tile: TileCoord,
  ground: ArrayBuffer | undefined,
  photos: readonly { readonly outline: Outline; readonly bytes: ArrayBuffer | undefined }[],
): Promise<ArrayBuffer | undefined> {
  const canvas = new OffscreenCanvas(TILE_PX, TILE_PX);
  const context = canvas.getContext('2d');
  if (context === null) return ground;
  const draw = async (bytes: ArrayBuffer) => {
    const image = await createImageBitmap(new Blob([bytes]));
    context.drawImage(image, 0, 0, TILE_PX, TILE_PX);
    image.close();
  };
  if (ground !== undefined) await draw(ground);
  for (const { outline, bytes } of photos) {
    if (bytes === undefined) continue;
    context.save();
    context.beginPath();
    for (const ring of outline) {
      for (const [index, point] of ring.entries()) {
        const [u, v] = positionInTile(point, tile);
        if (index === 0) context.moveTo(u * TILE_PX, v * TILE_PX);
        else context.lineTo(u * TILE_PX, v * TILE_PX);
      }
      context.closePath();
    }
    context.clip();
    await draw(bytes);
    context.restore();
  }
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY });
  return blob.arrayBuffer();
}
