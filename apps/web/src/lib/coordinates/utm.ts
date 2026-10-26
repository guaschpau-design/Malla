// Universal Transverse Mercator on the WGS 84 ellipsoid, which GPS uses. ETRS89, the datum of
// Spanish and European official maps, differs from it by well under a metre: for field work they
// are the same. Krüger's series to the third order, accurate to a millimetre within a zone
// (Karney, "Transverse Mercator with an accuracy of a few nanometers", 2011).

import type { LatLon } from '@tesel/protocol';

export interface Utm {
  /** 1 to 60, six degrees of longitude each. */
  readonly zone: number;
  /** Latitude band letter, C to X, eight degrees each (X is twelve). */
  readonly band: string;
  readonly easting: number;
  /** In the southern hemisphere, measured from a false origin 10 000 km south of the equator. */
  readonly northing: number;
}

/** Latitude bands from 80° S, eight degrees each; I and O are skipped. */
export const BANDS = 'CDEFGHJKLMNPQRSTUVWX';
/** UTM covers these latitudes; the poles use another projection (UPS). */
const SOUTH_LIMIT = -80;
const NORTH_LIMIT = 84;

const A = 6_378_137;
const F = 1 / 298.257_223_563;
const K0 = 0.9996;
const FALSE_EASTING = 500_000;
const FALSE_NORTHING_SOUTH = 10_000_000;

const N = F / (2 - F);
/** The rectifying radius, times the scale on the central meridian. */
const K0_A = ((K0 * A) / (1 + N)) * (1 + N ** 2 / 4 + N ** 4 / 64);
const ALPHA = [
  N / 2 - (2 * N ** 2) / 3 + (5 * N ** 3) / 16,
  (13 * N ** 2) / 48 - (3 * N ** 3) / 5,
  (61 * N ** 3) / 240,
];
const BETA = [
  N / 2 - (2 * N ** 2) / 3 + (37 * N ** 3) / 96,
  N ** 2 / 48 + N ** 3 / 15,
  (17 * N ** 3) / 480,
];
const DELTA = [
  2 * N - (2 * N ** 2) / 3 - 2 * N ** 3,
  (7 * N ** 2) / 3 - (8 * N ** 3) / 5,
  (56 * N ** 3) / 15,
];
const E_FACTOR = (2 * Math.sqrt(N)) / (1 + N);

const RAD = Math.PI / 180;

/** The UTM coordinates of a point, or null near the poles, where UTM does not reach. */
export function toUtm(at: LatLon): Utm | null {
  if (at.lat < SOUTH_LIMIT || at.lat > NORTH_LIMIT) return null;
  const zone = zoneOf(at);
  const phi = at.lat * RAD;
  const lambda = (at.lon - centralMeridian(zone)) * RAD;

  const t = Math.sinh(Math.atanh(Math.sin(phi)) - E_FACTOR * Math.atanh(E_FACTOR * Math.sin(phi)));
  const xiPrime = Math.atan2(t, Math.cos(lambda));
  const etaPrime = Math.atanh(Math.sin(lambda) / Math.sqrt(1 + t * t));
  let xi = xiPrime;
  let eta = etaPrime;
  for (const [index, alpha] of ALPHA.entries()) {
    const j = 2 * (index + 1);
    xi += alpha * Math.sin(j * xiPrime) * Math.cosh(j * etaPrime);
    eta += alpha * Math.cos(j * xiPrime) * Math.sinh(j * etaPrime);
  }

  return {
    zone,
    band: bandOf(at.lat),
    easting: toMillimetres(FALSE_EASTING + K0_A * eta),
    northing: toMillimetres((at.lat < 0 ? FALSE_NORTHING_SOUTH : 0) + K0_A * xi),
  };
}

/** The point at some UTM coordinates. The band says the hemisphere: N and after are north. */
export function fromUtm(utm: Utm): LatLon {
  const south = BANDS.indexOf(utm.band) < BANDS.indexOf('N');
  const xi = (utm.northing - (south ? FALSE_NORTHING_SOUTH : 0)) / K0_A;
  const eta = (utm.easting - FALSE_EASTING) / K0_A;
  let xiPrime = xi;
  let etaPrime = eta;
  for (const [index, beta] of BETA.entries()) {
    const j = 2 * (index + 1);
    xiPrime -= beta * Math.sin(j * xi) * Math.cosh(j * eta);
    etaPrime -= beta * Math.cos(j * xi) * Math.sinh(j * eta);
  }
  const chi = Math.asin(Math.sin(xiPrime) / Math.cosh(etaPrime));
  let phi = chi;
  for (const [index, delta] of DELTA.entries()) phi += delta * Math.sin(2 * (index + 1) * chi);
  const lambda = Math.atan2(Math.sinh(etaPrime), Math.cos(xiPrime));
  return { lat: phi / RAD, lon: normaliseLongitude(centralMeridian(utm.zone) + lambda / RAD) };
}

/** The band letter of a latitude within UTM's reach. */
export function bandOf(lat: number): string {
  const index = Math.min(Math.floor((lat - SOUTH_LIMIT) / 8), BANDS.length - 1);
  return BANDS[Math.max(index, 0)] ?? 'X';
}

/** The southernmost latitude of a band. */
export function bandSouth(band: string): number {
  return SOUTH_LIMIT + 8 * BANDS.indexOf(band);
}

function zoneOf({ lat, lon }: LatLon): number {
  // Two exceptions widen zones over the sea: south-west Norway and Svalbard.
  if (lat >= 56 && lat < 64 && lon >= 3 && lon < 12) return 32;
  if (lat >= 72) {
    if (lon >= 0 && lon < 9) return 31;
    if (lon >= 9 && lon < 21) return 33;
    if (lon >= 21 && lon < 33) return 35;
    if (lon >= 33 && lon < 42) return 37;
  }
  return Math.min(Math.floor((normaliseLongitude(lon) + 180) / 6) + 1, 60);
}

/**
 * The series is good to a millimetre; rounding to it keeps a coordinate read and written back from
 * losing a metre when it is cut down for display (724 999.9999 shown as 724 999).
 */
function toMillimetres(metres: number): number {
  return Math.round(metres * 1000) / 1000;
}

function centralMeridian(zone: number): number {
  return zone * 6 - 183;
}

function normaliseLongitude(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}
