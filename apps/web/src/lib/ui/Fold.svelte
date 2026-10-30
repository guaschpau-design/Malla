<!-- A section that opens with a tap: closed, one line says what it holds and the gist of it, so a
     panel stays short and can be read at a glance. -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  import Pictogram from './Pictogram.svelte';

  interface Props {
    title: string;
    /** The gist, shown beside the title. */
    summary: string;
    /** Opens it, as when what it holds needs looking at. */
    open?: boolean;
    children: Snippet;
  }

  let { title, summary, open = false, children }: Props = $props();
</script>

<details class="fold" {open}>
  <summary>
    <span class="title">{title}</span>
    <span class="summary">{summary}</span>
    <span class="chevron"><Pictogram name="chevron" size={18} /></span>
  </summary>
  <div class="content stack">{@render children()}</div>
</details>

<style>
  /* As narrow as its panel, however long the gist: the gist is cut short instead. */
  .fold {
    min-width: 0;
    border-top: 1px solid var(--border);
  }

  summary {
    display: flex;
    gap: 0.75rem;
    align-items: baseline;
    padding: 0.6rem 0;
    cursor: pointer;
    list-style: none;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  /* A chevron, the same as the top bar's, that points down once the section opens. */
  .chevron {
    flex: none;
    align-self: center;
    margin-left: auto;
    rotate: -90deg;
    transition: rotate 0.15s;
  }

  .fold[open] > summary .chevron {
    rotate: 0deg;
  }

  .title {
    font-weight: 600;
  }

  .summary {
    flex: 1 1 0;
    min-width: 0;
    overflow: hidden;
    color: var(--muted);
    font-size: var(--text-secondary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .content {
    padding-bottom: 0.75rem;
  }
</style>
