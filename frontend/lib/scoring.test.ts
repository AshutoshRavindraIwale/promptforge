import { describe, expect, it } from "vitest";
import { overallScore } from "./scoring";
import type { Score, Scorecard } from "./schema";

/** A scorecard from `key: score` pairs; assessment/advice don't affect the grade. */
const card = (...dims: [key: string, score: Score][]): Scorecard =>
  dims.map(([key, score]) => ({
    key,
    name: key,
    score,
    assessment: "",
    advice: "",
  }));

describe("overallScore", () => {
  it("returns Poor for an empty scorecard rather than dividing by zero", () => {
    expect(overallScore([], [])).toBe("Poor");
  });

  it("averages the bands", () => {
    expect(overallScore(card(["a", "Good"], ["b", "Good"]))).toBe("Good");
    expect(overallScore(card(["a", "Poor"], ["b", "Poor"]))).toBe("Poor");
    expect(overallScore(card(["a", "Excellent"], ["b", "Excellent"]))).toBe("Excellent");
  });

  it("rounds half-up, so an exact .5 mean lands on the better band", () => {
    // (Poor=1 + Excellent=4) / 2 = 2.5 -> Good, not Needs Work.
    expect(overallScore(card(["a", "Poor"], ["b", "Excellent"]))).toBe("Good");
  });

  it("caps at Needs Work when a REQUIRED dimension is Poor", () => {
    // Mean is (1+4+4)/3 = 3 -> Good, but the required Poor pulls it down.
    const c = card(["req", "Poor"], ["b", "Excellent"], ["c", "Excellent"]);
    expect(overallScore(c, [])).toBe("Good");
    expect(overallScore(c, ["req"])).toBe("Needs Work");
  });

  it("does not cap when the Poor dimension is only conditional", () => {
    const c = card(["opt", "Poor"], ["b", "Excellent"], ["c", "Excellent"]);
    expect(overallScore(c, ["b", "c"])).toBe("Good");
  });

  it("never RAISES a score to the cap", () => {
    // Mean is already Poor; the cap is Needs Work but must not lift it.
    expect(overallScore(card(["req", "Poor"], ["b", "Poor"]), ["req"])).toBe("Poor");
  });

  it("ignores required keys that aren't in the scorecard", () => {
    const c = card(["a", "Excellent"], ["b", "Excellent"]);
    expect(overallScore(c, ["missing"])).toBe("Excellent");
  });
});
