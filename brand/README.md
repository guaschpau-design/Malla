# Brand

The Tesel mark, wordmark and lockup.

| File              | What                                                                                                           |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| `mark.svg`        | Three hexagonal tiles, one lit: a tessellation, map cells and mesh nodes. Pale tiles take `currentColor`       |
| `wordmark.svg`    | "Tesel" in Archivo, expanded, weight 700, as outlines so it needs no font                                      |
| `lockup.svg`      | Mark and wordmark side by side, ink, for paper                                                                 |
| `lockup-pale.svg` | The same, pale, for ink: the headers of the app (imported from here) and of the site (`apps/site/img`, a copy) |
| `build.py`        | Rebuilds the SVGs and the site's copy (`python3 brand/build.py`; needs fonttools, brotli, uharfbuzz)           |

The app icons are rendered from the mark with `pnpm --filter @tesel/web icons` (`apps/web/scripts/render-icons.js`).

Colours, in `colors.json`, shared with the app and the site ([ADR-0020](../docs/decisions/0020-colour-and-symbols.md)): ink `#10202c`, pale `#e6ebe8`, signal lime `#c8f04a`, and its deep shade `#4d6e00` for text and lines on light backgrounds. The mark is pale on ink and ink on paper; the lit tile is always signal lime. Keep clear space of at least one tile around the lockup. The site's typeface is the same Archivo.
