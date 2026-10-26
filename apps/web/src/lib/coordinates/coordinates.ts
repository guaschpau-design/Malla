// Coordinates as people read them aloud and write them down, in the formats teams use: decimal
// degrees, degrees-minutes-seconds, UTM and MGRS. Every format can be read back, so a coordinate
// dictated over the radio can be found on the map.

import type { LatLon } from '@tesel/protocol';

import { formatDecimal, formatDms, parseDegrees } from './degrees.ts';
import { formatMgrs, mgrsToUtm, parseMgrs, toMgrs } from './mgrs.ts';
import { BANDS, bandOf, bandSouth, fromUtm, toUtm, type Utm } from './utm.ts';

export const COORDINATE_FORMATS = ['decimal', 'dms', 'utm', 'mgrs'] as const;
export type CoordinateFormat = (typeof COORDINATE_FORMATS)[number];

/** A point written in a format, or null where the format does not reach (UTM near the poles). */
export function formatCoordinate(at: LatLon, format: CoordinateFormat): string | null {
  switch (format) {
    case 'decimal':
      return formatDecimal(at);
    case 'dms':
      return formatDms(at);
    case 'utm': {
      const utm = toUtm(at);
      return utm && formatUtm(utm);
    }
    case 'mgrs': {
      const utm = toUtm(at);
      return utm && formatMgrs(toMgrs(utm));
    }
  }
}

/** Reads a coordinate in any of the formats; null if the text is none of them. */
export function parseCoordinate(text: string): LatLon | null {
  const mgrs = parseMgrs(text);
  if (mgrs !== null) {
    const utm = mgrsToUtm(mgrs);
    return utm && fromUtm(utm);
  }
  const utm = parseUtm(text);
  if (utm !== null) return fromUtm(utm);
  return parseDegrees(text);
}

/** Zone and band, then easting and northing in whole metres: "30S 725695E 4372210N". */
function formatUtm(utm: Utm): string {
  const metres = (value: number) => String(Math.floor(value));
  return `${String(utm.zone)}${utm.band} ${metres(utm.easting)}E ${metres(utm.northing)}N`;
}

/**
 * Reads "30S 725695 4372210", "30 S 725695E 4372210N" and the like. The letter is a latitude band,
 * as in Spain's usage, unless only a hemisphere (N or S) makes sense of the northing.
 */
function parseUtm(text: string): Utm | null {
  const match =
    /^(\d{1,2})\s*([A-Z])\s+(\d{6}(?:\.\d+)?)\s*(?:M\s*)?E?\s*[,;]?\s*(\d{1,7}(?:\.\d+)?)\s*(?:M\s*)?N?$/.exec(
      text.trim().toUpperCase(),
    );
  if (match === null) return null;
  const [, zoneText = '', letter = '', eastingText = '', northingText = ''] = match;
  const zone = Number(zoneText);
  const easting = Number(eastingText);
  const northing = Number(northingText);
  if (zone < 1 || zone > 60 || easting < 100_000 || easting > 900_000) return null;
  if (BANDS.includes(letter) && bandFits(letter, zone, easting, northing)) {
    return { zone, band: letter, easting, northing };
  }
  if (letter !== 'N' && letter !== 'S') return null;
  // A hemisphere: find the band from the latitude the coordinates give in it.
  const hemisphereBand = letter === 'N' ? 'N' : 'M';
  const { lat } = fromUtm({ zone, band: hemisphereBand, easting, northing });
  return { zone, band: bandOf(lat), easting, northing };
}

/** Whether coordinates read with this band land in it, give or take the band's rounding. */
function bandFits(band: string, zone: number, easting: number, northing: number): boolean {
  const { lat } = fromUtm({ zone, band, easting, northing });
  const south = bandSouth(band);
  const north = band === 'X' ? 84 : south + 8;
  return lat >= south - 0.5 && lat <= north + 0.5;
}
