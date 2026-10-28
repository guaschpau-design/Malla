<!-- Instructions and controls shown at the top while drawing; a route can also be read from a file,
     which is then shown as drawn, to look over before finishing. -->
<script lang="ts">
  import { formatDistance } from '../format.ts';
  import type { Locale, MessageKey, Translate } from '../i18n/index.ts';
  import MapCard from '../ui/MapCard.svelte';
  import { DRAFT_TITLES, isComplete, type Draft, type DraftKind } from './draft.ts';
  import { importRoute, type ImportedRoute, type RouteImportError } from './route-import.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    draft: Draft;
    /** The route read from a file, when the draft came from one. */
    imported: ImportedRoute | null;
    onundo: () => void;
    onfinish: () => void;
    onimport: (route: ImportedRoute) => void;
    oncancel: () => void;
  }

  let { t, locale, draft, imported, onundo, onfinish, onimport, oncancel }: Props = $props();

  const HINTS: Readonly<Record<DraftKind, MessageKey>> = {
    marker: 'drawHintMarker',
    route: 'drawHintRoute',
    area: 'drawHintArea',
  };

  const IMPORT_FAILURES: Readonly<Record<RouteImportError, MessageKey>> = {
    'too-big': 'routeFileTooBig',
    unreadable: 'routeFileUnreadable',
    unsupported: 'routeFileUnsupported',
    'no-line': 'routeFileNoLine',
  };

  let picker: HTMLInputElement | undefined = $state();
  let failure: MessageKey | null = $state(null);

  async function read(file: File): Promise<void> {
    const result = await importRoute(file);
    failure = result.ok ? null : IMPORT_FAILURES[result.error];
    if (result.ok) onimport(result.value);
  }
</script>

<MapCard label={t(DRAFT_TITLES[draft.kind])}>
  {#if imported}
    <p>{t('routeImported', { name: imported.name, points: imported.points.length })}</p>
    {#if imported.read > imported.points.length}
      <p class="hint">
        {t('routeSimplified', {
          read: imported.read,
          deviation: formatDistance(imported.deviation, locale),
        })}
      </p>
    {/if}
  {:else}
    <p>{t(HINTS[draft.kind])}</p>
  {/if}
  {#if failure}<p class="warning">{t(failure)}</p>{/if}
  <div class="row">
    <button onclick={onundo} disabled={draft.points.length === 0}>{t('undo')}</button>
    {#if draft.kind !== 'marker'}
      <button class="primary" onclick={onfinish} disabled={!isComplete(draft)}>{t('finish')}</button
      >
    {/if}
    {#if draft.kind === 'route'}
      <button onclick={() => picker?.click()}>{t('routeImport')}</button>
      <input
        bind:this={picker}
        type="file"
        accept=".gpx,.kml,.geojson,.json"
        hidden
        onchange={(event) => {
          const [file] = event.currentTarget.files ?? [];
          event.currentTarget.value = '';
          if (file) void read(file);
        }}
      />
    {/if}
    <button onclick={oncancel}>{t('cancel')}</button>
  </div>
</MapCard>
