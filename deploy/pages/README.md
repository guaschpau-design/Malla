# GitHub Pages redirect

The web app used to be published on GitHub Pages. It now lives at <https://tesel.eu/app/> ([ADR-0017](../../docs/decisions/0017-server-serves-site-and-app.md)), and the `pages` job of CI publishes only these files:

- `index.html`, also copied to `404.html`: sends every old address to the same path under `https://tesel.eu/app/`, keeping the fragment, so old invitation links still work.
- `sw.js`: replaces the old service worker and unregisters itself, so installed copies stop serving the old app.
