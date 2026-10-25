# @teselia/web

The Teselia progressive web app: map and offline areas, identity and groups, the event log and its sync with the group's server, live positions and chat.

| Path                        | Content                                                                                                                                      |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/App.svelte`            | Application shell                                                                                                                            |
| `src/lib/map/`              | Map view, style, tile protocol, offline tile store and area downloads ([ADR-0011](../../docs/decisions/0011-client-side-area-download.md))   |
| `src/lib/offline/`          | Offline maps panel                                                                                                                           |
| `src/lib/identity/`         | This device's key pair and alias; first-launch dialog                                                                                        |
| `src/lib/groups/`           | Groups, roles, invitations (QR, link, camera scan) and joining ([ADR-0012](../../docs/decisions/0012-invitation-links-under-a-base-path.md)) |
| `src/lib/storage/`          | The app's IndexedDB database (identity, groups, settings)                                                                                    |
| `src/lib/events/`           | Each group's event log, own sequence numbers and the outbox                                                                                  |
| `src/lib/sync/`             | Relay client (protocol §8) and the live feed of the active group                                                                             |
| `src/lib/position/`         | Sharing this device's position, and when to report it                                                                                        |
| `src/lib/chat/`             | Group chat panel                                                                                                                             |
| `src/lib/session.svelte.ts` | Reactive state of identity and groups that components read                                                                                   |
| `src/lib/ui/`               | Shared building blocks: panel, dialog, toast, QR code                                                                                        |
| `src/lib/pwa/`              | Service worker registration and update prompt                                                                                                |
| `src/lib/i18n/`             | Spanish and English texts; English defines the keys                                                                                          |
| `public/map-assets/`        | Vendored glyphs and sprites, see its README for licences                                                                                     |
| `e2e/`                      | End-to-end tests in a real browser                                                                                                           |

| Variable           | Meaning                                                                        |
| ------------------ | ------------------------------------------------------------------------------ |
| `VITE_BASEMAP_URL` | PMTiles base map. Defaults to the Protomaps demo archive, for development only |
| `VITE_SERVER_URL`  | Server proposed for new groups; empty for none                                 |
| `TESELIA_BASE`     | Base path when served from a sub-folder, e.g. `/Teselia/` on GitHub Pages      |

```sh
pnpm dev        # development server
pnpm build      # production build in dist/
pnpm test:e2e   # end-to-end tests (Playwright Chromium required)
```
