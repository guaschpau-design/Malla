<script lang="ts">
  import { drawQr } from './qr.ts';

  let { text, label }: { text: string; label: string } = $props();

  const qr = $derived(drawQr(text));
</script>

<!-- Always dark on white: phone cameras read inverted codes poorly. -->
<svg viewBox="0 0 {qr.size} {qr.size}" role="img" aria-label={label} shape-rendering="crispEdges">
  <rect width={qr.size} height={qr.size} fill="#fff" />
  <path d={qr.path} fill="#000" />
</svg>

<style>
  svg {
    display: block;
    width: min(100%, 18rem);
    margin: 0 auto;
    border-radius: 0.5rem;
  }
</style>
