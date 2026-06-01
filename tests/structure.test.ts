import { describe, it, expect } from "vitest";
import { resolveConfig } from "../src/engine/config.js";
import { parataxisRule, uniformLengthRule, ruleOfThreeRule } from "../src/rules/structure.js";
import { countWords } from "../src/engine/tokenize.js";
import type { RuleContext } from "../src/engine/types.js";

function ctxFor(text: string, overrides = {}): RuleContext {
  const config = resolveConfig({ preset: "default", ...overrides });
  return { text, wordCount: countWords(text), config };
}

describe("parataxis", () => {
  it("flags three short declarative sentences in a row", () => {
    const ctx = ctxFor("Short sentence. Then another. Then another.");
    const issues = parataxisRule.check(ctx);
    expect(issues.length).toBe(1);
    expect(issues[0].ruleId).toBe("structure.parataxis");
  });

  it("does not flag varied rhythm", () => {
    const ctx = ctxFor("Short sentence. Then a longer one with more content and a clause. Then short.");
    const issues = parataxisRule.check(ctx);
    expect(issues).toHaveLength(0);
  });
});

describe("uniform length", () => {
  it("flags three near-identical lengths", () => {
    const ctx = ctxFor(
      "The dog ran across the field today. The cat sat upon the porch swinging gently. The bird flew through the open window today."
    );
    const issues = uniformLengthRule.check(ctx);
    expect(issues.length).toBeGreaterThan(0);
  });

  it("does not flag varied lengths", () => {
    const ctx = ctxFor("Yes. The Sentinel rule cut alert volume by sixty percent overnight without any false positives. Done.");
    const issues = uniformLengthRule.check(ctx);
    expect(issues).toHaveLength(0);
  });
});

describe("rule of three", () => {
  it("flags 'X, Y, and Z' beyond the doc limit", () => {
    const ctx = ctxFor(
      "Speed, efficiency, and innovation matter. Process, people, and tooling are what win."
    );
    const issues = ruleOfThreeRule.check(ctx);
    // One above the limit means one flag.
    expect(issues.length).toBe(1);
  });

  it("respects the doc limit", () => {
    const ctx = ctxFor("Speed, efficiency, and innovation matter.");
    const issues = ruleOfThreeRule.check(ctx);
    expect(issues).toHaveLength(0);
  });
});
