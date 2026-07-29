// Chat apps the revised prompt can be handed off to. The handoff is deliberately
// clipboard-only: we copy the prompt and open the app at a blank chat, and the
// user pastes and sends it themselves. We used to prefill via `?q=`, but every
// provider that accepts that param also auto-submits it — the prompt got spent on
// a run nobody asked for, before it could be read or edited. Opening blank is the
// fix, so do NOT reintroduce query-param prefill here.
//
// `app` is a desktop deep link (registered URL scheme) and takes priority when
// present; `home` is the web equivalent, and stays reachable as its own control
// so a machine without the desktop app is never stuck. Adding a provider is
// data-only here, plus a brand mark in OpenInProviders.tsx.

export interface ChatProvider {
  id: "claude" | "chatgpt" | "perplexity" | "gemini";
  name: string;
  /** Blank chat in the browser. Opened in a new tab. */
  home: string;
  /**
   * Desktop-app deep link. Navigating to it hands off to the OS rather than the
   * network, so a machine without the app registered silently does nothing —
   * which is why any provider setting this also gets a separate web button.
   */
  app?: string;
}

export const CHAT_PROVIDERS: ChatProvider[] = [
  {
    id: "claude",
    name: "Claude",
    home: "https://claude.ai/new",
    // Scheme registered by Claude.app (CFBundleURLSchemes in its Info.plist).
    app: "claude://",
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    home: "https://chatgpt.com/",
  },
  {
    id: "perplexity",
    name: "Perplexity",
    home: "https://www.perplexity.ai/",
  },
  {
    id: "gemini",
    name: "Gemini",
    home: "https://gemini.google.com/app",
  },
];
