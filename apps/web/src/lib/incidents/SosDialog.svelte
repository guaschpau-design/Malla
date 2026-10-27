<!-- Sends an SOS with this device's position. Without one it does not wait: the call goes out at
     once with no place, and the position follows as soon as the GPS has it (protocol §3.8). -->
<script lang="ts">
  import { SOS_TEXT_MAX_BYTES, utf8ByteLength, type LatLon, type SosKind } from '@tesel/protocol';
  import { onMount } from 'svelte';

  import type { Translate } from '../i18n/index.ts';
  import type { DeviceLocation } from '../position/device-location.svelte.ts';
  import Dialog from '../ui/Dialog.svelte';
  import { Submission } from '../ui/submission.svelte.ts';
  import { SOS_KINDS } from './sos-kinds.ts';

  interface Props {
    t: Translate;
    location: DeviceLocation;
    /** Sends the call; `at` is null when this device has no position yet. */
    onsend: (
      kind: SosKind,
      at: LatLon | null,
      accuracy: number | null,
      text: string,
    ) => Promise<void>;
    oncancel: () => void;
  }

  let { t, location, onsend, oncancel }: Props = $props();

  let kind: SosKind = $state('general');
  let text = $state('');
  const fix = $derived(location.fix);
  /** Whole metres, as the SOS carries it. */
  const accuracy = $derived(fix?.accuracy == null ? null : Math.round(fix.accuracy));
  const submission = new Submission();
  const tooLong = $derived(utf8ByteLength(text.trim()) > SOS_TEXT_MAX_BYTES);

  // The GPS stays on while the dialog is open, so the call goes with the latest fix.
  onMount(() => location.use());

  function send(): void {
    void submission.run(() => onsend(kind, fix?.at ?? null, accuracy, text.trim()));
  }
</script>

<Dialog title={t('sosTitle')}>
  <form
    class="stack"
    onsubmit={(event) => {
      event.preventDefault();
      send();
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
    <p class:hint={fix !== null} class:warning={fix === null}>
      {fix ? t('sosLocated', { meters: accuracy ?? '?' }) : t('sosWithoutPlace')}
    </p>
    {#if submission.failed}<p class="warning">{t('sosFailed')}</p>{/if}
    <div class="row">
      <button type="submit" class="danger" disabled={submission.busy || tooLong}
        >{t('sosSend')}</button
      >
      <button type="button" onclick={oncancel}>{t('cancel')}</button>
    </div>
  </form>
</Dialog>
