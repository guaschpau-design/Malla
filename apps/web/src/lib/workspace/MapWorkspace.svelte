<!--
  Everything on top of the map: the cadastre, weather warnings, the MGRS grid, the radar, public
  services, this device, the group's members, objects, tasks and incidents, drawing, measuring and
  navigating, the panels and the dock. Without an active group, only what works alone: the
  cadastre, weather warnings, the grid, the radar's rings, services, this device, coordinates,
  measuring, navigating to a point and offline maps.
-->
<script lang="ts">
  import { EMPTY_STATE } from '@tesel/core';
  import type { LatLon, NodeId, SosKind } from '@tesel/protocol';
  import type { Map as MapLibreMap } from 'maplibre-gl';

  import { onMount, untrack } from 'svelte';

  import { CADASTRE_CREDITS } from '../cadastre/cadastre.ts';
  import CadastreLayer from '../cadastre/CadastreLayer.svelte';
  import FindCoordinatePanel from '../coordinates/FindCoordinatePanel.svelte';
  import MgrsGridLayer from '../coordinates/MgrsGridLayer.svelte';
  import PointLayer from '../coordinates/PointLayer.svelte';
  import PointPanel from '../coordinates/PointPanel.svelte';
  import type { Locale, MessageKey, Translate } from '../i18n/index.ts';
  import SosDialog from '../incidents/SosDialog.svelte';
  import SosLayer from '../incidents/SosLayer.svelte';
  import { MAP_LAYERS, type MapLayer } from '../map/layers.ts';
  import { onLongPress } from '../map/long-press.ts';
  import { useStyleCredits } from '../map/style-credits.svelte.ts';
  import { groupPoints, StartFraming } from '../map/start-framing.ts';
  import { MapTaps } from '../map/taps.ts';
  import LayersPanel from '../map/LayersPanel.svelte';
  import CompassButton from '../map/CompassButton.svelte';
  import MapControl from '../map/MapControl.svelte';
  import MapCredits from '../map/MapCredits.svelte';
  import MapScale from '../map/MapScale.svelte';
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
  import IncidentAlarm from '../incidents/IncidentAlarm.svelte';
  import type { RadioSession } from '../radio/radio.svelte.ts';
  import type { TappedService } from '../services/services.ts';
  import ServicesLayer from '../services/ServicesLayer.svelte';
  import RadarLayer from '../radar/RadarLayer.svelte';
  import type { Preferences } from '../settings/preferences.ts';
  import MapTasks from '../tasks/MapTasks.svelte';
  import { newTask } from '../tasks/task-editor.svelte.ts';
  import { myPendingCount } from '../tasks/tasks.ts';
  import Pictogram from '../ui/Pictogram.svelte';
  import { deviceClock } from '../sync/device-clock.svelte.ts';
  import { notices, useStandingNotice } from '../ui/notices.svelte.ts';
  import { attempt } from '../ui/submission.svelte.ts';
  import { closePanel, panels, togglePanel } from '../ui/panels.svelte.ts';
  import { keepScreenAwake } from '../ui/screen-awake.svelte.ts';
  import WarningList from '../weather/WarningList.svelte';
  import type { WeatherFeed } from '../weather/weather-feed.svelte.ts';
  import WeatherLayer from '../weather/WeatherLayer.svelte';
  import { warningsAt } from '../weather/weather-warnings.ts';
  import Dock from './Dock.svelte';
  import GroupPanels from './GroupPanels.svelte';
  import MapStatus from './MapStatus.svelte';
  import { stateSlices } from './state-slices.svelte.ts';
  import type { MapTool, WorkspaceGroup } from './workspace.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    map: MapLibreMap;
    /** The map opened on its wide view, not on one the address gave: it frames the group. */
    mapOpenedWide: boolean;
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
    mapOpenedWide,
    group,
    radio,
    location,
    preferences,
    offline,
    weather,
    onendpractice,
  }: Props = $props();

  // Kept on when the user asks, and always while guiding to a target.
  // A phone that carries the radio for the group must not sleep: with the screen off the browser
  // stops it, and with it the bridge between the radio and the server.
  keepScreenAwake(
    () => preferences.keepScreenOn.value || navigation.target !== null || radio.linked,
  );

  const drawing = new Drawing();
  let tool: MapTool | null = $state.raw(null);
  /** Drawing or a tool: taps on the map add points instead of opening what they hit. */
  const tapping = $derived(drawing.draft !== null || tool !== null);
  /** Every tap on the map goes to one owner: the tool in use, or what is drawn on top. */
  const taps = new MapTaps(() => !tapping);
  /** The group's state slice by slice: each layer redraws only when its own slices change. */
  const slices = stateSlices(() => group?.feed.state ?? EMPTY_STATE);
  /** Which map layers are shown, by layer. */
  const shown = $derived(
    Object.fromEntries(
      MAP_LAYERS.map((layer) => [layer, !preferences.hiddenLayers.value.includes(layer)]),
    ) as Record<MapLayer, boolean>,
  );
  /** What the map's data asks to be credited for, with the cadastres when they are shown. */
  const styleCredits = useStyleCredits(() => map);
  const credits = $derived(
    preferences.cadastre.value ? [...styleCredits.list, ...CADASTRE_CREDITS] : styleCredits.list,
  );
  let selected: string | null = $state(null);
  let selectedMember: NodeId | null = $state(null);
  /** The point shown in the point panel, and what to call it: a service's name, or "map point". */
  let point: { readonly at: LatLon; readonly name: string } | null = $state.raw(null);
  let sosOpen = $state(false);

  useStandingNotice(() => (radio.reconnecting ? { text: t('radioReconnecting') } : null));

  useStandingNotice(() => {
    const minutes = deviceClock.wrongByMinutes;
    if (minutes === null) return null;
    return { text: t(minutes > 0 ? 'clockAhead' : 'clockBehind', { minutes: Math.abs(minutes) }) };
  });

  useStandingNotice(() => {
    if (location.problem === null) return null;
    return { text: location.problem === 'denied' ? t('locationDenied') : t('locationUnavailable') };
  });

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

  onMount(() => taps.listen(map));

  // Until the user chooses a view, the map follows who appears: this device, the members.
  $effect(() => {
    const framing = new StartFraming(
      map,
      untrack(() => mapOpenedWide),
    );
    $effect(() => {
      const fix = location.fix?.at ?? null;
      framing.show(groupPoints(slices.positions, group?.self ?? null, fix, Date.now() / 1000));
    });
    return () => {
      framing.remove();
    };
  });

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

  /** An SOS went out with no place: the GPS stays on until the first fix, which follows it. */
  let sosWithoutPlace = $state(false);

  $effect(() => {
    const feed = group?.feed;
    if (!sosWithoutPlace || feed === undefined) return;
    return location.use((fix) => {
      sosWithoutPlace = false;
      attempt(() => feed.sharePosition(fix), t('actionFailed'));
    });
  });

  async function sendSos(
    kind: SosKind,
    at: LatLon | null,
    accuracy: number | null,
    text: string,
  ): Promise<void> {
    if (group === null) return;
    await group.feed.sendSos(kind, at, accuracy, text);
    sosOpen = false;
    sosWithoutPlace = at === null;
    notices.show(t(sosNotice()));
  }

  /** What became of an SOS just sent: it is with the group, on its way by radio, or waiting. */
  function sosNotice(): MessageKey {
    if (group === null || group.practice || group.feed.status === 'synced') return 'sosSent';
    return radio.linked ? 'sosByRadio' : 'sosWaiting';
  }

  function show(at: LatLon): void {
    map.flyTo({ center: [at.lon, at.lat], zoom: Math.max(map.getZoom(), 15) });
  }
