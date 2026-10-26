<!-- Shows a coordinator the invitation to a group as a QR code and a link. -->
<script lang="ts">
  import type { NodeId, Role } from '@tesel/protocol';

  import type { Translate } from '../i18n/index.ts';
  import QrCode from '../ui/QrCode.svelte';
  import { invitationFor, type StoredGroup } from './group.ts';
  import { invitationLink } from './join-link.ts';
  import { ROLE_LABELS } from './role-label.ts';

  interface Props {
    t: Translate;
    group: StoredGroup;
    issuer: NodeId;
    onback: () => void;
  }

  let { t, group, issuer, onback }: Props = $props();

  let role: Role = $state('member');
  let copied = $state(false);
  const canShare = 'share' in navigator;

  const link = $derived(
    invitationLink(
      window.location.origin,
      import.meta.env.BASE_URL,
      invitationFor(group, role, issuer),
    ),
  );

  async function copy(text: string): Promise<void> {
    await navigator.clipboard.writeText(text);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }

  async function share(text: string): Promise<void> {
    try {
      await navigator.share({ title: t('inviteTitle', { group: group.name }), url: text });
    } catch {
      // The user closed the share sheet.
    }
  }
</script>

<div class="stack section">
  <h3>{t('inviteTitle', { group: group.name })}</h3>
  <label>
    {t('inviteRole')}
    <select bind:value={role}>
      {#each ['member', 'coordinator'] as const as option (option)}
        <option value={option}>{t(ROLE_LABELS[option])}</option>
      {/each}
    </select>
  </label>

  {#if link.ok}
    <QrCode text={link.value} label={t('invitationQr')} />
    <p class="hint">{t('inviteHowTo')}</p>
    <p class="warning">{t('inviteWarning')}</p>
    <label>
      {t('invitationLink')}
      <input
        value={link.value}
        readonly
        onfocus={(event) => {
          event.currentTarget.select();
        }}
      />
    </label>
    <div class="row">
      <button onclick={() => copy(link.value)}>{copied ? t('copied') : t('copyLink')}</button>
      {#if canShare}
        <button onclick={() => share(link.value)}>{t('share')}</button>
      {/if}
      <button onclick={onback}>{t('back')}</button>
    </div>
  {:else}
    <!-- The only way building fails: the app was not opened from a secure address (protocol §6). -->
    <p class="warning">{t('invitationNeedsHttps')}</p>
    <div class="row"><button onclick={onback}>{t('back')}</button></div>
  {/if}
</div>
