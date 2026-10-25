<script lang="ts">
  import { parseInvitationUrl, type Invitation } from '@malla/protocol';
  import { onMount } from 'svelte';

  import type { Translate } from '../i18n/index.ts';
  import { scanQrCodes } from './qr-scanning.ts';

  interface Props {
    t: Translate;
    onresult: (invitation: Invitation) => void;
    oncancel: () => void;
  }

  let { t, onresult, oncancel }: Props = $props();

  let video: HTMLVideoElement;
  let problem: 'camera' | 'not-invitation' | null = $state(null);

  onMount(() => {
    const controller = new AbortController();
    scanQrCodes(
      video,
      (text) => {
        const invitation = parseInvitationUrl(text);
        if (invitation.ok) {
          controller.abort();
          onresult(invitation.value);
        } else {
          problem = 'not-invitation';
        }
      },
      controller.signal,
    ).catch((error: unknown) => {
      console.warn('Camera unavailable', error);
      problem = 'camera';
    });
    return () => {
      controller.abort();
    };
  });
</script>

<div class="stack section">
  <h3>{t('scanTitle')}</h3>
  <video bind:this={video} playsinline muted></video>
  {#if problem === 'camera'}
    <p class="warning">{t('cameraUnavailable')}</p>
  {:else if problem === 'not-invitation'}
    <p class="warning">{t('notAnInvitation')}</p>
  {:else}
    <p class="hint">{t('scanHint')}</p>
  {/if}
  <div class="row">
    <button onclick={oncancel}>{t('cancel')}</button>
  </div>
</div>

<style>
  video {
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
    background: #000;
    border-radius: 0.75rem;
  }
</style>
