<!-- The dock's "Add" menu: a marker or an area, drawn on the map next. -->
<script lang="ts">
  import type { MessageKey, Translate } from '../i18n/index.ts';
  import DockMenu from '../ui/DockMenu.svelte';
  import type { GlyphName } from '../ui/glyphs.ts';
  import Pictogram from '../ui/Pictogram.svelte';
  import type { DraftKind } from './draft.ts';

  interface Props {
    t: Translate;
    onstart: (kind: DraftKind) => void;
  }

  let { t, onstart }: Props = $props();

  const KINDS: readonly { kind: DraftKind; icon: GlyphName; label: MessageKey }[] = [
    { kind: 'marker', icon: 'pin', label: 'drawMarker' },
    { kind: 'area', icon: 'area', label: 'drawArea' },
  ];
</script>

<DockMenu icon="plus" label={t('add')}>
  {#snippet items(close: () => void)}
    {#each KINDS as item (item.kind)}
      <button
        role="menuitem"
        onclick={() => {
          close();
          onstart(item.kind);
        }}
      >
        <Pictogram name={item.icon} size={20} />
        {t(item.label)}
      </button>
    {/each}
  {/snippet}
</DockMenu>
