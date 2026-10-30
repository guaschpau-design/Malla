// What a practice takes place on: the streets the simulated members walk, by name, the water and
// the parks round them, and the lie of the land where it is known. The situations place what
// happens on it (a person lost in a park, water rising from a stream), and the members say where
// things are as people do: by the name of the street.

import { bearingDegrees, distanceMeters, nearestOnSegment } from '@tesel/core';
import type { LatLon } from '@tesel/protocol';
import { WalkNetwork } from '@tesel/scenario';

import type { Locale, MessageKey, Translate } from '../i18n/index.ts';
import { insideRing, toPosition } from '../map/geometry.ts';
import type { NamedArea, NamedLine, Surroundings } from '../map/tiles/surroundings.ts';
import type { HeightGrid } from './heights.ts';

/** A street is called by its name within this distance of it. */
const STREET_NEAR_M = 30;

/** The eight directions, clockwise from north, as the members say them. */
const DIRECTIONS: readonly MessageKey[] = [
  'practiceNorth',
  'practiceNorthEast',
  'practiceEast',
  'practiceSouthEast',
  'practiceSouth',
  'practiceSouthWest',
  'practiceWest',
  'practiceNorthWest',
];

/**
 * The first word of a Spanish street's name, and the article the street then takes: "la Calle
 * Mayor", "el Camino Viejo". A name that starts otherwise goes without one.
 */
const SPANISH_ARTICLES: Readonly<Record<string, 'la' | 'el'>> = {
  calle: 'la',
  avenida: 'la',
  plaza: 'la',
  carretera: 'la',
  ronda: 'la',
  travesía: 'la',
  vía: 'la',
  senda: 'la',
  rambla: 'la',
  glorieta: 'la',
  cuesta: 'la',
  alameda: 'la',
  urbanización: 'la',
  partida: 'la',
  camino: 'el',
  paseo: 'el',
  pasaje: 'el',
  callejón: 'el',
  bulevar: 'el',
  carrer: 'el',
  passeig: 'el',
  camí: 'el',
  parque: 'el',
  jardín: 'el',
  barranco: 'el',
  puente: 'el',
  polígono: 'el',
};

/** A place everyone knows, which others are told from: the meeting point. */
export interface Landmark {
  readonly at: LatLon;
  readonly name: string;
}

interface NamedSegment {
  readonly a: LatLon;
  readonly b: LatLon;
  readonly name: string;
}

export class Ground {
  /** The streets and paths, joined; null where the map has none, and members walk straight. */
  readonly network: WalkNetwork | null;
  readonly waterways: readonly NamedLine[];
  readonly greens: readonly NamedArea[];
  /** The lie of the land; null where it is not known. */
  readonly heights: HeightGrid | null;
  readonly #locale: Locale;
  readonly #named: readonly NamedSegment[];

  constructor(surroundings: Surroundings, heights: HeightGrid | null, locale: Locale) {
    this.network = WalkNetwork.from(surroundings.ways.map((way) => way.points));
    this.waterways = surroundings.waterways;
    this.greens = surroundings.greens;
    this.heights = heights;
    this.#locale = locale;
    this.#named = surroundings.ways.flatMap(({ points, name }) =>
      name === null ? [] : points.slice(1).map((b, index) => ({ a: points[index] ?? b, b, name })),
    );
  }

  /** Where someone standing at `at` steps onto the streets; `at` itself where there are none. */
  snap(at: LatLon): LatLon {
    return this.network?.snap(at) ?? at;
  }

  /** The name of the street at a point, as it is said ("la Calle Mayor"); null if it has none. */
  streetAt(at: LatLon): string | null {
    let nearest: NamedSegment | null = null;
    let nearestM = STREET_NEAR_M;
    for (const segment of this.#named) {
      const { meters } = nearestOnSegment(at, segment.a, segment.b);
      if (meters < nearestM) [nearest, nearestM] = [segment, meters];
    }
    return nearest === null ? null : this.said(nearest.name);
  }

  /** The river, stream or canal within `metres` of a point, if any. */
  waterAt(at: LatLon, metres: number): NamedLine | null {
    return (
      this.waterways.find(({ points }) =>
        points
          .slice(1)
          .some((b, index) => nearestOnSegment(at, points[index] ?? b, b).meters <= metres),
      ) ?? null
    );
  }

  /** The park or wood a point is in, if any. */
  greenAt(at: LatLon): NamedArea | null {
    return this.greens.find((green) => insideRing(green.ring.map(toPosition), at)) ?? null;
  }

  /**
   * Where a point is, in words: in the park or on the street it is in, by name, or else how far
   * and which way it is from a place everyone knows (`from`, with its name).
   */
  where(t: Translate, at: LatLon, from: Landmark): string {
    const green = this.greenAt(at);
    if (green?.name) return t('practiceInPlace', { place: this.said(green.name) });
    return this.address(t, at, from);
  }

  /**
   * Where a door is, in words: on its street, by name, or else how far and which way it is from a
   * place everyone knows. A house in a park is still on its street.
   */
  address(t: Translate, at: LatLon, from: Landmark): string {
    const street = this.streetAt(at);
    if (street !== null) return t('practiceOnStreet', { street });
    return t('practiceFromPlace', {
      metres: roundedMetres(distanceMeters(from.at, at)),
      direction: this.direction(t, from.at, at),
      place: from.name,
    });
  }

  /** Which way `to` lies from `from`, as one of the eight directions in words. */
  direction(t: Translate, from: LatLon, to: LatLon): string {
    return heading(t, bearingDegrees(from, to));
  }

  /** A name as it is said in a sentence: with its article, in Spanish ("el Barranco de Prueba"). */
  said(name: string): string {
    if (this.#locale !== 'es') return name;
    const article = SPANISH_ARTICLES[name.split(' ')[0]?.toLowerCase() ?? ''];
    return article === undefined ? name : `${article} ${name}`;
  }
}

/** A bearing, in degrees from north, as the nearest of the eight directions in words. */
export function heading(t: Translate, bearing: number): string {
  const sector = Math.round((((bearing % 360) + 360) % 360) / 45) % DIRECTIONS.length;
  return t(DIRECTIONS[sector] ?? 'practiceNorth');
}

/** Metres as people round them: to ten under a hundred, to fifty beyond. */
function roundedMetres(metres: number): number {
  return metres < 100 ? Math.max(10, Math.round(metres / 10) * 10) : Math.round(metres / 50) * 50;
}
