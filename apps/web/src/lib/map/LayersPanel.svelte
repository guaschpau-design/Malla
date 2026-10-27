<!-- The map under everything, and what is shown on it: pictures to choose the map, switches for the
     rest. This device and SOS calls are always shown. -->
<script lang="ts">
  import type { MessageKey, Translate } from '../i18n/index.ts';
  import type { Preference } from '../settings/preference.svelte.ts';
  import type { GlyphName } from '../ui/glyphs.ts';
  import Panel from '../ui/Panel.svelte';
  import Pictogram from '../ui/Pictogram.svelte';
  import Switch from '../ui/Switch.svelte';
  import BaseMapPreview from './BaseMapPreview.svelte';
  import { MAP_LAYERS, type MapLayer } from './layers.ts';
  import { BASE_MAPS, type BaseMap } from './style.ts';

  interface Props {
    t: Translate;
    base: Preference<BaseMap>;
    relief: Preference<boolean>;
    hidden: Preference<readonly MapLayer[]>;
    onclose: () => void;
  }

  let { t, base, relief, hidden, onclose }: Props = $props();

  const BASE_NAMES: Readonly<Record<BaseMap, MessageKey>> = {
    streets: 'baseMapStreets',
    topo: 'baseMapTopo',
    aerial: 'baseMapAerial',
  };

  const LAYERS: Readonly<Record<MapLayer, { label: MessageKey; icon: GlyphName }>> = {
    members: { label: 'layerMembers', icon: 'person' },
    trails: { label: 'layerTrails', icon: 'trail' },
    objects: { label: 'layerObjects', icon: 'pin' },
    tasks: { label: 'layerTasks', icon: 'task' },
    services: { label: 'layerServices', icon: 'cross' },
    weather: { label: 'layerWeather', icon: 'cloud' },
  };

  async function toggle(layer: MapLayer): Promise<void> {
    const wasHidden = hidden.value.includes(layer);
    const others = hidden.value.filter((name) => name !== layer);
    await hidden.set(wasHidden ? others : [...others, layer]);
  }
</script>

{#snippet layerSwitch(icon: GlyphName, label: string, on: boolean, onclick: () => void)}
  <button class="layer" role="switch" aria-checked={on} {onclick}>
    <Pictogram name={icon} size={20} />
    <span>{label}</span>
    <Switch {on} />
  </button>
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
    {#each MAP_LAYERS as layer (layer)}
      {@render layerSwitch(
        LAYERS[layer].icon,
        t(LAYERS[layer].label),
        !hidden.value.includes(layer),
        () => void toggle(layer),
      )}
    {/each}
    {@render layerSwitch('relief', t('layerRelief'), relief.value, () => {
      void relief.set(!relief.value);
    })}
  </div>
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
