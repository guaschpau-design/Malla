import { configDefaults, defineConfig } from 'vitest/config';

/** The web app's tests of runes, which need Svelte's browser build (see the project below). */
const RUNES_TESTS = 'src/**/*.svelte.test.ts';

export default defineConfig({
  test: {
    projects: [
      'packages/*',
      'apps/server',
      'tools/*',
      {
        extends: './apps/web/vite.config.ts',
        test: {
          name: '@tesel/web',
          root: './apps/web',
          exclude: [...configDefaults.exclude, RUNES_TESTS],
        },
      },
      {
        // Effects run only in Svelte's browser build: these tests resolve and build the modules as
        // the browser does, in Node.
        extends: './apps/web/vite.config.ts',
        resolve: { conditions: ['browser'] },
        test: {
          name: '@tesel/web (runes)',
          root: './apps/web',
          include: [RUNES_TESTS],
          environment: './scripts/svelte-test-environment.ts',
        },
      },
    ],
  },
});
