# @malla/web

The Malla progressive web app: map, offline areas and, from day 2 onwards, groups, events and transports.

| Path                 | Content                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/App.svelte`     | Application shell                                                                                                                          |
| `src/lib/map/`       | Map view, style, tile protocol, offline tile store and area downloads ([ADR-0011](../../docs/decisions/0011-client-side-area-download.md)) |
| `src/lib/offline/`   | Offline maps panel                                                                                                                         |
| `src/lib/pwa/`       | Service worker registration and update prompt                                                                                              |
| `src/lib/i18n/`      | Spanish and English texts; English defines the keys                                                                                        |
| `public/map-assets/` | Vendored glyphs and sprites, see its README for licences                                                                                   |
| `e2e/`               | End-to-end tests in a real browser                                                                                                         |

| Variable           | Meaning                                                                        |
| ------------------ | ------------------------------------------------------------------------------ |
| `VITE_BASEMAP_URL` | PMTiles base map. Defaults to the Protomaps demo archive, for development only |
| `MALLA_BASE`       | Base path when served from a sub-folder, e.g. `/malla/`                        |

```sh
pnpm dev        # development server
pnpm build      # production build in dist/
pnpm test:e2e   # end-to-end tests (Playwright Chromium required)
```
