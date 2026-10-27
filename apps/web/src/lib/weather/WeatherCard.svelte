<!-- The official weather warnings where this device is, on top of the map while the GPS knows
     where that is. Closing it hides those warnings until a new one arrives. -->
<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';

  import type { Locale, Translate } from '../i18n/index.ts';
  import type { DeviceLocation } from '../position/device-location.svelte.ts';
  import MapCard from '../ui/MapCard.svelte';
  import WarningList from './WarningList.svelte';
  import type { WeatherFeed } from './weather-feed.svelte.ts';
  import { WARNING_LOOKS, warningsAt } from './weather-warnings.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    weather: WeatherFeed;
    location: DeviceLocation;
  }

  let { t, locale, weather, location }: Props = $props();

  /** Warnings closed on this device, by what tells one apart. */
  const dismissed = new SvelteSet<string>();
  const here = $derived(location.fix ? warningsAt(weather.regions, location.fix.at) : []);
  const keys = $derived(here.map((w) => `${w.level}:${w.onset}:${w.expires}`));
  const shown = $derived(keys.some((key) => !dismissed.has(key)));
</script>

{#if shown && here[0]}
  <!-- The highest level here, first in the list, colours the card's edge. -->
  <MapCard edge="var(--tone-{WARNING_LOOKS[here[0].level].tone})">
    <strong>{t('weatherHere')}</strong>
    <WarningList {t} {locale} warnings={here} source={weather.source} />
    <div class="row">
      <button
        onclick={() => {
          for (const key of keys) dismissed.add(key);
        }}>{t('close')}</button
      >
    </div>
  </MapCard>
{/if}
