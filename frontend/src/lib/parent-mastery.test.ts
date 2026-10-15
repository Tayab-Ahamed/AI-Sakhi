import { expect, it } from "vitest";
import { buildSubjectMastery } from "./parent-mastery";

it("does not fabricate results when assessment data is absent", () => {
  expect(buildSubjectMastery([])).toEqual([]);
});
it("includes only real attempted topics with valid percentages", () => {
  expect(buildSubjectMastery([
    { topic: "Fractions", attempts: 2, avg_pct: 60 },
    { topic: "Never attempted", attempts: 0, avg_pct: 78 },
    { topic: "Invalid", attempts: 1, avg_pct: Number.NaN },
  ])).toEqual([{ name: "Fractions", value: 60 }]);
});
