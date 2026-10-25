<script lang="ts">
  import { onMount } from 'svelte';
  import { registerSW } from 'virtual:pwa-register';

  import type { Translate } from '../i18n/index.ts';

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
  <div class="toast" role="status">
    <span>{t('updateAvailable')}</span>
    <button class="primary" onclick={() => updateServiceWorker?.(true)}>{t('update')}</button>
  </div>
{:else if offlineReady}
  <div class="toast" role="status">{t('readyOffline')}</div>
{/if}

<style>
  .toast {
    position: absolute;
    z-index: 3;
    top: 4rem;
    left: 50%;
    display: flex;
    gap: 0.75rem;
    align-items: center;
    padding: 0.6rem 0.9rem;
    color: var(--fg);
    background: var(--surface);
    border-radius: 0.75rem;
    box-shadow: 0 4px 16px rgb(0 0 0 / 25%);
    transform: translateX(-50%);
  }
</style>
