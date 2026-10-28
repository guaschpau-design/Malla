<!-- The card at the top while drawing: what is drawn, one line of what to do and, once points are
     tapped, how many of the most there may be. A route can also be read from a file, which is then
     shown as drawn, to look over before finishing. -->
<script lang="ts">
  import { formatDistance } from '../format.ts';
  import type { Locale, MessageKey, Translate } from '../i18n/index.ts';
  import Pictogram from '../ui/Pictogram.svelte';
  import ToolCard from '../ui/ToolCard.svelte';
  import {
    DRAFT_TITLES,
    isComplete,
    MAX_SHAPE_POINTS,
    type Draft,
    type DraftKind,
  } from './draft.ts';
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

  const title = $derived(t(DRAFT_TITLES[draft.kind]));
  /** A marker is one tap: it needs no count. */
  const progress = $derived(
    draft.kind === 'marker' || draft.points.length === 0
      ? t(HINTS[draft.kind])
      : t('drawPoints', { count: draft.points.length, max: MAX_SHAPE_POINTS }),
  );
</script>

<ToolCard
  label={title}
  undoLabel={t('undo')}
  canUndo={draft.points.length > 0}
  {onundo}
  closeLabel={t('cancel')}
  onclose={oncancel}
  finish={draft.kind === 'marker'
    ? undefined
    : { label: t('finish'), disabled: !isComplete(draft), run: onfinish }}
>
  {#snippet tools()}
    {#if draft.kind === 'route'}
      <button
        class="icon"
        aria-label={t('routeImport')}
        title={t('routeImport')}
        onclick={() => picker?.click()}
      >
        <Pictogram name="file" size={22} />
      </button>
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
  {/snippet}
  {#if imported}
    <p>
      <strong>{title}</strong> · {t('routeImported', {
        name: imported.name,
        points: imported.points.length,
      })}
    </p>
    {#if imported.read > imported.points.length}
      <p class="hint">
        {t('routeSimplified', {
          read: imported.read,
          deviation: formatDistance(imported.deviation, locale),
        })}
      </p>
    {/if}
  {:else}
    <p><strong>{title}</strong> · {progress}</p>
  {/if}
  {#if failure}<p class="warning">{t(failure)}</p>{/if}
</ToolCard>
