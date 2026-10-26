<!-- The toolbar's menu of tools that work with or without a group. -->
<script lang="ts">
  import type { MessageKey, Translate } from '../i18n/index.ts';
  import MenuButton from '../ui/MenuButton.svelte';
  import { panels } from '../ui/panels.svelte.ts';

  interface Props {
    t: Translate;
    onmeasure: () => void;
  }

  let { t, onmeasure }: Props = $props();

  const TOOLS: readonly { label: MessageKey; run: () => void }[] = [
    { label: 'coordinates', run: () => (panels.open = 'point') },
    {
      label: 'measure',
      run: () => {
        onmeasure();
      },
    },
    { label: 'offlineAreas', run: () => (panels.open = 'offline') },
  ];
</script>

<MenuButton label={t('tools')} title={t('tools')}>
  {#snippet items(close: () => void)}
    {#each TOOLS as tool (tool.label)}
      <button
        role="menuitem"
        onclick={() => {
          close();
          tool.run();
        }}>{t(tool.label)}</button
      >
    {/each}
  {/snippet}
</MenuButton>
