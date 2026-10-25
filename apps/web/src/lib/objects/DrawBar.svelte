<!-- Instructions and controls shown at the top while drawing. -->
<script lang="ts">
  import type { MessageKey, Translate } from '../i18n/index.ts';
  import { isComplete, type Draft, type DraftKind } from './draft.ts';

  interface Props {
    t: Translate;
    draft: Draft;
    onundo: () => void;
    onfinish: () => void;
    oncancel: () => void;
  }

  let { t, draft, onundo, onfinish, oncancel }: Props = $props();

  const HINTS: Readonly<Record<DraftKind, MessageKey>> = {
    marker: 'drawHintMarker',
    line: 'drawHintLine',
    area: 'drawHintArea',
    circle: 'drawHintCircle',
  };
</script>

<div class="draw-bar" role="status">
  <p>{t(HINTS[draft.kind])}</p>
  <div class="row">
    <button onclick={onundo} disabled={draft.points.length === 0}>{t('undo')}</button>
    {#if draft.kind === 'line' || draft.kind === 'area'}
      <button class="primary" onclick={onfinish} disabled={!isComplete(draft)}>{t('finish')}</button
      >
    {/if}
    <button onclick={oncancel}>{t('cancel')}</button>
  </div>
</div>

<style>
  .draw-bar {
    position: absolute;
    z-index: 2;
    top: 0.75rem;
    right: 0.75rem;
    left: 0.75rem;
    display: grid;
    gap: 0.5rem;
    max-width: 30rem;
    margin: 0 auto;
    padding: 0.75rem;
    color: var(--fg);
    background: var(--surface);
    border-radius: 0.75rem;
    box-shadow: 0 4px 16px rgb(0 0 0 / 25%);
  }

  p {
    margin: 0;
  }
</style>
