import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 60_000,
  reporter: process.env['CI'] ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'es-ES',
    ...devices['Pixel 7'],
    launchOptions: { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: {
    // Production build pointed at the synthetic basemap, served next to the app.
    command:
      `VITE_BASEMAP_URL=http://localhost:${PORT}/test-basemap.pmtiles vite build && ` +
      `node -e "require('fs').copyFileSync('e2e/fixtures/test-basemap.pmtiles','dist/test-basemap.pmtiles')" && ` +
      `vite preview --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
