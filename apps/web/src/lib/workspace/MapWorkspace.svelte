<!--
  Everything on top of the map: this device, the group's members, objects and incidents, drawing,
  measuring and navigating, the panels and the toolbar. Without an active group, only what works
  alone: this device, coordinates, measuring, navigating to a point and offline maps.
-->
<script lang="ts">
  import type { AlertLevel, EventRef, LatLon, NodeId, Role, SosKind } from '@tesel/protocol';
  import type { Map as MapLibreMap } from 'maplibre-gl';

  import { onMount } from 'svelte';

  import ChatPanel from '../chat/ChatPanel.svelte';
  import CoordinatesPanel from '../coordinates/CoordinatesPanel.svelte';
  import PointLayer from '../coordinates/PointLayer.svelte';
  import type { Locale, Translate } from '../i18n/index.ts';
  import MemberDetails from '../groups/MemberDetails.svelte';
  import IncidentBanners from '../incidents/IncidentBanners.svelte';
  import SosDialog from '../incidents/SosDialog.svelte';
  import { onLongPress } from '../map/long-press.ts';
  import MemberLayer from '../map/MemberLayer.svelte';
  import Measuring from '../measure/Measuring.svelte';
  import Navigation from '../navigation/Navigation.svelte';
  import { navigateTo } from '../navigation/navigation.svelte.ts';
  import { draftGeometry, type DraftKind } from '../objects/draft.ts';
  import DrawBar from '../objects/DrawBar.svelte';
  import { Drawing } from '../objects/drawing.svelte.ts';
  import DrawLayer from '../objects/DrawLayer.svelte';
  import ObjectDetails from '../objects/ObjectDetails.svelte';
  import ObjectForm from '../objects/ObjectForm.svelte';
  import ObjectLayer from '../objects/ObjectLayer.svelte';
  import type { DeviceLocation } from '../position/device-location.svelte.ts';
  import LocateControl from '../position/LocateControl.svelte';
  import SelfLayer from '../position/SelfLayer.svelte';
  import type { RadioSession } from '../radio/radio.svelte.ts';
  import type { PositionSharing } from '../position/position-sharing.svelte.ts';
  import type { Preferences } from '../settings/preferences.ts';
  import type { GroupFeed } from '../sync/group-feed.svelte.ts';
  import Toast from '../ui/Toast.svelte';
  import { closePanel, panels } from '../ui/panels.svelte.ts';
  import Toolbar from './Toolbar.svelte';

  interface Props {
    t: Translate;
    locale: Locale;
    map: MapLibreMap;
    /** The active group's feed and this device's place in it, when there is an active group. */
    group: { feed: GroupFeed; self: NodeId; role: Role; sharing: PositionSharing } | null;
    radio: RadioSession;
    location: DeviceLocation;
    preferences: Preferences;
  }

  let { t, locale, map, group, radio, location, preferences }: Props = $props();

  const drawing = new Drawing();
  let measuring = $state(false);
  /** Drawing or measuring: taps on the map add points instead of opening what they hit. */
  const tapping = $derived(drawing.draft !== null || measuring);
  let selected: string | null = $state(null);
  let selectedMember: NodeId | null = $state(null);
  /** The point shown in the coordinates panel. */
  let point: LatLon | null = $state.raw(null);
  let sosOpen = $state(false);
  let notice: string | null = $state(null);

  function showNotice(text: string): void {
    notice = text;
    setTimeout(() => (notice = null), 4000);
  }

  function startDrawing(kind: DraftKind): void {
    closePanel();
    measuring = false;
    drawing.start(kind);
  }

  /** Starts a marker at a point and goes straight to describing it. */
  function markAt(at: LatLon): void {
    startDrawing('marker');
    drawing.add(at);
  }

  function inspect(at: LatLon): void {
    point = at;
    panels.open = 'point';
  }

  /** A coordinate typed in the panel: shown on the map. */
  function find(at: LatLon): void {
    inspect(at);
    show(at);
  }

  onMount(() =>
    onLongPress(map, (at) => {
      if (!tapping) inspect(at);
    }),
  );

  async function saveDraft(code: number, label: string): Promise<void> {
    const { draft } = drawing;
    if (draft === null || group === null) return;
    const [first] = draft.points;
    const geometry = draftGeometry(draft);
    if (draft.kind === 'marker' && first) await group.feed.placeMarker(first, code, label);
    else if (geometry) await group.feed.drawShape(geometry, code, label);
    drawing.stop();
  }

  function select(key: string): void {
    selected = key;
    panels.open = 'object';
  }

  function selectMember(id: NodeId): void {
    selectedMember = id;
    panels.open = 'member';
  }

  function startMeasuring(): void {
    closePanel();
    measuring = true;
  }

  async function sendSos(
    kind: SosKind,
    at: LatLon,
    accuracy: number | null,
    text: string,
  ): Promise<void> {
    await group?.feed.sendSos(kind, at, accuracy, text);
    sosOpen = false;
    showNotice(t('sosSent'));
  }

  function mapCentre(): LatLon {
    const centre = map.getCenter();
    return { lat: centre.lat, lon: centre.lng };
  }

  function show(at: LatLon): void {
    map.flyTo({ center: [at.lon, at.lat], zoom: Math.max(map.getZoom(), 15) });
  }

  async function acknowledge(target: EventRef): Promise<void> {
    await group?.feed.acknowledge(target);
  }

  async function cancelSos(sos: EventRef): Promise<void> {
    await group?.feed.cancelSos(sos);
  }

  async function sendChat(text: string): Promise<void> {
    await group?.feed.sendChat(text);
  }

  async function sendAlert(level: AlertLevel, text: string): Promise<void> {
    await group?.feed.sendAlert(level, text);
  }
