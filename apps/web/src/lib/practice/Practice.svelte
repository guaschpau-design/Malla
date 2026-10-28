<!-- A practice in progress (ADR-0031, ADR-0066): its simulated teammates play their part around
     where the user is, on the streets of the map, read first. A card on the map says what is
     going on, guides the user through five things to try, one at a time, and ends the practice. -->
<script lang="ts">
  import type { LatLon, NodeId, Role } from '@tesel/protocol';
  import { WalkNetwork } from '@tesel/scenario';
  import { untrack } from 'svelte';

  import type { Translate } from '../i18n/index.ts';
  import { findTile } from '../map/tiles/protocol.ts';
  import { walkwaysAround } from '../map/tiles/walkways.ts';
  import type { OfflineMaps } from '../offline/offline-maps.ts';
  import type { GroupFeed } from '../sync/group-feed.svelte.ts';
  import MapCard from '../ui/MapCard.svelte';
  import { panels } from '../ui/panels.svelte.ts';
  import { guideSteps } from './guide.ts';
  import { PracticeRun } from './practice-run.ts';
  import { SITUATION_INFO, type Situation } from './situations.ts';

  interface Props {
    t: Translate;
    feed: GroupFeed;
    self: NodeId;
    /** The user's part: a member of the team or its coordinator. */
    role: Role;
    situation: Situation;
    /** Where the practice takes place: this device, or the middle of the map. */
    centre: LatLon;
    /** The base map's tiles, for its streets. */
    offline: OfflineMaps;
    onend: () => void;
  }

  let { t, feed, self, role, situation, centre, offline, onend }: Props = $props();

  /** Metres round the centre whose streets are read: as far as the scenes reach, and some. */
  const STREETS_RADIUS_M = 700;

  const info = $derived(SITUATION_INFO[situation]);
  // One scenario and one run for the life of the component, where and in the language it started.
  const scenario = untrack(() => SITUATION_INFO[situation].scenario(t, centre, role));
  let run: PracticeRun | null = $state.raw(null);

  $effect(() => {
    let ended = false;
    let started: PracticeRun | null = null;
    const { store, archives } = untrack(() => offline);
    void untrack(() =>
      walkwaysAround(centre, STREETS_RADIUS_M, (tile) =>
        findTile('basemap', tile, store, archives),
      ),
    )
      .catch(() => [])
      .then((lines) => {
        if (ended) return;
        started = new PracticeRun(scenario, {
          sink: (bytes) => feed.receiveSimulated(bytes),
          self,
          t,
          network: WalkNetwork.from(lines),
        });
        started.start();
        run = started;
      });
    return () => {
      ended = true;
      started?.stop();
    };
  });

  $effect(() => {
    run?.react(feed.state);
  });

  /** Whether the user has opened a teammate's card, which the guide's first step asks. */
  let teammateSeen = $state(false);
  $effect(() => {
    if (panels.open?.name === 'member') teammateSeen = true;
  });

  let guiding = $state(true);
  const steps = $derived(guideSteps(role, info.search));
  const current = $derived(
    steps.findIndex((step) => !step.done(feed.state, self, { teammate: teammateSeen })),
  );
</script>

<MapCard label={t('practice')} edge="var(--info)">
  <div class="head">
    <strong>{t(info.title)}</strong>
    <button class="ghost" onclick={onend}>{t('endPractice')}</button>
  </div>
  {#if run === null}
    <p class="hint">{t('practicePreparing')}</p>
  {:else if guiding}
    {@const step = steps[current]}
    <div class="guide">
      {#if step}
        <p>
          <span class="hint">{t('guideStep', { step: current + 1, steps: steps.length })}</span>
          {t(step.text)}
        </p>
        <button class="ghost" onclick={() => (guiding = false)}>{t('guideSkip')}</button>
      {:else}
        <p>{t('guideDone')}</p>
      {/if}
    </div>
  {:else}
    <p>{scenario.description}</p>
  {/if}
</MapCard>

<style>
  /* The situation, and the way out of the practice beside it. */
  .head {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    justify-content: space-between;
  }

  .head button,
  .guide button {
    min-height: 0;
    padding: 0.2rem 0.4rem;
    color: var(--muted);
    font-size: var(--text-small);
  }

  /* The step to take now, with the way to skip the guide under it. */
  .guide {
    display: grid;
    gap: 0.1rem;
    padding: 0.4rem 0.6rem;
    background: var(--bg);
    border-radius: var(--radius-control);
  }

  .guide p {
    display: grid;
    margin: 0;
  }

  .guide .hint {
    font-size: var(--text-small);
  }

  .guide button {
    justify-self: end;
  }
</style>
