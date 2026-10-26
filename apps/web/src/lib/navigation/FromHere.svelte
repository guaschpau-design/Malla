<!-- How far a point is from this device and which way, while the GPS knows where it is. -->
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
  }

  let { t, locale, at, location }: Props = $props();

  const leg = $derived(location.fix && legBetween(location.fix.at, at));
</script>

{#if leg}
  <p class="from-here">
    {t('fromHere', {
      distance: formatDistance(leg.metres, locale),
      bearing: formatBearing(leg.bearing, locale),
    })}
  </p>
{/if}

<style>
  .from-here {
    margin: 0;
    font-variant-numeric: tabular-nums;
  }
</style>