</script>

{#if group}
  {@const { feed, self, role } = group}
  <MemberLayer
    {map}
    groupState={feed.state}
    {self}
    interactive={!tapping}
    onselect={selectMember}
  />
  <ObjectLayer {map} groupState={feed.state} interactive={!tapping} onselect={select} />

  {#if drawing.draft && drawing.describing}
    <ObjectForm
      {t}
      kind={drawing.draft.kind}
      onsave={saveDraft}
      oncancel={() => {
        drawing.stop();
      }}
    />
  {/if}

  {#if panels.open === 'object' && selected}
    {@const key = selected}
    <ObjectDetails
      {t}
      {locale}
      groupState={feed.state}
      objectKey={key}
      format={preferences.coordinateFormat}
      {location}
      onnavigate={(name: string) => {
        navigateTo({ kind: 'object', key, name });
      }}
      ondelete={async () => {
        const record = feed.state.objects.get(key);
        if (record) await feed.deleteObject(record.object);
      }}
      onclose={closePanel}
    />
  {/if}

  {#if panels.open === 'member' && selectedMember}
    {@const id = selectedMember}
    <MemberDetails
      {t}
      {locale}
      groupState={feed.state}
      {id}
      format={preferences.coordinateFormat}
      {location}
      onnavigate={(name: string) => {
        navigateTo({ kind: 'member', id, name });
      }}
      onclose={closePanel}
    />
  {/if}

  {#if panels.open === 'chat'}
    <ChatPanel
      {t}
      {locale}
      groupState={feed.state}
      {self}
      canAlert={role === 'coordinator'}
      onsend={sendChat}
      onalert={sendAlert}
      radioTexts={radio.texts}
      showRadioTab={radio.state !== 'disconnected' || radio.texts.length > 0}
      onclose={closePanel}
    />
  {/if}

  {#if sosOpen}
    <SosDialog
      {t}
      {location}
      fallback={mapCentre()}
      onsend={sendSos}
      oncancel={() => (sosOpen = false)}
    />
  {/if}

  {#if notice}
    <Toast>{notice}</Toast>
  {/if}
{/if}

{#if panels.open === 'point'}
  {#if point}<PointLayer {map} {point} />{/if}
  <CoordinatesPanel
    {t}
    {point}
    format={preferences.coordinateFormat}
    {locale}
    {location}
    onfind={find}
    onmark={group ? markAt : null}
    onnavigate={(at: LatLon) => {
      navigateTo({ kind: 'point', at, name: t('mapPoint') });
    }}
    onclose={closePanel}
  />
{/if}

<SelfLayer {map} {location} />

<!-- The top of the map: what is going on now, then the incidents. -->
<div class="top">
  {#if drawing.draft && drawing.tapping}
    <DrawLayer
      {map}
      draft={drawing.draft}
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
  {:else if measuring}
    <Measuring {t} {locale} {map} onclose={() => (measuring = false)} />
  {/if}
  <Navigation
    {t}
    {locale}
    {map}
    {location}
    groupState={group?.feed.state ?? null}
    showCard={!tapping}
  />
  {#if group && !tapping}
    <IncidentBanners
      {t}
      {locale}
      groupState={group.feed.state}
      self={group.self}
      canCancelOthers={group.role === 'coordinator'}
      onacknowledge={acknowledge}
      oncancel={cancelSos}
      onshow={show}
    />
  {/if}
</div>
<LocateControl {t} {map} {location} />
{#if location.problem}
  <Toast>{location.problem === 'denied' ? t('locationDenied') : t('locationUnavailable')}</Toast>
{/if}

{#if !tapping}
  <Toolbar
    {t}
    sharing={group?.sharing ?? null}
    onsos={() => (sosOpen = true)}
    ondraw={startDrawing}
    onmeasure={startMeasuring}
  />
{/if}

<style>
  /* Clear of the map's own controls on the right, which are 29 px wide with a 10 px margin. */
  .top {
    position: absolute;
    z-index: 2;
    top: 0.75rem;
    right: 3.25rem;
    left: 0.75rem;
    display: grid;
    gap: 0.5rem;
    max-width: 30rem;
    margin: 0 auto;
    pointer-events: none;
  }
</style>
