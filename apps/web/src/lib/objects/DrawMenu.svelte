<!-- Button and menu to start drawing a marker, line, area or circle. -->
<script lang="ts">
  import type { MessageKey, Translate } from '../i18n/index.ts';
  import MenuButton from '../ui/MenuButton.svelte';
  import type { DraftKind } from './draft.ts';

  interface Props {
    t: Translate;
    onstart: (kind: DraftKind) => void;
  }

  let { t, onstart }: Props = $props();

  const KINDS: readonly { kind: DraftKind; label: MessageKey }[] = [
    { kind: 'marker', label: 'drawMarker' },
    { kind: 'line', label: 'drawLine' },
    { kind: 'area', label: 'drawArea' },
    { kind: 'circle', label: 'drawCircle' },
  ];
</script>

<MenuButton label={t('draw')} title={t('draw')}>
  {#snippet items(close: () => void)}
    {#each KINDS as item (item.kind)}
      <button
        role="menuitem"
        onclick={() => {
          close();
          onstart(item.kind);
        }}>{t(item.label)}</button
      >
    {/each}
  {/snippet}
</MenuButton>
