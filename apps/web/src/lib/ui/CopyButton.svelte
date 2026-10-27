<!-- Copies a text to the clipboard and says so for a moment. -->
<script lang="ts">
  import { attempt } from './submission.svelte.ts';

  interface Props {
    text: string;
    label: string;
    copiedLabel: string;
    /** Said when the browser refuses the clipboard. */
    failedLabel: string;
  }

  let { text, label, copiedLabel, failedLabel }: Props = $props();

  let copied = $state(false);

  function copy(): void {
    attempt(async () => {
      await navigator.clipboard.writeText(text);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    }, failedLabel);
  }
</script>

<button onclick={copy}>{copied ? copiedLabel : label}</button>
