<!-- What each way of reaching the group is doing: the internet (or a command post) and the radio. -->
<script lang="ts">
  import type { Translate } from '../i18n/index.ts';
  import type { RadioSession } from '../radio/radio.svelte.ts';
  import RadioSection from '../radio/RadioSection.svelte';
  import Panel from '../ui/Panel.svelte';

  interface Props {
    t: Translate;
    /** A sentence on the internet link (links.ts serverDetail). */
    internet: string;
    radio: RadioSession;
    /** Name of the active group, or null if there is none. */
    groupName: string | null;
    onclose: () => void;
  }

  let { t, internet, radio, groupName, onclose }: Props = $props();
</script>

<Panel title={t('connections')} closeLabel={t('close')} {onclose}>
  <p class="intro section">{t('connectionsIntro')}</p>
  <section class="stack section" aria-labelledby="internet-title">
    <h3 id="internet-title">{t('internetTitle')}</h3>
    <p>{internet}</p>
  </section>
  <RadioSection {t} {radio} {groupName} />
</Panel>
