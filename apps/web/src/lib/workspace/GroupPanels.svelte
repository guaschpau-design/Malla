<!-- The panels about the active group: an object, a member, the diary, the chat and the tasks. -->
<script lang="ts">
  import type { AlertLevel, EventRef, LatLon, NodeId, Role } from '@tesel/protocol';

  import ChatPanel from '../chat/ChatPanel.svelte';
  import DiaryPanel from '../diary/DiaryPanel.svelte';
  import MemberDetails from '../groups/MemberDetails.svelte';
  import type { Locale, Translate } from '../i18n/index.ts';
  import { navigateTo } from '../navigation/navigation.svelte.ts';
  import ObjectDetails from '../objects/ObjectDetails.svelte';
  import type { DeviceLocation } from '../position/device-location.svelte.ts';
  import type { RadioSession } from '../radio/radio.svelte.ts';
  import type { Preferences } from '../settings/preferences.ts';
  import type { GroupFeed } from '../sync/group-feed.svelte.ts';
  import { newTask } from '../tasks/task-editor.svelte.ts';
  import TasksPanel from '../tasks/TasksPanel.svelte';
  import type { TaskFields } from '../tasks/tasks.ts';
  import { closePanel, panels } from '../ui/panels.svelte.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    feed: GroupFeed;
    self: NodeId;
    role: Role;
    radio: RadioSession;
    location: DeviceLocation;
    preferences: Preferences;
    /** The object or member last tapped on the map. */
    objectKey: string | null;
    memberId: NodeId | null;
    /** Shows a point of the map with what can be done there. */
    onshow: (at: LatLon) => void;
  }

  let {
    t,
    locale,
    feed,
    self,
    role,
    radio,
    location,
    preferences,
    objectKey,
    memberId,
    onshow,
  }: Props = $props();
</script>

{#if panels.open === 'object' && objectKey}
  {@const key = objectKey}
  <ObjectDetails
    {t}
    {locale}
    groupState={feed.state}
    objectKey={key}
    format={preferences.coordinateFormat}
    {location}
    onnavigate={(name: string) => {
      navigateTo({ kind: 'object', key, name });
    }}
    ontask={newTask}
    ondelete={async () => {
      const record = feed.state.objects.get(key);
      if (record) await feed.deleteObject(record.object);
    }}
    onclose={closePanel}
  />
{/if}

{#if panels.open === 'member' && memberId}
  {@const id = memberId}
  <MemberDetails
    {t}
    {locale}
    groupState={feed.state}
    heard={feed.heard}
    {id}
    format={preferences.coordinateFormat}
    {location}
    onnavigate={(name: string) => {
      navigateTo({ kind: 'member', id, name });
    }}
    onclose={closePanel}
  />
{/if}

{#if panels.open === 'diary'}
  <DiaryPanel {t} {locale} {feed} format={preferences.coordinateFormat} onclose={closePanel} />
{/if}

{#if panels.open === 'chat'}
  <ChatPanel
    {t}
    {locale}
    groupState={feed.state}
    {self}
    canAlert={role === 'coordinator'}
    onsend={(text: string) => feed.sendChat(text)}
    onalert={(level: AlertLevel, text: string) => feed.sendAlert(level, text)}
    radioTexts={radio.texts}
    showRadioTab={radio.state !== 'disconnected' || radio.texts.length > 0}
    onclose={closePanel}
  />
{/if}

{#if panels.open === 'tasks'}
  <TasksPanel
    {t}
    groupState={feed.state}
    {self}
    format={preferences.coordinateFormat}
    onsave={(task: EventRef | null, fields: TaskFields) => feed.writeTask(task, fields)}
    {onshow}
    onclose={closePanel}
  />
{/if}
