/**
 * Banned-vocabulary rule. Walks the document and flags any token that
 * matches a configured banned word, with a word-boundary check so
 * "preview" doesn't false-positive on "view."
 */

import type { Issue, Rule, RuleContext } from "../engine/types.js";

const VOCAB_REPLACEMENTS: Record<string, string> = {
  delve: "look at",
  delves: "looks at",
  delving: "looking at",
  leverage: "use",
  leverages: "uses",
  leveraged: "used",
  leveraging: "using",
  utilize: "use",
  utilizes: "uses",
  utilized: "used",
  utilizing: "using",
  facilitate: "help",
  facilitates: "helps",
  commence: "start",
  commences: "starts",
  commenced: "started",
  endeavor: "try",
  endeavors: "tries",
  showcase: "show",
  showcases: "shows",
  showcasing: "showing",
  underscore: "show",
  underscores: "shows",
  underscored: "showed",
  underscoring: "showing",
  highlighting: "showing",
  emphasizing: "stressing",
  enhancing: "improving",
  fostering: "building",
  foster: "build",
  garner: "get",
  garners: "gets",
  garnered: "got",
  bolster: "strengthen",
  bolsters: "strengthens",
  bolstered: "strengthened",
  crucial: "important",
  pivotal: "important",
  meticulous: "careful",
  meticulously: "carefully",
  intricate: "complex",
  paramount: "top",
  groundbreaking: "new",
  "cutting-edge": "new",
  "game-changing": "new",
  transformative: "big",
  seamless: "smooth",
  seamlessly: "smoothly",
  unprecedented: "rare",
  remarkable: "notable",
  stunning: "striking",
  profound: "deep",
  vibrant: "lively",
  tapestry: "mix",
  realm: "area",
  paradigm: "model",
  interplay: "interaction",
  testament: "sign",
  aforementioned: "earlier"
};

export const vocabularyRule: Rule = {
  id: "vocab.banned",
  category: "vocabulary",
  description: "Word is on the banned-vocab list. Replace with a concrete alternative.",
  defaultSeverity: "warning",
  check(ctx: RuleContext): Issue[] {
    const { text, config } = ctx;
    if (config.bannedVocab.size === 0) return [];

    const issues: Issue[] = [];
    const tokenRe = /[A-Za-z][A-Za-z'’-]*/g;
    let m: RegExpExecArray | null;
    while ((m = tokenRe.exec(text)) !== null) {
      const word = m[0].toLowerCase();
      if (!config.bannedVocab.has(word)) continue;
      if (config.allowedVocab.has(word)) continue;

      const fix = VOCAB_REPLACEMENTS[word];
      issues.push({
        ruleId: "vocab.banned",
        start: m.index,
        end: m.index + m[0].length,
        message: `Banned word: "${m[0]}".`,
        severity: config.rules["vocab.banned"]?.severity ?? "warning",
        category: "vocabulary",
        fix,
        why: "Statistically overrepresented in LLM output. Reads as AI to a skeptical reader."
      });
    }
    return issues;
  }
};

export const phraseRule: Rule = {
  id: "phrases.banned",
  category: "vocabulary",
  description: "Multi-word phrase on the banned list. Restructure the sentence.",
  defaultSeverity: "warning",
  check(ctx: RuleContext): Issue[] {
    const { text, config } = ctx;
    if (config.bannedPhrases.length === 0) return [];

    const issues: Issue[] = [];
    const lower = text.toLowerCase();
    for (const phrase of config.bannedPhrases) {
      const needle = phrase.toLowerCase();
      let from = 0;
      while (true) {
        const idx = lower.indexOf(needle, from);
        if (idx === -1) break;
        const before = idx > 0 ? lower[idx - 1] : " ";
        const after = idx + needle.length < lower.length ? lower[idx + needle.length] : " ";
        if (isWordChar(before) || isWordChar(after)) {
          from = idx + needle.length;
          continue;
        }
        issues.push({
          ruleId: "phrases.banned",
          start: idx,
          end: idx + needle.length,
          message: `Banned phrase: "${text.slice(idx, idx + needle.length)}".`,
          severity: config.rules["phrases.banned"]?.severity ?? "warning",
          category: "vocabulary",
          why: "Phrase is a known AI cliché. Cut it; the sentence is usually stronger without."
        });
        from = idx + needle.length;
      }
    }
    return issues;
  }
};

export const openerRule: Rule = {
  id: "openers.banned",
  category: "vocabulary",
  description: "Sentence opens with a banned word or phrase.",
  defaultSeverity: "warning",
  check(ctx: RuleContext): Issue[] {
    const { text, config } = ctx;
    if (config.bannedOpeners.length === 0) return [];

    const issues: Issue[] = [];
    const checks: number[] = [];
    if (text.length > 0) checks.push(0);
    const boundaryRe = /([.!?]\s+|\n\s*\n\s*|\n[\-*]\s+|\n#{1,6}\s+)/g;
    let m: RegExpExecArray | null;
    while ((m = boundaryRe.exec(text)) !== null) {
      if (m[0].length === 0) {
        boundaryRe.lastIndex++;
        continue;
      }
      checks.push(m.index + m[0].length);
    }

    const sorted = [...config.bannedOpeners].sort((a, b) => b.length - a.length);
    for (const idx of checks) {
      for (const opener of sorted) {
        const slice = text.slice(idx, idx + opener.length + 1);
        const lowerSlice = slice.toLowerCase();
        if (lowerSlice.startsWith(opener.toLowerCase())) {
          const next = text[idx + opener.length];
          if (next === undefined || !isWordChar(next)) {
            issues.push({
              ruleId: "openers.banned",
              start: idx,
              end: idx + opener.length,
              message: `Banned opener: "${text.slice(idx, idx + opener.length)}".`,
              severity: config.rules["openers.banned"]?.severity ?? "warning",
              category: "vocabulary",
              why: "Sentence-initial filler. Drop it and start with the actual claim."
            });
            break;
          }
        }
      }
    }
    return issues;
  }
};

function isWordChar(ch: string): boolean {
  return /[A-Za-z0-9'’\-]/.test(ch);
}
