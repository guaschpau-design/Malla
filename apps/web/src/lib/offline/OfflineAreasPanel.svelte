<script lang="ts">
  import type { Map as MapLibreMap } from 'maplibre-gl';
  import { onMount } from 'svelte';

  import { formatBytes, formatDateTime } from '../format.ts';
  import type { Locale, MessageKey, Translate } from '../i18n/index.ts';
  import {
    countAreaTiles,
    downloadArea,
    MAX_AREA_TILES,
    type DownloadLayer,
  } from '../map/area-download.ts';
  import { BASEMAP_MAX_ZOOM } from '../map/style.ts';
  import type { Bounds } from '../map/tile-math.ts';
  import type { TileArchives } from '../map/tile-source.ts';
  import type { OfflineArea, TileStore } from '../map/tile-store.ts';
  import type { RasterSourceId, TileSourceId } from '../map/tile-sources.ts';
  import Panel from '../ui/Panel.svelte';

  interface Props {
    t: Translate;
    locale: Locale;
    map: MapLibreMap;
    store: TileStore;
    archives: TileArchives;
    onclose: () => void;
  }

  let { t, locale, map, store, archives, onclose }: Props = $props();

  /** Rough average size of a tile of each source, only used to estimate download size. */
  const AVERAGE_TILE_BYTES: Readonly<Record<TileSourceId, number>> = {
    basemap: 25 * 1024,
    'ign-topo': 18 * 1024,
    'ign-ortho': 18 * 1024,
  };
  /** Photographs and topographic maps need three zooms more than the vector map for the same
      detail: their tiles cannot be enlarged without blurring. */
  const RASTER_EXTRA_ZOOM = 3;
  const SOURCE_NAMES: Readonly<Record<TileSourceId, MessageKey>> = {
    basemap: 'baseMapStreets',
    'ign-topo': 'baseMapTopo',
    'ign-ortho': 'baseMapAerial',
  };
  const RASTERS: readonly RasterSourceId[] = ['ign-topo', 'ign-ortho'];

  const detailOptions = [
    { zoom: BASEMAP_MAX_ZOOM, label: 'detailStreets' },
    { zoom: BASEMAP_MAX_ZOOM - 1, label: 'detailTown' },
    { zoom: BASEMAP_MAX_ZOOM - 2, label: 'detailRegion' },
  ] as const;

  let areas: OfflineArea[] = $state([]);
  // Raw state: the value is stored in IndexedDB, which cannot clone Svelte's reactive proxies.
  let bounds: Bounds = $state.raw(currentBounds());
  let maxZoom: number = $state(BASEMAP_MAX_ZOOM);
  let name = $state('');
  let progress: { done: number; total: number } | null = $state(null);
  let failed = $state(false);
  let storage: { used: number; quota: number } | null = $state(null);
  let controller: AbortController | null = null;

  /** The raster maps to download as well as the street map. */
  let extras: RasterSourceId[] = $state([]);
  const layers: DownloadLayer[] = $derived([
    { source: 'basemap', archive: archives.basemap, maxZoom },
    ...extras.map((source) => ({
      source,
      archive: archives[source],
      maxZoom: maxZoom + RASTER_EXTRA_ZOOM,
    })),
  ]);
  const tileCount = $derived(countAreaTiles(bounds, layers));
  const estimatedBytes = $derived(
    layers.reduce(
      (sum, layer) => sum + countAreaTiles(bounds, [layer]) * AVERAGE_TILE_BYTES[layer.source],
      0,
    ),
  );
  const tooLarge = $derived(tileCount > MAX_AREA_TILES);

  function currentBounds(): Bounds {
    const b = map.getBounds();
    return { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() };
  }

  async function refresh(): Promise<void> {
    areas = await store.listAreas();
    const estimate = await navigator.storage.estimate();
    storage = { used: estimate.usage ?? 0, quota: estimate.quota ?? 0 };
  }

  async function startDownload(): Promise<void> {
    controller = new AbortController();
    failed = false;
    progress = { done: 0, total: tileCount };
    const now = Date.now();
    try {
      await downloadArea(store, {
        id: crypto.randomUUID(),
        name: name.trim() || t('defaultAreaName', { date: formatDateTime(now, locale) }),
        bounds,
        layers,
        signal: controller.signal,
        onProgress: (p) => (progress = { done: p.done, total: p.total }),
      });
      name = '';
      // Ask the browser not to evict our data under storage pressure.
      await navigator.storage.persist();
    } catch (error) {
      failed = !controller.signal.aborted;
      if (failed) console.warn('Offline area download failed', error);
    } finally {
      progress = null;
      controller = null;
      await refresh();
    }
  }

  async function remove(area: OfflineArea): Promise<void> {
    if (!confirm(t('confirmDelete', { name: area.name }))) return;
    await store.deleteArea(area);
    await refresh();
  }

  function show(area: OfflineArea): void {
    const { west, south, east, north } = area.bounds;
    map.fitBounds([west, south, east, north], { padding: 24 });
  }

  onMount(() => {
    const update = () => (bounds = currentBounds());
    map.on('moveend', update);
    void refresh();
    return () => {
      map.off('moveend', update);
      controller?.abort();
    };
  });
