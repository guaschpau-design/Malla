// Build-time configuration, from Vite environment variables.

/**
 * Base map in PMTiles format. Until our own server is up (day 3), development uses the
 * Protomaps demo archive, which is meant for testing only and must not be used in production.
 */
export const BASEMAP_URL: string =
  (import.meta.env['VITE_BASEMAP_URL'] as string | undefined) ??
  'https://demo-bucket.protomaps.com/v4.pmtiles';

/** Absolute URL of the vendored glyphs and sprites (public/map-assets). */
export function mapAssetsUrl(): string {
  return new URL(`${import.meta.env.BASE_URL}map-assets/`, window.location.href).href;
}

/**
 * Server proposed for new groups (protocol §8), or null if this build has none. Coordinators can
 * change it when they create a group.
 */
export const DEFAULT_SERVER_URL: string | null =
  (import.meta.env['VITE_SERVER_URL'] as string | undefined) || null;
