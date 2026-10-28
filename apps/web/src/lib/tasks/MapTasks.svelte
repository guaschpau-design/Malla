<!-- The tasks on the map, and a notice when someone hands one to this device. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import type { NodeId } from '@tesel/protocol';
  import type { Map as MapLibreMap } from 'maplibre-gl';
  import { untrack } from 'svelte';

  import type { Translate } from '../i18n/index.ts';
  import { aliasOf } from '../members/alias.ts';
  import type { MapTaps } from '../map/taps.ts';
  import { notices } from '../ui/notices.svelte.ts';
  import { editTask } from './task-editor.ts';
  import TaskLayer from './TaskLayer.svelte';
  import { assignedTo, newlyAssigned } from './tasks.ts';

  interface Props {
    t: Translate;
    map: MapLibreMap;
    taps: MapTaps;
    tasks: GroupState['tasks'];
    members: GroupState['members'];
    self: NodeId;
    visible: boolean;
  }

  let { t, map, taps, tasks, members, self, visible }: Props = $props();

  const mine = $derived(assignedTo({ tasks }, self));
  // What was already assigned when the group opened is not news.
  let known = untrack(() => mine);

  $effect(() => {
    const now = mine;
    const [handed] = newlyAssigned(known, now, self);
    known = now;
    if (handed === undefined) return;
    notices.show(
      t('taskHandedToYou', { name: aliasOf({ members }, handed.origin), text: handed.text }),
    );
  });
</script>

<TaskLayer {map} {taps} {tasks} {visible} onselect={editTask} />
