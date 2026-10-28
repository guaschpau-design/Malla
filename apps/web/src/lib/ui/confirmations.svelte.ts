// Questions asked before something that cannot be undone: deleting, leaving a group, cancelling an
// SOS or a task. One for the whole app, in its own dialog (ConfirmDialog.svelte) rather than the
// browser's confirm(), which stops the whole page, cannot take the app's look or language, and
// which some installed apps never show.

export interface Question {
  /** What is asked, e.g. "Delete “Fire” for the whole group?". */
  readonly text: string;
  /** The button that goes ahead, named after what it does: "Delete". */
  readonly confirm: string;
}

export interface AskedQuestion extends Question {
  readonly id: number;
}

class Confirmations {
  /** The question shown now, if any. */
  current: AskedQuestion | null = $state.raw(null);
  #next = 1;
  #answer: ((yes: boolean) => void) | null = null;

  /** Asks a question; true if the user goes ahead. A new question answers the one before it no. */
  ask(question: Question): Promise<boolean> {
    this.answer(false);
    return new Promise((resolve) => {
      this.current = { ...question, id: this.#next++ };
      this.#answer = resolve;
    });
  }

  /** The user's answer to the question shown now. */
  answer(yes: boolean): void {
    const resolve = this.#answer;
    this.#answer = null;
    this.current = null;
    resolve?.(yes);
  }
}

export const confirmations = new Confirmations();
