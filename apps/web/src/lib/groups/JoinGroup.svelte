<!-- Joining a group: scan the invitation's QR code with the camera, or paste its link. -->
<script lang="ts">
  import { parseInvitationUrl, type Invitation } from '@tesel/protocol';

  import type { Translate } from '../i18n/index.ts';
  import Pictogram from '../ui/Pictogram.svelte';
  import { canScanQr } from './qr-scanning.ts';

  interface Props {
    t: Translate;
    /** A pasted link was an invitation; the caller asks the user to confirm it. */
    oninvitation: (invitation: Invitation) => void;
    onscan: () => void;
    oncancel: () => void;
  }

  let { t, oninvitation, onscan, oncancel }: Props = $props();

  const scanAvailable = canScanQr();
  let pasted = $state('');
  let pastedInvalid = $state(false);

  function joinPasted(): void {
    const invitation = parseInvitationUrl(pasted.trim());
    pastedInvalid = !invitation.ok;
    if (invitation.ok) {
      pasted = '';
      oninvitation(invitation.value);
    }
  }
</script>

<div class="stack section">
  <h3>{t('joinWithInvitation')}</h3>
  {#if scanAvailable}
    <button class="primary scan" onclick={onscan}>
      <Pictogram name="qr" size={24} />
      {t('scanQr')}
    </button>
  {/if}
  <form
    class="stack"
    onsubmit={(event) => {
      event.preventDefault();
      joinPasted();
    }}
  >
    <label>
      {t('invitationLink')}
      <input bind:value={pasted} inputmode="url" autocomplete="off" />
    </label>
    {#if pastedInvalid}<p class="warning">{t('notAnInvitation')}</p>{/if}
    <div class="row">
      <button type="submit" disabled={pasted.trim() === ''}>{t('join')}</button>
      <button type="button" onclick={oncancel}>{t('cancel')}</button>
    </div>
  </form>
</div>

<style>
  .scan {
    display: inline-flex;
    gap: 0.6rem;
    align-items: center;
    justify-content: center;
    padding: 0.8rem;
  }
</style>
