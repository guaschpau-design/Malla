<!-- A member of the group, as they tell the team about themselves (MemberSheet): their status,
     profile, position and the way there, battery, equipment and tasks, and what of theirs has
     reached this device and how. -->
<script lang="ts">
  import { teamOf, type GroupState } from '@tesel/core';
  import type { NodeId } from '@tesel/protocol';

  import CoordinateBlock from '../coordinates/CoordinateBlock.svelte';
  import type { CoordinateFormat } from '../coordinates/coordinates.ts';
  import { formatAgo, formatTime } from '../format.ts';
  import { ROLE_LABELS } from '../groups/role-label.ts';
  import type { Locale, Translate } from '../i18n/index.ts';
  import type { Heard } from '../links/heard.ts';
  import FromHere from '../navigation/FromHere.svelte';
  import type { Preference } from '../settings/preference.svelte.ts';
  import { pendingFor } from '../tasks/tasks.ts';
  import Actions from '../ui/Actions.svelte';
  import Fold from '../ui/Fold.svelte';
  import { clockEvery } from '../ui/now.svelte.ts';
  import Panel from '../ui/Panel.svelte';
  import { aliasOf } from './alias.ts';
  import MemberSheet from './MemberSheet.svelte';

  interface Props {
    t: Translate;
    locale: Locale;
    groupState: GroupState;
    /** This device: the tasks shown are in its list's order. */
    self: NodeId;
    heard: Heard;
    id: NodeId;
    format: Preference<CoordinateFormat>;
    /** Guide this device there; the name says where to. */
    onnavigate: (name: string) => void;
    onclose: () => void;
  }

  let { t, locale, groupState, self, heard, id, format, onnavigate, onclose }: Props = $props();

  /** What a member who has said nothing is taken to be. */
  const UNTOLD = {
    profile: 'unspecified',
    status: 'active',
    battery: null,
    equipment: [],
  } as const;

  const alias = $derived(aliasOf(groupState, id));
  const role = $derived(groupState.members.get(id)?.role);
  const state = $derived(groupState.memberStates.get(id) ?? UNTOLD);
  const report = $derived(groupState.positions.get(id));
  const now = clockEvery(15_000);
  const channels = $derived(heard.get(id) ?? {});
  const ago = (time: number) => formatAgo(time, locale, now.seconds);
</script>

<Panel title={alias} closeLabel={t('close')} {onclose}>
  <div class="stack section">
    {#if role === 'coordinator'}<p class="hint">{t(ROLE_LABELS[role])}</p>{/if}
    <MemberSheet
      {t}
      {state}
      team={teamOf(groupState.teams, id)}
      tasks={pendingFor(groupState, id, self)}
      positionSummary={report?.type === 'position' ? ago(report.time) : t('memberNoPosition')}
    >
      {#snippet position()}
        {#if report?.type === 'position'}
          {@const at = { lat: report.lat, lon: report.lon }}
          <p class="hint">{t('positionAt', { time: formatTime(report.time * 1000, locale) })}</p>
          <CoordinateBlock {t} {at} {format} />
          <FromHere {t} {locale} {at} />
        {:else}
          <p class="hint">{t('memberNoPosition')}</p>
        {/if}
      {/snippet}
      {#snippet more()}
        <Fold
          title={t('heardTitle')}
          summary={channels.radio === undefined
            ? t('heardRadioNever')
            : t('heardRadio', { ago: ago(channels.radio) })}
        >
          <p>
            {channels.radio === undefined
              ? t('heardRadioNever')
              : t('heardRadio', { ago: ago(channels.radio) })}
          </p>
          {#if channels.internet !== undefined}
            <p>{t('heardInternet', { ago: ago(channels.internet) })}</p>
          {/if}
        </Fold>
      {/snippet}
    </MemberSheet>
    {#if report?.type === 'position'}
      <Actions
        actions={[
          {
            icon: 'heading',
            label: t('guideMe'),
            run: () => {
              onnavigate(alias);
            },
          },
        ]}
        moreLabel={t('moreActions')}
      />
    {/if}
  </div>
</Panel>
