<!-- The members of the active group, each with an initial, a name (and "coordinator" for those who
     coordinate) and two signs: whether their position is on the map and whether their news reaches
     this device by radio. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import type { NodeId } from '@tesel/protocol';

  import type { MessageKey, Translate } from '../i18n/index.ts';
  import type { Heard } from '../links/heard.ts';
  import { initialOf } from '../text.ts';
  import { useNow } from '../ui/now.svelte.ts';
  import Pictogram from '../ui/Pictogram.svelte';
  import { memberRows, type PositionStatus } from './member-list.ts';
  import { ROLE_LABELS } from './role-label.ts';

  interface Props {
    t: Translate;
    groupState: GroupState;
    heard: Heard;
    self: NodeId;
  }

  let { t, groupState, heard, self }: Props = $props();

  const POSITION_LABELS: Readonly<Record<PositionStatus, MessageKey>> = {
    live: 'positionLive',
    stale: 'positionStale',
    hidden: 'positionHidden',
    never: 'positionNever',
  };

  const now = useNow(30_000);
  const rows = $derived(memberRows(groupState, self, now.seconds, heard));
</script>

<ul class="members" aria-label={t('members', { count: rows.length })}>
  {#each rows as row (row.id)}
    <li>
      <span class="initial {row.position}" aria-hidden="true">
        {initialOf(row.alias)}
      </span>
      <span class="name">
        {row.alias}{#if row.self}&nbsp;({t('you')}){/if}
        {#if row.role === 'coordinator'}<span class="hint">· {t(ROLE_LABELS.coordinator)}</span
          >{/if}
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
  {/each}
</ul>

<style>
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
