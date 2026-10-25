<!-- Sends an SOS with this device's position, or the map centre if there is no fix. -->
<script lang="ts">
  import { SOS_TEXT_MAX_BYTES, utf8ByteLength, type LatLon, type SosKind } from '@teselia/protocol';
  import { onMount } from 'svelte';

  import type { Translate } from '../i18n/index.ts';
  import Dialog from '../ui/Dialog.svelte';
  import { SOS_KINDS } from './sos-kinds.ts';

  interface Props {
    t: Translate;
    /** Used when the device cannot get a position. */
    fallback: LatLon;
    onsend: (kind: SosKind, at: LatLon, accuracy: number | null, text: string) => Promise<void>;
    oncancel: () => void;
  }

  let { t, fallback, onsend, oncancel }: Props = $props();

  /** How long to wait for a position before falling back to the map centre. */
  const LOCATE_TIMEOUT_MS = 15_000;

  let kind: SosKind = $state('general');
  let text = $state('');
  let fix: { at: LatLon; accuracy: number } | null = $state(null);
  let locating = $state(true);
  let busy = $state(false);
  const tooLong = $derived(utf8ByteLength(text.trim()) > SOS_TEXT_MAX_BYTES);

  onMount(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        fix = {
          at: { lat: position.coords.latitude, lon: position.coords.longitude },
          accuracy: Math.round(position.coords.accuracy),
        };
        locating = false;
      },
      () => (locating = false),
      { enableHighAccuracy: true, timeout: LOCATE_TIMEOUT_MS, maximumAge: 30_000 },
    );
  });

  async function send(): Promise<void> {
    busy = true;
    try {
      await onsend(kind, fix?.at ?? fallback, fix?.accuracy ?? null, text.trim());
    } finally {
      busy = false;
    }
  }
</script>

<Dialog title={t('sosTitle')}>
  <form
    class="stack"
    onsubmit={(event) => {
      event.preventDefault();
      void send();
    }}
  >
    <label>
      {t('sosKind')}
      <select bind:value={kind}>
        {#each Object.entries(SOS_KINDS) as [value, label] (value)}
          <option {value}>{t(label)}</option>
        {/each}
      </select>
    </label>
    <label>
      {t('sosText')}
      <input bind:value={text} autocomplete="off" />
    </label>
    {#if tooLong}<p class="warning">{t('messageTooLong')}</p>{/if}
    <p class:hint={fix !== null || locating} class:warning={fix === null && !locating}>
      {#if locating}
        {t('sosLocating')}
      {:else if fix}
        {t('sosLocated', { meters: fix.accuracy })}
      {:else}
        {t('sosNoLocation')}
      {/if}
    </p>
    <div class="row">
      <button type="submit" class="danger" disabled={busy || tooLong}>{t('sosSend')}</button>
      <button type="button" onclick={oncancel}>{t('cancel')}</button>
    </div>
  </form>
</Dialog>
