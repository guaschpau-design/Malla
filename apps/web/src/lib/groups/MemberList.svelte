<script lang="ts">
  import type { GroupState } from '@malla/core';
  import type { NodeId } from '@malla/protocol';

  import type { MessageKey, Translate } from '../i18n/index.ts';
  import { memberRows, type PositionStatus } from './member-list.ts';
  import { ROLE_LABELS } from './role-label.ts';

  interface Props {
    t: Translate;
    groupState: GroupState;
    self: NodeId;
  }

  let { t, groupState, self }: Props = $props();

  const POSITION_LABELS: Readonly<Record<PositionStatus, MessageKey>> = {
    live: 'positionLive',
    stale: 'positionStale',
    hidden: 'positionHidden',
    never: 'positionNever',
  };

  const rows = $derived(memberRows(groupState, self, Date.now() / 1000));
</script>

<h4>{t('members', { count: rows.length })}</h4>
<ul class="members">
  {#each rows as row (row.id)}
    <li>
      <span>
        {row.alias}{#if row.self}&nbsp;({t('you')}){/if}
        {#if row.role}<span class="hint">· {t(ROLE_LABELS[row.role])}</span>{/if}
      </span>
      <span class="hint">{t(POSITION_LABELS[row.position])}</span>
    </li>
  {/each}
</ul>

<style>
  h4 {
    margin: 0.4rem 0 0;
    font-size: 0.85rem;
  }

  .members {
    display: grid;
    gap: 0.2rem;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 0.9rem;
  }

  li {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.75rem;
    justify-content: space-between;
  }
</style>
