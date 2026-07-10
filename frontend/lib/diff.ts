// Word-level diff (LCS over whitespace-preserving tokens) for before/after prompt views.
// No dependency: prompts are small enough that an O(n·m) table is fine, with a guard
// that falls back to whole-text removed/added when the product would be too large.

export type DiffKind = "same" | "added" | "removed";
export interface DiffPart {
  text: string;
  kind: DiffKind;
}

const MAX_CELLS = 1_500_000;

function tokenize(s: string): string[] {
  return s.split(/(\s+)/).filter(Boolean);
}

export function diffWords(before: string, after: string): DiffPart[] {
  const a = tokenize(before);
  const b = tokenize(after);
  const n = a.length;
  const m = b.length;

  if ((n + 1) * (m + 1) > MAX_CELLS) {
    return [
      { text: before, kind: "removed" },
      { text: after, kind: "added" },
    ];
  }

  const w = m + 1;
  const lcs = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i * w + j] =
        a[i] === b[j]
          ? lcs[(i + 1) * w + j + 1] + 1
          : Math.max(lcs[(i + 1) * w + j], lcs[i * w + j + 1]);
    }
  }

  const parts: DiffPart[] = [];
  const push = (text: string, kind: DiffKind) => {
    const last = parts[parts.length - 1];
    if (last && last.kind === kind) last.text += text;
    else parts.push({ text, kind });
  };

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push(a[i], "same");
      i++;
      j++;
    } else if (lcs[(i + 1) * w + j] >= lcs[i * w + j + 1]) {
      push(a[i], "removed");
      i++;
    } else {
      push(b[j], "added");
      j++;
    }
  }
  while (i < n) push(a[i++], "removed");
  while (j < m) push(b[j++], "added");
  return parts;
}
