<!-- Offers each member the map of the operation area, so it works there without a connection: a
     card on the map while an operation area is not downloaded yet, with its size, one button to
     download it and one to leave it for later. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import { onMount } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';

  import { formatBytes } from '../format.ts';
  import type { Locale, Translate } from '../i18n/index.ts';
  import { BASEMAP_MAX_ZOOM } from '../map/tiles/sources.ts';
  import type { OfflineArea } from '../map/tiles/store-schema.ts';
  import { operationAreas } from '../objects/operation-areas.ts';
  import MapCard from '../ui/MapCard.svelte';
  import { DownloadJob } from './download-job.svelte.ts';
  import {
    detailThatFits,
    downloadLayers,
    estimatedBytes,
    failureText,
    isDownloaded,
    type OfflineMaps,
  } from './offline-maps.ts';
  import { attempt } from '../ui/submission.svelte.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    groupState: GroupState;
    offline: OfflineMaps;
  }

  let { t, locale, groupState, offline }: Props = $props();

  /** The least detail worth offering: below a town's streets, the map is of little use on foot. */
  const LOWEST_DETAIL = BASEMAP_MAX_ZOOM - 2;

  let downloaded: readonly OfflineArea[] | null = $state.raw(null);
  /** Areas left for later on this device, until the app restarts. */
  const later = new SvelteSet<string>();
  const job = new DownloadJob();

  /** The first operation area still to offer, with what downloading it takes. */
  const offer = $derived.by(() => {
    if (downloaded === null) return null;
    const areas = downloaded;
    const area = operationAreas(groupState).find(
      (candidate) => !later.has(candidate.key) && !isDownloaded(areas, candidate.bounds),
    );
    if (area === undefined) return null;
    const zoom = detailThatFits(area.bounds, LOWEST_DETAIL);
    const layers = zoom === null ? null : downloadLayers(offline.archives, zoom, []);
    return { area, layers, bytes: layers ? estimatedBytes(area.bounds, layers) : 0 };
  });

  async function refresh(): Promise<void> {
    downloaded = await offline.store.listAreas();
  }

  function download(): void {
    if (offer?.layers == null) return;
    const { area, layers } = offer;
    attempt(async () => {
      await job.run(offline.store, {
        name: area.label || t('styleOperationArea'),
        bounds: area.bounds,
        layers,
      });
      await refresh();
    }, t('actionFailed'));
  }

  onMount(() => {
    attempt(refresh, t('actionFailed'));
    return () => {
      job.cancel();
    };
  });
</script>

{#if offer}
  {@const { area, layers, bytes } = offer}
  {@const title = area.label
    ? t('operationAreaTitle', { name: area.label })
    : t('styleOperationArea')}
  <MapCard label={title}>
    <strong>{title}</strong>
    {#if job.progress}
      <progress max={job.progress.total} value={job.progress.done}></progress>
      <div class="row">
        <button
          onclick={() => {
            job.cancel();
          }}>{t('cancel')}</button
        >
      </div>
    {:else if layers === null}
      <p class="hint">{t('operationAreaTooLarge')}</p>
      <div class="row">
        <button onclick={() => later.add(area.key)}>{t('close')}</button>
      </div>
    {:else}
      <p class="hint">{t('operationAreaOffer', { size: formatBytes(bytes, locale) })}</p>
      {#if job.failure}<p class="warning">{failureText(job.failure, t, locale)}</p>{/if}
      <div class="row">
        <button class="primary" onclick={download}>{t('download')}</button>
        <button onclick={() => later.add(area.key)}>{t('notNow')}</button>
      </div>
    {/if}
  </MapCard>
{/if}

<style>
  progress {
    width: 100%;
  }
</style>
