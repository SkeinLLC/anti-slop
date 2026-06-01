/**
 * Engine entry point. Runs the registered rules against a document and
 * returns a sorted Issue list.
 */

import type { Issue, ResolvedConfig, Rule } from "./types.js";
import { countWords } from "./tokenize.js";
import { builtinRules } from "../rules/index.js";

export interface LintOptions {
  /** Override the rules used. Defaults to all built-in rules. */
  rules?: Rule[];
  /** Stop after this many issues. */
  maxIssues?: number;
}

export interface LintResult {
  issues: Issue[];
  wordCount: number;
  /** Rules that ran. */
  rulesRun: string[];
}

export function lint(text: string, config: ResolvedConfig, opts: LintOptions = {}): LintResult {
  const rules = opts.rules ?? builtinRules;
  const wordCount = countWords(text);
  const ctx = { wordCount, text, config };

  const allIssues: Issue[] = [];
  const rulesRun: string[] = [];

  for (const rule of rules) {
    const ruleCfg = config.rules[rule.id];
    if (ruleCfg && ruleCfg.enabled === false) continue;
    rulesRun.push(rule.id);
    try {
      const issues = rule.check(ctx);
      for (const i of issues) {
        allIssues.push(i);
      }
    } catch (err) {
      // A bad rule shouldn't crash the whole lint pass.
      allIssues.push({
        ruleId: rule.id,
        start: 0,
        end: 0,
        message: `Rule "${rule.id}" threw: ${(err as Error).message}`,
        severity: "error",
        category: "engine"
      });
    }
  }

  // Dedup overlapping issues from the same rule.
  const seen = new Set<string>();
  const deduped: Issue[] = [];
  for (const issue of allIssues) {
    const key = `${issue.ruleId}:${issue.start}:${issue.end}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(issue);
  }

  // Honor inline disable comments.
  const disables = collectDisables(text);
  const filtered = deduped.filter((issue) => !isDisabled(issue, text, disables));

  // Sort by position, then severity.
  filtered.sort((a, b) => a.start - b.start || a.end - b.end);

  const limited = opts.maxIssues ? filtered.slice(0, opts.maxIssues) : filtered;
  return { issues: limited, wordCount, rulesRun };
}

interface DisableRange {
  /** Line index (0-based) the disable applies to. */
  line: number;
  /** Rule ids to silence, or "*" for all. */
  rules: Set<string>;
  /** "line" silences one line; "next-line" the following. */
  kind: "line" | "next-line";
}

const DISABLE_RE = /<!--\s*antislop-disable-(line|next-line)(?:\s+([\w\-., *]+))?\s*-->|(?:\/\/|#)\s*antislop-disable-(line|next-line)(?:\s+([\w\-., *]+))?/gi;

function collectDisables(text: string): DisableRange[] {
  const ranges: DisableRange[] = [];
  // Line index by walking newlines.
  const lineStarts: number[] = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") lineStarts.push(i + 1);
  }
  let m: RegExpExecArray | null;
  DISABLE_RE.lastIndex = 0;
  while ((m = DISABLE_RE.exec(text)) !== null) {
    const kind = (m[1] ?? m[3]) as "line" | "next-line";
    const list = (m[2] ?? m[4] ?? "*").trim();
    const rules = new Set(list.split(/[\s,]+/).filter(Boolean));
    if (rules.size === 0) rules.add("*");
    // Find the line index for the match.
    const idx = m.index;
    let line = 0;
    for (let i = 0; i < lineStarts.length; i++) {
      if (lineStarts[i] > idx) {
        line = i - 1;
        break;
      }
      line = i;
    }
    ranges.push({ line, rules, kind });
  }
  return ranges;
}

function isDisabled(issue: Issue, text: string, disables: DisableRange[]): boolean {
  const line = lineOfOffset(text, issue.start);
  for (const d of disables) {
    const target = d.kind === "line" ? d.line : d.line + 1;
    if (target !== line) continue;
    if (d.rules.has("*") || d.rules.has(issue.ruleId)) return true;
  }
  return false;
}

function lineOfOffset(text: string, offset: number): number {
  let line = 0;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === "\n") line++;
  }
  return line;
}
