<!-- Guides this device to the navigation target: the GPS stays on, a line leads there on the map
     and a card says how far and which way, with the button to stop. The card stays even while
     drawing or measuring, so the GPS never runs without saying why. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import type { Map as MapLibreMap } from 'maplibre-gl';

  import type { Locale, Translate } from '../i18n/index.ts';
  import { deviceLocation } from '../position/device-location.svelte.ts';
  import NavigationBar from './NavigationBar.svelte';
  import NavigationLayer from './NavigationLayer.svelte';
  import { navigation, stopNavigating } from './navigation.svelte.ts';
  import { targetPosition } from './target.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    map: MapLibreMap;
    /** The active group's objects and positions, none without a group: targets may move. */
    objects: GroupState['objects'];
    positions: GroupState['positions'];
  }

  let { t, locale, map, objects, positions }: Props = $props();

  const target = $derived(navigation.target);
  const at = $derived(target && targetPosition(target, { objects, positions }));

  $effect(() => {
    if (target !== null) return deviceLocation.use();
  });
</script>

{#if target}
  <NavigationLayer {map} from={deviceLocation.fix?.at ?? null} to={at} />
  <NavigationBar
    {t}
    {locale}
    {map}
    name={target.name}
    target={at}
    fix={deviceLocation.fix}
    onstop={stopNavigating}
  />
{/if}
