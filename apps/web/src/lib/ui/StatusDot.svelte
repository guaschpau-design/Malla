<!-- A small coloured dot that says how something is doing: green good, orange fair, red poor. Only
     the look; the words beside it say the same for screen readers. On a dark background, set
     `--status-good` to a lighter green (the header uses the signal lime). -->
<script lang="ts">
  import type { StatusTone } from './status-tone.ts';

  interface Props {
    tone: StatusTone;
  }

  let { tone }: Props = $props();
</script>

<span class="dot {tone}" aria-hidden="true"></span>

<style>
  .dot {
    flex-shrink: 0;
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 50%;
  }

  .good {
    background: var(--status-good, var(--signal-deep));
  }

  .fair {
    background: var(--warning);
  }

  .poor {
    background: var(--danger);
  }
</style>
