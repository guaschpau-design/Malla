<!-- A point of the map, picked by a long press, found by its coordinates or tapped as a public
     service: where it is, how far from here, what else is known of it, and what can be done
     there. -->
<script lang="ts">
  import type { LatLon } from '@tesel/protocol';
  import type { Snippet } from 'svelte';

  import type { Locale, Translate } from '../i18n/index.ts';
  import FromHere from '../navigation/FromHere.svelte';
  import type { DeviceLocation } from '../position/device-location.svelte.ts';
  import type { Preference } from '../settings/preference.svelte.ts';
  import ActionButton from '../ui/ActionButton.svelte';
  import Panel from '../ui/Panel.svelte';
  import CoordinateBlock from './CoordinateBlock.svelte';
  import type { CoordinateFormat } from './coordinates.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    /** "Map point", or the name of the service tapped. */
    title: string;
    at: LatLon;
    location: DeviceLocation;
    format: Preference<CoordinateFormat>;
    onnavigate: () => void;
    onmeasure: () => void;
    /** Checks whether a radio here reaches another point. */
    onsight: () => void;
    /** Present when the point can be marked for the group. */
    onmark: (() => void) | null;
    /** Present when a task can be added there for the group. */
    ontask: (() => void) | null;
    onclose: () => void;
    /** What else is known of the point, such as the weather warnings there. */
    about?: Snippet;
  }

  let {
    t,
    locale,
    title,
    at,
    location,
    format,
    onnavigate,
    onmeasure,
    onsight,
    onmark,
    ontask,
    onclose,
    about,
  }: Props = $props();
</script>

<Panel {title} closeLabel={t('close')} {onclose}>
  <div class="stack section">
    <CoordinateBlock {t} {at} {format} />
    <FromHere {t} {locale} {at} {location} />
    {@render about?.()}
    <div class="row">
      <ActionButton icon="heading" label={t('guideMe')} onclick={onnavigate} />
      {#if onmark}<ActionButton icon="pin" label={t('markHere')} onclick={onmark} />{/if}
      {#if ontask}<ActionButton icon="task" label={t('taskHere')} onclick={ontask} />{/if}
      <ActionButton icon="ruler" label={t('measureFromHere')} onclick={onmeasure} />
      <ActionButton icon="mast" label={t('radioSight')} onclick={onsight} />
    </div>
  </div>
</Panel>
