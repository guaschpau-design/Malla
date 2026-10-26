<!-- The tasks on the map, and a notice when someone hands one to this device. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import type { NodeId } from '@tesel/protocol';
  import type { Map as MapLibreMap } from 'maplibre-gl';
  import { untrack } from 'svelte';

  import type { Translate } from '../i18n/index.ts';
  import { aliasOf } from '../incidents/incidents.ts';
  import Toast from '../ui/Toast.svelte';
  import { editTask } from './task-editor.svelte.ts';
  import TaskLayer from './TaskLayer.svelte';
  import { assignedTo, newlyAssigned } from './tasks.ts';

  interface Props {
    t: Translate;
    map: MapLibreMap;
    groupState: GroupState;
    self: NodeId;
    /** False while drawing or measuring, so taps go there instead. */
    interactive: boolean;
    visible: boolean;
  }

  let { t, map, groupState, self, interactive, visible }: Props = $props();

  const NOTICE_MS = 6000;
  const mine = $derived(assignedTo(groupState, self));
  // What was already assigned when the group opened is not news.
  let known = untrack(() => mine);
  let notice: string | null = $state(null);
  let timer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    const now = mine;
    const [handed] = newlyAssigned(known, now, self);
    known = now;
    if (handed === undefined) return;
    notice = t('taskHandedToYou', { name: aliasOf(groupState, handed.origin), text: handed.text });
    clearTimeout(timer);
    timer = setTimeout(() => (notice = null), NOTICE_MS);
  });

  $effect(() => () => {
    clearTimeout(timer);
  });
</script>

<TaskLayer {map} {groupState} {interactive} {visible} onselect={editTask} />

{#if notice}
  <Toast>{notice}</Toast>
{/if}
