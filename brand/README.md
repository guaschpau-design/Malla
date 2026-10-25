# Brand

The Teselia mark, wordmark and lockup.

| File           | What                                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| `mark.svg`     | Three hexagonal tiles, one lit: a tessellation, map cells and mesh nodes. Pale tiles take `currentColor` |
| `wordmark.svg` | "Teselia" in Archivo, expanded, weight 640, as outlines so it needs no font                              |
| `lockup.svg`   | Mark and wordmark side by side                                                                           |
| `build.py`     | Rebuilds the three SVGs (`python3 brand/build.py`; needs fonttools, brotli, uharfbuzz)                   |

The app icons are rendered from the mark with `pnpm --filter @teselia/web icons` (`apps/web/scripts/render-icons.js`).

Colours: ink `#10202c`, pale `#e6ebe8`, signal `#f26a2e`. The mark is pale on ink and ink on paper; the lit tile is always signal orange. Keep clear space of at least one tile around the lockup. The site's typeface is the same Archivo.
