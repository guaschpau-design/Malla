<!-- In the top bar: how this device reaches its group now, with the sign of each channel. Opens the
     connections panel. -->
<script lang="ts">
  import type { Translate } from '../i18n/index.ts';
  import type { GlyphName } from '../ui/glyphs.ts';
  import Pictogram from '../ui/Pictogram.svelte';
  import type { Channel, Link } from './links.ts';

  interface Props {
    t: Translate;
    link: Link;
    /** A sentence on the internet link, shown on hover. */
    detail: string;
    expanded: boolean;
    onclick: () => void;
  }

  let { t, link, detail, expanded, onclick }: Props = $props();

  const SIGNS: Readonly<Record<Channel, GlyphName>> = {
    internet: 'globe',
    'command-post': 'wifi',
    radio: 'mast',
  };
</script>

<button
  class="link {link.level}"
  {onclick}
  aria-expanded={expanded}
  aria-label="{t('connections')}: {t(link.label)}"
  title={detail}
>
  <span class="dot" aria-hidden="true"></span>
  {#each link.channels as channel (channel)}
    <Pictogram name={SIGNS[channel]} size={16} />
  {/each}
  <span class="label">{t(link.label)}</span>
</button>

<style>
  .link {
    display: inline-flex;
    flex-shrink: 0;
    gap: 0.4rem;
    align-items: center;
    margin-right: auto;
    padding: 0.3rem 0.6rem;
    font-size: 0.85rem;
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

  /* On narrow screens the dot and the signs say it all; the words stay for screen readers. */
  @media (max-width: 30rem) {
    .label {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }
  }
</style>
