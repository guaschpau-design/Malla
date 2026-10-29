<!-- The map under everything, and what is shown on it: pictures to choose the map, the switches
     most used, the rest folded under "More layers", then the credits of the map's data and the
     licences of the third-party code the app ships. This device and SOS calls are always shown. -->
<script lang="ts">
  import { thirdPartyNoticesUrl } from '../config.ts';
  import type { MessageKey, Translate } from '../i18n/index.ts';
  import type { Preference } from '../settings/preference.svelte.ts';
  import Fold from '../ui/Fold.svelte';
  import Panel from '../ui/Panel.svelte';
  import SwitchRow from '../ui/SwitchRow.svelte';
  import BaseMapPreview from './BaseMapPreview.svelte';
  import {
    isFlag,
    LAYER_SWITCHES,
    LAYER_SWITCHES_MORE,
    LAYER_SWITCHES_SHOWN,
    type LayerSwitch,
    type MapFlag,
    type MapLayer,
  } from './layers.ts';
  import { BASE_MAPS, type BaseMap } from './style/style.ts';

  interface Props {
    t: Translate;
    base: Preference<BaseMap>;
    /** The layers that are off unless turned on, each a preference. */
    flags: Readonly<Record<MapFlag, Preference<boolean>>>;
    hidden: Preference<readonly MapLayer[]>;
    /** What the map's data asks to be credited for, as HTML of our own. */
    credits: readonly string[];
    onclose: () => void;
  }

  let { t, base, flags, hidden, credits, onclose }: Props = $props();

  const BASE_NAMES: Readonly<Record<BaseMap, MessageKey>> = {
    streets: 'baseMapStreets',
    topo: 'baseMapTopo',
    aerial: 'baseMapAerial',
  };

  function isOn(name: LayerSwitch): boolean {
    return isFlag(name) ? flags[name].value : !hidden.value.includes(name);
  }

  /** The folded layers that are on, by name, to tell them with the fold closed. */
  const moreOn = $derived(
    LAYER_SWITCHES_MORE.filter((name) => isOn(name)).map((name) => t(LAYER_SWITCHES[name].label)),
  );

  async function toggle(name: LayerSwitch): Promise<void> {
    if (isFlag(name)) {
      await flags[name].set(!flags[name].value);
      return;
    }
    const others = hidden.value.filter((layer) => layer !== name);
    await hidden.set(hidden.value.includes(name) ? others : [...others, name]);
  }
</script>

{#snippet layer(name: LayerSwitch)}
  <SwitchRow
    icon={LAYER_SWITCHES[name].icon}
    label={t(LAYER_SWITCHES[name].label)}
    on={isOn(name)}
    onclick={() => void toggle(name)}
  />
{/snippet}

<Panel title={t('layers')} closeLabel={t('close')} {onclose}>
  <div class="bases section" role="radiogroup" aria-label={t('baseMap')}>
    {#each BASE_MAPS as option (option)}
      <button role="radio" aria-checked={base.value === option} onclick={() => base.set(option)}>
        <BaseMapPreview base={option} />
        <span>{t(BASE_NAMES[option])}</span>
      </button>
    {/each}
  </div>
  <div class="layers section">
    {#each LAYER_SWITCHES_SHOWN as name (name)}
      {@render layer(name)}
    {/each}
    <Fold
      title={t('layersMore')}
      summary={moreOn.length > 0 ? moreOn.join(', ') : t('layersNoneOn')}
    >
      {#each LAYER_SWITCHES_MORE as name (name)}
        {@render layer(name)}
      {/each}
    </Fold>
  </div>
  <section class="credits section" aria-label={t('mapCredits')}>
    <h3>{t('mapCredits')}</h3>
    <ul>
      {#each credits as credit (credit)}
        <!-- eslint-disable-next-line svelte/no-at-html-tags -- the credits are constants of the app -->
        <li>{@html credit}</li>
      {/each}
      <li><a href={thirdPartyNoticesUrl()} target="_blank">{t('thirdPartyLicences')}</a></li>
    </ul>
  </section>
</Panel>

<style>
  .bases {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.5rem;
  }

  .bases button {
    display: grid;
    gap: 0.35rem;
    padding: 0.3rem 0.3rem 0.4rem;
    font-size: var(--text-secondary);
    font-weight: 600;
    text-align: center;
    border-width: 2px;
    border-color: transparent;
  }

  .bases button[aria-checked='true'] {
    border-color: var(--accent-line);
    box-shadow: 0 0 0 1px var(--accent-line);
  }

  .layers {
    display: grid;
    gap: 0.2rem;
  }

  .credits h3 {
    padding: 0 0.4rem;
    color: var(--muted);
    font-size: var(--text-small);
    font-weight: 600;
  }

  /* The credits are small print. */
  .credits ul {
    display: grid;
    gap: 0.15rem;
    margin: 0;
    padding: 0 0.4rem;
    color: var(--muted);
    font-size: var(--text-small);
    list-style: none;
  }

  .credits :global(a) {
    color: inherit;
  }
</style>
