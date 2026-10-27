<!-- First launch: the user picks an alias and the device creates its identity. In a browser tab
     that can, it also asks whether to show the app over the whole screen. -->
<script lang="ts">
  import { ALIAS_MAX_BYTES } from '@tesel/protocol';

  import type { Translate } from '../i18n/index.ts';
  import type { Preference } from '../settings/preference.svelte.ts';
  import Dialog from '../ui/Dialog.svelte';
  import { enterFullscreen } from '../ui/fullscreen.svelte.ts';
  import Pictogram from '../ui/Pictogram.svelte';
  import Switch from '../ui/Switch.svelte';
  import { normalizeAlias } from './identity.ts';

  interface Props {
    t: Translate;
    /** Name of the group the user was invited to, if they arrived through an invitation. */
    invitedTo: string | null;
    /** Full screen in a browser tab, where it can be: null where it cannot. */
    fullscreen: Preference<boolean> | null;
    oncreate: (alias: string) => Promise<void>;
  }

  let { t, invitedTo, fullscreen, oncreate }: Props = $props();

  let text = $state('');
  let wantsFullscreen = $state(false);
  let busy = $state(false);
  const alias = $derived(normalizeAlias(text));
  const tooLong = $derived(text.trim() !== '' && alias === null);

  async function submit(): Promise<void> {
    if (alias === null) return;
    // Now, while the tap that sent the form lets the browser go full screen.
    if (fullscreen !== null) {
      if (wantsFullscreen) enterFullscreen();
      void fullscreen.set(wantsFullscreen);
    }
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
    {#if fullscreen !== null}
      <button
        type="button"
        class="option"
        role="switch"
        aria-checked={wantsFullscreen}
        onclick={() => (wantsFullscreen = !wantsFullscreen)}
      >
        <Pictogram name="fullscreen" size={20} />
        <span>{t('fullscreen')}<small>{t('fullscreenHint')}</small></span>
        <Switch on={wantsFullscreen} />
      </button>
    {/if}
    <button type="submit" class="primary" disabled={alias === null || busy}>
      {t('continue')}
    </button>
  </form>
</Dialog>

<style>
  /* An on/off choice, laid out like the switches of the layers panel. */
  .option {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 0.75rem;
    align-items: center;
    padding: 0.55rem 0.4rem;
    text-align: left;
    border-color: transparent;
  }

  .option small {
    display: block;
    color: var(--muted);
    font-size: var(--text-small);
  }
</style>
