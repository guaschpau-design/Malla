<!-- The question of confirmations.svelte.ts shown now, if any: going back is the first button, and
     what Escape does, so that nothing is lost by a key pressed in haste. -->
<script lang="ts">
  import type { Translate } from '../i18n/index.ts';
  import { confirmations } from './confirmations.svelte.ts';
  import Dialog from './Dialog.svelte';

  let { t }: { t: Translate } = $props();

  function back(): void {
    confirmations.answer(false);
  }

  function goAhead(): void {
    confirmations.answer(true);
  }
</script>

{#if confirmations.current}
  {@const question = confirmations.current}
  {#key question.id}
    <Dialog title={question.text} oncancel={back}>
      <div class="row">
        <button onclick={back}>{t('back')}</button>
        <button class="danger" onclick={goAhead}>{question.confirm}</button>
      </div>
    </Dialog>
  {/key}
{/if}

<style>
  .row {
    justify-content: flex-end;
  }
</style>
