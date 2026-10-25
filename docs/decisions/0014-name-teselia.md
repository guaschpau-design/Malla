# 0014. The project is called Teselia

- Status: Accepted
- Date: 2026-10-25
- Supersedes: the provisional name "Malla"

## Context

The project started under the provisional name "Malla" (Spanish for mesh). The owner chose the final name before the first release. Renaming is cheapest now: nothing is released, and the only data in use belongs to test groups.

## Decision

- The project, the app and the packages are called **Teselia**: in Spanish, the tiles of a mosaic and of a digital map are _teselas_, many small pieces that only form the picture together.
- The rename covers every identifier, including the wire format: the key-derivation salt becomes `teselia/v1` (protocol §5). Protocol version 1 has not been released, so this is not a version change.
- The web app's storage is renamed too (`teselia`, `teselia-map`). Test installations start empty and must recreate their groups.
- The MeshCore `data_type` stays `0xFF4D`: it is a provisional value from the development range, to be replaced by a registered one (ADR-0006).

## Consequences

- Groups and invitations created before the rename stop working.
- In Spanish, Teselia is also the local name of a region in the Pokémon games. A trademark search in EUIPO (classes 9 and 38) is pending before the public release.
- The GitHub repository keeps its current name and address until the owner renames it.
