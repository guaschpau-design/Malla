<!-- What a member tells the team about themselves, the same for this device (in Me, where it is
     set) and for anyone tapped on the map: their status, whether they have a LoRa radio, which
     keeps them in touch without coverage, then profile, battery, position, equipment and tasks,
     all in view: the sheet is read at a glance, without opening anything. -->
<script lang="ts" module>
  import type { DutyStatus, Equipment, Profile } from '@tesel/protocol';

  /** How this device's own sheet changes what it tells. */
  export interface SheetEdits {
    onprofile: (profile: Profile) => void;
    onstatus: (status: DutyStatus) => void;
    onequipment: (equipment: readonly Equipment[]) => void;
    /** Opens where a LoRa radio is linked. */
    onconnectradio: () => void;
  }
</script>

<script lang="ts">
  import type { MemberStateEvent, TeamEvent } from '@tesel/protocol';
  import type { Snippet } from 'svelte';

  import type { Translate } from '../i18n/index.ts';
  import { editTask } from '../tasks/task-editor.ts';
  import type { TaskRow } from '../tasks/tasks.ts';
  import { TEAM_COLOURS } from '../teams/teams.ts';
  import Pictogram from '../ui/Pictogram.svelte';
  import StatusDot from '../ui/StatusDot.svelte';
  import { DUTY_STATUSES, EQUIPMENT, PROFILES, profileLabel } from './member-catalog.ts';
  import SheetPart from './SheetPart.svelte';

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
    /** Where they are. */
    position: Snippet;
    /** Further parts (SheetPart), after the tasks. */
    more?: Snippet;
  }

  let { t, state, team, edits, batteryNote, tasks, position, more }: Props = $props();

  /** At or under this, the battery is shown as running out. */
  const LOW_BATTERY = 20;

  const status = $derived(DUTY_STATUSES[state.status]);
  const batteryText = $derived(
    state.battery === null ? t('batteryUnknown') : t('batteryPercent', { percent: state.battery }),
  );
  const lora = $derived(state.equipment.includes('lora'));
  const carried = $derived(EQUIPMENT.filter((item) => state.equipment.includes(item.value)));
  const equipmentSummary = $derived(
    carried.length === 0 ? t('equipmentNone') : carried.map((item) => t(item.label)).join(', '),
  );

  const loraText = $derived.by(() => {
    if (edits) return lora ? t('loraOwnOn') : t('loraOwnOff');
    return lora ? t('loraOn') : t('loraOff');
  });

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
    {@const { onstatus } = edits}
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
      {t(status.label)}
    </p>
  {/if}

  <div class="lora" class:on={lora}>
    <Pictogram name="mast" size={18} />
    <p>{loraText}</p>
    {#if edits && !lora}
      <button onclick={edits.onconnectradio}>{t('radioConnect')}</button>
    {/if}
  </div>

  <SheetPart title={t('profileLabel')} inline>
    {#if edits}
      {@const { onprofile } = edits}
      <select
        aria-label={t('profileLabel')}
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
    {:else}
      <p>{t(profileLabel(state.profile))}</p>
    {/if}
  </SheetPart>
  <SheetPart title={t('sheetBattery')} inline>
    <p class="line">
      {#if state.battery !== null}
        <StatusDot tone={state.battery <= LOW_BATTERY ? 'poor' : 'good'} />
      {/if}
      {batteryText}
    </p>
    {#if batteryNote}<p class="hint">{batteryNote}</p>{/if}
  </SheetPart>
  <SheetPart title={t('sheetPosition')}>
    {@render position()}
  </SheetPart>
  <SheetPart title={t('sheetEquipment')}>
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
  </SheetPart>
  {#if tasks}
    <SheetPart title={t('sheetTasks')} inline={tasks.length === 0}>
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
    </SheetPart>
  {/if}
  {@render more?.()}
</div>

<style>
  /* Whether they keep in touch without coverage: one line set apart from the rest, as it decides
     who can still be reached when the network falls. */
  .lora {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 0.5rem;
    align-items: center;
    padding: 0.3rem 0.3rem 0.3rem 0.55rem;
    color: var(--muted);
    background: var(--bg);
    border-left: 3px solid var(--control-line);
    border-radius: var(--radius-control);
  }

  .lora.on {
    color: var(--fg);
    border-left-color: var(--accent-line);
  }

  .lora p {
    margin: 0;
    font-size: var(--text-small);
  }

  .lora button {
    padding: 0.3rem 0.6rem;
    color: var(--fg);
    font-size: var(--text-small);
    white-space: nowrap;
  }

  /* One column as wide as the panel: a long line wraps, never widens it. */
  .sheet {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.65rem;
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
    padding: 0.35rem 0.3rem;
    font-size: var(--text-small);
    line-height: 1.2;
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
    min-height: 2.25rem;
    padding: 0.2rem 0.7rem;
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
