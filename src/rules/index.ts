/**
 * Registry of all built-in rules. Add new rule files to this list.
 */

import type { Rule } from "../engine/types.js";
import { vocabularyRule, phraseRule, openerRule } from "./vocabulary.js";
import { emDashRule, exclamationRule, ellipsisRule } from "./punctuation.js";
import { parataxisRule, uniformLengthRule, ruleOfThreeRule } from "./structure.js";
import { patternRules } from "./patterns.js";

export const builtinRules: Rule[] = [
  vocabularyRule,
  phraseRule,
  openerRule,
  emDashRule,
  exclamationRule,
  ellipsisRule,
  parataxisRule,
  uniformLengthRule,
  ruleOfThreeRule,
  ...patternRules
];
