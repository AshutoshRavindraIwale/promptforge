// The Claude model both server routes call. Kept in one place so the scoring engine
// (lib/engine.ts) and the test route (app/api/test/route.ts) can't drift apart.
export const MODEL = "claude-sonnet-4-6";

// The model behind /api/suggest-framework. Classification over 7 labels doesn't need the
// scoring model — Haiku answers in under a second at a fraction of a cent per call.
export const SUGGEST_MODEL = "claude-haiku-4-5";
