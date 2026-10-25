# 0001. Record decisions as ADRs; English for code and technical docs

- Status: Accepted
- Date: 2026-10-25

## Context

The project is written with heavy AI assistance and will be released as open source. AI assistants do not remember earlier sessions, and future contributors will not have been in the room. Unrecorded decisions get silently re-made, differently, which is how codebases drift into a pile of patches. The project owner is Spanish; the intended contributors are anyone in Europe and beyond.

## Decision

- Every decision a newcomer would question is recorded as a short ADR in this folder, in the same pull request as the change.
- Code, identifiers, comments, commit messages, technical documentation and ADRs are written in English, the common language of open-source contributors.
- Product documentation for the owner (`docs/briefing.md`) is in Spanish. User-facing text ships in Spanish and English from the first release.

## Consequences

- The reasoning behind the design survives turnover of people and of AI sessions.
- Contributors who do not read Spanish can work on the code; the owner reviews technical docs in English.
- Writing ADRs costs a few minutes per decision; skipping them costs much more later.
