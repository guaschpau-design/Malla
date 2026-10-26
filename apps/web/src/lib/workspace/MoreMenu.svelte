<!-- The dock's "More" menu: what is used now and then, with or without a group. -->
<script lang="ts">
  import type { MessageKey, Translate } from '../i18n/index.ts';
  import type { Preference } from '../settings/preference.svelte.ts';
  import DockMenu from '../ui/DockMenu.svelte';
  import type { GlyphName } from '../ui/glyphs.ts';
  import { panels } from '../ui/panels.svelte.ts';
  import Pictogram from '../ui/Pictogram.svelte';
  import { screenWakeSupported } from '../ui/screen-awake.svelte.ts';
  import Switch from '../ui/Switch.svelte';

  interface Props {
    t: Translate;
    onmeasure: () => void;
    keepScreenOn: Preference<boolean>;
    /** The diary is the active group's. */
    withGroup: boolean;
  }

  let { t, onmeasure, keepScreenOn, withGroup }: Props = $props();

  interface Item {
    readonly icon: GlyphName;
    readonly label: MessageKey;
    readonly run: () => void;
    readonly needsGroup?: boolean;
  }

  const ITEMS: readonly Item[] = [
    {
      icon: 'ruler',
      label: 'measure',
      run: () => {
        onmeasure();
      },
    },
    { icon: 'search', label: 'findCoordinate', run: () => (panels.open = 'find') },
    { icon: 'journal', label: 'diary', run: () => (panels.open = 'diary'), needsGroup: true },
    { icon: 'download', label: 'offlineAreas', run: () => (panels.open = 'offline') },
  ];
</script>

<DockMenu icon="more" label={t('more')}>
  {#snippet items(close: () => void)}
    {#each ITEMS.filter((item) => withGroup || item.needsGroup !== true) as item (item.label)}
      <button
        role="menuitem"
        onclick={() => {
          close();
          item.run();
        }}
      >
        <Pictogram name={item.icon} size={20} />
        {t(item.label)}
      </button>
    {/each}
    {#if screenWakeSupported}
      <!-- The menu stays open, so the switch is seen to change. -->
      <button
        role="menuitemcheckbox"
        aria-checked={keepScreenOn.value}
        onclick={() => keepScreenOn.set(!keepScreenOn.value)}
      >
        <Pictogram name="screen" size={20} />
        {t('keepScreenOn')}
        <Switch on={keepScreenOn.value} />
      </button>
    {/if}
  {/snippet}
</DockMenu>
