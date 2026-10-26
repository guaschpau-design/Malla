// Cutting text between the characters people see, so an emoji or an accented letter is never
// split in two.

const segmenter = new Intl.Segmenter();

function characters(text: string): string[] {
  return Array.from(segmenter.segment(text), (part) => part.segment);
}

/** The text cut to at most `length` characters, with an ellipsis when it was longer. */
export function shorten(text: string, length: number): string {
  const all = characters(text);
  return all.length <= length ? text : `${all.slice(0, length - 1).join('')}…`;
}

/** The first character of a name, in capitals, for a round avatar. */
export function initialOf(name: string): string {
  return characters(name.trim())[0]?.toUpperCase() ?? '?';
}
