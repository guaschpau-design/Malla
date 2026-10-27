<!-- First launch: the user picks an alias and the device creates its identity. -->
<script lang="ts">
  import { ALIAS_MAX_BYTES } from '@tesel/protocol';

  import type { Translate } from '../i18n/index.ts';
  import Dialog from '../ui/Dialog.svelte';
  import { normalizeAlias } from './identity.ts';
  import { Submission } from '../ui/submission.svelte.ts';

  interface Props {
    t: Translate;
    /** Name of the group the user was invited to, if they arrived through an invitation. */
    invitedTo: string | null;
    oncreate: (alias: string) => Promise<void>;
  }

  let { t, invitedTo, oncreate }: Props = $props();

  let text = $state('');
  const submission = new Submission();
  const alias = $derived(normalizeAlias(text));
  const tooLong = $derived(text.trim() !== '' && alias === null);

  function submit(): void {
    const chosen = alias;
    if (chosen !== null) void submission.run(() => oncreate(chosen));
  }
</script>

<Dialog title={t('welcomeTitle')}>
  <form
    class="stack"
    onsubmit={(event) => {
      event.preventDefault();
      submit();
    }}
  >
    <p class="intro">{t('welcomeIntro')}</p>
    {#if invitedTo !== null}
      <p>{t('invitedTo', { group: invitedTo })}</p>
    {/if}
    <label>
      {t('aliasLabel')}
      <!-- The dialog holds nothing else to type in, so focusing the field helps. -->
      <!-- svelte-ignore a11y_autofocus -->
      <input bind:value={text} maxlength={ALIAS_MAX_BYTES} autocomplete="nickname" autofocus />
    </label>
    <p class:warning={tooLong} class:hint={!tooLong}>
      {tooLong ? t('nameInvalid') : t('aliasHint')}
    </p>
    {#if submission.failed}<p class="warning">{t('actionFailed')}</p>{/if}
    <button type="submit" class="primary" disabled={alias === null || submission.busy}>
      {t('continue')}
    </button>
  </form>
</Dialog>
