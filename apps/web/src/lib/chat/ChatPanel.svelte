<!-- The active group's chat. -->
<script lang="ts">
  import type { GroupState } from '@malla/core';
  import { CHAT_MAX_BYTES, utf8ByteLength, type NodeId } from '@malla/protocol';
  import { tick } from 'svelte';

  import { formatTime } from '../format.ts';
  import type { Locale, Translate } from '../i18n/index.ts';
  import Panel from '../ui/Panel.svelte';

  interface Props {
    t: Translate;
    locale: Locale;
    groupState: GroupState;
    self: NodeId;
    onsend: (text: string) => Promise<void>;
    onclose: () => void;
  }

  let { t, locale, groupState, self, onsend, onclose }: Props = $props();

  let text = $state('');
  let list: HTMLOListElement | undefined = $state();
  const size = $derived(utf8ByteLength(text.trim()));
  const canSend = $derived(size > 0 && size <= CHAT_MAX_BYTES);

  async function send(): Promise<void> {
    if (!canSend) return;
    const message = text.trim();
    text = '';
    await onsend(message);
  }

  // Keep the newest message in view.
  $effect(() => {
    if (groupState.chat.at(-1) === undefined) return;
    void tick().then(() => list?.lastElementChild?.scrollIntoView({ block: 'end' }));
  });
</script>

<Panel title={t('chat')} closeLabel={t('close')} {onclose}>
  {#if groupState.chat.length === 0}
    <p class="hint section">{t('noMessages')}</p>
  {:else}
    <ol class="messages section" bind:this={list}>
      {#each groupState.chat as line (`${line.origin}/${String(line.seq)}`)}
        <li class:own={line.origin === self}>
          <span class="meta">
            {groupState.members.get(line.origin)?.alias ?? line.origin} · {formatTime(
              line.time * 1000,
              locale,
            )}
          </span>
          <span class="text">{line.text}</span>
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
    <input
      bind:value={text}
      aria-label={t('message')}
      placeholder={t('message')}
      autocomplete="off"
    />
    <button type="submit" class="primary" disabled={!canSend}>{t('send')}</button>
  </form>
  {#if size > CHAT_MAX_BYTES}<p class="warning">{t('messageTooLong')}</p>{/if}
</Panel>

<style>
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
    border-color: var(--accent);
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
    display: flex;
    gap: 0.5rem;
  }

  .compose input {
    flex: 1;
    min-width: 0;
  }
</style>
