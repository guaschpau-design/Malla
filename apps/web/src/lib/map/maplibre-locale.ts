// MapLibre's own words, in the app's language. Of all its strings the app shows one: the map's name,
// which screen readers announce. The rest belong to MapLibre's controls, which the app does not
// use, and the units of its scale are symbols, the same in every language.

import type { Translate } from '../i18n/index.ts';

/** The strings MapLibre takes in its `locale` option, by its own IDs. */
export type MapLibreLocale = { readonly 'Map.Title': string };

export function mapLibreLocale(t: Translate): MapLibreLocale {
  return { 'Map.Title': t('mapName') };
}
