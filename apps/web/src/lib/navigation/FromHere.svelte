<!-- How far a point is from this device and which way, with a button to be guided there. -->
<script lang="ts">
  import type { LatLon } from '@tesel/protocol';

  import { formatBearing, formatDistance } from '../format.ts';
  import type { Locale, Translate } from '../i18n/index.ts';
  import type { DeviceLocation } from '../position/device-location.svelte.ts';
  import { legBetween } from './leg.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    at: LatLon;
    location: DeviceLocation;
    onnavigate: () => void;
  }

  let { t, locale, at, location, onnavigate }: Props = $props();

  const leg = $derived(location.fix && legBetween(location.fix.at, at));
</script>

<div class="row from-here">
  {#if leg}
    <p>
      {t('fromHere', {
        distance: formatDistance(leg.metres, locale),
        bearing: formatBearing(leg.bearing, locale),
      })}
    </p>
  {/if}
  <button onclick={onnavigate}>{t('navigateHere')}</button>
</div>

<style>
  .from-here {
    align-items: center;
    justify-content: space-between;
  }

  p {
    margin: 0;
    font-variant-numeric: tabular-nums;
  }
</style>
