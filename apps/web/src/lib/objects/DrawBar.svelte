<!-- Instructions and controls shown at the top while drawing. -->
<script lang="ts">
  import type { MessageKey, Translate } from '../i18n/index.ts';
  import MapCard from '../ui/MapCard.svelte';
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

<MapCard>
  <p>{t(HINTS[draft.kind])}</p>
  <div class="row">
    <button onclick={onundo} disabled={draft.points.length === 0}>{t('undo')}</button>
    {#if draft.kind === 'line' || draft.kind === 'area'}
      <button class="primary" onclick={onfinish} disabled={!isComplete(draft)}>{t('finish')}</button
      >
    {/if}
    <button onclick={oncancel}>{t('cancel')}</button>
  </div>
</MapCard>
