<!-- Describes a drawn object (label and symbol or style) before it is shared with the group: a
     step of the drawing that must end, saved or cancelled, before anything else is done. -->
<script lang="ts">
  import { MARKER_LABEL_MAX_BYTES, SHAPE_LABEL_MAX_BYTES, utf8ByteLength } from '@tesel/protocol';

  import { UnencodableEvent } from '../events/event-log.ts';
  import type { Translate } from '../i18n/index.ts';
  import Dialog from '../ui/Dialog.svelte';
  import { Submission } from '../ui/submission.svelte.ts';
  import { areaStyles, SYMBOLS } from './catalog.ts';
  import { DRAFT_TITLES, type DraftKind } from './draft.ts';
  import SymbolIcon from './SymbolIcon.svelte';

  interface Props {
    t: Translate;
    kind: DraftKind;
    /** This device coordinates: its areas can mark the operation area. */
    coordinator: boolean;
    /** Saves the object; rejects if it does not fit in a radio message. */
    onsave: (code: number, label: string) => Promise<void>;
    oncancel: () => void;
  }

  let { t, kind, coordinator, onsave, oncancel }: Props = $props();

  const isMarker = $derived(kind === 'marker');
  const maxBytes = $derived(isMarker ? MARKER_LABEL_MAX_BYTES : SHAPE_LABEL_MAX_BYTES);

  let code = $state(0);
  let label = $state('');
  const submission = new Submission();
  const tooLong = $derived(utf8ByteLength(label.trim()) > maxBytes);
</script>

<Dialog title={t(DRAFT_TITLES[kind])} {oncancel}>
  <form
    class="stack"
    onsubmit={(event) => {
      event.preventDefault();
      void submission.run(() => onsave(code, label.trim()));
    }}
  >
    <fieldset>
      <legend>{isMarker ? t('symbol') : t('shapeType')}</legend>
      <div class="choices">
        {#if isMarker}
          {#each SYMBOLS as symbol (symbol.code)}
            <label class="choice">
              <input type="radio" name="code" value={symbol.code} bind:group={code} />
              <SymbolIcon code={symbol.code} size={30} />
              <span>{t(symbol.label)}</span>
            </label>
          {/each}
        {:else}
          {#each areaStyles(coordinator) as style (style.code)}
            <label class="choice">
              <input type="radio" name="code" value={style.code} bind:group={code} />
              <span class="swatch" style:--swatch="var(--tone-{style.tone})"></span>
              <span>{t(style.label)}</span>
            </label>
          {/each}
        {/if}
      </div>
    </fieldset>
    <label>
      {t('objectLabel')}
      <input bind:value={label} autocomplete="off" />
    </label>
    {#if tooLong}<p class="warning">{t('nameInvalid')}</p>{/if}
    {#if submission.failed}
      <p class="warning">
        {submission.failure instanceof UnencodableEvent ? t('objectTooBig') : t('sendFailed')}
      </p>
    {/if}
    <div class="row">
      <button type="submit" class="primary" disabled={submission.busy || tooLong}
        >{t('save')}</button
      >
      <button type="button" onclick={oncancel}>{t('cancel')}</button>
    </div>
  </form>
</Dialog>

<style>
  fieldset {
    margin: 0;
    padding: 0;
    border: none;
  }

  legend {
    margin-bottom: 0.4rem;
    padding: 0;
    font-size: var(--text-secondary);
  }

  .choices {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
    gap: 0.35rem;
  }

  .choice {
    position: relative;
    display: flex;
    gap: 0.5rem;
    align-items: center;
    padding: 0.35rem 0.5rem;
    font-size: var(--text-secondary);
    line-height: 1.2;
    cursor: pointer;
    border: 1px solid var(--border);
    border-radius: var(--radius-control);
  }

  .choice:has(input:checked) {
    font-weight: 600;
    border-color: var(--accent-line);
    box-shadow: inset 0 0 0 1px var(--accent-line);
  }

  .choice:has(input:focus-visible) {
    outline: 2px solid var(--accent-line);
    outline-offset: 2px;
  }

  /* The radio button is the whole card, invisible: it keeps keyboards, screen readers and taps
     working, and the frame shows the choice. */
  .choice input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    cursor: pointer;
    opacity: 0;
  }

  .swatch {
    flex-shrink: 0;
    width: 1.6rem;
    height: 0.9rem;
    background: color-mix(in srgb, var(--swatch) 25%, transparent);
    border: 2.5px solid var(--swatch);
    border-radius: 0.2rem;
  }
</style>
