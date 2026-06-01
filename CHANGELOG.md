# Changelog

All notable changes to Anti-Slop get tracked in this file, with versions following semver.

## 0.1.0, released 2026-06-01

Initial public release of Anti-Slop, with the engine, the VS Code extension, and the CLI all going out at version 0.1.0 together.

The engine ships with 16 built-in rules across four categories. The VS Code extension adds editor diagnostics with hover messages and quick-fix code actions. The standalone CLI supports four output formats for terminal, CI annotations, and JSON consumers. Three presets ship by default. Inline disable comments work as `<!-- antislop-disable-line -->`, `// antislop-disable-line`, or `# antislop-disable-line`. Configs are discovered by walking up from the open file. 53 unit specs cover the rule set with both positive and negative cases.

Known gaps to address in the next release:

The sentence splitter is naive about abbreviations and can split "Dr. Smith" into two sentences. Impact on the structural rules is low but the fix is worth doing. <!-- antislop-disable-line structure.parataxis -->

The negative-parallelism regex still misses some sneaky variants, like "X gets all the attention, but Y is where..." which the next release will cover via a separate sub-rule. <!-- antislop-disable-line structure.parataxis pattern.negativeParallelism -->

Structural rules emit warnings only. Quick-fix replacements are limited to the vocabulary rule.

LLM-backed "suggest a rewrite" sits on the roadmap as an opt-in v1.1 feature, not part of the free tier.
