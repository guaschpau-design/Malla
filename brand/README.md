# Brand

The Teselia mark, wordmark and lockup. The app icons are rendered from the mark with `pnpm --filter @teselia/web icons` (`apps/web/scripts/render-icons.js`).

| File           | What                                                                                   |
| -------------- | -------------------------------------------------------------------------------------- |
| `mark.svg`     | The mark: a T of five tesserae, one of them lit. Takes its colour from `currentColor`  |
| `wordmark.svg` | "Teselia" in Geologica 620 as outlines, so it needs no font                            |
| `lockup.svg`   | Mark and wordmark side by side                                                         |
| `build.py`     | Rebuilds the three SVGs (`python3 brand/build.py`; needs fonttools, brotli, uharfbuzz) |

Colours: ink `#10202c`, pale `#e6ebe8`, signal `#f26a2e`. The mark is pale on ink and ink on paper; the lit tessera is always signal orange. Keep clear space of at least one tessera around the lockup, and do not redraw the tesserae: their irregular cut is the point.
