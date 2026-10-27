<!-- The map under everything, and what is shown on it: pictures to choose the map, then the
     switches in the groups layers.ts sets out. This device and SOS calls are always shown. -->
<script lang="ts">
  import type { MessageKey, Translate } from '../i18n/index.ts';
  import type { Preference } from '../settings/preference.svelte.ts';
  import Panel from '../ui/Panel.svelte';
  import Pictogram from '../ui/Pictogram.svelte';
  import Switch from '../ui/Switch.svelte';
  import BaseMapPreview from './BaseMapPreview.svelte';
  import {
    isFlag,
    LAYER_SECTIONS,
    LAYER_SWITCHES,
    type LayerSwitch,
    type MapFlag,
    type MapLayer,
  } from './layers.ts';
  import { BASE_MAPS, type BaseMap } from './style.ts';

  interface Props {
    t: Translate;
    base: Preference<BaseMap>;
    /** The layers that are off unless turned on, each a preference. */
    flags: Readonly<Record<MapFlag, Preference<boolean>>>;
    hidden: Preference<readonly MapLayer[]>;
    onclose: () => void;
  }

  let { t, base, flags, hidden, onclose }: Props = $props();

  const BASE_NAMES: Readonly<Record<BaseMap, MessageKey>> = {
    streets: 'baseMapStreets',
    topo: 'baseMapTopo',
    aerial: 'baseMapAerial',
  };

  function isOn(name: LayerSwitch): boolean {
    return isFlag(name) ? flags[name].value : !hidden.value.includes(name);
  }

  async function toggle(name: LayerSwitch): Promise<void> {
    if (isFlag(name)) {
      await flags[name].set(!flags[name].value);
      return;
    }
    const others = hidden.value.filter((layer) => layer !== name);
    await hidden.set(hidden.value.includes(name) ? others : [...others, name]);
  }
</script>

<Panel title={t('layers')} closeLabel={t('close')} {onclose}>
  <div class="bases section" role="radiogroup" aria-label={t('baseMap')}>
    {#each BASE_MAPS as option (option)}
      <button role="radio" aria-checked={base.value === option} onclick={() => base.set(option)}>
        <BaseMapPreview base={option} />
        <span>{t(BASE_NAMES[option])}</span>
      </button>
    {/each}
  </div>
  {#each LAYER_SECTIONS as section (section.title)}
    <section class="layers section" aria-label={t(section.title)}>
      <h3>{t(section.title)}</h3>
      {#each section.switches as name (name)}
        <button
          class="layer"
          role="switch"
          aria-checked={isOn(name)}
          onclick={() => void toggle(name)}
        >
          <Pictogram name={LAYER_SWITCHES[name].icon} size={20} />
          <span>{t(LAYER_SWITCHES[name].label)}</span>
          <Switch on={isOn(name)} />
        </button>
      {/each}
    </section>
  {/each}
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

  h3 {
    padding: 0 0.4rem;
    color: var(--muted);
    font-size: var(--text-small);
    font-weight: 600;
  }

  .layer {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 0.75rem;
    align-items: center;
    padding: 0.55rem 0.4rem;
    text-align: left;
    border-color: transparent;
  }

  .layer[aria-checked='false'] :global(svg) {
    opacity: 0.45;
  }
</style>
