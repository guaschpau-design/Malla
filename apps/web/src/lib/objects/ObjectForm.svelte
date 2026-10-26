<!-- Describes a drawn object (label and symbol or style) before it is shared with the group. -->
<script lang="ts">
  import { MARKER_LABEL_MAX_BYTES, SHAPE_LABEL_MAX_BYTES, utf8ByteLength } from '@tesel/protocol';

  import type { MessageKey, Translate } from '../i18n/index.ts';
  import Panel from '../ui/Panel.svelte';
  import { SHAPE_STYLES, SYMBOLS } from './catalog.ts';
  import type { DraftKind } from './draft.ts';

  interface Props {
    t: Translate;
    kind: DraftKind;
    /** Saves the object; rejects if it does not fit in a radio message. */
    onsave: (code: number, label: string) => Promise<void>;
    oncancel: () => void;
  }

  let { t, kind, onsave, oncancel }: Props = $props();

  const TITLES: Readonly<Record<DraftKind, MessageKey>> = {
    marker: 'newMarker',
    line: 'newLine',
    area: 'newArea',
    circle: 'newCircle',
  };

  const isMarker = $derived(kind === 'marker');
  const maxBytes = $derived(isMarker ? MARKER_LABEL_MAX_BYTES : SHAPE_LABEL_MAX_BYTES);

  let code = $state(0);
  let label = $state('');
  let failed = $state(false);
  let busy = $state(false);
  const tooLong = $derived(utf8ByteLength(label.trim()) > maxBytes);

  async function save(): Promise<void> {
    busy = true;
    failed = false;
    try {
      await onsave(code, label.trim());
    } catch (error) {
      console.warn('Object not saved', error);
      failed = true;
    } finally {
      busy = false;
    }
  }
</script>

<Panel title={t(TITLES[kind])} closeLabel={t('close')} onclose={oncancel}>
  <form
    class="stack section"
    onsubmit={(event) => {
      event.preventDefault();
      void save();
    }}
  >
    <label>
      {isMarker ? t('symbol') : t('shapeType')}
      <select bind:value={code}>
        {#if isMarker}
          {#each SYMBOLS as symbol (symbol.code)}
            <option value={symbol.code}>{symbol.emoji} {t(symbol.label)}</option>
          {/each}
        {:else}
          {#each SHAPE_STYLES as style (style.code)}
            <option value={style.code}>{t(style.label)}</option>
          {/each}
        {/if}
      </select>
    </label>
    <label>
      {t('objectLabel')}
      <input bind:value={label} autocomplete="off" />
    </label>
    {#if tooLong}<p class="warning">{t('nameInvalid')}</p>{/if}
    {#if failed}<p class="warning">{t('objectTooBig')}</p>{/if}
    <div class="row">
      <button type="submit" class="primary" disabled={busy || tooLong}>{t('save')}</button>
      <button type="button" onclick={oncancel}>{t('cancel')}</button>
    </div>
  </form>
</Panel>
