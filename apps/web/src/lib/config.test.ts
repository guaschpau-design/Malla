import { afterEach, describe, expect, it, vi } from 'vitest';

import { satelliteMosaic } from './config.ts';

describe('build-time configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('shows the 2024 mosaic unless the build chose another', () => {
    vi.stubEnv('VITE_SATELLITE_MOSAIC', '');
    expect(satelliteMosaic()).toBe('s2cloudless-2024');
    vi.stubEnv('VITE_SATELLITE_MOSAIC', 's2cloudless-2016');
    expect(satelliteMosaic()).toBe('s2cloudless-2016');
  });

  it('refuses a mosaic it does not know rather than show another', () => {
    vi.stubEnv('VITE_SATELLITE_MOSAIC', 's2cloudless-2025');
    expect(() => satelliteMosaic()).toThrow(/VITE_SATELLITE_MOSAIC/);
  });
});
