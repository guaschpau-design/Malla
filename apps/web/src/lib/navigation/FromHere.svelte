<!-- How far a point is from this device and which way, and, with the relief on, how much the way
     climbs. While shown, it keeps the GPS on if the user has already let the app use it: it never
     asks for the permission by itself, as opening a point is not asking to be located. -->
<script lang="ts">
  import type { LatLon } from '@tesel/protocol';
  import { onMount } from 'svelte';

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

  onMount(() => {
    let release: (() => void) | null = null;
    let gone = false;
    void navigator.permissions
      .query({ name: 'geolocation' })
      .then((status) => {
        if (!gone && status.state === 'granted') release = deviceLocation.use();
      })
      .catch(() => undefined);
    return () => {
      gone = true;
      release?.();
    };
  });

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
