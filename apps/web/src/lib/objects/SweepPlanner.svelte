<!-- Planning a sweep of a search area: how far apart the lanes go, for the terrain; how many teams
     share them; which way they run; and who leads each team. The strips show on the map as they
     would be, and the sweep is created with one task per strip. -->
<script lang="ts">
  import {
    bestHeading,
    lanesLength,
    stripLanes,
    sweepLanes,
    sweepPath,
    type GroupState,
  } from '@tesel/core';
  import { SWEEP_MAX_LANES, type NodeId } from '@tesel/protocol';
  import type { Map as MapLibreMap } from 'maplibre-gl';
  import { untrack } from 'svelte';

  import { formatDistance } from '../format.ts';
  import type { Locale, MessageKey, Translate } from '../i18n/index.ts';
  import { useOverlay } from '../map/overlay.svelte.ts';
  import type { Tone } from '../ui/theme.ts';
  import AssigneeSelect from '../members/AssigneeSelect.svelte';
  import MapCard from '../ui/MapCard.svelte';
  import { Submission } from '../ui/submission.svelte.ts';
  import { objectTitle } from './object-names.ts';
  import { stripFeature } from './object-features.ts';
  import { stripLayers } from './strip-layers.ts';
  import type { SweepRecipe } from './sweep-actions.ts';
  import { activeTeams } from '../teams/teams.ts';
  import { MAX_STRIPS, walkerTone } from './sweeps.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    map: MapLibreMap;
    groupState: GroupState;
    self: NodeId;
    /** The search area, by key. */
    areaKey: string;
    /** Creates the sweep: one strip per team, for its member or anyone. */
    onplan: (recipe: SweepRecipe, teams: readonly (NodeId | null)[]) => Promise<void>;
    onclose: () => void;
  }

  let { t, locale, map, groupState, self, areaKey, onplan, onclose }: Props = $props();

  /** How far apart searchers walk, by what they cannot see through. */
  const TERRAINS: readonly { spacing: number; label: MessageKey }[] = [
    { spacing: 25, label: 'terrainOpen' },
    { spacing: 10, label: 'terrainScrub' },
    { spacing: 5, label: 'terrainForest' },
  ];
  const MIN_SPACING = 2;
  const MAX_SPACING = 200;
  /** Each tap on "Turn" turns the lanes this much. */
  const TURN_DEGREES = 45;

  const area = $derived.by(() => {
    const record = groupState.objects.get(areaKey);
    return record?.type === 'shape' && record.geometry.kind === 'polygon' ? record : null;
  });
  const corners = $derived(area?.geometry.kind === 'polygon' ? area.geometry.points : []);

  let spacing = $state(25);
  // With teams in the group, one strip for each, as far as there are colours; else two.
  const groupTeams = untrack(() => activeTeams(groupState.teams).slice(0, MAX_STRIPS));
  let count = $state(groupTeams.length > 0 ? groupTeams.length : 2);
  // The lanes start along the area's longest way; "Turn" changes that.
  let heading = $state(untrack(() => (corners.length > 0 ? bestHeading(corners) : 0)));
  /** Who leads each team: a node ID, or empty for anyone. */
  const teamLeads = $state(
    Array.from({ length: MAX_STRIPS }, (_, index) => ({ lead: groupTeams[index]?.team ?? '' })),
  );
  const submission = new Submission();

  const valid = $derived(
    Number.isInteger(spacing) && spacing >= MIN_SPACING && spacing <= MAX_SPACING,
  );
  const lanes = $derived(
    valid && corners.length > 0 ? sweepLanes(corners, spacing, heading) : null,
  );
  const laneCount = $derived(lanes?.lanes.length ?? 0);
  /** No more teams than lanes, nor than colours. */
  const maxTeams = $derived(Math.max(1, Math.min(MAX_STRIPS, laneCount)));
  const shown = $derived(Math.min(count, maxTeams));
  const strips = $derived(
    lanes ? Array.from({ length: shown }, (_, strip) => stripLanes(lanes, strip, shown)) : [],
  );
  const perTeam = $derived(
    strips.length > 0 ? Math.max(...strips.map((strip) => lanesLength(strip))) : 0,
  );

  useOverlay(() => map, {
    level: 'draft',
    data: {
      'tesel-sweep-plan': () => ({
        type: 'FeatureCollection',
        features: strips.map((strip, index) =>
          stripFeature(String(index), index, toneOf(index), sweepPath(strip)),
        ),
      }),
    },
    layers: () => stripLayers('tesel-sweep-plan'),
  });

  $effect(() => {
    if (area === null) onclose();
  });

  /** A strip's colour: its team's, once a team is chosen for it. */
  function toneOf(strip: number): Tone {
    const lead = teamLeads[strip]?.lead ?? '';
    return walkerTone(groupState.teams, lead === '' ? null : (lead as NodeId), strip);
  }

  function plan(): void {
    void submission.run(async () => {
      await onplan(
        { spacing, heading },
        teamLeads.slice(0, shown).map(({ lead }) => (lead === '' ? null : (lead as NodeId))),
      );
      onclose();
    });
  }
