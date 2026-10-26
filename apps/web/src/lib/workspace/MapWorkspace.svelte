<!--
  Everything on top of the map: this device, the group's members, objects, tasks and incidents,
  drawing, measuring and navigating, the panels and the dock. Without an active group, only what works
  alone: this device, coordinates, measuring, navigating to a point and offline maps.
-->
<script lang="ts">
  import type { EventRef, LatLon, NodeId, Role, SosKind } from '@tesel/protocol';
  import type { Map as MapLibreMap } from 'maplibre-gl';

  import { onMount } from 'svelte';

  import FindCoordinatePanel from '../coordinates/FindCoordinatePanel.svelte';
  import PointLayer from '../coordinates/PointLayer.svelte';
  import PointPanel from '../coordinates/PointPanel.svelte';
  import type { Locale, Translate } from '../i18n/index.ts';
  import IncidentBanners from '../incidents/IncidentBanners.svelte';
  import SosDialog from '../incidents/SosDialog.svelte';
  import { onLongPress } from '../map/long-press.ts';
  import LayersPanel from '../map/LayersPanel.svelte';
  import MapControl from '../map/MapControl.svelte';
  import MemberLayer from '../map/MemberLayer.svelte';
  import TrailLayer from '../map/TrailLayer.svelte';
  import Measuring from '../measure/Measuring.svelte';
  import Navigation from '../navigation/Navigation.svelte';
  import { navigateTo, navigation } from '../navigation/navigation.svelte.ts';
  import { draftGeometry, type DraftKind } from '../objects/draft.ts';
  import DrawBar from '../objects/DrawBar.svelte';
  import { Drawing } from '../objects/drawing.svelte.ts';
  import DrawLayer from '../objects/DrawLayer.svelte';
  import ObjectForm from '../objects/ObjectForm.svelte';
  import ObjectLayer from '../objects/ObjectLayer.svelte';
  import type { DeviceLocation } from '../position/device-location.svelte.ts';
  import LocateButton from '../position/LocateButton.svelte';
  import MePanel from '../position/MePanel.svelte';
  import SelfLayer from '../position/SelfLayer.svelte';
  import type { RadioSession } from '../radio/radio.svelte.ts';
  import type { PositionSharing } from '../position/position-sharing.svelte.ts';
  import type { Preferences } from '../settings/preferences.ts';
  import type { GroupFeed } from '../sync/group-feed.svelte.ts';
  import MapTasks from '../tasks/MapTasks.svelte';
  import { newTask } from '../tasks/task-editor.svelte.ts';
  import { myPendingCount } from '../tasks/tasks.ts';
  import Pictogram from '../ui/Pictogram.svelte';
  import Toast from '../ui/Toast.svelte';
  import { closePanel, panels, togglePanel } from '../ui/panels.svelte.ts';
  import { keepScreenAwake } from '../ui/screen-awake.svelte.ts';
  import Dock from './Dock.svelte';
  import GroupPanels from './GroupPanels.svelte';

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

  // Kept on when the user asks, and always while guiding to a target.
  keepScreenAwake(() => preferences.keepScreenOn.value || navigation.target !== null);

  const drawing = new Drawing();
  /** Measuring, and the point it started from if any. */
  let measuring: { readonly from: LatLon | null } | null = $state.raw(null);
  /** Drawing or measuring: taps on the map add points instead of opening what they hit. */
  const tapping = $derived(drawing.draft !== null || measuring !== null);
  const shown = $derived({
    members: !preferences.hiddenLayers.value.includes('members'),
    trails: !preferences.hiddenLayers.value.includes('trails'),
    objects: !preferences.hiddenLayers.value.includes('objects'),
    tasks: !preferences.hiddenLayers.value.includes('tasks'),
  });
  let selected: string | null = $state(null);
  let selectedMember: NodeId | null = $state(null);
  /** The point shown in the point panel. */
  let point: LatLon | null = $state.raw(null);
  let sosOpen = $state(false);
  let notice: string | null = $state(null);

  function showNotice(text: string): void {
    notice = text;
    setTimeout(() => (notice = null), 4000);
  }

  function startDrawing(kind: DraftKind): void {
    closePanel();
    measuring = null;
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

  function startMeasuring(from: LatLon | null): void {
    closePanel();
    drawing.stop();
    measuring = { from };
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
</script>

{#if group}
  {@const { feed, self, role } = group}
  <TrailLayer {map} groupState={feed.state} {self} visible={shown.trails} />
  <ObjectLayer
    {map}
    groupState={feed.state}
    interactive={!tapping}
    visible={shown.objects}
    onselect={select}
  />
  {#key feed}
    <MapTasks
      {t}
      {map}
      groupState={feed.state}
      {self}
      interactive={!tapping}
      visible={shown.tasks}
    />
  {/key}
  <MemberLayer
    {map}
    groupState={feed.state}
    {self}
    interactive={!tapping}
    visible={shown.members}
    onselect={selectMember}
  />

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

  <GroupPanels
    {t}
    {locale}
    {feed}
    {self}
    {role}
    {radio}
    {location}
    {preferences}
    objectKey={selected}
    memberId={selectedMember}
    onshow={find}
  />

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

{#if panels.open === 'point' && point}
  {@const at = point}
  <PointLayer {map} point={at} />
  <PointPanel
    {t}
    {locale}
    {at}
    {location}
    format={preferences.coordinateFormat}
    onnavigate={() => {
      navigateTo({ kind: 'point', at, name: t('mapPoint') });
    }}
    onmeasure={() => {
      startMeasuring(at);
    }}
    onmark={group
      ? () => {
          markAt(at);
        }
      : null}
    ontask={group
      ? () => {
          newTask(at);
        }
      : null}
    onclose={closePanel}
  />
{:else if panels.open === 'find'}
  <FindCoordinatePanel {t} onfind={find} onclose={closePanel} />
{:else if panels.open === 'me'}
  <MePanel
    {t}
    {locale}
    {location}
    format={preferences.coordinateFormat}
    sharing={group?.sharing ?? null}
    onclose={closePanel}
  />
{/if}

<SelfLayer {map} {location} />

{#if panels.open === 'layers'}
  <LayersPanel
    {t}
    base={preferences.baseMap}
    relief={preferences.relief}
    hidden={preferences.hiddenLayers}
    onclose={closePanel}
  />
{/if}

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
    <Measuring {t} {locale} {map} from={measuring.from} onclose={() => (measuring = null)} />
  {/if}
  <Navigation {t} {locale} {map} {location} groupState={group?.feed.state ?? null} />
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
<MapControl {map}>
  <LocateButton {t} {map} {location} />
  <button
    aria-label={t('layers')}
    title={t('layers')}
    aria-expanded={panels.open === 'layers'}
    onclick={() => {
      togglePanel('layers');
    }}
  >
    <Pictogram name="layers" size={18} />
  </button>
</MapControl>
{#if location.problem}
  <Toast>{location.problem === 'denied' ? t('locationDenied') : t('locationUnavailable')}</Toast>
{/if}

{#if !tapping}
  <Dock
    {t}
    sharing={group?.sharing ?? null}
    onsos={() => (sosOpen = true)}
    ondraw={startDrawing}
    onmeasure={() => {
      startMeasuring(null);
    }}
    keepScreenOn={preferences.keepScreenOn}
    tasksForMe={group ? myPendingCount(group.feed.state, group.self) : 0}
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
