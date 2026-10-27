<!--
  Everything on top of the map: the cadastre, weather warnings, the MGRS grid, the radar, public
  services, this device, the group's members, objects, tasks and incidents, drawing, measuring and
  navigating, the panels and the dock. Without an active group, only what works alone: the
  cadastre, weather warnings, the grid, the radar's rings, services, this device, coordinates,
  measuring, navigating to a point and offline maps.
-->
<script lang="ts">
  import type { LatLon, NodeId, SosKind } from '@tesel/protocol';
  import type { Map as MapLibreMap } from 'maplibre-gl';

  import { onMount } from 'svelte';

  import CadastreLayer from '../cadastre/CadastreLayer.svelte';
  import FindCoordinatePanel from '../coordinates/FindCoordinatePanel.svelte';
  import MgrsGridLayer from '../coordinates/MgrsGridLayer.svelte';
  import PointLayer from '../coordinates/PointLayer.svelte';
  import PointPanel from '../coordinates/PointPanel.svelte';
  import type { Locale, Translate } from '../i18n/index.ts';
  import SosDialog from '../incidents/SosDialog.svelte';
  import { MAP_LAYERS, type MapLayer } from '../map/layers.ts';
  import { mapCentre } from '../map/geometry.ts';
  import { onLongPress } from '../map/long-press.ts';
  import LayersPanel from '../map/LayersPanel.svelte';
  import CompassButton from '../map/CompassButton.svelte';
  import MapControl from '../map/MapControl.svelte';
  import MemberLayer from '../map/MemberLayer.svelte';
  import TrailLayer from '../map/TrailLayer.svelte';
  import { navigateTo, navigation } from '../navigation/navigation.svelte.ts';
  import { draftGeometry, type DraftKind } from '../objects/draft.ts';
  import { Drawing } from '../objects/drawing.svelte.ts';
  import ObjectForm from '../objects/ObjectForm.svelte';
  import ObjectLayer from '../objects/ObjectLayer.svelte';
  import type { OfflineMaps } from '../offline/offline-maps.ts';
  import type { DeviceLocation } from '../position/device-location.svelte.ts';
  import LocateButton from '../position/LocateButton.svelte';
  import MePanel from '../position/MePanel.svelte';
  import SelfLayer from '../position/SelfLayer.svelte';
  import type { RadioSession } from '../radio/radio.svelte.ts';
  import type { TappedService } from '../services/services.ts';
  import ServicesLayer from '../services/ServicesLayer.svelte';
  import RadarLayer from '../radar/RadarLayer.svelte';
  import type { Preferences } from '../settings/preferences.ts';
  import MapTasks from '../tasks/MapTasks.svelte';
  import { newTask } from '../tasks/task-editor.svelte.ts';
  import { myPendingCount } from '../tasks/tasks.ts';
  import Pictogram from '../ui/Pictogram.svelte';
  import Toast from '../ui/Toast.svelte';
  import { closePanel, panels, togglePanel } from '../ui/panels.svelte.ts';
  import { keepScreenAwake } from '../ui/screen-awake.svelte.ts';
  import WarningList from '../weather/WarningList.svelte';
  import type { WeatherFeed } from '../weather/weather-feed.svelte.ts';
  import WeatherLayer from '../weather/WeatherLayer.svelte';
  import { warningsAt } from '../weather/weather-warnings.ts';
  import Dock from './Dock.svelte';
  import GroupPanels from './GroupPanels.svelte';
  import MapStatus from './MapStatus.svelte';
  import type { MapTool, WorkspaceGroup } from './workspace.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    map: MapLibreMap;
    /** The active group and this device's place in it, when there is an active group. */
    group: WorkspaceGroup | null;
    radio: RadioSession;
    location: DeviceLocation;
    preferences: Preferences;
    /** Downloaded maps: the operation area is offered for download. */
    offline: OfflineMaps;
    /** Official weather warnings, when the app's server publishes them. */
    weather: WeatherFeed | null;
    onendpractice: () => void;
  }

  let {
    t,
    locale,
    map,
    group,
    radio,
    location,
    preferences,
    offline,
    weather,
    onendpractice,
  }: Props = $props();

  // Kept on when the user asks, and always while guiding to a target.
  keepScreenAwake(() => preferences.keepScreenOn.value || navigation.target !== null);

  const drawing = new Drawing();
  let tool: MapTool | null = $state.raw(null);
  /** Drawing or a tool: taps on the map add points instead of opening what they hit. */
  const tapping = $derived(drawing.draft !== null || tool !== null);
  /** Which map layers are shown, by layer. */
  const shown = $derived(
    Object.fromEntries(
      MAP_LAYERS.map((layer) => [layer, !preferences.hiddenLayers.value.includes(layer)]),
    ) as Record<MapLayer, boolean>,
  );
  let selected: string | null = $state(null);
  let selectedMember: NodeId | null = $state(null);
  /** The point shown in the point panel, and what to call it: a service's name, or "map point". */
  let point: { readonly at: LatLon; readonly name: string } | null = $state.raw(null);
  let sosOpen = $state(false);
  let notice: string | null = $state(null);

  function showNotice(text: string): void {
    notice = text;
    setTimeout(() => (notice = null), 4000);
  }

  function startDrawing(kind: DraftKind): void {
    closePanel();
    tool = null;
    drawing.start(kind);
  }

  /** Starts a marker at a point and goes straight to describing it. */
  function markAt(at: LatLon): void {
    startDrawing('marker');
    drawing.add(at);
  }

  function inspect(at: LatLon, name = t('mapPoint')): void {
    point = { at, name };
    panels.open = 'point';
  }

  /** A service of the base map tapped: its point, under its name or its kind. */
  function inspectService(service: TappedService): void {
    inspect(service.at, service.name ?? t(service.kind.label));
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

  function startTool(next: MapTool): void {
    closePanel();
    drawing.stop();
    tool = next;
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

  function show(at: LatLon): void {
    map.flyTo({ center: [at.lon, at.lat], zoom: Math.max(map.getZoom(), 15) });
  }
</script>

{#if preferences.cadastre.value}
  <CadastreLayer {map} />
{/if}
{#if preferences.mgrsGrid.value}
  <MgrsGridLayer {map} />
{/if}
{#if preferences.radar.value}
  <RadarLayer
    {map}
    {locale}
    {location}
    group={group ? { state: group.feed.state, self: group.self } : null}
  />
{/if}
{#if weather}
  <WeatherLayer {map} regions={weather.regions} visible={shown.weather} />
{/if}
<ServicesLayer
  {map}
  {locale}
  interactive={!tapping}
  visible={shown.services}
  onselect={inspectService}
/>

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
      coordinator={role === 'coordinator'}
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
      fallback={mapCentre(map)}
      onsend={sendSos}
      oncancel={() => (sosOpen = false)}
    />
  {/if}

  {#if notice}
    <Toast>{notice}</Toast>
  {/if}
{/if}

{#if panels.open === 'point' && point}
  {@const { at, name } = point}
  {@const warnings = weather && shown.weather ? warningsAt(weather.regions, at) : []}
  <PointLayer {map} point={at} />
  <PointPanel
    {t}
    {locale}
    title={name}
    {at}
    {location}
    format={preferences.coordinateFormat}
    onnavigate={() => {
      navigateTo({ kind: 'point', at, name });
    }}
    onmeasure={() => {
      startTool({ kind: 'measure', from: at });
    }}
    onsight={() => {
      startTool({ kind: 'sight', from: at });
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
  >
    {#snippet about()}
      {#if weather && warnings.length > 0}
        <WarningList {t} {locale} {warnings} source={weather.source} />
      {/if}
    {/snippet}
  </PointPanel>
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
    flags={{
      relief: preferences.relief,
      cadastre: preferences.cadastre,
      grid: preferences.mgrsGrid,
      radar: preferences.radar,
    }}
    hidden={preferences.hiddenLayers}
    onclose={closePanel}
  />
{/if}

<MapStatus
  {t}
  {locale}
  {map}
  {location}
  {group}
  {drawing}
  {tool}
  {tapping}
  weather={shown.weather ? weather : null}
  {offline}
  onclosetool={() => (tool = null)}
  {onendpractice}
  onneedhelp={() => (sosOpen = true)}
/>
<MapControl {map}>
  <CompassButton {t} {map} />
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
      startTool({ kind: 'measure', from: null });
    }}
    keepScreenOn={preferences.keepScreenOn}
    tasksForMe={group ? myPendingCount(group.feed.state, group.self) : 0}
  />
{/if}
