<!-- The active group's chat, with alerts in the same timeline. Coordinators can send alerts. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import {
    ALERT_TEXT_MAX_BYTES,
    CHAT_MAX_BYTES,
    utf8ByteLength,
    type AlertLevel,
    type NodeId,
  } from '@tesel/protocol';
  import { tick } from 'svelte';

  import { formatTime } from '../format.ts';
  import type { Locale, Translate } from '../i18n/index.ts';
  import { aliasOf } from '../incidents/incidents.ts';
  import { ALERT_LEVELS } from '../incidents/sos-kinds.ts';
  import type { StoredRadioText } from '../radio/radio-texts.ts';
  import Panel from '../ui/Panel.svelte';
  import { timeline } from './timeline.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    groupState: GroupState;
    self: NodeId;
    /** Coordinators can send alerts as well as messages (a UI rule, see ADR-0005). */
    canAlert: boolean;
    onsend: (text: string) => Promise<void>;
    onalert: (level: AlertLevel, text: string) => Promise<void>;
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
    canAlert,
    onsend,
    onalert,
    radioTexts,
    showRadioTab,
    onclose,
  }: Props = $props();

  let tab: 'group' | 'meshcore' = $state('group');

  let text = $state('');
  let sendAs: 'message' | AlertLevel = $state('message');
  let list: HTMLOListElement | undefined = $state();
  const entries = $derived(timeline(groupState));
  const size = $derived(utf8ByteLength(text.trim()));
  const maxBytes = $derived(sendAs === 'message' ? CHAT_MAX_BYTES : ALERT_TEXT_MAX_BYTES);
  const canSend = $derived(size > 0 && size <= maxBytes);

  async function send(): Promise<void> {
    if (!canSend) return;
    const message = text.trim();
    const kind = sendAs;
    text = '';
    sendAs = 'message';
    if (kind === 'message') await onsend(message);
    else await onalert(kind, message);
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
          </li>
        {/each}
      </ol>
    {/if}

    <form
      class="compose section"
      onsubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      {#if canAlert}
        <select bind:value={sendAs} aria-label={t('sendAs')}>
          <option value="message">{t('message')}</option>
          {#each Object.entries(ALERT_LEVELS) as [level, label] (level)}
            <option value={level}>{t('alert')}: {t(label)}</option>
          {/each}
        </select>
      {/if}
      <div class="line">
        <input
          bind:value={text}
          aria-label={t('message')}
          placeholder={t('message')}
          autocomplete="off"
        />
        <button type="submit" class="primary" disabled={!canSend}>{t('send')}</button>
      </div>
    </form>
    {#if size > maxBytes}<p class="warning">{t('messageTooLong')}</p>{/if}
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
    font-size: 0.75rem;
    border: 1px solid currentcolor;
    border-radius: 999px;
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
    border-radius: 0.75rem;
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

  .meta {
    color: var(--muted);
    font-size: 0.75rem;
  }

  .text {
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }

  .compose {
    display: grid;
    gap: 0.5rem;
  }

  .line {
    display: flex;
    gap: 0.5rem;
  }

  .line input {
    flex: 1;
    min-width: 0;
  }
</style>
