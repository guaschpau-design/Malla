<!-- In the top bar: how this device reaches its group now, by medium — WiFi, 4G/5G, LoRa — with a
     coloured dot. Opens the connections panel. -->
<script lang="ts">
  import type { Translate } from '../i18n/index.ts';
  import { channelName, type Link, type Network } from './links.ts';

  interface Props {
    t: Translate;
    link: Link;
    network: Network;
    /** How the network channel is doing, shown on hover. */
    detail: string;
    expanded: boolean;
    onclick: () => void;
  }

  let { t, link, network, detail, expanded, onclick }: Props = $props();

  const label = $derived.by(() => {
    if (link.level === 'connecting') return t('linkConnecting');
    if (link.level === 'none') return t('linkNone');
    return link.channels.map((channel) => channelName(channel, network)).join(' · ');
  });
</script>

<button
  class="link {link.level}"
  {onclick}
  aria-expanded={expanded}
  aria-label="{t('connections')}: {label}"
  title={detail}
>
  <span class="dot" aria-hidden="true"></span>
  {label}
</button>

<style>
  .link {
    display: inline-flex;
    flex-shrink: 0;
    gap: 0.45rem;
    align-items: center;
    margin-right: auto;
    padding: 0.3rem 0.65rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: inherit;
    white-space: nowrap;
    border-color: rgb(230 235 232 / 25%);
  }

  .dot {
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 50%;
  }

  .ok .dot {
    background: var(--signal);
  }

  .connecting .dot {
    background: var(--warning);
  }

  .none .dot {
    background: var(--danger);
  }
</style>
