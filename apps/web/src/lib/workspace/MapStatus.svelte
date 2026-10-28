<!-- The top of the map, in order of what needs attention first: the tool in use (drawing,
     measuring), the incidents, a danger area entered, guidance, a practice, weather where this
     device is, the operation area's map, then the app's notices. The stack never runs under the
     dock: past its height it scrolls. -->
<script lang="ts">
  import type { EventRef, LatLon } from '@tesel/protocol';
  import type { Map as MapLibreMap } from 'maplibre-gl';

  import type { Locale, Translate } from '../i18n/index.ts';
  import IncidentBanners from '../incidents/IncidentBanners.svelte';
  import { mapCentre } from '../map/geometry.ts';
  import Measuring from '../measure/Measuring.svelte';
  import Navigation from '../navigation/Navigation.svelte';
  import DangerZoneAlert from '../objects/DangerZoneAlert.svelte';
  import DrawBar from '../objects/DrawBar.svelte';
  import type { Drawing } from '../objects/drawing.svelte.ts';
  import DrawLayer from '../objects/DrawLayer.svelte';
  import type { OfflineMaps } from '../offline/offline-maps.ts';
  import OperationAreaOffer from '../offline/OperationAreaOffer.svelte';
  import type { DeviceLocation } from '../position/device-location.svelte.ts';
  import Practice from '../practice/Practice.svelte';
  import Notices from '../ui/Notices.svelte';
  import { attempt } from '../ui/submission.svelte.ts';
  import WeatherCard from '../weather/WeatherCard.svelte';
  import type { WeatherFeed } from '../weather/weather-feed.svelte.ts';
  import type { MapTool, WorkspaceGroup } from './workspace.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    map: MapLibreMap;
    location: DeviceLocation;
    group: WorkspaceGroup | null;
    drawing: Drawing;
    tool: MapTool | null;
    /** Drawing or a tool takes taps on the map: incidents and offers wait. */
    tapping: boolean;
    /** Weather warnings, while their layer is shown. */
    weather: WeatherFeed | null;
    offline: OfflineMaps;
    onclosetool: () => void;
    onendpractice: () => void;
    /** Answers a roll call with "I need help": opens the SOS dialog. */
    onneedhelp: () => void;
  }

  let {
    t,
    locale,
    map,
    location,
    group,
    drawing,
    tool,
    tapping,
    weather,
    offline,
    onclosetool,
    onendpractice,
    onneedhelp,
  }: Props = $props();

  function show(at: LatLon): void {
    map.flyTo({ center: [at.lon, at.lat], zoom: Math.max(map.getZoom(), 15) });
  }

  function acknowledge(target: EventRef): void {
    const feed = group?.feed;
    if (feed) attempt(() => feed.acknowledge(target), t('actionFailed'));
  }

  function cancelSos(sos: EventRef): void {
    const feed = group?.feed;
    if (feed) attempt(() => feed.cancelSos(sos), t('actionFailed'));
  }
</script>

<div class="top">
  {#if drawing.draft && drawing.tapping}
    <DrawLayer
      {map}
      points={drawing.draft.points}
      closed={drawing.draft.kind === 'area'}
      onpoint={(at: LatLon) => {
        drawing.add(at);
      }}
    />
    <DrawBar
      {t}
      draft={drawing.draft}
      onundo={() => {
        drawing.undo();
      }}
      onfinish={() => {
        drawing.finish();
      }}
      oncancel={() => {
        drawing.stop();
      }}
    />
  {:else if tool?.kind === 'measure'}
    <Measuring {t} {locale} {map} from={tool.from} onclose={onclosetool} />
  {/if}
  {#if group && !tapping}
    <IncidentBanners
      {t}
      {locale}
      groupState={group.feed.state}
      self={group.self}
      canCancelOthers={group.role === 'coordinator'}
      undelivered={group.feed.undelivered}
      onacknowledge={acknowledge}
      oncancel={cancelSos}
      onshow={show}
      {onneedhelp}
    />
  {/if}
  {#if group}
    <DangerZoneAlert {t} groupState={group.feed.state} {location} />
  {/if}
  <Navigation {t} {locale} {map} {location} groupState={group?.feed.state ?? null} />
  {#if group?.practice}
    {#key group.feed}
      <Practice
        {t}
        feed={group.feed}
        self={group.self}
        centre={location.fix?.at ?? mapCentre(map)}
        onend={onendpractice}
      />
    {/key}
  {/if}
  {#if weather && !tapping}
    <WeatherCard {t} {locale} {weather} {location} />
  {/if}
  {#if group && !tapping}
    {#key group.feed}
      <OperationAreaOffer {t} {locale} groupState={group.feed.state} {offline} />
    {/key}
  {/if}
  <Notices {t} />
</div>

<style>
  /* Clear of the map's controls on the right: one control wide, with MapLibre's 10 px margin; and
     of a notch on either side when the phone is held sideways. */
  .top {
    position: absolute;
    z-index: var(--layer-status);
    top: 0.75rem;
    right: calc(var(--control-size) + 1.25rem + env(safe-area-inset-right));
    left: max(0.75rem, env(safe-area-inset-left));
    display: grid;
    align-content: start;
    gap: 0.5rem;
    max-width: 30rem;
    max-height: calc(100% - 0.75rem - var(--dock-clearance));
    margin: 0 auto;
    overflow-y: auto;
    overscroll-behavior: contain;
    pointer-events: none;
  }
</style>
