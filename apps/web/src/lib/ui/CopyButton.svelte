<!-- Copies a text to the clipboard and says so for a moment. -->
<script lang="ts">
  import { Copier } from './copier.svelte.ts';

  interface Props {
    text: string;
    label: string;
    copiedLabel: string;
    /** Said when the browser refuses the clipboard. */
    failedLabel: string;
  }

  let { text, label, copiedLabel, failedLabel }: Props = $props();

  const copier = new Copier();
</script>

<button
  onclick={() => {
    copier.copy(text, failedLabel);
  }}>{copier.copied ? copiedLabel : label}</button
>
