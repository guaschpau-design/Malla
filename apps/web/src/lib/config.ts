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
 * Server proposed for new groups (protocol §8), or null if this build has none. VITE_SERVER_URL may
 * be relative to the app: the server image builds the app with "/", so every server proposes
 * itself. Coordinators can change it when they create a group.
 */
export function defaultServerUrl(): string | null {
  const configured = import.meta.env['VITE_SERVER_URL'] as string | undefined;
  return configured ? new URL(configured, window.location.href).href : null;
}

/**
 * The user guide on the site served with the app (apps/site), given its path there. The app
 * lives under /app/, so the site is one level up.
 */
export function guideUrl(path: string): string {
  return new URL(`${import.meta.env.BASE_URL}../${path}`, window.location.href).href;
}
