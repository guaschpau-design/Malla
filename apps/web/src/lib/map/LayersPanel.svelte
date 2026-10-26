<!-- The map under everything, and what is shown on it. This device and SOS calls always are. -->
<script lang="ts">
  import type { MessageKey, Translate } from '../i18n/index.ts';
  import type { Preference } from '../settings/preference.svelte.ts';
  import Panel from '../ui/Panel.svelte';
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

  const BASE_NAMES: Readonly<Record<BaseMap, { label: MessageKey; hint: MessageKey }>> = {
    streets: { label: 'baseMapStreets', hint: 'baseMapStreetsHint' },
    topo: { label: 'baseMapTopo', hint: 'baseMapTopoHint' },
    aerial: { label: 'baseMapAerial', hint: 'baseMapAerialHint' },
  };

  const NAMES: Readonly<Record<MapLayer, { label: MessageKey; hint: MessageKey }>> = {
    members: { label: 'layerMembers', hint: 'layerMembersHint' },
    trails: { label: 'layerTrails', hint: 'layerTrailsHint' },
    objects: { label: 'layerObjects', hint: 'layerObjectsHint' },
  };

  async function toggle(layer: MapLayer, shown: boolean): Promise<void> {
    const others = hidden.value.filter((name) => name !== layer);
    await hidden.set(shown ? others : [...others, layer]);
  }
</script>

<Panel title={t('layers')} closeLabel={t('close')} {onclose}>
  <div class="bases section" role="radiogroup" aria-label={t('baseMap')}>
    {#each BASE_MAPS as option (option)}
      <button role="radio" aria-checked={base.value === option} onclick={() => base.set(option)}>
        <strong>{t(BASE_NAMES[option].label)}</strong>
        <span class="hint">{t(BASE_NAMES[option].hint)}</span>
      </button>
    {/each}
  </div>
  <div class="stack section">
    {#each MAP_LAYERS as layer (layer)}
      <label class="layer">
        <input
          type="checkbox"
          checked={!hidden.value.includes(layer)}
          onchange={(event) => toggle(layer, event.currentTarget.checked)}
        />
        <span>
          <strong>{t(NAMES[layer].label)}</strong>
          <span class="hint">{t(NAMES[layer].hint)}</span>
        </span>
      </label>
    {/each}
    <label class="layer">
      <input
        type="checkbox"
        checked={relief.value}
        onchange={(event) => relief.set(event.currentTarget.checked)}
      />
      <span>
        <strong>{t('layerRelief')}</strong>
        <span class="hint">{t('layerReliefHint')}</span>
      </span>
    </label>
    <p class="hint">{t('layersAlways')}</p>
  </div>
</Panel>

<style>
  .bases {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.4rem;
  }

  .bases button {
    display: grid;
    gap: 0.15rem;
    align-content: start;
    padding: 0.5rem;
    text-align: left;
  }

  .bases .hint {
    font-size: 0.8rem;
  }

  .bases button[aria-checked='true'] {
    border-color: var(--accent-line);
    box-shadow: inset 0 0 0 1px var(--accent-line);
  }

  .layer {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
  }

  .layer input {
    width: 1.25rem;
    height: 1.25rem;
    margin: 0.15rem 0 0;
  }

  .layer > span {
    display: grid;
    gap: 0.1rem;
  }
</style>
