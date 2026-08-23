import { describe, expect, it } from "vitest";
import {
  DEFAULT_FRAMEWORK_ID,
  FRAMEWORKS,
  buildEvaluationSchema,
  buildSystemPrompt,
  getFramework,
  inferFramework,
  isMediaFramework,
  requiredKeys,
  supportsProviderHandoff,
  supportsTest,
  testRunsAsSystem,
  type Framework,
} from "./frameworks";

const keysOf = (f: Framework) => f.dimensions.map((d) => d.key);
const each = (fn: (f: Framework) => void) =>
  it.each(FRAMEWORKS.map((f) => [f.id, f] as const))("%s", (_id, f) => fn(f));

describe("framework registry", () => {
  it("has unique ids", () => {
    const ids = FRAMEWORKS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("resolves the default framework", () => {
    expect(getFramework(DEFAULT_FRAMEWORK_ID).id).toBe(DEFAULT_FRAMEWORK_ID);
  });

  it("falls back to the default for unknown, null, and undefined ids", () => {
    for (const id of ["nope", null, undefined]) {
      expect(getFramework(id).id).toBe(DEFAULT_FRAMEWORK_ID);
    }
  });
});

describe("every framework", () => {
  each((f) => {
    expect(f.name.length, "needs a display name").toBeGreaterThan(0);
    expect(f.tagline.length, "needs a tagline for the selector").toBeGreaterThan(0);
    expect(f.dimensions.length, "needs at least one dimension").toBeGreaterThan(0);
  });

  each((f) => {
    const keys = keysOf(f);
    expect(new Set(keys).size, `duplicate dimension key in ${f.id}`).toBe(keys.length);
  });

  // A Poor on a required dimension is what caps the overall grade; a framework with none
  // can never be capped, which is almost certainly a mistake rather than a design choice.
  each((f) => {
    expect(requiredKeys(f).length, `${f.id} has no required dimension`).toBeGreaterThan(0);
  });

  each((f) => {
    expect(requiredKeys(f)).toEqual(
      f.dimensions.filter((d) => d.required).map((d) => d.key),
    );
  });
});

// inferFramework recovers which rubric produced a stored scorecard by matching the dimension
// key SET — library entries don't persist a framework id. Two frameworks sharing a key set
// would silently mis-attribute every saved entry between them.
describe("dimension key sets stay collision-free", () => {
  it("no two frameworks share a key set", () => {
    const seen = new Map<string, string>();
    for (const f of FRAMEWORKS) {
      const sig = [...keysOf(f)].sort().join("|");
      const clash = seen.get(sig);
      expect(clash, `${f.id} has the same dimension keys as ${clash}`).toBeUndefined();
      seen.set(sig, f.id);
    }
  });

  each((f) => {
    // Both storage shapes: the ordered array, and the legacy keyed object.
    expect(inferFramework(f.dimensions.map((d) => ({ key: d.key })))?.id).toBe(f.id);
    expect(inferFramework(Object.fromEntries(keysOf(f).map((k) => [k, {}])))?.id).toBe(f.id);
  });

  it("returns undefined rather than guessing on unrecognised input", () => {
    for (const junk of [null, undefined, 42, "nope", [], {}, [{ key: "mystery" }]]) {
      expect(inferFramework(junk)).toBeUndefined();
    }
  });
});

// The schema's key order is the order dimensions stream into the scorecard, so it has to
// track the rubric rather than whatever object-literal order happens to survive a refactor.
describe("evaluation schema", () => {
  each((f) => {
    const scorecard = buildEvaluationSchema(f).shape.scorecard;
    expect(Object.keys(scorecard.shape)).toEqual(keysOf(f));
  });
});

describe("system prompt", () => {
  each((f) => {
    const prompt = buildSystemPrompt(f);
    for (const d of f.dimensions) {
      expect(prompt, `missing dimension "${d.name}"`).toContain(d.name);
      expect(prompt, `missing question for "${d.name}"`).toContain(d.question);
      expect(prompt, `missing guidance for "${d.name}"`).toContain(d.guidance.trim().slice(0, 40));
    }
    expect(prompt).toContain(f.intro);
    for (const c of f.categories ?? []) expect(prompt).toContain(c);
  });
});

// Capability predicates drive which affordances render, so pin the behaviour per kind.
describe("capability predicates", () => {
  each((f) => {
    // Test runs the prompt through a TEXT model, so generated-media prompts can't use it.
    expect(supportsTest(f)).toBe(f.kind !== "video" && f.kind !== "image" && f.runsAs !== "none");
    expect(testRunsAsSystem(f)).toBe(f.runsAs === "system");
    expect(supportsProviderHandoff(f)).toBe(f.runsAs !== "none");
    expect(isMediaFramework(f)).toBe(f.kind === "video" || f.kind === "image");
  });

  it("keeps the known media and tool-doc frameworks non-testable", () => {
    expect(supportsTest(getFramework("video_shot"))).toBe(false);
    expect(supportsTest(getFramework("image_gen"))).toBe(false);
    expect(supportsTest(getFramework("tool_desc"))).toBe(false);
    expect(supportsProviderHandoff(getFramework("tool_desc"))).toBe(false);
    expect(testRunsAsSystem(getFramework("agent_system"))).toBe(true);
    expect(supportsTest(getFramework("anthropic"))).toBe(true);
  });
});
