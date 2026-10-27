// The map of Spain's cadastre (Dirección General del Catastro): parcels with their numbers, and the
// rural polygons that, with the parcel, are how a plot in the country is named ("polígono 12,
// parcela 345"). Its WMS is free, but its terms forbid tiled requests and bulk downloads
// (ADR-0035), so the map asks for one picture of the view once it settles, and only online.

import type { MapImage } from '../map/overlay.svelte.ts';
import { toWebMercator } from '../map/geometry.ts';
import type { Bounds } from '../map/tile-math.ts';

/** Below this zoom a view holds too many parcels to read them. */
export const CADASTRE_MIN_ZOOM = 15;

/** The service's largest picture is 2048 pixels a side. */
const MAX_SIDE_PX = 2048;

const WMS_URL = 'https://ovc.catastro.meh.es/Cartografia/WMS/ServidorWMS.aspx';

/** The cadastre's picture of a view `width` × `height` pixels: where to ask, where it goes. */
export function cadastreImage(bounds: Bounds, width: number, height: number): MapImage {
  const scale = Math.min(1, MAX_SIDE_PX / Math.max(width, height));
  const [west, south] = toWebMercator({ lat: bounds.south, lon: bounds.west });
  const [east, north] = toWebMercator({ lat: bounds.north, lon: bounds.east });
  const query = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.1.1',
    REQUEST: 'GetMap',
    LAYERS: 'Catastro',
    STYLES: '',
    SRS: 'EPSG:3857',
    BBOX: [west, south, east, north].join(','),
    WIDTH: String(Math.round(width * scale)),
    HEIGHT: String(Math.round(height * scale)),
    FORMAT: 'image/png',
    TRANSPARENT: 'TRUE',
  });
  return {
    url: `${WMS_URL}?${query.toString()}`,
    coordinates: [
      [bounds.west, bounds.north],
      [bounds.east, bounds.north],
      [bounds.east, bounds.south],
      [bounds.west, bounds.south],
    ],
  };
}
