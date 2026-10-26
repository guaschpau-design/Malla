<!-- Each way of reaching the group, as a card: the network (WiFi or mobile data, or a command post)
     and the LoRa radio. -->
<script lang="ts">
  import type { Translate } from '../i18n/index.ts';
  import type { RadioSession } from '../radio/radio.svelte.ts';
  import RadioCard from '../radio/RadioCard.svelte';
  import Panel from '../ui/Panel.svelte';
  import ChannelCard from './ChannelCard.svelte';
  import { networkName, networkStatus, type LinkInput, type Network } from './links.ts';

  interface Props {
    t: Translate;
    input: LinkInput;
    network: Network;
    radio: RadioSession;
    /** Name of the active group, or null if there is none. */
    groupName: string | null;
    onclose: () => void;
  }

  let { t, input, network, radio, groupName, onclose }: Props = $props();

  const status = $derived(networkStatus(input));
  const name = $derived(input.viaCommandPost ? 'WiFi' : networkName(network));
</script>

<Panel title={t('connections')} closeLabel={t('close')} {onclose}>
  <div class="cards section">
    <ChannelCard
      icon={network.type === 'cellular' ? 'signal' : 'wifi'}
      {name}
      level={status.level}
      status={t(status.label)}
    />
    <RadioCard {t} {radio} {groupName} />
  </div>
</Panel>

<style>
  .cards {
    display: grid;
    gap: 0.6rem;
  }
</style>
