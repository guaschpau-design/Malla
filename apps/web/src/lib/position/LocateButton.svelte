<!-- Among the map's controls: shows this device on the map and keeps the map centred on it. -->
<script lang="ts">
  import type { Map as MapLibreMap } from 'maplibre-gl';
  import { onMount, untrack } from 'svelte';

  import type { MessageKey, Translate } from '../i18n/index.ts';
  import Pictogram from '../ui/Pictogram.svelte';
  import { deviceLocation } from './device-location.svelte.ts';
  import { afterPan, afterPress, type FollowMode } from './follow.ts';

  interface Props {
    t: Translate;
    map: MapLibreMap;
  }

  let { t, map }: Props = $props();

  /** How close the map zooms in when it starts following. */
  const FOLLOW_ZOOM = 16;
  /** What pressing the button does, by mode. */
  const ACTIONS: Readonly<Record<FollowMode, MessageKey>> = {
    off: 'locateStart',
    follow: 'locateStop',
    show: 'locateCentre',
  };

  let mode: FollowMode = $state('off');
  const on = $derived(mode !== 'off');
  /** Zoom in only on the first fix after a press, not on every fix while following. */
  let zoomIn = false;

  function press(): void {
    mode = afterPress(mode);
    zoomIn = mode === 'follow';
  }

  // The GPS stays on while this device is shown.
  $effect(() => {
    if (on) return deviceLocation.use();
  });

  $effect(() => {
    const fix = deviceLocation.fix;
    if (mode !== 'follow' || fix === null) return;
    untrack(() => {
      const zoom = zoomIn ? Math.max(map.getZoom(), FOLLOW_ZOOM) : map.getZoom();
      map.easeTo({ center: [fix.at.lon, fix.at.lat], zoom });
      zoomIn = false;
    });
  });

  onMount(() => {
    const panned = () => {
      mode = afterPan(mode);
    };
    map.on('dragstart', panned);
    return () => {
      map.off('dragstart', panned);
    };
  });
</script>

<button
  class="locate {mode}"
  onclick={press}
  aria-pressed={mode === 'follow'}
  aria-label={t(ACTIONS[mode])}
  title={t(ACTIONS[mode])}
>
  <Pictogram name="locate" size={18} />
</button>

<style>
  /* On the ink of the map's controls, as on the dock: lime when shown, filled while following. */
  .locate.show {
    color: var(--signal);
  }

  .locate.follow {
    color: var(--on-accent);
    background: var(--signal);
  }
</style>
