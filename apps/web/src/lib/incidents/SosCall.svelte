<!-- Calling for help: the SOS dialog while `open`, a notice of what became of the call once sent,
     and, for a call sent with no place, this device's position as soon as the GPS has it
     (protocol §3.8). -->
<script lang="ts">
  import type { LatLon, SosKind } from '@tesel/protocol';

  import type { MessageKey, Translate } from '../i18n/index.ts';
  import { deviceLocation } from '../position/device-location.svelte.ts';
  import { radio } from '../radio/radio.svelte.ts';
  import { notices } from '../ui/notices.svelte.ts';
  import { attempt } from '../ui/submission.svelte.ts';
  import type { WorkspaceGroup } from '../workspace/workspace.ts';
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

  /** An SOS went out with no place: the GPS stays on until the first fix, which follows it. */
  let withoutPlace = $state(false);

  $effect(() => {
    const feed = group.feed;
    if (!withoutPlace) return;
    return deviceLocation.use((fix) => {
      withoutPlace = false;
      attempt(() => feed.sharePosition(fix), t('actionFailed'));
    });
  });

  async function send(
    kind: SosKind,
    at: LatLon | null,
    accuracy: number | null,
    text: string,
  ): Promise<void> {
    await group.feed.sendSos(kind, at, accuracy, text);
    onclose();
    withoutPlace = at === null;
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
