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
    onback: () => void;
  }

  let { t, onstart, onback }: Props = $props();

  let situation: Situation = $state('missing-person');
  let role: Role = $state('member');

  const PARTS: readonly { role: Role; name: MessageKey; hint: MessageKey }[] = [
    { role: 'member', name: 'practiceAsMember', hint: 'practiceAsMemberHint' },
    { role: 'coordinator', name: 'practiceAsCoordinator', hint: 'practiceAsCoordinatorHint' },
  ];

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
  <div class="choices" role="radiogroup" aria-label={t('practiceSituation')}>
    {#each SITUATIONS as option (option)}
      <button
        type="button"
        role="radio"
        aria-checked={situation === option}
        onclick={() => (situation = option)}
      >
        <Pictogram name={SITUATION_INFO[option].icon} size={24} />
        {t(SITUATION_INFO[option].title)}
      </button>
    {/each}
  </div>
  <div class="parts" role="radiogroup" aria-label={t('practiceYourPart')}>
    {#each PARTS as part (part.role)}
      <button
        type="button"
        role="radio"
        aria-checked={role === part.role}
        onclick={() => (role = part.role)}
      >
        <strong>{t(part.name)}</strong>
        <span class="hint">{t(part.hint)}</span>
      </button>
    {/each}
  </div>
  {#if submission.failed}<p class="warning">{t('actionFailed')}</p>{/if}
  <div class="row">
    <button type="submit" class="primary" disabled={submission.busy}>{t('practiceStart')}</button>
    <button type="button" onclick={onback}>{t('back')}</button>
  </div>
</form>

<style>
  /* Three situations side by side, each a pictogram over its name. */
  .choices {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.5rem;
  }

  .choices button {
    display: grid;
    gap: 0.3rem;
    place-items: center;
    padding: 0.6rem 0.3rem;
    font-size: var(--text-secondary);
    font-weight: 600;
    text-align: center;
  }

  .parts {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
  }

  .parts button {
    display: grid;
    gap: 0.15rem;
    padding: 0.5rem 0.6rem;
    text-align: left;
  }

  [role='radio'][aria-checked='true'] {
    border-color: var(--accent-line);
    box-shadow: inset 0 0 0 1px var(--accent-line);
  }
</style>
