<script lang="ts">
  import type { Map as MapLibreMap } from 'maplibre-gl';
  import { onMount } from 'svelte';

  import { formatBytes, formatDateTime } from '../format.ts';
  import type { Locale, Translate } from '../i18n/index.ts';
  import { downloadArea, MAX_AREA_TILES, type TileArchive } from '../map/area-download.ts';
  import { BASEMAP_MAX_ZOOM } from '../map/style.ts';
  import { countTiles, type Bounds } from '../map/tile-math.ts';
  import type { OfflineArea, TileStore } from '../map/tile-store.ts';
  import Panel from '../ui/Panel.svelte';

  interface Props {
    t: Translate;
    locale: Locale;
    map: MapLibreMap;
    store: TileStore;
    archive: TileArchive;
    onclose: () => void;
  }

  let { t, locale, map, store, archive, onclose }: Props = $props();

  /** Rough average size of a vector tile, only used to estimate download size. */
  const AVERAGE_TILE_BYTES = 25 * 1024;

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

  const tileCount = $derived(countTiles(bounds, 0, maxZoom));
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
      await downloadArea(archive, store, {
        id: crypto.randomUUID(),
        name: name.trim() || t('defaultAreaName', { date: formatDateTime(now, locale) }),
        bounds,
        maxZoom,
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
          size: formatBytes(tileCount * AVERAGE_TILE_BYTES, locale),
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

  .areas li .hint {
    display: block;
  }
</style>
