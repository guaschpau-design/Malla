<!-- The team's tasks: what is pending, with one button to move each along, and what is done.
     Tapping a task opens it to change who, where or what. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import type { EventRef, LatLon, NodeId } from '@tesel/protocol';

  import type { CoordinateFormat } from '../coordinates/coordinates.ts';
  import type { MessageKey, Translate } from '../i18n/index.ts';
  import type { Preference } from '../settings/preference.svelte.ts';
  import ActionButton from '../ui/ActionButton.svelte';
  import Panel from '../ui/Panel.svelte';
  import Pictogram from '../ui/Pictogram.svelte';
  import { editTask, newTask, stopEditingTask } from './task-editor.svelte.ts';
  import TaskForm from './TaskForm.svelte';
  import { advance, taskList, type TaskEditing, type TaskFields, type TaskRow } from './tasks.ts';

  interface Props {
    t: Translate;
    groupState: GroupState;
    self: NodeId;
    format: Preference<CoordinateFormat>;
    /** The task being edited, or null for the list. */
    editing: TaskEditing | null;
    onsave: (task: EventRef | null, fields: TaskFields) => Promise<void>;
    /** Opens the panel of a task's place, shown on the map. */
    onpoint: (at: LatLon) => void;
    onclose: () => void;
  }

  let { t, groupState, self, format, editing, onsave, onpoint, onclose }: Props = $props();

  const list = $derived(taskList(groupState, self));

  const NEXT: Readonly<Record<TaskFields['status'], MessageKey>> = {
    open: 'taskStart',
    'in-progress': 'taskFinish',
    done: 'taskReopen',
    cancelled: 'taskReopen',
  };
</script>

{#snippet item(row: TaskRow)}
  <li class:mine={row.mine} class:done={row.fields.status === 'done'}>
    <button
      class="open"
      onclick={() => {
        editTask(row.key);
      }}
    >
      <span class="text">{row.fields.text}</span>
      <span class="meta">
        {row.mine ? t('taskForYou') : t('taskFor', { name: row.assigneeName ?? t('anyone') })}
        {#if row.fields.status === 'in-progress'}· <strong>{t('taskInProgress')}</strong>{/if}
      </span>
    </button>
    <span class="actions">
      {#if row.fields.place}
        {@const at = row.fields.place}
        <button
          class="icon"
          aria-label={t('taskShowPlace')}
          title={t('taskShowPlace')}
          onclick={() => {
            onpoint(at);
          }}
        >
          <Pictogram name="pin" size={18} />
        </button>
      {/if}
      <button class="next" onclick={() => void onsave(row.task, advance(row.fields, self))}>
        {t(NEXT[row.fields.status])}
      </button>
    </span>
  </li>
{/snippet}

<Panel title={t('tasks')} closeLabel={t('close')} {onclose}>
  {#if editing}
    {#key editing}
      <TaskForm {t} {groupState} {self} {editing} {format} {onsave} onback={stopEditingTask} />
    {/key}
  {:else}
    <div class="stack section">
      <div class="row">
        <ActionButton
          icon="plus"
          label={t('newTask')}
          onclick={() => {
            newTask(null);
          }}
        />
      </div>
      {#if list.pending.length > 0}
        <ul class="cards">
          {#each list.pending as row (row.key)}{@render item(row)}{/each}
        </ul>
      {/if}
      {#if list.done.length > 0}
        <details>
          <summary>{t('tasksDone', { count: list.done.length })}</summary>
          <ul class="cards">
            {#each list.done as row (row.key)}{@render item(row)}{/each}
          </ul>
        </details>
      {/if}
    </div>
  {/if}
</Panel>

<style>
  .cards > li {
    grid-template-columns: 1fr auto;
    align-items: center;
    padding: 0.4rem 0.4rem 0.4rem 0.75rem;
  }

  .cards > li.mine {
    border-color: var(--accent-line);
    box-shadow: inset 3px 0 0 var(--accent-line);
  }

  .open {
    display: grid;
    gap: 0.15rem;
    min-width: 0;
    padding: 0.2rem 0;
    text-align: left;
    color: inherit;
    background: none;
    border: none;
  }

  .text {
    overflow-wrap: anywhere;
  }

  .done .text {
    color: var(--muted);
    text-decoration: line-through;
  }

  .meta {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    align-items: center;
    font-size: var(--text-small);
    color: var(--muted);
  }

  .actions {
    display: flex;
    gap: 0.25rem;
    align-items: center;
  }

  .next {
    white-space: nowrap;
  }

  details > .cards {
    margin-top: 0.5rem;
  }

  summary {
    cursor: pointer;
  }
</style>
