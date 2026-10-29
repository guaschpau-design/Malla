<!-- The panels about the active group: an object, a member, the diary, the chat and the tasks. -->
<script lang="ts">
  import type { EventRef, NodeId, Role, Place } from '@tesel/protocol';

  import ChatPanel from '../chat/ChatPanel.svelte';
  import type { ChatTab } from '../chat/chat-tabs.ts';
  import DiaryPanel from '../diary/DiaryPanel.svelte';
  import MemberDetails from '../members/MemberDetails.svelte';
  import type { Locale, Translate } from '../i18n/index.ts';
  import { navigateTo } from '../navigation/navigation.svelte.ts';
  import ObjectDetails from '../objects/ObjectDetails.svelte';
  import { removeSweep } from '../objects/sweep-actions.ts';
  import { radio } from '../radio/radio.svelte.ts';
  import type { Preferences } from '../settings/preferences.ts';
  import type { GroupFeed, ReportFields } from '../sync/group-feed.svelte.ts';
  import { newTask } from '../tasks/task-editor.ts';
  import TasksPanel from '../tasks/TasksPanel.svelte';
  import type { TaskEditing, TaskFields } from '../tasks/tasks.ts';
  import { closePanel, isOpen, openPanel, panels } from '../ui/panels.svelte.ts';
  import { attempt } from '../ui/submission.svelte.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    feed: GroupFeed;
    self: NodeId;
    role: Role;
    preferences: Preferences;
    /** Shows a task's place on the map, with its panel. */
    onplace: (place: Place) => void;
    /** Starts planning the sweep of a search area, by its key. */
    onplansweep: (area: string) => void;
    /** Starts picking on the map the place of the task being edited. */
    onpicktaskplace: (editing: TaskEditing) => void;
  }

  let { t, locale, feed, self, role, preferences, onplace, onplansweep, onpicktaskplace }: Props =
    $props();
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
    coordinator={role === 'coordinator'}
    ontask={newTask}
    onplansweep={() => {
      onplansweep(key);
    }}
    onremovesweep={(strips: readonly string[]) => removeSweep(feed, strips)}
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
    {self}
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

{#if panels.open?.name === 'chat'}
  <ChatPanel
    {t}
    {locale}
    groupState={feed.state}
    {self}
    undelivered={feed.undelivered}
    coordinator={role === 'coordinator'}
    onsend={(text: string) => feed.sendChat(text)}
    onalert={(text: string) => feed.sendAlert(text)}
    tab={panels.open.tab}
    ontab={(tab: ChatTab) => {
      openPanel({ name: 'chat', tab });
    }}
    onreport={(report: ReportFields) => feed.sendReport(report)}
    {onplace}
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
    onpickplace={onpicktaskplace}
    {onplace}
    onclose={closePanel}
  />
{/if}
