// Chat apps the revised prompt can be handed off to. The prompt is always
// copied to the clipboard first; providers with a `buildUrl` also receive it
// via URL prefill, unless the resulting URL would exceed MAX_PREFILL_URL —
// past that length prefill gets unreliable across browsers, so we open the
// bare app and rely on the clipboard. Adding a provider is data-only here,
// plus a brand mark in OpenInProviders.tsx.

export interface ChatProvider {
  id: "claude" | "chatgpt" | "perplexity" | "gemini";
  name: string;
  /** Bare chat-app URL — fallback when prefill is unsupported or too long. */
  home: string;
  /** Builds a prefilled URL from the raw prompt. Absent → no native prefill. */
  buildUrl?: (prompt: string) => string;
}

export const MAX_PREFILL_URL = 1800;

export const CHAT_PROVIDERS: ChatProvider[] = [
  {
    id: "claude",
    name: "Claude",
    home: "https://claude.ai/new",
    buildUrl: (p) => `https://claude.ai/new?q=${encodeURIComponent(p)}`,
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    home: "https://chatgpt.com/",
    buildUrl: (p) => `https://chatgpt.com/?q=${encodeURIComponent(p)}`,
  },
  {
    id: "perplexity",
    name: "Perplexity",
    home: "https://www.perplexity.ai/",
    buildUrl: (p) => `https://www.perplexity.ai/search?q=${encodeURIComponent(p)}`,
  },
  {
    id: "gemini",
    name: "Gemini",
    home: "https://gemini.google.com/app",
  },
];

export function providerUrl(provider: ChatProvider, prompt: string): string {
  const url = provider.buildUrl?.(prompt);
  return url && url.length <= MAX_PREFILL_URL ? url : provider.home;
}
