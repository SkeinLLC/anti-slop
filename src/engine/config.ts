/**
 * Config loader. Reads .antislop.yml, merges with a preset, returns a
 * ResolvedConfig the engine can run against.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import type { ConfigInput, PresetName, ResolvedConfig, RuleConfig, Severity } from "./types.js";
import { parseYaml } from "./yaml-mini.js";
import { DEFAULT_BANNED_VOCAB, DEFAULT_BANNED_PHRASES, DEFAULT_BANNED_OPENERS } from "./defaults.js";
import { CTI_VOCAB, CTI_PHRASES, MARKETING_VOCAB, MARKETING_PHRASES } from "./presets.js";

const DEFAULT_RULE_SEVERITY: Severity = "warning";

const KNOWN_RULES: Array<{ id: string; defaultEnabled: boolean }> = [
  { id: "vocab.banned", defaultEnabled: true },
  { id: "phrases.banned", defaultEnabled: true },
  { id: "openers.banned", defaultEnabled: true },
  { id: "punctuation.emDash", defaultEnabled: true },
  { id: "punctuation.exclamation", defaultEnabled: true },
  { id: "punctuation.ellipsis", defaultEnabled: true },
  { id: "structure.parataxis", defaultEnabled: true },
  { id: "structure.uniformLength", defaultEnabled: true },
  { id: "structure.ruleOfThree", defaultEnabled: true },
  { id: "pattern.negativeParallelism", defaultEnabled: true },
  { id: "pattern.metaCommentary", defaultEnabled: true },
  { id: "pattern.cutoffDisclaimer", defaultEnabled: true },
  { id: "pattern.todayOpener", defaultEnabled: true },
  { id: "pattern.engagementBait", defaultEnabled: true },
  { id: "pattern.copulativeAvoidance", defaultEnabled: true },
  { id: "pattern.falseRange", defaultEnabled: true }
];

export function resolveConfig(input: ConfigInput): ResolvedConfig {
  const preset = input.preset ?? "default";

  let presetVocab: string[] = [];
  let presetPhrases: string[] = [];
  if (preset === "default") {
    presetVocab = [...DEFAULT_BANNED_VOCAB];
    presetPhrases = [...DEFAULT_BANNED_PHRASES];
  } else if (preset === "cti") {
    presetVocab = [...DEFAULT_BANNED_VOCAB, ...CTI_VOCAB];
    presetPhrases = [...DEFAULT_BANNED_PHRASES, ...CTI_PHRASES];
  } else if (preset === "marketing") {
    presetVocab = [...DEFAULT_BANNED_VOCAB, ...MARKETING_VOCAB];
    presetPhrases = [...DEFAULT_BANNED_PHRASES, ...MARKETING_PHRASES];
  } else if (preset === "off") {
    presetVocab = [];
    presetPhrases = [];
  }

  const vocab = new Set<string>(
    [...presetVocab, ...(input.bannedVocab ?? [])].map((w) => w.toLowerCase())
  );
  const allowedVocab = new Set<string>(
    (input.allowedVocab ?? []).map((w) => w.toLowerCase())
  );
  for (const allow of allowedVocab) {
    vocab.delete(allow);
  }

  const phrases = [...presetPhrases, ...(input.bannedPhrases ?? [])];
  const openers = [...DEFAULT_BANNED_OPENERS, ...(input.bannedOpeners ?? [])];

  const rules: Record<string, RuleConfig> = {};
  for (const { id, defaultEnabled } of KNOWN_RULES) {
    const override = input.rules?.[id];
    rules[id] = {
      enabled: override?.enabled ?? defaultEnabled,
      severity: override?.severity ?? DEFAULT_RULE_SEVERITY
    };
  }

  return {
    bannedVocab: vocab,
    bannedPhrases: phrases,
    bannedOpeners: openers,
    allowedVocab,
    rules,
    maxEmDashesPer500Words: input.maxEmDashesPer500Words ?? 1,
    maxExclamationsPer1000Words: input.maxExclamationsPer1000Words ?? 1,
    maxEllipsesPerPiece: input.maxEllipsesPerPiece ?? 1,
    maxConsecutiveShortSentences: input.maxConsecutiveShortSentences ?? 3,
    shortSentenceWordThreshold: input.shortSentenceWordThreshold ?? 6,
    ruleOfThreeLimit: input.ruleOfThreeLimit ?? 1
  };
}

export function loadConfigFile(filePath: string): ConfigInput {
  const raw = fs.readFileSync(filePath, "utf8");
  // JSON for sandboxed builds and tests; YAML for everything else.
  if (filePath.endsWith(".json")) {
    const parsed = JSON.parse(raw) as ConfigInput | null | undefined;
    return parsed ?? {};
  }
  const parsed = parseYaml(raw) as ConfigInput | null | undefined;
  return parsed ?? {};
}

/**
 * Walk up from startDir to find a .antislop.yml. Stops at filesystem root.
 * Returns null if nothing found.
 */
export function findConfig(startDir: string, filename = ".antislop.yml"): string | null {
  let dir = path.resolve(startDir);
  // 64 hops is plenty; protects against symlink loops.
  for (let i = 0; i < 64; i++) {
    const candidate = path.join(dir, filename);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
  return null;
}

export function loadOrDefault(
  startDir: string,
  fallbackPreset: PresetName = "default"
): ResolvedConfig {
  const found = findConfig(startDir);
  if (found) {
    return resolveConfig(loadConfigFile(found));
  }
  return resolveConfig({ preset: fallbackPreset });
}
