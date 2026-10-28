<!-- Active SOS calls, the open roll call and recent alerts, on top of the map until they are dealt
     with. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import type { EventRef, LatLon, NodeId } from '@tesel/protocol';
  import { SvelteSet } from 'svelte/reactivity';

  import { formatTime } from '../format.ts';
  import type { Locale, Translate } from '../i18n/index.ts';
  import { confirmations } from '../ui/confirmations.svelte.ts';
  import { clockEvery } from '../ui/now.svelte.ts';
  import { activeSos, openRollCall, recentAlerts } from './incidents.ts';
  import { ALERT_LEVELS, SOS_KINDS } from './sos-kinds.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    groupState: GroupState;
    self: NodeId;
    /** Whether this device may cancel other members' SOS calls (coordinators). */
    canCancelOthers: boolean;
    onacknowledge: (target: EventRef) => void;
    oncancel: (sos: EventRef) => void;
    /** Own events that have reached no one yet, by event reference key. */
    undelivered: ReadonlySet<string>;
    /** Shows where an SOS is on the map. */
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
    undelivered,
    onshow,
    onneedhelp,
  }: Props = $props();

  /** Alerts are shown for an hour, or until dismissed on this device. */
  const ALERT_WINDOW_S = 60 * 60;
  const dismissed = new SvelteSet<string>();
  const now = clockEvery(60_000);

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

  async function cancel(sos: EventRef): Promise<void> {
    const text = t('confirmCancelSos');
    if (await confirmations.ask({ text, confirm: t('cancelSos') })) oncancel(sos);
  }
</script>

<div class="banners">
  {#each calls as call (call.key)}
    {@const where = call.where}
    <section class="map-card edged sos" aria-label="SOS">
      <strong>SOS · {call.author} · {t(SOS_KINDS[call.event.kind])}</strong>
      <span class="when">{formatTime(call.event.time * 1000, locale)}</span>
      {#if call.event.text}<p>{call.event.text}</p>{/if}
      {#if where.kind === 'shared'}
        <p class="where">{t('sosPlaceShared', { time: formatTime(where.time * 1000, locale) })}</p>
      {:else if where.kind === 'unknown'}
        <p class="where warning">{t('sosPlaceUnknown')}</p>
      {/if}
      {#if call.mine && undelivered.has(call.key)}
        <p class="warning">{t('sosNotSentYet')}</p>
      {/if}
      <p class="acks">
        {call.by.length > 0
          ? t('acknowledgedBy', { names: call.by.join(', ') })
          : t('notAcknowledged')}
      </p>
      <div class="row">
        {#if !call.mine && !call.bySelf}
          <button
            class="primary"
            onclick={() => {
              onacknowledge(call.event);
            }}>{t('acknowledge')}</button
          >
        {/if}
        {#if where.kind !== 'unknown'}
          <button
            onclick={() => {
              onshow(where.at);
            }}>{t('showOnMap')}</button
          >
        {/if}
        {#if call.mine || canCancelOthers}
          <button
            onclick={() => {
              void cancel(call.event);
            }}>{t('cancelSos')}</button
          >
        {/if}
      </div>
    </section>
  {/each}
  {#if rollCall}
    {@const call = rollCall}
    <section class="map-card edged roll-call" aria-label={t('rollCall')}>
      <strong>{t('rollCall')} · {call.caller}</strong>
      <span class="when">{formatTime(call.event.time * 1000, locale)}</span>
      <p class="question">{call.event.text || t('rollCallQuestion')}</p>
      {#if call.mine}
        <p>
          {t('rollCallAnswered', {
            count: call.answered.length,
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
        <div class="row">
          <button
            class="primary"
            onclick={() => {
              onacknowledge(call.event);
            }}>{t('imWell')}</button
          >
          <button class="danger" onclick={onneedhelp}>{t('needHelp')}</button>
        </div>
      {/if}
    </section>
  {/if}
  {#each alerts as alert (alert.key)}
    <section
      class="map-card edged level-{alert.event.level}"
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
          <button
            class="primary"
            onclick={() => {
              onacknowledge(alert.event);
            }}>{t('acknowledge')}</button
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
    pointer-events: none;
  }

  /* The shared card (.map-card in app.css), its edge in the colour of each kind. Level classes
     are prefixed: a plain `.warning` is the app's error text. */
  .sos,
  .level-critical {
    --edge: var(--danger);
  }

  .level-warning {
    --edge: var(--warning);
  }

  .level-info,
  .roll-call {
    --edge: var(--info);
  }

  /* Tighter than other cards: several may stack. */
  .map-card {
    gap: 0.3rem;
  }

  .question {
    font-weight: 600;
  }

  .sos strong {
    color: var(--danger);
  }

  .when,
  .acks {
    color: var(--muted);
    font-size: var(--text-secondary);
  }
</style>
