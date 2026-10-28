<!-- Each way of reaching the group, as a card: the network (WiFi or mobile data) and the LoRa
     radio. -->
<script lang="ts">
  import type { Translate } from '../i18n/index.ts';
  import RadioCard from '../radio/RadioCard.svelte';
  import Panel from '../ui/Panel.svelte';
  import ChannelCard from './ChannelCard.svelte';
  import {
    channelName,
    networkSign,
    networkStatus,
    type LinkInput,
    type Network,
  } from './links.ts';

  interface Props {
    t: Translate;
    input: LinkInput;
    network: Network;
    /** Name of the active group, or null if there is none. */
    groupName: string | null;
    onclose: () => void;
  }

  let { t, input, network, groupName, onclose }: Props = $props();

  const status = $derived(networkStatus(input));
</script>

<Panel title={t('connections')} closeLabel={t('close')} {onclose}>
  <div class="channels section">
    <ChannelCard
      icon={networkSign('internet', network)}
      name={t(channelName('internet', network))}
      level={status.level}
      status={t(status.label)}
    />
    <RadioCard {t} {groupName} />
  </div>
</Panel>

<style>
  .channels {
    display: grid;
    gap: 0.6rem;
  }
</style>
