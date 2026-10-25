<script lang="ts">
  import { PROTOCOL_VERSION } from '@malla/protocol';

  import { detectLocale, locales, type Locale } from './lib/i18n/index.ts';

  let locale = $state<Locale>(detectLocale(navigator.languages));
  const t = $derived(locales[locale]);
</script>

<main>
  <h1>Malla</h1>
  <p class="tagline">{t.appTagline}</p>
  <p class="meta">{t.protocolVersion}: {PROTOCOL_VERSION}</p>
  <label>
    {t.language}
    <select bind:value={locale}>
      <option value="es">Español</option>
      <option value="en">English</option>
    </select>
  </label>
</main>

<style>
  main {
    max-width: 40rem;
    margin: 0 auto;
    padding: 3rem 1rem;
  }

  h1 {
    margin: 0;
    font-size: 2.5rem;
  }

  .tagline {
    font-size: 1.2rem;
  }

  .meta {
    color: var(--muted);
  }
</style>
