<!-- Who should do something: anyone, this device, or another member of the group by alias. Its
     value is the member's node ID, or empty for anyone. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import type { NodeId } from '@tesel/protocol';

  import type { Translate } from '../i18n/index.ts';
  import { aliasOf } from './alias.ts';

  interface Props {
    t: Translate;
    groupState: GroupState;
    self: NodeId;
    value: string;
    onchange: (value: string) => void;
  }

  let { t, groupState, self, value, onchange }: Props = $props();

  /** This device first, then everyone else the group knows, by alias. */
  const people = $derived(
    [...new Set<NodeId>([self, ...groupState.members.keys()])]
      .map((id) => ({ id, alias: aliasOf(groupState, id) }))
      .sort(
        (a, b) => Number(b.id === self) - Number(a.id === self) || a.alias.localeCompare(b.alias),
      ),
  );
</script>

<select
  {value}
  onchange={(event) => {
    onchange(event.currentTarget.value);
  }}
>
  <option value="">{t('anyoneOption')}</option>
  {#each people as person (person.id)}
    <option value={person.id}>
      {person.id === self ? `${person.alias} (${t('you')})` : person.alias}
    </option>
  {/each}
</select>

<style>
  select {
    display: block;
    width: 100%;
    margin-top: 0.25rem;
    font: inherit;
  }
</style>
