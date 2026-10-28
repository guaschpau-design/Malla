// The Vitest environment of the web app's tests of runes (*.svelte.test.ts): Node, with the modules
// built as for the browser. Svelte's server build never runs effects, so code that keeps the map
// in step with the state through $effect can only be tested with its browser build.

import type { Environment } from 'vitest/runtime';

export default {
  name: 'svelte-browser-build',
  viteEnvironment: 'client',
  setup: () => ({ teardown: () => undefined }),
} satisfies Environment;
