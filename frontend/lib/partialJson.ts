// Best-effort parse of a JSON document that is still arriving.
//
// The model emits its structured output as a single JSON text block, so every chunk boundary
// leaves a truncated document: an unterminated string, a half-written key, unclosed braces.
// This closes whatever is still open and parses what's there, so the UI can render fields as
// they land instead of waiting for the whole 13-21s generation.
//
// It is deliberately only used to drive the in-flight preview. The stream's final `done`
// message carries the authoritative, schema-validated result, so a chunk this can't make sense
// of costs nothing but one skipped repaint — never a wrong final answer.

/** Rebuild a parseable document from `src` by closing whatever it left open. */
function closeOpenStructures(src: string): string {
  const closers: string[] = [];
  let inString = false;
  let escaped = false;

  for (const ch of src) {
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") closers.push("}");
    else if (ch === "[") closers.push("]");
    else if (ch === "}" || ch === "]") closers.pop();
  }

  let out = src;
  // A trailing backslash would escape the quote we're about to add.
  if (escaped) out = out.slice(0, -1);
  if (inString) out += '"';
  // A separator with nothing after it yet (`{"a":1,` or `{"a":`).
  out = out.replace(/\s*[,:]\s*$/, "");
  for (let i = closers.length - 1; i >= 0; i--) out += closers[i];
  return out;
}

/**
 * Index to cut at to drop a partially-written trailing member — the start of the last
 * container or the last separator, whichever came later. Used when simply closing the open
 * structures still doesn't parse, e.g. `{"a":1,"b"` (a key with no value yet).
 */
function lastMemberStart(src: string): number {
  let inString = false;
  let escaped = false;
  let cut = -1;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === ",") cut = i;
    else if (ch === "{" || ch === "[") cut = i + 1;
  }
  return cut;
}

/**
 * Parse a possibly-truncated JSON object. Returns `undefined` when the text can't be made
 * sense of yet — callers should keep whatever they last rendered.
 */
export function parsePartialJson(text: string): Record<string, unknown> | undefined {
  const src = text.trimStart();
  if (!src.startsWith("{")) return undefined;

  const attempts = [src, closeOpenStructures(src)];
  const cut = lastMemberStart(src);
  if (cut > 0) attempts.push(closeOpenStructures(src.slice(0, cut)));

  for (const candidate of attempts) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Try the next repair.
    }
  }
  return undefined;
}
