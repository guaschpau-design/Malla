<!-- A card on the map while this device does not show itself to its group: the team cannot see
     where it is, which the person may not know. One button shares the position; "Not now" leaves
     it be until the app opens again. While sharing, it says so if the browser refuses the
     location, as nothing reaches the group then either. -->
<script lang="ts">
  import type { Translate } from '../i18n/index.ts';
  import MapCard from '../ui/MapCard.svelte';
  import { attempt } from '../ui/submission.svelte.ts';
  import { deviceLocation } from './device-location.svelte.ts';
  import type { PositionSharing } from './position-sharing.svelte.ts';

  interface Props {
    t: Translate;
    sharing: PositionSharing;
  }

  let { t, sharing }: Props = $props();

  let later = $state(false);

  const shown = $derived(
    !later && (sharing.mode !== 'sharing' || deviceLocation.problem === 'denied'),
  );
</script>

{#if shown}
  <MapCard label={t('shareTitle')} edge="var(--warning)">
    {#if sharing.mode === 'sharing'}
      <p>{t('locationDenied')}</p>
      <div class="row">
        <button onclick={() => (later = true)}>{t('close')}</button>
      </div>
    {:else}
      <p><strong>{t('shareTitle')}</strong> · {t('shareHint')}</p>
      <div class="row">
        <button
          class="primary"
          onclick={() => {
            attempt(() => sharing.setMode('sharing'), t('actionFailed'));
          }}>{t('share')}</button
        >
        <button onclick={() => (later = true)}>{t('notNow')}</button>
      </div>
    {/if}
  </MapCard>
{/if}
