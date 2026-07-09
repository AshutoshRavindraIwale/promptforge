// Deterministic overall-score computation - a direct port of promptforge/scoring.py.
// Four dimension bands -> 1..4 -> mean -> round half-up -> band, with a required-dimension
// cap: a `Poor` on Clarity or Guidelines caps the overall at `Needs Work`.
import type { Score, Scorecard } from "./schema";

const BAND_TO_INT: Record<Score, number> = {
  Poor: 1,
  "Needs Work": 2,
  Good: 3,
  Excellent: 4,
};
const INT_TO_BAND: Record<number, Score> = {
  1: "Poor",
  2: "Needs Work",
  3: "Good",
  4: "Excellent",
};

const REQUIRED_DIMENSIONS: (keyof Scorecard)[] = ["clarity", "guidelines"];
const REQUIRED_POOR_CAP: Score = "Needs Work";

export function overallScore(scorecard: Scorecard): Score {
  const dims = [
    scorecard.clarity,
    scorecard.guidelines,
    scorecard.structure,
    scorecard.examples,
  ];
  const values = dims.map((d) => BAND_TO_INT[d.score]);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const bandInt = Math.min(4, Math.max(1, Math.floor(mean + 0.5))); // round half-up + clamp
  let band = INT_TO_BAND[bandInt];

  const requiredPoor = REQUIRED_DIMENSIONS.some(
    (name) => BAND_TO_INT[scorecard[name].score] === 1,
  );
  if (requiredPoor && BAND_TO_INT[band] > BAND_TO_INT[REQUIRED_POOR_CAP]) {
    band = REQUIRED_POOR_CAP;
  }
  return band;
}
