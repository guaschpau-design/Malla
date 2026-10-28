<!-- Adds a task or changes one: only the text is needed, typed or picked from the common ones in
     a drop-down; who and the place are optional. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import {
    TASK_TEXT_MAX_BYTES,
    utf8ByteLength,
    type EventRef,
    type NodeId,
    type TaskStatus,
  } from '@tesel/protocol';
  import { untrack } from 'svelte';

  import { formatCoordinate, type CoordinateFormat } from '../coordinates/coordinates.ts';
  import type { MessageKey, Translate } from '../i18n/index.ts';
  import { aliasOf } from '../incidents/incidents.ts';
  import type { Preference } from '../settings/preference.svelte.ts';
  import { confirmations } from '../ui/confirmations.svelte.ts';
  import { Submission } from '../ui/submission.svelte.ts';
  import type { TaskEditing } from './task-editor.svelte.ts';
  import { TASK_PRESETS } from './task-presets.ts';
  import { fieldsOf, type TaskFields } from './tasks.ts';

  interface Props {
    t: Translate;
    groupState: GroupState;
    self: NodeId;
    editing: TaskEditing;
    format: Preference<CoordinateFormat>;
    /** Sends the task; `task` is null for a new one. Rejects if it could not be saved. */
    onsave: (task: EventRef | null, fields: TaskFields) => Promise<void>;
    /** Back to the list. */
    onback: () => void;
  }

  let { t, groupState, self, editing, format, onsave, onback }: Props = $props();

  const STATUSES: readonly { status: TaskStatus; label: MessageKey }[] = [
    { status: 'open', label: 'taskOpen' },
    { status: 'in-progress', label: 'taskInProgress' },
    { status: 'done', label: 'taskDone' },
  ];

  // The form starts from the task as it is when it opens; later changes by others do not move
  // what is being typed.
  const existing = untrack(() =>
    editing.kind === 'existing' ? groupState.tasks.get(editing.key) : undefined,
  );
  const initial: TaskFields = untrack(() =>
    existing
      ? fieldsOf(existing)
      : {
          status: 'open',
          assignee: null,
          place: editing.kind === 'new' ? editing.place : null,
          text: '',
        },
  );

  let text = $state(initial.text);
  let status = $state(initial.status);
  /** The assignee's node ID, or '' for anyone. */
  let assignee: string = $state(initial.assignee ?? '');
  let place = $state.raw(initial.place);
  const submission = new Submission();

  const size = $derived(utf8ByteLength(text.trim()));
  const tooLong = $derived(size > TASK_TEXT_MAX_BYTES);
  /** This device first, then everyone else the group knows, by alias. */
  const people = $derived(
    [...new Set<NodeId>([self, ...groupState.members.keys()])]
      .map((id) => ({ id, alias: aliasOf(groupState, id) }))
      .sort(
        (a, b) => Number(b.id === self) - Number(a.id === self) || a.alias.localeCompare(b.alias),
      ),
  );

  async function save(fields: TaskFields): Promise<void> {
    if (await submission.run(() => onsave(existing?.task ?? null, fields))) onback();
  }

  function fields(): TaskFields {
    return {
      status,
      assignee: assignee === '' ? null : (assignee as NodeId),
      place,
      text: text.trim(),
    };
  }

  async function cancelTask(): Promise<void> {
    const question = t('confirmCancelTask', { text: initial.text });
    if (!(await confirmations.ask({ text: question, confirm: t('taskCancel') }))) return;
    await save({ ...fields(), text: text.trim() || initial.text, status: 'cancelled' });
  }
</script>

<form
  class="stack section"
  onsubmit={(event) => {
    event.preventDefault();
    void save(fields());
  }}
>
  <h3>{existing ? t('editTask') : t('newTask')}</h3>
  {#if !existing}
    <!-- One line, whatever the screen: the phone's own picker lists the common tasks. -->
    <label>
      {t('taskPresets')}
      <select
        value=""
        onchange={(event) => {
          const preset = event.currentTarget.value;
          if (preset !== '') text = preset;
          event.currentTarget.value = '';
        }}
      >
        <option value="">{t('taskPresetPick')}</option>
        {#each TASK_PRESETS as preset (preset)}
          <option value={t(preset)}>{t(preset)}</option>
        {/each}
      </select>
    </label>
  {/if}
  <label>
    {t('taskText')}
    <!-- svelte-ignore a11y_autofocus -->
    <textarea bind:value={text} rows="2" required autofocus={!existing}></textarea>
  </label>
  {#if tooLong}<p class="warning">{t('taskTooLong')}</p>{/if}
  <label>
    {t('taskAssignee')}
    <select bind:value={assignee}>
      <option value="">{t('anyoneOption')}</option>
      {#each people as person (person.id)}
        <option value={person.id}>
          {person.id === self ? `${person.alias} (${t('you')})` : person.alias}
        </option>
      {/each}
    </select>
  </label>
  {#if existing}
    <fieldset>
      <legend>{t('taskStatus')}</legend>
      <div class="row">
        {#each STATUSES as option (option.status)}
          <label class="chip">
            <input type="radio" name="status" value={option.status} bind:group={status} />
            {t(option.label)}
          </label>
        {/each}
      </div>
    </fieldset>
  {/if}
  {#if place}
    {@const at = place}
    <div class="place">
      <span
        >{t('taskPlace')}:
        <span class="coordinates"
          >{formatCoordinate(at, format.value) ?? formatCoordinate(at, 'decimal')}</span
        ></span
      >
      <button type="button" onclick={() => (place = null)}>{t('taskRemovePlace')}</button>
    </div>
  {:else}
    <p class="hint">{t('taskNoPlace')}</p>
  {/if}
  {#if submission.failed}<p class="warning">{t('taskNotSent')}</p>{/if}
  <div class="row">
    <button type="submit" class="primary" disabled={submission.busy || size === 0 || tooLong}
      >{t('save')}</button
    >
    <button type="button" onclick={onback}>{t('back')}</button>
    {#if existing}
      <button type="button" class="danger-text" disabled={submission.busy} onclick={cancelTask}>
        {t('taskCancel')}
      </button>
    {/if}
  </div>
</form>

<style>
  textarea,
  select {
    display: block;
    font: inherit;
    width: 100%;
    margin-top: 0.25rem;
  }

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

  .chip {
    display: inline-flex;
    gap: 0.35rem;
    align-items: center;
    padding: 0.35rem 0.7rem;
    font-size: var(--text-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-pill);
  }

  .chip:has(input:checked) {
    font-weight: 600;
    border-color: var(--accent-line);
    box-shadow: inset 0 0 0 1px var(--accent-line);
  }

  .place {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 0.75rem;
    align-items: center;
    font-size: var(--text-secondary);
  }

  .coordinates {
    font-variant-numeric: tabular-nums;
  }

  .danger-text {
    margin-left: auto;
    color: var(--danger);
  }
</style>
