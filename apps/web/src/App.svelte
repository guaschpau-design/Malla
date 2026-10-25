<script lang="ts">
  import type { Map as MapLibreMap } from 'maplibre-gl';
  import { onMount } from 'svelte';

  import { BASEMAP_URL } from './lib/config.ts';
  import { connection, watchConnection } from './lib/connection.svelte.ts';
  import { detectLocale, translator, type Locale } from './lib/i18n/index.ts';
  import MapView from './lib/map/MapView.svelte';
  import type { MapTheme } from './lib/map/style.ts';
  import { pmtilesArchive, registerTileProtocol } from './lib/map/tile-source.ts';
  import { openTileStore, type TileStore } from './lib/map/tile-store.ts';
  import OfflineAreasPanel from './lib/offline/OfflineAreasPanel.svelte';
  import UpdatePrompt from './lib/pwa/UpdatePrompt.svelte';

  let locale: Locale = $state(detectLocale(navigator.languages));
  const t = $derived(translator(locale));

  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  let theme: MapTheme = $state(darkQuery.matches ? 'dark' : 'light');

  const archive = pmtilesArchive(BASEMAP_URL);
  let store: TileStore | undefined = $state();
  let map: MapLibreMap | undefined = $state();
  let panelOpen = $state(false);

  onMount(() => {
    const stopWatching = watchConnection();
    const onScheme = (event: MediaQueryListEvent) => (theme = event.matches ? 'dark' : 'light');
    darkQuery.addEventListener('change', onScheme);

    void openTileStore().then((opened) => {
      registerTileProtocol(opened, archive);
      store = opened;
    });

    return () => {
      stopWatching();
      darkQuery.removeEventListener('change', onScheme);
    };
  });

  function onMapReady(instance: MapLibreMap): void {
    map = instance;
  }

  $effect(() => {
    document.documentElement.lang = locale;
  });
</script>

<div class="app">
  <header class="bar">
    <span class="brand">Malla</span>
    <span class="status" class:offline={!connection.online} role="status">
      <span class="dot" aria-hidden="true"></span>
      {connection.online ? t('online') : t('offline')}
    </span>
    <button class="ghost" onclick={() => (locale = locale === 'es' ? 'en' : 'es')}>
      {t('switchLanguage')}
    </button>
  </header>

  <main>
    {#if store}
      <MapView {theme} lang={locale} onready={onMapReady} />
    {/if}

    {#if map && store}
      <button class="fab" onclick={() => (panelOpen = !panelOpen)} aria-expanded={panelOpen}>
        {t('offlineAreas')}
      </button>
      {#if panelOpen}
        <OfflineAreasPanel
          {t}
          {locale}
          {map}
          {store}
          {archive}
          onclose={() => (panelOpen = false)}
        />
      {/if}
    {/if}

    <UpdatePrompt {t} />
  </main>
</div>

<style>
  .app {
    display: grid;
    grid-template-rows: auto 1fr;
    height: 100dvh;
  }

  .bar {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    padding: calc(0.5rem + env(safe-area-inset-top)) 1rem 0.5rem;
    color: var(--bar-fg);
    background: var(--bar-bg);
  }

  .brand {
    font-size: 1.15rem;
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  .status {
    display: inline-flex;
    gap: 0.4rem;
    align-items: center;
    margin-right: auto;
    font-size: 0.85rem;
  }

  .dot {
    width: 0.55rem;
    height: 0.55rem;
    background: var(--ok);
    border-radius: 50%;
  }

  .status.offline .dot {
    background: var(--danger);
  }

  main {
    position: relative;
    overflow: hidden;
  }

  .fab {
    position: absolute;
    z-index: 1;
    right: 1rem;
    bottom: calc(2.5rem + env(safe-area-inset-bottom));
    padding: 0.75rem 1rem;
    font-weight: 600;
    color: var(--surface);
    background: var(--fg);
    border: none;
    border-radius: 999px;
    box-shadow: 0 4px 16px rgb(0 0 0 / 30%);
  }
</style>
