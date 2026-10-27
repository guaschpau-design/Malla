<!-- A practice in progress: its simulated members play their part around where the user is, and a
     card on the map says it is a practice and ends it. -->
<script lang="ts">
  import type { LatLon, NodeId } from '@tesel/protocol';
  import { untrack } from 'svelte';

  import type { Translate } from '../i18n/index.ts';
  import type { GroupFeed } from '../sync/group-feed.svelte.ts';
  import MapCard from '../ui/MapCard.svelte';
  import { PracticeRun } from './practice-run.ts';
  import { practiceScenario } from './practice-scenario.ts';

  interface Props {
    t: Translate;
    feed: GroupFeed;
    self: NodeId;
    /** Where the practice takes place: this device, or the middle of the map. */
    centre: LatLon;
    onend: () => void;
  }

  let { t, feed, self, centre, onend }: Props = $props();

  // One run for the life of the component, where and in the language it started.
  const scenario = untrack(() => practiceScenario(t, centre));
  const run = untrack(
    () =>
      new PracticeRun(scenario, (bytes) => feed.receiveSimulated(bytes), {
        onTheWay: t('practiceOnTheWay'),
      }),
  );

  $effect(() => {
    run.start();
    return () => {
      run.stop();
    };
  });

  $effect(() => {
    run.react(feed.state, self);
  });
</script>

<MapCard edge="var(--info)">
  <p><strong>{t('practice')}</strong> · {scenario.description} {t('practiceHint')}</p>
  <div class="row">
    <button onclick={onend}>{t('endPractice')}</button>
  </div>
</MapCard>
