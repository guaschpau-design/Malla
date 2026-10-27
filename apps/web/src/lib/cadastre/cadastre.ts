// The cadastres' maps: parcels with their numbers, and in Spain the rural polygons that, with the
// parcel, are how a plot in the country is named ("polígono 12, parcela 345"). Spain's Dirección
// General del Catastro and France's IGN publish them as free WMS. Spain's terms forbid tiled
// requests and bulk downloads (ADR-0036), so the map asks each service whose country is in view for
// one picture of the view once it settles, and only online. Portugal has no national cadastre
// service to show.

import { toWebMercator } from '../map/geometry.ts';
import type { MapImage } from '../map/overlay.svelte.ts';
import type { Bounds } from '../map/tile-math.ts';

/** Below this zoom a view holds too many parcels to read them. */
export const CADASTRE_MIN_ZOOM = 15;

/** The services' largest picture is 2048 pixels a side. */
const MAX_SIDE_PX = 2048;

export interface CadastreService {
  /** Unique among the services, for the map's source. */
  readonly id: string;
  /** Where the service has parcels; outside, its pictures are transparent. */
  readonly bounds: Bounds;
  readonly url: string;
  readonly version: '1.1.1' | '1.3.0';
  readonly layer: string;
  readonly style: string;
  /** The credit the service asks for, as HTML (map/style-credits.svelte.ts). */
  readonly credit: string;
}

export const CADASTRES: readonly CadastreService[] = [
  {
    id: 'spain',
    // The peninsula, the Balearic and the Canary Islands.
    bounds: { west: -18.2, south: 27.6, east: 4.4, north: 43.8 },
    url: 'https://ovc.catastro.meh.es/Cartografia/WMS/ServidorWMS.aspx',
    version: '1.1.1',
    layer: 'Catastro',
    style: '',
    credit:
      '<a href="https://www.sedecatastro.gob.es" target="_blank">© Dirección General del Catastro</a>',
  },
  {
    id: 'france',
    // Metropolitan France.
    bounds: { west: -5.2, south: 41.3, east: 9.6, north: 51.1 },
    url: 'https://data.geopf.fr/wms-r/wms',
    version: '1.3.0',
    layer: 'CADASTRALPARCELS.PARCELLAIRE_EXPRESS',
    // The style with each parcel's number.
    style: 'PCI vecteur',
    credit: '<a href="https://www.ign.fr" target="_blank">© IGN</a> · PCI Express',
  },
];

export const CADASTRE_CREDITS = CADASTRES.map((service) => service.credit);

/** The services whose country is in a view. */
export function cadastresIn(view: Bounds): CadastreService[] {
  return CADASTRES.filter(
    ({ bounds }) =>
      bounds.west < view.east &&
      bounds.east > view.west &&
      bounds.south < view.north &&
      bounds.north > view.south,
  );
}

/** A service's picture of a view `width` × `height` pixels: where to ask, where it goes. */
export function cadastreImage(
  service: CadastreService,
  view: Bounds,
  width: number,
  height: number,
): MapImage {
  const scale = Math.min(1, MAX_SIDE_PX / Math.max(width, height));
  const [west, south] = toWebMercator({ lat: view.south, lon: view.west });
  const [east, north] = toWebMercator({ lat: view.north, lon: view.east });
  const query = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: service.version,
    REQUEST: 'GetMap',
    LAYERS: service.layer,
    STYLES: service.style,
    // WMS 1.3.0 renamed the parameter; in Web Mercator the axes keep their order.
    [service.version === '1.3.0' ? 'CRS' : 'SRS']: 'EPSG:3857',
    BBOX: [west, south, east, north].join(','),
    WIDTH: String(Math.round(width * scale)),
    HEIGHT: String(Math.round(height * scale)),
    FORMAT: 'image/png',
    TRANSPARENT: 'TRUE',
  });
  return {
    url: `${service.url}?${query.toString()}`,
    coordinates: [
      [view.west, view.north],
      [view.east, view.north],
      [view.east, view.south],
      [view.west, view.south],
    ],
  };
}
