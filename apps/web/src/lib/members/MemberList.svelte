<!-- The members of the active group, team by team, each with an initial, a name (and "coordinator"
     for those who coordinate) and two signs: whether their position is on the map and whether
     their news reaches this device by radio. Whoever coordinates creates and changes the teams. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import type { NodeId, TeamEvent } from '@tesel/protocol';

  import type { MessageKey, Translate } from '../i18n/index.ts';
  import type { Heard } from '../links/heard.ts';
  import { initialOf } from '../text.ts';
  import { clockEvery } from '../ui/now.svelte.ts';
  import Pictogram from '../ui/Pictogram.svelte';
  import { ROLE_LABELS } from '../groups/role-label.ts';
  import type { TeamFields } from '../sync/group-feed.svelte.ts';
  import TeamForm from '../teams/TeamForm.svelte';
  import { TEAM_COLOURS } from '../teams/teams.ts';
  import { byTeam, memberRows, type MemberRow, type PositionStatus } from './member-list.ts';

  interface Props {
    t: Translate;
    groupState: GroupState;
    heard: Heard;
    self: NodeId;
    /** This device coordinates: it creates and changes teams. */
    coordinator: boolean;
    onsaveteam: (team: TeamFields) => Promise<void>;
    ondissolveteam: (team: TeamEvent) => Promise<void>;
  }

  let { t, groupState, heard, self, coordinator, onsaveteam, ondissolveteam }: Props = $props();

  const POSITION_LABELS: Readonly<Record<PositionStatus, MessageKey>> = {
    live: 'positionLive',
    stale: 'positionStale',
    hidden: 'positionHidden',
    never: 'positionNever',
  };

  const now = clockEvery(30_000);
  const rows = $derived(memberRows(groupState, self, now.seconds, heard));
  const groups = $derived(byTeam(rows, groupState.teams));
  /** The team being created or changed, if any. */
  let editing: { readonly team: TeamEvent | null } | null = $state(null);
</script>

{#snippet member(row: MemberRow)}
  <li>
    <span class="initial {row.position}" aria-hidden="true">
      {initialOf(row.alias)}
    </span>
    <span class="name">
      {row.alias}{#if row.self}&nbsp;({t('you')}){/if}
      {#if row.role === 'coordinator'}<span class="hint">· {t(ROLE_LABELS.coordinator)}</span>{/if}
    </span>
    <span class="signs">
      {#if row.byRadio}
        <span title={t('heardByRadio')} aria-label={t('heardByRadio')} role="img">
          <Pictogram name="mast" size={16} />
        </span>
      {/if}
      <span
        class="where {row.position}"
        title={t(POSITION_LABELS[row.position])}
        aria-label={t(POSITION_LABELS[row.position])}
        role="img"
      >
        <Pictogram name="pin" size={16} />
      </span>
    </span>
  </li>
{/snippet}

<div class="teams" aria-label={t('members', { count: rows.length })} role="group">
  {#each groups as group (group.team?.team ?? 'none')}
    <section class="team">
      {#if group.team}
        {@const team = group.team}
        <h4>
          <span class="swatch" style:--swatch="var(--tone-{TEAM_COLOURS[team.colour].tone})"></span>
          {team.name}
          <span class="hint">· {group.rows.length}</span>
          {#if coordinator}
            <button class="edit" onclick={() => (editing = { team })}>{t('teamEdit')}</button>
          {/if}
        </h4>
      {:else if groups.length > 1}
        <h4>{t('teamNone')}</h4>
      {/if}
      <ul class="members">
        {#each group.rows as row (row.id)}
          {@render member(row)}
        {/each}
      </ul>
    </section>
  {/each}
  {#if coordinator}
    <button class="new-team" onclick={() => (editing = { team: null })}>{t('teamNew')}</button>
  {/if}
</div>

{#if editing}
  <TeamForm
    {t}
    {groupState}
    team={editing.team}
    onsave={onsaveteam}
    ondissolve={ondissolveteam}
    onclose={() => (editing = null)}
  />
{/if}

<style>
  .teams {
    display: grid;
    gap: 0.75rem;
  }

  .team {
    display: grid;
    gap: 0.35rem;
  }

  h4 {
    display: flex;
    gap: 0.45rem;
    align-items: center;
    margin: 0;
    font-size: var(--text-secondary);
  }

  .swatch {
    width: 0.8rem;
    height: 0.8rem;
    background: var(--swatch);
    border-radius: 50%;
  }

  .edit {
    margin-left: auto;
    padding: 0.2rem 0.6rem;
    font-size: var(--text-secondary);
  }

  .new-team {
    justify-self: start;
  }

  .members {
    display: grid;
    gap: 0.35rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 0.6rem;
    align-items: center;
  }

  /* The initial is ringed in lime while the member's position is live on the map. */
  .initial {
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    font-weight: 700;
    background: var(--bg);
    border: 2px solid var(--border);
    border-radius: 50%;
  }

  .initial.live {
    border-color: var(--signal-deep);
    box-shadow: 0 0 0 2px var(--signal);
  }

  .name {
    overflow-wrap: anywhere;
  }

  .signs {
    display: flex;
    gap: 0.35rem;
    align-items: center;
    color: var(--muted);
  }

  .where.live {
    color: var(--signal-deep);
  }

  .where.hidden,
  .where.never {
    opacity: 0.35;
  }
</style>
