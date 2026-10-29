<!-- A situation report, in the order emergency services ask for it: what happens, casualties by
     triage category, then, folded, the dangers, the way in and the help needed, and a note. Only
     what happens is needed; it goes from where this device is. -->
<script lang="ts">
  import {
    REPORT_NOTE_MAX_BYTES,
    utf8ByteLength,
    type Casualties,
    type Hazard,
    type IncidentType,
    type LatLon,
    type Resource,
    type SceneAccess,
  } from '@tesel/protocol';
  import { onMount } from 'svelte';

  import { formatDistance } from '../format.ts';
  import type { Locale, Translate } from '../i18n/index.ts';
  import { deviceLocation } from '../position/device-location.svelte.ts';
  import type { ReportFields } from '../sync/group-feed.svelte.ts';
  import Fold from '../ui/Fold.svelte';
  import { Submission } from '../ui/submission.svelte.ts';
  import { ACCESS, HAZARDS, INCIDENTS, labelOf, RESOURCES, TRIAGE } from './report-catalog.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    onsend: (report: ReportFields) => Promise<void>;
    onback: () => void;
  }

  let { t, locale, onsend, onback }: Props = $props();

  let incident: IncidentType | null = $state(null);
  let casualties: Casualties = $state({ red: null, yellow: null, green: null, black: null });
  let hazards: Hazard[] = $state([]);
  let access: SceneAccess = $state('unknown');
  let resources: Resource[] = $state([]);
  let note = $state('');
  const submission = new Submission();

  const here: LatLon | null = $derived(deviceLocation.fix?.at ?? null);
  const tooLong = $derived(utf8ByteLength(note.trim()) > REPORT_NOTE_MAX_BYTES);
  /** At most what the protocol counts: 254 (§3.16). */
  const MAX_COUNT = 254;

  function toggle<T>(list: readonly T[], value: T): T[] {
    return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
  }

  function count(key: keyof Casualties, step: number): void {
    const next = Math.min(MAX_COUNT, Math.max(0, (casualties[key] ?? 0) + step));
    casualties = { ...casualties, [key]: next };
  }

  function send(chosen: IncidentType): void {
    void submission.run(async () => {
      await onsend({
        place: here && { kind: 'point', at: here },
        incident: chosen,
        hazards,
        access,
        casualties,
        resources,
        note: note.trim(),
      });
      onback();
    });
  }

  onMount(() => deviceLocation.use());
</script>

<form
  class="stack section"
  onsubmit={(event) => {
    event.preventDefault();
    if (incident) send(incident);
  }}
