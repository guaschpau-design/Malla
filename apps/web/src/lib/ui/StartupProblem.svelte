<!-- Why the app cannot start, with what to do about it, instead of an empty screen: its storage is
     held by another window of Tesel, was handed to a newer version in another window, or cannot
     be opened at all (private browsing in some browsers, a full disk). -->
<script lang="ts">
  import type { MessageKey, Translate } from '../i18n/index.ts';
  import type { StartupFailure } from '../storage/version-change.ts';
  import Dialog from './Dialog.svelte';

  let { t, failure }: { t: Translate; failure: StartupFailure } = $props();

  const TEXTS: Readonly<Record<StartupFailure, MessageKey>> = {
    blocked: 'startupBlocked',
    replaced: 'startupReplaced',
    failed: 'startupFailed',
  };
</script>

<Dialog title={t('startupProblem')}>
  <div class="stack">
    <p>{t(TEXTS[failure])}</p>
    <div class="row">
      <button
        class="primary"
        onclick={() => {
          window.location.reload();
        }}>{t('reload')}</button
      >
    </div>
  </div>
</Dialog>
