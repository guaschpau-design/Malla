<!-- The LoRa radio in the connections panel: whether one is paired and on the group, the button to
     pair or unpair it, and how much it is transmitting. -->
<script lang="ts">
  import { isWebBluetoothAvailable } from '@tesel/meshcore';

  import type { MessageKey, Translate } from '../i18n/index.ts';
  import ChannelCard from '../links/ChannelCard.svelte';
  import type { Link } from '../links/links.ts';
  import type { RadioProblem, RadioSession } from './radio.svelte.ts';

  interface Props {
    t: Translate;
    radio: RadioSession;
    /** Name of the active group, or null if there is none. */
    groupName: string | null;
  }

  let { t, radio, groupName }: Props = $props();

  const supported = isWebBluetoothAvailable();

  const PROBLEMS: Readonly<Record<RadioProblem, MessageKey>> = {
    unsupported: 'radioUnsupported',
    'no-free-channel': 'radioNoFreeChannel',
    'no-answer': 'radioNoAnswer',
    failed: 'radioFailed',
  };

  const card = $derived.by((): { level: Link['level']; status: string } => {
    const name = radio.name ?? 'MeshCore';
    if (!supported) return { level: 'none', status: t('radioUnsupported') };
    if (radio.state === 'disconnected') return { level: 'none', status: t('radioOff') };
    if (radio.state === 'connecting') return { level: 'connecting', status: t('linkConnecting') };
    if (radio.linked && groupName) return { level: 'ok', status: t('radioLinked', { name }) };
    return { level: 'connecting', status: t('radioWaiting', { name }) };
  });
</script>

<ChannelCard icon="mast" name="LoRa" level={card.level} status={card.status}>
  {#if supported && radio.state === 'ready'}
    <span class="hint">
      {t('radioDetails', { percent: Math.round(radio.airtimeUsed * 100) })}
      {#if radio.lastSnr !== null}· {t('radioSignal', { snr: radio.lastSnr })}{/if}
    </span>
  {/if}
  {#if radio.problem}<p class="warning">{t(PROBLEMS[radio.problem])}</p>{/if}
  {#if supported && radio.state === 'disconnected'}
    <div class="row">
      <button class="primary" onclick={() => radio.connect()}>{t('radioConnect')}</button>
    </div>
  {:else if supported && radio.state === 'ready'}
    <div class="row">
      <button onclick={() => radio.disconnect()}>{t('radioDisconnect')}</button>
    </div>
  {/if}
</ChannelCard>

<style>
  p {
    margin: 0;
  }
</style>