>
  <h3>{t('reportNew')}</h3>
  <fieldset>
    <legend>{t('reportIncident')}</legend>
    <div class="chips" role="radiogroup" aria-label={t('reportIncident')}>
      {#each INCIDENTS as choice (choice.value)}
        <button
          type="button"
          class="chip"
          role="radio"
          aria-checked={incident === choice.value}
          onclick={() => (incident = choice.value)}>{t(choice.label)}</button
        >
      {/each}
    </div>
  </fieldset>
  <fieldset>
    <legend>{t('reportCasualtiesTitle')}</legend>
    <div class="counts">
      {#each TRIAGE as category (category.value)}
        {@const value = casualties[category.value]}
        <div class="count {category.value}" role="group" aria-label={t(category.label)}>
          <span class="name">{t(category.label)}</span>
          <button
            type="button"
            aria-label={t('countLess', { name: t(category.label) })}
            onclick={() => {
              count(category.value, -1);
            }}>−</button
          >
          <strong>{value ?? '–'}</strong>
          <button
            type="button"
            aria-label={t('countMore', { name: t(category.label) })}
            onclick={() => {
              count(category.value, 1);
            }}>+</button
          >
        </div>
      {/each}
    </div>
  </fieldset>
  <div>
    <Fold
      title={t('reportHazardsTitle')}
      summary={hazards.length === 0
        ? t('reportNoneMarked')
        : hazards.map((value) => t(labelOf(HAZARDS, value) ?? 'incidentOther')).join(', ')}
    >
      <div class="chips">
        {#each HAZARDS as choice (choice.value)}
          <button
            type="button"
            class="chip"
            aria-pressed={hazards.includes(choice.value)}
            onclick={() => (hazards = toggle(hazards, choice.value))}>{t(choice.label)}</button
          >
        {/each}
      </div>
    </Fold>
    <Fold
      title={t('reportAccessTitle')}
      summary={access === 'unknown'
        ? t('reportNoneMarked')
        : t(labelOf(ACCESS, access) ?? 'accessClear')}
    >
      <div class="chips">
        {#each ACCESS as choice (choice.value)}
          <button
            type="button"
            class="chip"
            aria-pressed={access === choice.value}
            onclick={() => (access = access === choice.value ? 'unknown' : choice.value)}
            >{t(choice.label)}</button
          >
        {/each}
      </div>
    </Fold>
    <Fold
      title={t('reportResourcesTitle')}
      summary={resources.length === 0
        ? t('reportNoneMarked')
        : resources.map((value) => t(labelOf(RESOURCES, value) ?? 'incidentOther')).join(', ')}
    >
      <div class="chips">
        {#each RESOURCES as choice (choice.value)}
          <button
            type="button"
            class="chip"
            aria-pressed={resources.includes(choice.value)}
            onclick={() => (resources = toggle(resources, choice.value))}>{t(choice.label)}</button
          >
        {/each}
      </div>
    </Fold>
  </div>
  <label>
    {t('reportNote')}
    <input bind:value={note} autocomplete="off" />
  </label>
  {#if tooLong}<p class="warning">{t('reportNoteTooLong')}</p>{/if}
  <p class="hint">
    {#if deviceLocation.fix}
      {t('reportFromHere', {
        accuracy: formatDistance(deviceLocation.fix.accuracy ?? 0, locale),
      })}
    {:else}
      {t('reportNoPlace')}
    {/if}
  </p>
  {#if submission.failed}<p class="warning">{t('sendFailed')}</p>{/if}
  <div class="row">
    <button type="submit" class="primary" disabled={incident === null || tooLong || submission.busy}
      >{t('reportSend')}</button
    >
    <button type="button" onclick={onback}>{t('back')}</button>
  </div>
</form>

<style>
  fieldset {
    margin: 0;
    padding: 0;
    border: none;
  }

  legend {
    margin-bottom: 0.4rem;
    padding: 0;
    font-size: var(--text-secondary);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .chip {
    padding: 0.3rem 0.7rem;
    font-size: var(--text-secondary);
    border-radius: var(--radius-pill);
  }

  .chip[aria-pressed='true'],
  .chip[aria-checked='true'] {
    font-weight: 600;
    border-color: var(--accent-line);
    box-shadow: inset 0 0 0 1px var(--accent-line);
  }

  /* Two to a row where they fit, one under another on a narrow phone. */
  .counts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(10.5rem, 1fr));
    gap: 0.4rem;
  }

  .count {
    display: grid;
    grid-template-columns: 1fr auto 2rem auto;
    gap: 0.35rem;
    align-items: center;
    padding: 0.25rem 0.25rem 0.25rem 0.6rem;
    font-size: var(--text-secondary);
    border-left: 4px solid var(--triage);
    border-radius: var(--radius-control);
  }

  .count strong {
    text-align: center;
  }

  .count button {
    min-width: 2rem;
    padding: 0.15rem;
  }

  .red {
    --triage: var(--tone-red);
  }

  .yellow {
    --triage: var(--tone-amber);
  }

  .green {
    --triage: var(--tone-green);
  }

  .black {
    --triage: var(--tone-ink);
  }

  /* Ink would vanish on a dark surface: grey still reads as the darkest of the four. */
  @media (prefers-color-scheme: dark) {
    .black {
      --triage: var(--muted);
    }
  }
</style>
