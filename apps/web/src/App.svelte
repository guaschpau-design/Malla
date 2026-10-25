<script lang="ts">
  import type { Invitation, ProtocolError, Result } from '@teselia/protocol';
  import type { Map as MapLibreMap } from 'maplibre-gl';
  import { onMount, untrack } from 'svelte';

  import { BASEMAP_URL } from './lib/config.ts';
  import { connection, watchConnection } from './lib/connection.svelte.ts';
  import type { JoinOutcome } from './lib/groups/group.ts';
  import GroupsPanel from './lib/groups/GroupsPanel.svelte';
  import JoinDialog from './lib/groups/JoinDialog.svelte';
  import { invitationInAddress } from './lib/groups/join-link.ts';
  import { detectLocale, translator, type Locale, type MessageKey } from './lib/i18n/index.ts';
  import Onboarding from './lib/identity/Onboarding.svelte';
  import MapView from './lib/map/MapView.svelte';
  import type { MapTheme } from './lib/map/style.ts';
  import { pmtilesArchive, registerTileProtocol } from './lib/map/tile-source.ts';
  import { openTileStore, type TileStore } from './lib/map/tile-store.ts';
  import OfflineAreasPanel from './lib/offline/OfflineAreasPanel.svelte';
  import { loadPositionMode, PositionSharing } from './lib/position/position-sharing.svelte.ts';
  import UpdatePrompt from './lib/pwa/UpdatePrompt.svelte';
  import { Session } from './lib/session.svelte.ts';
  import { openAppDb, type AppDb } from './lib/storage/app-db.ts';
  import { GroupFeed, type FeedStatus } from './lib/sync/group-feed.svelte.ts';
  import { closePanel, panels, togglePanel } from './lib/ui/panels.svelte.ts';
  import Toast from './lib/ui/Toast.svelte';
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

  const archive = pmtilesArchive(BASEMAP_URL);
  let store: TileStore | undefined = $state();
  let db: AppDb | undefined;
  let session: Session | undefined = $state();
  let sharing: PositionSharing | undefined;
  let feed: GroupFeed | undefined = $state.raw();
  let map: MapLibreMap | undefined = $state();
  let notice: string | null = $state(null);

  const SYNC_LABELS: Readonly<Record<FeedStatus, MessageKey>> = {
    synced: 'syncSynced',
    connecting: 'syncConnecting',
    syncing: 'syncConnecting',
    disconnected: 'syncDisconnected',
    'local-only': 'syncLocalOnly',
  };

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
      registerTileProtocol(opened, archive);
      store = opened;
    });
    void openAppDb().then(async (opened) => {
      db = opened;
      sharing = new PositionSharing(opened);
      session = await Session.load(opened);
    });

    return () => {
      stopWatching();
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
    void GroupFeed.open(database, group, identity).then(async (created) => {
      const mode = await loadPositionMode(database);
      if (cancelled) {
        created.close();
        return;
      }
      opened = created;
      feed = created;
      positions.attach(created, mode);
    });
    return () => {
      cancelled = true;
      positions.detach();
      opened?.close();
      feed = undefined;
    };
  });

  const workspaceGroup = $derived(
    feed && sharing && session?.identity && session.activeGroup
      ? { feed, sharing, self: session.identity.nodeId, role: session.activeGroup.role }
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
    <span class="brand">Teselia</span>
    <span class="status" class:offline={!connection.online} role="status">
      <span class="dot" aria-hidden="true"></span>
      {connection.online ? t('online') : t('offline')}
    </span>
    {#if session?.identity}
      {@const groupLabel = session.activeGroup?.name ?? t('noGroup')}
      <button
        class="group"
        onclick={() => {
          togglePanel('groups');
        }}
        aria-expanded={panels.open === 'groups'}
        aria-label="{t('groups')}: {groupLabel}"
        title={feed ? t(SYNC_LABELS[feed.status]) : undefined}
      >
        {#if feed}<span class="sync {feed.status}" aria-hidden="true"></span>{/if}
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
    {#if store}
      <MapView {theme} lang={locale} onready={onMapReady} />
    {/if}

    {#if map}
      <MapWorkspace {t} {locale} {map} group={workspaceGroup} />
    {/if}

    {#if map && store && panels.open === 'offline'}
      <OfflineAreasPanel {t} {locale} {map} {store} {archive} onclose={closePanel} />
    {/if}

    {#if session && panels.open === 'groups'}
      <GroupsPanel
        {t}
        {session}
        activeState={feed?.state}
        oninvitation={received}
        onclose={closePanel}
      />
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
    font-size: 1.15rem;
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  .status {
    display: inline-flex;
    white-space: nowrap;
    gap: 0.4rem;
    align-items: center;
    margin-right: auto;
    font-size: 0.85rem;
  }

  .dot {
    width: 0.55rem;
    height: 0.55rem;
    background: var(--ok);
    border-radius: 50%;
  }

  .status.offline .dot {
    background: var(--danger);
  }

  main {
    position: relative;
    overflow: hidden;
  }

  .group {
    min-width: 0;
    max-width: 45vw;
    overflow: hidden;
    color: inherit;
    text-overflow: ellipsis;
    white-space: nowrap;
    border-color: rgb(248 250 252 / 35%);
  }

  .sync {
    display: inline-block;
    width: 0.5rem;
    height: 0.5rem;
    margin-right: 0.4rem;
    vertical-align: middle;
    background: var(--muted);
    border-radius: 50%;
  }

  .sync.synced {
    background: var(--ok);
  }

  .sync.connecting,
  .sync.syncing {
    background: #f59e0b;
  }

  .sync.disconnected {
    background: var(--danger);
  }
</style>
