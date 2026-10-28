<!-- The official weather warnings where this device is, on top of the map while the GPS knows
     where that is. Closing it hides those warnings until a new one arrives. -->
<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';

  import type { Locale, Translate } from '../i18n/index.ts';
  import { deviceLocation } from '../position/device-location.svelte.ts';
  import MapCard from '../ui/MapCard.svelte';
  import WarningList from './WarningList.svelte';
  import type { WeatherFeed } from './weather-feed.svelte.ts';
  import { WARNING_LOOKS, warningsAt } from './weather-warnings.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    weather: WeatherFeed;
  }

  let { t, locale, weather }: Props = $props();

  /** Warnings closed on this device, by what tells one apart. */
  const dismissed = new SvelteSet<string>();
  const here = $derived(
    deviceLocation.fix ? warningsAt(weather.regions, deviceLocation.fix.at) : null,
  );
  const keys = $derived(here?.warnings.map((w) => `${w.level}:${w.onset}:${w.expires}`) ?? []);
  const shown = $derived(keys.some((key) => !dismissed.has(key)));
</script>

{#if shown && here?.warnings[0]}
  <!-- The highest level here, first in the list, colours the card's edge. -->
  {@const tone = WARNING_LOOKS[here.warnings[0].level].tone}
  <MapCard label={t('weatherHere')} edge="var(--tone-{tone})">
    <strong>{t('weatherHere')}</strong>
    <WarningList {t} {locale} {here} source={weather.source} />
    <div class="row">
      <button
        onclick={() => {
          for (const key of keys) dismissed.add(key);
        }}>{t('close')}</button
      >
    </div>
  </MapCard>
{/if}
