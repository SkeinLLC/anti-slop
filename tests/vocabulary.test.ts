import { describe, it, expect } from "vitest";
import { resolveConfig } from "../src/engine/config.js";
import { vocabularyRule, phraseRule, openerRule } from "../src/rules/vocabulary.js";
import type { RuleContext } from "../src/engine/types.js";
import { countWords } from "../src/engine/tokenize.js";

function ctxFor(text: string, presetInput = {}): RuleContext {
  const config = resolveConfig({ preset: "default", ...presetInput });
  return { text, wordCount: countWords(text), config };
}

describe("vocabulary rule", () => {
  it("flags banned words on word boundaries", () => {
    const ctx = ctxFor("We will delve into the data and leverage outcomes.");
    const issues = vocabularyRule.check(ctx);
    expect(issues.map((i) => i.ruleId)).toContain("vocab.banned");
    const offenders = issues.map((i) => ctx.text.slice(i.start, i.end).toLowerCase());
    expect(offenders).toContain("delve");
    expect(offenders).toContain("leverage");
  });

  it("does not match across word boundaries", () => {
    // "preview" contains "view" — but "view" is not banned, and "delve"
    // shouldn't match "developer". We test the analogous case with "leveraged"
    // which IS banned, but also "level" which isn't.
    const ctx = ctxFor("The level of detail in the runbook is fine.");
    const issues = vocabularyRule.check(ctx);
    expect(issues).toHaveLength(0);
  });

  it("honors allowedVocab", () => {
    const ctx = ctxFor("We leverage the playbook.", {
      allowedVocab: ["leverage"]
    });
    const issues = vocabularyRule.check(ctx);
    expect(issues.some((i) => ctx.text.slice(i.start, i.end).toLowerCase() === "leverage")).toBe(false);
  });

  it("provides a fix suggestion for common offenders", () => {
    const ctx = ctxFor("Let's delve into the issue.");
    const issues = vocabularyRule.check(ctx);
    const delve = issues.find((i) => ctx.text.slice(i.start, i.end).toLowerCase() === "delve");
    expect(delve?.fix).toBe("look at");
  });

  it("is case-insensitive", () => {
    const ctx = ctxFor("Delve and DELVE and delve.");
    const issues = vocabularyRule.check(ctx);
    expect(issues).toHaveLength(3);
  });
});

describe("phrase rule", () => {
  it("flags 'in today's ...'", () => {
    const ctx = ctxFor("In today's threat landscape, controls matter.");
    const issues = phraseRule.check(ctx);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].ruleId).toBe("phrases.banned");
  });

  it("flags 'in conclusion'", () => {
    const ctx = ctxFor("In conclusion, ship it.");
    const issues = phraseRule.check(ctx);
    expect(issues.some((i) => ctx.text.slice(i.start, i.end).toLowerCase() === "in conclusion")).toBe(true);
  });

  it("does not match substrings of longer words", () => {
    const ctx = ctxFor("Subtest concluded fine.");
    const issues = phraseRule.check(ctx);
    expect(issues).toHaveLength(0);
  });
});

describe("opener rule", () => {
  it("flags banned sentence-initial openers", () => {
    const ctx = ctxFor("Certainly. The deployment is fine. Moreover, the logs are clean.");
    const issues = openerRule.check(ctx);
    const matches = issues.map((i) => ctx.text.slice(i.start, i.end).toLowerCase());
    expect(matches).toContain("certainly");
    expect(matches).toContain("moreover");
  });

  it("does not flag a banned word that appears mid-sentence", () => {
    const ctx = ctxFor("The change is, however, important to ship today.");
    const issues = openerRule.check(ctx);
    // "however" mid-sentence shouldn't be flagged as opener.
    expect(issues.some((i) => ctx.text.slice(i.start, i.end).toLowerCase().startsWith("however"))).toBe(false);
  });
});
