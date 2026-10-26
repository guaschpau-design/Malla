# 0019. The project is called Tesel

- Status: Accepted
- Date: 2026-10-26
- Supersedes: [0014](0014-name-teselia.md)

## Context

The owner renamed the project from Teselia to Tesel and registered `tesel.eu`. Tesel keeps the meaning (a _tesela_ is a tile of a mosaic and of a digital map), is shorter, reads the same in Spanish and English, and avoids Teselia's clash with a region of the Pokémon games noted in ADR-0014. Nothing has been released: protocol version 1 freezes with v0.1.0, and the only data in use belongs to test groups.

## Decision

- The project, the app, the packages (`@tesel/*`), the server image (`tesel-server`), the settings (`TESEL_*`) and the repository (`guaschpau-design/Tesel`) are called **Tesel**. In running text it is written Tesel, like any proper name.
- The rename covers the wire format, as in ADR-0014: the key-derivation salt becomes `tesel/v1` (protocol §5). This is the last moment it can change without a new protocol version.
- The web app's storage is renamed (`tesel`, `tesel-map`), and its tile protocol becomes `tesel-tiles://`.
- `tesel.eu` is the main domain. The VPS answers the old `teselia.eu` with a permanent redirect to the same address on `tesel.eu`, so links and QR codes already printed keep reaching the site. The installer takes the old domain as `--redirect-from`.
- The installer migrates a server installed under the old name: it stops it, keeps the base map and the operator's settings, and removes what the old name left behind.
- The MeshCore `data_type` stays `0xFF4D`, still pending registration (ADR-0006).

## Consequences

- Groups and invitations created before the rename stop working: their keys were derived with the old salt, and the browser keeps the old origin's data apart anyway. Test installations start empty.
- `teselia.eu` has to stay registered while old links may still circulate; at least a year is recommended.
- A trademark search for TESEL in EUIPO (classes 9 and 42) is pending before the public release. The closest name found is Tessl, a developer tool, spelled differently and in another field.
