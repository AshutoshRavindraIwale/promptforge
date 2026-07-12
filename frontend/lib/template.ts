// Template placeholders: bracketed uppercase fields like [TOPIC], [TARGET AUDIENCE],
// or [INPUT_TEXT] inside a saved prompt. The engine's revised prompts already use this
// convention for values the user must supply, so any such prompt is usable as a template.

const PLACEHOLDER = /\[([A-Z][A-Z0-9 _-]*)\]/g;

/** Unique placeholder names in order of first appearance, without brackets. */
export function extractPlaceholders(text: string): string[] {
  const seen = new Set<string>();
  for (const match of text.matchAll(PLACEHOLDER)) seen.add(match[1]);
  return [...seen];
}

/** Replace every filled placeholder; leave blanks intact so gaps stay visible. */
export function fillTemplate(
  text: string,
  values: Record<string, string>,
): string {
  return text.replace(PLACEHOLDER, (whole, name: string) => {
    const value = values[name]?.trim();
    return value ? value : whole;
  });
}
