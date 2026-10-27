<!-- Creating a group: only its name is asked. The server it uses is proposed and can be changed
     under "Server", which most people never open. -->
<script lang="ts">
  import { GROUP_NAME_MAX_BYTES } from '@tesel/protocol';

  import { defaultServerUrl } from '../config.ts';
  import type { Translate } from '../i18n/index.ts';
  import type { Session } from '../session.svelte.ts';
  import { proposedServer } from '../sync/relays.ts';
  import { Submission } from '../ui/submission.svelte.ts';
  import { normalizeGroupName, normalizeServerUrl } from './group.ts';

  interface Props {
    t: Translate;
    session: Session;
    /** Back to the groups, once created or when giving up. */
    onback: () => void;
  }

  let { t, session, onback }: Props = $props();

  let newName = $state('');
  const groupName = $derived(normalizeGroupName(newName));
  const nameTooLong = $derived(newName.trim() !== '' && groupName === null);
  const homeServer = defaultServerUrl();
  let serverText = $state(homeServer ?? '');
  const server = $derived(normalizeServerUrl(serverText));

  // Opened from a command post, new groups belong to the server the post replicates.
  void proposedServer(homeServer).then((proposed) => {
    if (proposed !== null && serverText === (homeServer ?? '')) serverText = proposed;
  });

  const submission = new Submission();

  async function create(): Promise<void> {
    if (groupName === null || server === undefined) return;
    const name = groupName;
    const chosen = server;
    if (await submission.run(() => session.createGroup(name, chosen))) onback();
  }
</script>

<form
  class="stack section"
  onsubmit={(event) => {
    event.preventDefault();
    void create();
  }}
>
  <h3>{t('createGroup')}</h3>
  <label>
    {t('groupName')}
    <!-- svelte-ignore a11y_autofocus -->
    <input bind:value={newName} maxlength={GROUP_NAME_MAX_BYTES} autofocus />
  </label>
  {#if nameTooLong}<p class="warning">{t('nameInvalid')}</p>{/if}
  <details open={server === undefined}>
    <summary>{t('server')}</summary>
    <div class="stack">
      <input
        bind:value={serverText}
        aria-label={t('server')}
        inputmode="url"
        autocomplete="off"
        placeholder="https://"
      />
      <p class:warning={server === undefined} class:hint={server !== undefined}>
        {server === undefined ? t('serverInvalid') : t('serverHint')}
      </p>
    </div>
  </details>
  {#if submission.failed}<p class="warning">{t('sendFailed')}</p>{/if}
  <div class="row">
    <button
      type="submit"
      class="primary"
      disabled={submission.busy || groupName === null || server === undefined}
    >
      {t('create')}
    </button>
    <button type="button" onclick={onback}>{t('back')}</button>
  </div>
</form>

<style>
  summary {
    cursor: pointer;
    color: var(--muted);
    font-size: var(--text-secondary);
  }

  details .stack {
    margin-top: 0.5rem;
  }
</style>
