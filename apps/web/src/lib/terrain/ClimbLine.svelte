<!-- How much the straight way from here to a point climbs and descends, and its steepest stretch.
     Worked out again when the device has moved a little or the point changes. -->
<script lang="ts">
  import { distanceMeters } from '@tesel/core';
  import type { LatLon } from '@tesel/protocol';

  import type { Translate } from '../i18n/index.ts';
  import { climbOf, samplesAlong, type Climb } from './climb.ts';
  import type { ElevationReader } from './elevation.ts';

  interface Props {
    t: Translate;
    from: LatLon;
    to: LatLon;
    terrain: ElevationReader;
  }

  let { t, from, to, terrain }: Props = $props();

  /**
   * Closer than this, the way is the same as far as its samples, 30 m apart (climb.ts), can tell:
   * the elevation itself, about 10 m apart, is finer.
   */
  const RECOMPUTE_AFTER_M = 25;

  let climb: Climb | null = $state.raw(null);
  /** The ends of the way last worked out, so small moves do not redo it. */
  let worked: { from: LatLon; to: LatLon } | null = null;
  /** Only the latest request may set the result; an older one may answer later. */
  let latest = 0;

  $effect(() => {
    const ends = { from, to };
    if (
      worked !== null &&
      distanceMeters(worked.from, ends.from) < RECOMPUTE_AFTER_M &&
      distanceMeters(worked.to, ends.to) < 1
    ) {
      return;
    }
    worked = ends;
    const samples = samplesAlong(ends.from, ends.to);
    const request = ++latest;
    void terrain.elevations(samples).then((elevations) => {
      if (request === latest) climb = climbOf(samples, elevations);
    });
  });

  /** Climbs to the nearest 5 m: the data is not finer. */
  const metres = (value: number) => String(Math.round(value / 5) * 5);
</script>

{#if climb}
  <p class="climb">
    {t('climb', {
      up: metres(climb.up),
      down: metres(climb.down),
      steepest: String(Math.round(climb.steepest)),
    })}
  </p>
{/if}

<style>
  .climb {
    margin: 0;
    font-variant-numeric: tabular-nums;
  }
</style>
