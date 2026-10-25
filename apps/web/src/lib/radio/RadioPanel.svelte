<!-- Pairing the LoRa radio and seeing how it is doing. -->
<script lang="ts">
  import { isWebBluetoothAvailable } from '@teselia/meshcore';

  import type { MessageKey, Translate } from '../i18n/index.ts';
  import Panel from '../ui/Panel.svelte';
  import type { RadioProblem, RadioSession } from './radio.svelte.ts';

  interface Props {
    t: Translate;
    radio: RadioSession;
    /** Name of the active group, or null if there is none. */
    groupName: string | null;
    onclose: () => void;
  }

  let { t, radio, groupName, onclose }: Props = $props();

  const supported = isWebBluetoothAvailable();

  const PROBLEMS: Readonly<Record<RadioProblem, MessageKey>> = {
    unsupported: 'radioUnsupported',
    'no-free-channel': 'radioNoFreeChannel',
    'no-answer': 'radioNoAnswer',
    failed: 'radioFailed',
  };
</script>

<Panel title={t('radioTitle')} closeLabel={t('close')} {onclose}>
  <div class="stack section">
    {#if !supported}
      <p class="warning">{t('radioUnsupported')}</p>
    {:else if radio.state === 'disconnected'}
      <p class="intro">{t('radioIntro')}</p>
      <div class="row">
        <button class="primary" onclick={() => radio.connect()}>{t('radioConnect')}</button>
      </div>
    {:else if radio.state === 'connecting'}
      <p>{t('radioConnecting')}</p>
    {:else}
      <p><strong>{t('radioConnected', { name: radio.name ?? t('radioUnnamed') })}</strong></p>
      {#if radio.linked && groupName}
        <p class="hint">{t('radioChannel', { group: groupName })}</p>
      {:else if !groupName}
        <p class="hint">{t('radioNoGroup')}</p>
      {/if}
      {#if radio.lastSnr !== null}
        <p class="hint">{t('radioSnr', { snr: radio.lastSnr })}</p>
      {/if}
      <p class="hint">{t('radioAirtime', { percent: Math.round(radio.airtimeUsed * 100) })}</p>
      <div class="row">
        <button onclick={() => radio.disconnect()}>{t('radioDisconnect')}</button>
      </div>
    {/if}
    {#if radio.problem}<p class="warning">{t(PROBLEMS[radio.problem])}</p>{/if}
  </div>
</Panel>
