<!-- What a member tells the team about themselves, the same for this device (in Me, where it is
     set) and for anyone tapped on the map: profile and status at a glance, then position, battery,
     equipment and tasks, each folded into one line until opened. -->
<script lang="ts" module>
  import type { DutyStatus, Equipment, Profile } from '@tesel/protocol';

  /** How this device's own sheet changes what it tells. */
  export interface SheetEdits {
    onprofile: (profile: Profile) => void;
    onstatus: (status: DutyStatus) => void;
    onequipment: (equipment: readonly Equipment[]) => void;
  }
</script>

<script lang="ts">
  import type { MemberStateEvent, TeamEvent } from '@tesel/protocol';
  import type { Snippet } from 'svelte';

  import type { Translate } from '../i18n/index.ts';
  import { editTask } from '../tasks/task-editor.ts';
  import type { TaskRow } from '../tasks/tasks.ts';
  import { TEAM_COLOURS } from '../teams/teams.ts';
  import Fold from '../ui/Fold.svelte';
  import StatusDot from '../ui/StatusDot.svelte';
  import { DUTY_STATUSES, EQUIPMENT, PROFILES, profileLabel } from './member-catalog.ts';

  interface Props {
    t: Translate;
    state: Pick<MemberStateEvent, 'profile' | 'status' | 'battery' | 'equipment'>;
    /** The team they are in, if any. */
    team: TeamEvent | null;
    /** Set for this device's own sheet. */
    edits?: SheetEdits | undefined;
    /** Under the battery: why it may be unknown. */
    batteryNote?: string | undefined;
    /** Their tasks still to do; none without a group. */
    tasks: readonly TaskRow[] | null;
    /** The gist of where they are, and what the position section holds. */
    positionSummary: string;
    position: Snippet;
    /** Further sections, after the tasks. */
    more?: Snippet;
  }

  let { t, state, team, edits, batteryNote, tasks, positionSummary, position, more }: Props =
    $props();

  /** At or under this, the battery is shown as running out. */
  const LOW_BATTERY = 20;

  const status = $derived(DUTY_STATUSES[state.status]);
  const batteryText = $derived(
    state.battery === null ? t('batteryUnknown') : t('batteryPercent', { percent: state.battery }),
  );
  const carried = $derived(EQUIPMENT.filter((item) => state.equipment.includes(item.value)));
  const equipmentSummary = $derived(
    carried.length === 0 ? t('equipmentNone') : carried.map((item) => t(item.label)).join(', '),
  );

  function toggle(item: Equipment): void {
    const next = state.equipment.includes(item)
      ? state.equipment.filter((value) => value !== item)
      : [...state.equipment, item];
    edits?.onequipment(next);
  }
</script>

<div class="sheet">
  {#if team}
    <p class="line">
      <span class="swatch" style:--swatch="var(--tone-{TEAM_COLOURS[team.colour].tone})"></span>
      {t('teamOf', { name: team.name })}
    </p>
  {/if}
  {#if edits}
    {@const { onprofile, onstatus } = edits}
    <label class="profile">
      {t('profileLabel')}
      <select
        value={state.profile}
        onchange={(event) => {
          const chosen = PROFILES.find((item) => item.value === event.currentTarget.value);
          if (chosen) onprofile(chosen.value);
        }}
      >
        {#each PROFILES as item (item.value)}
          <option value={item.value}>{t(item.label)}</option>
        {/each}
      </select>
    </label>
    <div class="statuses" role="radiogroup" aria-label={t('dutyLabel')}>
      {#each Object.entries(DUTY_STATUSES) as [value, item] (value)}
        <button
          role="radio"
          aria-checked={state.status === value}
          onclick={() => {
            onstatus(value as DutyStatus);
          }}
        >
          <StatusDot tone={item.tone} />
          {t(item.label)}
        </button>
      {/each}
    </div>
  {:else}
    <p class="line">
      <StatusDot tone={status.tone} />
      {t(status.label)}{#if state.profile !== 'unspecified'}&nbsp;· {t(
          profileLabel(state.profile),
        )}{/if}
    </p>
  {/if}

  <div class="folds">
    <Fold title={t('foldPosition')} summary={positionSummary}>
      {@render position()}
    </Fold>
    <Fold title={t('foldBattery')} summary={batteryText}>
      <p class="line">
        {#if state.battery !== null}
          <StatusDot tone={state.battery <= LOW_BATTERY ? 'poor' : 'good'} />
        {/if}
        {batteryText}
      </p>
      {#if batteryNote}<p class="hint">{batteryNote}</p>{/if}
    </Fold>
    <Fold title={t('foldEquipment')} summary={equipmentSummary}>
      {#if edits}
        <div class="chips">
          {#each EQUIPMENT as item (item.value)}
            <button
              class="chip"
              aria-pressed={state.equipment.includes(item.value)}
              onclick={() => {
                toggle(item.value);
              }}>{t(item.label)}</button
            >
          {/each}
        </div>
      {:else}
        <p>{equipmentSummary}</p>
      {/if}
    </Fold>
    {#if tasks}
      <Fold
        title={t('foldTasks')}
        summary={tasks.length === 0 ? t('tasksNone') : t('tasksPending', { count: tasks.length })}
      >
        {#if tasks.length === 0}
          <p class="hint">{t('tasksNone')}</p>
        {:else}
          <ul class="tasks">
            {#each tasks as row (row.key)}
              <li>
                <button
                  onclick={() => {
                    editTask(row.key);
                  }}
                >
                  <span>{row.fields.text}</span>
                  {#if row.fields.status === 'in-progress'}
                    <span class="hint">{t('taskInProgress')}</span>
                  {/if}
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </Fold>
    {/if}
    {@render more?.()}
  </div>
</div>

<style>
  /* One column as wide as the panel: a long line (the gist of a fold) is cut short, never widens it. */
  .sheet {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.75rem;
  }

  .profile {
    display: flex;
    gap: 0.6rem;
    align-items: center;
  }

  .profile select {
    flex: 1;
    font: inherit;
  }

  .statuses {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.35rem;
  }

  .statuses button {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    justify-content: center;
    padding: 0.5rem 0.3rem;
    font-size: var(--text-secondary);
  }

  .statuses button[aria-checked='true'] {
    font-weight: 600;
    border-color: var(--accent-line);
    box-shadow: inset 0 0 0 1px var(--accent-line);
  }

  .line {
    display: flex;
    gap: 0.45rem;
    align-items: center;
    margin: 0;
  }

  .swatch {
    width: 0.8rem;
    height: 0.8rem;
    background: var(--swatch);
    border-radius: 50%;
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

  .chip[aria-pressed='true'] {
    font-weight: 600;
    border-color: var(--accent-line);
    box-shadow: inset 0 0 0 1px var(--accent-line);
  }

  .tasks {
    display: grid;
    gap: 0.3rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .tasks button {
    display: flex;
    gap: 0.5rem;
    justify-content: space-between;
    width: 100%;
    text-align: left;
  }
</style>
