<!-- A member of the group: who they are, where they were last, and the way there. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import type { NodeId } from '@tesel/protocol';

  import CoordinateBlock from '../coordinates/CoordinateBlock.svelte';
  import type { CoordinateFormat } from '../coordinates/coordinates.ts';
  import { formatTime } from '../format.ts';
  import type { Locale, Translate } from '../i18n/index.ts';
  import { aliasOf } from '../incidents/incidents.ts';
  import FromHere from '../navigation/FromHere.svelte';
  import type { DeviceLocation } from '../position/device-location.svelte.ts';
  import type { Preference } from '../settings/preference.svelte.ts';
  import Panel from '../ui/Panel.svelte';
  import { ROLE_LABELS } from './role-label.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    groupState: GroupState;
    id: NodeId;
    format: Preference<CoordinateFormat>;
    location: DeviceLocation;
    /** Guide this device there; the name says where to. */
    onnavigate: (name: string) => void;
    onclose: () => void;
  }

  let { t, locale, groupState, id, format, location, onnavigate, onclose }: Props = $props();

  const alias = $derived(aliasOf(groupState, id));
  const role = $derived(groupState.members.get(id)?.role);
  const report = $derived(groupState.positions.get(id));
</script>

<Panel title={alias} closeLabel={t('close')} {onclose}>
  <div class="stack section">
    {#if role}<p>{t(ROLE_LABELS[role])}</p>{/if}
    {#if report?.type === 'position'}
      {@const at = { lat: report.lat, lon: report.lon }}
      <p class="hint">{t('positionAt', { time: formatTime(report.time * 1000, locale) })}</p>
      <CoordinateBlock {t} {at} {format} />
      <FromHere
        {t}
        {locale}
        {at}
        {location}
        onnavigate={() => {
          onnavigate(alias);
        }}
      />
    {:else}
      <p class="hint">{t('memberNoPosition')}</p>
    {/if}
  </div>
</Panel>
