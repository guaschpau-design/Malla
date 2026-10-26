<!-- Copies a text to the clipboard and says so for a moment. -->
<script lang="ts">
  interface Props {
    text: string;
    label: string;
    copiedLabel: string;
  }

  let { text, label, copiedLabel }: Props = $props();

  let copied = $state(false);

  async function copy(): Promise<void> {
    await navigator.clipboard.writeText(text);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }
</script>

<button onclick={copy}>{copied ? copiedLabel : label}</button>
