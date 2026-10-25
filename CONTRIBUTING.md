# Contributing

These rules apply to every contributor — people and AI assistants alike. They exist so that anyone can pick up this codebase years from now and understand it. If a rule gets in the way, propose changing the rule in a pull request; do not quietly work around it.

## 1. Before you change anything

1. Read [`ARCHITECTURE.md`](ARCHITECTURE.md). Know which component owns what you are about to touch.
2. Skim [`docs/decisions/`](docs/decisions/). If your change contradicts a decision, write a new ADR that supersedes it — in the same pull request.
3. If you touch anything that goes on the wire, read [`docs/protocol.md`](docs/protocol.md) first and **change the spec before the code**.

## 2. Languages

- Code, identifiers, comments, commit messages, technical docs and ADRs: **English**.
- User-facing text: through the translation files only, never hard-coded. Spanish and English ship together; a string is not done until both exist.
- Product docs for the project owner (`docs/briefing.md`): Spanish.

## 3. Design rules

1. **Respect the dependency direction** in `ARCHITECTURE.md` §2. `protocol` and `core` stay pure: no DOM, no Node APIs, no network, no timers that cannot be injected.
2. **One way to do a thing.** Before adding a helper, search for an existing one. Before adding a dependency, check whether the platform already does it.
3. **Boring technology.** Prefer the standard library, well-known packages and plain patterns. Clever code needs a comment that justifies it; if the justification is "it is shorter", rewrite it.
4. **Small modules with one job.** A file over ~300 lines or a function over ~50 lines is a signal to split.
5. **Make illegal states unrepresentable.** Use discriminated unions and exhaustive `switch` statements over loose objects and flags.
6. **Errors are values at boundaries.** Decoding and parsing return a result type; they never throw on bad input from the network or the radio.
7. **No magic numbers.** Protocol constants live in `packages/protocol/src/constants.ts` with a comment pointing to the spec section.

## 4. Refactor, don't patch

- A change is finished when it works **and** the code around it is at least as clear as before.
- If you need a second special case in the same place, stop and redesign that place instead of adding the special case.
- No commented-out code, no `TODO` without an issue link, no `any`, no `@ts-ignore`. If you need `@ts-expect-error`, explain why on the same line.
- Delete dead code. Git remembers it.

## 5. Tests

- `packages/protocol` and `packages/core` require tests for every behaviour. Round-trip tests for every event type; reducer tests for out-of-order, duplicate and late delivery.
- A bug fix starts with a failing test that reproduces it.
- Tests describe behaviour in their names: `it("ignores a duplicate event delivered by a second transport")`.
- UI code is tested where logic lives; keep logic out of components so it can be tested.

## 6. Commits and pull requests

- One logical change per pull request. If the description needs the word "and" twice, split it.
- The description says **what** changed and **why**. Link the issue or ADR.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/): `feat(core): thin positions before LoRa send`.
- CI must be green: format, lint, type check, tests, build. Nothing merges red.

## 7. Style

Automated, so there is nothing to argue about:

- Formatting: Prettier. Run `pnpm format`.
- Linting: ESLint with `typescript-eslint` strict rules. Run `pnpm lint`.
- Types: TypeScript strict mode, including `noUncheckedIndexedAccess`. Run `pnpm typecheck`.
- Naming: `camelCase` for values and functions, `PascalCase` for types and components, `SCREAMING_SNAKE_CASE` for protocol constants. Files are `kebab-case.ts`.

## 8. Releases

Before every release:

1. A reviewer who did not write the code reads the diff since the last release, looking for anything a newcomer would not understand. Findings are fixed, not filed.
2. `docs/protocol.md`, `ARCHITECTURE.md` and the ADRs match the code.
3. Before the first public release, one or two external developers add a small feature using only the docs. Where they get stuck, we fix the docs or the code.

## 9. Commands

```sh
pnpm install        # install dependencies
pnpm dev            # run the web app and the server locally
pnpm test           # run all tests
pnpm lint           # lint
pnpm typecheck      # type-check every package
pnpm format         # format everything
pnpm check          # everything CI runs
```

## 10. Licence

By contributing you agree that your contribution is licensed under the [EUPL-1.2](LICENSE).
