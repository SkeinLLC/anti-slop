import { describe, it, expect } from "vitest";
import { resolveConfig } from "../src/engine/config.js";
import { emDashRule, exclamationRule, ellipsisRule } from "../src/rules/punctuation.js";
import { countWords } from "../src/engine/tokenize.js";
import type { RuleContext } from "../src/engine/types.js";

function ctxFor(text: string, overrides = {}): RuleContext {
  const config = resolveConfig({ preset: "default", ...overrides });
  return { text, wordCount: countWords(text), config };
}

describe("em-dash budget", () => {
  it("allows the first em dash, flags the rest, in a short doc", () => {
    // 100 words: budget = 100/500 * 1 = 0 (floor). So even the first is flagged.
    const text = `Threats matter. ${"word ".repeat(20)}——`;
    const ctx = ctxFor(text);
    const issues = emDashRule.check(ctx);
    expect(issues.length).toBe(2);
  });

  it("permits up to budget when the doc is long enough", () => {
    // 500 words: budget = 1.
    const filler = "word ".repeat(500);
    const text = `${filler}— and — again.`;
    const ctx = ctxFor(text);
    const issues = emDashRule.check(ctx);
    expect(issues.length).toBe(1); // First em dash allowed, second flagged.
  });

  it("can be disabled via per-rule config", () => {
    const text = "Slop — slop — slop.";
    const ctx = ctxFor(text, {
      rules: { "punctuation.emDash": { enabled: false } }
    });
    const issues = emDashRule.check(ctx);
    expect(issues).toHaveLength(0);
  });
});

describe("exclamation budget", () => {
  it("flags exclamation overflow", () => {
    const text = "Ship it! Ship it! Ship it!";
    const ctx = ctxFor(text);
    const issues = exclamationRule.check(ctx);
    expect(issues.length).toBeGreaterThan(0);
  });
});

describe("ellipsis cap", () => {
  it("flags more than the per-piece limit", () => {
    const text = "Maybe ... or maybe ... or maybe …";
    const ctx = ctxFor(text);
    const issues = ellipsisRule.check(ctx);
    expect(issues.length).toBe(2);
  });

  it("treats unicode and ASCII ellipsis identically", () => {
    const ctx = ctxFor("…");
    expect(ellipsisRule.check(ctx)).toHaveLength(0);
    const ctx2 = ctxFor("... and ...");
    expect(ellipsisRule.check(ctx2)).toHaveLength(1);
  });
});
