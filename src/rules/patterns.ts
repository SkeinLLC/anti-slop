/**
 * Sentence-pattern rules.
 */

import type { Issue, Rule, RuleContext } from "../engine/types.js";
import { stripNonProse, originalOffset } from "../engine/tokenize.js";

interface PatternDef {
  ruleId: string;
  category: string;
  defaultSeverity: Issue["severity"];
  description: string;
  why: string;
  pattern: RegExp;
}

const PATTERNS: PatternDef[] = [
  {
    ruleId: "pattern.negativeParallelism",
    category: "pattern",
    defaultSeverity: "warning",
    description: "Negative parallelism: 'not X, but Y' / 'this isn't X. This is Y.'",
    why: "Single most reliable AI tell. Delete the negated framing; just state the positive claim.",
    pattern: new RegExp(
      [
        // it's not just X. it's Y. / it is not just X, it's Y.
        "(?:it'?s|it is) not (?:just|about) [^.!?\\n]{2,80}?[.,]\\s*(?:it'?s|it is|this is) (?:about|just)?",
        // X isn't just Y, but Z
        "isn'?t just [^.!?\\n]{2,60}?[,;]\\s*but\\b",
        // not just X, but Y / not just X but Y
        "\\bnot just [^.!?\\n]{2,60}?[,;]?\\s+but\\b",
        // not only X, but also Y
        "\\bnot only [^.!?\\n]{2,60}?[,;]?\\s+but\\b",
        // this isn't X. this is Y
        "this isn'?t [^.!?\\n]{2,60}?[.,]\\s*this is\\b",
        "this is not [^.!?\\n]{2,60}?[.,]\\s*this is\\b",
        // forget X. this is Y / forget X. here's Y
        "forget [^.!?\\n]{2,40}?[.,;]\\s*(?:this is|here'?s)\\b",
        // less X, more Y
        "\\bless [^.!?\\n]{2,40}?,\\s*more\\b",
        // stop thinking X. start thinking Y
        "stop thinking [^.!?\\n]{2,40}?[.,;]\\s*start thinking\\b",
        // the question isn't X. the question is Y
        "the question isn'?t [^.!?\\n]{2,60}?[.,]\\s*the question is\\b",
        // you don't need X. you need Y
        "you don'?t need [^.!?\\n]{2,60}?[.,]\\s*you need\\b"
      ].join("|"),
      "gi"
    )
  },
  {
    ruleId: "pattern.cutoffDisclaimer",
    category: "pattern",
    defaultSeverity: "warning",
    description: "Knowledge-cutoff disclaimer.",
    why: "Dead giveaway. Cut it.",
    pattern: /\b(?:as of my (?:last )?(?:update|knowledge cutoff)|based on (?:my training|available information|the information available to me)|while specific details are limited|i don'?t have access to (?:real-?time|current))[^.!?]*[.!?]/gi
  },
  {
    ruleId: "pattern.todayOpener",
    category: "pattern",
    defaultSeverity: "warning",
    description: "'In today's ...' or 'In the world of ...' opener.",
    why: "Marketing-essay opener. Skip the framing and lead with the claim.",
    pattern: /\b(?:in today'?s |in the world of |in the modern |in the current |in the era of )[A-Za-z\- ]+[,.]/gi
  },
  {
    ruleId: "pattern.metaCommentary",
    category: "pattern",
    defaultSeverity: "warning",
    description: "Meta commentary about what the text is about to do.",
    why: "Say the thing. Don't announce that you are about to say the thing.",
    pattern: /\b(?:in this (?:article|section|post|piece|chapter)|let me walk you through|let me explain|let me break (?:this|it) down|here'?s (?:what|a (?:comprehensive|quick) overview))[^.!?]{0,80}[.!?:]/gi
  },
  {
    ruleId: "pattern.engagementBait",
    category: "pattern",
    defaultSeverity: "warning",
    description: "Engagement bait phrase.",
    why: "Reader-poking copy. Cut it.",
    pattern: /\b(?:let that sink in|read that again|this changes everything|are you paying attention|you'?re not ready for this|here'?s what nobody (?:is talking about|tells you)|most people don'?t realize|nobody talks about)\b[^.!?\n]{0,80}[.!?\n]?/gi
  },
  {
    ruleId: "pattern.copulativeAvoidance",
    category: "pattern",
    defaultSeverity: "info",
    description: "Copulative avoidance ('serves as a', 'stands as a', 'represents a').",
    why: "AI replaces 'is' and 'has' with bloated alternatives. Just say 'is.'",
    pattern: /\b(?:serves as|stands as|marks (?:a|an)|represents (?:a|an)|boasts (?:a|an)|features (?:a|an)|offers (?:a|an)|holds the distinction of being)\b/gi
  },
  {
    ruleId: "pattern.falseRange",
    category: "pattern",
    defaultSeverity: "info",
    description: "False range ('from X to Y').",
    why: "If there's no meaningful middle ground, the range is fake. Pick the specific thing.",
    pattern: /\bfrom [A-Za-z\- ]{3,30} to [A-Za-z\- ]{3,30}\b/gi
  }
];

export const patternRules: Rule[] = PATTERNS.map((p) => ({
  id: p.ruleId,
  category: p.category,
  description: p.description,
  defaultSeverity: p.defaultSeverity,
  check(ctx: RuleContext): Issue[] {
    const cfg = ctx.config.rules[p.ruleId];
    if (cfg && cfg.enabled === false) return [];

    // Run on stripped text so code fences and tags don't trigger.
    const { stripped, offsetMap } = stripNonProse(ctx.text);
    const issues: Issue[] = [];
    let m: RegExpExecArray | null;
    const re = new RegExp(p.pattern.source, p.pattern.flags);
    while ((m = re.exec(stripped)) !== null) {
      const matchText = m[0];
      if (matchText.length === 0) {
        re.lastIndex++;
        continue;
      }
      const start = originalOffset(m.index, offsetMap);
      const end = originalOffset(m.index + matchText.length - 1, offsetMap) + 1;
      issues.push({
        ruleId: p.ruleId,
        start,
        end,
        message: `${p.description} Matched: "${matchText.slice(0, 60)}${matchText.length > 60 ? "…" : ""}"`,
        severity: cfg?.severity ?? p.defaultSeverity,
        category: p.category,
        why: p.why
      });
    }
    return issues;
  }
}));
