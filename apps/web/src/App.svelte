<script lang="ts">
  import type { Invitation, ProtocolError, Result } from '@teselia/protocol';
  import type { Map as MapLibreMap } from 'maplibre-gl';
  import { onMount, untrack } from 'svelte';

  import { basemapUrl } from './lib/config.ts';
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
  import RadioPanel from './lib/radio/RadioPanel.svelte';
  import { RadioSession } from './lib/radio/radio.svelte.ts';
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

  const archive = pmtilesArchive(basemapUrl());
  let store: TileStore | undefined = $state();
  let db: AppDb | undefined;
  let session: Session | undefined = $state();
  let sharing: PositionSharing | undefined;
  let feed: GroupFeed | undefined = $state.raw();
  let map: MapLibreMap | undefined = $state();
  const radio = new RadioSession();
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
      void radio.useStorage(opened);
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

  // The radio follows the active group: its channel, its events.
  $effect(() => {
    void radio.useFeed(feed ?? null);
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
    <span class="brand"
      ><svg class="lockup" role="img" aria-label="Teselia" viewBox="0 0 610.1 139.3"
        ><g transform="translate(0 12.14) scale(1.1500)"
          ><path
            d="M8.0 9.6 L28.4 8.0 L31.6 28.4 L8.0 31.6 Z"
            fill="currentColor"
            stroke="currentColor"
            stroke-width="4"
            stroke-linejoin="round"
          /><path
            d="M40.6 8.0 L61.0 9.6 L59.4 30.0 L40.6 28.4 Z"
            fill="#f26a2e"
            stroke="#f26a2e"
            stroke-width="4"
            stroke-linejoin="round"
          /><path
            d="M68.4 6.4 L93.6 8.0 L92.0 31.6 L68.4 30.0 Z"
            fill="currentColor"
            stroke="currentColor"
            stroke-width="4"
            stroke-linejoin="round"
          /><path
            d="M39.0 37.4 L62.6 40.6 L59.4 61.0 L40.6 61.0 Z"
            fill="currentColor"
            stroke="currentColor"
            stroke-width="4"
            stroke-linejoin="round"
          /><path
            d="M40.6 70.0 L59.4 68.4 L61.0 93.6 L37.4 93.6 Z"
            fill="currentColor"
            stroke="currentColor"
            stroke-width="4"
            stroke-linejoin="round"
          /></g
        ><g transform="translate(151.0 0.00)" fill="currentColor"
          ><g transform="translate(0 100.00) scale(0.071429)"
            ><path
              d="M420.9476318359375 0.0V-1122.99365234375H42.0489501953125V-1400.0H1104.3533935546875V-1122.99365234375H725.4547119140625V0.0Z M1604.3509521484375 30.0Q1438.100341796875 30.0 1312.699951171875 -37.07513427734375Q1187.299560546875 -104.1502685546875 1117.4243774414062 -224.6505126953125Q1047.5491943359375 -345.1507568359375 1047.5491943359375 -505.901123046875Q1047.5491943359375 -623.0513916015625 1088.1243286132812 -721.2765502929688Q1128.699462890625 -819.501708984375 1202.5247192382812 -891.2767944335938Q1276.3499755859375 -963.0518798828125 1376.2503662109375 -1002.5269165039062Q1476.1507568359375 -1042.001953125 1595.4512939453125 -1042.001953125Q1726.60205078125 -1042.001953125 1829.0526123046875 -995.6766967773438Q1931.503173828125 -949.3514404296875 1998.7785034179688 -866.3259887695312Q2066.0538330078125 -783.300537109375 2092.40380859375 -671.7249145507812Q2118.7537841796875 -560.1492919921875 2096.0533447265625 -428.99853515625H1323.6549072265625Q1324.1551513671875 -361.400390625 1360.4297485351562 -310.62677001953125Q1396.704345703125 -259.8531494140625 1462.0533447265625 -231.32891845703125Q1527.40234375 -202.8046875 1614.4508056640625 -202.8046875Q1703.1512451171875 -202.8046875 1783.2263793945312 -226.72955322265625Q1863.301513671875 -250.6544189453125 1934.8521728515625 -299.704345703125L2033.00341796875 -95.2001953125Q1985.9534912109375 -58.100341796875 1913.2530517578125 -29.80029296875Q1840.5526123046875 -1.500244140625 1759.4769897460938 14.2498779296875Q1678.4013671875 30.0 1604.3509521484375 30.0ZM1341.9554443359375 -634.40234375H1809.6470947265625Q1807.5472412109375 -720.9500732421875 1748.9481201171875 -771.5739135742188Q1690.3489990234375 -822.19775390625 1587.6510009765625 -822.19775390625Q1485.40283203125 -822.19775390625 1418.2789916992188 -771.5739135742188Q1351.1551513671875 -720.9500732421875 1341.9554443359375 -634.40234375Z M2625.5521240234375 28.699951171875Q2488.7508544921875 28.699951171875 2374.0501708984375 -6.4500732421875Q2259.3494873046875 -41.60009765625 2177.2486572265625 -104.400390625L2274.3499755859375 -312.20458984375Q2353.7508544921875 -259.1546630859375 2446.3764038085938 -228.32965087890625Q2539.001953125 -197.504638671875 2623.6519775390625 -197.504638671875Q2706.500732421875 -197.504638671875 2751.0748901367188 -222.37884521484375Q2795.6490478515625 -247.2530517578125 2795.6490478515625 -293.501708984375Q2795.6490478515625 -335.7503662109375 2755.7246704101562 -355.399658203125Q2715.80029296875 -375.0489501953125 2601.2515869140625 -397.79833984375Q2400.100341796875 -433.998046875 2307.5746459960938 -511.9486083984375Q2215.0489501953125 -589.899169921875 2215.0489501953125 -726.60009765625Q2215.0489501953125 -823.80078125 2268.79931640625 -897.0261840820312Q2322.5496826171875 -970.2515869140625 2417.100341796875 -1011.1267700195312Q2511.6510009765625 -1052.001953125 2635.0518798828125 -1052.001953125Q2755.502685546875 -1052.001953125 2862.7785034179688 -1019.2518310546875Q2970.0543212890625 -986.501708984375 3047.0548095703125 -928.20166015625L2953.9534912109375 -719.697509765625Q2913.503173828125 -751.7474365234375 2861.5278930664062 -775.597412109375Q2809.5526123046875 -799.4473876953125 2753.00244140625 -812.6223754882812Q2696.4522705078125 -825.79736328125 2642.7523193359375 -825.79736328125Q2570.703369140625 -825.79736328125 2526.5291137695312 -802.2731323242188Q2482.3548583984375 -778.7489013671875 2482.3548583984375 -736.500244140625Q2482.3548583984375 -693.8516845703125 2521.9789428710938 -673.40234375Q2561.60302734375 -652.9530029296875 2673.5521240234375 -628.4033203125Q2884.103759765625 -584.503173828125 2973.2293090820312 -511.37786865234375Q3062.3548583984375 -438.2525634765625 3062.3548583984375 -306.701904296875Q3062.3548583984375 -205.4013671875 3007.2794799804688 -130.02593994140625Q2952.2041015625 -54.6505126953125 2853.9534912109375 -12.97528076171875Q2755.702880859375 28.699951171875 2625.5521240234375 28.699951171875Z M3710.3509521484375 30.0Q3544.100341796875 30.0 3418.699951171875 -37.07513427734375Q3293.299560546875 -104.1502685546875 3223.4243774414062 -224.6505126953125Q3153.5491943359375 -345.1507568359375 3153.5491943359375 -505.901123046875Q3153.5491943359375 -623.0513916015625 3194.1243286132812 -721.2765502929688Q3234.699462890625 -819.501708984375 3308.5247192382812 -891.2767944335938Q3382.3499755859375 -963.0518798828125 3482.2503662109375 -1002.5269165039062Q3582.1507568359375 -1042.001953125 3701.4512939453125 -1042.001953125Q3832.60205078125 -1042.001953125 3935.0526123046875 -995.6766967773438Q4037.503173828125 -949.3514404296875 4104.778503417969 -866.3259887695312Q4172.0538330078125 -783.300537109375 4198.40380859375 -671.7249145507812Q4224.7537841796875 -560.1492919921875 4202.0533447265625 -428.99853515625H3429.6549072265625Q3430.1551513671875 -361.400390625 3466.4297485351562 -310.62677001953125Q3502.704345703125 -259.8531494140625 3568.0533447265625 -231.32891845703125Q3633.40234375 -202.8046875 3720.4508056640625 -202.8046875Q3809.1512451171875 -202.8046875 3889.2263793945312 -226.72955322265625Q3969.301513671875 -250.6544189453125 4040.8521728515625 -299.704345703125L4139.00341796875 -95.2001953125Q4091.9534912109375 -58.100341796875 4019.2530517578125 -29.80029296875Q3946.5526123046875 -1.500244140625 3865.4769897460938 14.2498779296875Q3784.4013671875 30.0 3710.3509521484375 30.0ZM3447.9554443359375 -634.40234375H3915.6470947265625Q3913.5472412109375 -720.9500732421875 3854.9481201171875 -771.5739135742188Q3796.3489990234375 -822.19775390625 3693.6510009765625 -822.19775390625Q3591.40283203125 -822.19775390625 3524.2789916992188 -771.5739135742188Q3457.1551513671875 -720.9500732421875 3447.9554443359375 -634.40234375Z M4361.7489013671875 0.0V-1440.0H4660.9559326171875V0.0Z M4892.7489013671875 0.0V-1012.001953125H5191.9559326171875V0.0ZM5042.3524169921875 -1169.80029296875Q4968.2510986328125 -1169.80029296875 4914.10009765625 -1216.1510009765625Q4859.9490966796875 -1262.501708984375 4859.9490966796875 -1340.503173828125Q4859.9490966796875 -1418.504638671875 4914.10009765625 -1464.8553466796875Q4968.2510986328125 -1511.2060546875 5042.3524169921875 -1511.2060546875Q5116.4537353515625 -1511.2060546875 5170.604736328125 -1464.8553466796875Q5224.7557373046875 -1418.504638671875 5224.7557373046875 -1340.503173828125Q5224.7557373046875 -1262.501708984375 5170.604736328125 -1216.1510009765625Q5116.4537353515625 -1169.80029296875 5042.3524169921875 -1169.80029296875Z M5706.899658203125 30.0Q5605.1497802734375 30.0 5524.9495849609375 -9.12506103515625Q5444.7493896484375 -48.2501220703125 5398.424133300781 -120.9503173828125Q5352.098876953125 -193.6505126953125 5352.098876953125 -294.700927734375Q5352.098876953125 -381.0513916015625 5395.1490478515625 -448.42657470703125Q5438.19921875 -515.8017578125 5525.79931640625 -559.4268188476562Q5613.3994140625 -603.0518798828125 5747.524230957031 -618.3519287109375Q5881.6490478515625 -633.6519775390625 6063.79833984375 -616.502197265625L6067.1982421875 -426.798828125Q5961.0509033203125 -444.2486572265625 5878.927307128906 -443.89892578125Q5796.8037109375 -443.5491943359375 5740.7542724609375 -427.72467041015625Q5684.704833984375 -411.900146484375 5655.6549072265625 -382.0506591796875Q5626.60498046875 -352.201171875 5626.60498046875 -309.6514892578125Q5626.60498046875 -251.502685546875 5670.104248046875 -220.6534423828125Q5713.603515625 -189.80419921875 5787.2520751953125 -189.80419921875Q5851.3509521484375 -189.80419921875 5902.4500732421875 -212.62872314453125Q5953.5491943359375 -235.4532470703125 5983.723693847656 -278.7525634765625Q6013.898193359375 -322.0518798828125 6013.898193359375 -383.80126953125V-624.499267578125Q6013.898193359375 -682.6485595703125 5989.6485595703125 -726.4481201171875Q5965.39892578125 -770.2476806640625 5913.924377441406 -794.7224731445312Q5862.4498291015625 -819.197265625 5779.300048828125 -819.197265625Q5700.699951171875 -819.197265625 5623.424865722656 -795.5472412109375Q5546.1497802734375 -771.897216796875 5481.900146484375 -724.3974609375L5403.8487548828125 -932.301513671875Q5501.5491943359375 -994.9515380859375 5611.3499755859375 -1023.4767456054688Q5721.1507568359375 -1052.001953125 5825.501708984375 -1052.001953125Q5968.2021484375 -1052.001953125 6074.877868652344 -1006.7767944335938Q6181.5535888671875 -961.5516357421875 6240.829162597656 -867.7510986328125Q6300.104736328125 -773.9505615234375 6300.104736328125 -628.3994140625V0.0H6039.899169921875V-110.3994140625Q5990.499267578125 -42.8497314453125 5903.699462890625 -6.42486572265625Q5816.899658203125 30.0 5706.899658203125 30.0Z"
            /></g
          ></g
        ></svg
      ></span
    >
    <span
      class="status"
      class:offline={!connection.online}
      class:post={feed?.viaCommandPost}
      role="status"
    >
      <span class="dot" aria-hidden="true"></span>
      <span class="status-text">
        {#if feed?.viaCommandPost}{t('commandPost')}{:else if connection.online}{t(
            'online',
          )}{:else}{t('offline')}{/if}
      </span>
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
        title={feed
          ? t(feed.viaCommandPost ? 'syncViaCommandPost' : SYNC_LABELS[feed.status])
          : undefined}
      >
        {#if feed}<span class="sync {feed.status}" aria-hidden="true"></span>{/if}
        {groupLabel}
      </button>
    {/if}
    {#if session?.identity}
      <button
        class="radio"
        onclick={() => {
          togglePanel('radio');
        }}
        aria-expanded={panels.open === 'radio'}
        aria-label="{t('radio')}: {radio.linked
          ? t('radioConnected', { name: radio.name ?? t('radioUnnamed') })
          : t('radioConnect')}"
      >
        <span
          class="sync"
          class:synced={radio.linked}
          class:connecting={radio.state === 'connecting' ||
            (radio.state === 'ready' && !radio.linked)}
          aria-hidden="true"
        ></span>
        LoRa
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
      <MapWorkspace {t} {locale} {map} group={workspaceGroup} {radio} />
    {/if}

    {#if map && store && panels.open === 'offline'}
      <OfflineAreasPanel {t} {locale} {map} {store} {archive} onclose={closePanel} />
    {/if}

    {#if panels.open === 'radio'}
      <RadioPanel {t} {radio} groupName={session?.activeGroup?.name ?? null} onclose={closePanel} />
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

  .brand :global(svg) {
    height: 1.45rem;
    width: auto;
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

  /* Connected, but only as far as the command post: online for the group, not for the world. */
  .status.post .dot {
    background: var(--accent);
  }

  main {
    position: relative;
    overflow: hidden;
  }

  .radio {
    flex-shrink: 0;
    color: inherit;
    white-space: nowrap;
    border-color: rgb(248 250 252 / 35%);
  }

  /* On narrow screens the dot says it all. */
  @media (max-width: 30rem) {
    .status-text {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }
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
