<!-- The group in use: its name and this device's role, who is in it, and inviting or leaving. -->
<script lang="ts">
  import type { NodeId } from '@tesel/protocol';

  import type { Translate } from '../i18n/index.ts';
  import type { GroupFeed } from '../sync/group-feed.svelte.ts';
  import Pictogram from '../ui/Pictogram.svelte';
  import { canInvite, type StoredGroup } from './group.ts';
  import MemberList from './MemberList.svelte';
  import { ROLE_LABELS } from './role-label.ts';

  interface Props {
    t: Translate;
    group: StoredGroup;
    /** The group's feed, for its members; undefined while it opens. */
    feed: GroupFeed | undefined;
    self: NodeId;
    oninvite: () => void;
    onleave: () => void;
  }

  let { t, group, feed, self, oninvite, onleave }: Props = $props();
</script>

<section class="group" aria-label={group.name}>
  <header>
    <strong>{group.name}</strong>
    <span class="badge role">{t(ROLE_LABELS[group.role])}</span>
  </header>
  {#if feed}
    <MemberList {t} groupState={feed.state} heard={feed.heard} {self} />
  {/if}
  <div class="row">
    {#if canInvite(group)}
      <button class="primary invite" onclick={oninvite}>
        <Pictogram name="qr" size={20} />
        {t('invite')}
      </button>
    {/if}
    <button class="leave" onclick={onleave}>{t('leave')}</button>
  </div>
</section>

<style>
  .group {
    display: grid;
    gap: 0.75rem;
    padding: 0.85rem;
    border: 2px solid var(--accent-line);
    border-radius: 0.9rem;
  }

  header {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    justify-content: space-between;
    font-size: 1.1rem;
  }

  .role {
    text-transform: capitalize;
  }

  .invite {
    display: inline-flex;
    gap: 0.45rem;
    align-items: center;
  }

  .leave {
    margin-left: auto;
    color: var(--danger);
  }
</style>
