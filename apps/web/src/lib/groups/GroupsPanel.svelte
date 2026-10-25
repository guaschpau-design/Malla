<!-- Who this device is, its groups, and the ways to create, join, invite and leave. -->
<script lang="ts">
  import type { GroupState } from '@teselia/core';
  import { GROUP_NAME_MAX_BYTES, parseInvitationUrl, type Invitation } from '@teselia/protocol';

  import { DEFAULT_SERVER_URL } from '../config.ts';
  import type { Translate } from '../i18n/index.ts';
  import type { Session } from '../session.svelte.ts';
  import Panel from '../ui/Panel.svelte';
  import { canInvite, normalizeGroupName, normalizeServerUrl, type StoredGroup } from './group.ts';
  import InviteView from './InviteView.svelte';
  import MemberList from './MemberList.svelte';
  import { canScanQr } from './qr-scanning.ts';
  import QrScanner from './QrScanner.svelte';
  import { ROLE_LABELS } from './role-label.ts';

  interface Props {
    t: Translate;
    session: Session;
    /** State of the active group, to list its members. */
    activeState: GroupState | undefined;
    /** An invitation was pasted or scanned; the caller asks the user to confirm it. */
    oninvitation: (invitation: Invitation) => void;
    onclose: () => void;
  }

  let { t, session, activeState, oninvitation, onclose }: Props = $props();

  type View = { kind: 'list' } | { kind: 'invite'; group: StoredGroup } | { kind: 'scan' };
  let view: View = $state.raw({ kind: 'list' });

  let newName = $state('');
  const groupName = $derived(normalizeGroupName(newName));
  const nameTooLong = $derived(newName.trim() !== '' && groupName === null);
  let serverText = $state(DEFAULT_SERVER_URL ?? '');
  const server = $derived(normalizeServerUrl(serverText));

  let pasted = $state('');
  let pastedInvalid = $state(false);
  const scanAvailable = canScanQr();

  async function create(): Promise<void> {
    if (groupName === null || server === undefined) return;
    await session.createGroup(groupName, server);
    newName = '';
  }

  function serverLabel(url: string | null): string {
    return url === null ? t('noServer') : new URL(url).host;
  }

  function joinPasted(): void {
    const invitation = parseInvitationUrl(pasted.trim());
    pastedInvalid = !invitation.ok;
    if (invitation.ok) {
      pasted = '';
      oninvitation(invitation.value);
    }
  }

  function scanned(invitation: Invitation): void {
    view = { kind: 'list' };
    oninvitation(invitation);
  }

  async function leave(group: StoredGroup): Promise<void> {
    if (!confirm(t('confirmLeave', { group: group.name }))) return;
    await session.leave(group.id);
  }
</script>

<Panel title={t('groups')} closeLabel={t('close')} {onclose}>
  {#if view.kind === 'invite' && session.identity}
    <InviteView
      {t}
      group={view.group}
      issuer={session.identity.nodeId}
      onback={() => (view = { kind: 'list' })}
    />
  {:else if view.kind === 'scan'}
    <QrScanner {t} onresult={scanned} oncancel={() => (view = { kind: 'list' })} />
  {:else}
    {#if session.identity}
      <section class="section">
        <h3>{t('thisDevice')}</h3>
        <p>
          <strong>{session.identity.alias}</strong><br />
          <span class="hint">{t('deviceId', { node: session.identity.nodeId })}</span>
        </p>
      </section>
    {/if}

    <section class="section">
      <h3>{t('yourGroups')}</h3>
      {#if session.groups.length === 0}
        <p class="hint">{t('noGroups')}</p>
      {:else}
        <ul class="cards">
          {#each session.groups as group (group.id)}
            {@const active = group.id === session.activeGroupId}
            <li class:active>
              <div>
                <strong>{group.name}</strong>
                <span class="badge role">{t(ROLE_LABELS[group.role])}</span>
                {#if active}<span class="badge">{t('active')}</span>{/if}
                <span class="hint server">{serverLabel(group.server)}</span>
              </div>
              {#if active && activeState && session.identity}
                <MemberList {t} groupState={activeState} self={session.identity.nodeId} />
              {/if}
              <div class="row">
                {#if !active}
                  <button onclick={() => session.activate(group.id)}>{t('use')}</button>
                {/if}
                {#if canInvite(group)}
                  <button onclick={() => (view = { kind: 'invite', group })}>{t('invite')}</button>
                {/if}
                <button onclick={() => leave(group)}>{t('leave')}</button>
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <form
      class="section stack"
      onsubmit={(event) => {
        event.preventDefault();
        void create();
      }}
    >
      <h3>{t('createGroup')}</h3>
      <label>
        {t('groupName')}
        <input bind:value={newName} maxlength={GROUP_NAME_MAX_BYTES} />
      </label>
      {#if nameTooLong}<p class="warning">{t('nameInvalid')}</p>{/if}
      <label>
        {t('server')}
        <input bind:value={serverText} inputmode="url" autocomplete="off" placeholder="https://" />
      </label>
      <p class:warning={server === undefined} class:hint={server !== undefined}>
        {server === undefined ? t('serverInvalid') : t('serverHint')}
      </p>
      <button type="submit" class="primary" disabled={groupName === null || server === undefined}>
        {t('create')}
      </button>
    </form>

    <form
      class="section stack"
      onsubmit={(event) => {
        event.preventDefault();
        joinPasted();
      }}
    >
      <h3>{t('joinWithInvitation')}</h3>
      <label>
        {t('invitationLink')}
        <input bind:value={pasted} inputmode="url" autocomplete="off" />
      </label>
      {#if pastedInvalid}<p class="warning">{t('notAnInvitation')}</p>{/if}
      <div class="row">
        <button type="submit" disabled={pasted.trim() === ''}>{t('join')}</button>
        {#if scanAvailable}
          <button type="button" onclick={() => (view = { kind: 'scan' })}>{t('scanQr')}</button>
        {/if}
      </div>
    </form>
  {/if}
</Panel>

<style>
  section > h3 {
    margin-bottom: 0.5rem;
  }

  .cards > li.active {
    border-color: var(--accent);
  }

  .role {
    text-transform: capitalize;
  }

  .server {
    display: block;
  }
</style>
