<!-- What is shown on the map. This device and SOS calls always are. -->
<script lang="ts">
  import type { MessageKey, Translate } from '../i18n/index.ts';
  import type { Preference } from '../settings/preference.svelte.ts';
  import Panel from '../ui/Panel.svelte';
  import { MAP_LAYERS, type MapLayer } from './layers.ts';

  interface Props {
    t: Translate;
    hidden: Preference<readonly MapLayer[]>;
    onclose: () => void;
  }

  let { t, hidden, onclose }: Props = $props();

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
    <p class="hint">{t('layersAlways')}</p>
  </div>
</Panel>

<style>
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
