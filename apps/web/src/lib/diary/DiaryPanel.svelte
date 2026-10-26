<!-- The operation diary: everything that has happened in the group, newest first, to read, to
     download for the report, and the group's log to save or load on another device. -->
<script lang="ts">
  import type { CoordinateFormat } from '../coordinates/coordinates.ts';
  import { formatTime } from '../format.ts';
  import type { Locale, MessageKey, Translate } from '../i18n/index.ts';
  import type { Preference } from '../settings/preference.svelte.ts';
  import type { GroupFeed, LogImport } from '../sync/group-feed.svelte.ts';
  import { downloadFile } from '../ui/download.ts';
  import Panel from '../ui/Panel.svelte';
  import { diaryLines } from './diary.ts';
  import { diaryText, fileName } from './diary-text.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    feed: GroupFeed;
    format: Preference<CoordinateFormat>;
    onclose: () => void;
  }

  let { t, locale, feed, format, onclose }: Props = $props();

  const lines = $derived(diaryLines(feed.state, t));
  const newestFirst = $derived([...lines].reverse());
  let loaded: LogImport | null = $state(null);

  const OUTCOMES: Readonly<Record<Exclude<LogImport['kind'], 'loaded'>, MessageKey>> = {
    'other-group': 'logOtherGroup',
    unreadable: 'logUnreadable',
  };

  function downloadDiary(): void {
    const now = Date.now();
    const text = diaryText(lines, { group: feed.groupName, format: format.value, locale, t, now });
    downloadFile(fileName(feed.groupName, now, 'txt'), text, 'text/plain;charset=utf-8');
  }

  async function saveLog(): Promise<void> {
    const name = fileName(feed.groupName, Date.now(), 'tesel');
    downloadFile(name, await feed.exportLog(), 'application/json');
  }

  async function loadLog(event: Event & { currentTarget: HTMLInputElement }): Promise<void> {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (file === undefined) return;
    loaded = await feed.importLog(await file.text());
    input.value = '';
  }
</script>

<Panel title={t('diary')} closeLabel={t('close')} {onclose}>
  <div class="stack section">
    <p class="intro">{t('diaryIntro')}</p>
    <div class="row">
      <button onclick={downloadDiary} disabled={lines.length === 0}>{t('diaryDownload')}</button>
    </div>

    {#if newestFirst.length === 0}
      <p class="hint">{t('diaryEmpty')}</p>
    {:else}
      <ol class="diary">
        {#each newestFirst as line (line.key)}
          <li>
            <span class="hint">{formatTime(line.time * 1000, locale)} · {line.author}</span>
            <span>{line.text}</span>
          </li>
        {/each}
      </ol>
    {/if}
  </div>

  <section class="stack section" aria-labelledby="log-title">
    <h3 id="log-title">{t('logTitle')}</h3>
    <p class="hint">{t('logHint')}</p>
    <div class="row">
      <button onclick={saveLog}>{t('logSave')}</button>
      <label class="file">
        <input type="file" accept=".tesel,application/json" onchange={loadLog} />
        <span>{t('logLoad')}</span>
      </label>
    </div>
    {#if loaded?.kind === 'loaded'}
      <p role="status">{t('logLoaded', { added: loaded.added, total: loaded.total })}</p>
    {:else if loaded}
      <p class="warning" role="status">{t(OUTCOMES[loaded.kind])}</p>
    {/if}
  </section>
</Panel>

<style>
  .diary {
    display: grid;
    gap: 0.6rem;
    max-height: 45dvh;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    list-style: none;
  }

  .diary li {
    display: grid;
    gap: 0.1rem;
  }

  .diary .hint {
    font-size: 0.8rem;
  }

  /* A file input that looks like the buttons beside it. */
  .file {
    display: inline-flex;
    padding: 0.5rem 0.8rem;
    cursor: pointer;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
  }

  .file input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
  }

  .file:focus-within {
    outline: 2px solid var(--accent-line);
    outline-offset: 2px;
  }
</style>
