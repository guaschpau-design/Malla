<!-- The active group's chat, with alerts in the same timeline. Coordinators can send a message as
     an alert, which stays on everyone's screen until they acknowledge it, and call the roll. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import {
    ALERT_TEXT_MAX_BYTES,
    CHAT_MAX_BYTES,
    eventRefKey,
    utf8ByteLength,
    type NodeId,
  } from '@tesel/protocol';
  import { onDestroy, tick } from 'svelte';

  import { formatTime } from '../format.ts';
  import type { Locale, MessageKey, Translate } from '../i18n/index.ts';
  import { aliasOf } from '../incidents/incidents.ts';
  import { ALERT_LEVELS } from '../incidents/sos-kinds.ts';
  import type { StoredRadioText } from '../radio/radio-texts.ts';
  import Panel from '../ui/Panel.svelte';
  import Pictogram from '../ui/Pictogram.svelte';
  import { Submission } from '../ui/submission.svelte.ts';
  import { Dictation, speechRecognizer, type DictationProblem } from './dictation.svelte.ts';
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
    radioTexts,
    showRadioTab,
    onclose,
  }: Props = $props();

  let tab: 'group' | 'meshcore' = $state('group');

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

  // Keep the newest entry in view.
  $effect(() => {
    if (entries.at(-1) === undefined) return;
    void tick().then(() => list?.lastElementChild?.scrollIntoView({ block: 'end' }));
  });
</script>

<Panel title={t('chat')} closeLabel={t('close')} {onclose}>
  {#if showRadioTab}
    <div class="tabs" role="tablist">
      <button role="tab" aria-selected={tab === 'group'} onclick={() => (tab = 'group')}>
        {t('chatGroup')}
      </button>
      <button role="tab" aria-selected={tab === 'meshcore'} onclick={() => (tab = 'meshcore')}>
        {t('chatMeshcore')}
        {#if radioTexts.length > 0}<span class="count">{radioTexts.length}</span>{/if}
      </button>
    </div>
  {/if}

  {#if tab === 'meshcore' && showRadioTab}
    <p class="hint section">{t('meshcoreIntro')}</p>
    {#if radioTexts.length === 0}
      <p class="hint">{t('noMeshcoreMessages')}</p>
    {:else}
      <ol class="messages section">
        {#each radioTexts as message, index (index)}
          <li>
            <span class="meta">
              {message.kind === 'direct'
                ? t('meshcoreDirect')
                : t('meshcoreChannel', { name: message.channel ?? t('meshcoreUnknownChannel') })}
              {#if message.sender}· {message.sender}{/if}
              · {formatTime(message.receivedAt, locale)}
            </span>
            <span class="text">{message.text}</span>
          </li>
        {/each}
      </ol>
    {/if}
  {:else}
    {#if entries.length === 0}
      <p class="hint section">{t('noMessages')}</p>
    {:else}
      <ol class="messages section" bind:this={list}>
        {#each entries as entry (entry.key)}
          <li
            class:own={entry.event.origin === self}
            class="{entry.kind} {entry.kind === 'alert' ? `level-${entry.event.level}` : ''}"
          >
            <span class="meta">
              {#if entry.kind === 'alert'}{t(ALERT_LEVELS[entry.event.level])} ·{/if}
              {aliasOf(groupState, entry.event.origin)} · {formatTime(
                entry.event.time * 1000,
                locale,
              )}
            </span>
            <span class="text">{entry.event.text}</span>
            {#if undelivered.has(eventRefKey(entry.event))}
              <span class="pending">{t('notSentYet')}</span>
            {/if}
          </li>
        {/each}
      </ol>
    {/if}

    <form
      class="compose section"
      onsubmit={(event) => {
        event.preventDefault();
        void send('message');
      }}
    >
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
      <button type="submit" class="primary" disabled={submission.busy || !fits.message}
        >{t('send')}</button
      >
      {#if submission.failed}<p class="warning">{t('sendFailed')}</p>{/if}
      {#if coordinator}
        <div class="coordinator">
          <button
            type="button"
            class="danger"
            disabled={!fits.alert}
            title={t('sendAlertHint')}
            onclick={() => send('alert')}
          >
            <Pictogram name="warning" size={18} />
            {t('sendAlert')}
          </button>
          <button type="button" onclick={onrollcall}>
            <Pictogram name="person" size={18} />
            {t('callRoll')}
          </button>
        </div>
      {/if}
    </form>
    {#if size > CHAT_MAX_BYTES}<p class="warning">{t('messageTooLong')}</p>{/if}
    {#if dictation?.problem}
      <p class="warning">{t(DICTATION_PROBLEMS[dictation.problem])}</p>
    {/if}
  {/if}
</Panel>

<style>
  .tabs {
    display: flex;
    gap: 0.25rem;
    margin-top: 0.75rem;
    border-bottom: 1px solid var(--border);
  }

  .tabs button {
    border: none;
    border-bottom: 3px solid transparent;
    border-radius: 0;
  }

  .tabs button[aria-selected='true'] {
    font-weight: 600;
    border-bottom-color: var(--accent-line);
  }

  .count {
    margin-left: 0.35rem;
    padding: 0 0.4rem;
    font-size: var(--text-small);
    border: 1px solid currentcolor;
    border-radius: var(--radius-pill);
  }

  .messages {
    display: grid;
    gap: 0.5rem;
    max-height: 45dvh;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    list-style: none;
  }

  li {
    display: grid;
    justify-self: start;
    max-width: 85%;
    padding: 0.45rem 0.7rem;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-card);
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

  .pending {
    color: var(--muted);
    font-size: var(--text-small);
    font-style: italic;
  }

  .meta {
    color: var(--muted);
    font-size: var(--text-small);
  }

  .text {
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }

  /* The text and Send on one line; for coordinators, Send as alert and Call the roll below them,
     across the panel. */
  .compose {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.5rem;
  }

  .compose .warning {
    grid-column: 1 / -1;
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

  .coordinator {
    display: grid;
    grid-column: 1 / -1;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }

  .coordinator button {
    display: inline-flex;
    gap: 0.4rem;
    align-items: center;
    justify-content: center;
  }
</style>