</script>

<Panel title={t('offlineAreas')} closeLabel={t('close')} {onclose}>
  <p class="intro">{t('areasIntro')}</p>

  <form
    class="download"
    onsubmit={(event) => {
      event.preventDefault();
      void startDownload();
    }}
  >
    <h3>{t('downloadVisible')}</h3>
    <label>
      {t('areaName')}
      <input bind:value={name} maxlength="40" disabled={progress !== null} />
    </label>
    <label>
      {t('detail')}
      <select bind:value={maxZoom} disabled={progress !== null}>
        {#each detailOptions as option (option.zoom)}
          <option value={option.zoom}>{t(option.label)}</option>
        {/each}
      </select>
    </label>

    <fieldset class="extras" disabled={progress !== null}>
      <legend>{t('downloadAlso')}</legend>
      {#each RASTERS as source (source)}
        <label class="check">
          <input type="checkbox" value={source} bind:group={extras} />
          {t(SOURCE_NAMES[source])}
        </label>
      {/each}
      <p class="hint">{t('downloadAlsoHint')}</p>
    </fieldset>

    {#if progress}
      <progress max={progress.total} value={progress.done}></progress>
      <p class="hint">{t('downloading', { done: progress.done, total: progress.total })}</p>
      <button
        type="button"
        onclick={() => {
          controller?.abort();
        }}>{t('cancel')}</button
      >
    {:else if tooLarge}
      <p class="warning">{t('areaTooLarge')}</p>
    {:else}
      <p class="hint">
        {t('estimate', {
          tiles: tileCount.toLocaleString(locale),
          size: formatBytes(estimatedBytes, locale),
        })}
      </p>
      <button type="submit" class="primary">{t('download')}</button>
    {/if}
    {#if failed}<p class="warning">{t('downloadFailed')}</p>{/if}
  </form>

  {#if areas.length === 0}
    <p class="hint">{t('noAreas')}</p>
  {:else}
    <ul class="cards areas">
      {#each areas as area (area.id)}
        <li>
          <div>
            <strong>{area.name}</strong>
            {#if !area.complete}<span class="badge danger">{t('incomplete')}</span>{/if}
            <span class="hint">
              {area.layers.map((layer) => t(SOURCE_NAMES[layer.source])).join(' + ')} ·
              {formatBytes(area.bytes, locale)} · {formatDateTime(area.createdAt, locale)}
            </span>
          </div>
          <div class="row">
            <button
              onclick={() => {
                show(area);
              }}>{t('showOnMap')}</button
            >
            <button onclick={() => remove(area)}>{t('delete')}</button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}

  {#if storage}
    <p class="hint">
      {t('storageUsed', {
        used: formatBytes(storage.used, locale),
        quota: formatBytes(storage.quota, locale),
      })}
    </p>
  {/if}
</Panel>

<style>
  .download {
    display: grid;
    gap: 0.6rem;
    margin: 1rem 0;
    padding: 0.9rem;
    border: 1px solid var(--border);
    border-radius: 0.75rem;
  }

  progress {
    width: 100%;
  }

  .extras {
    display: grid;
    gap: 0.35rem;
    margin: 0;
    padding: 0;
    border: 0;
  }

  .extras legend {
    margin-bottom: 0.25rem;
    padding: 0;
    font-size: 0.9rem;
  }

  .check {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .areas li .hint {
    display: block;
  }
</style>
