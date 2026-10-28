# 0008. One server program for the VPS and the local command post

- Status: Superseded by [0058](0058-no-command-posts.md)
- Date: 2026-10-25

## Context

The server has two jobs: an internet relay on a VPS, and a local command post on a laptop or Raspberry Pi when the internet is down. Two programs would drift apart. The command post must be easy to install on modest hardware with no internet.

## Decision

- One Node.js program in `apps/server`, with a command-post mode that additionally serves the web app's static files over HTTPS on the local network.
- Storage in SQLite through Node's built-in `node:sqlite`, so there are no native dependencies to compile.
- Distributed as a Docker image and as a plain Node install.

## Consequences

- Behaviour is identical in both roles; tests cover both.
- A command post can later sync with the VPS using the same protocol clients use.
- The HTTPS certificate for a local network without internet is unsolved here; it is designed on day 6 and recorded in its own ADR.
