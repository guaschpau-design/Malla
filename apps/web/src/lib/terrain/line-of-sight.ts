// Whether the terrain lets a LoRa radio at one point reach one at another, as radio planning tools
// judge it: the straight line between the two antennas, the Earth's curve under it (with the
// usual 4/3 radius for radio waves bent by the air), and the room a signal needs around that line
// to arrive whole: 60 % of the first Fresnel zone at 869 MHz.
//
// The elevation data (about 10 m apart, a few metres off in height) sees hills and slopes, not
// buildings or trees. So the answer is sure only one way: terrain that rises above the line by
// more than the data's error does cut it. A line clear of the terrain may still be cut by what the
// data does not see, and the answer says so.

import { distanceMeters, EARTH_RADIUS_M } from '@tesel/core';
import type { LatLon } from '@tesel/protocol';

/** About the spacing of the elevation data, in metres (tile-sources.ts). */
const SAMPLE_SPACING_M = 10;
/** Enough samples for 30 km at the data's spacing; longer lines are sampled less finely. */
const MAX_SAMPLES = 3000;
/** How far off the elevation data may be, in metres; within it, nothing is sure. */
export const ELEVATION_ERROR_M = 10;
/** The EU band LoRa uses (MeshCore's EU preset), and its wavelength. */
const FREQUENCY_HZ = 869.525e6;
const WAVELENGTH_M = 299_792_458 / FREQUENCY_HZ;
/** Radio waves bend with the air as if the Earth were this much larger. */
const K_FACTOR = 4 / 3;
/** The share of the first Fresnel zone that must be clear for the signal to arrive whole. */
const FRESNEL_SHARE = 0.6;

/** An end of the link: where it is and how high its antenna is above the ground. */
export interface Antenna {
  readonly at: LatLon;
  readonly height: number;
}

export type Verdict = 'blocked' | 'marginal' | 'clear';

export interface Sight {
  readonly verdict: Verdict;
  /** Metres between the two ends. */
  readonly distance: number;
  /**
   * The point of the way where the terrain comes closest to the line, or rises most above it, and
   * by how many metres the line clears it (negative: the terrain is above the line there).
   */
  readonly worst: { readonly at: LatLon; readonly clearance: number };
}

/** Points along the straight way between the two ends, both included, and one between at least. */
export function sightSamples(from: LatLon, to: LatLon): LatLon[] {
  const length = distanceMeters(from, to);
  const count = Math.min(MAX_SAMPLES, Math.max(3, Math.ceil(length / SAMPLE_SPACING_M) + 1));
  return Array.from({ length: count }, (_, index) => {
    const share = index / (count - 1);
    return {
      lat: from.lat + (to.lat - from.lat) * share,
      lon: from.lon + (to.lon - from.lon) * share,
    };
  });
}

/**
 * The verdict for a link, from the ground elevations at `sightSamples(a.at, b.at)`; null if any
 * elevation is unknown (no data there, or none downloaded without a connection).
 */
export function lineOfSight(
  a: Antenna,
  b: Antenna,
  samples: readonly LatLon[],
  ground: readonly (number | null)[],
): Sight | null {
  if (ground.length !== samples.length || ground.some((value) => value === null)) return null;
  const heights = ground as readonly number[];
  const distance = distanceMeters(a.at, b.at);
  const startHeight = (heights[0] ?? 0) + a.height;
  const endHeight = (heights.at(-1) ?? 0) + b.height;
  let worst = { at: a.at, clearance: Infinity, needed: 0 };
  let blocked = false;
  let marginal = false;
  for (let index = 1; index < samples.length - 1; index++) {
    const at = samples[index] as LatLon;
    const d1 = distanceMeters(a.at, at);
    const d2 = distance - d1;
    const line = startHeight + ((endHeight - startHeight) * d1) / distance;
    const bulge = (d1 * d2) / (2 * K_FACTOR * EARTH_RADIUS_M);
    const clearance = line - ((heights[index] ?? 0) + bulge);
    const needed = FRESNEL_SHARE * Math.sqrt((WAVELENGTH_M * d1 * d2) / distance);
    if (clearance < -ELEVATION_ERROR_M) blocked = true;
    if (clearance < needed + ELEVATION_ERROR_M) marginal = true;
    // The worst point is the one with the least room against what it needs.
    if (clearance - needed < worst.clearance - worst.needed) worst = { at, clearance, needed };
  }
  const verdict: Verdict = blocked ? 'blocked' : marginal ? 'marginal' : 'clear';
  return { verdict, distance, worst: { at: worst.at, clearance: worst.clearance } };
}
