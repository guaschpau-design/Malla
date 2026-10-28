<!-- The cadastres' parcels over the map (cadastre.ts): one picture of the view from each service
     whose country is in it, asked for when the map settles at a zoom where parcels can be read.
     While the next comes, the last stays where it was; without a connection, or zoomed out, there
     is none. -->
<script lang="ts">
  import type { LayerSpecification, Map as MapLibreMap } from 'maplibre-gl';
  import { onMount } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';

  import { TRANSPARENT_IMAGE_URL } from '../map/empty-tiles.ts';
  import { mapBounds } from '../map/geometry.ts';
  import { useOverlay, type MapImage } from '../map/overlay.svelte.ts';
  import type { Bounds } from '../map/tile-math.ts';
  import {
    CADASTRE_MIN_ZOOM,
    CADASTRES,
    cadastreImage,
    cadastresIn,
    type CadastreService,
  } from './cadastre.ts';

  interface Props {
    map: MapLibreMap;
  }

  let { map }: Props = $props();

  const NOTHING: MapImage = {
    url: TRANSPARENT_IMAGE_URL,
    coordinates: [
      [0, 0.001],
      [0.001, 0.001],
      [0.001, 0],
      [0, 0],
    ],
  };

  const sourceOf = (service: CadastreService) => `tesel-cadastre-${service.id}`;

  /** Each service's picture of the view, from a URL of our own made from the bytes downloaded. */
  const pictures = new SvelteMap<string, MapImage>();

  function show(service: CadastreService, next: MapImage | null): void {
    const last = pictures.get(service.id);
    if (next) pictures.set(service.id, next);
    else pictures.delete(service.id);
    if (last) URL.revokeObjectURL(last.url);
  }

  async function fetchPicture(
    service: CadastreService,
    view: Bounds,
    signal: AbortSignal,
  ): Promise<MapImage | null> {
    const canvas = map.getCanvas();
    const request = cadastreImage(service, view, canvas.clientWidth, canvas.clientHeight);
    try {
      const response = await fetch(request.url, { signal });
      // The services answer errors with a document, not a picture.
      if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) return null;
      const url = URL.createObjectURL(await response.blob());
      return { url, coordinates: request.coordinates };
    } catch {
      return null;
    }
  }

  onMount(() => {
    let request = new AbortController();
    const refresh = () => {
      request.abort();
      request = new AbortController();
      const { signal } = request;
      const view = mapBounds(map);
      const inView = map.getZoom() >= CADASTRE_MIN_ZOOM ? cadastresIn(view) : [];
      for (const service of CADASTRES) {
        if (!inView.includes(service)) {
          show(service, null);
          continue;
        }
        void fetchPicture(service, view, signal).then((next) => {
          if (!signal.aborted) show(service, next);
          else if (next) URL.revokeObjectURL(next.url);
        });
      }
    };
    refresh();
    map.on('moveend', refresh);
    return () => {
      map.off('moveend', refresh);
      request.abort();
      for (const service of CADASTRES) show(service, null);
    };
  });

  useOverlay(() => map, {
    level: 'cadastre',
    data: Object.fromEntries(
      CADASTRES.map((service) => [sourceOf(service), () => pictures.get(service.id) ?? NOTHING]),
    ),
    visible: () => pictures.size > 0,
    layers: () =>
      CADASTRES.map((service): LayerSpecification => ({
        id: sourceOf(service),
        type: 'raster',
        source: sourceOf(service),
        paint: { 'raster-opacity': 0.9, 'raster-fade-duration': 0 },
      })),
  });
</script>
