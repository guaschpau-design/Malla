<!-- First launch: the user picks an alias and the device creates its identity. -->
<script lang="ts">
  import type { Translate } from '../i18n/index.ts';
  import Dialog from '../ui/Dialog.svelte';
  import { Submission } from '../ui/submission.svelte.ts';
  import AliasField from './AliasField.svelte';
  import { normalizeAlias } from './identity.ts';

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
    <AliasField {t} {text} ontext={(typed: string) => (text = typed)} />
    {#if submission.failed}<p class="warning">{t('actionFailed')}</p>{/if}
    <button type="submit" class="primary" disabled={alias === null || submission.busy}>
      {t('continue')}
    </button>
  </form>
</Dialog>
