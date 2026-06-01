import { describe, it, expect } from "vitest";
import { lint } from "../src/engine/engine.js";
import { resolveConfig } from "../src/engine/config.js";

describe("engine", () => {
  it("runs all built-in rules and returns issues sorted by position", () => {
    const cfg = resolveConfig({ preset: "default" });
    const text = "Delve into this. Let's leverage the data. In today's landscape, things are crucial.";
    const result = lint(text, cfg);
    expect(result.issues.length).toBeGreaterThan(0);
    // Sorted ascending.
    for (let i = 1; i < result.issues.length; i++) {
      expect(result.issues[i].start).toBeGreaterThanOrEqual(result.issues[i - 1].start);
    }
  });

  it("respects inline disable comments for one rule", () => {
    const cfg = resolveConfig({ preset: "default" });
    const text = "Delve here. <!-- antislop-disable-line vocab.banned -->";
    const result = lint(text, cfg);
    expect(result.issues.every((i) => i.ruleId !== "vocab.banned")).toBe(true);
  });

  it("respects wildcard disable comments", () => {
    const cfg = resolveConfig({ preset: "default" });
    const text = "Delve here. // antislop-disable-line";
    const result = lint(text, cfg);
    expect(result.issues).toHaveLength(0);
  });

  it("respects next-line disables", () => {
    const cfg = resolveConfig({ preset: "default" });
    const text = "<!-- antislop-disable-next-line vocab.banned -->\nDelve into the data.";
    const result = lint(text, cfg);
    expect(result.issues.every((i) => i.ruleId !== "vocab.banned")).toBe(true);
  });

  it("respects maxIssues cap", () => {
    const cfg = resolveConfig({ preset: "default" });
    const text = "Delve delve delve delve delve delve delve delve delve delve.";
    const result = lint(text, cfg, { maxIssues: 3 });
    expect(result.issues.length).toBe(3);
  });

  it("returns wordCount and rulesRun", () => {
    const cfg = resolveConfig({ preset: "default" });
    const result = lint("Short note here.", cfg);
    expect(result.wordCount).toBe(3);
    expect(result.rulesRun.length).toBeGreaterThan(5);
  });

  it("ignores content inside code fences", () => {
    const cfg = resolveConfig({ preset: "default" });
    const text = "```\nIn today's threat landscape, leverage XDR.\n```\n";
    const result = lint(text, cfg);
    // The parataxis / structure rules strip fences. The vocab rule does not,
    // so vocab matches can still appear inside fences. Make sure structural
    // rules don't fire inside fences.
    const fenceIssues = result.issues.filter((i) => i.category === "structure" || i.category === "pattern");
    expect(fenceIssues).toHaveLength(0);
  });
});
