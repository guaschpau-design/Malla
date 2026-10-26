<!--
  Everything on top of the map: the group's members, objects and incidents, drawing, the chat
  and the toolbar. Without an active group only the offline maps button is shown.
-->
<script lang="ts">
  import type { AlertLevel, EventRef, LatLon, NodeId, Role, SosKind } from '@tesel/protocol';
  import type { Map as MapLibreMap } from 'maplibre-gl';

  import ChatPanel from '../chat/ChatPanel.svelte';
  import type { Locale, Translate } from '../i18n/index.ts';
  import IncidentBanners from '../incidents/IncidentBanners.svelte';
  import SosDialog from '../incidents/SosDialog.svelte';
  import MemberLayer from '../map/MemberLayer.svelte';
  import {
    addPoint,
    draftGeometry,
    isFull,
    startDraft,
    undoPoint,
    type Draft,
    type DraftKind,
  } from '../objects/draft.ts';
  import DrawBar from '../objects/DrawBar.svelte';
  import DrawLayer from '../objects/DrawLayer.svelte';
  import DrawMenu from '../objects/DrawMenu.svelte';
  import ObjectDetails from '../objects/ObjectDetails.svelte';
  import ObjectForm from '../objects/ObjectForm.svelte';
  import ObjectLayer from '../objects/ObjectLayer.svelte';
  import type { DeviceLocation } from '../position/device-location.svelte.ts';
  import LocateControl from '../position/LocateControl.svelte';
  import PositionControl from '../position/PositionControl.svelte';
  import SelfLayer from '../position/SelfLayer.svelte';
  import type { RadioSession } from '../radio/radio.svelte.ts';
  import type { PositionSharing } from '../position/position-sharing.svelte.ts';
  import type { GroupFeed } from '../sync/group-feed.svelte.ts';
  import Toast from '../ui/Toast.svelte';
  import { closePanel, panels, togglePanel } from '../ui/panels.svelte.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    map: MapLibreMap;
    /** The active group's feed and this device's place in it, when there is an active group. */
    group: { feed: GroupFeed; self: NodeId; role: Role; sharing: PositionSharing } | null;
    radio: RadioSession;
    location: DeviceLocation;
  }

  let { t, locale, map, group, radio, location }: Props = $props();

  // Drawing: tapping points (`draft`), then describing the object (`describing`).
  let draft: Draft | null = $state.raw(null);
  let describing = $state(false);
  let selected: string | null = $state(null);
  let sosOpen = $state(false);
  let notice: string | null = $state(null);

  function showNotice(text: string): void {
    notice = text;
    setTimeout(() => (notice = null), 4000);
  }

  function startDrawing(kind: DraftKind): void {
    closePanel();
    draft = startDraft(kind);
    describing = false;
  }

  function addDraftPoint(at: LatLon): void {
    if (draft === null) return;
    draft = addPoint(draft, at);
    if (isFull(draft)) describing = true;
  }

  function stopDrawing(): void {
    draft = null;
    describing = false;
  }

  async function saveDraft(code: number, label: string): Promise<void> {
    if (draft === null || group === null) return;
    const [point] = draft.points;
    const geometry = draftGeometry(draft);
    if (draft.kind === 'marker' && point) await group.feed.placeMarker(point, code, label);
    else if (geometry) await group.feed.drawShape(geometry, code, label);
    stopDrawing();
  }

  function select(key: string): void {
    selected = key;
    panels.open = 'object';
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
  <MemberLayer {map} groupState={feed.state} {self} />
  <ObjectLayer {map} groupState={feed.state} interactive={draft === null} onselect={select} />

  {#if draft && !describing}
    <DrawLayer {map} {draft} onpoint={addDraftPoint} />
    <DrawBar
      {t}
      {draft}
      onundo={() => {
        if (draft) draft = undoPoint(draft);
      }}
      onfinish={() => (describing = true)}
      oncancel={stopDrawing}
    />
  {:else}
    <IncidentBanners
      {t}
      {locale}
      groupState={feed.state}
      {self}
      canCancelOthers={role === 'coordinator'}
      onacknowledge={acknowledge}
      oncancel={cancelSos}
      onshow={show}
    />
  {/if}

  {#if draft && describing}
    <ObjectForm {t} kind={draft.kind} onsave={saveDraft} oncancel={stopDrawing} />
  {/if}

  {#if panels.open === 'object' && selected}
    {@const key = selected}
    <ObjectDetails
      {t}
      {locale}
      groupState={feed.state}
      objectKey={key}
      ondelete={async () => {
        const record = feed.state.objects.get(key);
        if (record) await feed.deleteObject(record.object);
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
    <SosDialog {t} fallback={mapCentre()} onsend={sendSos} oncancel={() => (sosOpen = false)} />
  {/if}

  {#if notice}
    <Toast>{notice}</Toast>
  {/if}
{/if}

<SelfLayer {map} {location} />
<LocateControl {t} {map} {location} />
{#if location.problem}
  <Toast>{location.problem === 'denied' ? t('locationDenied') : t('locationUnavailable')}</Toast>
{/if}

{#if !draft}
  <div class="toolbar">
    {#if group}
      <button class="sos" onclick={() => (sosOpen = true)}>{t('sos')}</button>
    {/if}
    <div class="actions">
      {#if group}
        <PositionControl {t} sharing={group.sharing} />
        <DrawMenu {t} onstart={startDrawing} />
        <button
          class="fab"
          aria-expanded={panels.open === 'chat'}
          onclick={() => {
            togglePanel('chat');
          }}
        >
          {t('chat')}
        </button>
      {/if}
      <button
        class="fab"
        aria-expanded={panels.open === 'offline'}
        onclick={() => {
          togglePanel('offline');
        }}
      >
        {t('offlineAreas')}
      </button>
    </div>
  </div>
{/if}

<style>
  .toolbar {
    position: absolute;
    z-index: 1;
    right: 1rem;
    bottom: calc(2.5rem + env(safe-area-inset-bottom));
    left: 1rem;
    display: flex;
    gap: 0.75rem;
    align-items: flex-end;
    pointer-events: none;
  }

  .actions {
    display: flex;
    flex: 1;
    flex-wrap: wrap-reverse;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  .sos {
    width: 4rem;
    height: 4rem;
    font-weight: 800;
    color: #fff;
    pointer-events: auto;
    background: var(--danger);
    border: 3px solid #fff;
    border-radius: 50%;
    box-shadow: 0 4px 16px rgb(0 0 0 / 35%);
  }
</style>
