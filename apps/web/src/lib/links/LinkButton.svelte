<!-- In the top bar: how this device reaches its group now, by medium — WiFi, 4G/5G, LoRa — with a
     coloured dot. Opens the connections panel. -->
<script lang="ts">
  import type { Translate } from '../i18n/index.ts';
  import StatusDot from '../ui/StatusDot.svelte';
  import { channelName, LEVEL_TONES, type Link, type Network } from './links.ts';

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
    return link.channels.map((channel) => t(channelName(channel, network))).join(' · ');
  });
</script>

<button
  class="link"
  {onclick}
  aria-expanded={expanded}
  aria-label="{t('connections')}: {label}"
  title={detail}
>
  <StatusDot tone={LEVEL_TONES[link.level]} />
  {label}
</button>

<style>
  .link {
    /* The dark bar needs the bright lime for "good". */
    --status-good: var(--signal);

    display: inline-flex;
    flex-shrink: 0;
    gap: 0.45rem;
    align-items: center;
    margin-right: auto;
    padding: 0.3rem 0.65rem;
    font-size: var(--text-secondary);
    font-weight: 600;
    color: inherit;
    white-space: nowrap;
    border-color: var(--chrome-line);
  }
</style>
