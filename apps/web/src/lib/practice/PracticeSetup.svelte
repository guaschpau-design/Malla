<!-- Starting a practice: which situation to play, and whether the user takes part as a member of
     the team, who gets tasks, or as its coordinator, who hands them out (ADR-0066). -->
<script lang="ts">
  import type { Role } from '@tesel/protocol';

  import type { MessageKey, Translate } from '../i18n/index.ts';
  import Pictogram from '../ui/Pictogram.svelte';
  import { Submission } from '../ui/submission.svelte.ts';
  import { SITUATION_INFO, SITUATIONS, type Situation } from './situations.ts';

  interface Props {
    t: Translate;
    onstart: (situation: Situation, role: Role) => Promise<void>;
    oncancel: () => void;
  }

  let { t, onstart, oncancel }: Props = $props();

  let situation: Situation = $state('missing-person');
  let role: Role = $state('member');

  /** Each part's name, and what it does, told under the choice. */
  const PARTS: Readonly<Record<Role, { name: MessageKey; hint: MessageKey }>> = {
    member: { name: 'practiceAsMember', hint: 'practiceAsMemberHint' },
    coordinator: { name: 'practiceAsCoordinator', hint: 'practiceAsCoordinatorHint' },
  };

  const submission = new Submission();
</script>

<form
  class="stack section"
  onsubmit={(event) => {
    event.preventDefault();
    void submission.run(() => onstart(situation, role));
  }}
>
  <h3>{t('startPractice')}</h3>
  <p class="hint">{t('practiceSetupIntro')}</p>
  <div class="situations" role="radiogroup" aria-label={t('practiceSituation')}>
    {#each SITUATIONS as option (option)}
      <button
        type="button"
        role="radio"
        aria-checked={situation === option}
        onclick={() => (situation = option)}
      >
        <Pictogram name={SITUATION_INFO[option].icon} size={18} />
        {t(SITUATION_INFO[option].title)}
      </button>
    {/each}
  </div>
  {#if SITUATION_INFO[situation].place === 'map'}
    <p class="hint">{t('practiceMountainWhere')}</p>
  {/if}
  <div class="parts" role="radiogroup" aria-label={t('practiceYourPart')}>
    {#each Object.entries(PARTS) as [part, text] (part)}
      <button
        type="button"
        role="radio"
        aria-checked={role === part}
        onclick={() => (role = part as Role)}>{t(text.name)}</button
      >
    {/each}
  </div>
  <p class="hint">{t(PARTS[role].hint)}</p>
  {#if submission.failed}<p class="warning">{t('actionFailed')}</p>{/if}
  <div class="row">
    <button type="submit" class="primary" disabled={submission.busy}>{t('practiceStart')}</button>
    <button type="button" onclick={oncancel}>{t('cancel')}</button>
  </div>
</form>

<style>
  /* The situations as chips, a pictogram before each name; the part as two halves of one row. */
  .situations {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .situations button {
    display: flex;
    gap: 0.35rem;
    align-items: center;
    min-height: 2.25rem;
    padding: 0.2rem 0.75rem 0.2rem 0.55rem;
    font-size: var(--text-secondary);
    border-radius: var(--radius-pill);
  }

  .parts {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.35rem;
  }

  .parts button {
    padding: 0.35rem 0.5rem;
    font-size: var(--text-secondary);
  }

  [role='radio'][aria-checked='true'] {
    font-weight: 600;
    border-color: var(--accent-line);
    box-shadow: inset 0 0 0 1px var(--accent-line);
  }
</style>
