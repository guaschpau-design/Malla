<!-- One way of reaching the group in the connections panel: its sign and name, a coloured dot with
     how it is doing, and what can be done with it. -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  import type { GlyphName } from '../ui/glyphs.ts';
  import Pictogram from '../ui/Pictogram.svelte';
  import StatusDot from '../ui/StatusDot.svelte';
  import { LEVEL_TONES, type Link } from './links.ts';

  interface Props {
    icon: GlyphName;
    name: string;
    level: Link['level'];
    status: string;
    children?: Snippet;
  }

  let { icon, name, level, status, children }: Props = $props();
</script>

<section class="channel {level}" aria-label={name}>
  <span class="sign"><Pictogram name={icon} size={28} /></span>
  <div class="body">
    <strong>{name}</strong>
    <span class="status"><StatusDot tone={LEVEL_TONES[level]} />{status}</span>
    {@render children?.()}
  </div>
</section>

<style>
  .channel {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.9rem;
    align-items: start;
    padding: 0.85rem;
    border: 1px solid var(--border);
    border-radius: 0.9rem;
  }

  .channel.ok {
    border-color: var(--accent-line);
  }

  .sign {
    display: grid;
    place-items: center;
    width: 3rem;
    height: 3rem;
    background: var(--bg);
    border-radius: 0.75rem;
  }

  .ok .sign {
    color: var(--on-accent);
    background: var(--signal);
  }

  .body {
    display: grid;
    gap: 0.35rem;
  }

  strong {
    font-size: 1.1rem;
  }

  .status {
    display: flex;
    gap: 0.45rem;
    align-items: center;
    font-size: 0.9rem;
  }
</style>
