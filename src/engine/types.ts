/**
 * Core types for the Anti-Slop rule engine.
 *
 * A Rule reads source text and emits Issues with absolute character offsets.
 * The VS Code adapter turns those offsets into Range diagnostics; the CLI
 * adapter turns them into file:line:col output.
 *
 * Keeping the engine ignorant of VS Code makes it usable from CLI, CI,
 * pre-commit hooks, and any other Node host.
 */

export type Severity = "error" | "warning" | "info" | "hint";

export interface Issue {
  ruleId: string;
  /** Character offset, inclusive, into the original source text. */
  start: number;
  /** Character offset, exclusive. */
  end: number;
  message: string;
  severity: Severity;
  /** Human-readable category for grouping: vocab, structure, punctuation, pattern. */
  category: string;
  /** Optional replacement suggestion the quick-fix can apply verbatim. */
  fix?: string;
  /** Optional explanation of *why* the rule fired. Shown on hover. */
  why?: string;
}

export interface RuleContext {
  /** Word count of the whole document. Cached by the engine. */
  wordCount: number;
  /** Source text. */
  text: string;
  /** Active config. */
  config: ResolvedConfig;
}

export interface Rule {
  id: string;
  category: string;
  description: string;
  /** Default severity if config does not override. */
  defaultSeverity: Severity;
  check(ctx: RuleContext): Issue[];
}

export type PresetName = "default" | "cti" | "marketing" | "off";

export interface ConfigInput {
  preset?: PresetName;
  bannedVocab?: string[];
  bannedPhrases?: string[];
  bannedOpeners?: string[];
  allowedVocab?: string[];
  rules?: Record<string, Partial<RuleConfig>>;
  maxEmDashesPer500Words?: number;
  maxExclamationsPer1000Words?: number;
  maxEllipsesPerPiece?: number;
  maxConsecutiveShortSentences?: number;
  shortSentenceWordThreshold?: number;
  ruleOfThreeLimit?: number;
}

export interface RuleConfig {
  enabled: boolean;
  severity: Severity;
}

export interface ResolvedConfig {
  bannedVocab: Set<string>;
  bannedPhrases: string[];
  bannedOpeners: string[];
  allowedVocab: Set<string>;
  rules: Record<string, RuleConfig>;
  maxEmDashesPer500Words: number;
  maxExclamationsPer1000Words: number;
  maxEllipsesPerPiece: number;
  maxConsecutiveShortSentences: number;
  shortSentenceWordThreshold: number;
  ruleOfThreeLimit: number;
}
