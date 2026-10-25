<!-- First launch: the user picks an alias and the device creates its identity. -->
<script lang="ts">
  import { ALIAS_MAX_BYTES } from '@malla/protocol';

  import type { Translate } from '../i18n/index.ts';
  import Dialog from '../ui/Dialog.svelte';
  import { normalizeAlias } from './identity.ts';

  interface Props {
    t: Translate;
    /** Name of the group the user was invited to, if they arrived through an invitation. */
    invitedTo: string | null;
    oncreate: (alias: string) => Promise<void>;
  }

  let { t, invitedTo, oncreate }: Props = $props();

  let text = $state('');
  let busy = $state(false);
  const alias = $derived(normalizeAlias(text));
  const tooLong = $derived(text.trim() !== '' && alias === null);

  async function submit(): Promise<void> {
    if (alias === null) return;
    busy = true;
    try {
      await oncreate(alias);
    } finally {
      busy = false;
    }
  }
</script>

<Dialog title={t('welcomeTitle')}>
  <form
    class="stack"
    onsubmit={(event) => {
      event.preventDefault();
      void submit();
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
    <button type="submit" class="primary" disabled={alias === null || busy}>
      {t('continue')}
    </button>
  </form>
</Dialog>
