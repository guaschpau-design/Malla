<!-- The cadastre's parcels over the map (cadastre.ts): one picture of the view, asked for when the
     map settles at a zoom where parcels can be read. While the next one comes, the last stays where
     it was; without a connection, or zoomed out, there is none. -->
<script lang="ts">
  import type { Map as MapLibreMap } from 'maplibre-gl';
  import { onMount } from 'svelte';

  import { TRANSPARENT_IMAGE_URL } from '../map/empty-tiles.ts';
  import { useOverlay, type MapImage } from '../map/overlay.svelte.ts';
  import { CADASTRE_MIN_ZOOM, cadastreImage } from './cadastre.ts';

  interface Props {
    map: MapLibreMap;
  }

  let { map }: Props = $props();

  const PICTURE = 'tesel-cadastre';
  const NOTHING: MapImage = {
    url: TRANSPARENT_IMAGE_URL,
    coordinates: [
      [0, 0.001],
      [0.001, 0.001],
      [0.001, 0],
      [0, 0],
    ],
  };

  /** The picture of the view, from a URL of our own made from the bytes downloaded. */
  let picture: MapImage | null = $state(null);

  function show(next: MapImage | null): void {
    const last = picture;
    picture = next;
    if (last) URL.revokeObjectURL(last.url);
  }

  async function fetchPicture(signal: AbortSignal): Promise<MapImage | null> {
    if (map.getZoom() < CADASTRE_MIN_ZOOM) return null;
    const b = map.getBounds();
    const canvas = map.getCanvas();
    const request = cadastreImage(
      { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() },
      canvas.clientWidth,
      canvas.clientHeight,
    );
    try {
      const response = await fetch(request.url, { signal });
      // The service answers errors with a document, not a picture.
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
      void fetchPicture(signal).then((next) => {
        if (!signal.aborted) show(next);
        else if (next) URL.revokeObjectURL(next.url);
      });
    };
    refresh();
    map.on('moveend', refresh);
    return () => {
      map.off('moveend', refresh);
      request.abort();
      show(null);
    };
  });

  useOverlay(() => map, {
    level: 'cadastre',
    data: { [PICTURE]: () => picture ?? NOTHING },
    visible: () => picture !== null,
    layers: () => [
      {
        id: PICTURE,
        type: 'raster',
        source: PICTURE,
        paint: { 'raster-opacity': 0.9, 'raster-fade-duration': 0 },
      },
    ],
  });
</script>
