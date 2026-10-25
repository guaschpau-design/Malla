<!-- Button and menu to start drawing a marker, line, area or circle. -->
<script lang="ts">
  import type { MessageKey, Translate } from '../i18n/index.ts';
  import type { DraftKind } from './draft.ts';

  interface Props {
    t: Translate;
    onstart: (kind: DraftKind) => void;
  }

  let { t, onstart }: Props = $props();

  let open = $state(false);

  const KINDS: readonly { kind: DraftKind; label: MessageKey }[] = [
    { kind: 'marker', label: 'drawMarker' },
    { kind: 'line', label: 'drawLine' },
    { kind: 'area', label: 'drawArea' },
    { kind: 'circle', label: 'drawCircle' },
  ];
</script>

<div class="draw">
  {#if open}
    <div class="menu" role="menu" aria-label={t('draw')}>
      {#each KINDS as item (item.kind)}
        <button
          role="menuitem"
          onclick={() => {
            open = false;
            onstart(item.kind);
          }}>{t(item.label)}</button
        >
      {/each}
    </div>
  {/if}
  <button class="fab" aria-expanded={open} onclick={() => (open = !open)}>{t('draw')}</button>
</div>

<style>
  .draw {
    position: relative;
    pointer-events: auto;
  }

  .menu {
    position: absolute;
    right: 0;
    bottom: calc(100% + 0.5rem);
    display: grid;
    gap: 0.25rem;
    min-width: 10rem;
    padding: 0.4rem;
    background: var(--surface);
    border-radius: 0.75rem;
    box-shadow: 0 4px 16px rgb(0 0 0 / 30%);
  }

  .menu button {
    text-align: left;
    border-color: transparent;
  }
</style>
