<!-- A practice in progress (ADR-0031, ADR-0066, ADR-0072): an exercise of some twenty-five minutes
     played around where the user is, on the streets of the map, read first. A card on the map
     says what is going on and for how long, guides the user through five things to try, one at a
     time, tells how it went once the exercise is over (ADR-0073), and ends the practice. -->
<script lang="ts">
  import type { LatLon, NodeId, Role } from '@tesel/protocol';
  import { untrack } from 'svelte';

  import type { Locale, Translate } from '../i18n/index.ts';
  import { findTile } from '../map/tiles/protocol.ts';
  import type { OfflineMaps } from '../offline/offline-maps.ts';
  import type { GroupFeed } from '../sync/group-feed.svelte.ts';
  import { ElevationReader } from '../terrain/elevation.ts';
  import MapCard from '../ui/MapCard.svelte';
  import { clockEvery } from '../ui/now.svelte.ts';
  import { panels } from '../ui/panels.svelte.ts';
  import { Chance } from './chance.ts';
  import { clockTime } from './clock-time.ts';
  import type { Debrief } from './debrief/debrief.ts';
  import DebriefView from './debrief/DebriefView.svelte';
  import { groundAround } from './ground-around.ts';
  import { guideSteps } from './guide.ts';
  import { PracticeRun } from './practice-run.ts';
  import { SITUATION_INFO, type Situation } from './situations.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    feed: GroupFeed;
    self: NodeId;
    /** The user's part: a member of the team or its coordinator. */
    role: Role;
    situation: Situation;
    /** Where this device is; null without a position. */
    here: LatLon | null;
    /** The middle of the map, where a practice takes place without a position, or the mountain. */
    mapCentre: LatLon;
    /** The base map's and the elevation's tiles, for the streets and the lie of the land. */
    offline: OfflineMaps;
    onend: () => void;
  }

  let { t, locale, feed, self, role, situation, here, mapCentre, offline, onend }: Props = $props();

  const info = $derived(SITUATION_INFO[situation]);
  /** The exercise's run, once the place is read, and when it started, in milliseconds. */
  let run: PracticeRun | null = $state.raw(null);
  let started = $state(0);
  /** How the exercise went, once it is over. */
  let debrief: Debrief | null = $state.raw(null);
  let description = $state('');
  /** Whether the place is not fit for the situation: no mountain where the map is. */
  let unfit = $state(false);

  // One exercise and one run for the life of the component, where and in the language it started:
  // the life of the practice, which ends when another group is used (session.svelte.ts).
  $effect(() => {
    let ended = false;
    let playing: PracticeRun | null = null;
    const { store, archives } = untrack(() => offline);
    const { heights, exercise, place, suits } = untrack(() => SITUATION_INFO[situation]);
    const centre = untrack(() => (place === 'map' ? mapCentre : (here ?? mapCentre)));
    const elevations = new ElevationReader((tile) => findTile('terrain', tile, store, archives));
    void untrack(() =>
      groundAround(
        centre,
        locale,
        (tile) => findTile('basemap', tile, store, archives),
        heights ? (points) => elevations.elevations(points) : null,
      ),
    ).then((ground) => {
      if (ended) return;
      if (suits !== undefined && !suits({ ground, centre })) {
        unfit = true;
        return;
      }
      const setting = untrack(() => ({
        t,
        locale,
        centre,
        user: role,
        ground,
        chance: new Chance(Date.now()),
      }));
      const built = exercise(setting);
      playing = new PracticeRun(built, {
        sink: (bytes) => feed.receiveSimulated(bytes),
        self,
        setting,
        onfinish: (report) => {
          debrief = report;
        },
      });
      playing.start();
      description = built.scenario.description;
      started = Date.now();
      run = playing;
    });
    return () => {
      ended = true;
      playing?.stop();
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

  const clock = clockEvery(1000);
  /** How long the exercise has run, in minutes and seconds. */
  const elapsed = $derived(clockTime(clock.seconds - started / 1000));
</script>

<MapCard label={t('practice')} edge="var(--info)">
  <div class="head">
    <strong>
      {t(info.title)}
      {#if run !== null && debrief === null}<span class="clock">{elapsed}</span>{/if}
    </strong>
    <button class="ghost" onclick={onend}>{t('endPractice')}</button>
  </div>
  {#if unfit}
    <p>{t('practiceNoMountain')}</p>
  {:else if run === null}
    <p class="hint">{t('practicePreparing')}</p>
  {:else if debrief !== null}
    <DebriefView {t} {debrief} />
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
    <p>{description}</p>
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
    position: relative;
    min-height: 0;
    padding: 0.2rem 0.4rem;
    color: var(--muted);
    font-size: var(--text-small);
  }

  /* Small to look at, but as easy to hit as any button: the tap area reaches past the text. */
  .head button::before,
  .guide button::before {
    position: absolute;
    inset: -0.6rem -0.25rem;
    content: '';
  }

  /* How long the exercise has run, beside its name, in figures that do not jump about. */
  .clock {
    margin-left: 0.4rem;
    color: var(--muted);
    font-size: var(--text-small);
    font-variant-numeric: tabular-nums;
    font-weight: 400;
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
