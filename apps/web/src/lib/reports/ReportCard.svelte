<!-- A situation report as the chat and the reports tab show it: pinned, what happened, then one
     line for each thing it tells, and the way to its place on the map. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import type { Place, ReportEvent } from '@tesel/protocol';

  import { formatTime } from '../format.ts';
  import type { Locale, Translate } from '../i18n/index.ts';
  import { aliasOf } from '../members/alias.ts';
  import { placePoint } from '../tasks/tasks.ts';
  import Pictogram from '../ui/Pictogram.svelte';
  import { reportLines } from './report-summary.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    groupState: GroupState;
    report: ReportEvent;
    /** Shows its place on the map. */
    onplace: (place: Place) => void;
  }

  let { t, locale, groupState, report, onplace }: Props = $props();

  const lines = $derived(reportLines(report, t));
  const told = $derived(
    [lines.casualties, lines.access, lines.hazards, lines.resources].filter(
      (line): line is string => line !== null,
    ),
  );
</script>

<article class="report">
  <header>
    <Pictogram name="pushpin" size={16} />
    <strong>{t('reportTitle', { incident: lines.incident })}</strong>
    <span class="meta"
      >{aliasOf(groupState, report.origin)} · {formatTime(report.time * 1000, locale)}</span
    >
  </header>
  {#each told as line (line)}<p>{line}</p>{/each}
  {#if report.note}<p class="note">«{report.note}»</p>{/if}
  {#if report.place && placePoint(report.place, groupState.objects)}
    {@const place = report.place}
    <button
      class="show"
      onclick={() => {
        onplace(place);
      }}
    >
      <Pictogram name="pin" size={16} />
      {t('taskShowPlace')}
    </button>
  {/if}
</article>

<style>
  .report {
    display: grid;
    gap: 0.2rem;
    padding: 0.5rem 0.65rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-left: 4px solid var(--warning);
    border-radius: var(--radius-control);
  }

  header {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem 0.5rem;
    align-items: center;
  }

  .meta {
    color: var(--muted);
    font-size: var(--text-secondary);
  }

  p {
    margin: 0;
    font-size: var(--text-secondary);
  }

  .note {
    font-style: italic;
  }

  .show {
    display: inline-flex;
    gap: 0.35rem;
    align-items: center;
    justify-self: start;
    padding: 0.2rem 0.6rem;
    font-size: var(--text-secondary);
  }
</style>
