<!-- A point of the map, picked by a long press or found by its coordinates: where it is, how far
     from here, and what can be done there. -->
<script lang="ts">
  import type { LatLon } from '@tesel/protocol';

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
    at: LatLon;
    location: DeviceLocation;
    format: Preference<CoordinateFormat>;
    onnavigate: () => void;
    onmeasure: () => void;
    /** Present when the point can be marked for the group. */
    onmark: (() => void) | null;
    /** Present when a task can be added there for the group. */
    ontask: (() => void) | null;
    onclose: () => void;
  }

  let { t, locale, at, location, format, onnavigate, onmeasure, onmark, ontask, onclose }: Props =
    $props();
</script>

<Panel title={t('mapPoint')} closeLabel={t('close')} {onclose}>
  <div class="stack section">
    <CoordinateBlock {t} {at} {format} />
    <FromHere {t} {locale} {at} {location} />
    <div class="row">
      <ActionButton icon="heading" label={t('guideMe')} onclick={onnavigate} />
      {#if onmark}<ActionButton icon="pin" label={t('markHere')} onclick={onmark} />{/if}
      {#if ontask}<ActionButton icon="task" label={t('taskHere')} onclick={ontask} />{/if}
      <ActionButton icon="ruler" label={t('measureFromHere')} onclick={onmeasure} />
    </div>
  </div>
</Panel>
