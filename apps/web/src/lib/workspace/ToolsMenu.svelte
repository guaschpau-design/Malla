<!-- The toolbar's menu of tools that work with or without a group. -->
<script lang="ts">
  import type { MessageKey, Translate } from '../i18n/index.ts';
  import type { Preference } from '../settings/preference.svelte.ts';
  import MenuButton from '../ui/MenuButton.svelte';
  import { screenWakeSupported } from '../ui/screen-awake.svelte.ts';
  import { panels } from '../ui/panels.svelte.ts';

  interface Props {
    t: Translate;
    onmeasure: () => void;
    keepScreenOn: Preference<boolean>;
  }

  let { t, onmeasure, keepScreenOn }: Props = $props();

  const TOOLS: readonly { label: MessageKey; run: () => void }[] = [
    { label: 'coordinates', run: () => (panels.open = 'point') },
    {
      label: 'measure',
      run: () => {
        onmeasure();
      },
    },
    { label: 'layers', run: () => (panels.open = 'layers') },
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
    {#if screenWakeSupported}
      <button
        role="menuitemcheckbox"
        aria-checked={keepScreenOn.value}
        onclick={async () => {
          close();
          await keepScreenOn.set(!keepScreenOn.value);
        }}
      >
        <strong>{t('keepScreenOn')}</strong>
        <span>{t(keepScreenOn.value ? 'keepScreenOnYes' : 'keepScreenOnNo')}</span>
      </button>
    {/if}
  {/snippet}
</MenuButton>
