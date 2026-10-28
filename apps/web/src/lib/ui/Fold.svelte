<!-- A section that opens with a tap: closed, one line says what it holds and the gist of it, so a
     panel stays short and can be read at a glance. -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    /** The gist, shown beside the title. */
    summary: string;
    children: Snippet;
  }

  let { title, summary, children }: Props = $props();
</script>

<details class="fold">
  <summary>
    <span class="title">{title}</span>
    <span class="summary">{summary}</span>
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

  /* A chevron that turns when the section opens. */
  summary::after {
    flex: none;
    margin-left: auto;
    content: '›';
    transition: rotate 0.15s;
  }

  .fold[open] > summary::after {
    rotate: 90deg;
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
