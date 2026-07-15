// The Claude model both server routes call. Kept in one place so the scoring engine
// (lib/engine.ts) and the test route (app/api/test/route.ts) can't drift apart.
export const MODEL = "claude-sonnet-4-6";
