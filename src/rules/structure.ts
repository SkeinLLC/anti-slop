/**
 * Structural rhythm rules. These look at sentence-level features, not
 * vocabulary. Parataxis, uniform sentence length, and rule-of-three lists
 * are the gross-rhythm tells most readers spot before they spot diction.
 */

import type { Issue, Rule, RuleContext } from "../engine/types.js";
import { stripNonProse, splitSentences, originalOffset } from "../engine/tokenize.js";

export const parataxisRule: Rule = {
  id: "structure.parataxis",
  category: "structure",
  description: "Run of short declarative sentences. Connect them.",
  defaultSeverity: "info",
  check(ctx: RuleContext): Issue[] {
    const cfg = ctx.config.rules["structure.parataxis"];
    if (cfg && cfg.enabled === false) return [];

    const { stripped, offsetMap } = stripNonProse(ctx.text);
    const sentences = splitSentences(stripped, offsetMap);
    const issues: Issue[] = [];

    const threshold = ctx.config.shortSentenceWordThreshold;
    const runLimit = ctx.config.maxConsecutiveShortSentences;
    let runStart = -1;
    let runCount = 0;

    for (let i = 0; i < sentences.length; i++) {
      const s = sentences[i];
      if (s.words > 0 && s.words <= threshold) {
        if (runStart === -1) runStart = i;
        runCount++;
        if (runCount === runLimit) {
          const first = sentences[runStart];
          const last = sentences[i];
          issues.push({
            ruleId: "structure.parataxis",
            start: first.originalStart,
            end: last.originalEnd,
            message: `Run of ${runCount} short sentences (each ≤ ${threshold} words). Connect them with clauses, semicolons, or commas.`,
            severity: cfg?.severity ?? "info",
            category: "structure",
            why: "Parataxis. Reads like a poem and immediately signals AI authorship."
          });
        }
      } else {
        runStart = -1;
        runCount = 0;
      }
    }
    return issues;
  }
};

export const uniformLengthRule: Rule = {
  id: "structure.uniformLength",
  category: "structure",
  description: "Three consecutive sentences of identical word count.",
  defaultSeverity: "info",
  check(ctx: RuleContext): Issue[] {
    const cfg = ctx.config.rules["structure.uniformLength"];
    if (cfg && cfg.enabled === false) return [];

    const { stripped, offsetMap } = stripNonProse(ctx.text);
    const sentences = splitSentences(stripped, offsetMap);
    const issues: Issue[] = [];

    for (let i = 2; i < sentences.length; i++) {
      const a = sentences[i - 2];
      const b = sentences[i - 1];
      const c = sentences[i];
      // Same-length match means within 1 word, with each above the trivial floor.
      if (
        a.words >= 5 &&
        Math.abs(a.words - b.words) <= 1 &&
        Math.abs(b.words - c.words) <= 1
      ) {
        issues.push({
          ruleId: "structure.uniformLength",
          start: a.originalStart,
          end: c.originalEnd,
          message: `Three consecutive sentences of near-identical length (${a.words}, ${b.words}, ${c.words} words). Vary the rhythm.`,
          severity: cfg?.severity ?? "info",
          category: "structure",
          why: "Metronome rhythm. The single most measurable AI detection signal."
        });
      }
    }
    return issues;
  }
};

export const ruleOfThreeRule: Rule = {
  id: "structure.ruleOfThree",
  category: "structure",
  description: "Three-item list with conjunction. Vary the count.",
  defaultSeverity: "info",
  check(ctx: RuleContext): Issue[] {
    const cfg = ctx.config.rules["structure.ruleOfThree"];
    if (cfg && cfg.enabled === false) return [];

    const { stripped, offsetMap } = stripNonProse(ctx.text);
    const issues: Issue[] = [];
    // Match "X, Y, and Z" where each item is a short noun-phrase-ish unit.
    // We allow up to ~24 chars per item to skip very-long Oxford-comma lists.
    const re = /\b([A-Za-z][\w\- ]{1,24}?), +([A-Za-z][\w\- ]{1,24}?),? +(?:and|or) +([A-Za-z][\w\- ]{1,24}?)(?=[.,;:!?\n]|$)/gi;
    let m: RegExpExecArray | null;
    let countInDoc = 0;
    const limit = ctx.config.ruleOfThreeLimit;
    while ((m = re.exec(stripped)) !== null) {
      countInDoc++;
      if (countInDoc <= limit) continue;
      issues.push({
        ruleId: "structure.ruleOfThree",
        start: originalOffset(m.index, offsetMap),
        end: originalOffset(m.index + m[0].length, offsetMap),
        message: `Rule-of-three list: "${m[0]}". Try two items or four.`,
        severity: cfg?.severity ?? "info",
        category: "structure",
        why: "AI defaults to threes to sound comprehensive. Vary the count."
      });
    }
    return issues;
  }
};
