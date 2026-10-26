<!-- Active SOS calls, the open roll call and recent alerts, on top of the map until they are dealt
     with. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import type { EventRef, LatLon, NodeId } from '@tesel/protocol';
  import { SvelteSet } from 'svelte/reactivity';

  import { formatTime } from '../format.ts';
  import type { Locale, Translate } from '../i18n/index.ts';
  import { useNow } from '../ui/now.svelte.ts';
  import { activeSos, openRollCall, recentAlerts } from './incidents.ts';
  import { ALERT_LEVELS, SOS_KINDS } from './sos-kinds.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    groupState: GroupState;
    self: NodeId;
    /** Whether this device may cancel other members' SOS calls (coordinators). */
    canCancelOthers: boolean;
    onacknowledge: (target: EventRef) => Promise<void>;
    oncancel: (sos: EventRef) => Promise<void>;
    onshow: (at: LatLon) => void;
    /** Answers a roll call with "I need help": opens the SOS dialog. */
    onneedhelp: () => void;
  }

  let {
    t,
    locale,
    groupState,
    self,
    canCancelOthers,
    onacknowledge,
    oncancel,
    onshow,
    onneedhelp,
  }: Props = $props();

  /** Alerts are shown for an hour, or until dismissed on this device. */
  const ALERT_WINDOW_S = 60 * 60;
  const dismissed = new SvelteSet<string>();
  const now = useNow(60_000);

  const calls = $derived(activeSos(groupState, self));
  const alerts = $derived(
    recentAlerts(groupState, self, now.seconds - ALERT_WINDOW_S).filter(
      (alert) => !dismissed.has(alert.key) && !(alert.event.level === 'critical' && alert.bySelf),
    ),
  );
  /** The open roll call, while this member has to answer it or its caller follows the answers. */
  const rollCall = $derived.by(() => {
    const open = openRollCall(groupState, self, now.seconds);
    if (open === null || dismissed.has(open.key)) return null;
    return open.mine || !open.answeredBySelf ? open : null;
  });

  // Vibrate when an SOS, a critical alert or a roll call arrives while the app is open (not for
  // the backlog).
  let known: Set<string> | null = null;
  $effect(() => {
    const urgent = [
      ...calls.filter((call) => !call.mine).map((call) => call.key),
      ...alerts
        .filter((alert) => alert.event.level === 'critical' && !alert.mine)
        .map((a) => a.key),
      ...(rollCall && !rollCall.mine ? [rollCall.key] : []),
    ];
    const previous = known;
    const isNew = previous !== null && urgent.some((key) => !previous.has(key));
    // Safari has no vibration API.
    if (isNew && 'vibrate' in navigator) navigator.vibrate([300, 150, 300]);
    known = new Set(urgent);
  });

  async function cancel(sos: EventRef): Promise<void> {
    if (confirm(t('confirmCancelSos'))) await oncancel(sos);
  }
</script>

<div class="banners">
  {#each calls as call (call.key)}
    <section class="banner sos" aria-label="SOS">
      <strong>SOS · {call.author} · {t(SOS_KINDS[call.event.kind])}</strong>
      <span class="when">{formatTime(call.event.time * 1000, locale)}</span>
      {#if call.event.text}<p>{call.event.text}</p>{/if}
      <p class="acks">
        {call.by.length > 0
          ? t('acknowledgedBy', { names: call.by.join(', ') })
          : t('notAcknowledged')}
      </p>
      <div class="row">
        {#if !call.mine && !call.bySelf}
          <button class="primary" onclick={() => onacknowledge(call.event)}
            >{t('acknowledge')}</button
          >
        {/if}
        <button
          onclick={() => {
            onshow(call.event);
          }}>{t('showOnMap')}</button
        >
        {#if call.mine || canCancelOthers}
          <button onclick={() => cancel(call.event)}>{t('cancelSos')}</button>
        {/if}
      </div>
    </section>
  {/each}
  {#if rollCall}
    {@const call = rollCall}
    <section class="banner roll-call" aria-label={t('rollCall')}>
      <strong>{t('rollCall')} · {call.caller}</strong>
      <span class="when">{formatTime(call.event.time * 1000, locale)}</span>
      {#if call.mine}
        <p>
          {t('rollCallAnswered', {
            answered: call.answered.length,
            expected: call.answered.length + call.pending.length,
          })}
        </p>
        <p class="acks">
          {call.pending.length > 0
            ? t('rollCallPending', { names: call.pending.join(', ') })
            : t('rollCallAll')}
        </p>
        <div class="row">
          <button onclick={() => dismissed.add(call.key)}>{t('close')}</button>
        </div>
      {:else}
        <p>{call.event.text || t('rollCallQuestion')}</p>
        <div class="row">
          <button class="primary" onclick={() => onacknowledge(call.event)}>{t('imWell')}</button>
          <button class="danger" onclick={onneedhelp}>{t('needHelp')}</button>
        </div>
      {/if}
    </section>
  {/if}
  {#each alerts as alert (alert.key)}
    <section
      class="banner alert level-{alert.event.level}"
      aria-label={t(ALERT_LEVELS[alert.event.level])}
    >
      <strong>{t(ALERT_LEVELS[alert.event.level])} · {alert.author}</strong>
      <span class="when">{formatTime(alert.event.time * 1000, locale)}</span>
      <p>{alert.event.text}</p>
      {#if alert.mine && alert.event.level === 'critical'}
        <p class="acks">
          {alert.by.length > 0
            ? t('acknowledgedBy', { names: alert.by.join(', ') })
            : t('notAcknowledged')}
        </p>
      {/if}
      <div class="row">
        {#if alert.event.level === 'critical' && !alert.mine}
          <button class="primary" onclick={() => onacknowledge(alert.event)}
            >{t('acknowledge')}</button
          >
        {:else}
          <button onclick={() => dismissed.add(alert.key)}>{t('close')}</button>
        {/if}
      </div>
    </section>
  {/each}
</div>

<style>
  .banners {
    display: grid;
    gap: 0.5rem;
    max-height: 60dvh;
    overflow-y: auto;
    pointer-events: none;
  }

  .banner {
    display: grid;
    gap: 0.3rem;
    padding: 0.7rem 0.8rem;
    color: var(--fg);
    pointer-events: auto;
    background: var(--surface);
    border-left: 6px solid var(--muted);
    border-radius: 0.75rem;
    box-shadow: 0 4px 16px rgb(0 0 0 / 25%);
  }

  /* Level classes are prefixed: a plain `.warning` is the app's error text (app.css). */
  .banner.sos,
  .banner.level-critical {
    border-left-color: var(--danger);
  }

  .banner.level-warning {
    border-left-color: var(--warning);
  }

  .banner.level-info,
  .banner.roll-call {
    border-left-color: var(--info);
  }

  .sos strong {
    color: var(--danger);
  }

  p {
    margin: 0;
  }

  .when,
  .acks {
    color: var(--muted);
    font-size: 0.85rem;
  }
</style>
