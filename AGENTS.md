# Instructions for AI assistants

You are working on Tesel, an open-source situational-awareness app. You do not remember previous sessions, so this file is how continuity works.

At the start of every session, before writing code:

1. Read [`CONTRIBUTING.md`](CONTRIBUTING.md) in full. Its rules bind you exactly as they bind people.
2. Read [`ARCHITECTURE.md`](ARCHITECTURE.md) and the list of ADRs in [`docs/decisions/`](docs/decisions/).
3. Read [`docs/protocol.md`](docs/protocol.md) if the task touches events, crypto, transports or the radio.
4. Check `git log --oneline -20` to see where the work stands.

While working:

- Prefer extending existing modules over creating new ones. Search before you write.
- Do not leave the codebase with two ways of doing the same thing. If you add a better way, migrate the old uses in the same change.
- When you make a decision a future contributor would ask "why?" about, record it as an ADR.
- Run `pnpm check` before declaring a task done. A task is not done while it is red.
- End each task by re-reading your diff as a newcomer would, and simplify what you can.
