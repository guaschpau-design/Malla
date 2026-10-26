<script lang="ts">
  import type { Invitation, ProtocolError, Result } from '@tesel/protocol';
  import type { Map as MapLibreMap } from 'maplibre-gl';
  import { onMount, untrack } from 'svelte';

  // The logo comes from brand/, built by brand/build.py; the header is always ink, hence pale.
  import lockupUrl from '../../../brand/lockup-pale.svg';
  import markUrl from '../../../brand/mark.svg';
  import { basemapUrl, defaultServerUrl } from './lib/config.ts';
  import { connection, watchConnection } from './lib/links/connection.svelte.ts';
  import type { JoinOutcome } from './lib/groups/group.ts';
  import GroupsPanel from './lib/groups/GroupsPanel.svelte';
  import JoinDialog from './lib/groups/JoinDialog.svelte';
  import { invitationInAddress } from './lib/groups/join-link.ts';
  import { detectLocale, translator, type Locale, type MessageKey } from './lib/i18n/index.ts';
  import Onboarding from './lib/identity/Onboarding.svelte';
  import ConnectionsPanel from './lib/links/ConnectionsPanel.svelte';
  import LinkButton from './lib/links/LinkButton.svelte';
  import { linkOf, networkStatus, radioLinkOf } from './lib/links/links.ts';
  import MapView from './lib/map/MapView.svelte';
  import type { MapTheme } from './lib/map/style.ts';
  import { findTile, registerTileProtocol, tileArchives } from './lib/map/tile-source.ts';
  import { openTileStore } from './lib/map/tile-store.ts';
  import type { OfflineMaps } from './lib/offline/offline-maps.ts';
  import OfflineAreasPanel from './lib/offline/OfflineAreasPanel.svelte';
  import { DeviceLocation } from './lib/position/device-location.svelte.ts';
  import { PositionSharing } from './lib/position/position-sharing.svelte.ts';
  import UpdatePrompt from './lib/pwa/UpdatePrompt.svelte';
  import { RadioSession } from './lib/radio/radio.svelte.ts';
  import { loadPreferences, type Preferences } from './lib/settings/preferences.ts';
  import { Session } from './lib/session.svelte.ts';
  import { ElevationReader } from './lib/terrain/elevation.ts';
  import { provideTerrain } from './lib/terrain/terrain-context.ts';
  import { openAppDb, type AppDb } from './lib/storage/app-db.ts';
  import { GroupFeed } from './lib/sync/group-feed.svelte.ts';
  import { closePanel, panels, togglePanel } from './lib/ui/panels.svelte.ts';
  import Toast from './lib/ui/Toast.svelte';
  import { WeatherFeed } from './lib/weather/weather-feed.svelte.ts';
  import MapWorkspace from './lib/workspace/MapWorkspace.svelte';

  let locale: Locale = $state(detectLocale(navigator.languages));
  const t = $derived(translator(locale));

  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  let theme: MapTheme = $state(darkQuery.matches ? 'dark' : 'light');

  // Read an invitation link before anything else, then remove the secret from the address bar
  // and the history (ADR-0012). This runs before the map takes over the URL fragment.
  const fromAddress = invitationInAddress(window.location.pathname, window.location.hash);
  if (fromAddress !== null) window.history.replaceState(null, '', import.meta.env.BASE_URL);
  let incoming: Result<Invitation, ProtocolError> | null = $state.raw(fromAddress);

  const archives = tileArchives(basemapUrl());
  let elevations: ElevationReader | null = $state.raw(null);
  provideTerrain({
    get reader() {
      return preferences?.relief.value ? elevations : null;
    },
  });
  /** Downloaded maps, once their database is open. */
  let offline: OfflineMaps | undefined = $state.raw();
  let db: AppDb | undefined;
  let session: Session | undefined = $state();
  let preferences: Preferences | undefined = $state.raw();
  let sharing: PositionSharing | undefined;
  let feed: GroupFeed | undefined = $state.raw();
  let map: MapLibreMap | undefined = $state();
  /** Official weather warnings from the app's own server, once the database is open. */
  let weather: WeatherFeed | null = $state.raw(null);
  const radio = new RadioSession();
  const location = new DeviceLocation();
  /** How this device reaches its group now (lib/links). */
  const linkInput = $derived({
    server: feed?.status ?? null,
    viaCommandPost: feed?.viaCommandPost ?? false,
    radio: radioLinkOf(radio),
    browserOnline: connection.online,
  });
  const link = $derived(linkOf(linkInput));
  let notice: string | null = $state(null);

  const JOIN_NOTICES: Readonly<Record<JoinOutcome, MessageKey>> = {
    joined: 'joined',
    promoted: 'promoted',
    'already-member': 'alreadyMember',
  };

  onMount(() => {
    const stopWatching = watchConnection();
    const onScheme = (event: MediaQueryListEvent) => (theme = event.matches ? 'dark' : 'light');
    darkQuery.addEventListener('change', onScheme);

    void openTileStore().then((opened) => {
      registerTileProtocol(opened, archives);
      elevations = new ElevationReader((tile) => findTile('terrain', tile, opened, archives));
      offline = { store: opened, archives };
    });
    const server = defaultServerUrl();
    void openAppDb().then(async (opened) => {
      db = opened;
      if (server !== null) weather = WeatherFeed.start(opened, server);
      void radio.useStorage(opened);
      preferences = await loadPreferences(opened);
      sharing = new PositionSharing(preferences.positionMode, location);
      session = await Session.load(opened);
    });

    return () => {
      stopWatching();
      weather?.stop();
      darkQuery.removeEventListener('change', onScheme);
    };
  });

  function onMapReady(instance: MapLibreMap): void {
    map = instance;
  }

  // One feed for the active group. It is reopened only when what it depends on changes, not
  // whenever the list of groups is reloaded.
  const feedKey = $derived.by(() => {
    const group = session?.activeGroup;
    const identity = session?.identity;
    if (!group || !identity) return null;
    return [group.id, group.server ?? '', group.role, identity.alias].join('|');
  });

  $effect(() => {
    if (feedKey === null) return;
    const group = untrack(() => session?.activeGroup);
    const identity = untrack(() => session?.identity);
    if (!db || !sharing || !group || !identity) return;
    const database = db;
    const positions = sharing;
    let opened: GroupFeed | undefined;
    let cancelled = false;
    void GroupFeed.open(database, group, identity).then((created) => {
      if (cancelled) {
        created.close();
        return;
      }
      opened = created;
      feed = created;
      positions.attach(created);
    });
    return () => {
      cancelled = true;
      positions.detach();
      opened?.close();
      feed = undefined;
    };
  });

  // The radio follows the active group: its channel, its events. A practice stays on this device.
  $effect(() => {
    void radio.useFeed(session?.activeGroup?.practice ? null : (feed ?? null));
  });

  const workspaceGroup = $derived(
    feed && sharing && session?.identity && session.activeGroup
      ? {
          feed,
          sharing,
          self: session.identity.nodeId,
          role: session.activeGroup.role,
          practice: session.activeGroup.practice === true,
        }
      : null,
  );

  function showNotice(text: string): void {
    notice = text;
    setTimeout(() => (notice = null), 4000);
  }

  async function createIdentity(alias: string): Promise<void> {
    await session?.createIdentity(alias);
  }

  async function join(invitation: Invitation): Promise<void> {
    if (!session) return;
    const outcome = await session.join(invitation);
    incoming = null;
    showNotice(t(JOIN_NOTICES[outcome], { group: invitation.groupName }));
  }

  function received(invitation: Invitation): void {
    closePanel();
    incoming = { ok: true, value: invitation };
  }

  $effect(() => {
    document.documentElement.lang = locale;
  });
