<script lang="ts">
  import { onMount } from 'svelte';
  import { registerSW } from 'virtual:pwa-register';

  import type { Translate } from '../i18n/index.ts';
  import Toast from '../ui/Toast.svelte';

  let { t }: { t: Translate } = $props();

  let needRefresh = $state(false);
  let offlineReady = $state(false);
  let updateServiceWorker: ((reload?: boolean) => Promise<void>) | undefined;

  onMount(() => {
    // Updates wait for the user: reloading by surprise in the middle of an incident is worse
    // than running a slightly older version.
    updateServiceWorker = registerSW({
      onNeedRefresh: () => (needRefresh = true),
      onOfflineReady: () => {
        offlineReady = true;
        setTimeout(() => (offlineReady = false), 5000);
      },
    });
  });
</script>

{#if needRefresh}
  <Toast>
    <span>{t('updateAvailable')}</span>
    <button class="primary" onclick={() => updateServiceWorker?.(true)}>{t('update')}</button>
  </Toast>
{:else if offlineReady}
  <Toast>{t('readyOffline')}</Toast>
{/if}
