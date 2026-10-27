<!-- A modal card for decisions that must be taken before going on (first launch, joining). -->
<script lang="ts">
  import { onMount, type Snippet } from 'svelte';

  interface Props {
    title: string;
    children: Snippet;
  }

  let { title, children }: Props = $props();

  let dialog: HTMLDialogElement;
  const titleId = `dialog-${crypto.randomUUID()}`;

  onMount(() => {
    dialog.showModal();
  });
</script>

<!-- Escape must not dismiss it: the parent decides when it closes. -->
<dialog
  bind:this={dialog}
  aria-labelledby={titleId}
  oncancel={(event) => {
    event.preventDefault();
  }}
>
  <h2 id={titleId}>{title}</h2>
  {@render children()}
</dialog>

<style>
  dialog {
    width: min(26rem, calc(100vw - 2rem));
    padding: 1.25rem;
    color: var(--fg);
    background: var(--surface);
    border: none;
    border-radius: var(--radius-sheet);
    box-shadow: var(--shadow-dialog);
  }

  dialog::backdrop {
    background: rgb(15 23 42 / 55%);
  }

  h2 {
    margin: 0 0 0.75rem;
    font-size: var(--text-title);
  }
</style>
