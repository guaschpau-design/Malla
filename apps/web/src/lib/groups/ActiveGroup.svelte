<!-- The group in use: its name and this device's role, who is in it, and inviting or leaving; for
     a practice, ending it. -->
<script lang="ts">
  import type { NodeId, TeamEvent } from '@tesel/protocol';

  import type { Translate } from '../i18n/index.ts';
  import type { GroupFeed, TeamFields } from '../sync/group-feed.svelte.ts';
  import { dissolveTeam, saveTeam } from '../teams/team-actions.ts';
  import Pictogram from '../ui/Pictogram.svelte';
  import { canInvite, type StoredGroup } from './group.ts';
  import MemberList from '../members/MemberList.svelte';
  import { ROLE_LABELS } from './role-label.ts';

  interface Props {
    t: Translate;
    group: StoredGroup;
    /** The group's feed, for its members; undefined while it opens. */
    feed: GroupFeed | undefined;
    self: NodeId;
    oninvite: () => void;
    /** Leaves the group, or ends the practice it is. */
    onleave: () => void;
  }

  let { t, group, feed, self, oninvite, onleave }: Props = $props();
</script>

<section class="group" aria-label={group.name}>
  <header>
    <strong>{group.name}</strong>
    <span class="badge role">{t(group.practice ? 'practice' : ROLE_LABELS[group.role])}</span>
  </header>
  {#if feed}
    {@const current = feed}
    <MemberList
      {t}
      groupState={current.state}
      heard={current.heard}
      {self}
      coordinator={group.role === 'coordinator'}
      onsaveteam={(team: TeamFields) => saveTeam(current, team)}
      ondissolveteam={(team: TeamEvent) => dissolveTeam(current, team)}
    />
  {/if}
  <div class="row">
    {#if canInvite(group)}
      <button class="primary invite" onclick={oninvite}>
        <Pictogram name="qr" size={20} />
        {t('invite')}
      </button>
    {/if}
    <button class="leave" onclick={onleave}>
      {group.practice ? t('endPractice') : t('leave')}
    </button>
  </div>
</section>

<style>
  .group {
    display: grid;
    gap: 0.75rem;
    padding: 0.85rem;
    border: 2px solid var(--accent-line);
    border-radius: var(--radius-card);
  }

  header {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    justify-content: space-between;
    font-size: var(--text-title);
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
