<!-- Raises the alarm (alarm.ts) when an SOS, a critical alert or a roll call of someone else
     arrives while the app is open, whatever is on screen: drawing, a panel or another app. What
     was already there when the group opened is not news. Screen readers hear it too, from a line
     only they see. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import type { NodeId } from '@tesel/protocol';
  import { onMount } from 'svelte';

  import type { Translate } from '../i18n/index.ts';
  import { useNow } from '../ui/now.svelte.ts';
  import { prepareAlarmSound, raiseAlarm, type AlarmChoices, type AlarmMessage } from './alarm.ts';
  import { activeSos, openRollCall, recentAlerts } from './incidents.ts';
  import { SOS_KINDS } from './sos-kinds.ts';

  interface Props {
    t: Translate;
    groupState: GroupState;
    self: NodeId;
    choices: AlarmChoices;
  }

  let { t, groupState, self, choices }: Props = $props();

  /** Alerts older than this are history when they arrive, as after hours without coverage. */
  const NEWS_WINDOW_S = 60 * 60;
  const now = useNow(60_000);

  onMount(prepareAlarmSound);

  /** Everything that calls for this member's attention now, each tagged with its event's key. */
  const urgent = $derived.by(() => {
    const messages: AlarmMessage[] = [];
    for (const call of activeSos(groupState, self)) {
      if (call.mine) continue;
      messages.push({
        title: `${t('sos')} · ${call.author}`,
        body: [t(SOS_KINDS[call.event.kind]), call.event.text].filter(Boolean).join(' · '),
        tag: call.key,
      });
    }
    for (const alert of recentAlerts(groupState, self, now.seconds - NEWS_WINDOW_S)) {
      if (alert.mine || alert.event.level !== 'critical') continue;
      messages.push({
        title: `${t('alertCritical')} · ${alert.author}`,
        body: alert.event.text,
        tag: alert.key,
      });
    }
    const call = openRollCall(groupState, self, now.seconds);
    if (call !== null && !call.mine && !call.answeredBySelf) {
      messages.push({
        title: `${t('rollCall')} · ${call.caller}`,
        body: call.event.text || t('rollCallQuestion'),
        tag: call.key,
      });
    }
    return messages;
  });

  /** The last alarm, for screen readers. */
  let announced = $state('');
  let known: ReadonlySet<string> | null = null;
  $effect(() => {
    const current = urgent;
    const previous = known;
    known = new Set(current.map(({ tag }) => tag));
    if (previous === null) return;
    const fresh = current.find(({ tag }) => !previous.has(tag));
    if (fresh === undefined) return;
    raiseAlarm(fresh, choices);
    announced = `${fresh.title}. ${fresh.body}`;
  });
</script>

<p class="announcement" role="alert">{announced}</p>

<style>
  /* Heard, not seen: the banners already show it. */
  .announcement {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
