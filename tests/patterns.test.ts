import { describe, it, expect } from "vitest";
import { resolveConfig } from "../src/engine/config.js";
import { patternRules } from "../src/rules/patterns.js";
import { countWords } from "../src/engine/tokenize.js";
import type { Rule, RuleContext } from "../src/engine/types.js";

function ctxFor(text: string): RuleContext {
  const config = resolveConfig({ preset: "default" });
  return { text, wordCount: countWords(text), config };
}

function ruleById(id: string): Rule {
  const r = patternRules.find((x) => x.id === id);
  if (!r) throw new Error(`No rule ${id}`);
  return r;
}

describe("negative parallelism", () => {
  const rule = ruleById("pattern.negativeParallelism");

  it("catches 'not just X, but Y'", () => {
    const ctx = ctxFor("This isn't just speed, but reliability.");
    const issues = rule.check(ctx);
    expect(issues.length).toBeGreaterThan(0);
  });

  it("catches 'this isn't X. This is Y.'", () => {
    const ctx = ctxFor("This isn't a CVE roundup. This is a hunt pack.");
    const issues = rule.check(ctx);
    expect(issues.length).toBeGreaterThan(0);
  });

  it("catches 'less X, more Y'", () => {
    const ctx = ctxFor("Less framework, more shipping.");
    const issues = rule.check(ctx);
    expect(issues.length).toBeGreaterThan(0);
  });

  it("does not false-positive on legitimate negation", () => {
    const ctx = ctxFor("The build is not broken today.");
    const issues = rule.check(ctx);
    expect(issues).toHaveLength(0);
  });
});

describe("cutoff disclaimer", () => {
  it("catches 'as of my last update'", () => {
    const rule = ruleById("pattern.cutoffDisclaimer");
    const ctx = ctxFor("As of my last update, the API was stable.");
    const issues = rule.check(ctx);
    expect(issues.length).toBeGreaterThan(0);
  });
});

describe("today opener", () => {
  it("catches 'in today's threat landscape'", () => {
    const rule = ruleById("pattern.todayOpener");
    const ctx = ctxFor("In today's threat landscape, you have to ship fast.");
    const issues = rule.check(ctx);
    expect(issues.length).toBeGreaterThan(0);
  });
});

describe("meta commentary", () => {
  it("catches 'in this article, we will'", () => {
    const rule = ruleById("pattern.metaCommentary");
    const ctx = ctxFor("In this article, we will walk through the playbook.");
    const issues = rule.check(ctx);
    expect(issues.length).toBeGreaterThan(0);
  });
});

describe("engagement bait", () => {
  it("catches 'let that sink in'", () => {
    const rule = ruleById("pattern.engagementBait");
    const ctx = ctxFor("Eighty percent of breaches start with phishing. Let that sink in.");
    const issues = rule.check(ctx);
    expect(issues.length).toBeGreaterThan(0);
  });
});

describe("copulative avoidance", () => {
  it("catches 'serves as a'", () => {
    const rule = ruleById("pattern.copulativeAvoidance");
    const ctx = ctxFor("The playbook serves as a baseline.");
    const issues = rule.check(ctx);
    expect(issues.length).toBeGreaterThan(0);
  });

  it("does not catch plain 'is'", () => {
    const rule = ruleById("pattern.copulativeAvoidance");
    const ctx = ctxFor("The playbook is a baseline.");
    const issues = rule.check(ctx);
    expect(issues).toHaveLength(0);
  });
});

describe("false range", () => {
  it("catches 'from X to Y'", () => {
    const rule = ruleById("pattern.falseRange");
    const ctx = ctxFor("From ancient traditions to modern innovations, the field has evolved.");
    const issues = rule.check(ctx);
    expect(issues.length).toBeGreaterThan(0);
  });
});
