<!-- The panels about the active group: an object, a member, the diary, the chat and the tasks. -->
<script lang="ts">
  import type { EventRef, NodeId, Role, TaskPlace } from '@tesel/protocol';

  import ChatPanel from '../chat/ChatPanel.svelte';
  import DiaryPanel from '../diary/DiaryPanel.svelte';
  import MemberDetails from '../members/MemberDetails.svelte';
  import type { Locale, Translate } from '../i18n/index.ts';
  import { navigateTo } from '../navigation/navigation.svelte.ts';
  import ObjectDetails from '../objects/ObjectDetails.svelte';
  import { radio } from '../radio/radio.svelte.ts';
  import type { Preferences } from '../settings/preferences.ts';
  import type { GroupFeed } from '../sync/group-feed.svelte.ts';
  import { newTask } from '../tasks/task-editor.ts';
  import TasksPanel from '../tasks/TasksPanel.svelte';
  import type { TaskFields } from '../tasks/tasks.ts';
  import { closePanel, isOpen, panels } from '../ui/panels.svelte.ts';
  import { attempt } from '../ui/submission.svelte.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    feed: GroupFeed;
    self: NodeId;
    role: Role;
    preferences: Preferences;
    /** Shows a task's place on the map, with its panel. */
    onplace: (place: TaskPlace) => void;
  }

  let { t, locale, feed, self, role, preferences, onplace }: Props = $props();
</script>

{#if panels.open?.name === 'object'}
  {@const key = panels.open.key}
  <ObjectDetails
    {t}
    {locale}
    groupState={feed.state}
    objectKey={key}
    format={preferences.coordinateFormat}
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

{#if panels.open?.name === 'member'}
  {@const id = panels.open.member}
  <MemberDetails
    {t}
    {locale}
    groupState={feed.state}
    heard={feed.heard}
    {id}
    format={preferences.coordinateFormat}
    onnavigate={(name: string) => {
      navigateTo({ kind: 'member', id, name });
    }}
    onclose={closePanel}
  />
{/if}

{#if isOpen('diary')}
  <DiaryPanel {t} {locale} {feed} format={preferences.coordinateFormat} onclose={closePanel} />
{/if}

{#if isOpen('chat')}
  <ChatPanel
    {t}
    {locale}
    groupState={feed.state}
    {self}
    undelivered={feed.undelivered}
    coordinator={role === 'coordinator'}
    onsend={(text: string) => feed.sendChat(text)}
    onalert={(text: string) => feed.sendAlert(text)}
    onrollcall={() => {
      // Closing the chat shows who answers, in the banner on the map.
      closePanel();
      attempt(() => feed.callRoll(), t('actionFailed'));
    }}
    radioTexts={radio.texts}
    showRadioTab={radio.state !== 'disconnected' || radio.texts.length > 0}
    onclose={closePanel}
  />
{/if}

{#if panels.open?.name === 'tasks'}
  <TasksPanel
    editing={panels.open.editing}
    {t}
    groupState={feed.state}
    {self}
    format={preferences.coordinateFormat}
    onsave={(task: EventRef | null, fields: TaskFields) => feed.writeTask(task, fields)}
    {onplace}
    onclose={closePanel}
  />
{/if}
