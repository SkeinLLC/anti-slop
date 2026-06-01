/**
 * Punctuation budget rules.
 *
 * Em dashes, exclamation marks, and ellipses each get a quota per word
 * count. Any character past the quota is flagged with its absolute offset.
 * The first N occurrences are allowed silently — we only flag the surplus.
 */

import type { Issue, Rule, RuleContext } from "../engine/types.js";
import { stripNonProse, originalOffset } from "../engine/tokenize.js";

export const emDashRule: Rule = {
  id: "punctuation.emDash",
  category: "punctuation",
  description: "Em dash usage exceeds the budget.",
  defaultSeverity: "warning",
  check(ctx: RuleContext): Issue[] {
    const { text, wordCount, config } = ctx;
    const cfg = config.rules["punctuation.emDash"];
    if (cfg && cfg.enabled === false) return [];

    const budget = Math.max(0, Math.floor((wordCount / 500) * config.maxEmDashesPer500Words));
    return findChars(text, /[—]/g, budget, {
      ruleId: "punctuation.emDash",
      category: "punctuation",
      message: `Em dash exceeds budget (${budget} per ${wordCount} words). Use a comma, colon, semicolon, or new sentence.`,
      severity: cfg?.severity ?? "warning",
      why: "Most cited AI tell. Even legitimate uses pattern-match to AI text."
    });
  }
};

export const exclamationRule: Rule = {
  id: "punctuation.exclamation",
  category: "punctuation",
  description: "Exclamation usage exceeds the budget.",
  defaultSeverity: "info",
  check(ctx: RuleContext): Issue[] {
    const { text, wordCount, config } = ctx;
    const cfg = config.rules["punctuation.exclamation"];
    if (cfg && cfg.enabled === false) return [];

    const budget = Math.max(0, Math.floor((wordCount / 1000) * config.maxExclamationsPer1000Words));
    return findChars(text, /!/g, budget, {
      ruleId: "punctuation.exclamation",
      category: "punctuation",
      message: `Exclamation mark exceeds budget (${budget} per ${wordCount} words). Enthusiasm comes from word choice.`,
      severity: cfg?.severity ?? "info",
      why: "Enthusiasm should come from word choice, not punctuation. AI overuses exclamations."
    });
  }
};

export const ellipsisRule: Rule = {
  id: "punctuation.ellipsis",
  category: "punctuation",
  description: "Ellipsis usage exceeds the per-piece limit.",
  defaultSeverity: "info",
  check(ctx: RuleContext): Issue[] {
    const { text, config } = ctx;
    const cfg = config.rules["punctuation.ellipsis"];
    if (cfg && cfg.enabled === false) return [];

    const limit = config.maxEllipsesPerPiece;
    // Match unicode ellipsis or three-dot ASCII.
    return findChars(text, /(…|\.\.\.)/g, limit, {
      ruleId: "punctuation.ellipsis",
      category: "punctuation",
      message: `Ellipsis exceeds per-piece limit (${limit}). Use only for genuine trailing-off.`,
      severity: cfg?.severity ?? "info",
      why: "Ellipses signal hesitation or trailing thoughts. Most AI uses them as transitions."
    });
  }
};

interface IssueTemplate {
  ruleId: string;
  category: string;
  message: string;
  severity: Issue["severity"];
  why?: string;
}

function findChars(
  text: string,
  pattern: RegExp,
  budget: number,
  template: IssueTemplate
): Issue[] {
  // Strip code fences, inline code, HTML tags, and HTML comments so we
  // don't count exclamations from <!-- antislop-disable-... --> markers.
  const { stripped, offsetMap } = stripNonProse(text);
  const issues: Issue[] = [];
  let m: RegExpExecArray | null;
  let count = 0;
  while ((m = pattern.exec(stripped)) !== null) {
    count++;
    if (count > budget) {
      const start = originalOffset(m.index, offsetMap);
      const end = originalOffset(m.index + m[0].length - 1, offsetMap) + 1;
      issues.push({
        ruleId: template.ruleId,
        start,
        end,
        message: template.message,
        severity: template.severity,
        category: template.category,
        why: template.why
      });
    }
  }
  return issues;
}
