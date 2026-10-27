// The satellite map: the newest national orthophotos of Spain (IGN, PNOA), mainland Portugal (DGT,
// OrtoSat 2023) and France (IGN France, BD ORTHO), as one source (ADR-0037). Each tile comes from
// the country it lies in. A tile across a border is put together from both: Spain's first, which
// reaches a little across it; Portugal's over it, whose service leaves the rest transparent; and
// France's within France's outline (borders-data.ts), since its service paints the rest white.
// Further out than zoom 8, where the three are alike, Spain's service shows them all by itself.

import type { TileArchive } from './area-download.ts';
import { FRANCE_SOUTH, PORTUGAL } from './borders-data.ts';
import { ringCoverage, toWebMercator } from './geometry.ts';
import { positionInTile, tileBounds, type TileCoord } from './tile-math.ts';
import { SCNE, webArchive } from './tile-sources.ts';

/** The orthophotos are drawn and downloaded up to this zoom; MapLibre enlarges them beyond it. */
export const ORTHO_MAX_ZOOM = 18;

export const ORTHO_ATTRIBUTION =
  `${SCNE} · PNOA | ` +
  '<a href="https://www.dgterritorio.gov.pt" target="_blank">CC BY 4.0 DGT</a> · OrtoSat 2023 | ' +
  '<a href="https://www.ign.fr" target="_blank">© IGN</a> · BD ORTHO';

/**
 * From this zoom each country's own photographs are sharper beyond Spain than Spain's service, which
 * there has only a coarse Sentinel-2 mosaic; DGT's service draws nothing further out.
 */
const NATIONAL_MIN_ZOOM = 8;
const TILE_PX = 256;
/** Tiles put together are saved as JPEG, like the services' own. */
const JPEG_QUALITY = 0.85;

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

/** OrtoSat 2023 from DGT's WMS, one tile's square at a time: PNG keeps the outside transparent. */
function portugalUrl(format: 'image/jpeg' | 'image/png') {
  return (z: number, x: number, y: number): string => {
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
      FORMAT: format,
      TRANSPARENT: String(format === 'image/png').toUpperCase(),
    });
    return `https://ortos.dgterritorio.gov.pt/wms/ortosat2023?${query.toString()}`;
  };
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

export function orthoArchive(): TileArchive {
  const spain = webArchive(spainUrl);
  const portugal = webArchive(portugalUrl('image/jpeg'));
  const portugalOver = webArchive(portugalUrl('image/png'));
  const france = webArchive(franceUrl);
  return {
    async getTile(z, x, y, signal) {
      if (z < NATIONAL_MIN_ZOOM) return spain.getTile(z, x, y, signal);
      const bounds = tileBounds({ z, x, y });
      const inPortugal = ringCoverage(PORTUGAL, bounds);
      const inFrance = ringCoverage(FRANCE_SOUTH, bounds);
      if (inPortugal === 'all') return portugal.getTile(z, x, y, signal);
      if (inFrance === 'all') return france.getTile(z, x, y, signal);
      const base = await spain.getTile(z, x, y, signal);
      if (inPortugal === 'none' && inFrance === 'none') return base;
      const [over, french] = await Promise.all([
        inPortugal === 'part' ? portugalOver.getTile(z, x, y, signal) : undefined,
        inFrance === 'part' ? france.getTile(z, x, y, signal) : undefined,
      ]);
      return joinAtBorders({ z, x, y }, base, over, french);
    },
  };
}

/** Spain's tile, Portugal's over it, and France's within France: one JPEG tile. */
async function joinAtBorders(
  tile: TileCoord,
  spain: ArrayBuffer | undefined,
  portugal: ArrayBuffer | undefined,
  france: ArrayBuffer | undefined,
): Promise<ArrayBuffer | undefined> {
  if (portugal === undefined && france === undefined) return spain;
  const canvas = new OffscreenCanvas(TILE_PX, TILE_PX);
  const context = canvas.getContext('2d');
  if (context === null) return spain;
  const draw = async (bytes: ArrayBuffer | undefined) => {
    if (bytes === undefined) return;
    const image = await createImageBitmap(new Blob([bytes]));
    context.drawImage(image, 0, 0, TILE_PX, TILE_PX);
    image.close();
  };
  await draw(spain);
  await draw(portugal);
  if (france !== undefined) {
    context.save();
    context.beginPath();
    for (const point of FRANCE_SOUTH) {
      const [u, v] = positionInTile(point, tile);
      context.lineTo(u * TILE_PX, v * TILE_PX);
    }
    context.clip();
    await draw(france);
    context.restore();
  }
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY });
  return blob.arrayBuffer();
}
