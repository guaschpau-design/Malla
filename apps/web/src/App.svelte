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
      ><svg class="lockup" role="img" aria-label="Teselia" viewBox="0 0 760.7 150.0"
        ><g transform="scale(1.5000)"
          ><path
            d="M46.17 20.74 L46.17 41.49 L28.20 51.87 L10.23 41.49 L10.23 20.74 L28.20 10.37 Z"
            fill="currentColor"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linejoin="round"
          /><path
            d="M89.77 20.74 L89.77 41.49 L71.80 51.87 L53.83 41.49 L53.83 20.74 L71.80 10.37 Z"
            fill="#f26a2e"
            stroke="#f26a2e"
            stroke-width="2.5"
            stroke-linejoin="round"
          /><path
            d="M67.97 58.51 L67.97 79.26 L50.00 89.63 L32.03 79.26 L32.03 58.51 L50.00 48.13 Z"
            fill="currentColor"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linejoin="round"
          /></g
        ><g transform="translate(192.0 25.00)" fill="currentColor"
          ><g transform="scale(0.145773)"
            ><path
              d="M305.7573166936636 0.0V-553.989115357399H25.483400985598564V-686.8313013762236H740.2671179920435V-553.989115357399H459.7618841379881V0.0Z M1019.9269257485867 12.0Q922.0107270181179 12.0 852.3310051783919 -17.468690238893032Q782.651283338666 -46.937380477786064 745.3106105178595 -107.96869023889303Q707.969937697053 -169.0 707.969937697053 -263.08697509765625Q707.969937697053 -355.94097135961056 744.6097717881203 -417.1731198504567Q781.2496058791876 -478.4052683413029 850.3710365965962 -508.6182848587632Q919.4924673140049 -538.8313013762236 1015.7217077165842 -538.8313013762236Q1113.6271897405386 -538.8313013762236 1180.6120619401336 -508.96093367785215Q1247.5969341397285 -479.09056597948074 1281.5794170498848 -420.2452913746238Q1315.561899960041 -361.4000167697668 1315.561899960041 -273.82393395900726V-229.85919189453125H854.7448018193245Q857.3534418493509 -181.92724864184856 877.4452183991671 -151.77158612012863Q897.5369949489832 -121.6159235984087 934.4555867910385 -107.77150730788708Q971.3741786330938 -93.92709101736546 1022.8398209363222 -93.92709101736546Q1045.718228712678 -93.92709101736546 1070.8309975340962 -99.26973983645439Q1095.9437663555145 -104.61238865554333 1117.8233287632465 -115.29506050795317Q1139.7028911709785 -125.977732360363 1154.3311731144786 -142.83685939759016Q1168.9594550579786 -159.6959864348173 1170.9315086007118 -183.13062033057213H1312.8698757141829Q1312.8698757141829 -139.7771988660097 1292.6968296393752 -103.70756030082703Q1272.5237835645676 -67.63792173564434 1234.1995470374823 -41.87103532254696Q1195.875310510397 -16.104148909449577 1141.6373534873128 -2.0520744547247887Q1087.3993964642286 12.0 1019.9269257485867 12.0ZM855.3431243598461 -321.0000559389591H1167.1939089298248Q1167.1939089298248 -350.0764719545841 1155.755025446415 -371.10250217467546Q1144.316141963005 -392.1285323947668 1123.8374266698956 -405.8694025427103Q1103.3587113767862 -419.6102726906538 1076.3122178167105 -426.1294046640396Q1049.2657242566347 -432.6485366374254 1017.8574499040842 -432.6485366374254Q970.8022715747356 -432.6485366374254 935.6471379846334 -420.1198526620865Q900.4920043945312 -407.59116868674755 880.4053865894675 -382.55818428099155Q860.3187687844038 -357.52519987523556 855.3431243598461 -321.0000559389591Z M1669.313702866435 12.0Q1611.687693297863 12.0 1560.971359282732 1.7329788357019424Q1510.255025267601 -8.534042328596115 1472.1560529395938 -28.368906617164612Q1434.0570806115866 -48.20377090573311 1412.438939422369 -78.54725006967783Q1390.8207982331514 -108.89072923362255 1390.8207982331514 -149.3862940520048Q1390.8207982331514 -154.2123438566923 1391.2773106843233 -158.1688563078642Q1391.7338231354952 -162.12536875903606 1392.4781494140625 -165.6140213161707H1534.8164035826921Q1534.729428485036 -164.12177787721157 1534.4007528945804 -161.40876135975122Q1534.0720773041248 -158.69574484229088 1534.0720773041248 -156.69574484229088Q1534.4147261232138 -131.8558426052332 1553.8266282454133 -116.79587683826685Q1573.2385303676128 -101.7359110713005 1604.5302873328328 -95.18287152051926Q1635.8220442980528 -88.629831969738 1671.2494226545095 -88.629831969738Q1705.127003967762 -88.629831969738 1736.6995836868882 -93.16806794703007Q1768.2721634060144 -97.70630392432213 1788.3771756663918 -109.814915984869Q1808.4821879267693 -121.92352804541588 1808.4821879267693 -145.12330885231495Q1808.4821879267693 -170.46577201783657 1785.1622378751636 -182.2814115062356Q1761.8422878235579 -194.09705099463463 1719.7983031347394 -201.0553309172392Q1677.754318445921 -208.01361083984375 1621.2944007068872 -217.07097879052162Q1577.7731349915266 -224.49535113573074 1539.3263741508126 -235.4275080114603Q1500.8796133100986 -246.35966488718987 1471.303155310452 -263.79444754868746Q1441.7266973108053 -281.22923021018505 1424.9970817789435 -308.76316575706005Q1408.2674662470818 -336.29710130393505 1408.2674662470818 -376.63109332323074Q1408.2674662470818 -419.39117431640625 1427.6466395109892 -449.8677419126034Q1447.0258127748966 -480.3443095088005 1482.5144843831658 -499.93128460645676Q1518.003155991435 -519.518259704113 1567.5507913827896 -529.0591214671731Q1617.0984267741442 -538.5999832302332 1677.4353510290384 -538.5999832302332Q1732.181078568101 -538.5999832302332 1778.4965654686093 -529.0904312282801Q1824.8120523691177 -519.5808792263269 1859.5450502559543 -500.7835133969784Q1894.2780481427908 -481.9861475676298 1913.9745495542884 -454.2583274766803Q1933.671050965786 -426.53050738573074 1933.671050965786 -391.0069961100817Q1933.671050965786 -386.32695004343987 1933.5432141050696 -381.8451169207692Q1933.4153772443533 -377.36328379809856 1932.671050965786 -374.3042551577091H1790.7624207139015V-379.4191767126322Q1790.7624207139015 -399.9180908203125 1774.888754568994 -412.67889531701803Q1759.0150884240866 -425.43969981372356 1733.1293373182416 -431.82058461010456Q1707.2435862123966 -438.20146940648556 1674.9830322265625 -438.20146940648556Q1660.248939588666 -438.20146940648556 1638.810951307416 -436.4779357910156Q1617.372963026166 -434.7544021755457 1596.8960152044892 -429.74568051844835Q1576.4190673828125 -424.736958861351 1562.7202885597944 -415.582233466208Q1549.0215097367764 -406.42750807106495 1549.0215097367764 -390.652099609375Q1549.0215097367764 -370.0383936613798 1571.1046624928713 -359.4054260253906Q1593.1878152489662 -348.77245838940144 1629.3099325820804 -342.8141784667969Q1665.4320499151945 -336.8558985441923 1707.5254184156656 -329.5811208188534Q1754.0605925023556 -322.0019582211971 1797.7004355117679 -312.71064633876085Q1841.3402785211802 -303.4193344563246 1875.4038212150335 -286.61761225759983Q1909.467363908887 -269.8158900588751 1929.4796345233917 -240.23846696317196Q1949.4919051378965 -210.66104386746883 1949.4919051378965 -162.2539851218462Q1949.4919051378965 -113.586130797863 1929.9414074644446 -80.08087922632694Q1910.3909097909927 -46.57562765479088 1873.7865791097283 -26.28781382739544Q1837.182248428464 -6.0 1785.4337743073702 3.0Q1733.6853001862764 12.0 1669.313702866435 12.0Z M2337.9269257485867 12.0Q2240.010727018118 12.0 2170.331005178392 -17.468690238893032Q2100.651283338666 -46.937380477786064 2063.3106105178595 -107.96869023889303Q2025.969937697053 -169.0 2025.969937697053 -263.08697509765625Q2025.969937697053 -355.94097135961056 2062.6097717881203 -417.1731198504567Q2099.2496058791876 -478.4052683413029 2168.3710365965962 -508.6182848587632Q2237.492467314005 -538.8313013762236 2333.721707716584 -538.8313013762236Q2431.6271897405386 -538.8313013762236 2498.6120619401336 -508.96093367785215Q2565.5969341397285 -479.09056597948074 2599.579417049885 -420.2452913746238Q2633.561899960041 -361.4000167697668 2633.561899960041 -273.82393395900726V-229.85919189453125H2172.7448018193245Q2175.353441849351 -181.92724864184856 2195.445218399167 -151.77158612012863Q2215.536994948983 -121.6159235984087 2252.4555867910385 -107.77150730788708Q2289.374178633094 -93.92709101736546 2340.839820936322 -93.92709101736546Q2363.718228712678 -93.92709101736546 2388.8309975340962 -99.26973983645439Q2413.9437663555145 -104.61238865554333 2435.8233287632465 -115.29506050795317Q2457.7028911709785 -125.977732360363 2472.3311731144786 -142.83685939759016Q2486.9594550579786 -159.6959864348173 2488.931508600712 -183.13062033057213H2630.869875714183Q2630.869875714183 -139.7771988660097 2610.696829639375 -103.70756030082703Q2590.5237835645676 -67.63792173564434 2552.1995470374823 -41.87103532254696Q2513.875310510397 -16.104148909449577 2459.637353487313 -2.0520744547247887Q2405.3993964642286 12.0 2337.9269257485867 12.0ZM2173.343124359846 -321.0000559389591H2485.193908929825Q2485.193908929825 -350.0764719545841 2473.755025446415 -371.10250217467546Q2462.316141963005 -392.1285323947668 2441.8374266698956 -405.8694025427103Q2421.3587113767862 -419.6102726906538 2394.3122178167105 -426.1294046640396Q2367.2657242566347 -432.6485366374254 2335.857449904084 -432.6485366374254Q2288.8022715747356 -432.6485366374254 2253.6471379846334 -420.1198526620865Q2218.4920043945312 -407.59116868674755 2198.4053865894675 -382.55818428099155Q2178.318768784404 -357.52519987523556 2173.343124359846 -321.0000559389591Z M2738.509231597185 0.0V-723.8313013762236H2879.289421066642V0.0Z M3006.509231597185 -609.4655304253101V-723.8313013762236H3147.289421066642V-609.4655304253101ZM3006.509231597185 0.0V-526.8313013762236H3147.289421066642V0.0Z M3456.787638425827 12.0Q3416.0751368254423 12.0 3378.582364395261 5.04265720397234Q3341.0895919650793 -1.9146855920553207 3311.621003471315 -18.775501288473606Q3282.1524149775505 -35.63631698489189 3265.1750399693847 -65.50325652211905Q3248.197664961219 -95.3701960593462 3248.197664961219 -141.2276534885168Q3248.197664961219 -202.48651887476444 3280.035591199994 -238.41434735059738Q3311.8735174387693 -274.3421758264303 3370.092922322452 -291.68405915796757Q3428.312327206135 -309.0259424895048 3506.982083812356 -314.32433827221394Q3585.651840418577 -319.62273405492306 3678.4894513487816 -319.62273405492306V-346.4004897624254Q3678.4894513487816 -376.85747526586056 3664.721033960581 -395.96864825487137Q3650.95261657238 -415.0798212438822 3621.533194385469 -423.99201580137014Q3592.113772198558 -432.9042103588581 3543.11467243731 -432.9042103588581Q3502.344886854291 -432.9042103588581 3472.5592906177044 -426.3424491509795Q3442.773694381118 -419.78068794310093 3426.7687721326947 -407.7302741780877Q3410.7638498842716 -395.6798604130745 3410.7638498842716 -378.6399357765913V-366.82438911497593H3270.828943938017Q3269.828943938017 -371.0800628364086 3269.5002683475614 -375.2174516990781Q3269.171592757106 -379.35484056174755 3269.171592757106 -384.7792129069567Q3269.171592757106 -431.31657661497593 3301.665395140648 -465.9670015797019Q3334.15919752419 -500.6174265444279 3396.8562558963895 -519.7243639603257Q3459.553314268589 -538.8313013762236 3550.7265041321516 -538.8313013762236Q3638.621678739786 -538.8313013762236 3698.3648873344064 -521.0573260262609Q3758.1080959290266 -503.28335067629814 3788.6888683736324 -464.8938510045409Q3819.2696408182383 -426.5043513327837 3819.2696408182383 -363.9777043312788V-133.99860893189907Q3819.2696408182383 -115.25953422486782 3827.707986392081 -105.64041902124882Q3836.1463319659233 -96.02130381762981 3853.3513643443584 -96.02130381762981H3899.3787080943584V-5.005251571536064Q3888.8290407657623 -0.7443262785673141 3863.7212819233537 5.5Q3838.613523080945 11.744326278567314 3807.1387229561806 11.744326278567314Q3767.212077021599 11.744326278567314 3743.0059307813644 1.550506591796875Q3718.79978454113 -8.643313094973564 3706.7404354959726 -26.591011062264442Q3694.681086450815 -44.53870902955532 3689.846194192767 -66.95949049293995H3682.381897211075Q3657.3021776527166 -42.72144573926926 3622.7643777802587 -24.645910911262035Q3588.2265779078007 -6.570376083254814 3546.389616765082 2.714811958372593Q3504.552655622363 12.0 3456.787638425827 12.0ZM3494.7658158689737 -94.81409965455532Q3524.8733140677214 -94.81409965455532 3556.929294772446 -102.06974540650845Q3588.985275477171 -109.32539115846157 3616.7038220465183 -123.08536531031132Q3644.4223686158657 -136.84533946216106 3661.4559099823236 -157.46962736546993Q3678.4894513487816 -178.0939152687788 3678.4894513487816 -204.63814537227154V-231.68524169921875Q3583.9191870242357 -231.68524169921875 3519.4133047163486 -224.2139256745577Q3454.9074224084616 -216.74260964989662 3422.2322197183967 -198.7478612214327Q3389.5570170283318 -180.75311279296875 3389.5570170283318 -148.3098220974207Q3389.5570170283318 -127.56908670067787 3404.2601891085505 -116.02383168041706Q3418.9633611887693 -104.47857666015625 3443.14471065253 -99.64633815735579Q3467.326060116291 -94.81409965455532 3494.7658158689737 -94.81409965455532Z"
              transform="translate(0 686)"
            /></g
          ></g
        ></svg
      ><svg class="mark" aria-hidden="true" viewBox="0 0 100 100"
        ><path
          d="M46.17 20.74 L46.17 41.49 L28.20 51.87 L10.23 41.49 L10.23 20.74 L28.20 10.37 Z"
          fill="currentColor"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linejoin="round"
        /><path
          d="M89.77 20.74 L89.77 41.49 L71.80 51.87 L53.83 41.49 L53.83 20.74 L71.80 10.37 Z"
          fill="#f26a2e"
          stroke="#f26a2e"
          stroke-width="2.5"
          stroke-linejoin="round"
        /><path
          d="M67.97 58.51 L67.97 79.26 L50.00 89.63 L32.03 79.26 L32.03 58.51 L50.00 48.13 Z"
          fill="currentColor"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linejoin="round"
        /></svg
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

  .brand :global(.mark) {
    display: none;
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

  /* On narrow screens the dot says it all, and the mark stands for the name. */
  @media (max-width: 30rem) {
    .brand :global(.lockup) {
      display: none;
    }

    .brand :global(.mark) {
      display: block;
      height: 1.7rem;
    }

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
