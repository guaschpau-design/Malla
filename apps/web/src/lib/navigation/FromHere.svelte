<!-- How far a point is from this device and which way, while the GPS knows where it is; and,
     with the relief on, how much the way climbs. -->
<script lang="ts">
  import type { LatLon } from '@tesel/protocol';

  import { formatBearing, formatDistance } from '../format.ts';
  import type { Locale, Translate } from '../i18n/index.ts';
  import { deviceLocation } from '../position/device-location.svelte.ts';
  import ClimbLine from '../terrain/ClimbLine.svelte';
  import { terrain } from '../terrain/terrain.svelte.ts';
  import { legBetween } from './leg.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    at: LatLon;
  }

  let { t, locale, at }: Props = $props();

  const leg = $derived(deviceLocation.fix && legBetween(deviceLocation.fix.at, at));
</script>

{#if leg && deviceLocation.fix}
  <p class="from-here">
    {t('fromHere', {
      distance: formatDistance(leg.metres, locale),
      bearing: formatBearing(leg.bearing, locale),
    })}
  </p>
  {#if terrain.reader}
    <ClimbLine {t} from={deviceLocation.fix.at} to={at} terrain={terrain.reader} />
  {/if}
{/if}

<style>
  .from-here {
    margin: 0;
    font-variant-numeric: tabular-nums;
  }
</style>