</script>

{#if preferences.cadastre.value}
  <CadastreLayer {map} />
{/if}
{#if preferences.grid.value}
  <MgrsGridLayer {map} />
{/if}
{#if preferences.radar.value}
  <RadarLayer
    {map}
    {locale}
    {location}
    group={group ? { positions: slices.positions, self: group.self } : null}
  />
{/if}
{#if weather}
  <WeatherLayer {map} regions={weather.regions} visible={shown.weather} />
{/if}
<ServicesLayer {map} {taps} {locale} visible={shown.services} onselect={inspectService} />

{#if group}
  {@const { feed, self, role } = group}
  <TrailLayer {map} trails={slices.trails} {self} visible={shown.trails} />
  <ObjectLayer {map} {taps} objects={slices.objects} visible={shown.objects} onselect={select} />
  {#key feed}
    <MapTasks
      {t}
      {map}
      {taps}
      tasks={slices.tasks}
      members={slices.members}
      {self}
      visible={shown.tasks}
    />
  {/key}
  <MemberLayer
    {map}
    {taps}
    positions={slices.positions}
    members={slices.members}
    sos={slices.sos}
    sosCancels={slices.sosCancels}
    {self}
    visible={shown.members}
    onselect={selectMember}
  />
  <SosLayer
    {map}
    sos={slices.sos}
    sosCancels={slices.sosCancels}
    members={slices.members}
    positions={slices.positions}
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
    <SosDialog {t} {location} onsend={sendSos} oncancel={() => (sosOpen = false)} />
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
      grid: preferences.grid,
      radar: preferences.radar,
    }}
    hidden={preferences.hiddenLayers}
    {credits}
    onclose={closePanel}
  />
{/if}

{#if group}
  <IncidentAlarm
    {t}
    groupState={group.feed.state}
    self={group.self}
    choices={{
      sound: preferences.alarmSound.value,
      notifications: preferences.notifications.value,
    }}
  />
{/if}
<MapStatus
  {t}
  {locale}
  {map}
  {taps}
  {location}
  {group}
  {slices}
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
<MapScale {map} />
<!-- Shown again with each base map, which brings its own sources. -->
{#key preferences.baseMap.value}
  <MapCredits {map} {credits} />
{/key}

<Dock
  {t}
  sharing={group?.sharing ?? null}
  onsos={() => (sosOpen = true)}
  ondraw={startDrawing}
  onmeasure={() => {
    startTool({ kind: 'measure', from: null });
  }}
  {preferences}
  {locale}
  tasksForMe={group ? myPendingCount(group.feed.state, group.self) : 0}
  {tapping}
/>
