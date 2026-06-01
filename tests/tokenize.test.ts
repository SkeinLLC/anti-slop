import { describe, it, expect } from "vitest";
import { stripNonProse, splitSentences, countWords } from "../src/engine/tokenize.js";

describe("stripNonProse", () => {
  it("removes triple-backtick code fences", () => {
    const text = "Before.\n```\ncode here\n```\nAfter.";
    const { stripped } = stripNonProse(text);
    expect(stripped.includes("code here")).toBe(false);
    expect(stripped.includes("Before")).toBe(true);
    expect(stripped.includes("After")).toBe(true);
  });

  it("removes inline backticks", () => {
    const text = "Use `the runbook` carefully.";
    const { stripped } = stripNonProse(text);
    expect(stripped.includes("the runbook")).toBe(false);
  });

  it("removes HTML tags but keeps the inner text", () => {
    const text = "Visit <span>the docs</span> page.";
    const { stripped } = stripNonProse(text);
    expect(stripped.includes("the docs")).toBe(true);
    expect(stripped.includes("<span>")).toBe(false);
  });

  it("offsetMap maps stripped index back to original", () => {
    const text = "Hello `world` again.";
    const { stripped, offsetMap } = stripNonProse(text);
    const idx = stripped.indexOf("again");
    expect(text.slice(offsetMap[idx], offsetMap[idx] + 5)).toBe("again");
  });
});

describe("splitSentences", () => {
  it("counts words and tracks positions", () => {
    const text = "Short. A longer one with five words. End.";
    const { stripped, offsetMap } = stripNonProse(text);
    const sentences = splitSentences(stripped, offsetMap);
    expect(sentences).toHaveLength(3);
    expect(sentences[0].words).toBe(1);
    expect(sentences[1].words).toBe(6);
    expect(sentences[2].words).toBe(1);
  });
});

describe("countWords", () => {
  it("handles apostrophes and hyphens", () => {
    // "it's" + "a" + "state-of-the-art" + "system" = 4 words.
    expect(countWords("it's a state-of-the-art system")).toBe(4);
    expect(countWords("")).toBe(0);
    expect(countWords("one two three four five")).toBe(5);
  });
});
