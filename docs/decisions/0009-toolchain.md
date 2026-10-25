# 0009. Toolchain: TypeScript, pnpm workspace, Svelte, Vitest

- Status: Accepted
- Date: 2026-10-25

## Context

The code must be approachable for the largest possible pool of contributors and run in the browser and in Node. Type safety matters for a binary protocol.

## Decision

- TypeScript in strict mode everywhere, including `noUncheckedIndexedAccess`. TypeScript 6.0, the newest version supported by `typescript-eslint` and `svelte-check` at the time of writing.
- A pnpm workspace with `apps/*` and `packages/*`.
- Svelte 5 for the UI, Vite for building, `vite-plugin-pwa` for offline support, MapLibre GL JS for maps.
- Vitest for tests, ESLint with `typescript-eslint` for linting, Prettier for formatting, GitHub Actions for CI.
- Cryptography from `@noble/hashes`, `@noble/ciphers` and `@noble/curves`: audited, dependency-free, identical in browser and Node.

## Consequences

- Mainstream, well-documented tools; most web developers can contribute on day one.
- Moving to TypeScript 7 waits until the lint and Svelte tooling support it.
