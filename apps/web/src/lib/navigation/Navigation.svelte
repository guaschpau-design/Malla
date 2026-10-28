<!-- Guides this device to the navigation target, or along it if it is a route: the GPS stays on, a
     line leads the way on the map and a card says how far and which way, with the button to stop.
     The card stays even while drawing or measuring, so the GPS never runs without saying why. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import type { NodeId, TaskEvent } from '@tesel/protocol';
  import type { Map as MapLibreMap } from 'maplibre-gl';

  import type { Locale, Translate } from '../i18n/index.ts';
  import { deviceLocation } from '../position/device-location.svelte.ts';
  import { stripOf, sweptBy } from '../objects/sweeps.ts';
  import { routeTaskOf } from '../tasks/tasks.ts';
  import { navigation, stopNavigating } from './navigation.svelte.ts';
  import PointGuide from './PointGuide.svelte';
  import RouteGuide from './RouteGuide.svelte';
  import { targetDestination } from './target.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    map: MapLibreMap;
    /** The active group's objects and positions, none without a group: targets may move. */
    objects: GroupState['objects'];
    positions: GroupState['positions'];
    /** The group's tasks: one of this device along a route can be marked done at its end. */
    tasks: GroupState['tasks'];
    /** The members' trails: this device's tells how much of a strip of a sweep it has swept. */
    trails: GroupState['trails'];
    /** This device in the active group, null without one. */
    self: NodeId | null;
    /** Marks a task done. */
    onfinishtask: (task: TaskEvent) => Promise<void>;
  }

  let { t, locale, map, objects, positions, tasks, trails, self, onfinishtask }: Props = $props();

  const target = $derived(navigation.target);
  const destination = $derived(target && targetDestination(target, { objects, positions }));
  /** How much of a strip of a sweep followed this device has swept, from its own trail. */
  const swept = $derived.by(() => {
    const record = target?.kind === 'object' ? objects.get(target.key) : undefined;
    const strip = record?.type === 'sweep' ? stripOf(record, objects) : null;
    return strip && self !== null ? sweptBy(strip, trails, self) : null;
  });

  $effect(() => {
    if (target !== null) return deviceLocation.use();
  });
</script>

{#if target}
  {#if destination?.kind === 'route'}
    <RouteGuide
      {t}
      {locale}
      {map}
      name={target.name}
      points={destination.points}
      fix={deviceLocation.fix}
      {swept}
      task={target.kind === 'object' && self !== null ? routeTaskOf(tasks, target.key, self) : null}
      {onfinishtask}
      onstop={stopNavigating}
    />
  {:else}
    <PointGuide
      {t}
      {locale}
      {map}
      name={target.name}
      to={destination?.at ?? null}
      fix={deviceLocation.fix}
      onstop={stopNavigating}
    />
  {/if}
{/if}
