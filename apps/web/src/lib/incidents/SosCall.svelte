<!-- Calling for help: the SOS dialog while `open`, and a notice of what became of the call once
     sent (protocol §3.8). -->
<script lang="ts">
  import type { LatLon, SosKind } from '@tesel/protocol';

  import type { MessageKey, Translate } from '../i18n/index.ts';
  import { radio } from '../radio/radio.svelte.ts';
  import { notices } from '../ui/notices.svelte.ts';
  import type { WorkspaceGroup } from '../workspace/workspace.ts';
  import { callForHelp } from './call-for-help.ts';
  import SosDialog from './SosDialog.svelte';

  interface Props {
    t: Translate;
    group: WorkspaceGroup;
    /** The dialog is open: the dock's SOS button and "I need help" open it. */
    open: boolean;
    /** Closes the dialog: the call was sent, or the user cancelled it. */
    onclose: () => void;
  }

  let { t, group, open, onclose }: Props = $props();

  async function send(
    kind: SosKind,
    at: LatLon | null,
    accuracy: number | null,
    text: string,
  ): Promise<void> {
    await callForHelp(group.feed, kind, at === null ? null : { at, accuracy }, text);
    onclose();
    notices.show(t(outcome()));
  }

  /** What became of the call: it is with the group, on its way by radio, or waiting. */
  function outcome(): MessageKey {
    if (group.practice || group.feed.status === 'synced') return 'sosSent';
    return radio.linked ? 'sosByRadio' : 'sosWaiting';
  }
</script>

{#if open}
  <SosDialog {t} onsend={send} oncancel={onclose} />
{/if}
