<!-- A point of the map: its coordinates, picked by a long press or typed in as dictated. -->
<script lang="ts">
  import type { LatLon } from '@tesel/protocol';

  import type { Locale, Translate } from '../i18n/index.ts';
  import FromHere from '../navigation/FromHere.svelte';
  import type { DeviceLocation } from '../position/device-location.svelte.ts';
  import type { Preference } from '../settings/preference.svelte.ts';
  import Panel from '../ui/Panel.svelte';
  import CoordinateBlock from './CoordinateBlock.svelte';
  import { parseCoordinate, type CoordinateFormat } from './coordinates.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    point: LatLon | null;
    location: DeviceLocation;
    format: Preference<CoordinateFormat>;
    /** A typed coordinate was read: show it. */
    onfind: (at: LatLon) => void;
    /** Present when the point can be marked for the group. */
    onmark: ((at: LatLon) => void) | null;
    onnavigate: (at: LatLon) => void;
    onclose: () => void;
  }

  let { t, locale, point, location, format, onfind, onmark, onnavigate, onclose }: Props = $props();

  let typed = $state('');
  let unreadable = $state(false);

  function find(event: SubmitEvent): void {
    event.preventDefault();
    const found = parseCoordinate(typed);
    unreadable = found === null;
    if (found) onfind(found);
  }
</script>

<Panel title={t('coordinates')} closeLabel={t('close')} {onclose}>
  <div class="stack section">
    {#if point}
      {@const at = point}
      <CoordinateBlock {t} {at} {format} />
      <FromHere
        {t}
        {locale}
        {at}
        {location}
        onnavigate={() => {
          onnavigate(at);
        }}
      />
      {#if onmark}
        <div class="row">
          <button
            onclick={() => {
              onmark(at);
            }}>{t('markHere')}</button
          >
        </div>
      {/if}
    {:else}
      <p class="intro">{t('coordinatesIntro')}</p>
    {/if}

    <form class="stack" onsubmit={find}>
      <label>
        {t('findCoordinate')}
        <input
          bind:value={typed}
          oninput={() => (unreadable = false)}
          placeholder="30S 725695 4372210"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
        />
      </label>
      {#if unreadable}<p class="warning">{t('coordinateUnreadable')}</p>{/if}
      <div class="row">
        <button type="submit" disabled={typed.trim() === ''}>{t('find')}</button>
      </div>
    </form>
  </div>
</Panel>
