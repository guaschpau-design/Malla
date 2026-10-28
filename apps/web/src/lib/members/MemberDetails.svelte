<!-- A member of the group: who they are, where they were last, and the way there. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import type { NodeId } from '@tesel/protocol';

  import CoordinateBlock from '../coordinates/CoordinateBlock.svelte';
  import type { CoordinateFormat } from '../coordinates/coordinates.ts';
  import { formatAgo, formatTime } from '../format.ts';
  import type { Locale, Translate } from '../i18n/index.ts';
  import { aliasOf } from '../members/alias.ts';
  import FromHere from '../navigation/FromHere.svelte';
  import type { Heard } from '../links/heard.ts';
  import type { Preference } from '../settings/preference.svelte.ts';
  import { clockEvery } from '../ui/now.svelte.ts';
  import ActionButton from '../ui/ActionButton.svelte';
  import Panel from '../ui/Panel.svelte';
  import { ROLE_LABELS } from '../groups/role-label.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    groupState: GroupState;
    heard: Heard;
    id: NodeId;
    format: Preference<CoordinateFormat>;
    /** Guide this device there; the name says where to. */
    onnavigate: (name: string) => void;
    onclose: () => void;
  }

  let { t, locale, groupState, heard, id, format, onnavigate, onclose }: Props = $props();

  const alias = $derived(aliasOf(groupState, id));
  const role = $derived(groupState.members.get(id)?.role);
  const report = $derived(groupState.positions.get(id));
  const now = clockEvery(15_000);
  const channels = $derived(heard.get(id) ?? {});
  const ago = (time: number) => formatAgo(time, locale, now.seconds);
</script>

<Panel title={alias} closeLabel={t('close')} {onclose}>
  <div class="stack section">
    {#if role}<p>{t(ROLE_LABELS[role])}</p>{/if}
    {#if report?.type === 'position'}
      {@const at = { lat: report.lat, lon: report.lon }}
      <p class="hint">{t('positionAt', { time: formatTime(report.time * 1000, locale) })}</p>
      <CoordinateBlock {t} {at} {format} />
      <FromHere {t} {locale} {at} />
      <div class="row">
        <ActionButton
          icon="heading"
          label={t('guideMe')}
          onclick={() => {
            onnavigate(alias);
          }}
        />
      </div>
    {:else}
      <p class="hint">{t('memberNoPosition')}</p>
    {/if}
  </div>
  <section class="stack section" aria-label={t('heardTitle')}>
    <h3>{t('heardTitle')}</h3>
    <p>
      {channels.radio === undefined
        ? t('heardRadioNever')
        : t('heardRadio', { ago: ago(channels.radio) })}
    </p>
    {#if channels.internet !== undefined}
      <p>{t('heardInternet', { ago: ago(channels.internet) })}</p>
    {/if}
  </section>
</Panel>
