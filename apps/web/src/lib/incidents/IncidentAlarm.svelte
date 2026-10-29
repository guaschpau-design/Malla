<!-- Raises the alarm (alarm.ts) when an SOS, a critical alert or a roll call of someone else
     arrives while the app is open, whatever is on screen: drawing, a panel or another app. What
     was already there when the group opened is not news. Screen readers hear it too
     (ui/announcer.svelte.ts). A new SOS or roll call also clears the way to its card
     (`oninterrupt`), which the chat would cover. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import type { NodeId } from '@tesel/protocol';
  import { onMount, untrack } from 'svelte';

  import type { Translate } from '../i18n/index.ts';
  import { announcer } from '../ui/announcer.svelte.ts';
  import { clockEvery } from '../ui/now.svelte.ts';
  import { prepareAlarmSound, raiseAlarm, type AlarmChoices, type AlarmMessage } from './alarm.ts';
  import { activeSos, openRollCall, recentAlerts } from './incidents.ts';
  import { SOS_KINDS } from './sos-kinds.ts';

  interface Props {
    t: Translate;
    groupState: GroupState;
    self: NodeId;
    choices: AlarmChoices;
    /** A new SOS or roll call arrived: what covers its card should step aside. */
    oninterrupt: () => void;
  }

  let { t, groupState, self, choices, oninterrupt }: Props = $props();

  /** Alerts older than this are history when they arrive, as after hours without coverage. */
  const NEWS_WINDOW_S = 60 * 60;
  const now = clockEvery(60_000);

  onMount(prepareAlarmSound);

  /** Everything that calls for this member's attention now, each tagged with its event's key. */
  const urgent = $derived.by(() => {
    const messages: (AlarmMessage & { readonly interrupts: boolean })[] = [];
    for (const call of activeSos(groupState, self)) {
      if (call.mine) continue;
      messages.push({
        title: `${t('sos')} · ${call.author}`,
        body: [t(SOS_KINDS[call.event.kind]), call.event.text].filter(Boolean).join(' · '),
        tag: call.key,
        interrupts: true,
      });
    }
    for (const alert of recentAlerts(groupState, self, now.seconds - NEWS_WINDOW_S)) {
      if (alert.mine || alert.event.level !== 'critical') continue;
      messages.push({
        title: `${t('alertCritical')} · ${alert.author}`,
        body: alert.event.text,
        tag: alert.key,
        interrupts: false,
      });
    }
    const call = openRollCall(groupState, self, now.seconds);
    if (call !== null && !call.mine && !call.answeredBySelf) {
      messages.push({
        title: `${t('rollCall')} · ${call.caller}`,
        body: call.event.text || t('rollCallQuestion'),
        tag: call.key,
        interrupts: true,
      });
    }
    return messages;
  });

  let known: ReadonlySet<string> | null = null;
  $effect(() => {
    const current = urgent;
    const previous = known;
    known = new Set(current.map(({ tag }) => tag));
    if (previous === null) return;
    const fresh = current.find(({ tag }) => !previous.has(tag));
    if (fresh === undefined) return;
    raiseAlarm(fresh, choices);
    announcer.say(`${fresh.title}. ${fresh.body}`);
    if (fresh.interrupts) untrack(oninterrupt);
  });
</script>