</script>

{#if area}
  <MapCard label={t('sweepPlan')}>
    <div class="stack planner">
      <p class="title">{t('sweepPlanOf', { name: objectTitle(area, groupState.objects, t) })}</p>
      <fieldset>
        <legend>{t('sweepTerrain')}</legend>
        <div class="chips" role="radiogroup" aria-label={t('sweepTerrain')}>
          {#each TERRAINS as terrain (terrain.spacing)}
            <button
              type="button"
              class="chip"
              role="radio"
              aria-checked={spacing === terrain.spacing}
              onclick={() => (spacing = terrain.spacing)}
            >
              {t(terrain.label)} · {terrain.spacing} m
            </button>
          {/each}
        </div>
      </fieldset>
      <div class="row settings">
        <label class="spacing">
          {t('sweepSpacing')}
          <input
            type="number"
            min={MIN_SPACING}
            max={MAX_SPACING}
            step="1"
            inputmode="numeric"
            bind:value={spacing}
          />
        </label>
        <div class="teams" role="group" aria-label={t('sweepTeams')}>
          <span>{t('sweepTeams')}</span>
          <button
            type="button"
            aria-label={t('sweepFewerTeams')}
            disabled={shown <= 1}
            onclick={() => (count = shown - 1)}>−</button
          >
          <strong>{shown}</strong>
          <button
            type="button"
            aria-label={t('sweepMoreTeams')}
            disabled={shown >= maxTeams}
            onclick={() => (count = shown + 1)}>+</button
          >
        </div>
        <button type="button" onclick={() => (heading = (heading + TURN_DEGREES) % 180)}>
          {t('sweepTurn')}
        </button>
      </div>
      {#if valid && laneCount === 0}
        <p class="warning">{t('sweepTooWide', { lanes: SWEEP_MAX_LANES })}</p>
      {:else if valid}
        <p class="hint">
          {t('sweepSummary', { count: laneCount, length: formatDistance(perTeam, locale) })}
        </p>
      {:else}
        <p class="warning">{t('sweepSpacingInvalid', { min: MIN_SPACING, max: MAX_SPACING })}</p>
      {/if}
      <ul class="leads">
        {#each teamLeads.slice(0, shown) as team, index (index)}
          <li>
            <label>
              <span class="team">
                <span class="swatch" style:--swatch="var(--tone-{toneOf(index)})"></span>
                {t('stripNumber', { number: index + 1 })}
              </span>
              <AssigneeSelect
                {t}
                {groupState}
                {self}
                value={team.lead}
                onchange={(value: string) => (team.lead = value)}
              />
            </label>
          </li>
        {/each}
      </ul>
      {#if submission.failed}<p class="warning">{t('sendFailed')}</p>{/if}
      <div class="row">
        <button class="primary" disabled={laneCount === 0 || submission.busy} onclick={plan}
          >{t('sweepCreate')}</button
        >
        <button onclick={onclose}>{t('cancel')}</button>
      </div>
    </div>
  </MapCard>
{/if}

<style>
  .title {
    font-weight: 600;
  }

  .settings {
    align-items: center;
  }

  .spacing {
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }

  .spacing input {
    width: 4rem;
  }

  .teams {
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }

  .teams button {
    min-width: 2.4rem;
  }

  .leads {
    display: grid;
    gap: 0.4rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .leads label {
    display: grid;
    grid-template-columns: 6rem 1fr;
    gap: 0.5rem;
    align-items: center;
    font-size: var(--text-secondary);
  }

  .team {
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }

  .swatch {
    flex-shrink: 0;
    width: 0.9rem;
    height: 0.9rem;
    background: var(--swatch);
    border-radius: 50%;
  }
</style>
