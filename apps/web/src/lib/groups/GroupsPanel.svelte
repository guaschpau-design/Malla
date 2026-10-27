<!-- The groups: the one in use, the others, two big buttons to create or join one, and a practice
     with a simulated group. Creating, joining, inviting and scanning each open in the panel and
     come back here. -->
<script lang="ts">
  import type { Invitation } from '@tesel/protocol';

  import { guideUrl } from '../config.ts';
  import type { Translate } from '../i18n/index.ts';
  import type { Session } from '../session.svelte.ts';
  import type { GroupFeed } from '../sync/group-feed.svelte.ts';
  import Panel from '../ui/Panel.svelte';
  import Pictogram from '../ui/Pictogram.svelte';
  import ActiveGroup from './ActiveGroup.svelte';
  import CreateGroupForm from './CreateGroupForm.svelte';
  import type { StoredGroup } from './group.ts';
  import InviteView from './InviteView.svelte';
  import JoinGroup from './JoinGroup.svelte';
  import QrScanner from './QrScanner.svelte';
  import { attempt } from '../ui/submission.svelte.ts';

  interface Props {
    t: Translate;
    session: Session;
    /** The active group's feed, for its members. */
    activeFeed: GroupFeed | undefined;
    /** An invitation was pasted or scanned; the caller asks the user to confirm it. */
    oninvitation: (invitation: Invitation) => void;
    /** A group was left: its channel goes from the radio. */
    onleft: (group: StoredGroup) => void;
    onclose: () => void;
  }

  let { t, session, activeFeed, oninvitation, onleft, onclose }: Props = $props();

  type View =
    | { kind: 'home' }
    | { kind: 'create' }
    | { kind: 'join' }
    | { kind: 'scan' }
    | { kind: 'invite'; group: StoredGroup };
  let view: View = $state.raw({ kind: 'home' });

  const home = () => (view = { kind: 'home' });
  const others = $derived(session.groups.filter((group) => group.id !== session.activeGroupId));

  function scanned(invitation: Invitation): void {
    home();
    oninvitation(invitation);
  }

  function leave(group: StoredGroup): void {
    if (group.practice) {
      attempt(() => session.endPractice(), t('actionFailed'));
      return;
    }
    if (!confirm(t('confirmLeave', { group: group.name }))) return;
    attempt(async () => {
      await session.leave(group.id);
      onleft(group);
    }, t('actionFailed'));
  }

  function practise(): void {
    attempt(async () => {
      await session.startPractice(t('practiceGroupName'));
      onclose();
    }, t('actionFailed'));
  }
</script>

<Panel title={t('groups')} closeLabel={t('close')} {onclose}>
  {#if view.kind === 'create'}
    <CreateGroupForm {t} {session} onback={home} />
  {:else if view.kind === 'join'}
    <JoinGroup {t} {oninvitation} onscan={() => (view = { kind: 'scan' })} onback={home} />
  {:else if view.kind === 'scan'}
    <QrScanner {t} onresult={scanned} oncancel={home} />
  {:else if view.kind === 'invite' && session.identity}
    <InviteView {t} group={view.group} issuer={session.identity.nodeId} onback={home} />
  {:else}
    <div class="stack section">
      {#if session.activeGroup && session.identity}
        {@const group = session.activeGroup}
        <ActiveGroup
          {t}
          {group}
          feed={activeFeed}
          self={session.identity.nodeId}
          oninvite={() => (view = { kind: 'invite', group })}
          onleave={() => {
            leave(group);
          }}
        />
      {:else if session.groups.length === 0}
        <p class="hint">{t('noGroups')}</p>
      {/if}

      {#if others.length > 0}
        <ul class="others" aria-label={t('otherGroups')}>
          {#each others as group (group.id)}
            <li>
              <span>{group.name}</span>
              <button onclick={() => session.activate(group.id)}>{t('use')}</button>
            </li>
          {/each}
        </ul>
      {/if}

      <div class="actions">
        <button onclick={() => (view = { kind: 'create' })}>
          <Pictogram name="plus" size={26} />
          {t('createGroup')}
        </button>
        <button onclick={() => (view = { kind: 'join' })}>
          <Pictogram name="qr" size={26} />
          {t('joinGroup')}
        </button>
      </div>
      {#if !session.groups.some((group) => group.practice)}
        <button class="practice" onclick={practise}>{t('startPractice')}</button>
      {/if}

      {#if session.identity}
        <p class="hint device">
          {session.identity.alias} · {t('deviceId', { node: session.identity.nodeId })} ·
          <a href={guideUrl(t('guidePath'))} target="_blank" rel="noopener">{t('guide')}</a>
        </p>
      {/if}
    </div>
  {/if}
</Panel>

<style>
  .others {
    display: grid;
    gap: 0.4rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .others li {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    justify-content: space-between;
    padding: 0.4rem 0.4rem 0.4rem 0.85rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-card);
  }

  .actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }

  .actions button {
    display: grid;
    gap: 0.35rem;
    place-items: center;
    padding: 0.9rem 0.5rem;
    font-weight: 600;
  }

  .practice {
    justify-self: center;
    font-size: var(--text-secondary);
    border-color: transparent;
  }

  .device {
    margin-top: 0.5rem;
    font-size: var(--text-small);
  }
</style>
