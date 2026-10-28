<!-- The app's one live region (announcer.svelte.ts): heard, not seen, since what it says is
     already on screen. A new element for each announcement makes screen readers read it. -->
<script lang="ts">
  import { announcer } from './announcer.svelte.ts';
</script>

{#if announcer.last}
  {#key announcer.last.id}
    <p class="announcement" role="alert">{announcer.last.text}</p>
  {/key}
{/if}

<style>
  .announcement {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
