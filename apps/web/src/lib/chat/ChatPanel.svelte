<!-- The active group's chat, with alerts and situation reports in the same timeline, and the
     reports pinned in a tab of their own, where new ones are written. It fills the panel, so as
     many lines as possible are in view: one row writes, and what is used less (a new report and,
     for coordinators, sending the text as an alert, which stays on everyone's screen until they
     acknowledge it, and calling the roll) waits in the menu beside it. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import {
    ALERT_TEXT_MAX_BYTES,
    CHAT_MAX_BYTES,
    eventRefKey,
    utf8ByteLength,
    type NodeId,
    type Place,
  } from '@tesel/protocol';
  import { onDestroy, tick } from 'svelte';

  import { formatTime } from '../format.ts';
  import type { Locale, MessageKey, Translate } from '../i18n/index.ts';
  import { aliasOf } from '../members/alias.ts';
  import { ALERT_LEVELS } from '../incidents/sos-kinds.ts';
  import type { StoredRadioText } from '../radio/radio-texts.ts';
  import Menu from '../ui/Menu.svelte';
  import Panel from '../ui/Panel.svelte';
  import Pictogram from '../ui/Pictogram.svelte';
  import { Submission } from '../ui/submission.svelte.ts';
  import { Dictation, speechRecognizer, type DictationProblem } from './dictation.svelte.ts';
  import ReportCard from '../reports/ReportCard.svelte';
  import ReportForm from '../reports/ReportForm.svelte';
  import { addedUp, casualtiesLine } from '../reports/report-summary.ts';
  import type { ReportFields } from '../sync/group-feed.svelte.ts';
  import type { ChatTab } from './chat-tabs.ts';
  import { timeline } from './timeline.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    groupState: GroupState;
    self: NodeId;
    /** Own events that have reached no one yet, by event reference key: shown as pending. */
    undelivered: ReadonlySet<string>;
    /** This device coordinates: it can send alerts and call the roll (a UI rule, ADR-0005). */
    coordinator: boolean;
    onsend: (text: string) => Promise<void>;
    /** Sends the text as a critical alert. */
    onalert: (text: string) => Promise<void>;
    onrollcall: () => void;
    onreport: (report: ReportFields) => Promise<void>;
    /** Shows a report's place on the map. */
    onplace: (place: Place) => void;
    /** The tab shown, and how another one is shown. */
    tab: ChatTab;
    ontab: (tab: ChatTab) => void;
    /** Text messages of other MeshCore apps heard by the radio; shown in their own tab. */
    radioTexts: readonly StoredRadioText[];
    showRadioTab: boolean;
    onclose: () => void;
  }

  let {
    t,
    locale,
    groupState,
    self,
    undelivered,
    coordinator,
    onsend,
    onalert,
    onrollcall,
    onreport,
    onplace,
    tab,
    ontab,
    radioTexts,
    showRadioTab,
    onclose,
  }: Props = $props();

  /** Writing a new report, in the reports tab. */
  let composing = $state(false);
  /** Newest first. */
  const reports = $derived([...groupState.reports].reverse());
  const casualtiesTotal = $derived(casualtiesLine(addedUp(groupState.reports), t));

  const tabs: readonly ChatTab[] = $derived(
    showRadioTab ? ['group', 'reports', 'meshcore'] : ['group', 'reports'],
  );

  /** Arrow keys, Home and End move between the tabs, as in any tab list. */
  function moveTab(event: KeyboardEvent): void {
    const index = tabs.indexOf(tab);
    const to = {
      ArrowRight: (index + 1) % tabs.length,
      ArrowLeft: (index - 1 + tabs.length) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    }[event.key];
    const next = to === undefined ? undefined : tabs[to];
    if (next === undefined) return;
    event.preventDefault();
    ontab(next);
    void tick().then(() => document.getElementById(`chat-tab-${next}`)?.focus());
  }

  function newReport(): void {
    composing = true;
    ontab('reports');
  }

  let text = $state('');
  let list: HTMLOListElement | undefined = $state();
  const entries = $derived(timeline(groupState));
  const size = $derived(utf8ByteLength(text.trim()));
  const fits = $derived({
    message: size > 0 && size <= CHAT_MAX_BYTES,
    alert: size > 0 && size <= ALERT_TEXT_MAX_BYTES,
  });

  /** Dictation, where the browser can recognise speech. */
  const Recognizer = speechRecognizer();
  const dictation = Recognizer ? new Dictation(Recognizer) : null;
  const DICTATION_PROBLEMS: Readonly<Record<DictationProblem, MessageKey>> = {
    permission: 'dictationPermission',
    network: 'dictationNetwork',
    silence: 'dictationSilence',
    unavailable: 'dictationUnavailable',
  };

  function toggleDictation(): void {
    if (!dictation) return;
    if (dictation.listening) dictation.stop();
    else dictation.start(locale, text, (heard) => (text = heard));
  }

  onDestroy(() => dictation?.cancel());

  const submission = new Submission();

  /**
   * Sends the text typed or dictated, as a message or as an alert. The box is emptied at once,
   * and gets the text back if it could not be sent.
   */
  async function send(as: 'message' | 'alert'): Promise<void> {
    if (!fits[as]) return;
    dictation?.cancel();
    const message = text.trim();
    text = '';
    const sent = await submission.run(() => (as === 'alert' ? onalert(message) : onsend(message)));
    if (!sent && text === '') text = message;
  }

  /** How near the end, in pixels, the reader still counts as at the end. */
  const END_SLACK_PX = 48;
  const newestKey = $derived(entries.at(-1)?.key);
  const newestOwn = $derived(entries.at(-1)?.event.origin === self);
  /** Whether the reader is at the newest entry, not reading older ones. */
  let atEnd = true;
  /** The list last scrolled: one shown again, after another tab, opens at the newest entry. */
  let scrolled: HTMLOListElement | undefined;

  // A new entry is shown if the reader was at the end or wrote it; anything else that changes in
  // the group leaves the reader where they are.
  $effect(() => {
    const element = list;
    if (element === undefined || newestKey === undefined) return;
    if (element === scrolled && !atEnd && !newestOwn) return;
    scrolled = element;
    void tick().then(() => element.lastElementChild?.scrollIntoView({ block: 'end' }));
  });

  function onscroll(): void {
    if (list === undefined) return;
    atEnd = list.scrollHeight - list.scrollTop - list.clientHeight < END_SLACK_PX;
  }