</script>

<div class="app">
  <header class="bar">
    <span class="brand">
      <img class="lockup" src={lockupUrl} alt="Tesel" />
      <img class="mark" src={markUrl} alt="Tesel" />
    </span>
    <LinkButton
      {t}
      {link}
      network={connection.network}
      detail={t(networkStatus(linkInput).label)}
      expanded={panels.open === 'connections'}
      onclick={() => {
        togglePanel('connections');
      }}
    />
    {#if session?.identity}
      {@const groupLabel = session.activeGroup?.name ?? t('noGroup')}
      <button
        class="group"
        onclick={() => {
          togglePanel('groups');
        }}
        aria-expanded={panels.open === 'groups'}
        aria-label="{t('groups')}: {groupLabel}"
      >
        {groupLabel}
      </button>
    {/if}
    <button
      class="ghost"
      onclick={() => (locale = locale === 'es' ? 'en' : 'es')}
      aria-label={t('switchLanguage')}
      title={t('switchLanguage')}
    >
      {locale === 'es' ? 'EN' : 'ES'}
    </button>
  </header>

  <main>
    {#if offline && preferences}
      <MapView
        choice={{
          base: preferences.baseMap.value,
          relief: preferences.relief.value,
          theme,
          lang: locale,
        }}
        onready={onMapReady}
      />
    {/if}

    {#if map && offline && preferences}
      <MapWorkspace
        {t}
        {locale}
        {map}
        group={workspaceGroup}
        {radio}
        {location}
        {preferences}
        {offline}
        {weather}
        onendpractice={() => void session?.endPractice()}
      />
    {/if}

    {#if map && offline && panels.open === 'offline'}
      <OfflineAreasPanel {t} {locale} {map} {offline} onclose={closePanel} />
    {/if}

    {#if panels.open === 'connections'}
      <ConnectionsPanel
        {t}
        input={linkInput}
        network={connection.network}
        {radio}
        groupName={session?.activeGroup?.name ?? null}
        onclose={closePanel}
      />
    {/if}

    {#if session && panels.open === 'groups'}
      <GroupsPanel {t} {session} activeFeed={feed} oninvitation={received} onclose={closePanel} />
    {/if}

    {#if session && !session.identity}
      <Onboarding
        {t}
        invitedTo={incoming?.ok ? incoming.value.groupName : null}
        oncreate={createIdentity}
      />
    {:else if session && incoming}
      <JoinDialog
        {t}
        invitation={incoming.ok ? incoming.value : null}
        onjoin={join}
        ondismiss={() => (incoming = null)}
      />
    {/if}

    {#if notice}
      <Toast>{notice}</Toast>
    {/if}
    <UpdatePrompt {t} />
  </main>
</div>

<style>
  .app {
    display: grid;
    /* minmax(0, …) lets the bar shrink to the screen; long group names are cut, not overflowed. */
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto 1fr;
    height: 100dvh;
  }

  .bar {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    padding: calc(0.5rem + env(safe-area-inset-top)) 1rem 0.5rem;
    color: var(--bar-fg);
    background: var(--bar-bg);
  }

  .brand {
    display: flex;
    flex-shrink: 0;
  }

  .brand img {
    display: block;
    height: 1.45rem;
    width: auto;
  }

  .brand .mark {
    display: none;
  }

  main {
    position: relative;
    overflow: hidden;
  }

  /* On narrow screens the mark stands for the name. */
  @media (max-width: 30rem) {
    .brand .lockup {
      display: none;
    }

    .brand .mark {
      display: block;
      height: 1.7rem;
    }
  }

  .group {
    min-width: 0;
    max-width: 45vw;
    overflow: hidden;
    color: inherit;
    text-overflow: ellipsis;
    white-space: nowrap;
    border-color: rgb(230 235 232 / 25%);
  }
</style>
