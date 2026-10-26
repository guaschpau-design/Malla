<!-- The toolbar's menu of tools that work with or without a group. -->
<script lang="ts">
  import type { Translate } from '../i18n/index.ts';
  import MenuButton from '../ui/MenuButton.svelte';
  import { panels, type PanelName } from '../ui/panels.svelte.ts';

  interface Props {
    t: Translate;
  }

  let { t }: Props = $props();

  const TOOLS = [
    { panel: 'point', label: 'coordinates' },
    { panel: 'offline', label: 'offlineAreas' },
  ] as const satisfies readonly { panel: PanelName; label: string }[];
</script>

<MenuButton label={t('tools')} title={t('tools')}>
  {#snippet items(close: () => void)}
    {#each TOOLS as tool (tool.panel)}
      <button
        role="menuitem"
        onclick={() => {
          close();
          panels.open = tool.panel;
        }}>{t(tool.label)}</button
      >
    {/each}
  {/snippet}
</MenuButton>