</script>

<Panel title={t('chat')} closeLabel={t('close')} {onclose} fill>
  {#snippet header()}
    <div class="tabs" role="tablist" tabindex="-1" onkeydown={moveTab}>
      {#each tabs as each (each)}
        <button
          role="tab"
          id="chat-tab-{each}"
          aria-selected={tab === each}
          aria-controls="chat-tabpanel"
          tabindex={tab === each ? 0 : -1}
          onclick={() => {
            ontab(each);
          }}
        >
          {#if each === 'group'}
            {t('chatGroup')}
          {:else if each === 'reports'}
            <Pictogram name="pushpin" size={16} />
            {t('reportsTab')}
            {#if reports.length > 0}<span class="count">{reports.length}</span>{/if}
          {:else}
            {t('chatMeshcore')}
            {#if radioTexts.length > 0}<span class="count">{radioTexts.length}</span>{/if}
          {/if}
        </button>
      {/each}
    </div>
  {/snippet}

  <div id="chat-tabpanel" class="tabpanel" role="tabpanel" aria-labelledby="chat-tab-{tab}">
    {#if tab === 'reports'}
      {#if composing}
        <div class="scroll">
          <ReportForm {t} {locale} onsend={onreport} onback={() => (composing = false)} />
        </div>
      {:else}
        <div class="scroll stack">
          {#if reports.length === 0}
            <p class="hint">{t('reportsNone')}</p>
          {:else}
            {#if casualtiesTotal}
              <p class="hint">{t('reportsTotal', { casualties: casualtiesTotal })}</p>
            {/if}
            <ol class="reports">
              {#each reports as report (eventRefKey(report))}
                <li><ReportCard {t} {locale} {groupState} {report} open {onplace} /></li>
              {/each}
            </ol>
          {/if}
        </div>
        <button class="primary new-report" onclick={() => (composing = true)}>
          <Pictogram name="pushpin" size={18} />
          {t('reportNew')}
        </button>
      {/if}
    {:else if tab === 'meshcore' && showRadioTab}
      <div class="scroll stack">
        <p class="hint">{t('meshcoreIntro')}</p>
        {#if radioTexts.length === 0}
          <p class="hint">{t('noMeshcoreMessages')}</p>
        {:else}
          <ol class="messages">
            {#each radioTexts as message, index (index)}
              <li>
                <span class="meta">
                  {message.kind === 'direct'
                    ? t('meshcoreDirect')
                    : t('meshcoreChannel', {
                        name: message.channel ?? t('meshcoreUnknownChannel'),
                      })}
                  {#if message.sender}· {message.sender}{/if}
                </span>
                <span class="line">
                  <span class="text">{message.text}</span>
                  <span class="time">{formatTime(message.receivedAt, locale)}</span>
                </span>
              </li>
            {/each}
          </ol>
        {/if}
      </div>
    {:else}
      {#if entries.length === 0}
        <p class="hint scroll">{t('noMessages')}</p>
      {:else}
        <ol class="messages scroll" bind:this={list} {onscroll}>
          {#each entries as entry (entry.key)}
            {#if entry.kind === 'report'}
              <li class="report">
                <ReportCard {t} {locale} {groupState} report={entry.event} open={false} {onplace} />
              </li>
            {:else}
              {@const own = entry.event.origin === self}
              <li
                class:own
                class:follows={entry.kind === 'chat' && entry.follows}
                class="{entry.kind} {entry.kind === 'alert' ? `level-${entry.event.level}` : ''}"
              >
                {#if entry.kind === 'alert'}
                  <span class="meta">
                    {t(ALERT_LEVELS[entry.event.level])} · {aliasOf(groupState, entry.event.origin)}
                  </span>
                {:else if !own && !entry.follows}
                  <span class="meta">{aliasOf(groupState, entry.event.origin)}</span>
                {/if}
                <span class="line">
                  <span class="text">{entry.event.text}</span>
                  <span class="time">{formatTime(entry.event.time * 1000, locale)}</span>
                </span>
                {#if undelivered.has(eventRefKey(entry.event))}
                  <span class="pending">{t('notSentYet')}</span>
                {/if}
              </li>
            {/if}
          {/each}
        </ol>
      {/if}

      <form
        class="compose"
        onsubmit={(event) => {
          event.preventDefault();
          void send('message');
        }}
      >
        <Menu label={t('moreActions')} place="start">
          {#snippet trigger(expanded: boolean, toggle: () => void)}
            <button
              type="button"
              class="icon"
              aria-haspopup="menu"
              aria-expanded={expanded}
              aria-label={t('moreActions')}
              title={t('moreActions')}
              onclick={toggle}
            >
              <Pictogram name="plus" size={22} />
            </button>
          {/snippet}
          {#snippet items(close: () => void)}
            <button
              type="button"
              role="menuitem"
              onclick={() => {
                close();
                newReport();
              }}
            >
              <Pictogram name="pushpin" size={20} />
              {t('reportNew')}
            </button>
            {#if coordinator}
              <button
                type="button"
                role="menuitem"
                disabled={!fits.alert}
                onclick={() => {
                  close();
                  void send('alert');
                }}
              >
                <Pictogram name="warning" size={20} />
                <span class="item">
                  {t('sendAlert')}
                  <small>{fits.alert ? t('sendAlertHint') : t('sendAlertTypeFirst')}</small>
                </span>
              </button>
              <button
                type="button"
                role="menuitem"
                onclick={() => {
                  close();
                  onrollcall();
                }}
              >
                <Pictogram name="person" size={20} />
                {t('callRoll')}
              </button>
            {/if}
          {/snippet}
        </Menu>
        <div class="field">
          <input
            bind:value={text}
            aria-label={t('message')}
            placeholder={dictation?.listening ? t('dictationListening') : t('message')}
            autocomplete="off"
          />
          {#if dictation}
            <button
              type="button"
              class="dictate"
              aria-pressed={dictation.listening}
              aria-label={dictation.listening ? t('dictationStop') : t('dictate')}
              title={dictation.listening ? t('dictationStop') : t('dictate')}
              onclick={toggleDictation}
            >
              <Pictogram name="mic" size={20} />
            </button>
          {/if}
        </div>
        <button
          type="submit"
          class="primary icon"
          aria-label={t('send')}
          title={t('send')}
          disabled={submission.busy || !fits.message}
        >
          <Pictogram name="send" size={22} />
        </button>
      </form>
      {#if submission.failed}<p class="warning">{t('sendFailed')}</p>{/if}
      {#if size > CHAT_MAX_BYTES}<p class="warning">{t('messageTooLong')}</p>{/if}
      {#if dictation?.problem}
        <p class="warning">{t(DICTATION_PROBLEMS[dictation.problem])}</p>
      {/if}
    {/if}
  </div>
</Panel>

<style>
  /* The tab's content lays out in the panel as if there were no wrapper. */
  .tabpanel {
    display: contents;
  }

  /* The tabs head the panel, beside its close button. */
  .tabs {
    display: flex;
    flex: 1;
    gap: 0.25rem;
    min-width: 0;
    overflow-x: auto;
  }

  .tabs button {
    display: inline-flex;
    flex: none;
    gap: 0.35rem;
    align-items: center;
    padding-inline: 0.6rem;
    border: none;
    border-bottom: 3px solid transparent;
    border-radius: 0;
  }

  .tabs button[aria-selected='true'] {
    font-weight: 600;
    border-bottom-color: var(--accent-line);
  }

  .count {
    padding: 0 0.4rem;
    font-size: var(--text-small);
    border: 1px solid currentcolor;
    border-radius: var(--radius-pill);
  }

  /* What scrolls takes the height left by the tabs and the row that writes. */
  .scroll {
    flex: 1;
    align-content: start;
    min-height: 0;
    margin: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .new-report {
    display: inline-flex;
    flex: none;
    gap: 0.4rem;
    align-items: center;
    justify-content: center;
  }

  .reports {
    display: grid;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .messages {
    display: grid;
    align-content: start;
    gap: 0.4rem;
    padding: 0;
    list-style: none;
  }

  li {
    display: grid;
    justify-self: start;
    max-width: 85%;
    padding: 0.35rem 0.6rem;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-card);
  }

  /* A line under the one before it, from the same person: close to it, and without the name. */
  li.follows {
    margin-top: -0.2rem;
  }

  li.own {
    justify-self: end;
    border-color: var(--accent-line);
  }

  /* Level classes are prefixed: a plain `.warning` is the app's error text (app.css). */
  li.alert {
    justify-self: stretch;
    max-width: none;
    border-left: 6px solid var(--info);
  }

  li.alert.level-warning {
    border-left-color: var(--warning);
  }

  li.alert.level-critical {
    border-left-color: var(--danger);
  }

  /* A report is its own card, across the panel. */
  li.report,
  .reports li {
    display: block;
    justify-self: stretch;
    max-width: none;
    padding: 0;
    background: none;
    border: none;
  }

  .meta {
    color: var(--muted);
    font-size: var(--text-small);
  }

  /* The text, and its time at the end of its last line. */
  .line {
    display: flex;
    flex-wrap: wrap;
    gap: 0 0.6rem;
    align-items: baseline;
  }

  .text {
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }

  .time {
    margin-left: auto;
    color: var(--muted);
    font-size: var(--text-small);
  }

  .pending {
    color: var(--muted);
    font-size: var(--text-small);
    font-style: italic;
  }

  /* One row: the menu, the text with its microphone, and Send. */
  .compose {
    display: grid;
    flex: none;
    grid-template-columns: auto 1fr auto;
    gap: 0.4rem;
    align-items: center;
  }

  .warning {
    flex: none;
    margin: 0;
  }

  /* An item with a word on what it does, or on what it needs first. */
  .item {
    display: grid;
  }

  .item small {
    color: var(--muted);
    font-size: var(--text-small);
  }

  /* The microphone inside the text box, at its end, where the thumb is. */
  .field {
    position: relative;
    display: grid;
    min-width: 0;
  }

  .field input {
    min-width: 0;
    padding-right: calc(var(--control-size) + 0.25rem);
  }

  .dictate {
    position: absolute;
    top: 50%;
    right: 0.15rem;
    display: grid;
    place-items: center;
    width: var(--control-size);
    height: var(--control-size);
    padding: 0;
    color: var(--muted);
    border: 0;
    border-radius: 50%;
    transform: translateY(-50%);
  }

  /* Listening: in the colour of what is live, pulsing gently. */
  .dictate[aria-pressed='true'] {
    color: var(--on-danger);
    background: var(--danger-fill);
    animation: listening 1.4s ease-in-out infinite;
  }

  @keyframes listening {
    50% {
      box-shadow: 0 0 0 0.35rem color-mix(in srgb, var(--danger-fill) 30%, transparent);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .dictate[aria-pressed='true'] {
      animation: none;
    }
  }
</style>
